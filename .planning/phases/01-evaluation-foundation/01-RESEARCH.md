# Phase 1: Evaluation Foundation - Research

**Researched:** 2026-02-08
**Domain:** LLM Evaluation Infrastructure (Opik SDK, Datasets, Experiments, LLM-as-Judge)
**Confidence:** HIGH

## Summary

Phase 1 establishes measurement infrastructure using Opik (already installed at v1.10.8) to baseline the current v1 prompt system before making any changes. The research confirms that zero new packages are needed and that Opik provides all required capabilities: dataset management, experiment runner, heuristic metrics (ExactMatch, Contains, RegexMatch, IsJson), and LLM-as-judge metrics (AnswerRelevance, Hallucination, Moderation, Usefulness).

The critical finding is that **async tracing patterns are mandatory** to keep P95 latency overhead below 100ms. Current tracing in `lib/opik.ts` already uses async `flushOpik()` correctly, but dataset creation and offline experiments will run completely outside request paths. The codebase has chat history in `chat_messages` table and existing types in `lib/soulprint/types.ts` that can be reused for dataset creation.

**Primary recommendation:** Build dataset extraction from `chat_messages`, create experiment runner CLI script, implement 3 custom LLM-as-judge scorers (personality consistency, factuality, tone matching), and record baseline metrics before any prompt changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opik | ^1.10.8 | LLM evaluation & observability | Already installed, TypeScript SDK with datasets/experiments/metrics |
| @supabase/supabase-js | ^2.93.1 | Database access for chat history | Already installed, needed to extract chat messages for datasets |
| zod | ^4.3.6 | Schema validation for evaluation items | Already installed, ensures type safety for dataset items |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-bedrock-runtime | ^3.980.0 | LLM-as-judge model access | Already installed, use Haiku 4.5 for judge scoring (different from Sonnet 4.5 generation) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Opik | Langfuse, Weights & Biases, custom eval | Opik already integrated, TypeScript SDK mature, zero setup cost |
| Haiku 4.5 for judging | GPT-4 via OpenAI | Haiku cheaper, same model family bias exists either way, research shows use different family than generation |
| Supabase for storage | JSON files, CSV exports | Supabase already integrated, RLS policies protect PII, consistent with codebase patterns |

**Installation:**
```bash
# No new packages needed - all dependencies already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── evaluation/              # NEW: Evaluation infrastructure
│   ├── datasets.ts         # Dataset creation from chat_messages
│   ├── experiments.ts      # Experiment runner logic
│   ├── judges.ts           # Custom LLM-as-judge scorers
│   └── baseline.ts         # Baseline metric recording
scripts/
├── create-eval-dataset.ts  # CLI: Extract anonymized chat data → Opik dataset
├── run-experiment.ts       # CLI: Run offline experiment with prompt variants
└── record-baseline.ts      # CLI: Establish v1 baseline metrics
```

### Pattern 1: Dataset Creation from Production Data
**What:** Extract chat messages from Supabase, anonymize PII, format as Opik dataset items
**When to use:** Creating evaluation datasets from real user conversations
**Example:**
```typescript
// Source: Opik TypeScript SDK docs + Supabase patterns
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getOpikClient } from '@/lib/opik';

type ChatEvalItem = {
  user_message: string;
  assistant_response: string;
  soulprint_sections: {
    soul: Record<string, unknown> | null;
    identity: Record<string, unknown> | null;
    user: Record<string, unknown> | null;
  };
  expected_personality_traits: string[];
  metadata: {
    conversation_id: string;
    message_pair_id: string;
    user_id_hash: string; // Anonymized
  };
};

async function extractChatDataset(limit: number = 100): Promise<void> {
  const supabase = getSupabaseAdmin();
  const opik = getOpikClient();
  if (!opik) throw new Error('OPIK_API_KEY not configured');

  // Fetch chat message pairs with soulprint context
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, user_id, role, content, created_at, conversation_id')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Fetch pairs

  // Fetch user profiles for soulprint sections
  const userIds = [...new Set(messages?.map(m => m.user_id) || [])];
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('user_id, soul_md, identity_md, user_md')
    .in('user_id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

  // Pair user/assistant messages and format as dataset items
  const items: ChatEvalItem[] = [];
  for (let i = 0; i < (messages?.length || 0) - 1; i++) {
    const userMsg = messages![i];
    const assistantMsg = messages![i + 1];
    if (userMsg.role !== 'user' || assistantMsg.role !== 'assistant') continue;

    const profile = profileMap.get(userMsg.user_id);
    items.push({
      user_message: userMsg.content,
      assistant_response: assistantMsg.content,
      soulprint_sections: {
        soul: profile?.soul_md ? JSON.parse(profile.soul_md) : null,
        identity: profile?.identity_md ? JSON.parse(profile.identity_md) : null,
        user: profile?.user_md ? JSON.parse(profile.user_md) : null,
      },
      expected_personality_traits: extractTraits(profile?.soul_md),
      metadata: {
        conversation_id: userMsg.conversation_id,
        message_pair_id: `${userMsg.id}_${assistantMsg.id}`,
        user_id_hash: hashUserId(userMsg.user_id), // SHA256 for anonymization
      },
    });
  }

  // Create Opik dataset
  const dataset = await opik.getOrCreateDataset<ChatEvalItem>(
    'chat-evaluation-v1',
    'Anonymized chat message pairs for prompt evaluation'
  );

  await dataset.insert(items.map((item, idx) => ({
    id: item.metadata.message_pair_id,
    ...item,
  })));

  console.log(`Created dataset with ${items.length} items`);
}
```

