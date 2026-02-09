---
phase: 03-emotional-intelligence
plan: 03
subsystem: rlm-service
tags: [python, cross-language, emotional-intelligence, prompt-sync]
requires: [03-01]
provides:
  - "Python PromptBuilder with emotional intelligence prompt construction"
  - "Cross-language sync verification for EI prompt sections"
affects: [rlm-service, evaluation-framework]
tech-stack:
  added: []
  patterns:
    - "Character-identical cross-language prompt output"
    - "Module-level EI section builder functions"
    - "Confidence threshold gating for adaptive tone"
key-files:
  created:
    - __tests__/cross-lang/emotional-intelligence-sync.test.ts
  modified:
    - rlm-service/prompt_builder.py
decisions:
  - decision: "Python EI sections are module-level functions (not class methods)"
    rationale: "Mirrors TypeScript exports pattern for consistency, easier to test individually"
    alternatives: ["Class methods only"]
  - decision: "No emotion detection in Python (parameter-based only)"
    rationale: "RLM receives emotional_state from TypeScript caller, doesn't detect independently"
    alternatives: ["Duplicate detection logic in Python"]
metrics:
  duration: 2m 22s
  tests-added: 10
  completed: 2026-02-09
---

# Phase 03 Plan 03: Python EI Prompt Sync Summary

**One-liner:** Character-identical Python emotional intelligence prompt sections with cross-language sync verification

## What Was Built

Added emotional intelligence prompt construction to the Python PromptBuilder (`rlm-service/prompt_builder.py`), mirroring the TypeScript implementation from Phase 03 Plan 01. The Python side now produces **character-identical** output to TypeScript for:

1. **Uncertainty acknowledgment** (EMOT-02) - Always included in EI prompts
2. **Relationship arc instructions** (EMOT-03) - Early/developing/established stages based on message count
3. **Adaptive tone instructions** (EMOT-01) - Frustrated/satisfied/confused emotional state adaptations

This ensures consistent emotional intelligence behavior whether responses come from:
- **Bedrock path (TypeScript)** - Direct chat via Next.js API
- **RLM path (Python)** - Primary response path via Python RLM service

### Architecture

```
TypeScript PromptBuilder                 Python PromptBuilder
(lib/soulprint/prompt-builder.ts)       (rlm-service/prompt_builder.py)
         |                                        |
         v                                        v
buildEmotionallyIntelligentPrompt()     build_emotionally_intelligent_prompt()
         |                                        |
         |-- base prompt (v1 or v2)              |-- base prompt (v1 or v2)
         |-- buildUncertaintyInstructions()      |-- build_uncertainty_instructions()
         |-- buildRelationshipArcInstructions()  |-- build_relationship_arc_instructions()
         |-- buildAdaptiveToneInstructions()     |-- build_adaptive_tone_instructions()
         |                                        |
         v                                        v
    IDENTICAL OUTPUT ======================== IDENTICAL OUTPUT
```

### Module-Level Functions (Not Class Methods)

Python EI section builders are **module-level functions** (like TypeScript exports):

```python
def build_uncertainty_instructions() -> str:
    """Returns ## UNCERTAINTY ACKNOWLEDGMENT section."""
    return """## UNCERTAINTY ACKNOWLEDGMENT

When you lack SUFFICIENT information to answer confidently:
- Say "I don't have enough information about X" instead of guessing
...
"""

def build_relationship_arc_instructions(arc: Optional[Dict[str, Any]]) -> str:
    """Returns ## RELATIONSHIP TONE section based on conversation depth."""
    if not arc or "stage" not in arc:
        return ""

    stage = arc["stage"]
    message_count = arc.get("messageCount", 0)

    if stage == "early":
        return f"""## RELATIONSHIP TONE (Early stage: {message_count} messages)
...
"""

def build_adaptive_tone_instructions(state: Optional[Dict[str, Any]]) -> str:
    """Returns ## ADAPTIVE TONE section based on detected emotional state."""
    if not state or state.get("primary") == "neutral":
        return ""

    primary = state.get("primary", "neutral")
    cues = state.get("cues", [])
    cues_text = f"\nSigns detected: {', '.join(cues)}" if cues else ""

    if primary == "frustrated":
        return f"""## ADAPTIVE TONE (User is frustrated){cues_text}
...
"""
```

### Composition Method

Added `build_emotionally_intelligent_prompt()` to the `PromptBuilder` class:

