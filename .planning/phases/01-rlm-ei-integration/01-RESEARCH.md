# Phase 1: RLM Emotional Intelligence Integration - Research

**Researched:** 2026-02-09
**Domain:** Cross-language emotional intelligence prompt construction (TypeScript ↔ Python)
**Confidence:** HIGH

## Summary

The RLM service (Python FastAPI) currently bypasses emotional intelligence features that were implemented in v2.0. The Bedrock fallback path uses `buildEmotionallyIntelligentPrompt()` to inject adaptive tone and relationship-aware instructions, but the RLM primary path does not. This creates inconsistent user experiences depending on which backend responds.

Research confirms that all necessary infrastructure exists:
- Emotional intelligence is detected in TypeScript (`app/api/chat/route.ts` lines 324-344)
- The Python PromptBuilder already has `build_emotionally_intelligent_prompt()` method (added in v2.0 Phase 3)
- Both TypeScript and Python prompt builders produce character-identical output (verified by cross-language sync tests)

The gap is simple: the TypeScript chat route doesn't pass `emotional_state` and `relationship_arc` to the RLM service, and the RLM service doesn't call the EI prompt method.

**Primary recommendation:** Pass EI parameters in the RLM `/query` request payload and use `build_emotionally_intelligent_prompt()` instead of `build_system_prompt()` in both RLM and fallback paths.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115+ | Python RLM service | Already in use, async HTTP handling |
| Pydantic | 2.x | Request/response validation | Already in use for QueryRequest model |
| Anthropic SDK | 0.42+ | Claude API calls | Already in use in RLM service |
| AWS Bedrock SDK | 3.x | Bedrock fallback | Already in use in TypeScript chat route |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.27+ | Async HTTP client (Python) | Already in use for RLM → Supabase calls |
| vitest | 2.x | Cross-language sync testing | Already in use for EI sync tests |

### Alternatives Considered
None — all infrastructure already exists. This is a wiring task, not a technology selection task.

## Architecture Patterns

### Current Architecture (Bedrock fallback ONLY)

```
TypeScript chat route (app/api/chat/route.ts)
  ↓
1. Detect emotion (line 327): detectEmotion(message, history[-5])
   → EmotionalState { primary, confidence, cues }
  ↓
2. Get relationship arc (line 340): getRelationshipArc(messageCount)
   → { stage: 'early'|'developing'|'established', messageCount }
  ↓
3. Try RLM service (line 372):
   tryRLMService(userId, message, soulprintText, history, webSearchContext, aiName, sections)
   ❌ DOES NOT PASS emotional_state or relationship_arc
  ↓
4. If RLM fails → Bedrock fallback (line 459):
   promptBuilder.buildEmotionallyIntelligentPrompt({
     emotionalState,      ✅ PASSES EI params
     relationshipArc,     ✅ PASSES EI params
     ...
   })
```

### Target Architecture (Both paths get EI)

```
TypeScript chat route
  ↓
1. Detect emotion
  ↓
2. Get relationship arc
  ↓
3. Try RLM service:
   POST /query with payload:
   {
     user_id, message, soulprint_text, history,
     web_search_context, ai_name, sections,
     emotional_state,     ✅ NEW
     relationship_arc,    ✅ NEW
   }
   ↓
   RLM Python service (rlm-service/main.py):
     query_with_rlm() or query_fallback():
       builder.build_emotionally_intelligent_prompt(  ✅ NEW
         profile, ai_name, memory_context, web_search_context,
         emotional_state=request.emotional_state,
         relationship_arc=request.relationship_arc
       )
  ↓
4. If RLM fails → Bedrock fallback:
   promptBuilder.buildEmotionallyIntelligentPrompt({
     emotionalState,      ✅ ALREADY WORKS
     relationshipArc,     ✅ ALREADY WORKS
     ...
   })
```

### Pattern: Cross-Language Parameter Passing