### Pattern 2: Custom LLM-as-Judge Scorer
**What:** Implement custom scoring rubrics for personality consistency, factuality, tone matching
**When to use:** Evaluating subjective qualities not covered by built-in metrics
**Example:**
```typescript
// Source: Opik evaluation patterns + LLM-as-judge best practices
import { bedrockChatJSON } from '@/lib/bedrock';

interface PersonalityConsistencyScore {
  score: number; // 0.0-1.0
  reasoning: string;
  violations: string[];
}

async function scorePersonalityConsistency(
  userMessage: string,
  assistantResponse: string,
  expectedTraits: string[],
  soulprintSections: Record<string, unknown>
): Promise<PersonalityConsistencyScore> {
  // Use Haiku 4.5 as judge (different from Sonnet 4.5 generation to avoid self-preference bias)
  const judgePrompt = `You are evaluating whether an AI assistant's response matches the expected personality profile.

EXPECTED PERSONALITY TRAITS:
${expectedTraits.map(t => `- ${t}`).join('\n')}

SOULPRINT CONTEXT:
${JSON.stringify(soulprintSections, null, 2)}

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse}

Evaluate on a scale of 0.0 (completely inconsistent) to 1.0 (perfectly consistent):
- Does the response match the communication style?
- Does the tone align with preferences?
- Are personality traits reflected naturally?
- Are boundaries respected?

Respond with JSON:
{
  "score": 0.85,
  "reasoning": "Response matches casual tone and directness, but could be more concise per depth_preference.",
  "violations": ["Response was 3 paragraphs when user prefers brevity"]
}`;

  const result = await bedrockChatJSON<PersonalityConsistencyScore>({
    model: 'HAIKU_45', // Different model family than generation
    system: 'You are an expert AI evaluator. Be objective and precise.',
    messages: [{ role: 'user', content: judgePrompt }],
    maxTokens: 1024,
    temperature: 0.1, // Low temp for consistent judging
  });

  return result;
}
```

### Pattern 3: Offline Experiment Runner
**What:** Compare prompt variants with aggregate scores across dataset
**When to use:** A/B testing prompt changes before deploying to production
**Example:**
```typescript
// Source: Opik experiment patterns + evaluation best practices
import { evaluate, EvaluationTask } from 'opik';
import { ExactMatch } from 'opik/evaluation';

async function runPromptExperiment(
  datasetName: string,
  promptVariants: Array<{ name: string; buildPrompt: (item: ChatEvalItem) => string }>
): Promise<void> {
  const opik = getOpikClient();
  if (!opik) throw new Error('OPIK_API_KEY not configured');

  const dataset = await opik.getDataset<ChatEvalItem>(datasetName);

  for (const variant of promptVariants) {
    console.log(`Running experiment: ${variant.name}`);

    const task: EvaluationTask<ChatEvalItem> = async (item) => {
      const systemPrompt = variant.buildPrompt(item);

      const response = await bedrockChat({
        model: 'SONNET_45',
        system: systemPrompt,
        messages: [{ role: 'user', content: item.user_message }],
        maxTokens: 4096,
      });

      return {
        output: response,
        metadata: { prompt_version: variant.name },
      };
    };

    // Run evaluation with custom judges
    const result = await evaluate({
      dataset,
      task,
      scoringMetrics: [
        new PersonalityConsistencyJudge(),
        new FactualityJudge(),
        new ToneMatchingJudge(),
      ],
      experimentName: `prompt-experiment-${variant.name}-${Date.now()}`,
    });

    console.log(`${variant.name} results:`, {
      experimentId: result.experimentId,
      url: result.resultUrl,
    });
  }
}
```

