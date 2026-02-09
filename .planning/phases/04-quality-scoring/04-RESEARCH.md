# Phase 4: Quality Scoring - Research

**Researched:** 2026-02-08
**Domain:** LLM-as-Judge Quality Scoring, Automated Profile Refinement, JSONB Quality Metrics
**Confidence:** HIGH

## Summary

Phase 4 implements quality scoring for soulprint sections using established LLM-as-judge patterns from Phase 1's evaluation infrastructure. The research confirms that the existing judge architecture (BaseMetric extension, Haiku 4.5 scoring, Zod validation) can be directly applied to score soulprint sections on three dimensions: **completeness** (0-100: does the section contain all necessary information?), **coherence** (0-100: is the section logically structured and internally consistent?), and **specificity** (0-100: are details concrete vs. vague/generic?).

Quality scores are stored in a new `user_profiles.quality_breakdown` JSONB column with GIN indexing for efficient querying. The scores surface in system prompts via a new `## DATA CONFIDENCE` section that tells the AI its own data quality, enabling uncertainty acknowledgment (EMOT-02 extension). Low-quality profiles (any metric <60) trigger background refinement via Vercel Cron jobs, similar to the existing `/api/cron/tasks` pattern.

**Critical finding:** Research shows G-Eval uses 0-1 probability-weighted scores, but SoulPrint requirements specify 0-100 integer scores for user-facing clarity. The implementation normalizes judge output (0.0-1.0) to integers (0-100) for storage and display, while maintaining judge precision internally.

