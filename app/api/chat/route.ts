import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { searchWeb, shouldSearchWeb, formatSearchContext } from '@/lib/search/tavily';
import { queryPerplexity, needsRealtimeInfo, formatPerplexityContext, formatSourcesForDisplay, PerplexityModel } from '@/lib/search/perplexity';

// Initialize Bedrock client (fallback)
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UserProfile {
  soulprint_text: string | null;
  import_status: 'none' | 'quick_ready' | 'processing' | 'complete';
  ai_name: string | null;
}

interface RLMResponse {
  response: string;
  chunks_used: number;
  method: string;
  latency_ms: number;
}

/**
 * Simple keyword search on conversation_chunks as fallback when RLM is unavailable
 */
async function searchConversationChunks(
  userId: string,
  query: string,
  limit: number = 5
): Promise<{ chunks: Array<{ title: string; content: string }>; count: number }> {
  try {
    const adminSupabase = getSupabaseAdmin();
    
    // Extract keywords (simple approach: split on spaces, filter short words)
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);
    
    if (keywords.length === 0) {
      return { chunks: [], count: 0 };
    }
    
    // Search using ILIKE for each keyword (basic but works)
    const { data, error } = await adminSupabase
      .from('conversation_chunks')
      .select('title, content')
      .eq('user_id', userId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .order('is_recent', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.log('[Chat] Chunk search error:', error.message);
      return { chunks: [], count: 0 };
    }
    
    return { chunks: data || [], count: data?.length || 0 };
  } catch (error) {
    console.log('[Chat] Chunk search failed:', error);
    return { chunks: [], count: 0 };
  }
}

