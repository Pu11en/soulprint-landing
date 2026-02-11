# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Distributed Pipeline + Microservice Pattern

SoulPrint follows a two-tier async architecture: the **Next.js frontend/API layer** orchestrates import jobs and chat queries, while the **RLM Python service** (deployed separately on Render) handles heavy processing in background tasks. The system uses streaming download, constant-memory JSON parsing, and fire-and-forget task queuing to handle large ChatGPT exports (300MB+) without OOM failures.

**Key Characteristics:**
- **Asynchronous processing** - Long-running imports triggered via fire-and-forget background tasks, never block user requests
- **Constant-memory streaming** - Download to temp file + ijson file-based parsing, not in-memory accumulation
- **Multi-stage pipeline** - Quick Pass (quick soulprint, 15-30s) enables immediate chat; Full Pass (chunks, facts, memory) runs async afterwards
- **Circuit breaker pattern** - RLM health check with graceful degradation to fallback API
- **Distributed state** - Supabase as single source of truth (user_profiles, conversation_chunks, chat_messages)

## Layers

**API Orchestration Layer (Next.js):**
- Purpose: HTTP entry point, authentication gate, state validation, rate limiting
- Location: `app/api/`
- Contains: 32 route handlers spread across `/import`, `/chat`, `/memory`, `/rlm`, `/health`
- Depends on: Supabase auth, Redis for rate limiting, RLM service
- Used by: Browser frontend, mobile apps, internal tools

**RLM Service Layer (Python/FastAPI):**
- Purpose: Heavy lifting - download exports, parse conversations, generate soulprints, query with memory
- Location: `rlm-service/` (separate Render deployment)
- Contains: Main FastAPI app (`main.py`), processors (`processors/`), prompt builders
- Depends on: Supabase Storage (download), Supabase REST API (state updates), Anthropic API (Haiku 4.5, Claude Sonnet), AWS Bedrock (alternative)
- Used by: Next.js API layer, triggered via HTTP POST

**Processors (Importers/Generators):**
- Purpose: Modular transformation steps - streaming download, parsing, chunking, fact extraction, soulprint generation
- Location: `rlm-service/processors/`
- Key files: `streaming_import.py`, `quick_pass.py`, `full_pass.py`, `conversation_chunker.py`, `fact_extractor.py`, `dag_parser.py`
- Pattern: Stateless functions that read from Supabase Storage, write to Supabase DB

**Database Layer (Supabase):**
- Purpose: Persistent state - user profiles, conversation chunks, chat messages, embeddings
- Accessed via: Supabase REST API (from RLM), Supabase JS client (from Next.js)
- Key tables: `user_profiles`, `conversation_chunks`, `chat_messages`, `conversations`, `learned_facts`, `conversation_embeddings`

**Client Layer (React):**
- Purpose: Upload UI, progress polling, chat interface
- Location: `app/import/page.tsx`, `app/chat/page.tsx`, `components/`
- Integrations: TUS for resumable upload, Supabase Real-time (future), polling for progress updates

## Data Flow

**Import Flow (User Uploads ChatGPT Export):**

```
1. Frontend (app/import/page.tsx)
   ↓ User selects ZIP file or JSON from ChatGPT
   ↓ (Attempt client-side extraction if <100MB)
   ↓ Upload to Supabase Storage via TUS (resumable protocol)

2. Next.js API (app/api/import/trigger/route.ts)
   ↓ POST /import/trigger with storagePath
   ↓ Auth check + rate limit check
   ↓ Duplicate import guard (if already processing, reject with 409)
   ↓ Set user_profiles.import_status = 'processing'
   ↓ Fire-and-forget POST to RLM /import-full endpoint (10s timeout)
   ↓ Return 202 Accepted immediately

3. RLM Service Background Task (rlm-service/processors/streaming_import.py)
   ↓ process_import_streaming() via asyncio.create_task()

   Stage 1 (0-20%): Download from Supabase Storage
   - Stream to temp file (chunk-by-chunk, constant memory)
   - If ZIP, extract conversations.json
   - Update progress_percent via Supabase PATCH

   Stage 2 (20-50%): Parse conversations
   - ijson.items() from file handle (not load whole file to RAM)
   - DAG traversal per conversation (extract_active_path)
   - Build list of {id, title, createdAt, messages}

   Stage 3 (50-100%): Generate Quick Pass
   - Sample richest conversations (token budget aware)
   - Call Haiku 4.5 via AWS Bedrock for personality analysis
   - Returns 5 sections: {soul, identity, user, agents, tools}

   Stage 3.5: Save Quick Pass to DB
   - Upsert user_profiles with soul_md, identity_md, user_md, agents_md, tools_md
   - Set soulprint_text (pre-rendered for chat)
   - Set import_status = 'quick_ready' (user can now chat)
   - Set ai_name, archetype from identity section

   Stage 4: Trigger Full Pass (background, fire-and-forget)
   - asyncio.create_task(trigger_full_pass)
   - Does NOT block chat access

4. Full Pass Pipeline (rlm-service/processors/full_pass.py)
   - Re-download conversations from Storage
   - Chunk conversations into ~2000 token segments
   - Save chunks to conversation_chunks table
   - Extract facts from chunks in parallel (10 at a time)
   - Consolidate facts
   - Generate MEMORY section from facts
   - Update user_profiles.full_pass_status = 'complete'
   - Hard timeout: 30 minutes

5. Frontend Polling (app/import/page.tsx)
   ↓ Poll user_profiles every 3 seconds for progress_percent, import_stage, import_status
   ↓ Once import_status = 'quick_ready', redirect to /chat
   ↓ (Full pass completes in background, not blocking chat)
```

