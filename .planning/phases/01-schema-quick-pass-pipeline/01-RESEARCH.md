# Phase 1: Schema + Quick Pass Pipeline - Research

**Researched:** 2026-02-06
**Domain:** Database schema design, LLM prompt engineering, conversation sampling, AWS Bedrock integration
**Confidence:** HIGH (based on direct codebase analysis + official docs)

## Summary

Phase 1 replaces the monolithic `soulprint_text` field with 5 structured context sections (SOUL, IDENTITY, USER, AGENTS, TOOLS) generated in under 60 seconds by Haiku 4.5 on Bedrock. The quick pass runs during import on Vercel, before firing off the RLM background processing.

Key findings:
1. **Database columns already exist** -- Migration `20260201_soulprint_files.sql` already added `soul_md`, `identity_md`, `agents_md`, `user_md` to `user_profiles`. Only `tools_md` is missing. This means minimal schema work.
2. **Injection point is clear** -- The quick pass slots into `process-server/route.ts` after conversations are parsed (line ~277) and before the RLM fire-and-forget call (line ~350). The parsed `conversations` array is already available.
3. **Haiku 4.5 has 200K context window** -- With ~4 chars/token, we can fit ~800K characters of conversation text. Sampling the top 30-50 conversations by message count gives us rich material well within limits.
4. **The codebase already uses both Converse API and InvokeModel API** for Bedrock -- the shared `lib/bedrock.ts` utility provides `bedrockChat` and `bedrockChatJSON` helpers with the Converse API, which is the cleaner pattern to follow.

**Primary recommendation:** Add `tools_md` column, write a conversation sampler that picks the richest conversations, call Haiku 4.5 via the existing `bedrockChatJSON` helper (or a parallel variant), save results to the 5 `*_md` columns, then continue to RLM background processing.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@aws-sdk/client-bedrock-runtime` | ^3.980.0 | Bedrock Converse API for Haiku 4.5 | Installed, used throughout |
| `@supabase/supabase-js` | ^2.93.1 | Database reads/writes | Installed, used throughout |
| `zod` | ^4.3.6 | Response validation | Installed, used in schemas.ts |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jszip` | ^3.10.1 | ZIP extraction | Already used in process-server |
| `pino` | ^10.3.0 | Structured logging | Already used via createLogger |

### No New Dependencies Needed
This phase requires zero new npm packages. Everything needed is already in the codebase.

## Architecture Patterns

### Current Import Pipeline (process-server/route.ts)
```
Request comes in (POST)
    |
    v
Auth check + rate limit
    |
    v
Download from Supabase Storage
    |
    v
Extract conversations.json from ZIP (or parse JSON directly)
    |
    v
Validate ChatGPT format
    |
    v
Store raw JSON (gzipped) to user-exports bucket
    |
    v
Parse conversations into ParsedConversation[] format   <-- conversations available here
    |
    v
Set placeholder soulprint (line ~293)                   <-- REPLACE WITH QUICK PASS
    |
    v
Save placeholder to user_profiles
    |
    v
Store raw JSON for RLM
    |
    v
Fire-and-forget RLM /process-full                       <-- keep this, runs after quick pass
    |
    v
Return success response
```

### Quick Pass Injection Point

The quick pass replaces lines 291-316 of `process-server/route.ts`. After `conversations` is populated (line 277), we:

1. Sample the richest conversations
2. Format them as text for the prompt
3. Call Haiku 4.5 (1-3 parallel calls)
4. Parse and validate structured JSON responses
5. Save to `soul_md`, `identity_md`, `user_md`, `agents_md`, `tools_md` columns
6. Also populate `soulprint_text` for backwards compatibility (concatenation of all 5)
7. Set `import_status = 'quick_ready'` (existing status value)

### Recommended File Structure
```
lib/
  soulprint/
    sample.ts          # Conversation sampling logic
    quick-pass.ts      # Haiku 4.5 call + response parsing
    prompts.ts         # Prompt templates for each section
    types.ts           # TypeScript interfaces for sections
```

