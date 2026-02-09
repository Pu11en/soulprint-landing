---
phase: 04-quality-scoring
plan: 02
subsystem: ai-prompting
tags: [quality-scoring, prompt-engineering, data-confidence, uncertainty-acknowledgment]

# Dependency graph
requires:
  - phase: 04-01
    provides: "QualityBreakdown type, quality_breakdown JSONB column, quality scoring infrastructure"
provides:
  - "DATA CONFIDENCE section in system prompts showing overall quality and weak areas"
  - "Explicit uncertainty instructions for low-confidence soulprint sections (<60)"
  - "quality_breakdown loaded from user_profiles and passed to PromptBuilder"
affects: [05-refinement-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DATA CONFIDENCE section in prompts: aggregate quality scores, identify weak areas, instruct AI to acknowledge uncertainty"

key-files:
  created: []
  modified:
    - lib/soulprint/prompt-builder.ts
    - app/api/chat/route.ts

key-decisions:
  - "DATA CONFIDENCE section appears AFTER soulprint sections but BEFORE CONTEXT (RAG) to establish data quality awareness before retrieval results"
  - "Threshold 60/100 distinguishes high vs low confidence (matches quality-scoring.ts hasLowQualityScores default)"
  - "Backward compatible: null quality_breakdown produces no DATA CONFIDENCE section"
  - "Both v1-technical and v2-natural-voice prompts include DATA CONFIDENCE identically"

patterns-established:
  - "DATA CONFIDENCE section format: overall quality level (HIGH/MODERATE/LOW) + score + low-confidence areas list + uncertainty instructions"
  - "buildDataConfidenceSection private method: aggregates all 15 scores (5 sections × 3 metrics) for average"

# Metrics
duration: 3min
completed: 2026-02-09
---

# Phase 4 Plan 2: Prompt Quality Integration Summary

**DATA CONFIDENCE section in system prompts instructs AI to acknowledge uncertainty for low-quality soulprint sections, preventing hallucination**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-09T04:50:58Z
- **Completed:** 2026-02-09T04:54:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- DATA CONFIDENCE section added to both v1 and v2 system prompts
- AI receives explicit instructions to acknowledge uncertainty for low-confidence areas (<60)
- Chat route loads quality_breakdown from user_profiles in single query
- Backward compatible: profiles without quality_breakdown produce identical prompts

## Task Commits

Each task was committed atomically:

1. **Task 1: PromptBuilder DATA CONFIDENCE Section** - `71790ef` (feat)
2. **Task 2: Chat Route Quality Loading** - `e870678` (feat)

## Files Created/Modified
- `lib/soulprint/prompt-builder.ts` - Added buildDataConfidenceSection method, quality_breakdown field to PromptBuilderProfile, DATA CONFIDENCE injection in v1 and v2 prompts
- `app/api/chat/route.ts` - Added quality_breakdown to UserProfile interface, SELECT query, and validateProfile

## Decisions Made
1. **DATA CONFIDENCE placement:** After soulprint sections but before CONTEXT (RAG)
   - Rationale: Establishes data quality awareness before RAG context injection. Prevents RAG results from overriding quality instructions.

2. **Confidence thresholds:** HIGH (≥80), MODERATE (≥60), LOW (<60)
   - Rationale: Matches hasLowQualityScores default threshold of 60 from quality-scoring.ts. Consistent definition across system.

3. **Uncertainty instructions:** Only shown for low-confidence areas
   - Rationale: Reduces prompt bloat when all sections are high quality. Focuses AI attention on specific weak areas.

4. **v1 and v2 parity:** Identical DATA CONFIDENCE section for both prompt versions
   - Rationale: Data quality awareness is functional metadata, not personality content. Should be consistent regardless of prompt style.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Quality scores now surfaced to AI via system prompts
- AI can respond appropriately to data quality (acknowledge uncertainty vs respond confidently)
- Ready for Phase 5 (refinement loop) which will improve low-quality sections
- Verification: quality_breakdown loading confirmed working, DATA CONFIDENCE section generation tested with HIGH/MODERATE/LOW quality profiles

**Readiness check:**
- ✅ PromptBuilder includes DATA CONFIDENCE section
- ✅ Chat route loads quality_breakdown from database
- ✅ Low-confidence areas (<60) generate uncertainty instructions
- ✅ Backward compatible with null quality_breakdown
- ✅ Both v1 and v2 prompts include DATA CONFIDENCE

---
*Phase: 04-quality-scoring*
*Completed: 2026-02-09*