```python
def build_emotionally_intelligent_prompt(
    self,
    profile: Dict[str, Any],
    emotional_state: Optional[Dict[str, Any]] = None,
    relationship_arc: Optional[Dict[str, Any]] = None,
    # ... other params
) -> str:
    """
    Composes: base prompt + uncertainty + relationship arc + adaptive tone.
    Mirrors TypeScript PromptBuilder.buildEmotionallyIntelligentPrompt.
    """
    # Start with base prompt (v1 or v2)
    prompt = self.build_system_prompt(...)

    # ALWAYS include uncertainty acknowledgment (EMOT-02)
    prompt += "\n\n" + build_uncertainty_instructions()

    # Add relationship arc if provided (EMOT-03)
    if relationship_arc:
        arc_text = build_relationship_arc_instructions(relationship_arc)
        if arc_text:
            prompt += "\n\n" + arc_text

    # Add adaptive tone ONLY if confidence >= 0.6 (EMOT-01)
    if emotional_state and emotional_state.get("confidence", 0) >= 0.6:
        tone_text = build_adaptive_tone_instructions(emotional_state)
        if tone_text:
            prompt += "\n\n" + tone_text

    return prompt
```

**Key behaviors:**
- **Confidence threshold:** Only apply adaptive tone if `confidence >= 0.6` (matches TypeScript)
- **Neutral returns empty:** No adaptation for neutral emotions
- **Order matters:** Adaptive tone goes LAST (freshest instruction in prompt)

### Cross-Language Sync Test

Created `__tests__/cross-lang/emotional-intelligence-sync.test.ts` following Phase 2's cross-lang test pattern:

```typescript
beforeAll(async () => {
  // Import verification - ensures TypeScript exports exist before running tests
  const module = await import('@/lib/soulprint/emotional-intelligence');
  buildUncertaintyInstructions = module.buildUncertaintyInstructions;
  buildRelationshipArcInstructions = module.buildRelationshipArcInstructions;
  buildAdaptiveToneInstructions = module.buildAdaptiveToneInstructions;

  if (!buildUncertaintyInstructions || !buildRelationshipArcInstructions || !buildAdaptiveToneInstructions) {
    throw new Error('Missing exports from emotional-intelligence module');
  }
});

function callPython(functionName: string, ...args: unknown[]): string {
  // JSON blob serialization for param passing (avoids shell escaping issues)
  const argsJson = JSON.stringify(args);
  const script = `
import sys, json
sys.path.insert(0, 'rlm-service')
from prompt_builder import ${functionName}
args = json.loads(sys.argv[1])
result = ${functionName}(*args)
print(result, end='')
`;

  return execSync(`python3 -c "${script.replace(/"/g, '\\"')}" '${argsJson}'`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}
