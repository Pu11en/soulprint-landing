/**
 * Compete Stack Chat API v2
 * Production-grade AI companion endpoint
 *
 * Features:
 * - AWS vLLM (Qwen 2.5 72B) inference
 * - mem0 memory system
 * - Big Five personality detection
 * - Emotion recognition
 * - Dynamic prompt building
 * - Fine-tuning data collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'crypto';
import {
  competeChatCompletion,
  competeStreamChatCompletion,
  markUserContinued,
  ChatContext,
} from '@/lib/compete/orchestrator';
import type { SoulPrintData } from '@/lib/prompt/dynamic-builder';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  stream?: boolean;
  session_id?: string;
  previous_example_id?: string; // For marking continuation
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer sk-soulprint-')) {
      return NextResponse.json(
        { error: 'Missing or invalid API key' },
        { status: 401 }
      );
    }

    const rawKey = authHeader.replace('Bearer ', '');
    let userId: string;

    // Demo key check
    if (rawKey === 'sk-soulprint-demo-fallback-123456') {
      userId = '4316c8f3-a383-4260-8cbc-daadea2ad142';
      console.log('🎭 Demo mode activated');
    } else {
      const hashedKey = createHash('sha256').update(rawKey).digest('hex');
      const { data: keyData, error: keyError } = await supabaseAdmin
        .from('api_keys')
        .select('user_id')
        .eq('key_hash', hashedKey)
        .single();

      if (keyError || !keyData) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      userId = keyData.user_id;
    }

    console.log('✅ Authenticated user:', userId);

    // 2. Parse request
    const body: RequestBody = await request.json();
    const { messages, stream = false, session_id, previous_example_id } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      );
    }

    // 3. Mark previous example as continued (quality signal for fine-tuning)
    if (previous_example_id) {
      await markUserContinued(previous_example_id);
    }

    // 4. Get user's SoulPrint
    const { data: soulprintData } = await supabaseAdmin
      .from('soulprints')
      .select('soulprint_data, name')
      .eq('user_id', userId)
      .single();

    let soulprint: SoulPrintData | undefined;
    if (soulprintData?.soulprint_data) {
      const spData = typeof soulprintData.soulprint_data === 'string'
        ? JSON.parse(soulprintData.soulprint_data)
        : soulprintData.soulprint_data;

      soulprint = {
        name: soulprintData.name || spData.name,
        pillars: spData.pillars,
        core_values: spData.core_values,
        communication_preferences: spData.communication_preferences,
        full_system_prompt: spData.full_system_prompt,
      };
    }

    // 5. Build context
    const context: ChatContext = {
      userId,
      sessionId: session_id || randomUUID(),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      soulprint,
    };

    // 6. Handle streaming vs non-streaming
    if (stream) {
      return handleStreamingResponse(context);
    } else {
      return handleNonStreamingResponse(context, startTime);
    }

  } catch (error) {
    console.error('Compete chat error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Handle non-streaming response
 */
async function handleNonStreamingResponse(
  context: ChatContext,
  startTime: number
): Promise<NextResponse> {
  const result = await competeChatCompletion(context);

  return NextResponse.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0, // Would need tokenizer
      completion_tokens: 0,
      total_tokens: 0,
    },
    // SoulPrint-specific metadata
    soulprint_meta: {
      memories_used: result.memories_used.length,
      detected_emotion: result.detected_emotion.primary,
      emotion_intensity: result.detected_emotion.intensity,
      personality_confidence: result.detected_personality.confidence,
      training_example_id: result.training_example_id,
      response_time_ms: Date.now() - startTime,
    },
  });
}

/**
 * Handle streaming response
 */
async function handleStreamingResponse(context: ChatContext): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = competeStreamChatCompletion(context);
        let result;

        while (true) {
          const { value, done } = await generator.next();

          if (done) {
            result = value;
            break;
          }

          // Send SSE chunk
          const chunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct',
            choices: [
              {
                index: 0,
                delta: {
                  content: value,
                },
                finish_reason: null,
              },
            ],
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }

        // Send final chunk with metadata
        const finalChunk = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: result?.model || 'unknown',
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
          soulprint_meta: result ? {
            memories_used: result.memories_used.length,
            detected_emotion: result.detected_emotion.primary,
            training_example_id: result.training_example_id,
          } : undefined,
        };

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Health check endpoint
 */
export async function GET() {
  const { getSystemHealth } = await import('@/lib/compete/orchestrator');
  const health = await getSystemHealth();

  return NextResponse.json({
    status: health.overall,
    components: {
      aws_vllm: health.aws_vllm ? 'up' : 'down',
      mem0: health.mem0 ? 'up' : 'down',
      supabase: health.supabase ? 'up' : 'down',
    },
    timestamp: new Date().toISOString(),
  });
}