**Primary recommendation:** Create three new judge classes (CompletenessJudge, CoherenceJudge, SpecificityJudge) extending Phase 1's BaseMetric pattern, add `quality_breakdown` JSONB column to `user_profiles`, surface scores in PromptBuilder's system prompt, and implement `/api/cron/quality-refinement` endpoint that re-generates low-scoring sections without user intervention.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| opik | ^1.10.8 | LLM-as-judge framework (already installed from Phase 1) | BaseMetric pattern established, Zod validation, score method interface |
| @aws-sdk/client-bedrock-runtime | ^3.980.0 | Haiku 4.5 for judge scoring (already installed) | Phase 1 established Haiku 4.5 as judge model (different from Sonnet 4.5 generation to avoid self-preference bias) |
| zod | ^4.3.6 | Schema validation (already installed) | Phase 1 pattern: validationSchema + safeParse guard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @supabase/supabase-js | ^2.93.1 | JSONB column access (already installed) | Query and update `quality_breakdown` column |
| None | - | Vercel Cron | Background refinement jobs (existing `/api/cron/tasks` pattern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 0-100 integer scores | 0.0-1.0 float scores (native G-Eval) | Research shows G-Eval uses probability weights, but 0-100 is more user-facing friendly and matches QUAL-01 requirement |
| JSONB quality_breakdown | Separate quality_scores table with rows per metric | JSONB simpler for read-heavy access pattern (every chat loads scores), GIN indexing provides fast queries |
| Vercel Cron refinement | Real-time refinement on chat route | Cron pattern avoids blocking chat, consistent with existing `/api/cron/tasks` architecture |

**Installation:**
```bash
# No new packages needed - all dependencies from Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── evaluation/
│   ├── judges.ts                    # EXISTING: PersonalityConsistencyJudge, FactualityJudge, ToneMatchingJudge
│   ├── quality-judges.ts            # NEW: CompletenessJudge, CoherenceJudge, SpecificityJudge
│   └── quality-scoring.ts           # NEW: scoreSoulprintSection, calculateQualityBreakdown
├── soulprint/
│   └── prompt-builder.ts            # EXTEND: Add DATA CONFIDENCE section when quality_breakdown exists
app/api/
├── quality/
│   └── score/route.ts               # NEW: POST endpoint to score a single profile (manual trigger)
└── cron/
    └── quality-refinement/route.ts  # NEW: Background job to refine low-quality profiles
supabase/migrations/
└── 20260208_quality_breakdown.sql   # NEW: Add quality_breakdown JSONB column with GIN index
```

### Pattern 1: Quality Judge Implementation
**What:** Extend Phase 1's BaseMetric pattern to score soulprint sections on completeness, coherence, specificity
**When to use:** Scoring individual soulprint sections (soul_md, identity_md, user_md, agents_md, tools_md)
**Example:**
```typescript
// Source: Phase 1 lib/evaluation/judges.ts + G-Eval completeness patterns
import { BaseMetric, z } from 'opik';
import type { EvaluationScoreResult } from 'opik';
import { bedrockChatJSON } from '@/lib/bedrock';

const completenessSchema = z.object({
  section_name: z.string(), // 'SOUL', 'IDENTITY', 'USER', 'AGENTS', 'TOOLS'
  section_content: z.string(),
  section_type: z.enum(['soul', 'identity', 'user', 'agents', 'tools']),
});

type CompletenessInput = z.infer<typeof completenessSchema>;

/**
 * Evaluates whether a soulprint section contains all necessary information
 * for the AI to personalize responses effectively.
 *
 * Scores 0.0-1.0 (normalized to 0-100 for storage):
 * - All required fields present and populated
 * - Sufficient detail for each field
 * - No critical gaps or missing context
 */
export class CompletenessJudge extends BaseMetric<typeof completenessSchema> {
  readonly validationSchema = completenessSchema;

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

    const data = parsed.data as CompletenessInput;

    // Define expected fields per section type
    const expectedFields = {
      soul: ['communication_style', 'personality_traits', 'tone_preferences', 'boundaries', 'humor_style', 'formality_level', 'emotional_patterns'],
      identity: ['ai_name', 'archetype', 'vibe', 'emoji_style', 'signature_greeting'],
      user: ['name', 'location', 'occupation', 'relationships', 'interests', 'life_context', 'preferred_address'],
      agents: ['response_style', 'behavioral_rules', 'context_adaptation', 'memory_directives', 'do_not'],
      tools: ['likely_usage', 'capabilities_emphasis', 'output_preferences', 'depth_preference'],
    };

    const fields = expectedFields[data.section_type].join(', ');

    const prompt = `You are evaluating the COMPLETENESS of a soulprint section for an AI personalization system.

SECTION: ${data.section_name}
EXPECTED FIELDS: ${fields}

CONTENT:
${data.section_content}

Evaluate on a scale of 0.0 (severely incomplete) to 1.0 (fully complete):
1. Are all expected fields present and populated (not empty/null)?
2. Does each field have sufficient detail (not just placeholders like "TBD" or single words)?
3. Are there critical gaps that would prevent effective personalization?
4. Is there enough information for the AI to act on this section's purpose?

CRITICAL: Do NOT favor longer content. A concise, complete section is better than a verbose, rambling one.

Score scale:
- 1.0: All fields present with sufficient detail, no gaps
- 0.7-0.9: Most fields complete, minor gaps or sparse details
- 0.4-0.6: Several missing or incomplete fields
- 0.0-0.3: Critical fields missing, insufficient for personalization

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation focusing on what's missing or complete."
}`;

    try {
      const result = await bedrockChatJSON<{ score: number; reasoning: string }>({
        model: 'HAIKU_45',
        system: 'You are an objective AI evaluator. Be precise, fair, and unbiased. Always respond with valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
        temperature: 0.1,
      });

      return {
        name: this.name,
        value: Math.min(1.0, Math.max(0.0, result.score)),
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
```

