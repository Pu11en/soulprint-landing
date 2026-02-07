---
phase: 02-full-pass-pipeline
plan: 03
subsystem: soulprint-generation
tags: [v2-regeneration, haiku-4.5, anthropic-api, personality-sections, memory-context]
requires: [02-02, 01-02]
provides:
  - V2 section regeneration with 200 conversations + MEMORY context
  - Atomic database updates for all 5 sections + soulprint_text
  - Non-fatal degradation (v1 sections preserved if v2 fails)
affects: [03-01]
tech-stack:
  added: []
  patterns:
    - Best-effort v2 regeneration with graceful fallback
    - Early memory_md save ensures user benefits even if v2 fails
    - JSON.dumps() for section storage (Phase 1 convention)
key-files:
  created:
    - rlm-service/processors/v2_regenerator.py
  modified:
    - rlm-service/processors/full_pass.py
    - rlm-service/main.py
decisions:
  - Use same 5-section schema for v2 as quick pass (only input changes)
  - Sample top 200 conversations for v2 (vs 30-50 for quick pass)
  - V2 regeneration failure is non-fatal (v1 sections stay, MEMORY still saved)
  - Store sections with json.dumps() to match Phase 1 convention
metrics:
  duration: 153s
  completed: 2026-02-07
---

# Phase 02 Plan 03: V2 Section Regeneration Summary

**One-liner:** Regenerate all 5 personality sections using 200 conversations + MEMORY context via Haiku 4.5, with atomic database updates and graceful fallback to v1 sections on failure.

## What Was Built

### V2 Section Regenerator (`rlm-service/processors/v2_regenerator.py`)

Created a complete v2 regeneration module that produces richer personality sections:

1. **V2_SYSTEM_PROMPT**
   - Identical to quick pass schema (soul, identity, user, agents, tools)
   - Added instruction: "You also have access to a MEMORY section with curated facts about this user"
   - Same JSON structure ensures compatibility

2. **`sample_conversations_for_v2()`**
   - Samples top 200 conversations by richness score
   - Scoring algorithm matches `lib/soulprint/sample.ts`:
     - message_count * 10
     - sum of user message lengths (capped at 500 each)
     - min(user_count, assistant_count) * 20
     - slight recency bonus
   - Filters out conversations with < 4 messages

3. **`format_conversations_for_prompt()`**
   - Formats conversations as readable text for LLM
   - Max 600K chars (~150K tokens, leaving room for prompt + response)
   - Truncates individual messages at 2000 chars
   - Same format as Phase 1: `=== Conversation: "Title" (YYYY-MM-DD) ===`

4. **`regenerate_sections_v2()`**
   - Samples 200 conversations + MEMORY section
   - Calls Haiku 4.5 (`claude-haiku-4-5-20251001`) via Anthropic API
   - Parses JSON response with retry logic on validation failure
   - Returns None on failure (non-fatal)
   - Validates all 5 required keys present

5. **`sections_to_soulprint_text()`**
   - Converts sections dict + MEMORY into single markdown string
   - Same format as `sectionsToSoulprintText()` in lib/soulprint/quick-pass.ts
   - Includes all 5 sections plus MEMORY section at end

### Full Pass Pipeline Integration

Updated `rlm-service/processors/full_pass.py`:

1. **Early memory_md save**
   - Saves MEMORY to database immediately after generation
   - Ensures user benefits even if v2 regeneration fails

2. **V2 regeneration step**
   - Calls `regenerate_sections_v2()` with conversations + memory_md
   - If successful: saves all 5 sections + soulprint_text atomically
   - If failed: logs warning, keeps v1 sections (already in database from quick pass)

3. **Atomic updates**
   - All 5 section columns updated in single `update_user_profile()` call
   - Stored as `json.dumps()` strings (matches Phase 1 convention)
   - soulprint_text includes all v2 sections + MEMORY

### Status Flow Finalization

Updated `rlm-service/main.py`:

1. **Status transitions**
   - `pending` → `processing` (at start)
   - `processing` → `complete` (after full pipeline succeeds)
   - `processing` → `failed` (on any error)

2. **Error handling**
   - Added `traceback.print_exc()` for debugging
   - Truncates error message to 500 chars for database storage
   - Alerts via webhook if configured

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create v2 section regenerator module | fcc27d8 | rlm-service/processors/v2_regenerator.py |
| 2 | Wire v2 regeneration into full pass pipeline | ffe6907 | rlm-service/processors/full_pass.py, rlm-service/main.py |

## Decisions Made

### Decision: Use same 5-section schema for v2 as quick pass

**Context:** V2 regeneration could introduce new fields or restructure sections

**Choice:** Maintain identical schema, only change the input (more conversations + MEMORY)

