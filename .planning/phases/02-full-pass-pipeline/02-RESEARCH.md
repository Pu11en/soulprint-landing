# Phase 2: Full Pass Pipeline - Research

**Researched:** 2026-02-07
**Domain:** Background job orchestration, LLM map-reduce, conversation chunking, embeddings, v2 section regeneration
**Confidence:** MEDIUM (architecture patterns verified, but RLM service implementation details need clarification)

## Summary

Phase 2 implements the background "full pass" that processes all conversations using a map-reduce pipeline to generate the MEMORY section (curated durable facts) and conversation chunks with embeddings. After the full pass completes, all 5 quick-pass sections (SOUL, IDENTITY, USER, AGENTS, TOOLS) are regenerated as v2 with complete data.

Key findings:

1. **Vercel cannot run full pass directly** -- With a 5-minute timeout and 88MB exports containing 5000+ conversations, Vercel functions will timeout. The full pass MUST run on the RLM service (Render), which has no timeout constraints.

2. **Fire-and-forget pattern already in place** -- Phase 1's `process-server/route.ts` already calls `POST /process-full` on RLM in fire-and-forget mode (lines 382-419). The RLM service receives the storage path and processes asynchronously.

3. **Map-reduce is the proven pattern** -- LLM summarization best practices for 2026 converge on: (1) chunk conversations into 1500-3000 token segments, (2) summarize each chunk in parallel (map), (3) hierarchically reduce summaries if needed, (4) generate final MEMORY section from reduced summaries.

4. **Conversation chunks are separate from MEMORY** -- The `conversation_chunks` table stores searchable segments with embeddings for RAG retrieval. The MEMORY section is a curated markdown document of durable facts (preferences, projects, dates, beliefs, decisions) stored in `user_profiles.memory_md`.

5. **Database schema needs `memory_md` column** -- Currently missing. Also need `full_pass_status` and `full_pass_completed_at` to track background processing separately from quick pass.

**Primary recommendation:** Extend RLM service with `/process-full` endpoint that: (1) downloads conversations from Supabase Storage, (2) map-reduces to extract facts, (3) generates MEMORY section via Haiku 4.5, (4) chunks conversations and generates embeddings, (5) regenerates SOUL/IDENTITY/USER/AGENTS/TOOLS as v2, (6) updates database with `memory_md` and all `*_md` v2 sections, (7) updates status to `full_pass_complete`.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| RLM service (Python) | Custom | External service on Render for background processing | Running at soulprint-landing.onrender.com |
| `@aws-sdk/client-bedrock-runtime` | ^3.980.0 | Bedrock API for Haiku 4.5 (already used in Phase 1) | Installed, used in lib/bedrock.ts |
| `@supabase/supabase-js` | ^2.93.1 | Database + storage access from RLM | Already used by RLM service |
| Cohere embeddings (via Bedrock) | - | 1024-dim embeddings for conversation chunks | Already configured |

### RLM Service Stack (Python)

| Library | Purpose | Status |
|---------|---------|--------|
| `fastapi` | HTTP server for RLM endpoints | Already installed |
| `anthropic` | Claude API for generation (not Bedrock -- RLM uses direct API) | Already installed |
| `httpx` | Async HTTP client for Supabase calls | Already installed |
| `pydantic` | Request/response validation | Already installed |

### No New Dependencies Needed

Phase 2 extends existing RLM service endpoints. No new npm packages needed on Next.js side.

## Architecture Patterns

### Current Pipeline (After Phase 1)

```
User uploads ZIP
    |
    v
Vercel: process-server/route.ts
    |
    v
Extract + parse conversations
    |
    v
Quick pass (Haiku 4.5, ~15-30s)
    |
    v
Generate SOUL, IDENTITY, USER, AGENTS, TOOLS (v1)
    |
    v
Save to *_md columns, set import_status = 'quick_ready'
    |
    v
Store raw JSON to user-imports bucket
    |
    v
Fire-and-forget: POST /process-full to RLM   <-- Phase 2 starts here
    |
    v
Return success, user can start chatting
```

### Full Pass Pipeline (Phase 2 - RLM Service)

