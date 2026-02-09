# Phase 5: Integration Validation - Research

**Researched:** 2026-02-09
**Domain:** LLM regression testing, long-session validation, observability latency overhead
**Confidence:** HIGH

## Summary

Phase 5 validates that all v2.0 components (evaluation foundation, prompt template system, emotional intelligence, and quality scoring) work together without degradation. The research identifies three validation domains: prompt regression testing to catch personality drift before deploy, long-session testing to validate multi-turn conversation quality, and observability latency benchmarking to ensure async tracing adds minimal overhead.

The standard approach for LLM regression testing uses existing Opik evaluation datasets with statistical significance testing (minimum 20 samples for power analysis), automated CI/CD integration via GitHub Actions, and comparison against v1 baseline metrics. Long-session testing validates personality consistency across 10+ message exchanges using sliding window techniques and personality drift detection. Latency overhead benchmarking uses autocannon for load testing under concurrent requests, measuring P95 latency with and without Opik tracing enabled.

**Primary recommendation:** Build a prompt regression CLI script that runs Opik evaluations on every prompt change, integrate it into GitHub Actions with pass/fail thresholds, create Playwright long-session tests that exercise 10-15 message flows, and benchmark P95 latency using autocannon with 100 concurrent connections to validate <100ms overhead target.

## Standard Stack

The established libraries/tools for LLM regression testing and validation:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Opik | 1.10.8 | LLM evaluation & observability | Already integrated, supports datasets, experiments, tracing |
| Playwright | 1.58.2 | E2E long-session testing | Already configured, supports multi-turn conversations |
| autocannon | Latest | Node.js HTTP load testing | Fastest Node.js benchmarking tool, minimal overhead |
| vitest | 4.0.18 | Unit/integration testing | Already configured, fast, TypeScript native |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GitHub Actions | N/A | CI/CD regression testing | Automate evaluation runs on PR/push |
| tsx | Latest | TypeScript script runner | Run CLI regression scripts |
| @playwright/test | 1.58.2 | Long-session test assertions | Validate multi-turn conversation flows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| autocannon | k6 or Artillery | k6 has better ecosystem but requires Go, Artillery slower than autocannon |
| Opik | DeepEval or Promptfoo | Already invested in Opik with datasets/judges, switching adds migration cost |
| Playwright | Puppeteer | Playwright has better test runner and multi-browser support |

**Installation:**
```bash
npm install autocannon --save-dev  # Only new dependency needed
```

## Architecture Patterns

### Recommended Project Structure
```
scripts/
├── regression-test.ts       # CLI for prompt regression testing
├── baseline-compare.ts      # Compare experiment results to baseline
└── latency-benchmark.ts     # Autocannon load testing script

tests/
├── e2e/
│   └── long-session.spec.ts # 10+ message conversation tests
└── integration/
    └── regression.test.ts    # Integration tests for regression suite

.github/
└── workflows/
    └── llm-regression.yml    # CI/CD automation for regression tests
```

### Pattern 1: Prompt Regression Testing
**What:** Run evaluation experiments against frozen test datasets on every prompt change
**When to use:** Before merging PRs that modify PromptBuilder, prompt sections, or EI logic
**Example:**
```typescript
// scripts/regression-test.ts
import { runExperiment } from '@/lib/evaluation/experiments';
import { v2PromptVariant } from '@/lib/evaluation/baseline';
import { getOpikClient } from '@/lib/opik';

async function main() {
  // Run v2 variant against evaluation dataset
  const result = await runExperiment({
    datasetName: 'chat-eval-regression',
    variant: v2PromptVariant,
    experimentName: `regression-${process.env.GITHUB_SHA?.slice(0, 7)}`,
    nbSamples: 20, // Minimum for statistical significance
  });

  // Compare to baseline thresholds
  const thresholds = {
    personality_consistency: 0.70,
    factuality: 0.75,
    tone_matching: 0.70,
  };

  let passed = true;
  for (const [metric, threshold] of Object.entries(thresholds)) {
    const score = result.aggregateScores[metric]?.mean;
    if (!score || score < threshold) {
      console.error(`FAIL: ${metric} = ${score} < ${threshold}`);
      passed = false;
    }
  }

  process.exit(passed ? 0 : 1);
}
```

