/**
 * Fine-Tuning Data Collector
 * Collects and formats conversation data for future model fine-tuning
 */

import { createClient } from '@supabase/supabase-js';
import { BigFiveProfile } from '../personality/big-five-detector';
import { EmotionState } from '../personality/emotion-detector';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface TrainingExample {
  id?: string;
  user_id: string;
  session_id: string;
  timestamp: string;

  // Input context
  soulprint_summary: string;
  memories_used: string[];
  detected_personality: BigFiveProfile;
  detected_emotion: EmotionState;
  relationship_stage: string;

  // Conversation
  system_prompt: string;
  user_message: string;
  assistant_response: string;

  // Quality signals (updated later)
  user_continued?: boolean;        // Did user send another message?
  session_duration?: number;       // How long was the session?
  sentiment_shift?: number;        // Did user mood improve?
  explicit_feedback?: number;      // User rating if available (-1, 0, 1)

  // Metadata
  model_used: string;
  response_time_ms: number;
}

export interface ExportOptions {
  format: 'sharegpt' | 'alpaca' | 'openai' | 'raw';
  minQuality?: number;           // Minimum quality score (0-100)
  includeSystemPrompt?: boolean;
  maxExamples?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Log a training example to the database
 */
export async function logTrainingExample(example: TrainingExample): Promise<string | null> {
  // Only log if feature is enabled
  if (process.env.ENABLE_FINETUNING_LOGGING !== 'true') {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('finetuning_data')
      .insert({
        user_id: example.user_id,
        session_id: example.session_id,
        timestamp: example.timestamp,
        soulprint_summary: example.soulprint_summary,
        memories_used: example.memories_used,
        detected_personality: example.detected_personality,
        detected_emotion: example.detected_emotion,
        relationship_stage: example.relationship_stage,
        system_prompt: example.system_prompt,
        user_message: example.user_message,
        assistant_response: example.assistant_response,
        model_used: example.model_used,
        response_time_ms: example.response_time_ms,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log training example:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error logging training example:', error);
    return null;
  }
}

/**
 * Update quality signals for a training example
 */
export async function updateQualitySignals(
  exampleId: string,
  signals: {
    user_continued?: boolean;
    session_duration?: number;
    sentiment_shift?: number;
    explicit_feedback?: number;
  }
): Promise<void> {
  if (!exampleId) return;

  try {
    await supabase
      .from('finetuning_data')
      .update(signals)
      .eq('id', exampleId);
  } catch (error) {
    console.error('Error updating quality signals:', error);
  }
}

/**
 * Calculate quality score for a training example
 */
export function calculateQualityScore(example: TrainingExample): number {
  let score = 50; // Base score

  // Positive signals
  if (example.user_continued) score += 20;
  if (example.sentiment_shift && example.sentiment_shift > 0) score += 15;
  if (example.explicit_feedback === 1) score += 30;
  if (example.session_duration && example.session_duration > 300) score += 10; // 5+ min session

  // Negative signals
  if (example.explicit_feedback === -1) score -= 40;
  if (example.sentiment_shift && example.sentiment_shift < -20) score -= 15;
  if (!example.user_continued) score -= 10;

  // Response quality signals
  if (example.assistant_response.length < 50) score -= 10; // Too short
  if (example.assistant_response.length > 2000) score -= 5;  // Maybe too long

  // Personality confidence bonus
  if (example.detected_personality.confidence > 50) score += 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Export training data in various formats
 */
export async function exportTrainingData(options: ExportOptions): Promise<string> {
  const {
    format,
    minQuality = 0,
    includeSystemPrompt = true,
    maxExamples,
    startDate,
    endDate,
  } = options;

  // Build query
  let query = supabase
    .from('finetuning_data')
    .select('*')
    .order('timestamp', { ascending: true });

  if (startDate) {
    query = query.gte('timestamp', startDate);
  }
  if (endDate) {
    query = query.lte('timestamp', endDate);
  }
  if (maxExamples) {
    query = query.limit(maxExamples);
  }

  const { data, error } = await query;

  if (error || !data) {
    throw new Error(`Failed to fetch training data: ${error?.message}`);
  }

  // Filter by quality
  const filteredData = data.filter(example => {
    const score = calculateQualityScore(example as TrainingExample);
    return score >= minQuality;
  });

  // Format based on requested format
  switch (format) {
    case 'sharegpt':
      return formatShareGPT(filteredData, includeSystemPrompt);
    case 'alpaca':
      return formatAlpaca(filteredData, includeSystemPrompt);
    case 'openai':
      return formatOpenAI(filteredData, includeSystemPrompt);
    case 'raw':
    default:
      return JSON.stringify(filteredData, null, 2);
  }
}

/**
 * Format for ShareGPT/FastChat style training
 */
function formatShareGPT(data: TrainingExample[], includeSystemPrompt: boolean): string {
  const formatted = data.map(example => ({
    conversations: [
      ...(includeSystemPrompt ? [{
        from: 'system',
        value: example.system_prompt,
      }] : []),
      {
        from: 'human',
        value: example.user_message,
      },
      {
        from: 'gpt',
        value: example.assistant_response,
      },
    ],
  }));

  return formatted.map(f => JSON.stringify(f)).join('\n');
}

/**
 * Format for Alpaca style training
 */
function formatAlpaca(data: TrainingExample[], includeSystemPrompt: boolean): string {
  const formatted = data.map(example => ({
    instruction: includeSystemPrompt
      ? `${example.system_prompt}\n\nUser: ${example.user_message}`
      : example.user_message,
    input: '',
    output: example.assistant_response,
  }));

  return JSON.stringify(formatted, null, 2);
}

/**
 * Format for OpenAI fine-tuning API
 */
function formatOpenAI(data: TrainingExample[], includeSystemPrompt: boolean): string {
  const formatted = data.map(example => ({
    messages: [
      ...(includeSystemPrompt ? [{
        role: 'system',
        content: example.system_prompt,
      }] : []),
      {
        role: 'user',
        content: example.user_message,
      },
      {
        role: 'assistant',
        content: example.assistant_response,
      },
    ],
  }));

  return formatted.map(f => JSON.stringify(f)).join('\n');
}

/**
 * Get training data statistics
 */
export async function getTrainingStats(): Promise<{
  totalExamples: number;
  highQualityExamples: number;
  uniqueUsers: number;
  avgQualityScore: number;
  dateRange: { start: string; end: string } | null;
}> {
  const { data, error } = await supabase
    .from('finetuning_data')
    .select('*');

  if (error || !data) {
    return {
      totalExamples: 0,
      highQualityExamples: 0,
      uniqueUsers: 0,
      avgQualityScore: 0,
      dateRange: null,
    };
  }

  const qualityScores = data.map(d => calculateQualityScore(d as TrainingExample));
  const highQuality = qualityScores.filter(s => s >= 70).length;
  const avgScore = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;

  const uniqueUsers = new Set(data.map(d => d.user_id)).size;

  const timestamps = data.map(d => d.timestamp).sort();

  return {
    totalExamples: data.length,
    highQualityExamples: highQuality,
    uniqueUsers,
    avgQualityScore: Math.round(avgScore),
    dateRange: timestamps.length > 0
      ? { start: timestamps[0], end: timestamps[timestamps.length - 1] }
      : null,
  };
}
