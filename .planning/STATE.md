# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** The import-to-chat flow must work reliably every time on production
**Current focus:** v1.2 Import UX Streamline -- Phase 2: Full Pass Pipeline

## Current Position

Phase: 2 of 3 (Full Pass Pipeline)
Plan: 3 of 3 in current phase
Status: Phase complete
Last activity: 2026-02-07 -- Completed 02-03-PLAN.md

Progress: [######....] 60% (6/10 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3.1min
- Total execution time: 19.1min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Schema + Quick Pass Pipeline | 3/3 | 11min | 3.7min |
| 2. Full Pass Pipeline | 3/3 | 8.1min | 2.7min |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.2: Replace monolithic soulprint_text with 7 structured sections (SOUL, IDENTITY, USER, AGENTS, TOOLS, MEMORY, daily memory)
- v1.2: Two-pass pipeline -- quick pass (~30s, Haiku 4.5) for 5 sections, full pass (RLM background) for MEMORY + v2 regen
- v1.2: Gate chat on quick pass completion only, let MEMORY build in background
- v1.2: Remove "SoulPrint is ready" email (users are already chatting by then)
- 01-01: Use z.preprocess for permissive Zod 4 object defaults
- 01-01: Promoted ParsedConversation/ConversationMessage to shared exports in lib/soulprint/types.ts
- 01-02: Store sections as JSON.stringify'd strings in TEXT *_md columns
- 01-02: Quick pass runs synchronously between conversation parsing and RLM fire-and-forget
- 01-02: Replaced local type duplicates in process-server with shared imports
- 02-01: Use FastAPI BackgroundTasks for async dispatch (cleaner than asyncio.create_task)
- 02-01: Status updates to Supabase are best-effort (log errors, don't throw)
- 02-01: Stub marks status as 'complete' after 1s sleep (Plan 02-02 will add real processing)
- 02-02: Hierarchical reduction at 200K tokens (higher than 150K - preserve more context)
- 02-02: Chunk conversations at ~2000 tokens with 200 token overlap for context continuity
- 02-02: Concurrency limit of 10 parallel Haiku calls for fact extraction
- 02-02: Leave embedding column NULL (backfill strategy deferred)
- 02-02: Calculate is_recent based on 6-month threshold from conversation created_at
- 02-03: Use same 5-section schema for v2 as quick pass (only input changes)
- 02-03: Sample top 200 conversations for v2 (vs 30-50 for quick pass)
- 02-03: V2 regeneration failure is non-fatal (v1 sections stay, MEMORY still saved)
- 02-03: Store sections with json.dumps() to match Phase 1 convention

### Pending Todos

- Run `supabase/migrations/20260206_add_tools_md.sql` in Supabase SQL Editor
- Run `supabase/migrations/20260207_full_pass_schema.sql` in Supabase SQL Editor (MUST execute before deploying Plans 02-02/02-03)
- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)
- Verify CSRF middleware rejects unauthenticated POSTs on production

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed 02-03-PLAN.md -- Phase 2 Complete
Resume file: None

---
*Created: 2026-02-06*
*Last updated: 2026-02-07*