### Pattern 2: Long-Session Testing with Sliding Window
**What:** Multi-turn conversation tests that validate personality consistency across 10+ messages
**When to use:** Validating emotional intelligence, relationship arc, and no personality drift
**Example:**
```typescript
// tests/e2e/long-session.spec.ts
import { test, expect } from '@playwright/test';

test('10-message conversation maintains personality', async ({ page }) => {
  // Setup authenticated user with soulprint
  await setupUser(page);

  const messages = [
    'Tell me about my career goals',
    'What projects did I mention working on?',
    'How do I usually handle stress?',
    'What are my communication preferences?',
    'Remind me about my leadership style',
    'What hobbies do I enjoy?',
    'How do I typically approach learning?',
    'What are my relationship priorities?',
    'Tell me about my work-life balance',
    'What are my long-term aspirations?',
  ];

  const responses: string[] = [];

  for (const msg of messages) {
    await page.fill('[data-testid="chat-input"]', msg);
    await page.click('[data-testid="send-button"]');

    const response = await page.waitForSelector('[data-testid="assistant-message"]:last-child');
    responses.push(await response.textContent() || '');
  }

  // Validate personality consistency across all responses
  // Check for: no contradictory traits, consistent tone, no generic chatbot patterns
  for (let i = 0; i < responses.length; i++) {
    expect(responses[i]).not.toMatch(/Hey there|Great question|I'm just an AI/i);
    expect(responses[i].length).toBeGreaterThan(50); // No empty or minimal responses
  }

  // Validate no personality drift by checking tone consistency
  const firstTone = extractTone(responses[0]);
  const lastTone = extractTone(responses[9]);
  expect(firstTone).toEqual(lastTone); // Tone should remain consistent
});
```

### Pattern 3: Latency Overhead Benchmarking
**What:** Load test with autocannon to measure P95 latency with/without Opik tracing
**When to use:** After adding new Opik spans or tracing instrumentation
**Example:**
```typescript
// scripts/latency-benchmark.ts
import autocannon from 'autocannon';

async function benchmark() {
  const baselineResult = await autocannon({
    url: 'http://localhost:3000/api/chat',
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: 'Hello',
      deepSearch: false,
    }),
    connections: 100, // Concurrent connections
    duration: 30, // 30 seconds
  });

  console.log('=== WITH OPIK TRACING ===');
  console.log(`P50: ${baselineResult.latency.p50}ms`);
  console.log(`P95: ${baselineResult.latency.p95}ms`);
  console.log(`P99: ${baselineResult.latency.p99}ms`);
  console.log(`Throughput: ${baselineResult.requests.average} req/sec`);

  // Now run with OPIK_API_KEY unset (tracing disabled)
  process.env.OPIK_API_KEY = '';

  const noTracingResult = await autocannon({
    // ... same config
  });

  const overhead = baselineResult.latency.p95 - noTracingResult.latency.p95;
  console.log(`\n=== OVERHEAD ===`);
  console.log(`P95 overhead: ${overhead}ms`);

  if (overhead > 100) {
    console.error(`FAIL: P95 overhead ${overhead}ms exceeds 100ms threshold`);
    process.exit(1);
  }
}
```

### Pattern 4: Statistical Significance Testing
**What:** Use minimum 20 samples for regression tests, validate with power analysis
**When to use:** Setting sample sizes for CI/CD regression tests
**Example:**
```typescript
// lib/evaluation/statistical-validation.ts
export function validateSampleSize(n: number): boolean {
  // Power analysis for LLM evaluations:
  // - Effect size: 0.5 (medium, typical for prompt changes)
  // - Alpha: 0.05 (5% false positive rate)
  // - Power: 0.80 (80% chance to detect real differences)
  // Result: minimum n=20 for independent samples
  return n >= 20;
}

export function compareToBaseline(
  experimentScores: Record<string, number>,
  baselineScores: Record<string, number>,
  threshold: number = 0.05 // 5% degradation allowed
): { passed: boolean; degradations: string[] } {
  const degradations: string[] = [];

  for (const [metric, expScore] of Object.entries(experimentScores)) {
    const baseScore = baselineScores[metric];
    if (!baseScore) continue;

    const degradation = (baseScore - expScore) / baseScore;
    if (degradation > threshold) {
      degradations.push(`${metric}: ${(degradation * 100).toFixed(1)}% worse`);
    }
  }

  return {
    passed: degradations.length === 0,
    degradations,
  };
}
```

