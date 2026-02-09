---
phase: 01
plan: 02
subsystem: rlm-service
tags: [python, quick-pass, bedrock, anthropic, conversation-sampling]
requires:
  - lib/soulprint/sample.ts
  - lib/soulprint/quick-pass.ts
  - lib/soulprint/prompts.ts
provides:
  - rlm-service/processors/sample.py
  - rlm-service/processors/quick_pass.py
  - Python quick pass generation capability
affects:
  - 01-03 (RLM import endpoint will use these modules)
tech-stack:
  added: []
  patterns:
    - Bedrock AnthropicBedrock client for Haiku 4.5
    - Fail-safe error handling (return None on failure)
    - Module-level constant exports
key-files:
  created:
    - rlm-service/processors/sample.py
    - rlm-service/processors/quick_pass.py
  modified:
    - rlm-service/processors/__init__.py
decisions:
  - Use AnthropicBedrock client instead of direct Bedrock SDK
  - Return None on failure for fail-safe import pipeline
  - Port exact system prompt and scoring algorithm from TypeScript
metrics:
  duration: 2 minutes
  completed: 2026-02-09
---

# Phase 1 Plan 02: Quick Pass Python Port Summary

**One-liner:** Ported TypeScript quick pass logic (conversation sampling + Haiku 4.5 generation) to Python with identical behavior and fail-safe error handling.

## What Was Built

Migrated quick pass functionality from TypeScript to Python for the RLM service:

1. **sample.py** - Conversation sampling with richness scoring
   - Filters conversations by MIN_MESSAGES threshold (4+)
   - Scores by: message count × 10, user content (capped 500 chars), balance × 20, recency
   - Selects within token budget (50K default) with MIN_SELECTED guarantee (5)
   - Hard cap at 50 conversations
   - Formats as titled conversation blocks for LLM prompt

2. **quick_pass.py** - Quick pass generation via Bedrock
   - Uses AnthropicBedrock client with Haiku 4.5 model
   - Exact system prompt from lib/soulprint/prompts.ts (4377 chars)
   - Generates 5 structured sections: soul, identity, user, agents, tools
   - Fail-safe: returns None on any error (never throws)
   - JSON parsing with markdown cleanup

3. **processors/__init__.py** - Package exports
   - Exports all functions for clean imports
   - Enables `from processors import generate_quick_pass`

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Port conversation sampling logic to Python | 162b581 | rlm-service/processors/sample.py |
| 2 | Port quick pass generation logic to Python | 3ec67d9 | rlm-service/processors/quick_pass.py |
| 3 | Update processors __init__.py exports | 0ffb625 | rlm-service/processors/__init__.py |

## Verification Results

**sample.py:**
- Verified sampling with test conversation (4 messages)
- Confirmed scoring algorithm matches TypeScript
- Validated formatting includes title and message structure
- Output: 190 chars formatted from 98 chars input

**quick_pass.py:**
- Verified structure without runtime import (environment constraint)
- Confirmed AnthropicBedrock import present
- Validated QUICK_PASS_SYSTEM_PROMPT matches TypeScript (4377 chars)
- Confirmed fail-safe error handling (returns None on failure)

**processors/__init__.py:**
- All exports validated: sample_conversations, format_conversations_for_prompt, generate_quick_pass, QUICK_PASS_SYSTEM_PROMPT
- Clean import path verified

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

1. **AnthropicBedrock client over boto3**
   - Rationale: requirements.txt includes `anthropic[bedrock]>=0.18.0`, matching TypeScript pattern
   - Benefit: Higher-level API, cleaner than raw Bedrock SDK

2. **Module-level constant for system prompt**
   - Rationale: Matches TypeScript export pattern in prompts.ts
   - Benefit: Reusable for testing and inspection

3. **Fail-safe error handling**
   - Rationale: Import pipeline must never fail because of quick pass
   - Implementation: Try/catch entire function, return None on any error
   - Logging: All errors print to console for debugging

## Behavior Parity with TypeScript

| Feature | TypeScript | Python | Status |
|---------|-----------|--------|--------|
| MIN_MESSAGES filter | 4 | 4 | ✓ Match |
| Scoring algorithm | msg*10 + user(cap 500) + balance*20 + recency | Same | ✓ Match |
| Token budget | 50K default | 50K default | ✓ Match |
| Hard cap | 50 convos | 50 convos | ✓ Match |
| MIN_SELECTED guarantee | 5 | 5 | ✓ Match |
| Message truncation | 2000 chars | 2000 chars | ✓ Match |
| System prompt | 4377 chars | 4377 chars | ✓ Match |
| Model | Haiku 4.5 Bedrock | us.anthropic.claude-haiku-4-5-20251001-v1:0 | ✓ Match |
| Error handling | Try/catch return null | Try/catch return None | ✓ Match |
| JSON parsing | Markdown cleanup | Markdown cleanup | ✓ Match |

## Integration Points

**Upstream dependencies:**
- None (pure logic port)

**Downstream consumers:**
- 01-03: RLM import endpoint will call `generate_quick_pass(conversations)`
- Future quick pass regeneration endpoints

**Environment variables needed:**
- `AWS_REGION` (default: us-east-1)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Ready for:** Plan 01-03 can now integrate quick pass generation into RLM import endpoint.

## Self-Check: PASSED

All files created:
- rlm-service/processors/sample.py ✓
- rlm-service/processors/quick_pass.py ✓

All commits exist:
- 162b581 ✓
- 3ec67d9 ✓
- 0ffb625 ✓