### Pattern: Parallel Section Generation
**What:** Generate all 5 sections in a single Haiku 4.5 call (not 5 separate calls)
**When to use:** Default approach -- most efficient
**Why:** A single call with JSON output avoids 5x latency. Haiku 4.5's 200K context and 64K output can handle generating all 5 sections in one pass. If a single call takes too long (>30s), split into 2 parallel calls: (SOUL+IDENTITY+USER) and (AGENTS+TOOLS).

```typescript
// Single call approach (preferred)
const result = await bedrockChatJSON<QuickPassResult>({
  model: 'HAIKU', // Will need to update CLAUDE_MODELS to include Haiku 4.5
  system: QUICK_PASS_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: sampledConversationsText }],
  maxTokens: 8192,
  temperature: 0.7,
});
```

### Pattern: Conversation Sampling
**What:** Select the most informative conversations from potentially thousands
**When to use:** Always -- even small exports benefit from sampling
**Why:** A 5000-conversation export might be 500MB of text. We need ~50K tokens of conversation text (leaving room for system prompt + output).

### Anti-Patterns to Avoid
- **Sending all conversations to Haiku:** Would exceed context window and waste tokens on low-value conversations
- **Processing on the client side:** Must run server-side for security and reliability
- **Five separate Haiku calls:** Sequential calls would take 5x longer; one combined call is faster
- **Storing sections as separate rows in a new table:** Adds join complexity for no benefit -- columns on user_profiles is simpler
- **Blocking on RLM before returning:** RLM is fire-and-forget, quick pass is the synchronous step

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction from LLM response | Custom regex parser | `bedrockChatJSON` from lib/bedrock.ts | Already handles markdown code blocks, error cases |
| Bedrock client initialization | New client per call | `getBedrockClient()` from lib/bedrock.ts | Lazy singleton pattern already implemented |
| Request validation | Manual checks | Zod schemas from lib/api/schemas.ts | Consistent with codebase pattern |
| Structured logging | console.log | `createLogger` from lib/logger.ts | Already used in process-server |

## Common Pitfalls

