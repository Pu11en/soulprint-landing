/**
 * Compete Stack Orchestrator
 * Main entry point for the production-grade AI companion system
 *
 * Orchestrates:
 * - Memory retrieval (mem0)
 * - Personality detection
 * - Emotion analysis
 * - Dynamic prompt building
 * - LLM inference (AWS vLLM)
 * - Fine-tuning data collection
 */

import { createClient } from '@supabase/supabase-js';
import {
  chatCompletion as awsChatCompletion,
  streamChatCompletion as awsStreamChatCompletion,
  checkHealth as checkAwsHealth,
  ChatMessage,
} from '../aws/vllm-client';
import {
  addMemory,
  searchMemories,
  getAllMemories,
  getUserMemoryProfile,
  processConversation,
} from '../mem0/client';
import { analyzeText, BigFiveProfile } from '../personality/big-five-detector';
import { detectEmotion, EmotionState } from '../personality/emotion-detector';
import { buildCompanionPrompt, PromptContext, SoulPrintData } from '../prompt/dynamic-builder';
import { logTrainingExample, updateQualitySignals, TrainingExample } from '../finetuning/collector';

// Fallback imports
import { chatWithFileSearch } from '../gemini';
import { generateContent } from '../openai/client';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface CompeteResponse {
  content: string;
  model: string;
  memories_used: string[];
  detected_emotion: EmotionState;
  detected_personality: BigFiveProfile;
  training_example_id?: string;
}

export interface ChatContext {
  userId: string;
  sessionId: string;
  messages: ChatMessage[];
  soulprint?: SoulPrintData;
}

/**
 * Main chat completion with full compete stack
 */
export async function competeChatCompletion(context: ChatContext): Promise<CompeteResponse> {
  const startTime = Date.now();
  const { userId, sessionId, messages, soulprint } = context;

  // 1. Get the user's last message
  const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

  // 2. Analyze the user's emotional state
  const detectedEmotion = detectEmotion(userMessage);

  // 3. Get user's personality profile from past conversations
  const userHistory = await getUserChatHistory(userId, 20);
  const detectedPersonality = analyzeText(userHistory.join(' '));

  // 4. Get relevant memories
  const relevantMemories = await searchMemories(userId, userMessage, 10);
  const allMemories = relevantMemories.length > 0
    ? relevantMemories
    : await getAllMemories(userId);

  // 5. Get relationship stats
  const memoryProfile = await getUserMemoryProfile(userId);

  // 6. Build the dynamic system prompt
  const promptContext: PromptContext = {
    soulprint: soulprint || null,
    memories: allMemories.slice(0, 15),
    detectedPersonality,
    currentEmotion: detectedEmotion,
    relationshipStage: memoryProfile.relationship.relationship_stage,
    conversationCount: memoryProfile.relationship.conversations,
    userName: soulprint?.name,
  };

  const systemPrompt = buildCompanionPrompt(promptContext);

  // 7. Build messages with system prompt
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system'),
  ];

  // 8. Call LLM (with fallback chain)
  let response: string;
  let modelUsed: string;

  try {
    // Try AWS vLLM first
    const isAwsHealthy = await checkAwsHealth();
    if (isAwsHealthy && process.env.ENABLE_COMPETE_STACK === 'true') {
      response = await awsChatCompletion(fullMessages, {
        temperature: 0.8,
        max_tokens: 2048,
      });
      modelUsed = process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    } else {
      throw new Error('AWS vLLM not available');
    }
  } catch (awsError) {
    console.warn('AWS vLLM failed, falling back:', awsError);

    try {
      // Fallback to Gemini
      const geminiResponse = await chatWithFileSearch(
        messages.map(m => ({ role: m.role, content: m.content })),
        [],
        systemPrompt
      );
      response = geminiResponse.text;
      modelUsed = 'gemini-2.5-flash';
    } catch (geminiError) {
      console.warn('Gemini failed, falling back to OpenAI:', geminiError);

      // Final fallback to OpenAI
      response = await generateContent(fullMessages, { temperature: 0.8 }) || '';
      modelUsed = 'gpt-4o';
    }
  }

  const responseTime = Date.now() - startTime;

  // 9. Process conversation for memory extraction
  await processConversation(userId, userMessage, response);

  // 10. Log for fine-tuning
  let trainingExampleId: string | undefined;
  if (process.env.ENABLE_FINETUNING_LOGGING === 'true') {
    const example: TrainingExample = {
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      soulprint_summary: soulprint ? JSON.stringify(soulprint).slice(0, 500) : '',
      memories_used: allMemories.slice(0, 10),
      detected_personality: detectedPersonality,
      detected_emotion: detectedEmotion,
      relationship_stage: memoryProfile.relationship.relationship_stage,
      system_prompt: systemPrompt,
      user_message: userMessage,
      assistant_response: response,
      model_used: modelUsed,
      response_time_ms: responseTime,
    };

    trainingExampleId = await logTrainingExample(example) || undefined;
  }

  return {
    content: response,
    model: modelUsed,
    memories_used: allMemories.slice(0, 10),
    detected_emotion: detectedEmotion,
    detected_personality: detectedPersonality,
    training_example_id: trainingExampleId,
  };
}

/**
 * Streaming chat completion with compete stack
 */