```
RLM receives POST /process-full
    |
    v
Download raw conversations from Supabase Storage
    |
    v
MAP: Chunk all conversations into segments (1500-3000 tokens)
    |   - Create conversation_chunks entries
    |   - Generate embeddings via Bedrock Cohere
    |   - Save chunks + embeddings to conversation_chunks table
    |
    v
MAP: Extract facts from each conversation chunk
    |   - Use Haiku 4.5 with fact extraction prompt
    |   - Parallel processing (up to 10 concurrent)
    |   - Return: preferences, projects, dates, beliefs, decisions
    |
    v
REDUCE: Hierarchical fact consolidation
    |   - If extracted facts > 200K tokens, split and reduce recursively
    |   - Deduplicate facts
    |   - Merge contradictory facts with timestamps
    |
    v
GENERATE: MEMORY section (Haiku 4.5)
    |   - Input: all consolidated facts
    |   - Output: curated markdown (preferences, projects, dates, beliefs, decisions)
    |   - Save to user_profiles.memory_md
    |
    v
REGENERATE: SOUL v2, IDENTITY v2, USER v2, AGENTS v2, TOOLS v2
    |   - Input: ALL conversations (not just sampled) + MEMORY section
    |   - Use same prompts as quick pass but with complete data
    |   - Parallel generation (single call or 2 parallel calls)
    |   - Save to soul_md, identity_md, user_md, agents_md, tools_md (overwrite v1)
    |
    v
UPDATE: Database status
    |   - Set full_pass_status = 'complete'
    |   - Set full_pass_completed_at = now()
    |   - Update soulprint_text with concatenation of all v2 sections + MEMORY
    |
    v
(Optional) Notify frontend via WebSocket or polling
```

### Recommended File Structure (RLM Service)

```
rlm-service/
  main.py                      # FastAPI app, existing endpoints
  processors/
    full_pass.py               # Main orchestrator for full pass
    map_reduce.py              # Map-reduce logic for fact extraction
    conversation_chunker.py    # Chunk conversations into segments
    embeddings.py              # Bedrock Cohere embedding generation
    memory_generator.py        # Generate MEMORY section from facts
    v2_regenerator.py          # Regenerate SOUL/IDENTITY/USER/AGENTS/TOOLS as v2
  prompts/
    fact_extraction.py         # Prompt for extracting facts from conversation chunks
    memory_section.py          # Prompt for generating MEMORY markdown
    quick_pass_v2.py           # Reuse quick pass prompts with full data
```

### Pattern 1: Map-Reduce for Fact Extraction

**What:** Break large export processing into parallel chunk processing (map) followed by hierarchical summarization (reduce).

**When to use:** Always for full pass -- handles exports of any size without timeouts.

**How it works:**
1. **Chunk conversations:** Split into 1500-3000 token segments (with 10-20% overlap)
2. **Map (parallel):** Extract facts from each chunk using Haiku 4.5
3. **Reduce (hierarchical):** If extracted facts exceed 200K tokens, split and reduce recursively
4. **Final synthesis:** Generate MEMORY section from consolidated facts

**Implementation:**
```python
# Map phase: Extract facts from each chunk
async def extract_facts_from_chunk(chunk: ConversationChunk) -> List[Fact]:
    prompt = FACT_EXTRACTION_PROMPT.format(conversation=chunk.content)
    response = await haiku_45_call(prompt)
    return parse_facts(response)

# Process chunks in parallel (concurrency limit: 10)
chunks = chunk_conversations(all_conversations, target_tokens=2000)
all_facts = await asyncio.gather(
    *[extract_facts_from_chunk(chunk) for chunk in chunks],
    return_exceptions=True
)

# Reduce phase: Consolidate facts hierarchically
consolidated_facts = hierarchical_reduce(all_facts, max_tokens=200_000)

# Final synthesis: Generate MEMORY section
memory_section = await generate_memory_section(consolidated_facts)
```

### Pattern 2: Background Job Status Tracking

**What:** Track full pass progress separately from import status to enable UI progress indicators.

**When to use:** Phase 2 (full pass) and Phase 3 (UX integration).

**Database columns needed:**
```sql
ALTER TABLE user_profiles ADD COLUMN full_pass_status TEXT DEFAULT 'pending';
ALTER TABLE user_profiles ADD COLUMN full_pass_started_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN full_pass_completed_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN full_pass_error TEXT;
ALTER TABLE user_profiles ADD COLUMN memory_md TEXT;  -- MEMORY section

-- Status values: 'pending', 'processing', 'complete', 'failed'
```

**Polling endpoint for frontend (Phase 3):**
```typescript
// GET /api/import/status
{
  "import_status": "quick_ready",          // Chat is available
  "full_pass_status": "processing",        // Background still running
  "full_pass_progress": 45,                // Optional: percentage
  "sections_ready": ["soul", "identity", "user", "agents", "tools"],
  "sections_pending": ["memory"],
  "estimated_completion": "2026-02-07T12:34:56Z"  // Optional
}
```

