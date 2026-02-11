# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** v3.0 Deep Memory - Phase 3: Memory in Chat

## Current Position

Milestone: v3.0 Deep Memory
Phase: 4 of 4 (Cost & Quality Measurement)
Plan: 2 of 2 complete
Status: Phase complete
Last activity: 2026-02-11 - Completed 04-01-PLAN.md (Per-User Import Cost Tracking)

Progress: [████████████████████████████████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 90 (across v1.0-v3.0 milestones)
- Average duration: ~15 min
- Total execution time: ~23.6 hours across 11 milestones

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
| v3.0 Deep Memory | 4 | 8 | Complete |

*Metrics updated: 2026-02-11*

## Accumulated Context

### Decisions

Recent decisions affecting current work:
- v3.0 Phase 4 Plan 1: Optional cost_tracker parameter (not required) — backwards compatibility, existing calls work unchanged
- v3.0 Phase 4 Plan 1: Estimate embedding tokens as text_length // 4 — standard tokenization heuristic, ~95% accurate
- v3.0 Phase 4 Plan 1: Save cost data to import_cost_json TEXT column — simpler schema migration than JSONB
- v3.0 Phase 4 Plan 1: Admin endpoint returns top 50 imports — focus on recent imports for monitoring
- v3.0 Phase 3 Plan 1: match_count=8, threshold=0.3 for semantic search — balances context window with relevance
- v3.0 Phase 3 Plan 1: Fail-open fallback to timestamp sort — degrades gracefully if semantic search fails
- v3.0 Phase 3 Plan 1: Include relevance scores in context — format as (relevance: X.XX) for LLM weighting
- v3.0 Phase 3 Plan 2: Remove layered search (Macro/Thematic/Micro) — match_conversation_chunks_layered RPC doesn't exist, simplified to top-K
- v3.0 Phase 3 Plan 2: Use getSupabaseAdmin() for RPC calls — service role key bypasses RLS for memory access
- v3.0 Phase 3 Plan 2: Sequential embedding calls in embedBatch() — Titan v2 has no batch API (unlike Cohere v3)
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
- **Add import_cost_json TEXT column to user_profiles** — Run: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS import_cost_json TEXT;` in Supabase SQL Editor (required for Phase 4 Plan 1)

### Blockers/Concerns

**Resolved:**
- ✓ (v3.0 Phase 3 Plan 1) memory_md flow verified end-to-end — Chat route → RLM → PromptBuilder includes memory_md
- ✓ (v3.0 Phase 3 Plan 1) RLM uses semantic search — Top 8 relevant chunks via Titan Embed v2 + HNSW cosine similarity
- ✓ (v3.0 Phase 3 Plan 2) Query embedding dimension mismatch — Now uses 768-dim Titan v2 matching storage
- ✓ (v3.0 Phase 3 Plan 2) Broken layered search calling non-existent RPC — Simplified to match_conversation_chunks
- ✓ (v3.0 Phase 1) Full pass killed by Render redeploys — Users can now retry with /retry-full-pass (Plan 3)
- ✓ (v3.0 Phase 1) No retry mechanism for failed full pass — Retry button in chat UI, uses stored storage_path (Plan 3)
- ✓ (v3.0 Phase 1) save_chunks_batch() silently swallows errors — Now raises RuntimeError on HTTP failures
- ✓ (v3.0 Phase 1) Fact extraction costs ~$8-10 per import — Reduced concurrency from 10 to 5, retry with backoff
- ✓ (v3.0 Phase 1) Memory generation accepts placeholder content — Now validates and retries 2x before fallback
- ✓ (v3.0 Phase 1) Timeout doesn't update DB — trigger_full_pass() TimeoutError handler now updates full_pass_status='failed'

## Session Continuity

Last session: 2026-02-11
Stopped at: Completed 04-01-PLAN.md (Per-User Import Cost Tracking)
Resume file: .planning/phases/04-cost-quality-measurement/04-01-SUMMARY.md
Next step: v3.0 Deep Memory milestone COMPLETE — All 4 phases shipped. Cost tracking in place, A/B evaluation ready. Run experiments to measure memory quality impact.

---
*Last updated: 2026-02-11 -- Phase 4 complete (2/2 plans). v3.0 Deep Memory milestone SHIPPED. CostTracker instruments full pass pipeline. MemoryDepthJudge measures deep memory usage. A/B script compares quick_ready vs full_pass conditions. All cost and quality measurement infrastructure in place.*
