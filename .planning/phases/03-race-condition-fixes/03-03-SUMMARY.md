---
phase: 03-race-condition-fixes
plan: 03
subsystem: frontend
tags: [race-condition, polling, abort-controller, stale-response, chat, useEffect]

# Dependency graph
requires:
  - phase: 02-memory-resource-cleanup
    provides: error handling patterns
provides:
  - sequence-tracked polling prevents stale memory status updates
  - AbortController cleanup on both chat page useEffects
  - stale response detection and discard via pollSequence + latestPollIdRef
  - clean unmount cancellation for all fetch calls in chat page
affects: [chat-reliability, frontend-stability]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sequence tracking: local closure counter + shared useRef to detect stale responses"
    - "AbortController cleanup: cancel in-flight fetches on useEffect unmount"
    - "AbortError silent ignore: expected error on cleanup, not a real failure"

key-files:
  created: []
  modified:
    - app/chat/page.tsx

decisions:
  - id: poll-sequence-tracking
    title: "Use local closure + useRef for poll sequence tracking"
    rationale: "pollSequence increments per call in closure scope; latestPollIdRef persists across effect lifecycles to detect when a newer poll was initiated"
  - id: abort-controller-both-effects
    title: "Add AbortController to both useEffects in chat page"
    rationale: "Prevents state updates on unmounted components and cancels unnecessary network requests during navigation"

metrics:
  duration: 2m 0s
  completed: 2026-02-06
---

# Phase 3 Plan 3: Sequence-Tracked Polling and AbortController Summary

**Sequence-tracked memory polling with AbortController cleanup on both chat page useEffects to prevent stale state updates and unmounted component writes.**

## What Was Done

### Task 1: Add sequence tracking to memory status polling

Rewrote the memory status polling useEffect in `app/chat/page.tsx` to fix BUG-04:

- Added `latestPollIdRef = useRef(0)` to track the latest poll request ID across effect lifecycles
- Each poll call increments a local `pollSequence` counter and stores it in the ref
- When the response arrives, compares its sequence number against the ref -- if a newer poll was initiated, the stale response is discarded with a console log
- Added `AbortController` that is created at the start of the effect and aborted in the cleanup function
- `AbortError` is caught and silently ignored (expected behavior on unmount)
- The cleanup function now calls both `controller.abort()` and `clearInterval(interval)`

**Commit:** `0f82c03`

### Task 2: Add AbortController to initial data load useEffect

Added AbortController cleanup to the "Load initial state" useEffect:

- Created `AbortController` at the top of the effect
- Passed `signal: controller.signal` to all 3 fetch calls: `/api/profile/ai-name`, `/api/profile/ai-avatar`, `/api/chat/messages`
- Added `AbortError` check in the catch block before the existing error handling, so abort on unmount does not trigger the error state
- Guarded `setLoadingHistory(false)` with `!controller.signal.aborted` to prevent state update on unmounted component
- Added cleanup return function that calls `controller.abort()`

**Commit:** `92e2b05`

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Local closure counter + shared useRef for sequence tracking | `pollSequence` increments per call within the closure; `latestPollIdRef` persists across effect lifecycles via useRef, enabling stale detection even after re-renders |
| AbortController on both useEffects | Both effects make fetch calls that could complete after unmount, causing React warnings and potential bugs |

## Verification

- `npm run build` succeeds with no errors
- `npx vitest run` -- all 48 existing tests pass
- Memory polling useEffect has sequence tracking with `latestPollIdRef` (lines 45, 129, 138)
- Memory polling useEffect has AbortController with cleanup (line 190)
- Initial load useEffect passes signal to all 3 fetch calls (lines 62, 72, 81)
- Both useEffects return cleanup functions that call `controller.abort()` (lines 119, 190)
- AbortError is caught and silently ignored in both effects (lines 103, 181)

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 0f82c03 | Sequence tracking + AbortController on memory polling |
| 2 | 92e2b05 | AbortController on initial data load useEffect |

## Self-Check: PASSED