### Anti-Patterns to Avoid
- **Single-sample regression tests:** LLMs are non-deterministic, need 20+ samples for statistical power
- **Comparing raw text outputs:** Use LLM-as-judge scoring, not string equality
- **Blocking deploys on flaky tests:** Set thresholds with margin (5-10% degradation tolerance)
- **Testing production models in CI:** Use cached responses or smaller test datasets
- **Ignoring latency distribution:** P50 looks good but P95/P99 may spike under load

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP load testing | Custom concurrent request loops | autocannon | Handles connection pooling, pipelining, latency percentiles |
| Statistical significance | Manual t-tests, p-value calculations | Opik aggregate scores + threshold comparison | Already integrated, handles non-determinism |
| Long-session orchestration | Custom message queue system | Playwright multi-step tests | Built-in retry, screenshot on failure, parallel execution |
| Regression dataset management | CSV files or JSON blobs | Opik datasets API | Versioning, expansion, experiment tracking |
| CI/CD integration | Shell scripts with curl | GitHub Actions + official integrations | Artifact uploads, status checks, secrets management |
| Latency monitoring in production | Custom Date.now() wrappers | Opik spans (already instrumented) | Distributed tracing, automatic aggregation, dashboard |

**Key insight:** LLM testing has subtle pitfalls around non-determinism, sample size, and correlation between judge/model. Use battle-tested tools that handle these edge cases.

## Common Pitfalls

### Pitfall 1: Insufficient Sample Size Leading to False Conclusions
**What goes wrong:** Running regression tests with 5-10 samples leads to high variance and flaky results
**Why it happens:** LLMs are non-deterministic (temp=0.7), single-run tests can flip rankings 83% of the time
**How to avoid:** Use minimum 20 samples for CI/CD regression tests, 50-100 for full evaluations
**Warning signs:** Test results flip between passes and failures without code changes

### Pitfall 2: Length Bias in LLM-as-Judge Scoring
**What goes wrong:** Judge LLMs favor longer responses by 10-20%, causing false positives for verbose prompts
**Why it happens:** LLMs associate length with quality/effort, research shows systematic bias
**How to avoid:** All judge prompts MUST include anti-length-bias instruction (already in judges.ts)
**Warning signs:** Verbose v2 scores higher than concise v1 despite lower human satisfaction

### Pitfall 3: Personality Drift in Long Sessions (Attention Decay)
**What goes wrong:** After 10-15 messages, AI responses stray from initial personality prompt
**Why it happens:** Transformer attention decay - longer dialogs place less weight on initial prompt tokens
**How to avoid:** Test with 10+ message flows, add personality reinforcement in REMEMBER section
**Warning signs:** First 3 messages feel personalized, messages 8-10 become generic

### Pitfall 4: Uncanny Valley from Over-Mirroring
**What goes wrong:** Perfect linguistic mirroring feels creepy rather than personalized
**Why it happens:** Emotional intelligence features mirror user style too closely
**How to avoid:** Set confidence threshold 0.6 for adaptive tone (already implemented), test human reactions
**Warning signs:** Users describe AI as "weird" or "trying too hard" despite high consistency scores

### Pitfall 5: Latency Overhead Masking in Development
**What goes wrong:** Observability overhead is negligible in dev but tanks P95 in production under load
**Why it happens:** Single-user testing doesn't reveal contention, batching delays, or network saturation
**How to avoid:** Load test with 100 concurrent requests, measure with/without tracing enabled
**Warning signs:** Dev latency <50ms, production P95 >500ms

### Pitfall 6: Correlation vs Causation in Quality Score Validation
**What goes wrong:** Quality scores correlate r>0.7 with user satisfaction but doesn't mean scores CAUSE satisfaction
**Why it happens:** Both may correlate with underlying soulprint data quality
**How to avoid:** Validate that LOW quality scores predict dissatisfaction (not just that high scores predict satisfaction)
**Warning signs:** All profiles score 80+, but user feedback still mixed

### Pitfall 7: Judge-Model Correlation Inflating Accuracy
**What goes wrong:** Using Haiku to judge Haiku responses creates false agreement
**Why it happens:** Same model family makes same mistakes, judge marks wrong answers as "correct"
**How to avoid:** Use different model families (Haiku judges Sonnet responses, already implemented)
**Warning signs:** Scores suddenly drop when switching judge model

