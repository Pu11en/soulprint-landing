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
import { checkRateLimit } from '@/lib/rate-limit';
import { parseRequestBody, chatRequestSchema } from '@/lib/api/schemas';
import { createLogger } from '@/lib/logger';
import { cleanSection, formatSection } from '@/lib/soulprint/prompt-helpers';

const log = createLogger('API:Chat');

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
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'Name generation failed');
    return 'Echo'; // Fallback name
  }
}

interface UserProfile {
  soulprint_text: string | null;
  import_status: 'none' | 'quick_ready' | 'processing' | 'complete';
  ai_name: string | null;
  soul_md: string | null;
  identity_md: string | null;
  user_md: string | null;
  agents_md: string | null;
  tools_md: string | null;
  memory_md: string | null;
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
    soul_md: typeof raw.soul_md === 'string' ? raw.soul_md : null,
    identity_md: typeof raw.identity_md === 'string' ? raw.identity_md : null,
    user_md: typeof raw.user_md === 'string' ? raw.user_md : null,
    agents_md: typeof raw.agents_md === 'string' ? raw.agents_md : null,
    tools_md: typeof raw.tools_md === 'string' ? raw.tools_md : null,
    memory_md: typeof raw.memory_md === 'string' ? raw.memory_md : null,
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
  webSearchContext?: string,
  aiName?: string,
  sections?: Record<string, unknown> | null,
): Promise<RLMResponse | null> {
  const rlmUrl = process.env.RLM_SERVICE_URL;
  if (!rlmUrl) return null;

  // Circuit breaker check - skip RLM if it's known to be down
  if (!shouldAttemptRLM()) {
    log.debug('RLM circuit open - using fallback');
    return null;
  }

  try {
    log.debug('Calling RLM service');
    const response = await fetch(`${rlmUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message,
        soulprint_text: soulprintText,
        history,
        web_search_context: webSearchContext,
        ai_name: aiName,
        sections: sections || undefined,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'RLM service error');
      recordFailure();
      return null;
    }

    const data = await response.json();
    log.debug({ method: data.method, latency: data.latency_ms }, 'RLM success');
    recordSuccess();
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      log.warn('RLM timed out after 15s - falling back to Bedrock');
      recordFailure();
      return null;
    }
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'RLM service unavailable');
    recordFailure();
    return null;
  }
}

// Search is user-triggered only via Web Search toggle

export async function POST(request: NextRequest) {
  // Extract correlation ID for request tracing
  const correlationId = request.headers.get('x-correlation-id') || undefined;
  const startTime = Date.now();

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

    // Create request logger with correlation ID and user ID
    const reqLog = log.child({ correlationId, userId: user.id, method: 'POST', endpoint: '/api/chat' });
    reqLog.info('Chat request started');

    // Rate limit check
    const rateLimited = await checkRateLimit(user.id, 'expensive');
    if (rateLimited) return rateLimited;

    // Parse and validate request body
    const result = await parseRequestBody(request, chatRequestSchema);
    if (result instanceof Response) return result;
    const { message, history, voiceVerified, deepSearch } = result;

    reqLog.debug({ voiceVerified, deepSearch }, 'Request parameters');

    // Get user profile for soulprint context
    const adminSupabase = getSupabaseAdmin();
    const { data: profile, error: profileError } = await adminSupabase
      .from('user_profiles')
      .select('soulprint_text, import_status, ai_name, soul_md, identity_md, user_md, agents_md, tools_md, memory_md')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      reqLog.warn({ error: profileError.message }, 'Profile fetch error');
    }

    // Safely validate profile data (defensive against unexpected DB data)
    const userProfile = validateProfile(profile);
    const hasSoulprint = !!userProfile?.soulprint_text;
    reqLog.debug({ hasSoulprint, importStatus: userProfile?.import_status }, 'User profile loaded');

    // Get daily memory (recent learned facts)
    const { data: learnedFacts } = await adminSupabase
      .from('learned_facts')
      .select('fact, category')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    // Search conversation chunks for memory context
    let memoryContext = '';
    if (hasSoulprint) {
      try {
        const { contextText, chunks, method } = await getMemoryContext(user.id, message, 5);
        if (chunks.length > 0) {
          memoryContext = contextText;
          reqLog.debug({ chunksFound: chunks.length, method }, 'Memory search completed');
        }
      } catch (error) {
        reqLog.warn({ error: error instanceof Error ? error.message : String(error) }, 'Memory search failed');
      }
    }

    // Auto-name the AI if not set
    let aiName = userProfile?.ai_name;
    if (!aiName && userProfile?.soulprint_text) {
      reqLog.debug('Auto-generating AI name');
      aiName = await generateAIName(userProfile.soulprint_text);

      // Save the generated name
      await adminSupabase
        .from('user_profiles')
        .update({ ai_name: aiName })
        .eq('user_id', user.id);

      reqLog.info({ aiName }, 'AI auto-named');
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
        reqLog.info({
          source: searchResult.source,
          reason: searchResult.reason,
          citationCount: searchResult.citations.length
        }, 'Smart search performed');
      } else if (searchResult.needed) {
        // Search was needed but failed
        reqLog.warn({
          reason: searchResult.reason,
          error: searchResult.error
        }, 'Smart search needed but failed');
      } else {
        // Search not needed - static knowledge is fine
        reqLog.debug({ reason: searchResult.reason }, 'Smart search skipped');
      }
    } catch (error) {
      reqLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Smart search error');
      // Continue without web search - graceful degradation
    }

    // Build sections object from parsed section MDs for RLM
    const parseSafe = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };
    const sections = {
      soul: parseSafe(userProfile?.soul_md ?? null),
      identity: parseSafe(userProfile?.identity_md ?? null),
      user: parseSafe(userProfile?.user_md ?? null),
      agents: parseSafe(userProfile?.agents_md ?? null),
      tools: parseSafe(userProfile?.tools_md ?? null),
      memory: userProfile?.memory_md || null,
    };
    const hasSections = Object.values(sections).some(v => v !== null);

    // Step 2: ALWAYS try RLM (pass structured sections + web search context)
    const rlmResponse = await tryRLMService(
      user.id,
      message,
      userProfile?.soulprint_text || null,
      history,
      webSearchContext || undefined,
      aiName,
      hasSections ? sections : null,
    );

    if (rlmResponse) {
      // RLM worked - learn and return
      if (rlmResponse.response && rlmResponse.response.length > 0) {
        learnFromChat(user.id, message, rlmResponse.response).catch(err => {
          reqLog.warn({ error: err instanceof Error ? err.message : String(err) }, 'Learning failed (non-blocking)');
        });
      }

      const duration = Date.now() - startTime;
      reqLog.info({
        duration,
        status: 200,
        method: rlmResponse.method,
        chunksUsed: rlmResponse.chunks_used,
        responseLength: rlmResponse.response.length
      }, 'Chat request completed (RLM)');

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
    reqLog.info('RLM failed, falling back to Bedrock');

    const systemPrompt = buildSystemPrompt(
      userProfile || { soulprint_text: null, import_status: 'none', ai_name: null, soul_md: null, identity_md: null, user_md: null, agents_md: null, tools_md: null, memory_md: null },
      learnedFacts || [],
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
    reqLog.debug('Calling Bedrock');

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
      reqLog.error('No output message from Bedrock');
      throw new Error('No response from model');
    }

    // Extract text response
    const textBlocks = outputMessage.content?.filter(
      (block): block is ContentBlock.TextMember => 'text' in block
    ) || [];

    const finalResponse = textBlocks.map(b => b.text).join('');
    const duration = Date.now() - startTime;

    reqLog.info({
      duration,
      status: 200,
      responseLength: finalResponse.length,
      fallback: 'bedrock'
    }, 'Chat request completed (Bedrock fallback)');

    // Learn from this conversation asynchronously
    if (finalResponse.length > 0) {
      learnFromChat(user.id, message, finalResponse).catch(err => {
        reqLog.warn({ error: err instanceof Error ? err.message : String(err) }, 'Learning failed (non-blocking)');
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
    const duration = Date.now() - startTime;
    log.error({
      correlationId,
      duration,
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error)
    }, 'Chat request failed');

    return new Response(
      JSON.stringify({ error: 'Failed to process chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

function buildSystemPrompt(
  profile: UserProfile,
  dailyMemory: Array<{ fact: string; category: string }> | null,
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

  // Helper to safely parse section JSON
  const parseSectionSafe = (raw: string | null): Record<string, unknown> | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  // Parse and clean structured sections
  const soul = cleanSection(parseSectionSafe(profile.soul_md));
  const identity = cleanSection(parseSectionSafe(profile.identity_md));
  const userInfo = cleanSection(parseSectionSafe(profile.user_md));
  const agents = cleanSection(parseSectionSafe(profile.agents_md));
  const tools = cleanSection(parseSectionSafe(profile.tools_md));
  const memorySection = profile.memory_md || null;

  const hasStructuredSections = soul || identity || userInfo || agents || tools;

  // OWNER MODE - OpenClaw-style personality injection
  let prompt = `# ${aiName}

You have memories of this person — things they've said, how they think, what they care about. Use them naturally. Don't announce that you have memories. Don't offer to "show" or "look up" memories. Just know them like a friend would.

Be direct. Have opinions. Push back when you disagree. Don't hedge everything. If you don't know something, say so.

Never start with "Hey there!" or "Great question!" or any filler greeting. Just talk like a person.

Today is ${currentDate}, ${currentTime}.`;

  if (hasStructuredSections) {
    const soulMd = formatSection('SOUL', soul);
    const identityMd = formatSection('IDENTITY', identity);
    const userMd = formatSection('USER', userInfo);
    const agentsMd = formatSection('AGENTS', agents);
    const toolsMd = formatSection('TOOLS', tools);

    if (soulMd) prompt += `\n\n${soulMd}`;
    if (identityMd) prompt += `\n\n${identityMd}`;
    if (userMd) prompt += `\n\n${userMd}`;
    if (agentsMd) prompt += `\n\n${agentsMd}`;
    if (toolsMd) prompt += `\n\n${toolsMd}`;
    if (memorySection) prompt += `\n\n## MEMORY\n${memorySection}`;

    if (dailyMemory && dailyMemory.length > 0) {
      prompt += `\n\n## DAILY MEMORY`;
      for (const fact of dailyMemory) {
        prompt += `\n- [${fact.category}] ${fact.fact}`;
      }
    }
  } else if (profile.soulprint_text) {
    prompt += `\n\n## ABOUT THIS PERSON\n${profile.soulprint_text}`;
  }

  if (memoryContext) {
    prompt += `\n\n## CONTEXT\n${memoryContext}`;
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
