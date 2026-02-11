/**
 * Baseline Metric Recording
 *
 * Records baseline metrics for the current v1 prompt system by running
 * an experiment with a prompt builder that replicates the production
 * `buildSystemPrompt` logic from app/api/chat/route.ts.
 *
 * The v1 prompt builder is copied inline (not extracted from chat route)
 * because:
 * 1. The chat route's buildSystemPrompt is a private inline function with
 *    runtime parameters (dailyMemory, memoryContext, etc.) not available
 *    in offline evaluation context
 * 2. Phase 2 (Prompt Template System) will refactor the chat route entirely,
 *    so extracting a shared helper now would create coupling that Phase 2
 *    immediately undoes
 * 3. The baseline is meant to freeze a snapshot of v1 behavior for comparison
 *
 * Satisfies: EVAL-04 (baseline metrics for current v1 prompt system)
 */

import { runExperiment } from '@/lib/evaluation/experiments';
import type { ExperimentResult, PromptVariant } from '@/lib/evaluation/experiments';
import { cleanSection, formatSection } from '@/lib/soulprint/prompt-helpers';
import type { ChatEvalItem } from '@/lib/evaluation/types';
import { PromptBuilder } from '@/lib/soulprint/prompt-builder';

/**
 * Baseline result extends experiment result with version metadata.
 */
export interface BaselineResult extends ExperimentResult {
  /** Prompt system version (e.g., 'v1') */
  version: string;
  /** ISO timestamp when baseline was recorded */
  recordedAt: string;
}

/**
 * Build a v1 system prompt from an evaluation dataset item.
 *
 * Replicates the production buildSystemPrompt from app/api/chat/route.ts
 * (lines 553-665) in owner mode with structured sections. Skips runtime-only
 * features: dailyMemory, memoryContext, forcedSearchContext, imposter mode.
 *
 * Uses "SoulPrint" as the AI name (hardcoded -- eval doesn't have per-user names).
 *
 * Exported for reuse by scripts/run-experiment.ts when running the v1 variant.
 */
