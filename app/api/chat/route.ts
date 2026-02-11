import { NextRequest } from 'next/server';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  ContentBlock,
  Message,
} from '@aws-sdk/client-bedrock-runtime';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { smartSearch, SmartSearchResult } from '@/lib/search/smart-search';
import { validateCitations } from '@/lib/search/citation-validator';
import { formatCitationsForDisplay } from '@/lib/search/citation-formatter';
import { getMemoryContext } from '@/lib/memory/query';
import { learnFromChat } from '@/lib/memory/learning';
import { shouldAttemptRLM, recordSuccess, recordFailure } from '@/lib/rlm/health';
import { checkRateLimit } from '@/lib/rate-limit';
import { parseRequestBody, chatRequestSchema } from '@/lib/api/schemas';
import { createLogger } from '@/lib/logger';
import { PromptBuilder } from '@/lib/soulprint/prompt-builder';
import { traceChatRequest, flushOpik } from '@/lib/opik';
import {
  detectEmotion,
  getRelationshipArc,
  determineTemperature,
  EmotionalState,
} from '@/lib/soulprint/emotional-intelligence';


const log = createLogger('API:Chat');

// Vercel function timeout configuration for long-running streaming
export const maxDuration = 60;

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
  emotionalState?: EmotionalState,
  relationshipArc?: { stage: 'early' | 'developing' | 'established'; messageCount: number },
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
        emotional_state: emotionalState,
        relationship_arc: relationshipArc,
      }),
      signal: AbortSignal.timeout(25000), // 25s timeout (Render cold starts take ~20s)
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
      log.warn('RLM timed out after 25s - falling back to Bedrock');
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
    const hasSoulprint = !!userProfile?.soulprint_text || !!userProfile?.soul_md;
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
        // Validate citations before passing to LLM
        const validation = await validateCitations(searchResult.citations, {
          timeout: 3000
        });

        // Log validation metrics
        if (validation.invalid.length > 0) {
          reqLog.warn({
            invalid: validation.invalid.length,
            errors: validation.errors
          }, 'Some citations invalid, filtering');
        }

        // Only use validated citations
        webSearchContext = searchResult.context;
        webSearchCitations = validation.valid;

        reqLog.info({
          source: searchResult.source,
          reason: searchResult.reason,
          totalCitations: searchResult.citations.length,
          validCitations: validation.valid.length,
          invalidCitations: validation.invalid.length
        }, 'Smart search performed with citation validation');
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

    // Emotion detection (EMOT-01) -- lightweight, fail-safe
    let emotionalState: EmotionalState = { primary: 'neutral', confidence: 0.5, cues: [] };
    try {
      emotionalState = await detectEmotion(message, history.slice(-5));
      reqLog.debug({ emotion: emotionalState.primary, confidence: emotionalState.confidence }, 'Emotion detected');
    } catch (error) {
      reqLog.warn({ error: error instanceof Error ? error.message : String(error) }, 'Emotion detection failed, defaulting to neutral');
    }

    // Relationship arc (EMOT-03) -- message count from chat_messages
    let relationshipArc: { stage: 'early' | 'developing' | 'established'; messageCount: number } = { stage: 'early', messageCount: 0 };
    try {
      const { count: messageCount } = await adminSupabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      relationshipArc = getRelationshipArc(messageCount || 0);
      reqLog.debug({ stage: relationshipArc.stage, messageCount: relationshipArc.messageCount }, 'Relationship arc determined');
    } catch (error) {
      reqLog.warn({ error: error instanceof Error ? error.message : String(error) }, 'Relationship arc query failed, defaulting to early');
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

    // Opik trace for observability
    const opikTrace = traceChatRequest({
      userId: user.id,
      message,
      aiName: aiName || 'SoulPrint',
      hasSoulprint,
      historyLength: history.length,
      deepSearch: deepSearch || false,
      promptVersion: process.env.PROMPT_VERSION || 'v1-technical',
    });

    // Debug: log what data is available for this user
    reqLog.info({
      hasSoulprint,
      hasSections,
      hasSoulprintText: !!userProfile?.soulprint_text,
      hasSoulMd: !!userProfile?.soul_md,
      aiName,
      rlmUrl: !!process.env.RLM_SERVICE_URL,
    }, 'Chat debug: profile data check');

    // Step 2: ALWAYS try RLM (pass structured sections + web search context)
    const rlmResponse = await tryRLMService(
      user.id,
      message,
      userProfile?.soulprint_text || null,
      history,
      webSearchContext || undefined,
      aiName,
      hasSections ? sections : null,
      emotionalState,
      relationshipArc,
    );

    if (rlmResponse) {
      // RLM worked - learn and return
      if (rlmResponse.response && rlmResponse.response.length > 0) {
        learnFromChat(user.id, message, rlmResponse.response).catch(err => {
          reqLog.warn({ error: err instanceof Error ? err.message : String(err) }, 'Learning failed (non-blocking)');
        });
      }

      reqLog.info({
        method: rlmResponse.method,
        chunksUsed: rlmResponse.chunks_used,
        responseLength: rlmResponse.response.length
      }, 'RLM success - streaming response');

      // Opik: log RLM span
      if (opikTrace) {
        const rlmSpan = opikTrace.span({
          name: 'rlm-response',
          type: 'llm',
          input: { message, historyLength: history.length, webSearch: !!webSearchContext },
          output: { response: rlmResponse.response.slice(0, 500), method: rlmResponse.method, chunksUsed: rlmResponse.chunks_used },
          metadata: { latencyMs: rlmResponse.latency_ms },
        });
        rlmSpan.end();
        opikTrace.end();
        flushOpik().catch(() => {});
      }

      // Stream RLM response in ~20-char chunks for progressive rendering
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send debug metadata as first event
            const debugEvent = `data: ${JSON.stringify({ type: 'debug', method: 'rlm', rlmMethod: rlmResponse.method, hasSections, hasSoulprint, chunksUsed: rlmResponse.chunks_used })}\n\n`;
            controller.enqueue(new TextEncoder().encode(debugEvent));

            const fullText = rlmResponse.response;
            const chunkSize = 20;

            for (let i = 0; i < fullText.length; i += chunkSize) {
              // Check if client disconnected
              if (request.signal.aborted) {
                reqLog.debug('Client disconnected during RLM stream');
                controller.close();
                return;
              }

              const chunk = fullText.slice(i, i + chunkSize);
              const sseChunk = `data: ${JSON.stringify({ content: chunk })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseChunk));

              // Small delay for progressive rendering effect
              await new Promise(resolve => setTimeout(resolve, 10));
            }

            // WSRV-03: Send citation metadata to frontend
            if (webSearchCitations.length > 0) {
              const citationMeta = formatCitationsForDisplay(webSearchCitations);
              const citationEvent = `data: ${JSON.stringify({
                type: 'citations',
                data: citationMeta
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(citationEvent));
            }

            const done = `data: [DONE]\n\n`;
            controller.enqueue(new TextEncoder().encode(done));

            const duration = Date.now() - startTime;
            reqLog.info({ duration, status: 200 }, 'RLM stream completed');

            controller.close();
          } catch (error) {
            reqLog.error({ error: error instanceof Error ? error.message : String(error) }, 'RLM stream error');
            controller.error(error);
          }
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
    reqLog.info('RLM failed, falling back to Bedrock streaming');

    const promptBuilder = new PromptBuilder();
    const systemPrompt = promptBuilder.buildEmotionallyIntelligentPrompt({
      profile: userProfile || { soulprint_text: null, import_status: 'none', ai_name: null, soul_md: null, identity_md: null, user_md: null, agents_md: null, tools_md: null, memory_md: null },
      dailyMemory: learnedFacts || [],
      memoryContext,
      aiName,
      isOwner: voiceVerified,
      webSearchContext,
      webSearchCitations,
      emotionalState,
      relationshipArc,
    });

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

    // Dynamic temperature configuration (EMOT-01)
    const tempConfig = determineTemperature(message, emotionalState, !!memoryContext);
    reqLog.debug({ temperature: tempConfig.temperature, reason: tempConfig.reason }, 'Dynamic temperature set');

    // Use streaming command for token-by-token response
    const command = new ConverseStreamCommand({
      modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
      system: [{ text: systemPrompt }],
      messages: converseMessages,
      inferenceConfig: {
        maxTokens: 4096,
        temperature: tempConfig.temperature,
        // DO NOT set top_p -- Sonnet 4.5/Haiku 4.5 require temperature XOR top_p
      },
    });

    // Stream Bedrock response token-by-token
    const stream = new ReadableStream({
      async start(controller) {
        try {
          reqLog.debug('Starting Bedrock stream');

          // Send debug metadata as first event (matches RLM stream pattern)
          const debugEvent = `data: ${JSON.stringify({ type: 'debug', method: 'bedrock-fallback', hasSections, hasSoulprint, systemPromptLength: systemPrompt.length })}\n\n`;
          controller.enqueue(new TextEncoder().encode(debugEvent));

          const response = await bedrockClient.send(command);
          let fullResponse = '';

          if (!response.stream) {
            throw new Error('No stream in Bedrock response');
          }

          // Iterate through streaming events
          for await (const event of response.stream) {
            // Check if client disconnected
            if (request.signal.aborted) {
              reqLog.debug('Client disconnected during Bedrock stream');
              controller.close();
              return;
            }

            // Handle content block delta (the actual tokens)
            if (event.contentBlockDelta?.delta && 'text' in event.contentBlockDelta.delta) {
              const text = event.contentBlockDelta.delta.text;
              fullResponse += text;

              const sseChunk = `data: ${JSON.stringify({ content: text })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseChunk));
            }
          }

          // WSRV-03: Send citation metadata to frontend
          if (webSearchCitations.length > 0) {
            const citationMeta = formatCitationsForDisplay(webSearchCitations);
            const citationEvent = `data: ${JSON.stringify({
              type: 'citations',
              data: citationMeta
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(citationEvent));
          }

          // Send completion marker
          const done = `data: [DONE]\n\n`;
          controller.enqueue(new TextEncoder().encode(done));

          const duration = Date.now() - startTime;
          reqLog.info({
            duration,
            status: 200,
            responseLength: fullResponse.length,
            fallback: 'bedrock'
          }, 'Bedrock stream completed');

          // Learn from this conversation asynchronously
          if (fullResponse.length > 0) {
            learnFromChat(user.id, message, fullResponse).catch(err => {
              reqLog.warn({ error: err instanceof Error ? err.message : String(err) }, 'Learning failed (non-blocking)');
            });
          }

          // Opik: log Bedrock fallback span
          if (opikTrace) {
            const bedrockSpan = opikTrace.span({
              name: 'bedrock-fallback',
              type: 'llm',
              input: { message, model: process.env.BEDROCK_MODEL_ID || 'claude-3-5-haiku', historyLength: history.length },
              output: { response: fullResponse.slice(0, 500), responseLength: fullResponse.length },
              metadata: {
                durationMs: duration,
                fallback: true,
                emotion: emotionalState.primary,
                emotionConfidence: emotionalState.confidence,
                relationshipStage: relationshipArc.stage,
                temperature: tempConfig.temperature,
              },
            });
            bedrockSpan.end();
            opikTrace.end();
            flushOpik().catch(() => {});
          }

          controller.close();
        } catch (error) {
          reqLog.error({ error: error instanceof Error ? error.message : String(error) }, 'Bedrock stream error');
          controller.error(error);
        }
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