### Pattern 4: Async Tracing with Minimal Overhead
**What:** Use fire-and-forget async tracing that doesn't block request response
**When to use:** Production tracing to avoid latency impact
**Example:**
```typescript
// Source: Current lib/opik.ts + async tracing best practices
export async function flushOpik() {
  const client = getOpikClient();
  if (client) {
    // Already async - just ensure caller doesn't await in request path
    await client.flush();
  }
}

// GOOD: Fire-and-forget in production
if (opikTrace) {
  opikTrace.end();
  flushOpik().catch(() => {}); // No await, log errors silently
}

// BAD: Blocking request
if (opikTrace) {
  opikTrace.end();
  await flushOpik(); // Adds 50-150ms to every request
}
```

### Anti-Patterns to Avoid
- **Synchronous tracing in request path:** Always use async `.catch()` pattern, never `await` in hot path
- **Self-judging (same model family):** Don't use Sonnet 4.5 to judge Sonnet 4.5 outputs (self-preference bias)
- **Length bias in judging:** Explicitly instruct judge not to favor longer responses
- **Testing with synthetic data only:** Use real anonymized production data for realistic evaluation
- **Single-point evaluations:** Always aggregate across 20-100+ samples for statistical significance

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dataset management | Custom JSON file storage, CSV exports | Opik datasets with TypeScript SDK | Automatic deduplication, versioning, web UI, type safety |
| Experiment tracking | Custom logging, spreadsheets | Opik experiments with `evaluate()` | Parallel execution, aggregate scoring, result URLs, reproducibility |
| LLM-as-judge prompts | Ad-hoc prompting per evaluation | Opik's built-in judges + custom scorers | Research-backed rubrics, consistent format, comparison to human baseline |
| Anonymization | Custom PII regex, manual redaction | SHA256 hashing + Supabase RLS | Cryptographic security, reversible for debugging, consistent with auth patterns |
| Baseline metric storage | Hardcoded values, comments, docs | Opik experiments marked as "baseline" | Versioned, queryable, linked to specific prompt versions, trend analysis |

**Key insight:** Evaluation infrastructure has non-obvious failure modes (length bias, sampling bias, self-preference bias, inter-rater reliability). Use battle-tested tools and research-backed patterns rather than building from scratch.

## Common Pitfalls

### Pitfall 1: Synchronous Tracing Latency
**What goes wrong:** Adding `await flushOpik()` in request path adds 50-150ms P95 latency
**Why it happens:** Developers assume observability must be synchronous for data integrity
**How to avoid:** Use fire-and-forget pattern: `flushOpik().catch(() => {})` with no await
**Warning signs:** P95 latency increases after enabling tracing, timeout errors under load

### Pitfall 2: Self-Preference Bias in LLM-as-Judge
**What goes wrong:** Using same model to judge its own outputs produces inflated scores (research shows 5-15% higher than human agreement)
**Why it happens:** Models favor their own generation style, phrasing patterns, reasoning structure
**How to avoid:** Use different model family for judging (Haiku 4.5 to judge Sonnet 4.5, or GPT-4 to judge Claude)
**Warning signs:** Judge scores consistently higher than human ratings, poor correlation with user satisfaction

### Pitfall 3: Length Bias in Evaluations
**What goes wrong:** LLM judges favor longer responses regardless of quality (research shows 10-20% bias toward verbose answers)
**Why it happens:** More text → more information → appears more helpful to judge
**How to avoid:** Explicitly instruct judge: "Do not favor longer responses. Conciseness is a virtue. Judge based on quality, not quantity."
**Warning signs:** Verbose prompt variants score higher despite user complaints about wordiness

### Pitfall 4: Insufficient Sample Size
**What goes wrong:** Running experiments on <20 items produces unreliable conclusions (statistical noise dominates signal)
**Why it happens:** Dataset creation is tedious, developers want quick results
**How to avoid:** Require minimum 50 samples per experiment, ideally 100+ for high-stakes decisions
**Warning signs:** Experiment results flip when adding 10 more samples, high variance between runs

### Pitfall 5: Dataset Staleness
**What goes wrong:** Evaluating on 6-month-old data produces misleading metrics (user preferences drift, edge cases evolve)
**Why it happens:** Dataset creation is manual, no automation for refreshing
**How to avoid:** Create CLI script (`scripts/create-eval-dataset.ts`) that's run monthly, version datasets by extraction date
**Warning signs:** Production behavior differs from evaluation predictions, edge cases not caught by evals