```

**10 test cases covering:**
1. Uncertainty instructions (no args)
2. Relationship arc - early stage
3. Relationship arc - developing stage
4. Relationship arc - established stage
5. Adaptive tone - frustrated
6. Adaptive tone - satisfied
7. Adaptive tone - confused
8. Adaptive tone - neutral (returns empty)
9. Adaptive tone with no cues (no "Signs detected:" line)
10. Relationship arc with invalid input (returns empty)

**All tests pass:** Character-by-character comparison confirms identical output.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `32a8f89` | Add EI prompt sections to Python PromptBuilder (build_uncertainty_instructions, build_relationship_arc_instructions, build_adaptive_tone_instructions, build_emotionally_intelligent_prompt) |
| 2 | `e79c229` | Add cross-language sync test for EI prompt sections (10 test cases, all passing) |

## Decisions Made

### 1. Module-Level Functions vs. Class Methods

**Decision:** Python EI section builders are module-level functions, not class methods.

**Rationale:**
- **Mirrors TypeScript pattern:** TypeScript exports `buildUncertaintyInstructions()` etc. as standalone functions, not class methods
- **Easier to test individually:** Can import and test `build_uncertainty_instructions()` without instantiating PromptBuilder
- **Composition pattern:** `build_emotionally_intelligent_prompt()` class method composes the sections, but sections themselves are pure functions

**Alternative considered:** Make them private class methods (`_build_uncertainty_instructions()`)
**Rejected because:** Would diverge from TypeScript pattern, harder to test in isolation

### 2. No Emotion Detection in Python

**Decision:** Python PromptBuilder does NOT implement `detectEmotion()` (TypeScript-only).

**Rationale:**
- **RLM service receives emotional state as parameter:** TypeScript caller detects emotion and passes `emotional_state` dict to RLM
- **Avoid duplication:** Emotion detection uses Bedrock (TypeScript path), no need to duplicate in Python
- **Python builds prompts, TypeScript detects emotions:** Clear separation of concerns

**Alternative considered:** Duplicate emotion detection logic in Python
**Rejected because:** Would require Bedrock client setup in Python, add complexity, and create divergence risk

### 3. Character-Identical Output Contract

**Decision:** Python and TypeScript must produce **byte-identical** output for the same inputs.

**Rationale:**
- **Consistency guarantee:** Users should get identical emotional intelligence adaptations regardless of response path (Bedrock vs. RLM)
- **Testable contract:** Cross-language sync tests verify this property automatically
- **Prevents drift:** Any divergence breaks tests, forcing fixes before merging

**Implementation details:**
- **Exact text replication:** Copied markdown section text from TypeScript to Python character-for-character
- **Same f-string formatting:** `f"Early stage: {message_count} messages"` produces identical output to TypeScript template literals
- **Conditional newlines:** `cues_text = f"\nSigns detected: {', '.join(cues)}" if cues else ""` matches TypeScript ternary

## Deviations from Plan

None - plan executed exactly as written.

## Testing

### Cross-Language Sync Tests

**10 tests in `__tests__/cross-lang/emotional-intelligence-sync.test.ts`:**

```
✓ uncertainty instructions match (37ms)
✓ relationship arc instructions match for early stage (22ms)
✓ relationship arc instructions match for developing stage (22ms)
✓ relationship arc instructions match for established stage (27ms)
✓ adaptive tone instructions match for frustrated (27ms)
✓ adaptive tone instructions match for satisfied (27ms)
✓ adaptive tone instructions match for confused (23ms)
✓ adaptive tone instructions match for neutral (returns empty) (22ms)
✓ adaptive tone with no cues (empty cues text) (25ms)
✓ relationship arc with invalid input returns empty string (22ms)
```

**All tests pass (Duration: 316ms)**

### Existing Tests Still Pass

**Verified no regressions in `__tests__/cross-lang/prompt-sync.test.ts`:**

```
✓ v1 prompts produce identical output
✓ v2 prompts produce identical output
✓ v2 has ## REMEMBER after ## CONTEXT (PRMT-04)
✓ v1 and v2 produce different output (sanity check)
✓ imposter mode produces identical output
✓ v1 prompts with web search produce identical output
✓ v2 prompts with web search produce identical output
✓ minimal profile (soulprint_text only) produces identical output
```

**All 8 tests pass (Duration: 174ms)**

## Next Phase Readiness

### Blockers

None.

### Concerns

None.

### Handoff Notes

**For Phase 03 Plan 04 (Wire EI to Chat Route):**

Python RLM service now has `build_emotionally_intelligent_prompt()` ready to use. When wiring EI to the chat route:

1. **TypeScript side detects emotion:** Call `detectEmotion(userMessage, recentHistory)` in chat route
2. **TypeScript determines relationship arc:** Call `getRelationshipArc(messageCount)` from conversation history
3. **Pass to RLM:** Include `emotional_state` and `relationship_arc` in RLM request payload
4. **Python builds EI prompt:** RLM service calls `builder.build_emotionally_intelligent_prompt(profile, emotional_state=..., relationship_arc=...)`
5. **Character-identical prompts:** Both Bedrock fallback (TypeScript) and RLM primary (Python) produce same EI adaptations

**Example RLM request payload:**

```json
{
  "profile": { ... },
  "emotional_state": {
    "primary": "frustrated",
    "confidence": 0.8,
    "cues": ["short responses", "repeated question"]
  },
  "relationship_arc": {
    "stage": "developing",
    "messageCount": 25
  }
}
```

**Confidence threshold:** Only apply adaptive tone if `emotional_state.confidence >= 0.6` (already implemented in both TypeScript and Python).

## Self-Check: PASSED

All files exist:
- ✓ `__tests__/cross-lang/emotional-intelligence-sync.test.ts`

All commits exist:
- ✓ `32a8f89` (feat: add EI prompt sections to Python PromptBuilder)
- ✓ `e79c229` (test: add cross-language sync test)

All tests pass:
- ✓ 10 EI cross-language sync tests
- ✓ 8 existing prompt-sync tests (no regressions)