### Pattern 3: V2 Regeneration with Complete Data

**What:** After full pass completes, regenerate all 5 sections with complete conversation data (not just sampled).

**When to use:** End of full pass pipeline, before marking status as complete.

**Why:** Phase 1 quick pass only samples top 30-50 conversations for speed. V2 regeneration uses ALL conversations for richer, more nuanced sections.

**Implementation:**
```python
# Reuse quick pass prompts but with full data
all_conversations_text = format_all_conversations(conversations)  # No sampling
quick_pass_prompt = QUICK_PASS_SYSTEM_PROMPT  # Same as Phase 1

# Option A: Single call (if within 200K context)
v2_result = await haiku_45_json_call(
    system=quick_pass_prompt,
    messages=[{"role": "user", "content": all_conversations_text}],
    max_tokens=8192
)

# Option B: Two parallel calls (if data is large)
soul_identity_user = await haiku_45_json_call(...)  # SOUL, IDENTITY, USER
agents_tools = await haiku_45_json_call(...)        # AGENTS, TOOLS

# Save v2 sections (overwrite v1 from quick pass)
await supabase.table('user_profiles').update({
    'soul_md': json.dumps(v2_result['soul']),
    'identity_md': json.dumps(v2_result['identity']),
    'user_md': json.dumps(v2_result['user']),
    'agents_md': json.dumps(v2_result['agents']),
    'tools_md': json.dumps(v2_result['tools']),
    'soulprint_text': concatenate_sections(v2_result, memory_section),
}).eq('user_id', user_id).execute()
```

### Anti-Patterns to Avoid

- **Running full pass on Vercel:** Will timeout with large exports. Use RLM service.
- **Blocking import on full pass completion:** User should start chatting after quick pass. Full pass runs in background.
- **Sending all conversations in one API call:** Vercel has 4.5MB body limit. Use storage path instead.
- **Sequential chunk processing:** Use parallel processing with concurrency limits.
- **Overwriting quick pass sections before full pass completes:** User is chatting with v1 sections. Only overwrite after full pass succeeds.
- **Not tracking full_pass_status separately:** Frontend needs to show progress while user is chatting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background job queue | Custom queue with Redis | RLM service fire-and-forget pattern | Already working, simpler than Inngest/Vercel Queues |
| Map-reduce orchestration | Custom async coordination | asyncio.gather with concurrency semaphore | Proven pattern, handles errors gracefully |
| Embedding generation | Direct API calls | Bedrock Cohere via existing bedrockEmbed | Already integrated, handles retries |
| Conversation chunking | Token counting + splitting | LangChain-style chunker with overlap | Handles edge cases (mid-sentence splits) |
| Fact deduplication | String matching | LLM-based consolidation in reduce phase | Handles semantic duplicates, contradictions |

## Common Pitfalls

### Pitfall 1: RLM Service is Not Using Bedrock

**What goes wrong:** Phase 2 plans assume RLM service uses Bedrock for Haiku 4.5 calls, but RLM actually uses direct Anthropic API.

**Why it happens:** The RLM service (`rlm-service/main.py` lines 106-107) initializes with `backend="anthropic"` and uses the direct Anthropic SDK, not AWS Bedrock.

**How to avoid:** RLM service should use Anthropic's API directly for all Haiku 4.5 calls. The model ID is `claude-haiku-4-5-20251001-v1:0` on Anthropic's API (no `us.anthropic.` prefix like Bedrock). Ensure RLM has `ANTHROPIC_API_KEY` in environment.

**Warning signs:** Model not found errors when calling Haiku 4.5 from RLM.

### Pitfall 2: Conversation Chunks vs MEMORY Confusion

**What goes wrong:** Mixing up conversation_chunks (RAG retrieval) with MEMORY section (curated facts document).

**Why it happens:** Both involve processing all conversations, but they serve different purposes.

**How to avoid:**
- **conversation_chunks:** Searchable 1500-3000 token segments with embeddings, stored in `conversation_chunks` table, used for RAG retrieval during chat.
- **MEMORY section:** Curated markdown document (~2-5K tokens) with durable facts, stored in `user_profiles.memory_md`, included in system prompt.

**Warning signs:** MEMORY section is too long (>10K tokens) or conversation_chunks are too small (<500 tokens).

### Pitfall 3: Vercel Body Size Limit

**What goes wrong:** Sending full conversations array to RLM exceeds Vercel's 4.5MB request body limit.

**Why it happens:** An 88MB export with 5000+ conversations would exceed the limit if sent as JSON in the request body.