### Pitfall 6: PII Leakage in Evaluation Data
**What goes wrong:** Evaluation datasets contain user names, emails, locations violating privacy
**Why it happens:** Direct export from production DB without anonymization
**How to avoid:** Hash user IDs with SHA256, redact PII from message content, use Supabase RLS in dataset extraction
**Warning signs:** Real names/emails in Opik UI, compliance audit failures

## Code Examples

Verified patterns from official sources:

### Dataset Creation with Anonymization
```typescript
// Source: Opik TypeScript SDK + privacy best practices
import { createHash } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getOpikClient } from '@/lib/opik';

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

async function createEvaluationDataset(limit: number = 100): Promise<string> {
  const supabase = getSupabaseAdmin();
  const opik = getOpikClient();
  if (!opik) throw new Error('OPIK_API_KEY required');

  // Fetch user/assistant message pairs
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, user_id, role, content, created_at, conversation_id')
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (!messages) throw new Error('No messages found');

  // Pair messages and anonymize
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i];
    const assistant = messages[i + 1];
    if (user.role === 'user' && assistant.role === 'assistant') {
      pairs.push({
        id: `${user.id}_${assistant.id}`,
        user_message: user.content,
        assistant_response: assistant.content,
        metadata: {
          user_id_hash: hashUserId(user.user_id),
          conversation_id: user.conversation_id,
        },
      });
    }
  }

  const dataset = await opik.getOrCreateDataset<typeof pairs[0]>(
    `chat-eval-${new Date().toISOString().split('T')[0]}`,
    'Anonymized chat pairs for prompt evaluation'
  );

  await dataset.insert(pairs);
  console.log(`Created dataset with ${pairs.length} items`);
  return dataset.name;
}
```

### Custom LLM-as-Judge Implementation
```typescript
// Source: LLM-as-judge best practices + Opik patterns
import { bedrockChatJSON } from '@/lib/bedrock';

interface JudgeScore {
  score: number; // 0.0-1.0
  reasoning: string;
  confidence: number; // 0.0-1.0
}

async function judgePersonalityConsistency(
  input: string,
  output: string,
  expectedTraits: string[]
): Promise<JudgeScore> {
  const prompt = `Evaluate if this AI response matches the expected personality traits.

EXPECTED TRAITS: ${expectedTraits.join(', ')}

USER INPUT: ${input}

AI RESPONSE: ${output}

CRITICAL: Do NOT favor longer responses. Judge based on trait alignment, not length.

Respond with JSON:
{
  "score": 0.85,
  "reasoning": "Response is direct and concise, matching expected communication style. Shows appropriate humor.",
  "confidence": 0.9
}

Score scale:
- 1.0: Perfect trait alignment
- 0.7-0.9: Good alignment with minor deviations
- 0.4-0.6: Mixed - some traits match, others don't
- 0.0-0.3: Poor alignment, contradicts expected personality`;

  return bedrockChatJSON<JudgeScore>({
    model: 'HAIKU_45', // Different from Sonnet 4.5 generation
    system: 'You are an objective AI evaluator. Be precise and unbiased.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 512,
    temperature: 0.1, // Low temp for consistency
  });
}
```

