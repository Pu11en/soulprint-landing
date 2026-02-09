---
phase: 05-integration-validation
plan: 02
subsystem: testing
tags: [playwright, autocannon, e2e-testing, load-testing, personality-drift, latency-benchmarking]

# Dependency graph
requires:
  - phase: 01-evaluation-foundation
    provides: Opik integration, evaluation datasets
  - phase: 02-prompt-template-system
    provides: PromptBuilder for personality consistency
provides:
  - Long-session E2E test framework with 10+ message personality drift detection
  - Latency overhead benchmark script for P97.5 latency validation under concurrent load
  - Reusable test helpers for multi-turn conversation testing
affects: [ci-cd-integration, production-monitoring]

# Tech tracking
tech-stack:
  added: [autocannon, @types/autocannon]
  patterns: [long-session-testing, personality-drift-detection, latency-benchmarking]

key-files:
  created:
    - tests/e2e/helpers/long-session.ts
    - tests/e2e/long-session.spec.ts
    - scripts/latency-benchmark.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Use P97.5 percentile instead of P95 (autocannon limitation, close approximation)"
  - "Benchmark /api/health endpoint instead of /api/chat to isolate tracing overhead"
  - "Skip long-session E2E test in CI (requires authenticated user), manual run only"
  - "3-second wait after sendMessage for streaming completion (LLM streaming may be in progress)"

patterns-established:
  - "Personality drift detection: compare early vs late message violations"
  - "Autocannon benchmark pattern: check server running, measure P97.5, validate threshold"
  - "Long-session test helpers: sendMessage, runLongSession, detectPersonalityDrift exports"

# Metrics
duration: 3min
completed: 2026-02-09
---

# Phase 05 Plan 02: Long-Session Testing & Latency Benchmarking Summary

**Playwright long-session tests detect personality drift across 10+ messages; autocannon benchmarks P97.5 latency overhead under 100 concurrent connections**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-09T16:38:13Z
- **Completed:** 2026-02-09T16:41:21Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Long-session E2E test framework exercises 10-message conversations with personality drift detection
- Personality drift detection catches chatbot-like degradation (generic greetings, AI disclaimers) in late messages
- Latency benchmark script measures P97.5 overhead with configurable thresholds (default 100ms)
- Unit tests verify drift detection logic with mock responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Long-Session Test Helpers + E2E Spec** - `0d126bb` (test)
2. **Task 2: Latency Overhead Benchmark Script** - `7f54e53` (feat)
3. **Package.json fix for autocannon** - `7fae100` (chore)

## Files Created/Modified
- `tests/e2e/helpers/long-session.ts` - Reusable helpers: sendMessage, runLongSession, detectPersonalityDrift
- `tests/e2e/long-session.spec.ts` - 10-message personality test (skipped for CI), drift detection unit tests
- `scripts/latency-benchmark.ts` - Autocannon P97.5 benchmark against /api/health with pass/fail threshold
- `package.json` - Added autocannon ^8.0.0 and @types/autocannon ^7.12.7
- `package-lock.json` - Lockfile updated with autocannon dependencies

## Decisions Made

**P97.5 instead of P95:**
- Autocannon provides p97_5 (97.5th percentile), not p95
- P97.5 is close enough approximation for overhead validation
- Updated all documentation and output to reference P97.5

**Health endpoint for benchmarking:**
- /api/chat requires auth, session management, external LLM calls
- /api/health is lightest endpoint that still initializes Opik client
- Isolates tracing overhead from application logic latency

**Skip long-session test in CI:**
- Test requires authenticated user with completed soulprint
- Marked with test.skip for CI, runnable manually: `npx playwright test long-session --headed`
- Unit tests for drift detection run in CI

**3-second streaming wait:**
- Assistant messages may be streaming when selector appears
- Wait 3 seconds after message appears to let streaming complete
- Ensures full response text is captured

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fix autocannon import for TypeScript compatibility**
- **Found during:** Task 2 (Latency benchmark script compilation)
- **Issue:** `import autocannon from 'autocannon'` failed with esModuleInterop error
- **Fix:** Changed to `import * as autocannon from 'autocannon'` (namespace import)
- **Files modified:** scripts/latency-benchmark.ts
- **Verification:** `npx tsc --noEmit` passes, --help runs without errors
- **Committed in:** 7f54e53 (Task 2 commit)

**2. [Rule 1 - Bug] Fix autocannon types - use p97_5 instead of p95**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `result.latency.p95` doesn't exist - autocannon uses p97_5, p99, etc.
- **Fix:** Updated to use `result.latency.p97_5` and updated all references in docs/output
- **Files modified:** scripts/latency-benchmark.ts
- **Verification:** TypeScript compiles, benchmark runs successfully
- **Committed in:** 7f54e53 (Task 2 commit)

**3. [Rule 1 - Bug] Fix autocannon not saved to package.json**
- **Found during:** Verification (autocannon installed but not in package.json)
- **Issue:** Initial `npm install` didn't save to package.json (missing dependencies on fresh install)
- **Fix:** Ran `npm install autocannon @types/autocannon --save-dev` to persist to package.json
- **Files modified:** package.json, package-lock.json
- **Verification:** `grep autocannon package.json` shows both packages in devDependencies
- **Committed in:** 7fae100 (separate fix commit)

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All auto-fixes necessary for correct TypeScript compilation and dependency management. No scope creep.

## Issues Encountered

None - TypeScript import/type issues resolved via deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- CI/CD integration of regression tests (Plan 05-03)
- Production observability validation
- Long-session manual testing with real user accounts

**Test execution:**
- Long-session E2E: Manual run with authenticated user: `npx playwright test long-session --headed`
- Latency benchmark: Requires local dev server: `npm run dev` then `npx tsx scripts/latency-benchmark.ts`
- Drift detection unit tests: Run in CI with `npm run test:e2e`

**No blockers:** All test infrastructure complete, ready for integration into CI/CD pipeline.

---
*Phase: 05-integration-validation*
*Completed: 2026-02-09*

## Self-Check: PASSED

All created files verified:
- tests/e2e/helpers/long-session.ts: EXISTS
- tests/e2e/long-session.spec.ts: EXISTS
- scripts/latency-benchmark.ts: EXISTS

All commits verified:
- 0d126bb: EXISTS
- 7f54e53: EXISTS
- 7fae100: EXISTS