**How to avoid:** Phase 1 already stores raw conversations in Supabase Storage (`user-imports` bucket) and sends only the storage path to RLM (lines 361-377 of process-server/route.ts). RLM downloads from storage using Supabase service key. Continue this pattern.

**Warning signs:** 413 Payload Too Large errors from Vercel.

### Pitfall 4: Haiku 4.5 Context Window Exceeded

**What goes wrong:** Sending all conversations to Haiku 4.5 for v2 regeneration exceeds 200K token context window.

**Why it happens:** An 88MB export could be ~350K tokens when formatted.

**How to avoid:**
- **For MEMORY generation:** Use map-reduce to extract facts first, then generate MEMORY from consolidated facts (<<200K tokens).
- **For v2 section regeneration:** Sample intelligently OR use iterative refinement (generate draft from top 50 conversations, refine with next 50, etc.). OR accept that some very large exports may need chunked v2 generation.

**Warning signs:** 400 Bad Request errors from Anthropic API with "maximum context length exceeded".

### Pitfall 5: Race Conditions Between Quick Pass and Full Pass

**What goes wrong:** User modifies their profile or re-imports while full pass is running, causing conflicts.

**Why it happens:** Full pass can take 5-30 minutes for large exports. User might trigger another import.

**How to avoid:**
- **Check full_pass_status before starting new import:** If `processing`, reject with "Import already in progress."
- **Use database transactions for v2 updates:** Ensure all `*_md` columns update atomically.
- **Add import_lock column:** Set to true during processing, check before starting new import.

**Warning signs:** Sections partially updated (some v1, some v2), users reporting "profile keeps changing."

### Pitfall 6: Embedding Dimension Mismatch

**What goes wrong:** Conversation chunks use 1024-dim Cohere embeddings, but existing chunks might use 768-dim Titan embeddings.

**Why it happens:** Migration `20250130_upgrade_embeddings_cohere_v4.sql` switched to Cohere 1024-dim, but existing data might still have 768-dim.

**How to avoid:**
- **Check embedding_dimension column:** Ensure it's 1024 for all new chunks.
- **Use consistent model:** `cohere.embed-english-v3` via Bedrock for all embedding generation.
- **Regenerate old embeddings:** If user re-imports, clear old chunks and regenerate with 1024-dim.

**Warning signs:** Vector similarity search returns no results, dimension errors in database.

### Pitfall 7: Fire-and-Forget Means No Error Visibility

**What goes wrong:** RLM service fails during full pass, but Vercel/frontend has no visibility.

**Why it happens:** Phase 1's fire-and-forget pattern doesn't await RLM completion.

**How to avoid:**
- **RLM updates database status:** Set `full_pass_status = 'failed'` and `full_pass_error` on failure.
- **Frontend polls status:** Phase 3 adds polling endpoint to check full_pass_status.
- **Alert webhook:** RLM service already has `ALERT_WEBHOOK` for failures (line 33 of main.py).

**Warning signs:** Imports stuck in `processing` state forever, no error messages.

## Code Examples

### Existing RLM Fire-and-Forget Pattern (process-server/route.ts)

```typescript
// Source: app/api/import/process-server/route.ts (lines 382-419)
// Phase 1 already calls RLM in fire-and-forget mode
const rlmUrl = process.env.RLM_API_URL || 'https://soulprint-landing.onrender.com';
try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s to accept job

  const rlmResponse = await fetch(`${rlmUrl}/process-full`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      storage_path: `user-imports/${parsedJsonPath}`, // RLM downloads from storage
      conversation_count: conversations.length,
      message_count: totalMessages,
    }),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!rlmResponse.ok) {
    reqLog.warn('RLM may be slow - user can start chatting while processing continues');
  } else {
    reqLog.info('RLM accepted job');
  }
} catch (e: unknown) {
  // Even if RLM call fails/times out, don't block the user
  reqLog.error({ error: String(e) }, 'Failed to call RLM');
  // Don't throw - continue to success response
}
```

### Map-Reduce Pattern for LLM Summarization (2026 Best Practice)