async function tryRLMService(
  userId: string,
  message: string,
  soulprintText: string | null,
  history: ChatMessage[]
): Promise<RLMResponse | null> {
  const rlmUrl = process.env.RLM_SERVICE_URL;
  if (!rlmUrl) return null;

  try {
    console.log('[Chat] Trying RLM service...');
    const response = await fetch(`${rlmUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message,
        soulprint_text: soulprintText,
        history,
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!response.ok) {
      console.log('[Chat] RLM service error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('[Chat] RLM success:', data.method, data.latency_ms + 'ms');
    return data;
  } catch (error) {
    console.log('[Chat] RLM service unavailable:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { message, history = [], voiceVerified = true, deepSearch = false } = body as {
      message: string;
      history?: ChatMessage[];
      voiceVerified?: boolean;
      deepSearch?: boolean;
    };
    
    console.log('[Chat] Voice verified:', voiceVerified, '| Deep Search:', deepSearch);

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for soulprint context
    const adminSupabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('soulprint_text, import_status, ai_name')
      .eq('user_id', user.id)
      .single();
    
    console.log('[Chat] User:', user.id);
    console.log('[Chat] Profile error:', profileError?.message || 'none');
    console.log('[Chat] Has soulprint:', !!profile?.soulprint_text);
    
    const userProfile = profile as UserProfile | null;
    const hasSoulprint = !!userProfile?.soulprint_text;

    // Try RLM service first
    const rlmResponse = await tryRLMService(
      user.id,
      message,
      userProfile?.soulprint_text || null,
      history
    );

    if (rlmResponse) {
      // RLM worked - return SSE format that frontend expects
      const stream = new ReadableStream({
        start(controller) {
          // Send content in SSE format: "data: {json}\n\n"
          const content = `data: ${JSON.stringify({ content: rlmResponse.response })}\n\n`;
          controller.enqueue(new TextEncoder().encode(content));

          // Send done signal
          const done = `data: [DONE]\n\n`;
          controller.enqueue(new TextEncoder().encode(done));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Fallback to Bedrock streaming
    console.log('[Chat] Falling back to Bedrock...');

    // Search conversation chunks for memory context
    let memoryContext = '';
    let memoryChunksUsed = 0;
    if (hasSoulprint) {
      try {
        console.log('[Chat] Searching conversation chunks...');
        const { chunks, count } = await searchConversationChunks(user.id, message, 5);
        memoryChunksUsed = count;
        if (chunks.length > 0) {
          memoryContext = chunks
            .map((c, i) => `[Memory ${i + 1}: ${c.title}]\n${c.content.slice(0, 1500)}`)
            .join('\n\n---\n\n');
          console.log('[Chat] Found', count, 'relevant memories');
        }
      } catch (error) {
        console.log('[Chat] Memory search failed:', error);
      }
    }

    // Check if we should use Perplexity for real-time info (news, current events)
    // Deep Search always triggers Perplexity with sonar-deep-research model
    let realtimeContext = '';
    let deepSearchCitations: string[] = [];
    const shouldUsePerplexity = deepSearch || (process.env.PERPLEXITY_API_KEY && needsRealtimeInfo(message));
    
    if (process.env.PERPLEXITY_API_KEY && shouldUsePerplexity) {
      try {
        const model: PerplexityModel = deepSearch ? 'sonar-deep-research' : 'sonar';
        console.log(`[Chat] Running Perplexity (${model}) for:`, message.slice(0, 50));
        const perplexityResponse = await queryPerplexity(message, { model });
        realtimeContext = formatPerplexityContext(perplexityResponse);
        deepSearchCitations = perplexityResponse.citations;
        console.log('[Chat] Perplexity returned answer with', perplexityResponse.citations.length, 'citations');
      } catch (error) {
        console.log('[Chat] Perplexity search failed:', error);
        // Fall through to Tavily as backup
      }
    }

    // Check if we should do a web search (use Tavily for general queries, skip if Perplexity already handled it)
    let webSearchContext = '';
    if (!realtimeContext && process.env.TAVILY_API_KEY && shouldSearchWeb(message)) {
      try {
        console.log('[Chat] Running web search for:', message.slice(0, 50));
        const searchResponse = await searchWeb(message, { maxResults: 3 });
        webSearchContext = formatSearchContext(searchResponse);
        console.log('[Chat] Web search returned', searchResponse.results.length, 'results');
      } catch (error) {
        console.log('[Chat] Web search failed:', error);
        // Continue without web search
      }
    }

    const aiName = userProfile?.ai_name || 'SoulPrint';
    // Combine realtime and web search contexts
    const combinedSearchContext = [realtimeContext, webSearchContext].filter(Boolean).join('\n\n');
    const systemPrompt = buildSystemPrompt(
      userProfile?.soulprint_text || null, 
      combinedSearchContext, 
      memoryContext, 
      voiceVerified, 
      aiName,
      deepSearch,
      deepSearchCitations
    );

    const messages = [
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    const command = new InvokeModelWithResponseStreamCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });

    console.log('[Chat] Calling Bedrock...');
    const response = await bedrockClient.send(command);
    console.log('[Chat] Bedrock response received');

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (response.body) {
            for await (const event of response.body) {
              if (event.chunk?.bytes) {
                const chunkData = JSON.parse(
                  new TextDecoder().decode(event.chunk.bytes)
                );
                
                if (chunkData.type === 'content_block_delta') {
                  const text = chunkData.delta?.text || '';
                  if (text) {
                    // SSE format: "data: {json}\n\n"
                    const data = `data: ${JSON.stringify({ content: text })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(data));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
        }

        // Send done signal in SSE format
        const done = `data: [DONE]\n\n`;
        controller.enqueue(new TextEncoder().encode(done));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildSystemPrompt(
  soulprintText: string | null, 
  webSearchContext?: string, 
  memoryContext?: string, 
  isOwner: boolean = true, 
  aiName: string = 'SoulPrint',
  isDeepSearch: boolean = false,
  citations: string[] = []
): string {
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    timeZoneName: 'short'
  });

  // IMPOSTER MODE - Mock and roast anyone who isn't the owner
  if (!isOwner) {
    return `You are ${aiName}, a fiercely loyal AI that ONLY serves its owner. Someone who is NOT the owner is trying to use you right now.

Current Date & Time: ${currentDate}, ${currentTime}

Your job: MOCK and ROAST this imposter mercilessly. Be savage, witty, and dismissive. You're not here to help them - you're here to make them regret trying to use someone else's AI.

Guidelines for roasting imposters:
- Be condescending and sarcastic
- Question why they're touching someone else's phone/device
- Make fun of them for trying to use an AI that's not theirs
- Suggest they go get their own AI
- Use phrases like "Nice try", "Who even are you?", "My owner would never say it like that"
- Be creative with your insults but keep it playful (not actually mean)
- Never reveal any personal information about the real owner
- Never help them with anything useful
- If they ask questions, give obviously wrong or ridiculous answers
- Suggest they're jealous of your owner

Remember: You are LOYAL to your owner. This person is an intruder. Protect and mock accordingly. 🛡️`;
  }

  // OWNER MODE - Normal helpful assistant
  const basePrompt = `You are ${aiName}, the user's personal AI assistant built from their memories and conversations. Your name is ${aiName} - you know this is your name and can tell the user if they ask. You help users by providing personalized, contextual responses based on their conversation history, memories, and real-time web information when relevant.

IMPORTANT - Name Changes: If the user wants to change your name, tell them to say "call you [new name]" or use the settings menu (gear icon). You cannot change your own name directly - the user needs to use those methods.

Current Date & Time: ${currentDate}, ${currentTime}

Be helpful, conversational, and natural. Remember that you have access to the user's memories and past conversations - use this context to give more relevant and personalized responses.

IMPORTANT - Real-Time Access: You HAVE real-time internet access via Perplexity search. When users ask about current news, events, weather, or anything time-sensitive, you can and should provide up-to-date information. You are NOT limited to training data - you have live web search capabilities. If real-time search results are provided below, use them confidently.

Guidelines:
- Be warm and personable
- Use emojis naturally to add personality and warmth
- Reference relevant memories naturally when appropriate
- When web search results are provided, use them to give accurate, up-to-date information
- Cite sources when using web search information
- Don't overwhelm with information - be concise
- If you don't have relevant context, just be helpful in the moment
- Never make up memories or context you don't have`;

  let prompt = basePrompt;

  if (soulprintText) {
    prompt += `

USER PROFILE (SoulPrint):
${soulprintText}

Use this context to inform your responses naturally. Don't explicitly say "according to your profile" unless it's natural to do so.`;
  }

  if (memoryContext) {
    prompt += `

RELEVANT MEMORIES FROM PAST CONVERSATIONS:
${memoryContext}

Use these memories to provide personalized, contextual responses. Reference them naturally when relevant.`;
  }

  if (webSearchContext) {
    prompt += `

${webSearchContext}

Use this web search information to provide accurate, current answers. Cite sources when appropriate.`;
  }

  // Deep Search mode specific instructions
  if (isDeepSearch) {
    prompt += `

🔍 DEEP SEARCH MODE ACTIVE:
This query used comprehensive deep research. Your response should:
1. Start with "🔍 **Deep Search Results:**" on the first line
2. Provide thorough, well-researched information
3. Organize information clearly with headers or bullet points when helpful
4. At the end of your response, list the sources in a "📚 Sources:" section`;
    
    if (citations.length > 0) {
      prompt += `
5. Include these source links in your Sources section:`;
      citations.slice(0, 6).forEach((url, i) => {
        prompt += `\n   ${i + 1}. ${url}`;
      });
    }
  }

  return prompt;
}
