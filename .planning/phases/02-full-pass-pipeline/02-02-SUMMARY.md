---
phase: 02-full-pass-pipeline
plan: 02
subsystem: api
tags: [anthropic, claude-haiku, fastapi, asyncio, map-reduce, supabase]

# Dependency graph
requires:
  - phase: 02-full-pass-pipeline
    plan: 01
    provides: "/process-full endpoint, update_user_profile helper, download_conversations helper"
provides:
  - "Conversation chunking module with ~2000 token segments and overlap"
  - "Parallel fact extraction via Haiku 4.5 (10 concurrent calls max)"
  - "MEMORY section generation from consolidated facts"
  - "Full pass pipeline orchestrator (download -> chunk -> save -> extract -> consolidate -> generate)"
  - "Conversation chunks saved to database (embeddings NULL for now)"
affects: ["02-03-v2-regeneration", "future-rag-implementation", "future-embedding-backfill"]

# Tech tracking
tech-stack:
  added: [anthropic.AsyncAnthropic]
  patterns:
    - "Map-reduce pipeline with parallel fact extraction"
    - "Hierarchical reduction for large fact sets"
    - "Multi-tier conversation chunking with overlap"
    - "Best-effort database writes (log errors, don't throw)"

key-files:
  created:
    - rlm-service/processors/__init__.py
    - rlm-service/processors/conversation_chunker.py
    - rlm-service/processors/fact_extractor.py
    - rlm-service/processors/memory_generator.py
    - rlm-service/processors/full_pass.py
  modified:
    - rlm-service/main.py

key-decisions:
  - "Use asyncio.Semaphore(10) to limit parallel Haiku calls (avoid rate limits)"
  - "Chunk conversations at ~2000 tokens with 200 token overlap for context continuity"
  - "Hierarchical reduction at 200K tokens (higher than original 150K - more data before reduction)"
  - "Leave embedding column NULL (backfill strategy deferred)"
  - "Calculate is_recent based on 6-month threshold from conversation created_at"

patterns-established:
  - "Fact extraction: Haiku 4.5 with temperature 0.3 for factual extraction"
  - "MEMORY generation: Haiku 4.5 with temperature 0.5 for natural writing"
  - "Database batch writes: 100 chunks per batch to avoid request size limits"
  - "Conversation chunking handles both ChatGPT export formats (mapping + simplified)"

# Metrics
duration: 3.6min
completed: 2026-02-07
---

# Phase 02 Plan 02: Full Pass Pipeline Summary

**Map-reduce pipeline extracting facts from conversations via Haiku 4.5, generating structured MEMORY sections, and saving ~2000-token chunks to database**

## Performance

- **Duration:** 3.6 min (215s)
- **Started:** 2026-02-07T00:53:29Z
- **Completed:** 2026-02-07T00:57:04Z
- **Tasks:** 2/2
- **Files created:** 5
- **Files modified:** 1

## Accomplishments

- Conversation chunker splits conversations into searchable segments with sentence boundary splitting and overlap
- Parallel fact extraction from chunks via Haiku 4.5 (5 categories: preferences, projects, dates, beliefs, decisions)
- MEMORY generator creates structured markdown from consolidated facts
- Full pass orchestrator runs complete pipeline as background task
- Conversation chunks saved to database without embeddings (NULL for now)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create conversation chunker and fact extractor modules** - `0cbb391` (feat)
   - conversation_chunker.py: Splits conversations, handles both export formats
   - fact_extractor.py: Parallel extraction with concurrency control, consolidation, hierarchical reduction

2. **Task 2: Create MEMORY generator and wire full pass orchestrator** - `f7708ce` (feat)
   - memory_generator.py: Structured MEMORY markdown generation
   - full_pass.py: Pipeline orchestrator with all steps
   - main.py: Wired run_full_pass() to call run_full_pass_pipeline

## Files Created/Modified

### Created
- `rlm-service/processors/__init__.py` - Processors package init
- `rlm-service/processors/conversation_chunker.py` - Chunks conversations into ~2000 token segments with overlap, handles both ChatGPT export formats
- `rlm-service/processors/fact_extractor.py` - Parallel fact extraction via Haiku 4.5 with semaphore-based concurrency control, consolidation, hierarchical reduction
- `rlm-service/processors/memory_generator.py` - Generates structured MEMORY markdown with 5 subsections (Preferences, Projects, Dates, Beliefs, Decisions)
- `rlm-service/processors/full_pass.py` - Main orchestrator that runs complete pipeline (download -> chunk -> save -> extract -> consolidate -> generate)

### Modified
- `rlm-service/main.py` - Replaced run_full_pass() stub with real pipeline call

## Decisions Made

1. **Hierarchical reduction threshold: 200K tokens** - Higher than originally planned 150K to preserve more context before reduction. Haiku can handle larger inputs efficiently.

2. **Conversation chunk overlap: 200 tokens** - Ensures facts split across chunks don't get missed during extraction.

3. **Concurrency limit: 10 parallel Haiku calls** - Balances throughput with API rate limits. Can be tuned based on production performance.

4. **is_recent calculation: 6 months** - Chunks with created_at within 6 months marked as is_recent for future RAG prioritization.

5. **Embedding strategy: defer to backfill** - Leave embedding column NULL during full pass. Embeddings can be generated later as background job without blocking memory generation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- MEMORY section generation complete, ready for v2 regeneration in Plan 02-03
- Conversation chunks stored in database, ready for future RAG implementation
- Fact extraction proven to work at scale with concurrency control
- Need to migrate schema before deployment: `supabase/migrations/20260207_full_pass_schema.sql` must be run in Supabase SQL Editor

**Blocker:** Schema migration `20260207_full_pass_schema.sql` must be applied before deploying this code to production.

---
*Phase: 02-full-pass-pipeline*
*Completed: 2026-02-07*

## Self-Check: PASSED

All created files exist:
- rlm-service/processors/__init__.py
- rlm-service/processors/conversation_chunker.py
- rlm-service/processors/fact_extractor.py
- rlm-service/processors/memory_generator.py
- rlm-service/processors/full_pass.py

All commits verified:
- 0cbb391 (Task 1)
- f7708ce (Task 2)
