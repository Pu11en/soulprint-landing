/**
 * Experiment Runner
 *
 * Evaluates prompt variants against Opik datasets using custom LLM-as-judge
 * scoring metrics. Runs offline experiments to compare different prompt
 * strategies and measure quality across personality consistency, factuality,
 * and tone matching dimensions.
 *
 * Uses Haiku 4.5 for cost-effective offline evaluation (not Sonnet 4.5).
 *
 * Satisfies: EVAL-03 (experiment runner for offline prompt evaluation)
 */

import { evaluate } from 'opik';
import type { EvaluationResult, EvaluationScoreResult } from 'opik';
import { getOpikClient } from '@/lib/opik';
import { bedrockChat } from '@/lib/bedrock';
import {
  PersonalityConsistencyJudge,
  FactualityJudge,
  ToneMatchingJudge,
} from '@/lib/evaluation/judges';
import type { ChatEvalItem } from '@/lib/evaluation/types';

/**
 * A prompt variant to evaluate. Defines how to build a system prompt
 * from evaluation dataset items.
 */
export interface PromptVariant {
  /** Human-readable name for this variant (used in experiment naming) */
  name: string;
  /** Build a system prompt from an evaluation dataset item */
  buildSystemPrompt: (item: ChatEvalItem) => string;
}

/**
 * Aggregate statistics for a single metric across all evaluated items.
 */
export interface MetricAggregate {
  mean: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Result of running an experiment, including per-metric aggregate scores.
 */
export interface ExperimentResult {
  /** Opik experiment ID */
  experimentId: string;
  /** Human-readable experiment name */
  experimentName: string;
  /** URL to view detailed results in the Opik dashboard */
  resultUrl?: string;
  /** Aggregate scores keyed by metric name */
  aggregateScores: Record<string, MetricAggregate>;
}

/**
 * Run an offline experiment evaluating a prompt variant against an Opik dataset.
 *
 * For each dataset item:
 * 1. Builds a system prompt using the variant's prompt builder
 * 2. Generates a response with Haiku 4.5 (cost-effective for offline eval)
 * 3. Scores the response using all three custom judges
 *
 * Returns aggregate scores (mean/min/max/count) per metric.
 *
 * @param options.datasetName - Name of an existing Opik dataset
 * @param options.variant - Prompt variant to evaluate
 * @param options.experimentName - Optional experiment name (auto-generated if omitted)
 * @param options.nbSamples - Optional limit on number of dataset items to evaluate
 * @returns ExperimentResult with aggregate scores
 * @throws If OPIK_API_KEY is not set or dataset not found
 */
export async function runExperiment(options: {
  datasetName: string;
  variant: PromptVariant;
  experimentName?: string;
  nbSamples?: number;
}): Promise<ExperimentResult> {
  const { datasetName, variant, experimentName, nbSamples } = options;

  const opik = getOpikClient();
  if (!opik) {
    throw new Error(
      'OPIK_API_KEY is not set. Configure it in your environment to run experiments. ' +
      'Sign up at https://www.comet.com/opik and get your API key from Settings.'
    );
  }

  // Get the dataset
  const dataset = await opik.getDataset<ChatEvalItem>(datasetName);

  // Define the evaluation task: build prompt, generate response, return scoring inputs
  const task = async (item: ChatEvalItem): Promise<Record<string, unknown>> => {
    const systemPrompt = variant.buildSystemPrompt(item);

    const response = await bedrockChat({
      model: 'HAIKU_45',
      system: systemPrompt,
      messages: [{ role: 'user', content: item.user_message }],
      maxTokens: 2048,
      temperature: 0.7,
    });

    return {
      output: response,
      input: item.user_message,
      expected_traits: item.expected_traits,
      expected_tone: item.expected_tone,
      expected_style: item.expected_style,
      soulprint_context: item.soulprint_context,
    };
  };

  // Derive experiment name if not provided
  const expName = experimentName || `eval-${variant.name}-${new Date().toISOString().split('T')[0]}`;

  // Run the evaluation
  const result: EvaluationResult = await evaluate<ChatEvalItem>({
    dataset,
    task,
    scoringMetrics: [
      new PersonalityConsistencyJudge(),
      new FactualityJudge(),
      new ToneMatchingJudge(),
    ],
    experimentName: expName,
    nbSamples,
    client: opik,
  });

  // Compute aggregate scores from test results
  const aggregateScores = computeAggregates(result.testResults);

  return {
    experimentId: result.experimentId,
    experimentName: result.experimentName || expName,
    resultUrl: result.resultUrl,
    aggregateScores,
  };
}

/**
 * Compute mean/min/max/count aggregates for each metric across all test results.
 */
function computeAggregates(
  testResults: Array<{ scoreResults: EvaluationScoreResult[] }>
): Record<string, MetricAggregate> {
  const buckets = new Map<string, number[]>();

  for (const testResult of testResults) {
    for (const scoreResult of testResult.scoreResults) {
      // Skip failed scoring results
      if (scoreResult.scoringFailed) continue;

      const existing = buckets.get(scoreResult.name);
      if (existing) {
        existing.push(scoreResult.value);
      } else {
        buckets.set(scoreResult.name, [scoreResult.value]);
      }
    }
  }

  const aggregates: Record<string, MetricAggregate> = {};

  const entries = Array.from(buckets.entries());
  for (const entry of entries) {
    const metricName = entry[0];
    const values = entry[1];
    if (values.length === 0) continue;

    const sum = values.reduce((a, b) => a + b, 0);
    aggregates[metricName] = {
      mean: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  return aggregates;
}
