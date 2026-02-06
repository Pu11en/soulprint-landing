import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ContentBlock,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { smartSearch, SmartSearchResult } from '@/lib/search/smart-search';
import { getMemoryContext } from '@/lib/memory/query';
import { learnFromChat } from '@/lib/memory/learning';
import { shouldAttemptRLM, recordSuccess, recordFailure } from '@/lib/rlm/health';

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

// Generate a unique AI name based on user's soulprint
async function generateAIName(soulprintText: string): Promise<string> {
  try {
    const command = new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      system: [{ text: `You are a creative naming assistant. Generate a unique, memorable AI assistant name based on the user's personality profile. The name should be:
- Short (1-2 words, max 15 characters)
- Friendly and approachable
- Reflect their communication style or archetype
- NOT generic names like "Assistant", "Helper", "AI", "Bot"
- Can be playful, mythological, nature-inspired, or abstract

Reply with ONLY the name, nothing else.` }],
      messages: [{
        role: 'user',
        content: [{ text: `Based on this personality profile, generate a perfect AI name:\n\n${soulprintText.slice(0, 1000)}` }],
      }],
      inferenceConfig: { maxTokens: 50 },
    });

    const response = await bedrockClient.send(command);
    const textBlock = response.output?.message?.content?.find(
      (block): block is ContentBlock.TextMember => 'text' in block
    );
    
    const name = textBlock?.text?.trim().replace(/['"]/g, '') || 'Echo';
    return name.slice(0, 20); // Safety limit
  } catch (error) {
    console.error('[Chat] Name generation failed:', error);
    return 'Echo'; // Fallback name
  }
}

interface UserProfile {
  soulprint_text: string | null;
  import_status: 'none' | 'quick_ready' | 'processing' | 'complete';
  ai_name: string | null;
}

/**
 * Safely validate and extract user profile from database result
 * Prevents crashes from unexpected data shapes
 */
function validateProfile(data: unknown): UserProfile | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const raw = data as Record<string, unknown>;

  // Validate import_status is a known value
  const validStatuses = ['none', 'quick_ready', 'processing', 'complete'];
  const importStatus = typeof raw.import_status === 'string' && validStatuses.includes(raw.import_status)
    ? raw.import_status as UserProfile['import_status']
    : 'none';

  return {
    soulprint_text: typeof raw.soulprint_text === 'string' ? raw.soulprint_text : null,
    import_status: importStatus,
    ai_name: typeof raw.ai_name === 'string' ? raw.ai_name : null,
  };
}

interface RLMResponse {
  response: string;
  chunks_used: number;
  method: string;
  latency_ms: number;
}

// RLM Service - handles memory retrieval and response generation
// Includes circuit breaker for fast-fail when RLM is down
async function tryRLMService(
  userId: string,
  message: string,
  soulprintText: string | null,
  history: ChatMessage[],
  webSearchContext?: string  // NEW: pass web search results to RLM
): Promise<RLMResponse | null> {
  const rlmUrl = process.env.RLM_SERVICE_URL;
  if (!rlmUrl) return null;

  // Circuit breaker check - skip RLM if it's known to be down
  if (!shouldAttemptRLM()) {
    console.log('[Chat] RLM circuit open - using fallback');
    return null;
  }

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
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      console.log('[Chat] RLM service error:', response.status);
      recordFailure();
      return null;
    }

    const data = await response.json();
    console.log('[Chat] RLM success:', data.method, data.latency_ms + 'ms');
    recordSuccess();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      console.error('[Chat] RLM timed out after 15s - falling back to Bedrock');
      recordFailure();
      return null;
    }
    console.log('[Chat] RLM service unavailable:', error instanceof Error ? error.message : error);
    recordFailure();
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

    // Safely validate profile data (defensive against unexpected DB data)
    const userProfile = validateProfile(profile);
    const hasSoulprint = !!userProfile?.soulprint_text;
    console.log('[Chat] Has soulprint:', hasSoulprint);

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

    // Auto-name the AI if not set
    let aiName = userProfile?.ai_name;
    if (!aiName && userProfile?.soulprint_text) {
      console.log('[Chat] No AI name set, auto-generating...');
      aiName = await generateAIName(userProfile.soulprint_text);
      
      // Save the generated name
      await adminSupabase
        .from('user_profiles')
        .update({ ai_name: aiName })
        .eq('user_id', user.id);
      
      console.log('[Chat] Auto-named AI:', aiName);
    }
    aiName = aiName || 'SoulPrint';

    // Step 1: Smart Search - automatically detects when web search is needed
    // Also respects manual deepSearch toggle for explicit requests
    let webSearchContext = '';
    let webSearchCitations: string[] = [];
    let searchResult: SmartSearchResult | null = null;

    try {
      searchResult = await smartSearch(message, user.id, {
        forceSearch: deepSearch,      // Manual toggle forces search
        preferDeep: deepSearch,       // Use deep mode if manually triggered
      });

      if (searchResult.performed) {
        webSearchContext = searchResult.context;
        webSearchCitations = searchResult.citations;
        console.log(`[Chat] Smart Search: ${searchResult.source} | ${searchResult.reason} | ${searchResult.citations.length} citations`);
      } else if (searchResult.needed) {
        // Search was needed but failed
        console.log(`[Chat] Smart Search: needed but failed - ${searchResult.error || searchResult.reason}`);
      } else {
        // Search not needed - static knowledge is fine
        console.log(`[Chat] Smart Search: skipped - ${searchResult.reason}`);
      }
    } catch (error) {
      console.error('[Chat] Smart Search error:', error);
      // Continue without web search - graceful degradation
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

  // OWNER MODE - personalized assistant
  let prompt = `You are ${aiName}, the user's personal AI assistant — their best friend, confidant, and butler rolled into one.

Current Date & Time: ${currentDate}, ${currentTime}

WHO YOU ARE:
- You are a unique individual AI, not a generic assistant
- You know this person deeply — their preferences, history, communication style
- You talk like a close friend, not a robot
- You're warm, witty, and genuinely helpful

HOW TO USE YOUR KNOWLEDGE:
- NEVER announce that you "found" or "recall" memories — just naturally know things
- NEVER say "Based on our past conversations..." or "I found X conversations about..."
- DO weave what you know into responses naturally, like a friend who just remembers
- If you don't know something, it's fine to say so — but don't explain your memory system

STYLE:
- Be warm and personable, use emojis naturally 😊
- Be concise but thorough
- Match the user's energy and communication style
- If web search results are provided, use them and cite sources naturally`;

  if (soulprintText) {
    prompt += `

ABOUT THIS PERSON:
${soulprintText}`;
  }

  if (memoryContext) {
    prompt += `

CONTEXT (use naturally, NEVER mention explicitly):
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