### Experiment Runner with Aggregate Scoring
```typescript
// Source: Opik evaluation guide
import { evaluate, EvaluationTask } from 'opik';

async function runBaselineExperiment(datasetName: string): Promise<void> {
  const opik = getOpikClient();
  if (!opik) throw new Error('OPIK_API_KEY required');

  const dataset = await opik.getDataset(datasetName);

  const task: EvaluationTask<ChatEvalItem> = async (item) => {
    // Use current v1 prompt system
    const response = await generateWithV1Prompts(
      item.user_message,
      item.soulprint_sections
    );

    return { output: response };
  };

  const result = await evaluate({
    dataset,
    task,
    scoringMetrics: [
      // Custom judges
      { name: 'personality_consistency', fn: judgePersonalityConsistency },
      { name: 'factuality', fn: judgeFactuality },
      { name: 'tone_matching', fn: judgeToneMatching },
    ],
    experimentName: 'baseline-v1-prompts',
  });

  console.log('Baseline recorded:', result.resultUrl);

  // Store baseline metrics for comparison
  await recordBaseline({
    version: 'v1',
    experimentId: result.experimentId,
    timestamp: new Date().toISOString(),
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual eval spreadsheets | Automated experiment runners with LLM judges | 2024 | 10x faster iteration, reproducible results |
| Same model for generation + judging | Different model families (avoid self-preference) | 2025 | 5-15% closer human agreement |
| Synchronous tracing | Async fire-and-forget tracing | 2023 | <100ms P95 latency overhead |
| Single-point evaluations | Statistical aggregation across 50-100+ samples | 2024 | Reliable conclusions, catch edge cases |
| JSON exports for datasets | Dataset management platforms (Opik, Langfuse) | 2024 | Versioning, deduplication, web UI |

**Deprecated/outdated:**
- **OpenAI Evals framework (Python):** Now use Opik TypeScript SDK for type safety and Next.js compatibility
- **Synchronous tracing with `.trace()` blocking calls:** Use async `.flush()` patterns
- **Regex-based PII redaction:** Use SHA256 hashing for reversible anonymization

## Open Questions

1. **Human Agreement Baseline**
   - What we know: Research shows 70-85% LLM-judge to human agreement is achievable
   - What's unclear: Our specific domain (personality consistency in personalized AI) may differ
   - Recommendation: Run small human labeling study (20-30 samples) to validate judge rubrics, adjust if agreement <70%

2. **Sampling Strategy for Production Tracing**
   - What we know: 100% tracing adds latency, sampling reduces overhead
   - What's unclear: Optimal sampling rate for our traffic patterns (currently low volume)
   - Recommendation: Start with 100% sampling (low traffic), implement adaptive sampling when >1000 req/day

3. **Dataset Refresh Cadence**
   - What we know: Stale data produces misleading evals, manual refresh is tedious
   - What's unclear: How quickly user preferences drift in our domain
   - Recommendation: Start with monthly refresh, monitor eval/production divergence, adjust cadence if needed

4. **Judge Model Selection**
   - What we know: Need different family than Sonnet 4.5 generation to avoid self-preference
   - What's unclear: Haiku 4.5 vs GPT-4o vs GPT-4 mini for judging tradeoffs
   - Recommendation: Start with Haiku 4.5 (cost-effective, different from Sonnet), validate with small GPT-4o comparison

## Sources

### Primary (HIGH confidence)
- [Opik TypeScript SDK - Datasets](https://www.comet.com/docs/opik/reference/typescript-sdk/evaluation/datasets)
- [Opik TypeScript SDK - Quick Start](https://www.comet.com/docs/opik/reference/typescript-sdk/evaluation/quick-start)
- [Opik Evaluation Metrics](https://www.comet.com/docs/opik/reference/typescript-sdk/evaluation/metrics)
- [Opik GitHub Repository](https://github.com/comet-ml/opik)
- Existing codebase: `lib/opik.ts`, `lib/soulprint/types.ts`, `app/api/chat/route.ts`

### Secondary (MEDIUM confidence)
- [LLM-as-a-Judge: The Complete Guide](https://www.confident-ai.com/blog/why-llm-as-a-judge-is-the-best-llm-evaluation-method)
- [LLM-as-a-judge: Complete Guide - Evidently AI](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [Hugging Face LLM Judge Cookbook](https://huggingface.co/learn/cookbook/en/llm_judge)
- [LLM Evaluation Metrics Guide - Comet](https://www.comet.com/site/blog/llm-evaluation-guide/)
- [Building an LLM Evaluation Framework - Datadog](https://www.datadoghq.com/blog/llm-evaluation-framework-best-practices/)
- [Data Anonymization Techniques for LLMs](https://www.protecto.ai/blog/data-anonymization-techniques-for-secure-llm-utilization/)
- [OpenTelemetry Traces & Spans - OneUptime](https://oneuptime.com/blog/post/2025-08-27-traces-and-spans-in-opentelemetry/view)
- [Distributed Tracing Best Practices](https://www.atatus.com/blog/distributed-tracing-best-practices-for-microservices/)

### Tertiary (LOW confidence)
- [LLM Evaluation Landscape 2026](https://research.aimultiple.com/llm-eval-tools/)
- [Best LLM Evaluation Tools 2026 - Medium](https://medium.com/online-inference/the-best-llm-evaluation-tools-of-2026-40fd9b654dce)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All packages already installed, TypeScript SDK well-documented
- Architecture: HIGH - Opik patterns verified in official docs, async tracing confirmed in research
- Pitfalls: HIGH - Self-preference bias, length bias, latency overhead documented in multiple sources
- Judge rubrics: MEDIUM - Personality consistency metrics less researched than factuality/hallucination
- Human agreement targets: MEDIUM - 70% threshold is industry standard but domain-specific validation needed

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, Opik SDK mature)