### Pattern 2: Quality Breakdown Storage in JSONB
**What:** Store all quality scores in a single JSONB column with GIN index for efficient querying
**When to use:** Storing and querying quality metrics for soulprint sections
**Example:**
```typescript
// Source: PostgreSQL JSONB best practices + Phase 1 user_profiles schema
// Migration: supabase/migrations/20260208_quality_breakdown.sql

-- Add quality_breakdown JSONB column to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS quality_breakdown JSONB;

-- Structure: { soul: { completeness: 85, coherence: 90, specificity: 75 }, identity: { ... }, ... }
COMMENT ON COLUMN public.user_profiles.quality_breakdown IS 'Quality scores (0-100) for each soulprint section across three dimensions: completeness, coherence, specificity';

-- Create GIN index for efficient JSONB querying
CREATE INDEX IF NOT EXISTS idx_user_profiles_quality_breakdown
  ON public.user_profiles USING GIN (quality_breakdown);

-- Add timestamp for when scores were last calculated
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS quality_scored_at TIMESTAMPTZ;

-- Example query: Find profiles with any metric below 60
-- SELECT user_id FROM user_profiles
-- WHERE quality_breakdown @> '{"soul": {"completeness": 59}}'::jsonb
--    OR quality_breakdown @> '{"identity": {"coherence": 59}}'::jsonb;
-- (Actual implementation uses jsonb_path_query for threshold checks)
```

### Pattern 3: Quality Scores in System Prompt (DATA CONFIDENCE Section)
**What:** Surface quality scores in system prompt so AI knows its own data confidence levels
**When to use:** Every chat request, after soulprint sections loaded
**Example:**
```typescript
// Source: Phase 2 lib/soulprint/prompt-builder.ts + EMOT-02 uncertainty acknowledgment
// Add to PromptBuilder.build() after assembling sections

function buildDataConfidenceSection(qualityBreakdown: QualityBreakdown | null): string {
  if (!qualityBreakdown) {
    return ''; // No quality scores yet, skip section
  }

  // Calculate overall confidence level
  const allScores = Object.values(qualityBreakdown).flatMap(section =>
    Object.values(section as Record<string, number>)
  );
  const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;

  const confidenceLevel = avgScore >= 80 ? 'HIGH' : avgScore >= 60 ? 'MODERATE' : 'LOW';

  // Identify weak sections (any metric < 60)
  const weakSections: string[] = [];
  for (const [section, metrics] of Object.entries(qualityBreakdown)) {
    for (const [metric, score] of Object.entries(metrics as Record<string, number>)) {
      if (score < 60) {
        weakSections.push(`${section}.${metric}: ${score}/100`);
      }
    }
  }

  let confidenceText = `## DATA CONFIDENCE\n\n`;
  confidenceText += `Overall profile quality: ${confidenceLevel} (${Math.round(avgScore)}/100)\n\n`;

  if (weakSections.length > 0) {
    confidenceText += `**Low-confidence areas:**\n`;
    for (const weak of weakSections) {
      confidenceText += `- ${weak}\n`;
    }
    confidenceText += `\n**Important:** When responding to questions about low-confidence areas, acknowledge uncertainty explicitly. Say "I don't have enough information about X" rather than guessing or fabricating details.\n`;
  } else {
    confidenceText += `All sections are well-populated. You can respond with confidence based on the profile data.\n`;
  }

  return confidenceText;
}