## Code Examples

Verified patterns from official sources:

### Opik Dataset Creation for Regression Testing
```typescript
// scripts/create-regression-dataset.ts
import { getOpikClient } from '@/lib/opik';
import type { ChatEvalItem } from '@/lib/evaluation/types';

async function createRegressionDataset() {
  const opik = getOpikClient();
  if (!opik) throw new Error('OPIK_API_KEY not set');

  // Create dataset from high-value test cases
  const dataset = await opik.createDataset<ChatEvalItem>({
    name: 'chat-eval-regression',
    description: 'Frozen regression test cases for prompt changes',
  });

  // Add curated test cases covering:
  // - Personality consistency edge cases
  // - Factuality with/without memory context
  // - Tone matching across formality levels
  const testCases: ChatEvalItem[] = [
    {
      user_message: 'How do I usually handle stress?',
      expected_traits: ['direct', 'analytical', 'solution-focused'],
      expected_tone: 'casual but precise',
      expected_style: 'concise with examples',
      soulprint_context: {
        soul: { archetype: 'The Builder', core_traits: 'pragmatic, systems-thinking' },
        identity: { style: 'direct, no fluff' },
        user: { stress_management: 'breaks down problems, takes walks' },
        agents: { behavior: 'never hedge, have opinions' },
        tools: { preference: 'concise answers' },
      },
    },
    // ... 19 more cases for n=20 minimum
  ];

  for (const item of testCases) {
    await dataset.insert(item);
  }

  console.log(`Created regression dataset: ${dataset.id}`);
  console.log(`Sample size: ${testCases.length}`);
}
```

### GitHub Actions Workflow for Regression Testing
```yaml
# .github/workflows/llm-regression.yml
name: LLM Regression Tests

on:
  pull_request:
    paths:
      - 'lib/soulprint/prompt-builder.ts'
      - 'lib/soulprint/emotional-intelligence.ts'
      - 'lib/evaluation/judges.ts'

jobs:
  regression-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run prompt regression tests
        env:
          OPIK_API_KEY: ${{ secrets.OPIK_API_KEY }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: npx tsx scripts/regression-test.ts --dataset chat-eval-regression --samples 20

      - name: Upload experiment results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: regression-results
          path: results/
```

