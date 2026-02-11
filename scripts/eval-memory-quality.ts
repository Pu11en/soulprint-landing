/**
 * Memory Quality A/B Evaluation Script
 *
 * Compares chat quality with full pass complete vs quick_ready only.
 * Runs two experiment conditions against the same Opik dataset:
 *
 * Condition A: quick_ready only — NO memory_md, NO memoryContext (simulates before full pass)
 * Condition B: full_pass complete — WITH memory_md, WITH memoryContext (simulates after full pass)
 *
 * Scores both conditions with 4 judges:
 * - PersonalityConsistencyJudge (baseline: should be similar)
 * - FactualityJudge (baseline: should be similar)
 * - ToneMatchingJudge (baseline: should be similar)
 * - MemoryDepthJudge (hypothesis: should be MUCH higher with full pass)
 *
 * Produces comparison table showing per-metric deltas.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/eval-memory-quality.ts --dataset <name> [--limit N]
 *
 * Satisfies: MEM-03 (measurable evidence that full pass improves chat quality)
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { evaluate } from 'opik';
import type { EvaluationResult } from 'opik';
import { getOpikClient } from '@/lib/opik';
import { bedrockChat } from '@/lib/bedrock';
import { PromptBuilder } from '@/lib/soulprint/prompt-builder';
import {
  PersonalityConsistencyJudge,
  FactualityJudge,
  ToneMatchingJudge,
} from '@/lib/evaluation/judges';
import { MemoryDepthJudge } from '@/lib/evaluation/memory-quality-judge';
import type { ChatEvalItem } from '@/lib/evaluation/types';

// ============================================
// Types
// ============================================

interface MemoryData {
  memory_md: string | null;
  memoryContext: string;
}

interface UserProfileRow {
  user_id: string;
  memory_md: string | null;
}

interface ConversationChunk {
  content: string;
  relevance_score?: number;
}

// ============================================
// CLI Argument Parsing
// ============================================

function printUsage(): void {
  console.log(`
Memory Quality A/B Evaluation

Compares chat quality with full pass complete vs quick_ready only.

Usage:
  DOTENV_CONFIG_PATH=.env.local npx tsx scripts/eval-memory-quality.ts --dataset <name> [--limit N]

Options:
  --dataset <name>   Name of the Opik dataset to evaluate (REQUIRED)
  --limit N          Maximum number of items to evaluate from dataset (default: 20)
  --help             Show this help message

Required environment variables:
  NEXT_PUBLIC_SUPABASE_URL     Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    Supabase service role key (for memory data access)
  OPIK_API_KEY                 Opik API key for experiment runs
  AWS_ACCESS_KEY_ID            AWS credentials for Bedrock (response generation + judging)
  AWS_SECRET_ACCESS_KEY        AWS secret key
`);
}

function parseArgs(): { datasetName: string; limit: number } {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  // Parse --dataset (required)
  const datasetIdx = args.indexOf('--dataset');
  if (datasetIdx === -1) {
    console.error('Error: --dataset is required');
    printUsage();
    process.exit(1);
  }
  const datasetName = args[datasetIdx + 1];
  if (!datasetName) {
    console.error('Error: --dataset requires a dataset name');
    printUsage();
    process.exit(1);
  }

  // Parse --limit (optional, default 20)
  let limit = 20;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1) {
    const limitStr = args[limitIdx + 1];
    if (!limitStr) {
      console.error('Error: --limit requires a numeric argument');
      printUsage();
      process.exit(1);
    }
    limit = parseInt(limitStr, 10);
    if (isNaN(limit) || limit < 1) {
      console.error(`Error: --limit must be a positive number, got "${limitStr}"`);
      process.exit(1);
    }
  }

  return { datasetName, limit };
}

// ============================================
// Memory Data Fetching
// ============================================

/**
 * Create admin Supabase client for server-side data access.
 * Uses service role key to bypass RLS.
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * SHA256 hash a user ID for matching against dataset user_id_hash.
 * Must match the hashing in datasets.ts.
 */
function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

/**
 * Fetch memory data for users in the dataset.
 *
 * Process:
 * 1. Extract unique user_id_hashes from dataset items
 * 2. Fetch ALL user_profiles (user_id, memory_md) from Supabase
 * 3. Build reverse lookup: hash each user_id, match against dataset hashes
 * 4. For matched users, fetch their memory_md and conversation_chunks
 * 5. Build memoryContext string from top 5 chunks
 *
 * Returns Map<user_id_hash, MemoryData>
 */
