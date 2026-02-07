---
phase: 06-prompt-foundation
plan: 02
subsystem: api
tags: [prompt, ai, personalization, memory, anti-generic]

# Dependency graph
requires:
  - phase: 06-01
    provides: cleanSection and formatSection helpers from prompt-helpers.ts
provides:
  - Next.js buildSystemPrompt using cleanSection + formatSection for all 5 JSON sections
  - Anti-generic banned phrases list in system prompt
  - Memory context usage instructions in system prompt
  - Guaranteed no "not enough data" in Next.js prompt output
affects: [06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass prompt building: cleanSection removes placeholders, formatSection adds formatting"
    - "Explicit behavioral rules section in system prompt"
    - "Natural memory referencing instructions"

key-files:
  created: []
  modified:
    - app/api/chat/route.ts

key-decisions:
  - "Replaced sectionToMarkdown with cleanSection + formatSection for consistency with RLM path"
  - "Added explicit anti-generic phrases list (10 specific banned phrases)"
  - "Added memory context instructions to teach AI natural referencing"

patterns-established:
  - "System prompt includes IMPORTANT BEHAVIORAL RULES section with banned phrases and memory instructions"
  - "All JSON sections cleaned before formatting to prevent placeholder leakage"

# Metrics
duration: 2.5min
completed: 2026-02-07
---

# Phase 6 Plan 02: Next.js Prompt Builder Update Summary

**Next.js buildSystemPrompt now uses cleanSection + formatSection with anti-generic phrases and memory instructions**

## Performance

- **Duration:** 2.5 min
- **Started:** 2026-02-07T23:03:11Z
- **Completed:** 2026-02-07T23:05:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced sectionToMarkdown with cleanSection + formatSection from prompt-helpers.ts
- Added explicit anti-generic banned phrases list (10 specific phrases)
- Added memory context usage instructions ("Like we talked about..." not "According to context...")
- Added instruction to embody SOUL/AGENTS sections
- All 5 JSON sections now cleaned before formatting
- Guaranteed no "not enough data" can appear in prompt output

## Task Commits

Each task was committed atomically:

1. **Task 1: Update buildSystemPrompt() with new helpers + memory/anti-generic instructions** - `78b3a8a` (feat)

## Files Created/Modified
- `app/api/chat/route.ts` - Updated buildSystemPrompt to use cleanSection + formatSection, added IMPORTANT BEHAVIORAL RULES section

## Decisions Made

1. **Import replacement:** Replaced sectionToMarkdown import with cleanSection + formatSection from prompt-helpers.ts
2. **Two-pass processing:** Call cleanSection first to remove placeholders, then formatSection for markdown
3. **Behavioral rules placement:** Added IMPORTANT BEHAVIORAL RULES section after base prompt, before sections
4. **Banned phrases list:** Explicit list of 10 chatbot cliche phrases to avoid
5. **Memory instructions:** Teach AI to reference memories naturally as if recalling, not citing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward refactor, all tests passed.

## Next Phase Readiness

- Next.js prompt builder complete, matches RLM prompt builder pattern
- Ready for 06-03 (RLM prompt builder update) to apply same helpers
- Both paths will use identical section processing logic
- No "not enough data" can appear in either path

## Self-Check: PASSED

---
*Phase: 06-prompt-foundation*
*Completed: 2026-02-07*
