# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** v3.0 Deep Memory - Phase 2: Vector Infrastructure

## Current Position

Milestone: v3.0 Deep Memory
Phase: 2 of 4 (Vector Infrastructure)
Plan: 1 of 1 complete
Status: Phase complete
Last activity: 2026-02-11 - Completed 02-01-PLAN.md (HNSW Index and Embeddings)

Progress: [██████████████████████] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 86 (across v1.0-v3.0 milestones)
- Average duration: ~15 min
- Total execution time: ~23.2 hours across 11 milestones

**By Milestone:**

| Milestone | Phases | Plans | Status |
|-----------|--------|-------|--------|
| v1.0 MVP | 1 | 1 | Shipped |
| v1.1 Stabilization | 7 | 22 | Shipped |
| v1.2 Import UX | 3 | 9 | Shipped |
| v1.3 RLM Sync | 5 | 5 | Shipped |
| v1.4 Personalization | 2 | 7 | Shipped |
| v1.5 Full Chat | 6 | 8 | Shipped |
| v2.0 AI Quality | 5 | 14 | Shipped |
| v2.1 Hardening | 3 | 4 | Shipped |
| v2.2 Imports | 3 | 8 | Shipped |
| v2.3 Uploads | 2 | 2 | Shipped |
| v2.4 UX Polish | 2 | 2 | Shipped (Phase 2 deferred) |
| v3.0 Deep Memory | 2 | 4 | Active (Phases 1-2: complete) |

*Metrics updated: 2026-02-11*

## Accumulated Context

### Decisions

Recent decisions affecting current work:
- v3.0 Phase 2 Plan 1: 768 dimensions (not 1024) — reduces storage/search cost, matches Titan v2 efficiency
- v3.0 Phase 2 Plan 1: HNSW index (not IVFFlat) — better recall for datasets < 1M rows (~250K chunks expected)
- v3.0 Phase 2 Plan 1: Sequential embedding generation — no batching API in Titan v2, consistent with concurrency=5
- v3.0 Phase 2 Plan 1: Non-fatal embedding step — chunks saved regardless, embeddings can be backfilled if generation fails
- v3.0 Phase 2 Plan 1: Manual migration via SQL Editor — safer than auto-apply in production
- v3.0 Phase 1 Plan 3: Persist storage_path to user_profiles — enables retry without re-upload
- v3.0 Phase 1 Plan 3: Guard retry with full_pass_status === 'failed' — prevents duplicate triggers
- v3.0 Phase 1 Plan 3: Fire-and-forget asyncio.create_task for retry — matches /import-full pattern
- v3.0 Phase 1 Plan 1: Error propagation (not redundant try/except) — let errors flow to trigger_full_pass
- v3.0 Phase 1 Plan 1: Concurrency 5 (not 10) — prevents rate limits entirely vs aggressive handling
- v3.0 Phase 1 Plan 1: Memory retry 2x on placeholder — balances quality vs latency
- v3.0 Phase 1: Amber warning banner for full pass failures (not red error) — non-fatal, user can still chat
- v3.0 Phase 1: Dismissible status banner reuses existing 5s polling — no new API calls
- v3.0: Fix full pass reliability BEFORE adding embeddings (foundation first)
- v3.0: Supabase pgvector for vector search (no new infra, ALTER TABLE + index)
- v3.0: Budget $0.10/user for embeddings (Titan Embed v2 is ~$0.0001/100 chunks)
- v2.4: LLM classifier for smart search routing (conservative, heuristic fallback)
- v2.4: Google Trends filtered by user interests, zero PromptBuilder changes
- v2.4: Promise.allSettled parallelizes all chat route prep work

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)
- daily_trends table created in Supabase (v2.4)
- Two users (79898043, 39cce7a5) have pending/failed full passes — will be fixed by v3.0 Phase 1

### Blockers/Concerns

**Active (v3.0 will address):**
- memory_md generated but never wired into chat responses — MEM-01 fixes

**Resolved (v3.0 Phase 1):**
- ✓ Full pass killed by Render redeploys — Users can now retry with /retry-full-pass (Plan 3)
- ✓ No retry mechanism for failed full pass — Retry button in chat UI, uses stored storage_path (Plan 3)
- ✓ save_chunks_batch() silently swallows errors — Now raises RuntimeError on HTTP failures
- ✓ Fact extraction costs ~$8-10 per import — Reduced concurrency from 10 to 5, retry with backoff
- ✓ Memory generation accepts placeholder content — Now validates and retries 2x before fallback
- ✓ Timeout doesn't update DB — trigger_full_pass() TimeoutError handler now updates full_pass_status='failed'

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 02-01-PLAN.md (HNSW Index and Embeddings)
Resume file: .planning/phases/02-vector-infrastructure/02-01-SUMMARY.md
Next step: Begin Phase 3 (Memory in Chat) — wire memory_md and semantic search into chat responses

---
*Last updated: 2026-02-11 -- Phase 2 complete. HNSW index active in Supabase, Titan Embed v2 embeddings generated during full pass. Vector infrastructure ready for Phase 3: Memory in Chat.*
