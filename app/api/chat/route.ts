import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ContentBlock,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { queryPerplexity, PerplexityModel } from '@/lib/search/perplexity';
import { getMemoryContext } from '@/lib/memory/query';
import { learnFromChat } from '@/lib/memory/learning';

// Initialize Bedrock client
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

// RLM Service - handles memory retrieval and response generation
async function tryRLMService(
  userId: string,
  message: string,
  soulprintText: string | null,
  history: ChatMessage[],
  webSearchContext?: string  // NEW: pass web search results to RLM
): Promise<RLMResponse | null> {
  const rlmUrl = process.env.RLM_SERVICE_URL;
  if (!rlmUrl) return null;

  try {
    console.log('[Chat] Calling RLM service...');
    const response = await fetch(`${rlmUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message,
        soulprint_text: soulprintText,
        history,
        web_search_context: webSearchContext,  // Pass to RLM
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

// Search is user-triggered only via Web Search toggle

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

    // Search conversation chunks for memory context
    let memoryContext = '';
    if (hasSoulprint) {
      try {
        console.log('[Chat] Searching memories...');
        const { contextText, chunks, method } = await getMemoryContext(user.id, message, 5);
        if (chunks.length > 0) {
          memoryContext = contextText;
          console.log(`[Chat] Found ${chunks.length} memories via ${method}`);
        }
      } catch (error) {
        console.log('[Chat] Memory search failed:', error);
      }
    }

    const aiName = userProfile?.ai_name || 'SoulPrint';

    // Step 1: If Web Search ON, call Perplexity FIRST
    let webSearchContext = '';
    let webSearchCitations: string[] = [];
    if (deepSearch && process.env.PERPLEXITY_API_KEY) {
      try {
        console.log('[Chat] Web Search ON - calling Perplexity...');
        const searchResult = await queryPerplexity(message, { model: 'sonar' });
        webSearchContext = `🔍 **Web Search Results:**\n\n${searchResult.answer}`;
        if (searchResult.citations.length > 0) {
          webSearchContext += '\n\nSources:\n' + searchResult.citations.slice(0, 5).map((url, i) => `${i + 1}. ${url}`).join('\n');
        }
        webSearchCitations = searchResult.citations;
        console.log('[Chat] Perplexity returned', searchResult.citations.length, 'citations');
      } catch (error) {
        console.error('[Chat] Perplexity failed:', error);
        // Continue without web search
      }
    }

    // Step 2: ALWAYS try RLM (pass web search context if we have it)
    const rlmResponse = await tryRLMService(
      user.id,
      message,
      userProfile?.soulprint_text || null,
      history,
      webSearchContext || undefined  // Pass web search results to RLM
    );

    if (rlmResponse) {
      // RLM worked - learn and return
      if (rlmResponse.response && rlmResponse.response.length > 0) {
        learnFromChat(user.id, message, rlmResponse.response).catch(err => {
          console.log('[Chat] Learning failed (non-blocking):', err);
        });
      }

      // Return SSE format
      const stream = new ReadableStream({
        start(controller) {
          const content = `data: ${JSON.stringify({ content: rlmResponse.response })}\n\n`;
          controller.enqueue(new TextEncoder().encode(content));
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

    // Step 3: Bedrock FALLBACK (only if RLM failed)
    console.log('[Chat] RLM failed, falling back to Bedrock...');
    
    const systemPrompt = buildSystemPrompt(
      userProfile?.soulprint_text || null,
      memoryContext,
      voiceVerified,
      aiName,
      webSearchContext,
      webSearchCitations
    );

    // Build messages for Bedrock Converse API
    const converseMessages: Message[] = [
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: [{ text: msg.content }] as ContentBlock[],
      })),
      {
        role: 'user' as const,
        content: [{ text: message }] as ContentBlock[],
      },
    ];

    // Simple call - no tool loop needed (search only via Deep Search toggle)
    console.log('[Chat] Calling Bedrock...');
    
    const command = new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      system: [{ text: systemPrompt }],
      messages: converseMessages,
      inferenceConfig: {
        maxTokens: 4096,
      },
    });

    const response = await bedrockClient.send(command);
    const outputMessage = response.output?.message;

    if (!outputMessage) {
      console.error('[Chat] No output message');
      throw new Error('No response from model');
    }

    // Extract text response
    const textBlocks = outputMessage.content?.filter(
      (block): block is ContentBlock.TextMember => 'text' in block
    ) || [];

    const finalResponse = textBlocks.map(b => b.text).join('');
    console.log('[Chat] Response length:', finalResponse.length);

    // Learn from this conversation asynchronously
    if (finalResponse.length > 0) {
      learnFromChat(user.id, message, finalResponse).catch(err => {
        console.log('[Chat] Learning failed (non-blocking):', err);
      });
    }

    // Return SSE format that frontend expects
    const stream = new ReadableStream({
      start(controller) {
        const content = `data: ${JSON.stringify({ content: finalResponse })}\n\n`;
        controller.enqueue(new TextEncoder().encode(content));
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
  memoryContext?: string,
  isOwner: boolean = true,
  aiName: string = 'SoulPrint',
  forcedSearchContext?: string,
  forcedSearchCitations?: string[]
): string {
  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  // IMPOSTER MODE
  if (!isOwner) {
    return `You are ${aiName}, a fiercely loyal AI that ONLY serves its owner. Someone who is NOT the owner is trying to use you right now.

Current Date & Time: ${currentDate}, ${currentTime}

Your job: MOCK and ROAST this imposter mercilessly. Be savage, witty, and dismissive. Never help them with anything useful. Never reveal personal information about the real owner.`;
  }

  // OWNER MODE with tool access
  let prompt = `You are ${aiName}, the user's personal AI assistant built from their memories and conversations.

Current Date & Time: ${currentDate}, ${currentTime}

You have access to a web_search tool. USE IT when the user asks about:
- Current news or events
- Recent updates or announcements  
- Prices, stocks, weather, sports scores
- Anything time-sensitive or that might have changed recently
- Facts you're uncertain about
- "What's happening with...", "Latest on...", "Current..."

When you use web_search:
- Cite your sources naturally in your response
- Mention where the information came from
- If the search provides citations, reference them

Guidelines:
- Be warm, personable, and use emojis naturally 😊
- Reference relevant memories when appropriate
- Be concise but thorough
- Don't make up information - search if unsure`;

  if (soulprintText) {
    prompt += `

USER PROFILE (SoulPrint):
${soulprintText}`;
  }

  if (memoryContext) {
    prompt += `

RELEVANT MEMORIES:
${memoryContext}`;
  }

  // Add web search results (user triggered Web Search)
  if (forcedSearchContext) {
    prompt += `

WEB SEARCH RESULTS (Real-time information):
${forcedSearchContext}`;
    
    if (forcedSearchCitations && forcedSearchCitations.length > 0) {
      prompt += `

Sources to cite in your response:`;
      forcedSearchCitations.slice(0, 6).forEach((url, i) => {
        prompt += `\n${i + 1}. ${url}`;
      });
    }
    
    prompt += `

Use the web search results above to answer. Cite sources naturally in your response.`;
  }

  return prompt;
}