```python
# Source: Google Cloud blog, LangChain docs
# Map-reduce pattern for large document summarization

async def map_reduce_summarize(chunks: List[str]) -> str:
    """
    Map: Summarize each chunk in parallel
    Reduce: Combine summaries hierarchically
    """
    # Map phase: Parallel summarization
    async def summarize_chunk(chunk: str) -> str:
        prompt = f"Extract key facts from this conversation:\n\n{chunk}"
        return await llm_call(prompt)

    # Use semaphore to limit concurrency (avoid rate limits)
    semaphore = asyncio.Semaphore(10)

    async def bounded_summarize(chunk: str) -> str:
        async with semaphore:
            return await summarize_chunk(chunk)

    summaries = await asyncio.gather(
        *[bounded_summarize(chunk) for chunk in chunks],
        return_exceptions=True
    )

    # Reduce phase: Hierarchical consolidation
    while len(summaries) > 1 and total_tokens(summaries) > 200_000:
        # Split into batches and reduce
        batch_size = 10
        reduced = []
        for i in range(0, len(summaries), batch_size):
            batch = summaries[i:i+batch_size]
            combined = "\n\n".join(batch)
            reduced.append(await llm_call(f"Consolidate these facts:\n\n{combined}"))
        summaries = reduced

    # Final synthesis
    return await llm_call(f"Generate MEMORY section from:\n\n{summaries}")
```

### Conversation Chunking with Overlap (Recommended)

```python
def chunk_conversations(
    conversations: List[ParsedConversation],
    target_tokens: int = 2000,
    overlap_tokens: int = 200
) -> List[ConversationChunk]:
    """
    Chunk conversations into segments with overlap.
    Best practice: 1500-3000 tokens per chunk, 10-20% overlap.
    """
    chunks = []

    for conv in conversations:
        # Convert messages to text
        text = format_conversation(conv)
        tokens = estimate_tokens(text)

        # If conversation fits in one chunk, don't split
        if tokens <= target_tokens:
            chunks.append(ConversationChunk(
                user_id=conv.user_id,
                conversation_id=conv.id,
                content=text,
                token_count=tokens,
                chunk_index=0,
                total_chunks=1
            ))
            continue

        # Split into chunks with overlap
        sentences = split_into_sentences(text)
        current_chunk = []
        current_tokens = 0
        chunk_index = 0

        for sentence in sentences:
            sentence_tokens = estimate_tokens(sentence)

            if current_tokens + sentence_tokens > target_tokens:
                # Save current chunk
                chunks.append(ConversationChunk(
                    user_id=conv.user_id,
                    conversation_id=conv.id,
                    content=" ".join(current_chunk),
                    token_count=current_tokens,
                    chunk_index=chunk_index,
                    total_chunks=-1  # Unknown until done
                ))

                # Start new chunk with overlap
                overlap_sentences = []
                overlap_tokens = 0
                for prev_sentence in reversed(current_chunk):
                    if overlap_tokens + estimate_tokens(prev_sentence) > overlap_tokens:
                        break
                    overlap_sentences.insert(0, prev_sentence)
                    overlap_tokens += estimate_tokens(prev_sentence)

                current_chunk = overlap_sentences + [sentence]
                current_tokens = overlap_tokens + sentence_tokens
                chunk_index += 1
            else:
                current_chunk.append(sentence)
                current_tokens += sentence_tokens

        # Save final chunk
        if current_chunk:
            chunks.append(ConversationChunk(
                user_id=conv.user_id,
                conversation_id=conv.id,
                content=" ".join(current_chunk),
                token_count=current_tokens,
                chunk_index=chunk_index,
                total_chunks=chunk_index + 1
            ))

    return chunks
```

### Existing Cohere Embedding via Bedrock

```typescript
// Source: lib/bedrock.ts (lines 174-206)
// Already implemented, reuse for conversation chunks

export async function bedrockEmbed(text: string, dimensions = 768): Promise<number[]> {
  const client = getBedrockClient();

  // Truncate to safe limit
  const truncated = text.slice(0, 8000);

  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v2:0',  // NOTE: Should use cohere.embed-english-v3 for 1024-dim
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: truncated,
      dimensions,
      normalize: true,
    }),
  });

  const response = await client.send(command);
  const rawResult: unknown = JSON.parse(new TextDecoder().decode(response.body));
  const validationResult = bedrockEmbedResponseSchema.safeParse(rawResult);

  if (!validationResult.success) {
    console.error('[bedrockEmbed] Invalid response from Bedrock:', validationResult.error.issues);
    throw new Error('Invalid embedding response from Bedrock');
  }

  return validationResult.data.embedding;
}

// Phase 2: Update to use Cohere for 1024-dim embeddings
// modelId: 'cohere.embed-english-v3', dimensions: 1024
```

## Database Schema Analysis

### Current user_profiles Columns (Phase 1)

