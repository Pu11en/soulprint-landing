---
phase: 01-progress-stage-animations
plan: 01
subsystem: frontend-ui
type: feature
tags: [import-ux, progress-ui, animations, framer-motion]
requires: []
provides:
  - progress-mapper-logic
  - animated-stage-component
  - monotonic-progress
affects: [02-import-integration]
tech-stack:
  added: []
  patterns:
    - pure-function-progress-mapping
    - stage-based-progress-ui
    - framer-motion-animations
key-files:
  created:
    - lib/import/progress-mapper.ts
    - lib/import/progress-mapper.test.ts
    - components/import/animated-progress-stages.tsx
  modified: []
decisions:
  - id: PROG-MAP-01
    choice: Pure function mapper with monotonic guard client-side
    rationale: Keeps UI state stable even if backend sends inconsistent progress
  - id: PROG-STAGE-01
    choice: 4-stage model (Upload 0-49%, Extract 50-59%, Analyze 60-79%, Build 80-100%)
    rationale: Maps to actual import pipeline phases, provides meaningful milestones
  - id: PROG-ANIM-01
    choice: Framer Motion for stage transitions with 300ms duration
    rationale: Already installed, smooth GPU-composited animations
  - id: PROG-PERF-01
    choice: No SVG drop-shadow filters, GPU-composited properties only
    rationale: Mobile performance - opacity and transform are hardware accelerated
metrics:
  duration: 5 minutes
  completed: 2026-02-11
---

# Phase 1 Plan 1: Progress Mapper + Animated Stages Summary

**One-liner:** Pure function progress mapper with monotonic guard + 4-stage animated stepper component using Framer Motion

## What Was Built

Created the foundational building blocks for stage-based import progress UI:

1. **Progress Mapper (`lib/import/progress-mapper.ts`)**: Pure function module that converts backend progress data (percent + stage string) into structured frontend stage information. Implements monotonic guard to prevent progress from ever decreasing, maps backend stage strings to user-friendly labels, and determines which of 4 visual stages we're in.

2. **Animated Stage Component (`components/import/animated-progress-stages.tsx`)**: React component that renders a 4-stage stepper UI with Framer Motion animations. Features pulsing active stage, checkmarks on completed stages, smooth transitions, shimmer progress bar, and context messages that guide users on whether it's safe to close the tab.

3. **Comprehensive Unit Tests**: 32 tests covering all edge cases including monotonic guard behavior, stage boundary calculations, backend string mapping, clamping, and per-stage progress calculation.

## Task Breakdown

| Task | Type | Description | Commit |
|------|------|-------------|--------|
| 1 | auto | Progress mapper with monotonic guard and stage mapping | f4dea89 |
| 2 | auto | Animated progress stages component | efb8430 |

## Task Commits

**Task 1: Progress mapper with monotonic guard and stage mapping**
- Commit: `f4dea89`
- Files: `lib/import/progress-mapper.ts`, `lib/import/progress-mapper.test.ts`
- Summary: Created pure function module with `mapProgress()`, `getStageProgress()`, and `STAGES` constant. Implements 4-stage model with monotonic guard to prevent progress regression. All 32 unit tests pass.

**Task 2: Animated progress stages component**
- Commit: `efb8430`
- Files: `components/import/animated-progress-stages.tsx`, `lib/import/progress-mapper.ts` (TypeScript fixes)
- Summary: Created React component with 4-stage stepper, Framer Motion animations (300ms transitions, pulsing active stage), shimmer progress bar, and context messages. Fixed TypeScript undefined guards in mapper. Build succeeds with no errors.

## Key Features

**Progress Mapper:**
- 4 stages: Upload (0-49%), Extract (50-59%), Analyze (60-79%), Build Profile (80-100%)
- Monotonic guard: `effectivePercent = Math.max(backendPercent, lastKnownPercent)`
- Backend stage string mapping to user-friendly labels
- `safeToClose` flag at 55% threshold
- `getStageProgress()` helper for per-stage progress bars

**Animated Component:**
- Stage stepper with Lucide icons: Upload, FileSearch, Sparkles, Fingerprint
- Completed stages: orange background + checkmark
- Active stage: orange border + pulsing animation (scale + glow)
- Pending stages: greyed out
- Framer Motion transitions: 300ms fade + slide
- Shimmer progress bar with `animate-pulse` overlay
- Context messages adjust based on `safeToClose` threshold
- No SVG drop-shadow filters (mobile performance)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict mode errors**