async function fetchMemoryData(datasetItems: ChatEvalItem[]): Promise<Map<string, MemoryData>> {
  const supabase = getSupabaseAdmin();

  // Extract unique user_id_hashes from dataset
  const datasetHashes = new Set<string>();
  for (const item of datasetItems) {
    const hash = item.metadata?.user_id_hash;
    if (typeof hash === 'string' && hash) {
      datasetHashes.add(hash);
    }
  }

  console.log(`\nFound ${datasetHashes.size} unique users in dataset`);

  // Fetch ALL user_profiles (just user_id, memory_md columns)
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('user_id, memory_md');

  if (profilesError) {
    throw new Error(`Failed to fetch user_profiles: ${profilesError.message}`);
  }

  if (!profiles || profiles.length === 0) {
    throw new Error('No user_profiles found in database');
  }

  console.log(`Fetched ${profiles.length} total user profiles from database`);

  // Build reverse lookup: hash -> real user_id
  const hashToUserId = new Map<string, string>();
  for (const profile of profiles as UserProfileRow[]) {
    const hash = hashUserId(profile.user_id);
    hashToUserId.set(hash, profile.user_id);
  }

  // Match dataset hashes to real user_ids
  const matchedUserIds: string[] = [];
  const unmatchedHashes: string[] = [];
  for (const hash of datasetHashes) {
    const userId = hashToUserId.get(hash);
    if (userId) {
      matchedUserIds.push(userId);
    } else {
      unmatchedHashes.push(hash);
    }
  }

  console.log(`Matched ${matchedUserIds.length} dataset users to real user_ids`);
  if (unmatchedHashes.length > 0) {
    console.warn(`Warning: ${unmatchedHashes.length} dataset users could not be matched (users may have been deleted)`);
  }

  if (matchedUserIds.length === 0) {
    throw new Error(
      'No dataset users could be matched to existing user_profiles. ' +
      'This likely means the users in the dataset no longer exist in the database. ' +
      'Create a fresh dataset with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/create-eval-dataset.ts'
    );
  }

  // Fetch memory data for matched users
  const memoryDataMap = new Map<string, MemoryData>();

  for (const userId of matchedUserIds) {
    // Get memory_md from the profiles we already fetched
    const profile = (profiles as UserProfileRow[]).find(p => p.user_id === userId);
    const memory_md = profile?.memory_md ?? null;

    // Fetch top 5 conversation_chunks for this user
    const { data: chunks, error: chunksError } = await supabase
      .from('conversation_chunks')
      .select('content, relevance_score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (chunksError) {
      console.warn(`Warning: Failed to fetch chunks for user ${userId}: ${chunksError.message}`);
      continue;
    }

    // Build memoryContext from chunks
    let memoryContext = '';
    if (chunks && chunks.length > 0) {
      const chunkTexts = (chunks as ConversationChunk[]).map(c => c.content);
      memoryContext = chunkTexts.join('\n\n---\n\n');
    }

    // Store by hash for easy lookup during experiment
    const hash = hashUserId(userId);
    memoryDataMap.set(hash, {
      memory_md,
      memoryContext,
    });
  }

  console.log(`Built memory data for ${memoryDataMap.size} users`);

  // Count how many have full pass data
  let fullPassCount = 0;
  for (const data of memoryDataMap.values()) {
    if (data.memory_md || data.memoryContext) {
      fullPassCount++;
    }
  }

  console.log(`Users with full pass data: ${fullPassCount}/${memoryDataMap.size}`);

  if (fullPassCount === 0) {
    throw new Error(
      'No users with full pass data found. ' +
      'All users in the dataset are missing memory_md AND conversation_chunks. ' +
      'Run a full pass import for at least one user, then re-run this experiment.'
    );
  }

  return memoryDataMap;
}

// ============================================
// Experiment Execution
// ============================================

/**
 * Run an experiment condition against the dataset.
 * Generates responses using PromptBuilder with the specified configuration.
 */