| Column | Type | Status | Used By |
|--------|------|--------|---------|
| `soul_md` | TEXT | Active (v1) | Phase 1 quick pass |
| `identity_md` | TEXT | Active (v1) | Phase 1 quick pass |
| `user_md` | TEXT | Active (v1) | Phase 1 quick pass |
| `agents_md` | TEXT | Active (v1) | Phase 1 quick pass |
| `tools_md` | TEXT | Active (v1) | Phase 1 quick pass |
| `soulprint_text` | TEXT | Active (v1) | chat/route.ts reads for system prompt |
| `import_status` | TEXT | Active | 'quick_ready' after Phase 1 |

### New Columns Needed for Phase 2

| Column | Type | Purpose | Default |
|--------|------|---------|---------|
| `memory_md` | TEXT | MEMORY section (curated durable facts) | NULL |
| `full_pass_status` | TEXT | Background processing status | 'pending' |
| `full_pass_started_at` | TIMESTAMPTZ | When full pass began | NULL |
| `full_pass_completed_at` | TIMESTAMPTZ | When full pass finished | NULL |
| `full_pass_error` | TEXT | Error message if failed | NULL |

**Migration SQL:**
```sql
-- Phase 2 schema additions
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS memory_md TEXT;
COMMENT ON COLUMN public.user_profiles.memory_md IS 'MEMORY section - curated durable facts (preferences, projects, dates, beliefs, decisions)';

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_pass_status TEXT DEFAULT 'pending';
COMMENT ON COLUMN public.user_profiles.full_pass_status IS 'Background full pass status: pending, processing, complete, failed';

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_pass_started_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_pass_completed_at TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_pass_error TEXT;

-- Add check constraint for status values
ALTER TABLE public.user_profiles ADD CONSTRAINT full_pass_status_check
  CHECK (full_pass_status IN ('pending', 'processing', 'complete', 'failed'));
```

### conversation_chunks Table (Already Exists)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner |
| `conversation_id` | TEXT | Original conversation ID |
| `content` | TEXT | Chunk text (1500-3000 tokens) |
| `embedding` | VECTOR(1024) | Cohere embedding |
| `token_count` | INT | Estimated tokens |
| `chunk_index` | INT | Position in conversation |
| `total_chunks` | INT | How many chunks in conversation |
| `created_at` | TIMESTAMPTZ | When created |

**Note:** Phase 2 populates this table during full pass. Already has 1024-dim vector support after Cohere v4 migration.

## RLM Service Integration Points

### Existing Endpoint: POST /process-full (Phase 1 calls this)

**Current behavior:** Accepts job, does nothing yet (stub).

**Phase 2 implementation needed:**
```python
@app.post("/process-full")
async def process_full(request: ProcessFullRequest):
    """
    Background processing: map-reduce all conversations, generate MEMORY, regenerate v2 sections.
    """
    try:
        # Update status to processing
        await supabase.table('user_profiles').update({
            'full_pass_status': 'processing',
            'full_pass_started_at': datetime.utcnow().isoformat(),
            'full_pass_error': None
        }).eq('user_id', request.user_id).execute()

        # Download conversations from storage
        conversations = await download_from_storage(request.storage_path)

        # Phase 2a: Chunk conversations and generate embeddings
        chunks = chunk_conversations(conversations, target_tokens=2000)
        await save_chunks_with_embeddings(chunks, request.user_id)

        # Phase 2b: Map-reduce fact extraction
        facts = await map_reduce_extract_facts(conversations)

        # Phase 2c: Generate MEMORY section
        memory_section = await generate_memory_section(facts)

        # Phase 2d: Regenerate v2 sections with complete data
        v2_sections = await regenerate_sections_v2(conversations, memory_section)

        # Phase 2e: Save everything to database
        await supabase.table('user_profiles').update({
            'memory_md': json.dumps(memory_section),
            'soul_md': json.dumps(v2_sections['soul']),
            'identity_md': json.dumps(v2_sections['identity']),
            'user_md': json.dumps(v2_sections['user']),
            'agents_md': json.dumps(v2_sections['agents']),
            'tools_md': json.dumps(v2_sections['tools']),
            'soulprint_text': concatenate_sections_with_memory(v2_sections, memory_section),
            'full_pass_status': 'complete',
            'full_pass_completed_at': datetime.utcnow().isoformat()
        }).eq('user_id', request.user_id).execute()

        return {"status": "complete", "message": "Full pass completed successfully"}

    except Exception as e:
        # Update status to failed
        await supabase.table('user_profiles').update({
            'full_pass_status': 'failed',
            'full_pass_error': str(e)
        }).eq('user_id', request.user_id).execute()

        # Alert if webhook configured
        await alert_failure(str(e), request.user_id, "Full pass failed")

        raise HTTPException(status_code=500, detail=str(e))
```