**Rationale:**
- Ensures compatibility with Phase 1 database schema
- Simplifies database updates (same column set)
- Makes v2 regeneration a true "enhancement" not a "replacement"
- Frontend code doesn't need to handle schema differences

**Trade-offs:**
- Can't add new fields discovered during full pass analysis
- Schema improvements require coordination across phases

### Decision: Sample top 200 conversations for v2

**Context:** Need to balance data richness with API token limits

**Choice:** 200 conversations (vs 30-50 in quick pass)

**Rationale:**
- 200 conversations formatted = ~600K chars = ~150K tokens
- Leaves room for system prompt, MEMORY section, and 8K response
- Fits within Haiku 4.5's 200K context window
- 4x-6x more data than quick pass provides significantly richer analysis

**Trade-offs:**
- Users with <200 conversations get all conversations (no trade-off)
- Very active users (>1000 conversations) miss long tail
- Could reduce to 100 if context limit hit, but 200 is safe for most users

### Decision: V2 regeneration failure is non-fatal

**Context:** V2 regeneration could fail (API error, JSON parse error, timeout)

**Choice:** If v2 fails, keep v1 sections and MEMORY (already saved)

**Rationale:**
- User already has functional quick-pass sections from Phase 1
- MEMORY section saved early ensures at least that enhancement lands
- Non-blocking: user can chat while we retry/investigate
- Graceful degradation is better than complete failure

**Trade-offs:**
- Some users stuck with v1 sections until manual intervention
- No automatic retry (could add in future)
- Silent failure unless monitoring logs

### Decision: Store sections with json.dumps() to match Phase 1 convention

**Context:** Sections are Python dicts, database columns are TEXT

**Choice:** Use `json.dumps(section_dict)` for all *_md columns

**Rationale:**
- Matches Phase 1 decision (see 01-02 decision log)
- Ensures consistency between quick pass and full pass
- TEXT columns easy to read/debug in Supabase UI
- Frontend can parse with `JSON.parse()` (already implemented)

**Trade-offs:**
- Not using JSONB for query efficiency (acceptable, these aren't queried)
- Manual serialization/deserialization (minimal overhead)

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### V2 vs V1 Comparison

| Aspect | V1 (Quick Pass) | V2 (Full Pass) |
|--------|----------------|----------------|
| **Conversations** | 30-50 sampled | 200 sampled |
| **Context** | Conversations only | Conversations + MEMORY |
| **Timing** | Synchronous (~30s) | Background (~5-10min) |
| **Model** | Haiku 4.5 on Bedrock | Haiku 4.5 on Anthropic API |
| **Failure handling** | Returns null, chat blocked | Returns null, v1 stays |

### MEMORY Integration

The MEMORY section is appended to the formatted conversations as:

```
=== Conversation: "Title" (YYYY-MM-DD) ===
...

## MEMORY (verified facts about this user)
{memory_md content}
```

This gives the model curated facts to cross-reference with observed conversation patterns, producing richer analysis.

### Atomic Update Pattern

The v2 regeneration saves all 6 fields in a single database update:

```python
await update_user_profile(user_id, {
    "soul_md": json.dumps(v2_sections["soul"]),
    "identity_md": json.dumps(v2_sections["identity"]),
    "user_md": json.dumps(v2_sections["user"]),
    "agents_md": json.dumps(v2_sections["agents"]),
    "tools_md": json.dumps(v2_sections["tools"]),
    "soulprint_text": soulprint_text,
})
```

This ensures consistency: either ALL v2 sections are saved or NONE are (rollback on error).

## Next Phase Readiness

### What's Ready

- Complete end-to-end pipeline: upload → quick pass (Phase 1) → fire-and-forget → full pass (Phase 2)
- All 5 *_md columns contain v2 content for users who completed full pass
- soulprint_text includes MEMORY section for backwards-compatible chat
- full_pass_status accurately reflects completion state

### What's Needed for Phase 3

Phase 3 (Read Flow Refactor) will consume the structured sections:

1. **Schema fields ready:**
   - soul_md, identity_md, user_md, agents_md, tools_md (JSON strings)
   - memory_md (markdown)
   - All populated by v2 regeneration

2. **Chat route changes needed:**
   - Parse individual section columns instead of soulprint_text
   - Build system prompt from structured sections
   - Use MEMORY section for memory-enhanced queries

3. **Testing needed:**
   - Verify JSON.parse() works on all *_md columns
   - Ensure section structure matches expected schema
   - Test graceful handling of null sections (new users)

### Blockers

None. The full pass pipeline is complete and functional.

## Self-Check: PASSED

**Created files:**
- FOUND: rlm-service/processors/v2_regenerator.py

**Commits:**
- FOUND: fcc27d8
- FOUND: ffe6907
