---
phase: 05-observability
plan: 01
subsystem: observability
tags: [pino, logging, correlation-id, structured-logging, middleware]

# Dependency graph
requires:
  - phase: 04-security-hardening
    provides: Centralized error handler, rate limiting, CSRF middleware
provides:
  - Pino logger factory with environment-aware configuration
  - Correlation ID injection in middleware for request tracing
  - Structured logging in error handler and 4 critical API routes
  - Request lifecycle tracking with duration, status, user ID
affects: [06-performance, future debugging, production monitoring]

# Tech tracking
tech-stack:
  added: [pino, pino-pretty]
  patterns:
    - "createLogger(context) factory pattern for child loggers"
    - "Correlation ID propagation via request headers"
    - "Structured JSON logs in production, pretty-print in development"
    - "Sensitive field redaction (auth, cookies, passwords, tokens)"
    - "Request duration tracking (startTime to completion)"

key-files:
  created:
    - lib/logger/index.ts
  modified:
    - middleware.ts
    - lib/api/error-handler.ts
    - app/api/chat/route.ts
    - app/api/import/process-server/route.ts
    - app/api/import/chunked-upload/route.ts
    - app/api/memory/query/route.ts
    - lib/api/error-handler.test.ts

key-decisions:
  - "Use Pino over Winston for performance and modern JSON logging"
  - "Generate correlation IDs in Edge-compatible middleware using crypto.randomUUID()"
  - "Don't import Pino in middleware (Edge runtime incompatible) - only set headers"
  - "Replace console.error in error handler but keep selective console.log for hot path only"
  - "Support LOG_LEVEL env var override for production debugging"

patterns-established:
  - "const log = createLogger('Context:Name') at module level for consistent context"
  - "const reqLog = log.child({ correlationId, userId, method, endpoint }) for per-request tracking"
  - "Track startTime = Date.now() and log duration at completion"
  - "Pass correlationId to handleAPIError for error-request linkage"
  - "Log request start (info), completion (info with duration/status), errors (error)"

# Metrics
duration: 6m 18s
completed: 2026-02-06
---

# Phase 5 Plan 1: Observability Summary

**Pino structured logging with correlation ID tracking across error handler and 4 critical routes (chat, import-process, chunked-upload, memory-query)**

## Performance

- **Duration:** 6m 18s
- **Started:** 2026-02-06T18:13:21Z
- **Completed:** 2026-02-06T18:19:39Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed Pino with environment-aware configuration (JSON in prod, pretty-print in dev)
- Correlation ID injection in middleware via crypto.randomUUID()
- Centralized error handler uses structured logging with correlation ID
- 4 critical API routes log request lifecycle with duration, user ID, status
- All tests pass with updated Pino logger mocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Pino, create logger factory, inject correlation ID in middleware** - `ecba105` (feat)
2. **Task 2: Integrate structured logging into error handler and critical routes** - `adeb3cd` (feat)

## Files Created/Modified
- `lib/logger/index.ts` - Pino logger factory with createLogger(context), redacts sensitive fields
- `middleware.ts` - Injects x-correlation-id via crypto.randomUUID() into request and response headers
- `lib/api/error-handler.ts` - Replaced console.error with Pino, added correlationId parameter and APIErrorResponse field
- `app/api/chat/route.ts` - Structured logging for chat requests with duration, RLM/Bedrock metrics, memory search
- `app/api/import/process-server/route.ts` - Logs processing stages (download, parse, compress, RLM job submission)
- `app/api/import/chunked-upload/route.ts` - Logs chunk assembly and upload completion with duration
- `app/api/memory/query/route.ts` - Logs memory search results count and duration
- `lib/api/error-handler.test.ts` - Updated tests to mock Pino logger.error instead of console.error

## Decisions Made

1. **Pino over Winston** - Better performance, native JSON output, modern ecosystem
2. **Edge-compatible correlation ID generation** - Use crypto.randomUUID() in middleware, don't import Pino (Node.js APIs incompatible with Edge runtime)
3. **Selective console.log replacement** - Only replaced hot path logging (request entry/completion/errors), left non-critical logs for Phase 6+ cleanup
4. **LOG_LEVEL env var support** - Defaults to 'debug' in dev, 'info' in prod, but overridable for production debugging
5. **Sensitive field redaction** - Automatically remove auth headers, cookies, passwords, tokens, secrets from all logs

## Deviations from Plan

None - plan executed exactly as written. The plan correctly identified Edge runtime incompatibility and specified correlation ID injection via headers only.

## Issues Encountered

**Peer dependency conflict during npm install:**
- **Issue:** Next.js 16 conflicts with @edge-csrf/nextjs peer dependency requirement
- **Resolution:** Used `npm install --legacy-peer-deps` flag
- **Impact:** None - existing packages remain functional, conflict is version constraint only

**Test failures after Pino integration:**
- **Issue:** error-handler.test.ts expected console.error spy, but we replaced with Pino
- **Resolution:** Updated tests to spy on logger.error instead, verified Pino logging works
- **Impact:** All tests pass, validation complete

## User Setup Required

None - no external service configuration required. LOG_LEVEL env var is optional override (defaults work for all environments).

## Next Phase Readiness

**Ready for Phase 5 Plan 2 (Metrics & Monitoring):**
- Correlation ID infrastructure in place for distributed tracing
- Structured logs ready for log aggregation (Vercel Logs, Datadog, etc.)
- Error handler includes correlation ID in all error responses
- Duration tracking established for performance monitoring baseline

**Ready for Production Debugging:**
- All errors include correlation ID for request tracing
- Request lifecycle fully logged (start, key operations, completion)
- Sensitive data automatically redacted from logs
- LOG_LEVEL override available for production troubleshooting

## Self-Check: PASSED

All files created and commits verified:
- ✓ lib/logger/index.ts exists
- ✓ Commit ecba105 exists (Task 1)
- ✓ Commit adeb3cd exists (Task 2)

---
*Phase: 05-observability*
*Completed: 2026-02-06*
