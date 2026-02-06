/**
 * Mem0-Enhanced Chat API
 * Uses Mem0 for automatic memory recall and capture
 * Uses AWS Bedrock (Claude) for LLM
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { bedrockChatStream, CLAUDE_MODELS } from '@/lib/bedrock';
import { Mem0Client } from '@/lib/mem0';
import { checkRateLimit } from '@/lib/rate-limit';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: 'SONNET' | 'HAIKU' | 'OPUS';
  systemPrompt?: string;
}

/**
 * Build system prompt with memory context
 */
function buildSystemPrompt(
  basePrompt: string,
  memories: Array<{ memory: string; score?: number }>,
  aiName?: string
): string {
  const name = aiName || 'SoulPrint';
  
  let prompt = basePrompt || `You are ${name}, a personalized AI assistant with memory of past conversations. 
You remember details about the user from previous interactions and use this knowledge to provide helpful, contextual responses.
Be warm, helpful, and reference past conversations when relevant.`;

  if (memories.length > 0) {
    const memoryContext = memories
      .map((m, i) => `${i + 1}. ${m.memory}`)
      .join('\n');
    
    prompt += `\n\n## Relevant Memories from Past Conversations\n${memoryContext}\n\nUse these memories to personalize your response when relevant.`;
  }

  return prompt;
}

/**
 * POST /api/chat/mem0
 * Memory-enhanced chat with streaming via Bedrock
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    // Parse request
    const body: ChatRequest = await request.json();
    const { messages, model = 'SONNET', systemPrompt } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response('messages array required', { status: 400 });
    }

    // Get the latest user message for memory search
    const latestUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user');

    // Fetch relevant memories from Mem0
    let memories: Array<{ memory: string; score?: number }> = [];
    
    const mem0ApiKey = process.env.MEM0_API_KEY;
    if (mem0ApiKey && latestUserMessage) {
      try {
        const client = new Mem0Client({
          mode: 'cloud',
          apiKey: mem0ApiKey,
        });

        const searchResult = await client.search(
          latestUserMessage.content,
          {
            userId: user.id,
            limit: 5,
            threshold: 0.3,
          }
        );

        memories = searchResult.results || [];
        console.log(`[Mem0 Chat] Found ${memories.length} relevant memories`);
      } catch (memError) {
        console.error('[Mem0 Chat] Memory search failed:', memError);
      }
    }

    // Get user's AI name and SoulPrint from profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('ai_name')
      .eq('user_id', user.id)
      .single();

    // Check for SoulPrint system prompt
    let soulprintPrompt = systemPrompt || '';
    const { data: soulprint } = await supabase
      .from('soulprints')
      .select('system_prompt')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (soulprint?.system_prompt) {
      soulprintPrompt = soulprint.system_prompt;
    }

    // Build system prompt with memories
    const enhancedSystemPrompt = buildSystemPrompt(
      soulprintPrompt,
      memories,
      profile?.ai_name
    );

    // Filter to user/assistant messages only (Bedrock format)
    const chatMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Create streaming response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of bedrockChatStream({
            model,
            system: enhancedSystemPrompt,
            messages: chatMessages,
          })) {
            fullResponse += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          // Auto-capture after stream completes
          if (mem0ApiKey && latestUserMessage && fullResponse) {
            try {
              const client = new Mem0Client({
                mode: 'cloud',
                apiKey: mem0ApiKey,
              });

              await client.add(
                [
                  { role: 'user', content: latestUserMessage.content },
                  { role: 'assistant', content: fullResponse },
                ],
                {
                  userId: user.id,
                  metadata: {
                    source: 'soulprint-chat',
                    capturedAt: new Date().toISOString(),
                  },
                }
              );
              console.log('[Mem0 Chat] Auto-captured conversation exchange');
            } catch (captureError) {
              console.error('[Mem0 Chat] Auto-capture failed:', captureError);
            }
          }

          controller.close();
        } catch (error) {
          console.error('[Mem0 Chat] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    console.error('[Mem0 Chat] Error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Chat failed',
      { status: 500 }
    );
  }
}
