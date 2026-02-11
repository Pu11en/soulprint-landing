/**
 * Run Evaluation Experiment
 *
 * Runs an offline experiment comparing a prompt variant against an Opik dataset.
 * Evaluates responses using personality consistency, factuality, and tone matching judges.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/run-experiment.ts --dataset <name> --variant <name> [--samples N]
 *
 * Options:
 *   --dataset <name>   Name of an existing Opik dataset (required)
 *   --variant <name>   Prompt variant to evaluate: v1, v2-natural-voice, v3-openclaw (required)
 *   --samples N        Number of dataset items to evaluate (default: all)
 *   --help             Show this help message
 *
 * Required environment variables:
 *   OPIK_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */

import 'dotenv/config';
import { runExperiment } from '@/lib/evaluation/experiments';
import { v1PromptVariant, v2PromptVariant, v3PromptVariant } from '@/lib/evaluation/baseline';
import type { PromptVariant } from '@/lib/evaluation/experiments';

/** Available prompt variants for A/B evaluation. */
const VARIANTS: Record<string, PromptVariant> = {
  v1: v1PromptVariant,
  'v2-natural-voice': v2PromptVariant,
  'v3-openclaw': v3PromptVariant,
};

function printUsage(): void {
  console.log(`
Run Evaluation Experiment

Runs an offline experiment comparing a prompt variant against an Opik dataset.
Evaluates responses using personality consistency, factuality, and tone matching judges.

Usage:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/run-experiment.ts --dataset <name> --variant <name> [--samples N]

Options:
  --dataset <name>   Name of an existing Opik dataset (required)
  --variant <name>   Prompt variant to evaluate: ${Object.keys(VARIANTS).join(', ')}
  --samples N        Number of dataset items to evaluate (default: all)
  --help             Show this help message

Required environment variables:
  OPIK_API_KEY                 Opik API key for experiment tracking
  AWS_ACCESS_KEY_ID            AWS credentials for Bedrock Haiku 4.5
  AWS_SECRET_ACCESS_KEY        AWS credentials for Bedrock Haiku 4.5

Examples:
  # Compare v1 vs v2:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/run-experiment.ts --dataset chat-eval-2026-02-08 --variant v1
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/run-experiment.ts --dataset chat-eval-2026-02-08 --variant v2-natural-voice

  # Evaluate a subset:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/run-experiment.ts --dataset chat-eval-2026-02-08 --variant v2-natural-voice --samples 20
`);
}

function parseArgs(): { datasetName: string; variantName: string; samples?: number } {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  // Parse --dataset
  const datasetIdx = args.indexOf('--dataset');
  if (datasetIdx === -1) {
    console.error('Error: --dataset is required');
    printUsage();
    process.exit(1);
  }
  const datasetName = args[datasetIdx + 1];
  if (!datasetName || datasetName.startsWith('--')) {
    console.error('Error: --dataset requires a name argument');
    process.exit(1);
  }

  // Parse --variant
  const variantIdx = args.indexOf('--variant');
  if (variantIdx === -1) {
    console.error('Error: --variant is required');
    printUsage();
    process.exit(1);
  }
  const variantName = args[variantIdx + 1];
  if (!variantName || variantName.startsWith('--')) {
    console.error('Error: --variant requires a name argument');
    process.exit(1);
  }

  const availableVariants = Object.keys(VARIANTS);
  if (!availableVariants.includes(variantName)) {
    console.error(`Error: Unknown variant "${variantName}". Available: ${availableVariants.join(', ')}`);
    process.exit(1);
  }

  // Parse --samples (optional)
  let samples: number | undefined;
  const samplesIdx = args.indexOf('--samples');
  if (samplesIdx !== -1) {
    const samplesStr = args[samplesIdx + 1];
    if (!samplesStr) {
      console.error('Error: --samples requires a numeric argument');
      process.exit(1);
    }
    samples = parseInt(samplesStr, 10);
    if (isNaN(samples) || samples < 1) {
      console.error(`Error: --samples must be a positive number, got "${samplesStr}"`);
      process.exit(1);
    }
  }

  return { datasetName, variantName, samples };
}

async function main(): Promise<void> {
  const { datasetName, variantName, samples } = parseArgs();

  // Validate required environment variables
  const required = ['OPIK_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Set them in .env.local or pass via environment.');
    process.exit(1);
  }

  const variant = VARIANTS[variantName];
  if (!variant) {
    console.error(`Error: Variant "${variantName}" not found`);
    process.exit(1);
  }

  console.log(`\nRunning experiment: variant="${variantName}" dataset="${datasetName}"`);
  if (samples) {
    console.log(`Evaluating ${samples} samples`);
  }
  console.log('This may take several minutes depending on dataset size...\n');

  const result = await runExperiment({
    datasetName,
    variant,
    nbSamples: samples,
  });

  // Print results as formatted table
  console.log(`\n=== EXPERIMENT RESULTS: ${variantName} ===\n`);

  const metricNames = Object.keys(result.aggregateScores).sort();
  for (const name of metricNames) {
    const agg = result.aggregateScores[name];
    if (!agg) continue;
    const paddedName = name.padEnd(25);
    console.log(
      `${paddedName} ${agg.mean.toFixed(2)} (min: ${agg.min.toFixed(2)}, max: ${agg.max.toFixed(2)}, n=${agg.count})`
    );
  }

  console.log(`\nExperiment ID: ${result.experimentId}`);
  if (result.resultUrl) {
    console.log(`Dashboard URL: ${result.resultUrl}`);
  }
}

main().catch((error: unknown) => {
  console.error('\nExperiment failed:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
