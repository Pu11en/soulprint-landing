---
phase: 01-evaluation-foundation
plan: 01
subsystem: testing
tags: [opik, evaluation, llm-as-judge, datasets, bedrock, haiku-4.5, sha256, zod]

# Dependency graph
requires: []
provides:
  - ChatEvalItem type for evaluation dataset items
  - createEvaluationDataset function for extracting anonymized chat data to Opik
  - PersonalityConsistencyJudge for scoring trait alignment
  - FactualityJudge for scoring groundedness
  - ToneMatchingJudge for scoring tone/style matching
affects:
  - 01-02 (experiment runner uses datasets and judges)
  - 01-03 (baseline recording depends on datasets and judges)
  - 02-evaluation-foundation (prompt experiments use these judges)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BaseMetric extension pattern for custom Opik judges"
    - "SHA256 anonymization for user IDs in evaluation data"
    - "bedrockChatJSON with HAIKU_45 for judge scoring"
    - "Anti-length-bias instruction in all judge prompts"
    - "Zod v4 validation with safeParse for judge inputs"

key-files:
  created:
    - lib/evaluation/types.ts
    - lib/evaluation/datasets.ts
    - lib/evaluation/judges.ts
  modified: []

key-decisions:
  - "Used index signature on ChatEvalItem for Opik DatasetItemData compatibility"
  - "Followed local getSupabaseAdmin pattern (not shared export) consistent with codebase"
  - "zod v4 z.record requires two args (key, value) -- used z.record(z.string(), z.unknown())"
  - "Minimum 10 valid pairs enforced for statistical significance in datasets"

patterns-established:
  - "BaseMetric extension: validationSchema + score method with safeParse guard"
  - "Judge prompt structure: context, input, output, rubric, anti-length-bias, JSON response"
  - "Dataset extraction: query -> pair -> anonymize -> enrich -> upload to Opik"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 1 Plan 1: Evaluation Core Library Summary

**Opik evaluation datasets from chat_messages with SHA256 anonymization and three custom Haiku 4.5 judges for personality consistency, factuality, and tone matching**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-09T02:27:48Z
- **Completed:** 2026-02-09T02:33:08Z
- **Tasks:** 2/2
- **Files created:** 3

## Accomplishments
- ChatEvalItem type with full soulprint context, expected traits/tone/style, and SHA256-anonymized metadata
- createEvaluationDataset function that extracts user/assistant pairs from chat_messages, enriches with soulprint sections, and uploads to Opik with date-stamped naming
- Three custom LLM-as-judge scorers (PersonalityConsistencyJudge, FactualityJudge, ToneMatchingJudge) all using Haiku 4.5 to avoid self-preference bias against Sonnet 4.5 generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create evaluation types and dataset extraction** - `83761b8` (feat)
2. **Task 2: Create three custom LLM-as-judge scoring metrics** - `1f73828` (feat)

## Files Created/Modified
- `lib/evaluation/types.ts` - ChatEvalItem and DatasetCreationResult types
- `lib/evaluation/datasets.ts` - createEvaluationDataset with SHA256 anonymization and soulprint enrichment
- `lib/evaluation/judges.ts` - PersonalityConsistencyJudge, FactualityJudge, ToneMatchingJudge extending BaseMetric

## Decisions Made
- Added index signature `[key: string]: unknown` to ChatEvalItem so it satisfies Opik's `DatasetItemData` constraint (which extends `Record<string, unknown>`)
- Used local `getSupabaseAdmin()` function rather than trying to import a shared one -- consistent with every other file in the codebase
- zod v4 changed `z.record()` to require explicit key type: used `z.record(z.string(), z.unknown())` instead of v3's `z.record(z.unknown())`
- Used non-null assertion (`!`) on array indexing in the pairing loop to satisfy `noUncheckedIndexedAccess` -- safe because loop bounds guarantee index validity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zod v4 z.record() signature change**
- **Found during:** Task 2 (judges.ts compilation)
- **Issue:** `z.record(z.unknown())` throws TS2554 in zod v4 -- requires 2 arguments (key type + value type)
- **Fix:** Changed to `z.record(z.string(), z.unknown())`
- **Files modified:** lib/evaluation/judges.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 1f73828 (Task 2 commit)

**2. [Rule 3 - Blocking] ChatEvalItem missing index signature for Opik compatibility**
- **Found during:** Task 1 (datasets.ts compilation)
- **Issue:** `ChatEvalItem` interface doesn't satisfy Opik's `DatasetItemData` type (extends `Record<string, unknown>`)
- **Fix:** Added `[key: string]: unknown` index signature to ChatEvalItem
- **Files modified:** lib/evaluation/types.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 83761b8 (Task 1 commit)

**3. [Rule 3 - Blocking] noUncheckedIndexedAccess with array loop indexing**
- **Found during:** Task 1 (datasets.ts compilation)
- **Issue:** Array indexing `typedMessages[i]` returns `T | undefined` due to `noUncheckedIndexedAccess` tsconfig
- **Fix:** Used non-null assertions (`typedMessages[i]!`) since loop bounds guarantee valid indices
- **Files modified:** lib/evaluation/datasets.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 83761b8 (Task 1 commit)

**4. [Rule 3 - Blocking] Set spread not supported with ES2017 target**
- **Found during:** Task 1 (datasets.ts compilation)
- **Issue:** `[...new Set(...)]` requires downlevelIteration or ES2015+ target
- **Fix:** Changed to `Array.from(new Set(...))`
- **Files modified:** lib/evaluation/datasets.ts
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** 83761b8 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (4 blocking)
**Impact on plan:** All auto-fixes were TypeScript compilation issues from zod v4 API changes and strict tsconfig settings. No scope creep. Functionality matches plan exactly.

## Issues Encountered
None beyond the type errors documented as deviations above.

## User Setup Required

**External services require manual configuration.** The plan's `user_setup` specifies:
- `OPIK_API_KEY` - Sign up at https://www.comet.com/opik, get key from Settings > API Keys
- `OPIK_WORKSPACE_NAME` - Visible in Opik dashboard URL

These are required for dataset creation and experiment running. The judges work independently via Bedrock (already configured).

## Next Phase Readiness
- Evaluation types, datasets, and judges are ready for Plan 02 (experiment runner)
- Plan 02 can import `createEvaluationDataset` and all three judge classes
- EVAL-01 (datasets) and EVAL-02 (judge rubrics) requirements satisfied
- No blockers for next plan

## Self-Check: PASSED

---
*Phase: 01-evaluation-foundation*
*Completed: 2026-02-08*
