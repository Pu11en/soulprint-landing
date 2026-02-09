---
phase: 02-prompt-template-system
plan: 02
subsystem: api
tags: [prompt-engineering, python, cross-language, testing, rlm]

# Dependency graph
requires:
  - phase: 02-prompt-template-system
    provides: "PromptBuilder class with v1-technical and v2-natural-voice (plan 01)"
provides:
  - "Python PromptBuilder class mirroring TypeScript version character-for-character"
  - "Cross-language prompt sync tests verifying v1 and v2 hash equality"
  - "RLM main.py using PromptBuilder instead of inline build_rlm_system_prompt"
  - "Injectable currentDate/currentTime params for deterministic testing"
affects:
  - "02-03 (prompt verification scripts -- can use PromptBuilder directly)"
  - "03-personality-tuning (Python PromptBuilder enables RLM-side v2 testing)"
  - "rlm-service deployment (prompt_builder.py must be included)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-language prompt sync pattern: JSON blob param serialization for subprocess testing"
    - "Python _parse_section_safe handles both dict and JSON string inputs"
    - "_sections_to_profile helper converts legacy sections dict to PromptBuilder profile format"

key-files:
  created:
    - "rlm-service/prompt_builder.py"
    - "__tests__/cross-lang/prompt-sync.test.ts"
  modified:
    - "rlm-service/main.py"
    - "lib/soulprint/prompt-builder.ts"

key-decisions:
  - "Added injectable currentDate/currentTime to TypeScript PromptParams for deterministic cross-language testing"
  - "Python _parse_section_safe handles both dict and JSON string inputs (TypeScript only handles strings)"
  - "Used JSON blob serialization for subprocess params to avoid shell escaping issues"
  - "Created _sections_to_profile helper to bridge legacy sections dict format to PromptBuilder profile format"

patterns-established:
  - "Cross-language testing pattern: serialize all params as single JSON blob, pass to Python subprocess"
  - "Profile adapter pattern: _sections_to_profile converts legacy dict keys to _md suffixed profile keys"

# Metrics
duration: 4min
completed: 2026-02-09
---

# Phase 2 Plan 2: Cross-Language Prompt Sync Summary

**Python PromptBuilder mirroring TypeScript character-for-character with 8 cross-language sync tests verifying v1, v2, imposter, and web search prompt equality**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-09T03:22:41Z
- **Completed:** 2026-02-09T03:26:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created Python PromptBuilder (372 lines) that produces character-identical output to TypeScript for v1-technical, v2-natural-voice, and imposter mode
- Wired PromptBuilder into rlm-service/main.py, replacing all build_rlm_system_prompt call sites (query_with_rlm and query_fallback)
- Created 8 cross-language sync tests covering v1, v2, imposter mode, web search, and minimal profile scenarios -- all passing
- Added injectable currentDate/currentTime to TypeScript PromptParams for deterministic cross-language testing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Python PromptBuilder and wire into rlm-service** - `1d24e63` (feat)
2. **Task 2: Create cross-language prompt sync tests** - `2e1e26f` (test)

## Files Created/Modified
- `rlm-service/prompt_builder.py` - Python PromptBuilder class with v1-technical, v2-natural-voice, imposter mode, get_prompt_version(), _parse_section_safe()
- `__tests__/cross-lang/prompt-sync.test.ts` - 8 cross-language tests verifying TypeScript/Python prompt output equality via subprocess
- `rlm-service/main.py` - Replaced build_rlm_system_prompt with PromptBuilder, added _sections_to_profile adapter
- `lib/soulprint/prompt-builder.ts` - Added optional currentDate/currentTime to PromptParams for injectable timestamps

## Decisions Made
- **Injectable timestamps:** Added currentDate/currentTime to TypeScript PromptParams so cross-language tests can fix timestamps and compare deterministically (without this, Date.now() differences cause false failures)
- **JSON blob serialization:** Used single JSON blob for subprocess param passing instead of individual string interpolation, avoiding shell escaping and double-quoting bugs
- **Profile adapter pattern:** Created _sections_to_profile() in main.py to convert the legacy `{ soul, identity, user, ... }` dict format to the PromptBuilder-expected `{ soul_md, identity_md, user_md, ... }` format
- **Python _parse_section_safe handles dicts:** TypeScript version only handles JSON strings (from DB), but Python needs to handle both dicts (from in-memory sections) and strings (from DB), so the Python version includes an `isinstance(raw, dict)` path

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test helper double-quoting string params**
- **Found during:** Task 2 (cross-language tests)
- **Issue:** Initial implementation used `JSON.stringify(JSON.stringify(value))` for string params, causing Python to receive values with extra quotes (e.g., `"Claw"` instead of `Claw`)
- **Fix:** Switched to single JSON blob serialization pattern -- all params packed into one object and passed via `json.loads()` in Python
- **Files modified:** `__tests__/cross-lang/prompt-sync.test.ts`
- **Verification:** All 8 tests pass after fix
- **Committed in:** 2e1e26f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug was in test helper, not production code. No scope creep.

## Issues Encountered
None beyond the test helper quoting issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Python PromptBuilder is ready for production deployment alongside RLM service
- Cross-language sync tests can be run in CI to catch prompt drift
- PromptBuilder is ready for prompt verification scripts (Plan 03)
- Both TypeScript and Python PromptBuilder support v1/v2 switching via PROMPT_VERSION env var

## Self-Check: PASSED

---
*Phase: 02-prompt-template-system*
*Completed: 2026-02-09*