export function buildV1SystemPrompt(item: ChatEvalItem): string {
  const aiName = 'SoulPrint';

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

  // Parse and clean structured sections from soulprint context
  const soul = cleanSection(item.soulprint_context.soul);
  const identity = cleanSection(item.soulprint_context.identity);
  const userInfo = cleanSection(item.soulprint_context.user);
  const agents = cleanSection(item.soulprint_context.agents);
  const tools = cleanSection(item.soulprint_context.tools);

  const hasStructuredSections = soul || identity || userInfo || agents || tools;

  // Preamble -- matches production chat route exactly (lines 605-613)
  let prompt = `# ${aiName}

You have memories of this person — things they've said, how they think, what they care about. Use them naturally. Don't announce that you have memories. Don't offer to "show" or "look up" memories. Just know them like a friend would.

Be direct. Have opinions. Push back when you disagree. Don't hedge everything. If you don't know something, say so.

NEVER start responses with greetings like "Hey", "Hi", "Hello", "Hey there", "Great question", or any pleasantries. Jump straight into substance. Talk like a person, not a chatbot.

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
  }

  return prompt;
}

/**
 * V1 prompt variant definition for use with runExperiment.
 */
export const v1PromptVariant: PromptVariant = {
  name: 'v1-baseline',
  buildSystemPrompt: buildV1SystemPrompt,
};

/**
 * Build a v2 system prompt from an evaluation dataset item.
 *
 * Uses the PromptBuilder('v2-natural-voice') version for natural flowing prose
 * instead of markdown headers. Maps evaluation dataset fields to PromptParams.
 *
 * This is intentionally simpler than v1 -- we're measuring prompt STYLE differences,
 * not runtime features (dailyMemory, memoryContext, webSearch don't vary between v1/v2).
 *
 * Exported for reuse by scripts/run-experiment.ts when running the v2 variant.
 */
export function buildV2SystemPrompt(item: ChatEvalItem): string {
  const builder = new PromptBuilder('v2-natural-voice');

  // Construct profile from item.soulprint_context
  // JSON.stringify each section into *_md fields for PromptBuilder
  const profile = {
    soulprint_text: null,
    import_status: 'complete',
    ai_name: 'SoulPrint',
    soul_md: item.soulprint_context.soul ? JSON.stringify(item.soulprint_context.soul) : null,
    identity_md: item.soulprint_context.identity ? JSON.stringify(item.soulprint_context.identity) : null,
    user_md: item.soulprint_context.user ? JSON.stringify(item.soulprint_context.user) : null,
    agents_md: item.soulprint_context.agents ? JSON.stringify(item.soulprint_context.agents) : null,
    tools_md: item.soulprint_context.tools ? JSON.stringify(item.soulprint_context.tools) : null,
    memory_md: null,
  };

  return builder.buildSystemPrompt({
    profile,
    dailyMemory: null,
    memoryContext: undefined,
    aiName: 'SoulPrint',
    isOwner: true,
  });
}

/**
 * V2 prompt variant definition for use with runExperiment.
 */
export const v2PromptVariant: PromptVariant = {
  name: 'v2-natural-voice',
  buildSystemPrompt: buildV2SystemPrompt,
};

/**
 * Build a v3 system prompt from an evaluation dataset item.
 *
 * Uses the PromptBuilder('v3-openclaw') version — OpenClaw-style cohesive
 * personality injection that weaves all 5 JSON sections into natural prose
 * with direct behavioral rules instead of markdown key-value formatting.
 *
 * Exported for reuse by scripts/run-experiment.ts when running the v3 variant.
 */
export function buildV3SystemPrompt(item: ChatEvalItem): string {
  const builder = new PromptBuilder('v3-openclaw');

  const profile = {
    soulprint_text: null,
    import_status: 'complete',
    ai_name: 'SoulPrint',
    soul_md: item.soulprint_context.soul ? JSON.stringify(item.soulprint_context.soul) : null,
    identity_md: item.soulprint_context.identity ? JSON.stringify(item.soulprint_context.identity) : null,
    user_md: item.soulprint_context.user ? JSON.stringify(item.soulprint_context.user) : null,
    agents_md: item.soulprint_context.agents ? JSON.stringify(item.soulprint_context.agents) : null,
    tools_md: item.soulprint_context.tools ? JSON.stringify(item.soulprint_context.tools) : null,
    memory_md: null,
  };

  return builder.buildSystemPrompt({
    profile,
    dailyMemory: null,
    memoryContext: undefined,
    aiName: 'SoulPrint',
    isOwner: true,
  });
}

/**
 * V3 prompt variant definition for use with runExperiment.
 */
export const v3PromptVariant: PromptVariant = {
  name: 'v3-openclaw',
  buildSystemPrompt: buildV3SystemPrompt,
};

/**
 * Record baseline metrics for the current v1 prompt system.
 *
 * Runs an experiment using the v1 prompt builder against the specified dataset
 * and returns the results with version metadata.
 *
 * @param options.datasetName - Name of an existing Opik dataset to evaluate against
 * @param options.nbSamples - Optional limit on number of items to evaluate
 * @param options.variant - Prompt variant to evaluate (defaults to v1PromptVariant)
 * @returns BaselineResult with aggregate scores and version metadata
 */
export async function recordBaseline(options: {
  datasetName: string;
  nbSamples?: number;
  variant?: PromptVariant;
}): Promise<BaselineResult> {
  const { datasetName, nbSamples, variant = v1PromptVariant } = options;

  console.log(`\nRecording ${variant.name} baseline metrics against dataset: ${datasetName}`);
  if (nbSamples) {
    console.log(`Evaluating ${nbSamples} samples`);
  }

  const result = await runExperiment({
    datasetName,
    variant,
    experimentName: `baseline-${variant.name}-${new Date().toISOString().split('T')[0]}`,
    nbSamples,
  });

  const baselineResult: BaselineResult = {
    ...result,
    version: variant.name,
    recordedAt: new Date().toISOString(),
  };

  // Log aggregate scores in a readable format
  console.log(`\n=== ${variant.name.toUpperCase()} BASELINE METRICS ===\n`);

  const metricNames = Object.keys(baselineResult.aggregateScores).sort();
  for (const name of metricNames) {
    const agg = baselineResult.aggregateScores[name];
    if (!agg) continue;
    const paddedName = name.padEnd(25);
    console.log(
      `${paddedName} ${agg.mean.toFixed(2)} (min: ${agg.min.toFixed(2)}, max: ${agg.max.toFixed(2)}, n=${agg.count})`
    );
  }

  console.log(`\nExperiment ID: ${baselineResult.experimentId}`);
  if (baselineResult.resultUrl) {
    console.log(`Dashboard URL: ${baselineResult.resultUrl}`);
  }
  console.log(`Recorded at:  ${baselineResult.recordedAt}`);

  return baselineResult;
}