### Pitfall 1: Model ID Mismatch
**What goes wrong:** Using the wrong model ID for Haiku 4.5 causes 4xx errors from Bedrock.
**Why it happens:** The codebase currently defaults to `us.anthropic.claude-3-5-haiku-20241022-v1:0` (Haiku 3.5). The requirement specifies Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`).
**How to avoid:** Update `lib/bedrock.ts` `CLAUDE_MODELS` to include a `HAIKU_45` entry with the correct model ID. Or use `BEDROCK_MODEL_ID` env var override. The `us.` prefix is for cross-region inference profiles.
**Warning signs:** `ValidationException` or `AccessDeniedException` from Bedrock.

### Pitfall 2: Vercel Function Timeout
**What goes wrong:** Quick pass + existing pipeline logic exceeds Vercel's 5-minute (300s) timeout.
**Why it happens:** `maxDuration = 300` on process-server. If conversations are very large and Haiku takes 30-60s, plus ZIP extraction, gzip, storage operations, it can be tight.
**How to avoid:** The quick pass should target 15-30s. Sample conversations aggressively (30-50 max). Use a single Haiku call, not multiple sequential calls. The existing pipeline already does a lot before the quick pass point -- measure remaining time budget.
**Warning signs:** 504 timeout errors from Vercel.

### Pitfall 3: JSON Parse Failures from LLM
**What goes wrong:** Haiku returns malformed JSON, or wraps it in explanation text.
**Why it happens:** LLMs sometimes add commentary around JSON even when instructed not to.
**How to avoid:** The existing `bedrockChatJSON` already handles markdown code block stripping. Add Zod validation of the parsed result. Have a fallback that populates minimal/generic sections if parsing fails, so the user isn't blocked.
**Warning signs:** Empty or null section values in database after import.

### Pitfall 4: ChatGPT Conversation Message Ordering
**What goes wrong:** Messages in a ChatGPT export's `mapping` field are not in chronological order.
**Why it happens:** ChatGPT's `mapping` is a tree structure (each node has `parent` and `children`), not a flat array. The existing parser at line 237-267 iterates `Object.values(conv.mapping)` which gives arbitrary order.
**How to avoid:** The existing parser already extracts messages in mapping order which works "well enough" for sampling. For the quick pass, conversation quality matters more than message order within a conversation. The sampling function should score conversations by total message count and text length, not rely on ordering.
**Warning signs:** Conversations that seem incoherent when read sequentially.

### Pitfall 5: Backwards Compatibility with soulprint_text
**What goes wrong:** Breaking the chat route which reads `soulprint_text` to compose the system prompt.
**Why it happens:** Chat route (app/api/chat/route.ts) reads `soulprint_text` at line 206 and uses it in `buildSystemPrompt`. If we only populate the `*_md` columns and leave `soulprint_text` empty, chat breaks until Phase 3 rewires it.
**How to avoid:** During Phase 1, also populate `soulprint_text` with a concatenation of all 5 sections. This maintains backwards compatibility. Phase 3 will refactor the chat route to read individual sections.
**Warning signs:** Chat responses that don't reflect the user's personality after import.

### Pitfall 6: RLM Service Interaction
**What goes wrong:** Quick pass saves sections, then RLM overwrites them when it completes.
**Why it happens:** RLM's `/process-full` eventually calls back to `/api/import/complete` which could update `soulprint_text`. The import complete callback also sends email.
**How to avoid:** The RLM callback at `/api/import/complete` currently only sends email/notifications -- it doesn't overwrite `soulprint_text`. Phase 2 will handle the v2 regeneration. For now, quick pass writes are safe.
**Warning signs:** Sections disappearing after RLM completes.

## Code Examples

### Existing Bedrock Helper Usage (lib/bedrock.ts)
```typescript
// Source: lib/bedrock.ts (lines 55-94)
// bedrockChat - returns raw string
const text = await bedrockChat({
  model: 'HAIKU',
  system: 'You are a helpful assistant',
  messages: [{ role: 'user', content: 'Hello' }],
  maxTokens: 4096,
  temperature: 0.7,
});

// bedrockChatJSON - returns parsed JSON with code block stripping
const result = await bedrockChatJSON<MyType>({
  model: 'HAIKU',
  system: 'Respond in JSON only',
  messages: [{ role: 'user', content: 'Generate data' }],
  maxTokens: 4096,
});
```

### Existing Model ID Constants (lib/bedrock.ts)
```typescript
// Source: lib/bedrock.ts (lines 31-35)
// CURRENT - needs HAIKU_45 added
export const CLAUDE_MODELS = {
  SONNET: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  OPUS: 'anthropic.claude-3-opus-20240229-v1:0',
} as const;
```

### Existing ParsedConversation Type (process-server/route.ts)
```typescript
// Source: app/api/import/process-server/route.ts (lines 33-43)
interface ConversationMessage {
  role: string;
  content: string;
}

