---
phase: 04-quality-scoring
verified: 2026-02-09T00:00:00Z
status: human_needed
score: 7/8 must-haves verified
human_verification:
  - test: "Apply database migration to production Supabase"
    expected: "quality_breakdown column exists in user_profiles table, find_low_quality_profiles() function works"
    why_human: "Migration file exists and is correct, but requires manual execution in Supabase SQL Editor. Cannot verify schema changes programmatically without database access."
---

# Phase 4: Quality Scoring Verification Report

**Phase Goal:** Score each soulprint section 0-100 so AI knows its own data confidence and low-quality profiles get refined

**Verified:** 2026-02-09T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each soulprint section (SOUL, IDENTITY, USER, AGENTS, TOOLS) has quality scores 0-100 for completeness, coherence, specificity | ✓ VERIFIED | quality-judges.ts (3 judges × 5 sections), quality-scoring.ts (calculateQualityBreakdown returns all 15 scores normalized to 0-100) |
| 2 | Quality scores are stored in user_profiles.quality_breakdown JSONB column | ? HUMAN_NEEDED | Migration file exists (20260209_quality_breakdown.sql), but not yet applied to production database per 04-03-SUMMARY.md checklist |
| 3 | Quality scores are surfaced in system prompts so AI adapts confidence level in responses | ✓ VERIFIED | PromptBuilder.buildDataConfidenceSection (lines 419-456), injected in both v1 (line 219) and v2 (line 352) prompts |
| 4 | Soulprints scoring below 60 on any metric are automatically flagged for refinement | ✓ VERIFIED | find_low_quality_profiles(60) SQL function in migration, hasLowQualityScores(breakdown, 60) in quality-scoring.ts, cron job queries both |
| 5 | Background refinement job improves flagged soulprints without user intervention | ✓ VERIFIED | quality-refinement/route.ts (344 lines), calls RLM /create-soulprint, re-scores refined sections, updates DB atomically |

