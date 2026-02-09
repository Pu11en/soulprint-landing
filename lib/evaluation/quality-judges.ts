/**
 * Quality Scoring Judge Classes
 *
 * Three LLM-as-judge metrics that evaluate soulprint section quality
 * on three dimensions: completeness, coherence, and specificity.
 *
 * Extends Opik's BaseMetric following the same pattern as evaluation judges.
 * Uses Haiku 4.5 for fast, cost-effective scoring.
 *
 * Phase 4: Quality Scoring - Foundation layer for soulprint quality assessment
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
// Shared Schema
// ============================================

const qualitySchema = z.object({
  section_name: z.string(),     // 'SOUL', 'IDENTITY', 'USER', 'AGENTS', 'TOOLS'
  section_content: z.string(),
  section_type: z.enum(['soul', 'identity', 'user', 'agents', 'tools']),
});

type QualityInput = z.infer<typeof qualitySchema>;

// ============================================
// Expected Fields by Section Type
// ============================================

const EXPECTED_FIELDS: Record<string, string[]> = {
  soul: [
    'communication_style',
    'personality_traits',
    'tone_preferences',
    'boundaries',
    'humor_style',
    'formality_level',
    'emotional_patterns',
  ],
  identity: [
    'ai_name',
    'archetype',
    'vibe',
    'emoji_style',
    'signature_greeting',
  ],
  user: [
    'name',
    'location',
    'occupation',
    'relationships',
    'interests',
    'life_context',
    'preferred_address',
  ],
  agents: [
    'response_style',
    'behavioral_rules',
    'context_adaptation',
    'memory_directives',
    'do_not',
  ],
  tools: [
    'likely_usage',
    'capabilities_emphasis',
    'output_preferences',
    'depth_preference',
  ],
};

// ============================================
// CompletenessJudge
// ============================================

/**
 * Evaluates whether all expected fields are present and populated
 * with sufficient detail for a soulprint section.
 *
 * Scores 0.0-1.0 based on:
 * - Presence of expected fields for the section type
 * - Depth of detail in each field
 * - Coverage of critical personality/behavioral aspects
 */
export class CompletenessJudge extends BaseMetric<typeof qualitySchema> {
  readonly validationSchema = qualitySchema;

  constructor() {
    super('completeness');
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

    const data = parsed.data as QualityInput;

    const expectedFields = EXPECTED_FIELDS[data.section_type] || [];
    const fieldsDisplay = expectedFields.length > 0
      ? expectedFields.map((f) => `- ${f}`).join('\n')
      : '(no expected fields defined)';

    const prompt = `You are evaluating the completeness of a soulprint section.

SECTION: ${data.section_name}
SECTION TYPE: ${data.section_type}

EXPECTED FIELDS:
${fieldsDisplay}

SECTION CONTENT:
${data.section_content}

Evaluate on a scale of 0.0 (critically incomplete) to 1.0 (fully complete):
1. Are all expected fields present and populated?
2. Does each field have sufficient detail (not just placeholders or generic statements)?
3. Are critical personality/behavioral aspects covered?
4. Is the information specific enough to be actionable for personalization?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: All fields present with rich, specific detail
- 0.7-0.9: Mostly complete, minor gaps or shallow detail in some fields
- 0.4-0.6: Several fields missing or lacking detail
- 0.0-0.3: Critical fields missing, insufficient for personalization

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
// CoherenceJudge
// ============================================

/**
 * Evaluates the logical flow, internal consistency, and structural
 * clarity of a soulprint section.
 *
 * Scores 0.0-1.0 based on:
 * - Logical organization and flow
 * - Internal consistency (no contradictions)
 * - Unified purpose and clear structure
 * - Natural reading experience
 */
export class CoherenceJudge extends BaseMetric<typeof qualitySchema> {
  readonly validationSchema = qualitySchema;

  constructor() {
    super('coherence');
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

    const data = parsed.data as QualityInput;

    const prompt = `You are evaluating the coherence of a soulprint section.

SECTION: ${data.section_name}
SECTION TYPE: ${data.section_type}

SECTION CONTENT:
${data.section_content}

Evaluate on a scale of 0.0 (incoherent) to 1.0 (perfectly coherent):
1. Logical flow -- does the content follow a clear, logical structure?
2. Internal consistency -- are there any contradictions or conflicting statements?
3. Structural clarity -- is the organization easy to follow and understand?
4. Unified purpose -- does everything in the section serve a clear, unified goal?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: Perfectly logical, consistent, and well-structured
- 0.7-0.9: Good coherence with minor organizational issues
- 0.4-0.6: Some logical flow but noticeable inconsistencies or poor structure
- 0.0-0.3: Incoherent, contradictory, or disorganized

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
// SpecificityJudge
// ============================================

/**
 * Evaluates whether section content contains specific, concrete details
 * rather than vague or generic statements.
 *
 * Scores 0.0-1.0 based on:
 * - Presence of specific names, numbers, examples
 * - Concrete details vs. abstract platitudes
 * - Actionable personality information
 * - Avoidance of generic filler content
 */
export class SpecificityJudge extends BaseMetric<typeof qualitySchema> {
  readonly validationSchema = qualitySchema;

  constructor() {
    super('specificity');
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

    const data = parsed.data as QualityInput;

    const prompt = `You are evaluating the specificity of a soulprint section.

SECTION: ${data.section_name}
SECTION TYPE: ${data.section_type}

SECTION CONTENT:
${data.section_content}

Evaluate on a scale of 0.0 (entirely generic) to 1.0 (highly specific):
1. Concrete details -- does the content include specific names, numbers, or examples?
2. Specificity vs. vagueness -- are statements concrete and actionable, or vague and abstract?
3. Unique personality -- does the content capture unique traits, or use generic platitudes?
4. Actionable information -- can this content drive personalized behavior, or is it filler?

${ANTI_LENGTH_BIAS}

Score scale:
- 1.0: Highly specific, concrete details throughout
- 0.7-0.9: Mostly specific with some generic statements
- 0.4-0.6: Mix of specific and vague content
- 0.0-0.3: Generic platitudes, lacks concrete details

Examples of specificity:
- Specific: "Prefers 'Drew' over 'Andrew', lives in Austin, works as an engineer at StartupCo"
- Generic: "User has a name, lives somewhere, and has a job"
- Specific: "Direct communication, no small talk, gets annoyed by excessive pleasantries"
- Generic: "Communicates in their own unique way"

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