- **Found during:** Task 2 build verification
- **Issue:** TypeScript strict mode flagged `STAGES[i]` and `STAGES[stageIndex]` as possibly undefined
- **Fix:** Added explicit undefined guards in `getStageIndexFromPercent()` and `getStageProgress()` functions
- **Files modified:** `lib/import/progress-mapper.ts`
- **Commit:** `efb8430`
- **Rationale:** Required for build to succeed. Guards are defensive programming best practice even though array access should always succeed.

## Testing

**Unit Tests:**
- All 32 tests pass in `lib/import/progress-mapper.test.ts`
- Coverage: monotonic guard, stage boundaries, clamping, backend string mapping, safeToClose/isComplete flags, per-stage progress calculation, edge cases (0%, 100%)

**Build Verification:**
- `npm run build` succeeds with no TypeScript errors
- Component properly exports `AnimatedProgressStages`
- Mapper properly exports `mapProgress`, `STAGES`, `StageInfo`, `getStageProgress`

## Decisions Made

1. **Pure function mapper (PROG-MAP-01)**: Keeps progress mapping logic separate from React rendering, easier to test, no side effects
2. **4-stage model (PROG-STAGE-01)**: Maps to actual pipeline phases (upload → extract → analyze → build), provides meaningful milestones for users
3. **Framer Motion 300ms transitions (PROG-ANIM-01)**: Already installed, smooth animations, consistent with existing UI
4. **GPU-composited animations only (PROG-PERF-01)**: No SVG drop-shadow filters, use opacity + transform for mobile performance

## Integration Points

**Used by (next phase):**
- `app/import/page.tsx` will integrate `AnimatedProgressStages` component
- Import page polling loop will call `mapProgress()` to get stage info
- Component will replace existing ring progress indicator

**Depends on:**
- Framer Motion 12.29.2 (already installed)
- Lucide React icons (already installed)
- Vitest for testing (already configured)

## Next Phase Readiness

**Ready for Phase 1 Plan 2:**
- ✅ Progress mapper ready to integrate into import page
- ✅ Animated component ready to render
- ✅ All tests passing
- ✅ Build succeeds
- ✅ No new dependencies added
- ✅ TypeScript strict mode compliant

**Blockers:** None

**Technical debt:** None - clean implementation with proper tests

## Performance Notes

**Animation Performance:**
- Active stage pulse: `scale` and `opacity` only (GPU-composited)
- Progress bar width: Framer Motion optimized `width` animation with `will-change: width`
- Stage transitions: 300ms is imperceptible lag, feels instant
- No layout thrashing: transitions use `transform` and `opacity` only
- Shimmer overlay: CSS `animate-pulse` is hardware accelerated

**Mobile Considerations:**
- No SVG filters (per research, these kill mobile perf)
- Will-change hints for animated elements
- Framer Motion automatically optimizes for device capability

## Files Changed

**Created:**
- `lib/import/progress-mapper.ts` (168 lines) - Pure function mapper with stage definitions
- `lib/import/progress-mapper.test.ts` (206 lines) - Comprehensive unit tests
- `components/import/animated-progress-stages.tsx` (220 lines) - Animated stage component

**Modified:**
- None (except TypeScript guard fix in mapper during Task 2)

## Verification Checklist

- ✅ `npx vitest run lib/import/progress-mapper.test.ts` — all 32 tests pass
- ✅ `npm run build` — no TypeScript errors
- ✅ `components/import/animated-progress-stages.tsx` exports AnimatedProgressStages
- ✅ `lib/import/progress-mapper.ts` exports mapProgress, STAGES, StageInfo, getStageProgress
- ✅ No new dependencies added to package.json
- ✅ Progress mapper correctly converts backend percent/stage to frontend stage model
- ✅ Monotonic guard prevents progress from ever decreasing
- ✅ Stage component renders 4 visual stages with active/complete/pending states
- ✅ Active stage has pulsing animation (never appears stalled)
- ✅ Stage transitions use 300ms Framer Motion animation
- ✅ No SVG drop-shadow filters (mobile performance)

## Self-Check: PASSED

**Created files verification:**
- ✅ lib/import/progress-mapper.ts exists
- ✅ lib/import/progress-mapper.test.ts exists
- ✅ components/import/animated-progress-stages.tsx exists

**Commits verification:**
- ✅ f4dea89 exists (Task 1: progress mapper)
- ✅ efb8430 exists (Task 2: animated component)
