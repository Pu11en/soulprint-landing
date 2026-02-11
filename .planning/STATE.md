# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** v3.0 Deep Memory (reliable full pass + semantic search + pgvector)

## Current Position

Milestone: v3.0 Deep Memory
Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-11 — Milestone v3.0 started

## Performance Metrics

**Velocity:**
- Total plans completed: 82 (across v1.0-v2.4 milestones)
- Average duration: ~17 min
- Total execution time: ~22 hours across 11 milestones

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
| v2.4 UX Polish | 1 | 2 | Shipped (Phase 2 deferred) |
| v3.0 Deep Memory | — | — | Active |

*Metrics updated: 2026-02-11*

## Accumulated Context

### Decisions

Recent decisions affecting current work:
- v3.0: Fix full pass reliability BEFORE adding embeddings (foundation first)
- v3.0: Supabase pgvector for vector search (no new infra, ALTER TABLE + index)
- v3.0: Budget $0.10/user for embeddings (Titan Embed v2 is ~$0.0001/100 chunks)
- v3.0: Reduce fact extraction concurrency from 10 to 3-5 to avoid rate limits
- v2.4: LLM classifier for smart search routing (conservative, heuristic fallback)
- v2.4: Google Trends filtered by user interests, zero PromptBuilder changes
- v2.4: Promise.allSettled parallelizes all chat route prep work

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)
- daily_trends table created in Supabase (v2.4)
- Two users (79898043, 39cce7a5) have pending/failed full passes — will be fixed by v3.0

### Blockers/Concerns

**Active:**
- Full pass killed by Render redeploys (every push to rlm-service/ triggers restart)
- Fact extraction costs ~$8-10 per import (2140 Haiku API calls) — need concurrency reduction
- save_chunks_batch() silently swallows errors — chunks not saved
- memory_md generated but never wired into chat responses

## Session Continuity

Last session: 2026-02-11
Stopped at: Starting v3.0 milestone definition
Resume file: None
Next step: Define requirements and create roadmap

---
*Last updated: 2026-02-11 -- Started v3.0 Deep Memory milestone. v2.4 shipped Phase 1 (animated progress), Phase 2 deferred.*
