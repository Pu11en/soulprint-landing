import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { streamChatCompletion, ChatMessage } from '@/lib/llm/local-client';
import { SoulEngine } from '@/lib/soulprint/soul-engine';
import { generateEmbedding } from '@/lib/soulprint/memory/retrieval';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';
import { runPostChatAnalysis } from '@/lib/soulprint/post-chat-analysis';

// Supabase admin client for database operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API Key & Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer sk-soulprint-')) {
      return NextResponse.json({ error: 'Missing or invalid API key' }, { status: 401 });
    }

    const rawKey = authHeader.replace('Bearer ', '');
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');

    const { data: keyData, error: keyError } = await supabaseAdmin
      .from('api_keys')
      .select('user_id')
      .eq('key_hash', hashedKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const userId = keyData.user_id;

    // 1.5 Rate Limit Check
    const rateCheck = await checkRateLimit(userId);
    if (rateCheck && !rateCheck.success) {
      return NextResponse.json(rateLimitResponse(), { status: 429 });
    }

    // 2. Load Active SoulPrint
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('current_soulprint_id')
      .eq('id', userId)
      .single();

    if (!profile?.current_soulprint_id) {
      return NextResponse.json({ error: 'No active SoulPrint found for user' }, { status: 400 });
    }

    const { data: soulData } = await supabaseAdmin
      .from('soulprints')
      .select('soulprint_data')
      .eq('id', profile.current_soulprint_id)
      .single();

    if (!soulData) {
      return NextResponse.json({ error: 'SoulPrint data corrupted' }, { status: 500 });
    }

    // 3. Initialize SoulEngine
    const engine = new SoulEngine(supabaseAdmin, userId, soulData.soulprint_data);

    // 4. Parse Messages
    const body = await request.json();
    const { messages } = body as { messages: ChatMessage[] };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    // 5. Construct Dynamic System Prompt (Agentic Step)
    let systemPrompt = await engine.constructSystemPrompt(messages);

    // 5.5 Web Search Augmentation (Real-time Info)
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === 'user' && engine.needsWebSearch(lastUserMsg.content)) {
      const webContext = await engine.searchWeb(lastUserMsg.content);
      if (webContext) {
        systemPrompt += `\n\n## REAL-TIME WEB SEARCH RESULTS\n${webContext}\n\n## CITATION INSTRUCTIONS (MANDATORY)
When answering questions using the web search results above, you MUST:
1. Include clickable source links at the end of your response
2. Format citations like this: "According to [Source Title](URL)..."
3. List all sources used at the bottom under "📚 Sources:"
4. Example format:
   
   [Your answer here]
   
   📚 Sources:
   - [Article Title](https://example.com/article)
   - [Another Source](https://example.com/source2)

NEVER give information from web search without citing the source URL.`;
      }
    }

    // 6. Streaming Response
    const fullContext: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          // Stream chunks from Local LLM
          for await (const chunk of streamChatCompletion(fullContext)) {
            fullResponse += chunk;
            // Format as OpenAI-compatible SSE
            const data = JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: 'soulprint-v2-local',
              choices: [{
                index: 0,
                delta: { content: chunk },
                finish_reason: null
              }]
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          // Send [DONE] message
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

          // 7. Background Persistence (Fire & Forget)
          (async () => {
            try {
              const lastUserMsg = messages[messages.length - 1];
              const [userEmbedding, assistantEmbedding] = await Promise.all([
                generateEmbedding(lastUserMsg.content),
                generateEmbedding(fullResponse)
              ]);

              await supabaseAdmin.from('chat_logs').insert([
                {
                  user_id: userId,
                  role: 'user',
                  content: lastUserMsg.content,
                  embedding: userEmbedding
                },
                {
                  user_id: userId,
                  role: 'assistant',
                  content: fullResponse,
                  embedding: assistantEmbedding
                }
              ]);

              // 8. Post-Chat Evolution Analysis (runs every 10+ messages)
              const totalMessages = messages.length + 1; // +1 for assistant response
              if (totalMessages >= 10) {
                const allMessages: ChatMessage[] = [
                  ...messages,
                  { role: 'assistant', content: fullResponse }
                ];
                
                runPostChatAnalysis(
                  supabaseAdmin,
                  userId,
                  profile.current_soulprint_id,
                  soulData.soulprint_data,
                  allMessages
                ).then(result => {
                  if (result.evolved) {
                    console.log('[PostChatAnalysis] 🔥 SoulPrint evolved!');
                  }
                }).catch(err => {
                  console.error('[PostChatAnalysis] Background analysis failed:', err);
                });
              }
            } catch (e) {
              console.error("Async Memory Persistence Failed:", e);
            }
          })();

        } catch (e) {
          console.error("Streaming failed:", e);
          controller.error(e);
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error('SoulEngine Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'SoulEngine Failure', details: message }, { status: 500 });
  }
}
