# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

**Current focus:** Phase 1 - Core Migration (v2.2 Bulletproof Imports)

## Current Position

Phase: 1 of 3 (Core Migration - RLM Pipeline with Streaming)
Plan: 2 of 5 complete
Status: In progress
Last activity: 2026-02-09 -- Completed 01-02-PLAN.md (Quick Pass Python Port)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 73 (across v1.0-v2.2 milestones)
- Average duration: ~18 min
- Total execution time: ~21.21 hours across 8 milestones

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
| v2.2 Imports | 3 | 2 | In progress |

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

Last session: 2026-02-09T22:29:31Z
Stopped at: Completed 01-02-PLAN.md (Quick Pass Python Port)
Resume file: None
Next step: Execute remaining plans in Phase 1 (01-03 through 01-05)

---
*Last updated: 2026-02-09 -- Phase 1 Plan 2 complete, quick pass logic ported to Python*
