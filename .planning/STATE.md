# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-07)

**Core value:** The import-to-chat flow must work reliably every time on production — no stuck imports, no memory leaks, no silent failures.
**Current focus:** Phase 4 - Pipeline Integration (v1.3 RLM Production Sync)

## Current Position

Phase: 4 of 5 (Pipeline Integration)
Plan: 2 of 2 in current phase
Status: Phase complete
Last activity: 2026-02-07 — Completed 04-02-PLAN.md (pipeline integration tests)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (v1.3)
- Average duration: 8.4 minutes
- Total execution time: 1.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-dependency-extraction | 1 | 4 min | 4 min |
| 02-copy-modify-processors | 2 | 5 min | 2.5 min |
| 03-wire-new-endpoint | 2 | 28 min | 14 min |
| 04-pipeline-integration | 2 | 19 min | 9.5 min |

**Recent Trend:**
- Last 5 plans: 02-02 (2min), 03-01 (3.5min), 03-02 (24min), 04-01 (9min), 04-02 (10min)
- Trend: Testing phases consistently ~10 minutes, implementation phases faster (~3-4 min)

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
| WIRE-01 | Use FastAPI lifespan instead of @app.on_event("startup") | FastAPI ignores ALL @app.on_event decorators when lifespan is set | All 3 startup handlers migrated to single lifespan context manager | 03-01 |
| WIRE-02 | Add processor import validation in lifespan startup | Fail-fast on missing/broken processor modules prevents silent failures | App crashes at startup if processors missing | 03-01 |
| WIRE-03 | Enhance /health with processors_available check | Enables runtime validation for Render auto-restart | Health check returns 503 if processor imports fail | 03-01 |
| WIRE-04 | Require storage_path for v2 endpoint | v2 processors designed for scalable storage-based flow | v2 endpoint returns 400 if storage_path not provided | 03-01 |
| WIRE-05 | Reuse ProcessFullRequest model for v2 endpoint | Minimizes changes, leverages existing job tracking | v1 and v2 share same request schema and job system | 03-01 |
| TEST-04 | Hybrid endpoint testing approach | Route inspection for registration, TestClient for functional checks | Endpoint tests are fast and reliable, 23 scenarios cover all endpoints | 03-02 |
| PIPE-02 | Default concurrency to 3 for Render Starter | Render Starter has 512MB RAM, concurrency=10 would OOM | FACT_EXTRACTION_CONCURRENCY env var controls parallel fact extraction (1-50, default 3) | 04-01 |
| MON-01 | Structured logging with user_id and step name | Enables production debugging via Render logs | All 9 pipeline steps log user_id and step name at boundaries | 04-01 |
| MON-03 | V2 regeneration failure is non-fatal | MEMORY section is core value, v2 sections are enhancement | Pipeline marks complete if MEMORY saved, even if v2 regen fails | 04-01 |
| TEST-05 | Mock Anthropic client with content-based prompt matching | Keeps mocks maintainable while verifying prompt construction | Integration tests match signature strings in prompt content | 04-02 |

**Project-level decisions:**
- v1.3: Separate soulprint-rlm repo — Production RLM deploys from Pu11en/soulprint-rlm, not soulprint-landing/rlm-service/ (Pending)
- v1.3: Hybrid merge for RLM sync — Add v1.2 processors to production without breaking existing endpoints (Pending)

### Pending Todos

- Run `scripts/rls-audit.sql` in Supabase SQL Editor (from v1.1 Phase 4)
- Verify CSRF middleware rejects unauthenticated POSTs on production

### Blockers/Concerns

None - Phase 4 complete.

**Phase 4 Completion Status:**
- ✅ Pipeline hardening complete (04-01)
- ✅ Integration tests complete (04-02)
- ✅ 61 tests passing (54 existing + 7 new integration tests)
- ✅ SQL migration file ready for deployment
- ✅ No regressions

**Readiness for Phase 5 (Production Sync):**
- ✅ Pipeline has configurable concurrency (safe for Render Starter)
- ✅ Structured logging at all major steps (ready for monitoring)
- ✅ Status tracking in user_profiles (UI can show progress)
- ✅ Error messages include step context (debugging-friendly)
- ✅ Integration test coverage for concurrency, logging, and full pipeline flow
- 🔄 SQL migration needs to be run in Supabase (idempotent, may already exist from v1.2)

**Note:** Processors tested with mocked dependencies. Phase 5 should include smoke test with real Supabase data.

## Session Continuity

Last session: 2026-02-07
Stopped at: Completed 04-02-PLAN.md (pipeline integration tests) - Phase 4 complete
Resume file: None

---
*Last updated: 2026-02-07 after 04-02 execution*