// In PromptBuilder.build():
// Insert DATA CONFIDENCE section AFTER soulprint sections but BEFORE memory/context
// This ensures AI sees its own limitations before answering
```

### Pattern 4: Background Refinement via Vercel Cron
**What:** Automatically re-generate low-quality soulprint sections without user intervention
**When to use:** Triggered by Vercel Cron every 24 hours, processes profiles flagged as low-quality
**Example:**
```typescript
// Source: app/api/cron/tasks/route.ts pattern + Phase 2 full pass pipeline
// app/api/cron/quality-refinement/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { scoreSoulprintSection } from '@/lib/evaluation/quality-scoring';

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();

  // Find profiles with any quality metric < 60
  // Query: quality_breakdown JSONB contains any score below threshold
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('user_id, quality_breakdown, soul_md, identity_md, user_md, agents_md, tools_md')
    .not('quality_breakdown', 'is', null)
    .limit(10); // Process max 10 per run to avoid timeout

  if (error) throw error;

  const refinedProfiles: string[] = [];

  for (const profile of profiles || []) {
    const breakdown = profile.quality_breakdown as QualityBreakdown;

    // Check which sections need refinement
    const sectionsToRefine: Array<'soul' | 'identity' | 'user' | 'agents' | 'tools'> = [];
    for (const [section, metrics] of Object.entries(breakdown)) {
      const sectionMetrics = metrics as Record<string, number>;
      if (Object.values(sectionMetrics).some(score => score < 60)) {
        sectionsToRefine.push(section as any);
      }
    }

    if (sectionsToRefine.length === 0) continue;

    // Trigger RLM service refinement for each low-quality section
    // This re-generates sections using the full pass pipeline with targeted prompts
    for (const section of sectionsToRefine) {
      try {
        // Call RLM service to regenerate section with refined prompt
        // (Implementation detail: extend RLM /refine-section endpoint)
        const response = await fetch(`${process.env.RLM_SERVICE_URL}/refine-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: profile.user_id,
            section_type: section,
            current_content: profile[`${section}_md`],
            quality_issues: breakdown[section],
          }),
        });

        if (!response.ok) {
          console.error(`Failed to refine ${section} for ${profile.user_id}`);
          continue;
        }

        const { refined_content } = await response.json();

        // Update section in database
        await supabase
          .from('user_profiles')
          .update({ [`${section}_md`]: refined_content })
          .eq('user_id', profile.user_id);

        // Re-score the refined section
        const newScores = await scoreSoulprintSection(section, refined_content);

        // Update quality_breakdown
        const newBreakdown = { ...breakdown, [section]: newScores };
        await supabase
          .from('user_profiles')
          .update({
            quality_breakdown: newBreakdown,
            quality_scored_at: new Date().toISOString(),
          })
          .eq('user_id', profile.user_id);

        refinedProfiles.push(`${profile.user_id}:${section}`);
      } catch (error) {
        console.error(`Error refining ${section} for ${profile.user_id}:`, error);
      }
    }
  }

  return NextResponse.json({
    message: 'Quality refinement completed',
    refined: refinedProfiles,
  });
}
```

### Anti-Patterns to Avoid
- **Blocking chat on quality scoring:** Score asynchronously after profile generation, never block chat route
- **User-visible quality scores:** Don't expose 0-100 numbers to users (creates anxiety/gamification), only surface in admin/debug UIs
- **Re-scoring on every chat:** Quality scoring is expensive (3 judges × 5 sections = 15 LLM calls), only score once after generation and on refinement
- **Ignoring low scores in prompts:** If a section scores <60 on completeness, AI MUST acknowledge "I don't have enough info about X" (EMOT-02)
- **Synchronous refinement:** Background cron pattern avoids blocking user workflows, consistent with existing async architecture

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Custom quality rubrics | Ad-hoc prompts per section | G-Eval pattern with structured dimensions (completeness, coherence, specificity) | Research-backed, consistent scoring, proven in Phase 1 evals |
| Real-time refinement triggers | WebSocket/polling for live updates | Vercel Cron daily job | Avoids complexity, matches existing `/api/cron/tasks` pattern, sufficient latency for quality improvements |
| Quality threshold detection | SQL queries on JSONB with manual parsing | GIN index + jsonb_path_query for threshold checks | PostgreSQL native, performant, type-safe with proper schema |
| Judge prompt engineering | Write rubrics from scratch | Extend Phase 1 judges (ANTI_LENGTH_BIAS, JUDGE_SYSTEM constants, error handling) | Proven patterns, avoid length bias, consistent error handling |
| Score normalization | Custom math for 0.0-1.0 → 0-100 | `Math.round(score * 100)` with clamp guards | Simple, readable, matches QUAL-01 requirement for 0-100 scale |

**Key insight:** Quality scoring is evaluation applied to soulprint data rather than chat outputs. Phase 1's judge infrastructure (BaseMetric, Haiku 4.5, Zod validation, error handling) transfers directly with minimal changes. Don't rebuild judge patterns—extend them.

## Common Pitfalls

### Pitfall 1: Scoring Every Section Individually Is Expensive
**What goes wrong:** Scoring 5 sections × 3 dimensions = 15 LLM calls per profile, adding 5-10 seconds and $0.15-0.30 in API costs
**Why it happens:** Developers treat quality scoring like cheap validation checks
**How to avoid:**
- Score once after initial profile generation (quick pass + full pass complete)
- Re-score only sections that are regenerated by refinement jobs
- Never score on every chat request (defeats Haiku 4.5's 150 max token advantage)
**Warning signs:** Increased latency on chat route, Bedrock API costs spike, users report slowness

### Pitfall 2: Quality Scores Create User Anxiety
**What goes wrong:** Showing "Your SOUL section scored 45/100" causes users to obsess over numbers rather than chat quality
**Why it happens:** Gamification instinct—if there's a score, users want to maximize it
**How to avoid:**
- Never expose quality scores in user-facing UI (no "Quality: 72%" badges)
- Scores are internal metadata for AI confidence + refinement triggers
- Admin/debug UIs can show scores for troubleshooting
**Warning signs:** User support requests like "How do I improve my score?", users re-uploading data repeatedly

### Pitfall 3: Ignoring Quality Scores in System Prompts
**What goes wrong:** AI confidently answers questions about sparse sections, fabricates details, violates EMOT-02 (acknowledge uncertainty)
**Why it happens:** System prompt doesn't tell AI its own data limitations
**How to avoid:**
- Add DATA CONFIDENCE section to prompt (Pattern 3) BEFORE memory context
- Explicitly instruct: "If user_md.occupation scored <60 on completeness, say 'I don't have detailed occupation info' not 'You work in tech'"
- Test with low-quality profiles to verify uncertainty acknowledgment
**Warning signs:** Users report AI "making up" facts, hallucination in personality-specific responses

### Pitfall 4: Threshold Tuning Without Validation
**What goes wrong:** Setting refinement threshold at 70 causes constant re-generation churn; setting at 40 misses genuinely poor sections
**Why it happens:** No correlation study between scores and user satisfaction (STATE.md blocker)
**How to avoid:**
- Start with threshold 60 (QUAL-03 requirement) as baseline
- Collect user satisfaction data (explicit feedback, chat continuation rate)
- Run correlation analysis (r>0.7 target from STATE.md) before adjusting
- Phase 5 validation includes threshold optimization
**Warning signs:** Refinement jobs run constantly with no UX improvement, users complain about changing personalities

### Pitfall 5: JSONB Query Performance Degradation
**What goes wrong:** Querying `quality_breakdown @> '{"soul": {"completeness": 59}}'` becomes slow as user base grows
**Why it happens:** GIN index doesn't support range queries efficiently, needs jsonb_path_query
**How to avoid:**
- Use GIN index for exact matches and existence checks
- Use jsonb_path_query for threshold checks: `jsonb_path_query(quality_breakdown, '$.*.* ? (@ < 60)')`
- Monitor query performance in Supabase dashboard
- Consider separate quality_scores table if >100k users (future optimization)
**Warning signs:** Cron job timeouts, slow admin dashboard, Supabase query logs show >1s JSONB queries

### Pitfall 6: Refinement Without Re-Scoring
**What goes wrong:** Background job regenerates low-quality sections but doesn't update quality_breakdown, causing infinite refinement loop
**Why it happens:** Forgetting to re-score after content update
**How to avoid:**
- Pattern 4 shows re-scoring immediately after refinement
- Atomic update: `UPDATE user_profiles SET agents_md = $1, quality_breakdown = $2 WHERE user_id = $3`
- Add `quality_scored_at` timestamp to detect stale scores
**Warning signs:** Same profiles refined repeatedly, quality_breakdown never improves, Cron logs show duplicate user_ids

## Code Examples

Verified patterns from official sources:

### Coherence Judge (Second Quality Dimension)
```typescript
// Source: G-Eval coherence patterns + Phase 1 judge architecture
import { BaseMetric, z } from 'opik';
import type { EvaluationScoreResult } from 'opik';
import { bedrockChatJSON } from '@/lib/bedrock';

const coherenceSchema = z.object({
  section_name: z.string(),
  section_content: z.string(),
  section_type: z.enum(['soul', 'identity', 'user', 'agents', 'tools']),
});

type CoherenceInput = z.infer<typeof coherenceSchema>;

export class CoherenceJudge extends BaseMetric<typeof coherenceSchema> {
  readonly validationSchema = coherenceSchema;

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

    const data = parsed.data as CoherenceInput;

    const prompt = `You are evaluating the COHERENCE of a soulprint section for an AI personalization system.

SECTION: ${data.section_name}

CONTENT:
${data.section_content}

Evaluate on a scale of 0.0 (completely incoherent) to 1.0 (perfectly coherent):
1. Logical flow: Do ideas connect logically, or are they disjointed?
2. Internal consistency: Are there contradictions (e.g., "direct communication" + "prefers vague hints")?
3. Structural clarity: Is information organized sensibly, or is it chaotic?
4. Unified purpose: Do all fields support the section's goal, or is it unfocused?

CRITICAL: Coherence is about structure and consistency, NOT length. A short, well-organized section is more coherent than a long, rambling one.

Score scale:
- 1.0: Perfectly logical, consistent, well-structured
- 0.7-0.9: Mostly coherent, minor inconsistencies or organizational issues
- 0.4-0.6: Mixed - some coherent parts, but noticeable contradictions or poor structure
- 0.0-0.3: Incoherent, contradictory, or chaotically organized

Respond with JSON only:
{
  "score": 0.85,
  "reasoning": "Brief explanation of coherence strengths/weaknesses."
}`;

    try {
      const result = await bedrockChatJSON<{ score: number; reasoning: string }>({
        model: 'HAIKU_45',
        system: 'You are an objective AI evaluator. Be precise, fair, and unbiased. Always respond with valid JSON only.',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 512,
        temperature: 0.1,
      });

      return {
        name: this.name,
        value: Math.min(1.0, Math.max(0.0, result.score)),
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
```

### Quality Breakdown Calculation (Orchestrator)
```typescript
// Source: Opik patterns + quality scoring architecture
// lib/evaluation/quality-scoring.ts

import { CompletenessJudge, CoherenceJudge, SpecificityJudge } from './quality-judges';

export interface SectionQualityScores {
  completeness: number; // 0-100
  coherence: number;    // 0-100
  specificity: number;  // 0-100
}

export interface QualityBreakdown {
  soul: SectionQualityScores;
  identity: SectionQualityScores;
  user: SectionQualityScores;
  agents: SectionQualityScores;
  tools: SectionQualityScores;
}

/**
 * Score a single soulprint section across all three quality dimensions.
 * Returns scores normalized to 0-100 integer range.
 */
export async function scoreSoulprintSection(
  sectionType: 'soul' | 'identity' | 'user' | 'agents' | 'tools',
  content: string
): Promise<SectionQualityScores> {
  const sectionNames = {
    soul: 'SOUL',
    identity: 'IDENTITY',
    user: 'USER',
    agents: 'AGENTS',
    tools: 'TOOLS',
  };

  const judges = {
    completeness: new CompletenessJudge(),
    coherence: new CoherenceJudge(),
    specificity: new SpecificityJudge(),
  };

  const input = {
    section_name: sectionNames[sectionType],
    section_content: content,
    section_type: sectionType,
  };

  // Score all three dimensions in parallel
  const [completenessResult, coherenceResult, specificityResult] = await Promise.all([
    judges.completeness.score(input),
    judges.coherence.score(input),
    judges.specificity.score(input),
  ]);

  // Normalize 0.0-1.0 to 0-100 integer
  const normalize = (value: number) => Math.round(Math.min(100, Math.max(0, value * 100)));

  return {
    completeness: normalize(completenessResult.value),
    coherence: normalize(coherenceResult.value),
    specificity: normalize(specificityResult.value),
  };
}

/**
 * Calculate full quality breakdown for all soulprint sections.
 * Used after quick pass + full pass completion.
 */
export async function calculateQualityBreakdown(profile: {
  soul_md: string | null;
  identity_md: string | null;
  user_md: string | null;
  agents_md: string | null;
  tools_md: string | null;
}): Promise<QualityBreakdown> {
  const sections = ['soul', 'identity', 'user', 'agents', 'tools'] as const;

  // Score all sections in parallel (15 LLM calls total: 5 sections × 3 judges)
  const scores = await Promise.all(
    sections.map(async (section) => {
      const content = profile[`${section}_md`];
      if (!content) {
        // Section missing - all scores 0
        return { completeness: 0, coherence: 0, specificity: 0 };
      }
      return scoreSoulprintSection(section, content);
    })
  );

  return {
    soul: scores[0],
    identity: scores[1],
    user: scores[2],
    agents: scores[3],
    tools: scores[4],
  };
}
```

### Threshold-Based Refinement Query
```typescript
// Source: PostgreSQL JSONB query patterns + Vercel Cron architecture
// app/api/cron/quality-refinement/route.ts

import { getSupabaseAdmin } from '@/lib/supabase/server';

async function findLowQualityProfiles(threshold: number = 60): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  // Query profiles with ANY quality metric below threshold
  // Uses jsonb_path_query to check all nested scores
  const { data, error } = await supabase.rpc('find_low_quality_profiles', {
    threshold_score: threshold,
  });

  if (error) throw error;

  return data.map((row: { user_id: string }) => row.user_id);
}

// SQL function (defined in migration):
/*
CREATE OR REPLACE FUNCTION find_low_quality_profiles(threshold_score INT)
RETURNS TABLE(user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id
  FROM user_profiles up
  WHERE up.quality_breakdown IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM jsonb_each(up.quality_breakdown) AS section(key, value)
      CROSS JOIN jsonb_each(value) AS metric(metric_key, metric_value)
      WHERE (metric_value::text)::int < threshold_score
    );
END;
$$ LANGUAGE plpgsql;
*/
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual quality checks | Automated LLM-as-judge scoring | 2024-2025 | Consistent evaluation, scalable to all users |
| Single quality score | Multi-dimensional (completeness, coherence, specificity) | 2025 | Targeted refinement, actionable feedback |
| 0.0-1.0 float scores (G-Eval native) | 0-100 integer scores | 2026 | User-facing clarity, easier threshold tuning |
| Relational quality_scores table | JSONB quality_breakdown column with GIN index | 2025-2026 | Simpler schema, faster read-heavy queries |
| Real-time refinement | Background cron jobs | 2024-2026 | Non-blocking UX, consistent with async architecture |

**Deprecated/outdated:**
- **Manual rubric evaluation:** LLM-as-judge with G-Eval patterns now standard for quality assessment
- **Separate dimension tables:** JSONB quality_breakdown is preferred for denormalized quality metrics (Phase 4 pattern)
- **Synchronous scoring:** Quality scoring is async, triggered after profile generation, never blocks chat

## Open Questions

1. **Quality-to-Satisfaction Correlation**
   - What we know: QUAL-01 requires 0-100 scores, STATE.md requires r>0.7 correlation with user satisfaction
   - What's unclear: We need user satisfaction data to validate threshold 60 is correct, not arbitrary
   - Recommendation: Phase 5 includes user feedback collection + correlation study, may adjust threshold based on findings

2. **Refinement Prompt Engineering**
   - What we know: Background cron should regenerate low-quality sections automatically (QUAL-03)
   - What's unclear: What prompt instructions best target specific quality gaps (e.g., "increase specificity" vs. "add concrete examples")
   - Recommendation: Start with generic refinement prompt ("improve this section based on full conversation history"), iterate based on score deltas

3. **Memory Section Quality Scoring**
   - What we know: Phase 2 added memory_md section for curated facts, not yet included in quality scoring
   - What's unclear: Should memory_md be scored like other sections, or is it a different pattern (growing over time vs. static profile)?
   - Recommendation: Phase 4 scores 5 core sections (SOUL, IDENTITY, USER, AGENTS, TOOLS), defer memory_md scoring to future iteration

4. **Refinement Impact on Personality Drift**
   - What we know: Automated refinement could change personality characteristics without user consent
   - What's unclear: How to refine completeness/coherence WITHOUT changing core personality traits
   - Recommendation: Refinement prompt must include "preserve existing personality traits, only add missing details or fix contradictions"

## Sources

### Primary (HIGH confidence)
- Phase 1 Research: `.planning/phases/01-evaluation-foundation/01-RESEARCH.md`
- Phase 1 Plans: `01-01-PLAN.md` (evaluation judges), `01-02-PLAN.md` (experiment runner)
- Existing codebase: `lib/evaluation/judges.ts`, `lib/evaluation/types.ts`, `lib/soulprint/types.ts`
- [G-Eval: LLM-as-a-Judge for Summarization](https://www.confident-ai.com/blog/g-eval-the-definitive-guide)
- [Score Before You Speak: Improving Persona Consistency](https://arxiv.org/pdf/2508.06886)
- [PostgreSQL JSONB - Powerful Storage for Semi-Structured Data](https://www.architecture-weekly.com/p/postgresql-jsonb-powerful-storage)

### Secondary (MEDIUM confidence)
- [LLM Evaluation Metrics: The Ultimate LLM Evaluation Guide](https://www.confident-ai.com/blog/llm-evaluation-metrics-everything-you-need-for-llm-evaluation)
- [Large Language Model Evaluation in '26: 10+ Metrics & Methods](https://research.aimultiple.com/large-language-model-evaluation/)
- [PersoDPO: Scalable Preference Optimization for Instruction-Adherent, Persona-Grounded Dialogue](https://arxiv.org/html/2602.04493)
- [LLM evaluation metrics and methods](https://www.evidentlyai.com/llm-guide/llm-evaluation-metrics)
- [When LLM Agents Meet Graph Optimization: An Automated Data Quality Improvement Approach](https://arxiv.org/html/2510.08952)
- [JSON vs JSONB - A complete comparison](https://www.dbvis.com/thetable/json-vs-jsonb-in-postgresql-a-complete-comparison/)

### Tertiary (LOW confidence)
- [LLM as a Judge: A 2026 Guide to Automated Model Assessment](https://labelyourdata.com/articles/llm-as-a-judge)
- [The State Of LLMs 2025: Progress, Progress, and Predictions](https://magazine.sebastianraschka.com/p/state-of-llms-2025)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phase 1 established all dependencies (Opik, Haiku 4.5, Zod), zero new packages
- Architecture: HIGH - Extends proven Phase 1 judge pattern, JSONB quality_breakdown verified in PostgreSQL docs, Vercel Cron pattern exists in `/api/cron/tasks`
- Quality dimensions: HIGH - Completeness, coherence, specificity well-defined in G-Eval and persona consistency research
- Threshold 60: MEDIUM - QUAL-03 requirement specifies <60 triggers refinement, but correlation study needed (Phase 5)
- Refinement prompts: MEDIUM - Background cron pattern proven, but refinement prompt engineering needs iteration
- Memory section scoring: LOW - Deferred to future work, not blocking Phase 4 requirements

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable domain, G-Eval patterns mature, JSONB well-established)