**Query Flow (User Sends Chat Message):**

```
1. Frontend Chat (app/chat/page.tsx)
   ↓ User types message
   ↓ POST /api/chat/messages with role, content, conversation_id

2. Next.js Chat API (app/api/chat/messages/route.ts)
   ↓ Save message to chat_messages table
   ↓ (Actual AI response comes from different endpoint or streaming)

3. Chat Query Handler (specific endpoint, not in read files)
   ↓ Fetch user profile from user_profiles
   ↓ Check shouldAttemptRLM() via circuit breaker (lib/rlm/health.ts)
   ↓ Fetch recent conversation_chunks for context
   ↓ POST /query to RLM service

4. RLM Query Endpoint (rlm-service/main.py @app.post("/query"))
   ↓ Fetch conversation chunks from Supabase
   ↓ Build conversation_context from 50 most recent chunks
   ↓ Try query_with_rlm() first (RLM library)
   ↓ On RLM failure, fall back to query_fallback()

   query_with_rlm():
   - Initialize RLM with Claude Sonnet 4 backend
   - Build emotionally intelligent system prompt via PromptBuilder
   - Send context + message history to RLM

   query_fallback():
   - Use Anthropic SDK directly (no RLM)
   - Tool-calling loop: LLM decides if web_search needed
   - Tavily web search integration for real-time queries

5. Return QueryResponse
   ↓ {response: str, chunks_used: int, method: "rlm" | "fallback", latency_ms: int}
```

**State Tracking During Import:**

```
user_profiles table columns:
- import_status: 'none' → 'processing' → 'quick_ready' (chat enabled) → 'complete' (full pass done)
- progress_percent: 0-100 (updated at each stage)
- import_stage: "Downloading export" → "Parsing conversations" → "Generating soulprint" → "Complete"
- import_error: null or error message (set on failure)
- soul_md, identity_md, user_md, agents_md, tools_md: JSON strings from quick pass
- soulprint_text: Pre-rendered markdown for chat (combines all sections)
- ai_name, archetype: From identity section
- full_pass_status: 'none' → 'processing' → 'complete' or 'failed'
```

## Key Abstractions

**Streaming Download & Parse (Memory Efficient):**
- Purpose: Process 300MB+ ChatGPT exports without OOM on Render's 512MB RAM limit
- Examples: `rlm-service/processors/streaming_import.py` (download_streaming, parse_conversations_streaming)
- Pattern:
  1. httpx.AsyncClient.stream() → write chunks to temp file
  2. ijson.items(file_handle) → parse from disk
  3. Result: ~1-5MB peak memory regardless of file size

**DAG Traversal (ChatGPT Message Tree):**
- Purpose: Extract only the "active" conversation path (ignore branches/regenerations)
- Examples: `rlm-service/processors/dag_parser.py` (extract_active_path)
- Pattern: ChatGPT export has tree structure (branches from regenerates); traverse to leaf, work backwards to root

**Multi-Stage Import Pipeline:**
- Purpose: Separate concerns - quick soulprint (15-30s) vs full context (30 min)
- Stages:
  1. Quick Pass: Personality sections (5 structured JSON sections)
  2. Full Pass: Conversation chunks, fact extraction, memory synthesis
- Pattern: Quick Pass unblocks chat; Full Pass runs async, enhances over time

**Prompt Builder (Versioned):**
- Purpose: Construct system prompts deterministically from structured sections
- Examples: `rlm-service/prompt_builder.py`, `lib/soulprint/prompt-builder.ts`
- Versions: v1-technical (markdown headers), v2-natural-voice (flowing personality)
- Pattern: Mirrors TypeScript exactly for character-identical output in both environments

