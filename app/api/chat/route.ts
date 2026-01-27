import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { searchWeb, shouldSearchWeb, formatSearchContext } from '@/lib/search/tavily';

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
}

interface RLMResponse {
  response: string;
  chunks_used: number;
  method: string;
  latency_ms: number;
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
    const { message, history = [] } = body as {
      message: string;
      history?: ChatMessage[];
    };

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
      .select('soulprint_text, import_status')
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
      // RLM worked - return non-streaming response
      const stream = new ReadableStream({
        start(controller) {
          const metadata = JSON.stringify({
            type: 'metadata',
            hasMemoryContext: rlmResponse.chunks_used > 0,
            hasSoulprint,
            method: rlmResponse.method,
            memoryChunksUsed: rlmResponse.chunks_used,
          }) + '\n';
          controller.enqueue(new TextEncoder().encode(metadata));

          const text = JSON.stringify({ type: 'text', text: rlmResponse.response }) + '\n';
          controller.enqueue(new TextEncoder().encode(text));

          const done = JSON.stringify({ type: 'done' }) + '\n';
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

    // Check if we should do a web search
    let webSearchContext = '';
    if (process.env.TAVILY_API_KEY && shouldSearchWeb(message)) {
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

    const systemPrompt = buildSystemPrompt(userProfile?.soulprint_text || null, webSearchContext);

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
        const metadata = JSON.stringify({
          type: 'metadata',
          hasMemoryContext: false,
          hasSoulprint,
          method: 'bedrock',
          memoryChunksUsed: 0,
        }) + '\n';
        controller.enqueue(new TextEncoder().encode(metadata));

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
                    const data = JSON.stringify({ type: 'text', text }) + '\n';
                    controller.enqueue(new TextEncoder().encode(data));
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ type: 'error', error: 'Stream failed' }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
        }

        const done = JSON.stringify({ type: 'done' }) + '\n';
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

function buildSystemPrompt(soulprintText: string | null, webSearchContext?: string): string {
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

  const basePrompt = `You are SoulPrint, an AI assistant with memory and web search capabilities. You help users by providing personalized, contextual responses based on their conversation history, memories, and real-time web information when relevant.

Current Date & Time: ${currentDate}, ${currentTime}

Be helpful, conversational, and natural. Remember that you have access to the user's memories and past conversations - use this context to give more relevant and personalized responses.

Guidelines:
- Be warm and personable
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

  if (webSearchContext) {
    prompt += `

${webSearchContext}

Use this web search information to provide accurate, current answers. Cite sources when appropriate.`;
  }

  return prompt;
}
