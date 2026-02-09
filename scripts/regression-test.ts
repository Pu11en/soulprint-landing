/**
 * Prompt Regression Test CLI
 *
 * Runs prompt regression tests against an Opik dataset and exits 0 (pass) or 1 (fail).
 * Validates that prompt variants meet minimum quality thresholds for personality consistency,
 * factuality, and tone matching.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/regression-test.ts --dataset <name> --variant <name> [--samples N] [--threshold N]
 *
 * Options:
 *   --dataset <name>   Name of an existing Opik dataset (required)
 *   --variant <name>   Prompt variant to evaluate: v1, v2-natural-voice (required)
 *   --samples N        Number of samples (default: 20, minimum: 20)
 *   --threshold N      Degradation threshold as decimal (default: 0.05 = 5%)
 *   --help             Show this help message
 *
 * Required environment variables:
 *   OPIK_API_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Exit codes:
 *   0 - All metrics meet thresholds (PASS)
 *   1 - One or more metrics below threshold (FAIL) or validation error
 *
 * Satisfies: VALD-01 (regression test suite with 20-100 cases)
 */

import 'dotenv/config';
import { runExperiment } from '@/lib/evaluation/experiments';
import { v1PromptVariant, v2PromptVariant } from '@/lib/evaluation/baseline';
import { validateSampleSize } from '@/lib/evaluation/statistical-validation';
import type { PromptVariant } from '@/lib/evaluation/experiments';

/** Available prompt variants for regression testing. */
const VARIANTS: Record<string, PromptVariant> = {
  v1: v1PromptVariant,
  'v2-natural-voice': v2PromptVariant,
};

/** Absolute minimum thresholds for each metric (not relative to baseline). */
const THRESHOLDS: Record<string, number> = {
  personality_consistency: 0.70,
  factuality: 0.75,
  tone_matching: 0.70,
};

function printUsage(): void {
  console.log(`
Prompt Regression Test CLI

Runs prompt regression tests against an Opik dataset and exits 0 (pass) or 1 (fail).
Validates that prompt variants meet minimum quality thresholds.

Usage:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/regression-test.ts --dataset <name> --variant <name> [--samples N] [--threshold N]

Options:
  --dataset <name>   Name of an existing Opik dataset (required)
  --variant <name>   Prompt variant to evaluate: ${Object.keys(VARIANTS).join(', ')}
  --samples N        Number of samples (default: 20, minimum: 20)
  --threshold N      Degradation threshold as decimal (default: 0.05 = 5%)
  --help             Show this help message

Required environment variables:
  OPIK_API_KEY                 Opik API key for experiment tracking
  AWS_ACCESS_KEY_ID            AWS credentials for Bedrock Haiku 4.5
  AWS_SECRET_ACCESS_KEY        AWS credentials for Bedrock Haiku 4.5

Absolute minimum thresholds (scores must exceed these):
  personality_consistency: ${THRESHOLDS['personality_consistency']!.toFixed(2)}
  factuality:              ${THRESHOLDS['factuality']!.toFixed(2)}
  tone_matching:           ${THRESHOLDS['tone_matching']!.toFixed(2)}

Exit codes:
  0 - All metrics meet thresholds (PASS)
  1 - One or more metrics below threshold (FAIL) or validation error

Examples:
  # Test v2 variant with 20 samples:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/regression-test.ts --dataset chat-eval-2026-02-08 --variant v2-natural-voice

  # Test v1 variant with 50 samples:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/regression-test.ts --dataset chat-eval-2026-02-08 --variant v1 --samples 50
`);
}

function parseArgs(): {
  datasetName: string;
  variantName: string;
  samples: number;
  threshold: number;
} {
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

  // Parse --samples (optional, default 20)
  let samples = 20;
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

  // Parse --threshold (optional, default 0.05)
  let threshold = 0.05;
  const thresholdIdx = args.indexOf('--threshold');
  if (thresholdIdx !== -1) {
    const thresholdStr = args[thresholdIdx + 1];
    if (!thresholdStr) {
      console.error('Error: --threshold requires a numeric argument');
      process.exit(1);
    }
    threshold = parseFloat(thresholdStr);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      console.error(`Error: --threshold must be between 0 and 1, got "${thresholdStr}"`);
      process.exit(1);
    }
  }

  return { datasetName, variantName, samples, threshold };
}

async function main(): Promise<void> {
  const { datasetName, variantName, samples, threshold } = parseArgs();

  // Validate sample size >= 20
  if (!validateSampleSize(samples)) {
    console.error(`Error: Minimum sample size is 20 for statistical significance (requested: ${samples})`);
    process.exit(1);
  }

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

  console.log(`\n=== REGRESSION TEST ===`);
  console.log(`Variant:  ${variantName}`);
  console.log(`Dataset:  ${datasetName}`);
  console.log(`Samples:  ${samples}`);
  console.log(`Threshold: ${(threshold * 100).toFixed(1)}% degradation`);
  console.log('\nRunning experiment...\n');

  const result = await runExperiment({
    datasetName,
    variant,
    nbSamples: samples,
  });

  // Compare each metric to its threshold
  const failures: Array<{ metric: string; score: number; threshold: number }> = [];
  const passes: Array<{ metric: string; score: number; threshold: number }> = [];

  const metricNames = Object.keys(result.aggregateScores).sort();
  for (const metric of metricNames) {
    const agg = result.aggregateScores[metric];
    if (!agg) continue;

    const metricThreshold = THRESHOLDS[metric];
    if (metricThreshold === undefined) {
      // Unknown metric -- skip
      continue;
    }

    if (agg.mean < metricThreshold) {
      failures.push({ metric, score: agg.mean, threshold: metricThreshold });
    } else {
      passes.push({ metric, score: agg.mean, threshold: metricThreshold });
    }
  }

  // Print results table
  console.log('=== RESULTS ===\n');
  console.log('Metric                    Score   Threshold  Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const allResults = [...passes, ...failures].sort((a, b) => a.metric.localeCompare(b.metric));
  for (const { metric, score, threshold: metricThreshold } of allResults) {
    const paddedName = metric.padEnd(25);
    const scoreStr = score.toFixed(2).padStart(5);
    const thresholdStr = metricThreshold.toFixed(2).padStart(9);
    const status = score >= metricThreshold ? 'PASS ✓' : 'FAIL ✗';
    console.log(`${paddedName} ${scoreStr}   ${thresholdStr}  ${status}`);
  }

  console.log('');

  // Print overall verdict
  if (failures.length === 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('OVERALL: PASS ✓');
    console.log(`All ${passes.length} metrics meet minimum thresholds`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  } else {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('OVERALL: FAIL ✗');
    console.log(`${failures.length} metric(s) below threshold:`);
    for (const { metric, score, threshold: metricThreshold } of failures) {
      const deficit = ((metricThreshold - score) / metricThreshold * 100).toFixed(1);
      console.log(`  - ${metric}: ${score.toFixed(2)} (${deficit}% below threshold)`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('\nRegression test failed:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