**Circuit Breaker (RLM Health):**
- Purpose: Fast-fail when RLM is down; don't wait 60s timeout on every request
- Examples: `lib/rlm/health.ts`
- States: CLOSED (normal) → OPEN (2 failures) → HALF_OPEN (after 30s) → CLOSED (success)
- Pattern: Tracks lastFailureTime, consecutiveFailures in-memory; shouldAttemptRLM() gates all RLM calls

**Parallel Fact Extraction:**
- Purpose: Extract durable facts from chunks without cascading API calls
- Examples: `rlm-service/processors/fact_extractor.py` (extract_facts_parallel)
- Pattern: Semaphore concurrency control (10 at a time), each chunk → Haiku 4.5 API call

## Entry Points

**Frontend Upload (User Initiates):**
- Location: `app/import/page.tsx`
- Triggers: File drag-drop or click
- Responsibilities: Display instructions, validate ZIP, call TUS upload, poll progress

**RLM Import Trigger (Next.js API):**
- Location: `app/api/import/trigger/route.ts`
- Triggers: POST from frontend after storage completes
- Responsibilities: Auth gate, rate limit, duplicate guard, RLM HTTP call, return 202

**RLM Import Processing (Background Task):**
- Location: `rlm-service/main.py @app.post("/import-full")`
- Triggers: HTTP POST from Next.js, processed via asyncio.create_task()
- Responsibilities: Dispatch streaming_import.process_import_streaming() immediately, return 202

**RLM Query (Chat Endpoint):**
- Location: `rlm-service/main.py @app.post("/query")`
- Triggers: HTTP POST from Next.js chat API
- Responsibilities: Fetch chunks, build context, call RLM or fallback, return response + metadata

**Health Checks:**
- RLM health: `rlm-service/main.py @app.get("/health")` (called by circuit breaker)
- Supabase health: `app/api/health/supabase/route.ts`

## Error Handling

**Strategy:** Best-effort with graceful degradation

**Patterns:**

1. **Import Failures:** Never block pipeline
   - Catch exceptions at each processor level
   - Return empty/default values instead of raising
   - Example: `fact_extractor.extract_facts_from_chunk()` returns `{preferences: [], ...}` on error
   - User sees error in UI but import doesn't cascade-fail

2. **RLM Unavailable:** Fall back to direct API
   - Try `query_with_rlm()` first (RLM library)
   - On exception, catch and log, then try `query_fallback()` (direct Anthropic)
   - Circuit breaker prevents repeated failed attempts

3. **Rate Limiting:** Redis via Upstash
   - Fail-open: if Redis down, allow request (safety over precision)
   - Three tiers: standard (60/min), expensive (20/min), upload (100/min)
   - Checked at each API endpoint

4. **Progress Update Failures:** Best-effort, never block
   - update_progress() in streaming_import catches all exceptions
   - Logs warning but continues processing
   - Frontend has fallback polling mechanism

5. **Duplicate Imports:** Duplicate guard before triggering
   - Check if import_status = 'processing'
   - If elapsed < 15 minutes, reject with 409
   - If elapsed > 15 minutes, allow retry (assume stuck)

## Cross-Cutting Concerns

**Logging:**
- Next.js: Pino logger (lib/logger/index.ts), structured with correlationId
- RLM: print() with [scope] prefix (e.g., "[streaming_import] Message")
- Level: INFO for major steps, DEBUG for details, ERROR for failures

**Validation:**
- Next.js: Zod schemas in `lib/api/schemas.ts` (validateRequest, parseRequestBody)
- RLM: Pydantic BaseModel for request bodies (QueryRequest, ProcessFullRequest)
- ZIP validation: Check magic bytes (PK), then extract conversations.json

**Authentication:**
- Next.js: Supabase auth.getUser() in every route
- RLM: Trusts user_id from caller (no auth on RLM itself - internal only)
- Database: RLS policies enforce row-level isolation

**Rate Limiting:**
- Next.js: checkRateLimit(user_id, tier) → blocks or allows
- Tiers: standard (chat), expensive (imports), upload (file uploads)
- Redis key: `ratelimit:${tier}:${user_id}`

**Monitoring:**
- Alerts: Optional webhook for RLM failures (ALERT_WEBHOOK env var)
- Circuit breaker status available via getCircuitStatus()
- Admin endpoints: `/api/admin/health`, `/api/admin/rlm-status`

---

*Architecture analysis: 2026-02-11*