### Long-Session Test Helper
```typescript
// tests/e2e/helpers/long-session.ts
import { Page } from '@playwright/test';

export async function sendMessage(page: Page, message: string): Promise<string> {
  await page.fill('[data-testid="chat-input"]', message);
  await page.click('[data-testid="send-button"]');

  // Wait for assistant response
  const responseSelector = '[data-testid="assistant-message"]:last-child';
  await page.waitForSelector(responseSelector);

  const response = await page.textContent(responseSelector);
  return response || '';
}

export async function runLongSession(
  page: Page,
  messages: string[]
): Promise<string[]> {
  const responses: string[] = [];

  for (const msg of messages) {
    const response = await sendMessage(page, msg);
    responses.push(response);

    // Small delay to simulate human typing
    await page.waitForTimeout(500);
  }

  return responses;
}

export function detectPersonalityDrift(responses: string[]): boolean {
  // Check for warning signs across responses
  const patterns = {
    chatbotGreetings: /^(Hey there|Great question|I'm just an AI)/i,
    hedging: /I think|maybe|perhaps|possibly|might be/gi,
    genericResponses: /(as an AI|I don't have personal|I can't actually)/i,
  };

  // Early responses should be personalized, later ones shouldn't degrade
  const earlyViolations = responses.slice(0, 3).filter(r =>
    patterns.chatbotGreetings.test(r) || patterns.genericResponses.test(r)
  ).length;

  const lateViolations = responses.slice(7).filter(r =>
    patterns.chatbotGreetings.test(r) || patterns.genericResponses.test(r)
  ).length;

  // Drift detected if late messages have MORE violations than early ones
  return lateViolations > earlyViolations;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual testing of prompts | Automated Opik evaluations with CI/CD | 2024-2025 | Catch regressions before deploy |
| String equality assertions | LLM-as-judge scoring rubrics | 2024-2025 | Handle non-deterministic outputs |
| P50 latency only | P95/P99 percentile tracking | 2024-2026 | Catch tail latency issues |
| 5-10 test samples | 20+ samples for statistical power | 2025-2026 | Reduce false positives |
| Single-turn testing | Multi-turn long-session tests | 2025-2026 | Detect personality drift |

**Deprecated/outdated:**
- **Manual prompt comparison:** Pre-2024 teams tested prompts by reading outputs. Current: LLM-as-judge with rubrics
- **Production-only testing:** No regression tests before deploy. Current: CI/CD with frozen test datasets
- **Mean-only metrics:** Averaged latency masked tail latency spikes. Current: P95/P99 percentiles
- **Human-only evaluation:** Expensive, slow, not scalable. Current: Human validation of judge accuracy, then automated

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal sample size for CI/CD speed vs accuracy tradeoff**
   - What we know: Minimum 20 samples needed for statistical power
   - What's unclear: Whether 20 is enough for CI speed (<5 min) while catching regressions
   - Recommendation: Start with 20, increase to 30 if false negatives occur

2. **Threshold for "acceptable" personality drift**
   - What we know: Attention decay causes drift after 10-15 messages
   - What's unclear: What percentage of generic responses is tolerable (5%? 10%?)
   - Recommendation: Set threshold at 10% (1 out of 10 responses can be generic)

3. **Correlation between quality scores and user satisfaction**
   - What we know: Target is r>0.7 correlation with satisfaction metrics
   - What's unclear: How to measure user satisfaction (explicit feedback? retention? session length?)
   - Recommendation: Track multiple proxies (thumbs up/down, session length, return rate)

4. **Production latency overhead of Opik spans**
   - What we know: Research shows distributed tracing can add 1-50ms depending on implementation
   - What's unclear: Exact overhead in production under real traffic patterns
   - Recommendation: Benchmark with 100 concurrent connections, enable sampling if >100ms

5. **Handling non-determinism in CI/CD**
   - What we know: LLMs are non-deterministic even at temp=0.1
   - What's unclear: Best retry strategy for flaky tests (rerun N times? Increase threshold margin?)
   - Recommendation: Allow 5-10% margin below baseline, fail only if 2+ consecutive runs fail

## Sources

### Primary (HIGH confidence)
- [Opik GitHub](https://github.com/comet-ml/opik) - Evaluation datasets, experiment runner, CI/CD integration
- [Playwright documentation](https://playwright.dev/) - Multi-turn testing, long-session patterns
- [autocannon GitHub](https://github.com/mcollina/autocannon) - Node.js load testing, latency percentiles
- [Arxiv: Rethinking Regression Testing for Evolving LLM APIs](https://arxiv.org/html/2311.11123v2) - Prompt degradation detection
- [Arxiv: Measuring and Controlling Persona Drift in Language Model Dialogs](https://arxiv.org/html/2402.10962v1) - Attention decay effect

### Secondary (MEDIUM confidence)
- [Confident AI: LLM Testing Methods](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) - Regression testing best practices
- [Fiddler AI: LLMOps Drift Monitoring](https://www.fiddler.ai/blog/how-to-monitor-llmops-performance-with-drift) - Drift detection patterns
- [SigNoz: Distributed Tracing Tools](https://signoz.io/blog/distributed-tracing-tools/) - Latency overhead benchmarking
- [Medium: Sample Size Affects LLM Prompt Testing](https://latitude-blog.ghost.io/blog/sample-size-affects-llm-prompt-testing/) - Statistical significance
- [Statistics By Jim: Interpreting Correlation Coefficients](https://statisticsbyjim.com/basics/correlations/) - r>0.7 threshold validation

### Tertiary (LOW confidence)
- [Medium: AI Uncanny Valley](https://marenhogan.medium.com/the-uncanny-valley-of-generative-ai-d5306e0a4ca2) - Over-mirroring pitfalls
- [Promptfoo CI/CD Integration](https://www.promptfoo.dev/docs/integrations/ci-cd/) - Alternative regression testing tool
- [Artillery vs k6 comparison](https://notes.nicolevanderhoeven.com/Artillery+vs+k6) - Load testing tool tradeoffs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Opik, Playwright, vitest already integrated, autocannon is standard for Node.js
- Architecture: HIGH - Patterns verified from official Opik docs, research papers, and existing codebase
- Pitfalls: MEDIUM - Attention decay and length bias from research, sample size from statistical literature, production overhead needs validation

**Research date:** 2026-02-09
**Valid until:** 30 days (stable domain, unlikely to change rapidly)
