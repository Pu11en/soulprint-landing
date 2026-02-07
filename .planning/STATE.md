# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** The import-to-chat flow must work reliably every time on production — no stuck imports, no memory leaks, no silent failures.
**Current focus:** Phase 2 - Copy & Modify Processors (v1.3 RLM Production Sync)

## Current Position

Phase: 2 of 5 (Copy & Modify Processors)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-07 — Completed 02-02-PLAN.md (Processor Unit Tests)

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (v1.3)
- Average duration: 3.1 minutes
- Total execution time: 0.16 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-dependency-extraction | 1 | 4 min | 4 min |
| 02-copy-modify-processors | 2 | 5 min | 2.5 min |

**Recent Trend:**
- Last 5 plans: 01-01 (4min), 02-01 (3min), 02-02 (2min)
- Trend: Improving velocity

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| ID | Decision | Rationale | Impact | Phase |
|----|----------|-----------|--------|-------|
| ADAPTER-01 | Read env vars inside adapter functions (not module-level) | Enables monkeypatch.setenv() to work in tests | All adapter functions use os.getenv() in function body | 01-01 |
| ADAPTER-02 | Use async context managers for httpx.AsyncClient | Prevents event loop conflicts, ensures cleanup | Each function creates AsyncClient instance | 01-01 |
| ADAPTER-03 | Default chunk_tier to "medium" if not provided | Most chunks are medium context | Processors can omit chunk_tier in chunk dicts | 01-01 |
| ADAPTER-04 | Calculate is_recent based on 180-day threshold | Aligns with production's "6 months recent" logic | save_chunks_batch enriches chunks automatically | 01-01 |
| PROC-01 | Keep delete_user_chunks in full_pass.py | Processor-specific logic, not adapter layer | delete_user_chunks reads env vars inside function body | 02-01 |
| PROC-02 | Remove local save_chunks_batch from full_pass.py | Adapter version handles is_recent enrichment | full_pass.py uses adapter save_chunks_batch | 02-01 |
| PROC-03 | Dockerfile build-time import verification | Fail fast on broken imports during build | RUN python -c import checks for adapters and processors | 02-01 |
| TEST-01 | Test only pure functions in unit tests | Functions calling external APIs require complex mocking, defer to integration tests | Unit tests focus on business logic without HTTP mocks | 02-02 |
| TEST-02 | Use simplified message format in test data | Tests can use messages list instead of full ChatGPT export mapping | Test data more readable and maintainable | 02-02 |
| TEST-03 | Mock ANTHROPIC_API_KEY in conftest.py autouse fixture | Processor modules create Anthropic clients at module level | All tests have ANTHROPIC_API_KEY available, no import errors | 02-02 |

**Project-level decisions:**
- v1.3: Separate soulprint-rlm repo — Production RLM deploys from Pu11en/soulprint-rlm, not soulprint-landing/rlm-service/ (Pending)
- v1.3: Hybrid merge for RLM sync — Add v1.2 processors to production without breaking existing endpoints (Pending)

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)
- Verify CSRF middleware rejects unauthenticated POSTs on production

### Blockers/Concerns

None - Phase 2 complete, processors copied to production repo with comprehensive test coverage.

## Session Continuity

Last session: 2026-02-07 05:08 UTC
Stopped at: Completed 02-02-PLAN.md (Processor Unit Tests)
Resume file: None

---
*Last updated: 2026-02-07 after Phase 2 Plan 02 execution*
