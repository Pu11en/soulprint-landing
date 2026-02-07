---
phase: 05-gradual-cutover
plan: 02
subsystem: api
tags: [fastapi, rfc8594, deprecation, http-headers, migration]

# Dependency graph
requires:
  - phase: 05-01
    provides: "V2_ROLLOUT_PERCENT routing in Next.js import endpoint"
provides:
  - "RFC 8594 deprecation signals on v1 /process-full endpoint"
  - "Deprecation logging for v1 traffic monitoring"
  - "Response body deprecation notice for API consumers"
affects: [05-03-monitoring, 05-04-cutover-complete]

# Tech tracking
tech-stack:
  added: []
  patterns: ["RFC 8594 deprecation headers (Deprecation, Sunset, Link)"]

key-files:
  created: []
  modified: ["rlm-service/main.py"]

key-decisions:
  - "Use RFC 8594 Deprecation, Sunset, and Link headers for API deprecation signaling"
  - "Set Sunset date to March 1, 2026 (gives 3+ weeks for cutover)"
  - "Log [DEPRECATED] message with user_id for each v1 call to enable traffic monitoring"
  - "Include deprecation_notice in response body for programmatic detection"

patterns-established:
  - "Deprecation pattern: Headers + logs + response body field for comprehensive signaling"

# Metrics
duration: 1min
completed: 2026-02-07
---

# Phase 05 Plan 02: Deprecation Headers Summary

**v1 /process-full endpoint now signals deprecation via RFC 8594 headers, logs, and response body**

## Performance

- **Duration:** 47 seconds
- **Started:** 2026-02-07T11:30:48Z
- **Completed:** 2026-02-07T11:31:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added RFC 8594 Deprecation, Sunset, and Link headers to v1 endpoint
- Implemented deprecation logging with user_id for traffic monitoring
- Updated response body to include deprecation_notice field
- Updated endpoint docstring to mark as DEPRECATED

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deprecation headers to v1 /process-full endpoint** - `667ddfc` (feat)

## Files Created/Modified
- `rlm-service/main.py` - Added deprecation signals to /process-full endpoint

## Decisions Made

**DEP-01: Use RFC 8594 standard headers**
- Rationale: Industry-standard approach for API deprecation, enables automated detection
- Headers: Deprecation: true, Sunset: Sat, 01 Mar 2026 00:00:00 GMT, Link: </process-full-v2>; rel="alternate"
- Impact: API consumers can programmatically detect deprecation and plan migration

**DEP-02: Log each v1 call with user_id**
- Rationale: Enables monitoring of v1 traffic patterns during cutover
- Format: `[DEPRECATED] /process-full called by user {user_id}`
- Impact: Can track which users still hitting v1 after routing changes

**DEP-03: Sunset date set to March 1, 2026**
- Rationale: Gives 3+ weeks for gradual cutover completion (current date: Feb 7)
- Impact: Clear deadline for v1 removal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for CUT-03 (monitoring and traffic analysis):**
- ✅ Deprecation headers in place on v1 endpoint
- ✅ Logging captures user_id for each v1 call
- ✅ Response body includes deprecation_notice for programmatic detection
- ✅ v2 endpoint unchanged and functional

**Monitoring considerations:**
- Can grep Render logs for "[DEPRECATED]" to track v1 usage
- Should monitor v1 vs v2 traffic split as V2_ROLLOUT_PERCENT increases
- After 7+ days at 100% v2 traffic with no v1 calls, v1 can be safely removed

**Production sync needed:**
- This modified LOCAL copy (soulprint-landing/rlm-service/main.py)
- Production copy lives in soulprint-rlm repo at Pu11en/soulprint-rlm
- DEPLOY-03 (manual action) will sync these changes to production

## Self-Check: PASSED

All files and commits verified:
- ✅ Modified file exists: rlm-service/main.py
- ✅ Commit exists: 667ddfc

---
*Phase: 05-gradual-cutover*
*Completed: 2026-02-07*