**TypeScript → Python via HTTP POST:**
```typescript
// app/api/chat/route.ts (line 162)
await fetch(`${rlmUrl}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    message,
    soulprint_text: soulprintText,
    history,
    web_search_context: webSearchContext,
    ai_name: aiName,
    sections: sections || undefined,
    // ADD:
    emotional_state: emotionalState,
    relationship_arc: relationshipArc,
  }),
  signal: AbortSignal.timeout(15000),
});
```

**Python receives via Pydantic model:**
```python
# rlm-service/main.py (line 40)
class QueryRequest(BaseModel):
    user_id: str
    message: str
    soulprint_text: Optional[str] = None
    history: Optional[List[dict]] = []
    ai_name: Optional[str] = None
    sections: Optional[dict] = None
    web_search_context: Optional[str] = None
    # ADD:
    emotional_state: Optional[dict] = None
    relationship_arc: Optional[dict] = None
```

### Anti-Patterns to Avoid

- **Don't duplicate emotion detection in Python.** The TypeScript side already detects emotion using Haiku 4.5 before calling RLM. Don't waste tokens detecting it twice.
- **Don't modify prompt section text.** The Python `build_uncertainty_instructions()`, `build_relationship_arc_instructions()`, and `build_adaptive_tone_instructions()` functions MUST produce character-identical output to TypeScript. Cross-language sync tests verify this.
- **Don't skip EI on RLM path "for performance."** The Bedrock fallback already uses EI prompts. Skipping EI on the primary path creates inconsistent user experiences.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Emotion detection | Custom sentiment analysis | Existing `detectEmotion()` with Haiku 4.5 | Already implemented, tested, and cached (lines 324-331) |
| Relationship arc calculation | Manual message counting | Existing `getRelationshipArc()` | Pure function, already integrated (lines 334-344) |
| EI prompt sections | Custom prompt templates | Existing `build_emotionally_intelligent_prompt()` | Character-identical across TypeScript and Python (v2.0 Phase 3) |
| Request validation | Manual JSON parsing | Pydantic BaseModel | Already used for QueryRequest/QueryResponse |

**Key insight:** All EI infrastructure exists from v2.0 Phase 3. This phase is purely wiring — passing data from point A to point B.

## Common Pitfalls

### Pitfall 1: Passing EI params to RLM but not using them
**What goes wrong:** RLM receives `emotional_state` and `relationship_arc` but still calls `build_system_prompt()` instead of `build_emotionally_intelligent_prompt()`.
**Why it happens:** Copy-paste from existing code that predates EI support.
**How to avoid:** Grep for `build_system_prompt` in RLM service and replace with `build_emotionally_intelligent_prompt`.
**Warning signs:** Tests pass but RLM responses don't reflect user emotions.

### Pitfall 2: Type mismatch between TypeScript and Python
**What goes wrong:** TypeScript sends `{ primary: 'frustrated', confidence: 0.8, cues: ['short'] }` but Python expects different shape.
**Why it happens:** Pydantic validation rejects unrecognized fields or requires strict types.
**How to avoid:** Use `Optional[dict]` in Pydantic model (loose validation). The Python PromptBuilder already handles TypeScript-shaped dicts.
**Warning signs:** RLM returns 422 Unprocessable Entity when emotion is detected.

### Pitfall 3: Forgetting to pass EI params to fallback path
**What goes wrong:** RLM primary path uses EI, but Python fallback path (direct Anthropic API in `query_fallback()`) doesn't.
**Why it happens:** There are TWO code paths in RLM service — `query_with_rlm()` and `query_fallback()`. Both need updating.
**How to avoid:** Update BOTH functions in `rlm-service/main.py` (lines 297-380).
**Warning signs:** EI works when RLM library succeeds, disappears when it falls back.

### Pitfall 4: Breaking cross-language sync tests
**What goes wrong:** Modifying prompt section text in Python breaks character-identical output contract.
**Why it happens:** Developer tweaks wording without realizing tests enforce exact string matching.
**How to avoid:** Run `npx vitest run __tests__/cross-lang/emotional-intelligence-sync.test.ts` after any prompt changes.
**Warning signs:** Cross-language sync test fails with string mismatch.

### Pitfall 5: Not handling None/null gracefully
**What goes wrong:** Python crashes when `emotional_state` is `None` and code tries to access `emotional_state['primary']`.
**Why it happens:** Early relationship stages or neutral emotions result in `None` values.
**How to avoid:** Python PromptBuilder already handles `None` safely (returns empty string for missing sections). Don't add defensive checks — trust the existing code.
**Warning signs:** RLM crashes on first messages when relationship_arc is `{ stage: 'early', messageCount: 0 }`.

## Code Examples

Verified patterns from official sources:

### TypeScript: Pass EI params to RLM
```typescript
// app/api/chat/route.ts (line 372-380)
// Source: Existing codebase
const rlmResponse = await tryRLMService(
  user.id,
  message,
  userProfile?.soulprint_text || null,
  history,
  webSearchContext || undefined,
  aiName,
  hasSections ? sections : null,
  // ADD these two parameters:
  emotionalState,
  relationshipArc,
);
```

### TypeScript: Update tryRLMService signature
```typescript
// app/api/chat/route.ts (line 142-150)
// Source: Existing codebase
async function tryRLMService(
  userId: string,
  message: string,
  soulprintText: string | null,
  history: ChatMessage[],
  webSearchContext?: string,
  aiName?: string,
  sections?: Record<string, unknown> | null,
  // ADD:
  emotionalState?: EmotionalState,
  relationshipArc?: { stage: 'early' | 'developing' | 'established'; messageCount: number },
): Promise<RLMResponse | null> {
```

### TypeScript: Include in fetch payload
```typescript
// app/api/chat/route.ts (line 165-173)
// Source: Existing codebase
body: JSON.stringify({
  user_id: userId,
  message,
  soulprint_text: soulprintText,
  history,
  web_search_context: webSearchContext,
  ai_name: aiName,
  sections: sections || undefined,
  // ADD:
  emotional_state: emotionalState,
  relationship_arc: relationshipArc,
}),
```

### Python: Update Pydantic request model
```python
# rlm-service/main.py (line 40-48)
# Source: Existing codebase
class QueryRequest(BaseModel):
    user_id: str
    message: str
    soulprint_text: Optional[str] = None
    history: Optional[List[dict]] = []
    ai_name: Optional[str] = None
    sections: Optional[dict] = None  # {soul, identity, user, agents, tools, memory}
    web_search_context: Optional[str] = None
    # ADD:
    emotional_state: Optional[dict] = None
    relationship_arc: Optional[dict] = None
```

### Python: Use EI prompt in query_with_rlm
```python
# rlm-service/main.py (line 297-327)
# Source: Existing codebase with modification
async def query_with_rlm(
    message: str,
    conversation_context: str,
    soulprint_text: str,
    history: List[dict],
    ai_name: str = "SoulPrint",
    sections: Optional[dict] = None,
    web_search_context: Optional[str] = None,
    # ADD:
    emotional_state: Optional[dict] = None,
    relationship_arc: Optional[dict] = None,
) -> str:
    try:
        from rlm import RLM

        rlm = RLM(
            backend="anthropic",
            backend_kwargs={
                "model_name": "claude-sonnet-4-20250514",
                "api_key": ANTHROPIC_API_KEY,
            },
            verbose=False,
        )

        builder = PromptBuilder()
        profile = _sections_to_profile(sections, soulprint_text)

        # CHANGE: Use build_emotionally_intelligent_prompt instead of build_system_prompt
        system_prompt = builder.build_emotionally_intelligent_prompt(
            profile=profile,
            ai_name=ai_name,
            memory_context=conversation_context,
            web_search_context=web_search_context,
            emotional_state=emotional_state,
            relationship_arc=relationship_arc,
        )

        context = f"""{system_prompt}

## Current Conversation
{json.dumps(history[-5:] if history else [], indent=2)}

User message: {message}"""

        result = rlm.completion(context)
        return result.response
```

### Python: Use EI prompt in query_fallback
```python
# rlm-service/main.py (line 343-380)
# Source: Existing codebase with modification
async def query_fallback(
    message: str,
    conversation_context: str,
    soulprint_text: str,
    history: List[dict],
    ai_name: str = "SoulPrint",
    sections: Optional[dict] = None,
    web_search_context: Optional[str] = None,
    # ADD:
    emotional_state: Optional[dict] = None,
    relationship_arc: Optional[dict] = None,
) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    builder = PromptBuilder()
    profile = _sections_to_profile(sections, soulprint_text)

    # CHANGE: Use build_emotionally_intelligent_prompt instead of build_system_prompt
    system_prompt = builder.build_emotionally_intelligent_prompt(
        profile=profile,
        ai_name=ai_name,
        memory_context=conversation_context,
        web_search_context=web_search_context,
        emotional_state=emotional_state,
        relationship_arc=relationship_arc,
    )

    messages = []
    for h in (history or [])[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text
```

### Python: Update /query endpoint to pass params
```python
# rlm-service/main.py (line 414-473)
# Source: Existing codebase with modification
@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    import time
    start = time.time()

    try:
        # Fetch conversation chunks
        chunks = await get_conversation_chunks(request.user_id, recent_only=True)

        # Build context from chunks
        conversation_context = ""
        for chunk in chunks[:50]:
            conversation_context += f"\n---\n**{chunk.get('title', 'Untitled')}** ({chunk.get('created_at', 'unknown date')})\n"
            conversation_context += chunk.get('content', '')[:2000]

        ai_name = request.ai_name or "SoulPrint"

        # Try RLM first
        try:
            response = await query_with_rlm(
                message=request.message,
                conversation_context=conversation_context,
                soulprint_text=request.soulprint_text or "",
                history=request.history or [],
                ai_name=ai_name,
                sections=request.sections,
                web_search_context=request.web_search_context,
                # ADD:
                emotional_state=request.emotional_state,
                relationship_arc=request.relationship_arc,
            )
            method = "rlm"
        except Exception as rlm_error:
            print(f"[RLM] Falling back due to: {rlm_error}")
            await alert_failure(str(rlm_error), request.user_id, request.message)

            # Fallback to direct API
            response = await query_fallback(
                message=request.message,
                conversation_context=conversation_context,
                soulprint_text=request.soulprint_text or "",
                history=request.history or [],
                ai_name=ai_name,
                sections=request.sections,
                web_search_context=request.web_search_context,
                # ADD:
                emotional_state=request.emotional_state,
                relationship_arc=request.relationship_arc,
            )
            method = "fallback"

        latency_ms = int((time.time() - start) * 1000)

        return QueryResponse(
            response=response,
            chunks_used=len(chunks),
            method=method,
            latency_ms=latency_ms,
        )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RLM uses `build_system_prompt()` | RLM should use `build_emotionally_intelligent_prompt()` | v2.0 (Feb 2026) | Inconsistent EI between RLM and Bedrock |
| No emotion detection | Haiku 4.5 emotion detection (EMOT-01) | v2.0 Phase 3 (Feb 9, 2026) | Adaptive tone based on user emotional state |
| No relationship tracking | Message count-based relationship arc (EMOT-03) | v2.0 Phase 3 (Feb 9, 2026) | Tone evolves from cautious to familiar |
| Single prompt builder | Versioned prompt builder (v1-technical, v2-natural-voice) | v2.0 Phase 2 (Feb 8, 2026) | Supports PROMPT_VERSION env variable |

**Deprecated/outdated:**
- Manual prompt construction: Use PromptBuilder class (both TypeScript and Python)
- Inline prompt strings: Use structured sections (soul_md, identity_md, etc.)
- Hardcoded tone: Use adaptive tone based on emotional state

## Open Questions

None. All infrastructure exists and is well-tested.

## Sources

### Primary (HIGH confidence)
- `app/api/chat/route.ts` - TypeScript chat route with emotion detection and Bedrock fallback EI usage
- `rlm-service/main.py` - Python RLM service with existing QueryRequest model and query functions
- `rlm-service/prompt_builder.py` - Python PromptBuilder with `build_emotionally_intelligent_prompt()` method (v2.0 Phase 3)
- `lib/soulprint/emotional-intelligence.ts` - TypeScript emotion detection and EI prompt section builders
- `lib/soulprint/prompt-builder.ts` - TypeScript PromptBuilder with `buildEmotionallyIntelligentPrompt()` method
- `__tests__/cross-lang/emotional-intelligence-sync.test.ts` - Cross-language sync tests verifying character-identical output
- `.planning/phases/03-emotional-intelligence/03-03-PLAN.md` - v2.0 Phase 3 plan that added EI to Python PromptBuilder
- `.planning/REQUIREMENTS.md` - v2.1 requirements (RLEI-01 through RLEI-04)

### Secondary (MEDIUM confidence)
None needed — all research based on existing codebase.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Clear data flow from TypeScript → Python via HTTP POST
- Pitfalls: HIGH - Identified from codebase inspection and cross-language sync test patterns
- Code examples: HIGH - All examples from existing codebase with verified line numbers

**Research date:** 2026-02-09
**Valid until:** 60 days (stable milestone, no fast-moving dependencies)