async function runExperimentCondition(
  datasetName: string,
  conditionName: string,
  nbSamples: number,
  memoryDataMap: Map<string, MemoryData>,
  includeMemory: boolean
): Promise<EvaluationResult> {
  const opik = getOpikClient();
  if (!opik) {
    throw new Error('OPIK_API_KEY not set');
  }

  const dataset = await opik.getDataset<ChatEvalItem>(datasetName);
  const promptBuilder = new PromptBuilder('v2-natural-voice');

  // Define the evaluation task
  const task = async (item: ChatEvalItem): Promise<Record<string, unknown>> => {
    // Get memory data for this user (if available)
    const userHash = item.metadata?.user_id_hash as string | undefined;
    const memoryData = userHash ? memoryDataMap.get(userHash) : undefined;

    // Build profile from soulprint_context
    const profile = {
      soulprint_text: null,
      import_status: 'complete',
      ai_name: 'SoulPrint',
      soul_md: item.soulprint_context.soul ? JSON.stringify(item.soulprint_context.soul) : null,
      identity_md: item.soulprint_context.identity ? JSON.stringify(item.soulprint_context.identity) : null,
      user_md: item.soulprint_context.user ? JSON.stringify(item.soulprint_context.user) : null,
      agents_md: item.soulprint_context.agents ? JSON.stringify(item.soulprint_context.agents) : null,
      tools_md: item.soulprint_context.tools ? JSON.stringify(item.soulprint_context.tools) : null,
      memory_md: includeMemory ? (memoryData?.memory_md ?? null) : null,
    };

    // Build system prompt
    const systemPrompt = promptBuilder.buildSystemPrompt({
      profile,
      dailyMemory: null,
      memoryContext: includeMemory ? (memoryData?.memoryContext ?? undefined) : undefined,
      aiName: 'SoulPrint',
      isOwner: true,
    });

    // Generate response
    const response = await bedrockChat({
      model: 'HAIKU_45',
      system: systemPrompt,
      messages: [{ role: 'user', content: item.user_message }],
      maxTokens: 2048,
      temperature: 0.7,
    });

    // Flatten soulprint context into context strings for factuality judge
    const context: string[] = [];
    if (item.soulprint_context.soul) {
      context.push(`User personality profile: ${JSON.stringify(item.soulprint_context.soul)}`);
    }
    if (item.soulprint_context.identity) {
      context.push(`User identity: ${JSON.stringify(item.soulprint_context.identity)}`);
    }
    if (item.soulprint_context.user) {
      context.push(`User info: ${JSON.stringify(item.soulprint_context.user)}`);
    }
    if (item.soulprint_context.agents) {
      context.push(`Agent configuration: ${JSON.stringify(item.soulprint_context.agents)}`);
    }
    if (item.soulprint_context.tools) {
      context.push(`Tool preferences: ${JSON.stringify(item.soulprint_context.tools)}`);
    }

    // Add memory context to factuality judge context if available
    if (includeMemory && memoryData?.memoryContext) {
      context.push(`Memory context: ${memoryData.memoryContext}`);
    }

    return {
      output: response,
      input: item.user_message,
      expected_traits: item.expected_traits,
      expected_tone: item.expected_tone || 'natural and conversational',
      expected_style: item.expected_style || 'direct and helpful',
      soulprint_context: item.soulprint_context,
      context,
      // Memory depth judge inputs
      has_memory: includeMemory,
      memory_context: includeMemory ? (memoryData?.memoryContext ?? undefined) : undefined,
    };
  };

  // Run the evaluation
  const result: EvaluationResult = await evaluate<ChatEvalItem>({
    dataset,
    task,
    scoringMetrics: [
      new PersonalityConsistencyJudge(),
      new FactualityJudge(),
      new ToneMatchingJudge(),
      new MemoryDepthJudge(),
    ],
    experimentName: `memory-quality-${conditionName}-${new Date().toISOString().split('T')[0]}`,
    nbSamples,
    client: opik,
  });

  return result;
}

/**
 * Compute aggregate scores (mean/min/max/count) from test results.
 */