interface ParsedConversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: string;
}
```

### Existing Database Column Migration (already applied)
```sql
-- Source: supabase/migrations/20260201_soulprint_files.sql
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS soul_md TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS identity_md TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS agents_md TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS user_md TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS memory_log TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS memory_log_date DATE;
-- NOTE: tools_md is MISSING -- needs to be added
```

### Conversation Sampling Strategy (recommended implementation)
```typescript
// Score and rank conversations by richness
function sampleConversations(
  conversations: ParsedConversation[],
  targetTokens: number = 50000
): ParsedConversation[] {
  // Score each conversation
  const scored = conversations.map(conv => {
    const totalChars = conv.messages.reduce((sum, m) => sum + m.content.length, 0);
    const userMessages = conv.messages.filter(m => m.role === 'user');
    const assistantMessages = conv.messages.filter(m => m.role === 'assistant');

    return {
      conv,
      score: (
        // Prefer conversations with many messages (back-and-forth)
        conv.messages.length * 10 +
        // Prefer conversations with substantial user messages
        userMessages.reduce((sum, m) => sum + Math.min(m.content.length, 500), 0) +
        // Prefer conversations with variety (both user and assistant)
        Math.min(userMessages.length, assistantMessages.length) * 20 +
        // Slight recency bonus
        (new Date(conv.createdAt).getTime() / 1e12)
      ),
      chars: totalChars,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take conversations until we hit token budget
  const targetChars = targetTokens * 4; // ~4 chars per token
  const selected: ParsedConversation[] = [];
  let totalChars = 0;

  for (const { conv, chars } of scored) {
    if (totalChars + chars > targetChars) {
      // If we have very few, include a truncated version
      if (selected.length < 5) {
        selected.push(conv);
      }
      continue;
    }
    selected.push(conv);
    totalChars += chars;
    if (selected.length >= 50) break; // Hard cap at 50 conversations
  }

  return selected;
}
```

### Quick Pass Prompt Design (recommended structure)
```typescript
const QUICK_PASS_SYSTEM_PROMPT = `You are analyzing a user's ChatGPT conversation history to build a structured personality profile for their AI assistant. Generate EXACTLY the following 5 sections as a JSON object.

IMPORTANT: Base everything on EVIDENCE from the conversations. Don't speculate or make things up. If information isn't available, say "not enough data" for that field.

Respond with ONLY a JSON object, no other text:

{
  "soul": {
    "communication_style": "description of how they communicate",
    "personality_traits": ["trait1", "trait2", ...],
    "tone_preferences": "what tone they prefer/use",
    "boundaries": "what they don't like or want to avoid",
    "humor_style": "how they use humor",
    "formality_level": "casual/formal/mixed",
    "emotional_patterns": "how they express emotions"
  },
  "identity": {
    "ai_name": "a creative name for their AI based on personality",
    "archetype": "a 2-3 word archetype (e.g., 'Witty Strategist')",
    "vibe": "overall personality vibe in one sentence",
    "emoji_style": "how/whether to use emojis",
    "signature_greeting": "how the AI should greet them"
  },
  "user": {
    "name": "user's name if mentioned",
    "location": "location if mentioned",
    "occupation": "occupation if mentioned",
    "relationships": ["key people mentioned with context"],
    "interests": ["interests and hobbies"],
    "life_context": "brief summary of their life situation",
    "preferred_address": "how they want to be addressed"
  },
  "agents": {
    "response_style": "how the AI should respond",
    "behavioral_rules": ["rule1", "rule2", ...],
    "context_adaptation": "how to adapt to different topics",
    "memory_directives": "what to remember vs forget",
    "do_not": ["things the AI should never do"]
  },
  "tools": {
    "likely_usage": ["what they'll probably use the AI for"],
    "capabilities_emphasis": ["which AI capabilities to emphasize"],
    "output_preferences": "how they prefer information formatted",
    "depth_preference": "brief/detailed/mixed responses"
  }
}`;
```

## Database Schema Analysis

### Current user_profiles Columns (Relevant)

| Column | Type | Status | Used By |
|--------|------|--------|---------|
| `soulprint_text` | TEXT | Active -- chat reads this | chat/route.ts, memory/synthesize |
| `soulprint` | JSONB | Active -- stores metadata | process-server (placeholder) |
| `soul_md` | TEXT | **Exists but UNUSED** | Nothing reads it yet |
| `identity_md` | TEXT | **Exists but UNUSED** | Nothing reads it yet |
| `agents_md` | TEXT | **Exists but UNUSED** | Nothing reads it yet |
| `user_md` | TEXT | **Exists but UNUSED** | Nothing reads it yet |
| `tools_md` | TEXT | **DOES NOT EXIST** | Needs migration |
| `ai_name` | TEXT | Active | chat/route.ts |
| `archetype` | TEXT | Active | process-server, complete callback |
| `import_status` | TEXT | Active | Multiple files |
| `personality_profile` | JSONB | Exists but UNUSED | Nothing |
| `memory_log` | TEXT | Exists but UNUSED | Nothing |
| `memory_log_date` | DATE | Exists but UNUSED | Nothing |

### Schema Changes Required

**Minimal approach (recommended):**
1. Add `tools_md TEXT` column to `user_profiles` (only missing column)
2. Everything else already exists

```sql
-- Only migration needed for Phase 1
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS tools_md TEXT;
COMMENT ON COLUMN public.user_profiles.tools_md IS 'TOOLS.md - AI capabilities, usage patterns, output preferences';
```

### Downstream Consumers of soulprint_text

These files read `soulprint_text` and will need updating in Phase 3:

| File | How It Uses soulprint_text | Phase 1 Impact |
|------|---------------------------|----------------|
| `app/api/chat/route.ts` | Reads for system prompt (line 206), passes to buildSystemPrompt (line 333) | MUST still work -- populate soulprint_text too |
| `app/api/chat/route.ts` | Uses for AI name generation (line 237) | Will use identity_md.ai_name in Phase 3 |
| `lib/memory/query.ts` | Not directly -- but memory context is appended to system prompt | No change needed |
| `app/api/memory/synthesize/route.ts` | Reads soulprint_text (line 120), synthesizes with new facts | MUST still work -- populate soulprint_text too |
| `app/api/embeddings/process/route.ts` | Checks if soulprint_text exists (line 165) | MUST still work -- populate soulprint_text too |
| `app/api/user/reset/route.ts` | Sets soulprint_text to null (line 79) | Should also null the *_md columns |
| RLM service | Receives soulprint_text in /query calls | No change needed for Phase 1 |

**Critical insight:** Phase 1 MUST populate `soulprint_text` alongside the `*_md` columns for backwards compatibility. The concatenated sections become the soulprint_text until Phase 3 refactors the chat route.

## Haiku 4.5 Specifications

| Property | Value | Source |
|----------|-------|--------|
| Model ID | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | REQUIREMENTS.md (GEN-04) |
| Context window | 200,000 tokens (~800K chars) | Anthropic docs |
| Max output | 8,192 tokens (Bedrock default) or up to 64K | Anthropic docs |
| Approx chars/token | ~4 | Common estimate |
| API | Converse API (recommended) or InvokeModel | Both used in codebase |

### Token Budget for Quick Pass

```
Available context: 200,000 tokens
- System prompt:          ~2,000 tokens (section definitions + instructions)
- Output reservation:    ~8,000 tokens (all 5 sections as JSON)
- Safety margin:          ~5,000 tokens
= Available for conversations: ~185,000 tokens (~740,000 chars)
```

This means we can fit roughly 50 rich conversations (avg ~15,000 chars each) or more. This is generous -- we should target 30-50 conversations to stay well within limits.

## Conversation Sampling Strategy

### Scoring Criteria (Confidence: HIGH)

Conversations should be scored on these dimensions:

1. **Message count** (highest weight): More messages = more back-and-forth = more personality revealed
2. **User message length**: Longer user messages reveal more about communication style
3. **Balance**: Conversations with both user and assistant messages are more revealing than one-sided
4. **Diversity**: Include conversations from different time periods for a well-rounded profile
5. **Recency**: Slight bonus for recent conversations (more representative of current personality)

### What NOT to include:
- Very short conversations (1-2 messages) -- not enough signal
- System/tool-only conversations -- no personality data
- Conversations with only assistant messages -- no user personality

### Implementation Strategy:
1. Filter out conversations with < 4 messages
2. Score remaining conversations using weighted formula
3. Sort by score descending
4. Take top N conversations until token budget is reached (~185K tokens)
5. Cap at 50 conversations maximum (diminishing returns beyond this)
6. Format as readable text blocks for the prompt

## Existing Bedrock Call Patterns

The codebase uses TWO patterns for Bedrock calls:

### Pattern A: Converse API (via lib/bedrock.ts)
```typescript
// Used by: lib/bedrock.ts bedrockChat() and bedrockChatJSON()
const command = new ConverseCommand({
  modelId: CLAUDE_MODELS[model],
  system: [{ text: systemPrompt }],
  messages: messages.map(m => ({
    role: m.role,
    content: [{ text: m.content }],
  })),
  inferenceConfig: { maxTokens, temperature },
});
const response = await client.send(command);
```

### Pattern B: InvokeModel API (direct)
```typescript
// Used by: lib/memory/learning.ts, lib/memory/facts.ts, memory/synthesize
const command = new InvokeModelCommand({
  modelId: process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
  contentType: 'application/json',
  accept: 'application/json',
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  }),
});
```

**Recommendation:** Use Pattern A (Converse API) via `bedrockChatJSON` from `lib/bedrock.ts`. It's cleaner, handles response parsing, and abstracts the model ID. Just need to add `HAIKU_45` to the model constants.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic `soulprint_text` | 5 structured sections (SOUL, IDENTITY, USER, AGENTS, TOOLS) | This phase | Enables targeted updates, v2 regeneration |
| RLM generates everything | Quick pass (Haiku 4.5 on Vercel) + full pass (RLM background) | This phase | User starts chatting in ~30s instead of waiting minutes |
| `soulprint_text` as single string | Per-section TEXT columns + concatenated soulprint_text for compat | This phase | Gradual migration, no breaking changes |

## Open Questions

1. **Should `soulprint_text` concatenation include section headers?**
   - What we know: Chat route passes `soulprint_text` directly into system prompt under `ABOUT THIS PERSON:`
   - What's unclear: Should the concatenated text include `## SOUL\n...` headers or be seamless prose?
   - Recommendation: Include section headers (e.g., `## Communication Style\n...`) so the model can reference specific aspects. This matches how the sections will be used in Phase 3.

2. **Should the quick pass also set `ai_name` from the IDENTITY section?**
   - What we know: Currently `ai_name` is auto-generated on first chat message (chat/route.ts line 234-246) using a separate Haiku call.
   - What's unclear: Should we populate `ai_name` from `identity.ai_name` during quick pass instead?
   - Recommendation: Yes -- set `ai_name` from the IDENTITY section during quick pass. This eliminates the separate name generation call in the chat route and gives a more personality-derived name immediately.

3. **Token budget with very small exports (< 10 conversations)?**
   - What we know: Some users might have very few conversations
   - What's unclear: Will Haiku produce good sections from minimal data?
   - Recommendation: If fewer than 5 conversations with > 4 messages, include ALL of them and note in the prompt that data is limited. The sections should still be generated but with appropriate caveats.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed in this document
- `supabase/migrations/20260201_soulprint_files.sql` -- existing schema migration
- `.planning/REQUIREMENTS.md` -- requirement definitions and model ID
- `.planning/ROADMAP.md` -- phase definitions and success criteria

### Secondary (MEDIUM confidence)
- [AWS Bedrock Converse API - Claude](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_Converse_AnthropicClaude_section.html) -- API patterns
- [Claude Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) -- 200K context, 64K output
- [Supported Models in Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) -- Model IDs
- [Claude Haiku 4.5 Capabilities](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity) -- Capabilities overview
- [Claude Token Counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) -- ~4 chars/token estimate

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in codebase, no new deps
- Architecture: HIGH -- injection point clearly identified in process-server/route.ts
- Schema: HIGH -- migration files read directly, only tools_md missing
- Sampling strategy: MEDIUM -- logical approach but untested against real ChatGPT exports
- Prompt design: MEDIUM -- structured JSON prompting is well-established but specific prompt needs tuning
- Pitfalls: HIGH -- derived from direct code analysis of all downstream consumers

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable codebase, no fast-moving dependencies)