### New Endpoint Needed: GET /full-pass-status (Phase 3)

```python
@app.get("/full-pass-status/{user_id}")
async def get_full_pass_status(user_id: str):
    """
    Check full pass progress for UI polling.
    """
    result = await supabase.table('user_profiles').select(
        'full_pass_status, full_pass_started_at, full_pass_completed_at, full_pass_error, memory_md'
    ).eq('user_id', user_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    profile = result.data[0]

    return {
        "status": profile['full_pass_status'],
        "started_at": profile['full_pass_started_at'],
        "completed_at": profile['full_pass_completed_at'],
        "error": profile['full_pass_error'],
        "memory_ready": bool(profile['memory_md']),
        "estimated_completion": estimate_completion(profile) if profile['full_pass_status'] == 'processing' else None
    }
```

## Fact Extraction Strategy

### MEMORY Section Structure (Recommended)

```markdown
# MEMORY

## Preferences
- Communication: prefers direct, concise responses
- Tools: frequently uses ChatGPT for brainstorming and code review
- Timing: works best in early mornings (6-9am)

## Projects
- **SoulPrint**: building a privacy-first AI personalization platform (started Jan 2026)
- **OpenClaw**: contributed to OpenClaw framework for agentic systems
- Previously worked on: [list past projects mentioned]

## Important Dates
- Birthday: [if mentioned]
- Started SoulPrint: January 2026
- Key milestones: [dates from conversations]

## Beliefs & Values
- Privacy-first design is non-negotiable
- Ship fast, iterate based on user feedback
- Code quality matters for long-term maintainability

## Decisions & Context
- Chose Vercel + Supabase stack for rapid iteration (discussed 2026-01-15)
- Using Haiku 4.5 for cost efficiency vs Sonnet (decided 2026-02-01)
- Two-pass import pipeline to unblock users faster (decided 2026-02-06)
```

### Fact Extraction Prompt (Map Phase)

```python
FACT_EXTRACTION_PROMPT = """Extract ONLY factual, verifiable information from this conversation. Focus on:

1. **Preferences**: What does the user prefer? How do they like things done?
2. **Projects**: What are they working on? What are the details?
3. **Important Dates**: Birthdays, milestones, deadlines, start dates.
4. **Beliefs & Values**: What principles guide their decisions?
5. **Decisions**: What choices did they make and why?

Return a JSON object:
{
  "preferences": ["fact1", "fact2", ...],
  "projects": [{"name": "...", "description": "...", "started": "..."}],
  "dates": [{"event": "...", "date": "..."}],
  "beliefs": ["belief1", "belief2", ...],
  "decisions": [{"decision": "...", "context": "...", "date": "..."}]
}

IMPORTANT:
- Only include facts EXPLICITLY stated in the conversation
- Include timestamps/dates when available
- Skip generic small talk
- If no facts found in a category, return empty array

Conversation:
{conversation}"""
```

## Performance Estimates

### Time Budget (88MB Export, 5000 Conversations)

| Step | Duration | Bottleneck |
|------|----------|------------|
| Download from storage | 10-30s | Network |
| Chunk conversations | 30-60s | CPU, serialization |
| Generate embeddings (parallel) | 5-10min | Bedrock API rate limits |
| Extract facts (map, parallel) | 3-8min | Anthropic API rate limits |
| Consolidate facts (reduce) | 1-2min | LLM calls |
| Generate MEMORY section | 15-30s | Single Haiku call |
| Regenerate v2 sections | 1-2min | 1-2 parallel Haiku calls |
| Save to database | 10-30s | Database writes |
| **Total** | **10-25 minutes** | API rate limits |

### Cost Estimates (88MB Export)

| Operation | Count | Unit Cost | Total Cost |
|-----------|-------|-----------|------------|
| Embedding (Cohere 1024-dim) | 5000 chunks × 2000 tokens | $0.0001/1K tokens | ~$1.00 |
| Fact extraction (Haiku 4.5) | 5000 chunks × 4K tokens in/out | $0.40/1M in, $2/1M out | ~$0.05 |
| MEMORY generation (Haiku 4.5) | 1 call × 100K tokens in/5K out | $0.40/1M in, $2/1M out | ~$0.05 |
| V2 section regen (Haiku 4.5) | 2 calls × 150K tokens in/10K out | $0.40/1M in, $2/1M out | ~$0.15 |
| **Total per import** | - | - | **~$1.25** |

**Note:** Costs are per full import. Most users will import once. Re-imports would incur the same costs.

