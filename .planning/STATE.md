# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** Phase 2 - Parsing Quality (v2.2 Bulletproof Imports)

## Current Position

Phase: 2 of 3 (Parsing Quality - DAG Traversal and Content Handling)
Plan: 0 of TBD complete
Status: Planning
Last activity: 2026-02-10 -- Phase 1 verified on production (2 imports passed)

Progress: [██████████] Phase 1 COMPLETE

## Performance Metrics

**Velocity:**
- Total plans completed: 76 (across v1.0-v2.2 milestones)
- Average duration: ~17 min
- Total execution time: ~21.25 hours across 8 milestones

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
| v2.2 Imports | 3 | 5 | In progress |

*Metrics updated: 2026-02-09*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

Recent decisions affecting current work:
- v2.2: Move heavy processing from Vercel to RLM (Render) — Vercel is the bottleneck (1GB RAM, 300s timeout)
- v2.2: Use ijson streaming JSON parser for constant-memory processing of any size export (tested up to 2GB)
- v2.2: Port convoviz-quality parsing — DAG traversal, hidden message filtering, polymorphic content.parts
- v2.2: Vercel becomes thin proxy (auth + trigger), RLM does all heavy lifting
- 01-01: Track progress with progress_percent (0-100) and import_stage (text) for real-time UI updates
- 01-01: Upgrade anthropic to anthropic[bedrock] for AWS Bedrock Claude support
- 01-02: Use AnthropicBedrock client for quick pass instead of direct boto3
- 01-02: Port exact system prompt (4377 chars) and scoring algorithm from TypeScript
- 01-03: Temp file streaming approach (httpx -> disk -> ijson) for constant-memory import processing
- 01-03: JSONResponse(status_code=202) for proper HTTP 202 Accepted in FastAPI
- 01-03: Quick pass failure sets import_status='failed' (not 'quick_ready') to allow retry
- 01-04: 10s RLM acceptance timeout, AbortError non-fatal (fire-and-forget pattern)
- 01-04: Frontend polls user_profiles every 2s for real progress from RLM
- 01-04: Check both quick_ready and complete status for RLM completion

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)

### Blockers/Concerns

**Known gaps addressed in v2.2:**
- Import parsing only takes `parts[0]` — misses multi-part content (PAR-03)
- Import dumps ALL conversation nodes — includes dead branches from edits (PAR-01)
- Import doesn't filter hidden messages — tool outputs, browsing noise (PAR-02)
- Import doesn't handle `{ conversations: [...] }` wrapper format (PAR-04)
- Large exports OOM on Vercel — 1GB RAM limit, 300s timeout (IMP-01, IMP-02)

**New concerns for v2.2:**
- Render cold start delays (up to 60s) require explicit UX handling
- ChatGPT export format variations (no official spec) need defensive parsing
- Mobile large file testing needed for 100MB+ files on iOS/Android

## Session Continuity

Last session: 2026-02-10T00:00:00Z
Stopped at: Phase 1 complete, verified on production
Resume file: None
Next step: Plan Phase 2 (Parsing Quality — DAG traversal)

---
*Last updated: 2026-02-10 -- Phase 1 COMPLETE (5/5 plans, 2 imports verified on prod)*
