---
phase: 02-memory-resource-cleanup
plan: 02
subsystem: api
tags: [timeout, abort-signal, circuit-breaker, rlm, bedrock, error-handling]

# Dependency graph
requires:
  - phase: 01-testing-foundation
    provides: Test infrastructure and patterns
provides:
  - RLM timeout reduced from 60s to 15s for faster fallback
  - Modern AbortSignal.timeout() pattern across all RLM calls
  - TimeoutError differentiation in error handling
  - Circuit breaker properly records timeout failures
affects: [chat-experience, rlm-reliability, performance-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AbortSignal.timeout() for all async operations with timeouts"
    - "TimeoutError explicit handling separate from other errors"

key-files:
  created: []
  modified:
    - app/api/chat/route.ts
    - lib/rlm/health.ts
    - app/api/rlm/health/route.ts
    - app/api/import/queue-processing/route.ts

key-decisions:
  - "15s RLM timeout balances responsiveness vs. cold-start accommodation"
  - "AbortSignal.timeout() replaces manual AbortController for cleaner code"
  - "TimeoutError handling enables circuit breaker to distinguish timeout from other failures"

patterns-established:
  - "TimeoutError check via `error instanceof Error && error.name === 'TimeoutError'`"
  - "Circuit breaker recordFailure() called on timeout"
  - "All RLM-related timeouts use AbortSignal.timeout()"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 02 Plan 02: RLM Timeout Reduction Summary

**RLM service timeout reduced from 60s to 15s with modern AbortSignal.timeout() pattern and explicit TimeoutError handling across all RLM-related API routes**

## Performance

- **Duration:** 2 min 38 sec
- **Started:** 2026-02-06T15:42:10Z
- **Completed:** 2026-02-06T15:44:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Chat route RLM timeout reduced from 60s to 15s (4x faster fallback to Bedrock)
- All RLM-related timeout handling modernized to use AbortSignal.timeout()
- TimeoutError explicitly caught and handled in all RLM API routes
- Circuit breaker properly records timeout failures for fast-fail behavior
- Removed manual AbortController + setTimeout + clearTimeout patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Reduce chat route RLM timeout to 15s with TimeoutError handling** - `4295ad6` (perf)
2. **Task 2: Modernize health check and queue-processing timeout patterns** - `71197dd` (refactor)

## Files Created/Modified
- `app/api/chat/route.ts` - RLM timeout reduced to 15s, TimeoutError handling added
- `lib/rlm/health.ts` - Modernized checkRLMHealth() to use AbortSignal.timeout(5000)
- `app/api/rlm/health/route.ts` - RLM health API route uses AbortSignal.timeout(5000)
- `app/api/import/queue-processing/route.ts` - Process-server timeout uses AbortSignal.timeout(290000)

## Decisions Made

**1. 15s timeout for RLM chat queries**
- Rationale: Balances accommodation for cold-start latency (10-12s) with user experience (waiting more than 15s is poor UX)
- Impact: Users get Bedrock fallback 4x faster when RLM is slow/down

**2. Keep 290s timeout for import processing**
- Rationale: Import processing is long-running by nature (full conversation analysis + chunking + embedding)
- Impact: Different timeout values for different operation types (chat: 15s, health: 5s, import: 290s)

**3. AbortSignal.timeout() over manual AbortController**
- Rationale: Modern browser API, less boilerplate, automatic cleanup
- Impact: Cleaner code, fewer manual clearTimeout() calls to maintain

**4. Explicit TimeoutError handling**
- Rationale: Circuit breaker needs to distinguish timeout from other failures (network error, 500 response, etc.)
- Impact: Circuit breaker can make smarter decisions about when to open

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all changes were straightforward refactoring with no unexpected blockers.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Timeout handling modernized and tested
- Circuit breaker integration preserved
- All tests passing (48 tests across 4 test suites)
- Build successful with no TypeScript errors

**Potential follow-up work (not blocking):**
- Consider adding telemetry to track actual RLM response times in production
- Monitor circuit breaker state transitions to tune FAILURE_THRESHOLD and COOLDOWN_MS
- Evaluate if 15s is the right balance after production usage data

---
*Phase: 02-memory-resource-cleanup*
*Completed: 2026-02-06*

## Self-Check: PASSED

All files exist:
- app/api/chat/route.ts
- lib/rlm/health.ts
- app/api/rlm/health/route.ts
- app/api/import/queue-processing/route.ts

All commits exist:
- 4295ad6
- 71197dd
