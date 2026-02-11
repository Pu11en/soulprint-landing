---
phase: 01-pipeline-reliability
plan: 02
subsystem: chat-ui
tags: [ui, user-feedback, error-visibility, full-pass]
dependency_graph:
  requires: [PIPE-04]
  provides: [full-pass-status-banner]
  affects: [chat-ui, memory-status-polling]
tech_stack:
  added: [FullPassBanner-component]
  patterns: [dismissible-banner, polling-updates, amber-warning-colors]
key_files:
  created: []
  modified:
    - app/chat/page.tsx
    - app/api/memory/status/route.ts
decisions:
  - id: PIPE-04-BANNER-DESIGN
    choice: Dismissible amber banner for failures (not red)
    rationale: Full pass failure is non-fatal — user can still chat with quick-pass data. Amber conveys warning without panic.
    alternatives: [red-error-banner, modal-dialog, toast-notification]
  - id: PIPE-04-BANNER-PLACEMENT
    choice: Fixed overlay above chat messages, inside motion wrapper
    rationale: Visible but non-intrusive. Users see it immediately but can dismiss. Doesn't block chat functionality.
    alternatives: [inline-in-header, bottom-toast, sidebar-notice]
  - id: PIPE-04-POLLING-REUSE
    choice: Reuse existing 5s polling in checkMemoryStatus
    rationale: Already polls for memory status. Just added state setters for fullPassStatus/Error. No new polling needed.
    alternatives: [new-polling-endpoint, websocket-updates, manual-refresh]
metrics:
  duration: 2m 6s
  tasks_completed: 1
  tasks_total: 1
  completed_date: 2026-02-11
---

# Phase 01 Plan 02: Full Pass Status UI Summary

**One-liner:** Users now see dismissible banner showing "Building deep memory..." during processing and specific error details when full pass fails.

## What Was Built

Added visible full pass status banner to chat UI, surfacing deep memory processing state and error details that were previously only logged to console. Users now get real-time feedback on full pass progress via existing 5s polling.

**Before:** Full pass failures silently logged to `console.warn` (line 252). Users had no idea their deep memory processing failed or was still running.

**After:** Dismissible banner shows:
- **Processing:** Blue banner with spinner: "Building deep memory from your conversations..."
- **Failed:** Amber banner with error details: "Deep memory processing encountered an issue" + specific error message + "Your AI still works with quick-pass data. Deep memory can be retried later."
- **Complete/Pending:** No banner (non-intrusive)

## Implementation Details

### API Changes (app/api/memory/status/route.ts)
- Added `full_pass_started_at` to select query (line 23) — enables future "Processing since X minutes ago..." display
- Added `fullPassStartedAt` to API response (line 70) — available for UI to show duration

### UI Changes (app/chat/page.tsx)
- **State:** Added `fullPassStatus`, `fullPassError`, `fullPassDismissed` state variables (lines 55-57)
- **Polling:** Updated `checkMemoryStatus` to call `setFullPassStatus(fps)` and `setFullPassError(...)` (lines 248-249)
- **Component:** Added `FullPassBanner` component (lines 853-881):
  - Returns `null` for 'complete' or 'pending' (non-intrusive)
  - Blue banner with spinner for 'processing'
  - Amber banner with error details for 'failed'
  - Dismissible via close button (updates `fullPassDismissed` state)
- **Rendering:** Banner rendered in motion wrapper after main chat area (line 938) — only if not dismissed

### Design Rationale

**Amber (warning) for failures, not red (error):**
- Full pass failure is non-fatal — quick-pass data still works
- User can still chat normally
- Amber conveys "heads up" not "critical error"

**Dismissible banner:**
- User can close if they don't care about deep memory
- Doesn't block chat functionality
- Reappears on page refresh if still failed (state is ephemeral)

**Reuses existing polling:**
- Already polls `/api/memory/status` every 5s
- Just added state updates to existing logic
- No new API calls or polling loops

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

1. ✅ `full_pass_started_at` added to API select query (line 23)
2. ✅ `fullPassStartedAt` returned in API response (line 70)
3. ✅ `fullPassStatus`, `fullPassError`, `fullPassDismissed` state exist (lines 55-57)
4. ✅ `FullPassBanner` component exists with processing/failed states (lines 853-881)
5. ✅ Banner rendered in JSX with dismissible logic (line 938)
6. ✅ Banner uses amber for failures, blue for processing
7. ✅ `npm run build` succeeded — no TypeScript errors

## Next Phase Readiness

**Blockers:** None

**Dependencies satisfied:**
- ✅ PIPE-04 requirement: Full pass status visible in chat UI (not just console)

**Follow-up work:**
- Future enhancement: Show "Processing since 5 minutes ago..." using `fullPassStartedAt`
- Future enhancement: Add "Retry full pass" button in failure banner (requires new API endpoint)

## Self-Check: PASSED

**Files created:** None (component added inline)

**Files modified:**
```bash
✅ app/chat/page.tsx exists
✅ app/api/memory/status/route.ts exists
```

**Commits:**
```bash
✅ 49bd945 exists: feat(01-pipeline-reliability-02): add full pass status banner to chat UI
```

All claims verified. Summary accurate.