**Score:** 4/5 truths verified, 1 needs human verification (database migration application)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/evaluation/quality-judges.ts` | Three judge classes (Completeness, Coherence, Specificity) extending BaseMetric | ✓ VERIFIED | 373 lines, all three judges export correctly, use Haiku 4.5, follow Phase 1 judge pattern identically |
| `lib/evaluation/quality-scoring.ts` | Scoring orchestrator functions and type definitions | ✓ VERIFIED | 222 lines, exports scoreSoulprintSection, calculateQualityBreakdown, hasLowQualityScores, getLowQualitySections + types |
| `supabase/migrations/20260209_quality_breakdown.sql` | Database migration for quality_breakdown JSONB column | ✓ VERIFIED | 45 lines, adds quality_breakdown JSONB, quality_scored_at timestamp, GIN index, find_low_quality_profiles() function |
| `lib/soulprint/prompt-builder.ts` | DATA CONFIDENCE section builder + updated PromptBuilderProfile type | ✓ VERIFIED | buildDataConfidenceSection (lines 419-456), quality_breakdown field in interface, injected in v1 (line 219) and v2 (line 352) |
| `app/api/chat/route.ts` | Chat route loading quality_breakdown from user_profiles | ✓ VERIFIED | quality_breakdown in SELECT query (line 237), in UserProfile interface (line 99), in validateProfile (line 129), passed to PromptBuilder (line 460) |
| `app/api/cron/quality-refinement/route.ts` | Background cron job that finds and refines low-quality profiles | ✓ VERIFIED | 344 lines, finds unscored + low-quality profiles, calls RLM, re-scores, updates DB, max 10 profiles/run |
| `app/api/quality/score/route.ts` | Manual trigger endpoint to score a specific profile | ✓ VERIFIED | 118 lines, POST handler, auth check, rate limiting (expensive tier), returns quality_breakdown |
| `vercel.json` | Cron schedule for quality refinement (daily) | ✓ VERIFIED | quality-refinement cron at 0 3 * * * (daily 3 AM UTC) |

**Artifacts:** 8/8 verified (all exist, substantive, properly wired)

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| quality-judges.ts | lib/evaluation/judges.ts | Same BaseMetric extension pattern, bedrockChatJSON, HAIKU_45 | ✓ WIRED | All three judges use identical pattern: BaseMetric, bedrockChatJSON, temperature 0.1, clampScore |
| quality-scoring.ts | quality-judges.ts | Imports judge classes and runs them in parallel | ✓ WIRED | Lines 72-74 instantiate all three judges, Promise.all runs them in parallel |
| prompt-builder.ts | quality-scoring.ts | QualityBreakdown type import for DATA CONFIDENCE section | ✓ WIRED | Line 26 imports type, line 419 uses it in buildDataConfidenceSection signature |
| chat/route.ts | prompt-builder.ts | Passes quality_breakdown to PromptParams | ✓ WIRED | Line 460 passes quality_breakdown field in profile object to buildEmotionallyIntelligentPrompt |
| quality-refinement/route.ts | quality-scoring.ts | Imports calculateQualityBreakdown and hasLowQualityScores | ✓ WIRED | Lines 12-19 import functions, used in lines 142 (unscored profiles) and 183 (refinement check) |
| quality-refinement/route.ts | RLM_SERVICE_URL/create-soulprint | Calls RLM to re-generate low-quality sections | ✓ WIRED | Line 226 fetch to RLM /create-soulprint, parses response (line 240), extracts refined sections (lines 256-278) |
| import/process-server/route.ts | quality-scoring.ts | Triggers quality scoring after import_status = quick_ready | ✓ WIRED | Lines 415-421 call calculateQualityBreakdown in fire-and-forget async IIFE, updates DB lines 423-429 |

**Key Links:** 7/7 verified (all critical wiring confirmed)

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| QUAL-01: Each soulprint section is scored 0-100 for data quality (completeness, coherence, specificity) | ✓ SATISFIED | All supporting truths verified, quality-judges.ts + quality-scoring.ts complete |
| QUAL-02: Quality scores are surfaced in system prompt so AI knows its own data confidence | ✓ SATISFIED | DATA CONFIDENCE section in both v1 and v2 prompts, chat route loads quality_breakdown |
| QUAL-03: Low-quality soulprints are flagged for automated refinement | ✓ SATISFIED | Cron job finds profiles with any metric <60, calls RLM to refine, re-scores, updates DB |

**Requirements:** 3/3 satisfied

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

**Anti-patterns:** None found. Code is production-ready.

- No TODO/FIXME comments in Phase 4 code
- No placeholder implementations
- No empty handlers or stub patterns
- All error handling present (try/catch in judges, cron job resilience, fire-and-forget fail-safe)
- Proper exports and imports throughout

### Human Verification Required

#### 1. Apply Database Migration to Production Supabase

**Test:** Execute the migration file in Supabase SQL Editor

```sql
-- Navigate to Supabase Dashboard → SQL Editor
-- Paste contents of supabase/migrations/20260209_quality_breakdown.sql
-- Execute the migration
```

**Expected:**
- `ALTER TABLE user_profiles ADD COLUMN quality_breakdown JSONB` succeeds
- `ALTER TABLE user_profiles ADD COLUMN quality_scored_at TIMESTAMPTZ` succeeds
- `CREATE INDEX idx_user_profiles_quality_breakdown` succeeds
- `CREATE FUNCTION find_low_quality_profiles(threshold_score INT)` succeeds
- Query `SELECT quality_breakdown FROM user_profiles LIMIT 1` returns NULL (column exists but unpopulated)
- Call `SELECT * FROM find_low_quality_profiles(60)` returns empty set (no low-quality profiles yet)

**Why human:** Migration files require manual execution in Supabase SQL Editor. Cannot verify schema changes programmatically without database access. The migration file is correct (verified against plan specification), but application to production database is a manual deployment step.

**Checklist item from 04-03-SUMMARY.md:**
```
Production Deployment Checklist:
- [ ] Apply `supabase/migrations/20260209_quality_breakdown.sql` migration (from 04-01)
```

**Impact if not completed:**
- Quality scoring will fail with "column does not exist" errors
- Cron job will fail when querying unscored profiles
- Chat route will fail when selecting quality_breakdown
- Manual score endpoint will fail when updating quality_breakdown

**Verification steps after migration:**
1. Test manual scoring: `POST /api/quality/score` with auth token
2. Verify column exists: Check user_profiles schema in Supabase dashboard
3. Test cron job: Trigger manually with `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/quality-refinement`
4. Verify import pipeline: Upload ChatGPT export, check quality_breakdown appears in user_profiles within 10 seconds

#### 2. Verify Quality Scores Affect AI Responses (End-to-End)

**Test:** Test the complete flow from quality scoring to AI response adaptation

1. Create a test profile with intentionally low-quality soulprint sections (sparse content, contradictions, generic statements)
2. Trigger manual scoring: `POST /api/quality/score`
3. Verify quality_breakdown shows low scores (<60) for specific sections
4. Send chat message asking about a topic in the low-quality section
5. Observe AI response

**Expected:**
- AI response includes uncertainty acknowledgment: "I don't have enough information about X"
- AI does NOT hallucinate or fabricate details about the low-quality topic
- System prompt includes `## DATA CONFIDENCE` section with low-confidence areas listed
- AI confidence level is appropriate to data quality

**Why human:** This is an LLM behavior test. Requires reading AI responses and judging whether the uncertainty acknowledgment is present and appropriate. Cannot automate LLM output interpretation at this level.

**Test variations:**
- High-quality profile (all scores ≥80): AI should respond confidently
- Moderate-quality profile (scores 60-79): AI should be cautious but not overly uncertain
- Low-quality profile (any score <60): AI should explicitly acknowledge uncertainty for that area

### Gaps Summary

**No code gaps found.** All must-haves from the three plans are implemented correctly:

**Plan 04-01 (Quality Judges + Scoring Orchestrator + DB Migration):**
- ✓ Three quality judge classes exist (CompletenessJudge, CoherenceJudge, SpecificityJudge)
- ✓ Scoring orchestrator calculates all 15 scores (5 sections × 3 metrics) in parallel
- ✓ Database migration file is correct and complete
- ? Migration NOT YET APPLIED to production database (human verification needed)

**Plan 04-02 (PromptBuilder DATA CONFIDENCE Section):**
- ✓ DATA CONFIDENCE section builder exists and is substantive
- ✓ Injected in both v1 technical and v2 natural voice prompts
- ✓ Chat route loads quality_breakdown from database
- ✓ Backward compatible (null quality_breakdown produces no section)

**Plan 04-03 (Background Refinement Cron):**
- ✓ Cron job finds unscored profiles AND low-quality profiles
- ✓ Calls RLM /create-soulprint to refine sections
- ✓ Re-scores refined sections and updates DB atomically
- ✓ Fire-and-forget quality scoring in import pipeline
- ✓ Manual score endpoint with auth and rate limiting
- ✓ vercel.json cron schedule (daily 3 AM UTC)

**Deployment dependency:** The migration must be applied to production before the phase is fully operational. This is documented in 04-03-SUMMARY.md production deployment checklist but not yet completed.

---

_Verified: 2026-02-09T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
