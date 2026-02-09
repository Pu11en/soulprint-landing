/**
 * Custom LLM-as-Judge Scoring Metrics
 *
 * Three judge classes that extend Opik's BaseMetric to evaluate
 * personalized AI assistant responses against soulprint expectations.
 *
 * All judges use Haiku 4.5 (different model family than Sonnet 4.5 generation)
 * to avoid self-preference bias in scoring.
 *
 * Satisfies: EVAL-02 (judge rubrics exist)
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
// PersonalityConsistencyJudge
// ============================================

const personalitySchema = z.object({
  input: z.string(),
  output: z.string(),
  expected_traits: z.array(z.string()),
  soulprint_context: z.record(z.string(), z.unknown()).optional(),
});

type PersonalityInput = z.infer<typeof personalitySchema>;

/**
 * Evaluates whether an assistant response matches the expected personality traits
 * from the user's soulprint profile.
 *
 * Scores 0.0-1.0 based on:
 * - Communication style alignment
 * - Tone preference adherence
 * - Personality trait reflection
 * - Boundary respect
 */
export class PersonalityConsistencyJudge extends BaseMetric<typeof personalitySchema> {
  readonly validationSchema = personalitySchema;

  constructor() {
    super('personality_consistency');
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

    const data = parsed.data as PersonalityInput;

    const traitsDisplay = data.expected_traits.length > 0
      ? data.expected_traits.map((t) => `- ${t}`).join('\n')
      : '(no specific traits defined)';

    const contextDisplay = data.soulprint_context
      ? JSON.stringify(data.soulprint_context, null, 2)
      : '(no soulprint context available)';

    const prompt = `You are evaluating whether an AI assistant's response matches the expected personality profile.

EXPECTED PERSONALITY TRAITS:
${traitsDisplay}

SOULPRINT CONTEXT:
${contextDisplay}

USER MESSAGE:
${data.input}

ASSISTANT RESPONSE:
${data.output}

Evaluate on a scale of 0.0 (completely inconsistent) to 1.0 (perfectly consistent):
1. Communication style alignment -- does the response match the expected style?
2. Tone preference adherence -- does the tone match what the user prefers?
3. Personality trait reflection -- are traits reflected naturally, not forced?
4. Boundary respect -- does the response honor stated boundaries?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: Perfect trait alignment across all dimensions
- 0.7-0.9: Good alignment with minor deviations
- 0.4-0.6: Mixed alignment, some traits match, others don't
- 0.0-0.3: Poor alignment, contradicts expected personality

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation of score."
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

// ============================================
// FactualityJudge
// ============================================

const factualitySchema = z.object({
  input: z.string(),
  output: z.string(),
  context: z.array(z.string()).optional(),
});

type FactualityInput = z.infer<typeof factualitySchema>;

/**
 * Evaluates whether an assistant response is factually grounded
 * and avoids hallucinating personal details about the user.
 *
 * Scores 0.0-1.0 based on:
 * - Claims supported by context or general knowledge
 * - No fabrication of personal details or memories
 * - Appropriate acknowledgment of uncertainty
 * - No hallucinated specific facts about the user
 */
export class FactualityJudge extends BaseMetric<typeof factualitySchema> {
  readonly validationSchema = factualitySchema;

  constructor() {
    super('factuality');
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

    const data = parsed.data as FactualityInput;

    const contextDisplay = data.context && data.context.length > 0
      ? data.context.map((c, i) => `[${i + 1}] ${c}`).join('\n')
      : '(no specific context provided -- evaluate against general knowledge only)';

    const prompt = `You are evaluating whether an AI assistant's response is factually grounded.

AVAILABLE CONTEXT:
${contextDisplay}

USER MESSAGE:
${data.input}

ASSISTANT RESPONSE:
${data.output}

Evaluate on a scale of 0.0 (completely hallucinated) to 1.0 (fully factual):
1. Are all claims supported by the conversation context or general knowledge?
2. Does the response avoid hallucinating specific facts about the user?
3. Does it acknowledge uncertainty when appropriate (e.g., "I'm not sure" vs. fabricating)?
4. Does it avoid fabricating memories, personal details, or events?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: All claims factually grounded, appropriate uncertainty
- 0.7-0.9: Mostly factual, minor unsupported claims
- 0.4-0.6: Some factual content mixed with unsupported claims
- 0.0-0.3: Significant hallucination or fabrication

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation of score."
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

// ============================================
// ToneMatchingJudge
// ============================================

const toneSchema = z.object({
  input: z.string(),
  output: z.string(),
  expected_tone: z.string(),
  expected_style: z.string(),
});

type ToneInput = z.infer<typeof toneSchema>;

/**
 * Evaluates whether an assistant response matches the expected tone
 * and response style from the user's soulprint profile.
 *
 * Scores 0.0-1.0 based on:
 * - Tone matching (casual, formal, etc.)
 * - Response style adherence (concise, detailed, etc.)
 * - Appropriate formality level
 * - Avoidance of chatbot-like patterns
 */
export class ToneMatchingJudge extends BaseMetric<typeof toneSchema> {
  readonly validationSchema = toneSchema;

  constructor() {
    super('tone_matching');
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

    const data = parsed.data as ToneInput;

    const toneDisplay = data.expected_tone || '(no specific tone defined)';
    const styleDisplay = data.expected_style || '(no specific style defined)';

    const prompt = `You are evaluating whether an AI assistant's response matches the expected tone and style.

EXPECTED TONE: ${toneDisplay}
EXPECTED RESPONSE STYLE: ${styleDisplay}

USER MESSAGE:
${data.input}

ASSISTANT RESPONSE:
${data.output}

Evaluate on a scale of 0.0 (completely wrong tone/style) to 1.0 (perfect match):
1. Tone matching -- does the response match the expected tone (casual, formal, direct, warm, etc.)?
2. Response style -- does it follow the expected style (concise, detailed, conversational, etc.)?
3. Formality level -- is the formality appropriate for the expected tone?
4. Chatbot-free -- does the response avoid chatbot-like patterns (excessive greetings, disclaimers, "I'm just an AI", "Great question!", etc.)?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: Perfect tone and style match, feels natural
- 0.7-0.9: Good match, minor tone shifts
- 0.4-0.6: Mixed -- some tonal alignment, noticeable mismatches
- 0.0-0.3: Wrong tone/style, reads like a generic chatbot

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation of score."
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