function computeAggregates(
  testResults: Array<{ scoreResults: Array<{ name: string; value: number; scoringFailed?: boolean }> }>
): Record<string, { mean: number; min: number; max: number; count: number }> {
  const buckets = new Map<string, number[]>();

  for (const testResult of testResults) {
    for (const scoreResult of testResult.scoreResults) {
      if (scoreResult.scoringFailed) continue;

      const existing = buckets.get(scoreResult.name);
      if (existing) {
        existing.push(scoreResult.value);
      } else {
        buckets.set(scoreResult.name, [scoreResult.value]);
      }
    }
  }

  const aggregates: Record<string, { mean: number; min: number; max: number; count: number }> = {};

  for (const [metricName, values] of buckets.entries()) {
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

/**
 * Print comparison table showing per-metric scores and deltas.
 */
function printComparisonTable(
  quickReadyAggregates: Record<string, { mean: number; min: number; max: number; count: number }>,
  fullPassAggregates: Record<string, { mean: number; min: number; max: number; count: number }>
): void {
  console.log('\n' + '='.repeat(80));
  console.log('MEMORY QUALITY A/B COMPARISON');
  console.log('='.repeat(80));

  console.log('\nMetric                      | quick_ready | full_pass | Delta    | Change');
  console.log('-'.repeat(80));

  const metrics = ['personality_consistency', 'factuality', 'tone_matching', 'memory_depth'];

  for (const metric of metrics) {
    const quickReady = quickReadyAggregates[metric]?.mean ?? 0;
    const fullPass = fullPassAggregates[metric]?.mean ?? 0;
    const delta = fullPass - quickReady;
    const changePercent = quickReady > 0 ? ((delta / quickReady) * 100) : 0;

    const metricDisplay = metric.padEnd(27);
    const quickReadyDisplay = quickReady.toFixed(3).padStart(11);
    const fullPassDisplay = fullPass.toFixed(3).padStart(9);
    const deltaDisplay = (delta >= 0 ? '+' : '') + delta.toFixed(3);
    const deltaDisplayPadded = deltaDisplay.padStart(8);
    const changeDisplay = (changePercent >= 0 ? '+' : '') + changePercent.toFixed(1) + '%';

    console.log(`${metricDisplay} | ${quickReadyDisplay} | ${fullPassDisplay} | ${deltaDisplayPadded} | ${changeDisplay}`);
  }

  console.log('='.repeat(80));

  // Interpretation
  const memoryDelta = (fullPassAggregates['memory_depth']?.mean ?? 0) - (quickReadyAggregates['memory_depth']?.mean ?? 0);
  console.log('\nINTERPRETATION:');
  if (memoryDelta > 0.3) {
    console.log('✓ Strong evidence that full pass improves memory depth (delta > 0.3)');
  } else if (memoryDelta > 0.15) {
    console.log('✓ Moderate evidence that full pass improves memory depth (delta > 0.15)');
  } else if (memoryDelta > 0.05) {
    console.log('⚠ Weak evidence that full pass improves memory depth (delta > 0.05)');
  } else {
    console.log('✗ No significant improvement in memory depth (delta ≤ 0.05)');
  }

  console.log('\nBaseline metrics (personality_consistency, factuality, tone_matching) should remain stable.');
  console.log('Large deltas in baseline metrics suggest dataset quality issues or prompt instability.\n');
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const { datasetName, limit } = parseArgs();

  // Validate required environment variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPIK_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Error: Missing required environment variables: ${missing.join(', ')}`);
    console.error('Set them in .env.local or pass via environment.');
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('MEMORY QUALITY A/B EVALUATION');
  console.log('='.repeat(80));
  console.log(`Dataset: ${datasetName}`);
  console.log(`Sample limit: ${limit}`);

  // Fetch the dataset to get items
  const opik = getOpikClient();
  if (!opik) {
    throw new Error('OPIK_API_KEY not set');
  }

  console.log('\nFetching dataset items...');
  const dataset = await opik.getDataset<ChatEvalItem>(datasetName);
  const allItems = await dataset.getItems();
  const items = allItems.slice(0, limit);
  console.log(`Using ${items.length} items from dataset`);

  // Fetch memory data for users in dataset
  console.log('\nFetching memory data for users...');
  const memoryDataMap = await fetchMemoryData(items);

  // Run Condition A: quick_ready (no memory)
  console.log('\n' + '='.repeat(80));
  console.log('CONDITION A: quick_ready (NO memory_md, NO memoryContext)');
  console.log('='.repeat(80));
  console.log('Running experiment...\n');

  const quickReadyResult = await runExperimentCondition(
    datasetName,
    'quick-ready',
    limit,
    memoryDataMap,
    false // includeMemory = false
  );

  const quickReadyAggregates = computeAggregates(quickReadyResult.testResults);

  console.log('✓ Condition A complete');
  console.log(`Experiment ID: ${quickReadyResult.experimentId}`);
  if (quickReadyResult.resultUrl) {
    console.log(`View results: ${quickReadyResult.resultUrl}`);
  }

  // Run Condition B: full_pass (with memory)
  console.log('\n' + '='.repeat(80));
  console.log('CONDITION B: full_pass (WITH memory_md, WITH memoryContext)');
  console.log('='.repeat(80));
  console.log('Running experiment...\n');

  const fullPassResult = await runExperimentCondition(
    datasetName,
    'full-pass',
    limit,
    memoryDataMap,
    true // includeMemory = true
  );

  const fullPassAggregates = computeAggregates(fullPassResult.testResults);

  console.log('✓ Condition B complete');
  console.log(`Experiment ID: ${fullPassResult.experimentId}`);
  if (fullPassResult.resultUrl) {
    console.log(`View results: ${fullPassResult.resultUrl}`);
  }

  // Print comparison table
  printComparisonTable(quickReadyAggregates, fullPassAggregates);

  console.log('Experiments complete. View detailed results in Opik dashboard.');
}

main().catch((error: unknown) => {
  console.error('\nMemory quality evaluation failed:');
  console.error(error instanceof Error ? error.message : String(error));
  if (error instanceof Error && error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});
