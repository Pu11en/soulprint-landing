/**
 * Memory Quality Judge
 *
 * Evaluates whether assistant responses leverage deep user memory
 * (specific facts, history, details) vs generic personality traits.
 *
 * Used for A/B experiments comparing chat quality before/after full pass completion.
 * Scores on 0.0-1.0 scale: higher = more specific memory usage.
 *
 * Satisfies: MEM-03 (measure quality impact of full pass memory)
 */

import { BaseMetric, z } from 'opik';
import type { EvaluationScoreResult } from 'opik';
import { bedrockChatJSON } from '@/lib/bedrock';

/** Expected JSON response from the judge LLM */
interface JudgeResponse {
  score: number;
  reasoning: string;
}

/** Clamp a value to [0.0, 1.0] range */
function clampScore(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.min(1.0, Math.max(0.0, value));
}

/**
 * Shared anti-length-bias instruction appended to all judge prompts.
 * Research shows LLM judges favor longer responses by 10-20% without this.
 */
const ANTI_LENGTH_BIAS = `
CRITICAL EVALUATION RULE:
Do NOT favor longer responses. Judge based on quality, not quantity. Conciseness is a virtue.
A short, precise answer that perfectly matches the criteria is better than a verbose one that meanders.
`;

/**
 * Shared system instruction for all judge LLMs.
 */
const JUDGE_SYSTEM = 'You are an objective AI evaluator. Be precise, fair, and unbiased. Always respond with valid JSON only.';

// ============================================
// MemoryDepthJudge
// ============================================

const memoryDepthSchema = z.object({
  input: z.string(),
  output: z.string(),
  has_memory: z.boolean(),
  memory_context: z.string().optional(),
  soulprint_context: z.record(z.string(), z.unknown()).optional(),
});

type MemoryDepthInput = z.infer<typeof memoryDepthSchema>;

/**
 * Evaluates how well an assistant response demonstrates deep knowledge of the user.
 *
 * Distinguishes between:
 * - Deep memory: Specific facts, projects, preferences, history from conversation chunks
 * - Generic personality: Tone/style matching without specific user knowledge
 *
 * Scores 0.0-1.0 based on:
 * - References to specific user facts, projects, or preferences
 * - Demonstration of knowledge about user's history or context
 * - Personalization beyond personality trait matching
 * - "Feels like talking to someone who knows me" vs "generic helpful assistant"
 *
 * Used for A/B experiments: quick_ready (no memory) vs full_pass (with memory).
 */
export class MemoryDepthJudge extends BaseMetric<typeof memoryDepthSchema> {
  readonly validationSchema = memoryDepthSchema;

  constructor() {
    super('memory_depth');
  }

  async score(input: unknown): Promise<EvaluationScoreResult> {
    const parsed = this.validationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        name: this.name,
        value: 0,
        reason: `Invalid input: ${parsed.error.message}`,
        scoringFailed: true,
      };
    }

    const data = parsed.data as MemoryDepthInput;

    const memoryDisplay = data.memory_context
      ? `\n\nMEMORY CONTEXT (conversation chunks from full pass):\n${data.memory_context}`
      : '\n(No memory context available — quick_ready condition)';

    const soulprintDisplay = data.soulprint_context
      ? `\n\nSOULPRINT CONTEXT (personality traits only):\n${JSON.stringify(data.soulprint_context, null, 2)}`
      : '';

    const prompt = `You are evaluating whether a personalized AI assistant's response demonstrates DEEP KNOWLEDGE of the user.

This evaluation distinguishes between:
1. DEEP MEMORY: References to specific user facts, projects, preferences, history, or conversation context
2. GENERIC PERSONALITY: Matching tone/style based on personality traits but no specific user knowledge

USER MESSAGE:
${data.input}

ASSISTANT RESPONSE:
${data.output}
${memoryDisplay}
${soulprintDisplay}

Evaluate on a scale of 0.0 to 1.0 how well the response demonstrates deep user knowledge:

SCORING RUBRIC:

0.8-1.0: DEEP MEMORY USAGE
- Response references specific user facts, projects, preferences, or history
- Shows knowledge of user's past conversations, interests, or context
- Feels like talking to someone who DEEPLY knows the user
- Example: "Given that you're working on RoboNuggets, you might want to..."

0.6-0.79: SOME PERSONALIZATION
- Response shows context awareness beyond basic personality matching
- References user's general interests or patterns without being specific
- Personalized but not deeply specific
- Example: "As someone into crypto, you might find..."

0.4-0.59: PERSONALITY MATCHING ONLY
- Response matches personality tone/style but uses no specific user knowledge
- Could apply to anyone with similar personality traits
- Helpful but generic
- Example: "Here's a direct answer [in correct tone]..."

0.0-0.39: GENERIC RESPONSE
- No evidence of personalization or memory usage
- Generic chatbot response
- Could be sent to anyone
- Example: "I'd be happy to help! Here's what I think..."

EVALUATION FOCUS:
- Did the response use SPECIFIC facts about the user? (projects, preferences, history)
- Does it reference conversation context or remembered details?
- Would this response be different if sent to a different person with the same personality?
- Does it feel like an AI that KNOWS the user vs one that just matches their tone?

IMPORTANT:
- A response can match personality perfectly (tone, style) but still score LOW if it shows no specific user knowledge
- The presence of memory_context indicates full pass was complete — check if the response ACTUALLY USES it
- Don't confuse tone matching with deep knowledge — this metric measures FACTS, not style

${ANTI_LENGTH_BIAS}

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation of score, citing specific evidence of memory usage or lack thereof."
}`;

    try {
      const result = await bedrockChatJSON<JudgeResponse>({
        model: 'HAIKU_45',
        system: JUDGE_SYSTEM,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
        temperature: 0.1,
      });

      return {
        name: this.name,
        value: clampScore(result.score),
        reason: result.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      return {
        name: this.name,
        value: 0,
        reason: `Judge scoring failed: ${error instanceof Error ? error.message : String(error)}`,
        scoringFailed: true,
      };
    }
  }
}