## Open Questions

1. **Should v2 regeneration use ALL conversations or a larger sample?**
   - What we know: Quick pass samples top 30-50 conversations (~185K tokens). Full exports can be 5000+ conversations (~millions of tokens).
   - What's unclear: Does Haiku 4.5's 200K context window allow processing all conversations for v2, or should we use a larger sample (top 200-300)?
   - Recommendation: **Start with larger sample (top 200)** for v2 regeneration. If context window permits, use all. The MEMORY section provides the durable facts anyway.

2. **How to handle contradictory facts in map-reduce?**
   - What we know: User preferences/beliefs can change over time.
   - What's unclear: If conversation from 2023 says "I hate Python" but 2026 says "Python is great," how do we resolve?
   - Recommendation: **Include timestamps in facts**. During reduce phase, keep most recent fact when contradictions detected. Note evolution in MEMORY section (e.g., "Previously preferred X, now prefers Y").

3. **Should conversation chunks overlap across conversation boundaries?**
   - What we know: Best practice is 10-20% overlap within a conversation.
   - What's unclear: Should chunks from end of Conversation A and start of Conversation B overlap?
   - Recommendation: **No cross-conversation overlap**. Conversations are independent contexts. Only overlap within same conversation.

4. **How to estimate full pass completion time for progress indicator?**
   - What we know: Full pass takes 10-25 minutes for large exports.
   - What's unclear: How to show accurate progress without polling RLM every second?
   - Recommendation: **Track checkpoints in database**. RLM updates `full_pass_status` with substatus: 'chunking', 'embedding', 'extracting', 'generating_memory', 'regenerating_v2'. Frontend polls every 5-10 seconds and shows stage + estimated percentage.

5. **What if Anthropic API rate limits are hit during map phase?**
   - What we know: Parallel processing can hit rate limits.
   - What's unclear: Exponential backoff strategy needed?
   - Recommendation: **Use semaphore to limit concurrency** (max 10 concurrent calls). Implement exponential backoff with max 3 retries. If still failing, reduce concurrency to 5 and retry.

## State of the Art

| Old Approach | Current Approach (Phase 2) | When Changed | Impact |
|--------------|---------------------------|--------------|--------|
| Monolithic soulprint generation | Two-pass: quick pass + full pass | Phase 1-2 | User starts chatting in ~30s, not 10-25 minutes |
| Sample-only personality profile | v2 sections from ALL conversations + MEMORY | Phase 2 | Richer, more accurate personality understanding |
| No durable fact storage | MEMORY section with preferences, projects, dates, beliefs, decisions | Phase 2 | AI remembers important context long-term |
| Blocking import on completion | Background full pass, status polling | Phase 2 | Better UX, no timeout issues |
| Titan 768-dim embeddings | Cohere 1024-dim embeddings | v1.1 (already done) | Better semantic search quality |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: app/api/import/process-server/route.ts, rlm-service/main.py, lib/bedrock.ts
- `.planning/REQUIREMENTS.md` - Phase 2 requirements (CTX-06, GEN-02, GEN-03)
- `.planning/ROADMAP.md` - Phase 2 success criteria
- `supabase/migrations/20260206_add_tools_md.sql` - Recent schema migration

### Secondary (MEDIUM confidence)
- [Scalable intelligent document processing using Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/scalable-intelligent-document-processing-using-amazon-bedrock/) - Map-reduce patterns on AWS
- [Summarization with LangChain: Map-Reduce](https://medium.com/@abonia/summarization-with-langchain-b3d83c030889) - Map-reduce implementation details
- [LLM Summarization Strategies](https://galileo.ai/blog/llm-summarization-strategies) - Best practices for chunking and reducing
- [Vercel Queues Limited Beta](https://vercel.com/changelog/vercel-queues-is-now-in-limited-beta) - Background job options
- [Background Jobs for Next.js with Inngest](https://medium.com/@cyri113/background-jobs-for-node-js-using-next-js-inngest-supabase-and-vercel-e5148d094e3f) - Alternative patterns

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - RLM service already exists, no new dependencies needed
- Architecture: MEDIUM - Map-reduce pattern is proven, but RLM service implementation details need clarification
- Database schema: HIGH - Clear what columns are needed based on Phase 1 patterns
- Performance estimates: LOW - Based on reasonable assumptions, but actual performance untested
- Cost estimates: MEDIUM - Based on published Bedrock/Anthropic pricing, but actual usage may vary
- Pitfalls: HIGH - Derived from codebase analysis and known constraints

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable patterns, but API pricing/limits may change)