export async function* competeStreamChatCompletion(
  context: ChatContext
): AsyncGenerator<string, CompeteResponse, unknown> {
  const startTime = Date.now();
  const { userId, sessionId, messages, soulprint } = context;

  // 1. Get the user's last message
  const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

  // 2. Quick analysis (don't block streaming)
  const detectedEmotion = detectEmotion(userMessage);

  // 3. Get memories in parallel with personality
  const [relevantMemories, userHistory] = await Promise.all([
    searchMemories(userId, userMessage, 10),
    getUserChatHistory(userId, 10),
  ]);

  const detectedPersonality = analyzeText(userHistory.join(' '));
  const allMemories = relevantMemories.length > 0
    ? relevantMemories
    : await getAllMemories(userId);

  // 4. Get relationship stats
  const memoryProfile = await getUserMemoryProfile(userId);

  // 5. Build system prompt
  const promptContext: PromptContext = {
    soulprint: soulprint || null,
    memories: allMemories.slice(0, 15),
    detectedPersonality,
    currentEmotion: detectedEmotion,
    relationshipStage: memoryProfile.relationship.relationship_stage,
    conversationCount: memoryProfile.relationship.conversations,
    userName: soulprint?.name,
  };

  const systemPrompt = buildCompanionPrompt(promptContext);

  // 6. Build messages
  const fullMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system'),
  ];

  // 7. Stream from LLM
  let fullResponse = '';
  let modelUsed = process.env.AWS_LLM_MODEL || 'Qwen/Qwen2.5-72B-Instruct';

  try {
    const isAwsHealthy = await checkAwsHealth();
    if (isAwsHealthy && process.env.ENABLE_COMPETE_STACK === 'true') {
      for await (const chunk of awsStreamChatCompletion(fullMessages, {
        temperature: 0.8,
        max_tokens: 2048,
      })) {
        fullResponse += chunk;
        yield chunk;
      }
    } else {
      throw new Error('AWS vLLM not available');
    }
  } catch (error) {
    console.warn('AWS streaming failed, using non-streaming fallback');
    modelUsed = 'gemini-2.5-flash';

    // Non-streaming fallback
    const geminiResponse = await chatWithFileSearch(
      messages.map(m => ({ role: m.role, content: m.content })),
      [],
      systemPrompt
    );
    fullResponse = geminiResponse.text;
    yield fullResponse;
  }

  const responseTime = Date.now() - startTime;

  // 8. Post-stream processing
  await processConversation(userId, userMessage, fullResponse);

  // 9. Log for fine-tuning
  let trainingExampleId: string | undefined;
  if (process.env.ENABLE_FINETUNING_LOGGING === 'true') {
    const example: TrainingExample = {
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      soulprint_summary: soulprint ? JSON.stringify(soulprint).slice(0, 500) : '',
      memories_used: allMemories.slice(0, 10),
      detected_personality: detectedPersonality,
      detected_emotion: detectedEmotion,
      relationship_stage: memoryProfile.relationship.relationship_stage,
      system_prompt: systemPrompt,
      user_message: userMessage,
      assistant_response: fullResponse,
      model_used: modelUsed,
      response_time_ms: responseTime,
    };

    trainingExampleId = await logTrainingExample(example) || undefined;
  }

  return {
    content: fullResponse,
    model: modelUsed,
    memories_used: allMemories.slice(0, 10),
    detected_emotion: detectedEmotion,
    detected_personality: detectedPersonality,
    training_example_id: trainingExampleId,
  };
}

/**
 * Get user's chat history for personality analysis
 */
async function getUserChatHistory(userId: string, limit: number): Promise<string[]> {
  const { data } = await supabase
    .from('chat_logs')
    .select('message')
    .eq('user_id', userId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(limit);

  return data?.map(d => d.message) || [];
}

/**
 * Mark that user continued the conversation (quality signal)
 */
export async function markUserContinued(trainingExampleId: string): Promise<void> {
  await updateQualitySignals(trainingExampleId, { user_continued: true });
}

/**
 * Update session duration for quality tracking
 */
export async function updateSessionDuration(
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  await supabase
    .from('finetuning_data')
    .update({ session_duration: durationSeconds })
    .eq('session_id', sessionId);
}

/**
 * Get system health status
 */
export async function getSystemHealth(): Promise<{
  aws_vllm: boolean;
  mem0: boolean;
  supabase: boolean;
  overall: 'healthy' | 'degraded' | 'down';
}> {
  const [awsHealth, supabaseHealth] = await Promise.all([
    checkAwsHealth().catch(() => false),
    supabase.from('profiles').select('id').limit(1).then(() => true).catch(() => false),
  ]);

  // mem0 health check
  let mem0Health = true;
  if (process.env.MEM0_API_KEY) {
    try {
      await fetch(`${process.env.MEM0_SELF_HOSTED_URL || 'https://api.mem0.ai/v1'}/health`);
    } catch {
      mem0Health = false;
    }
  }

  const healthyCount = [awsHealth, mem0Health, supabaseHealth].filter(Boolean).length;

  return {
    aws_vllm: awsHealth,
    mem0: mem0Health,
    supabase: supabaseHealth,
    overall: healthyCount === 3 ? 'healthy' : healthyCount >= 1 ? 'degraded' : 'down',
  };
}
