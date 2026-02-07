# RLM Service Architecture

**Analysis Date:** 2026-02-06

## Overview

The RLM (Recursive Language Model) service exists in two versions:

1. **Production** (`/home/drewpullen/clawd/soulprint-rlm/main.py`) - 3600+ lines, monolithic, deployed on Render
2. **v1.2 Local** (`/home/drewpullen/clawd/soulprint-landing/rlm-service/`) - Modular refactor with `processors/` directory

Both are FastAPI services that process ChatGPT conversation exports and generate SoulPrint personality profiles with memory-enhanced chat.

---

## API Endpoints

### Production Version (`/home/drewpullen/clawd/soulprint-rlm/main.py`)

**Chat & Query:**
- `POST /chat` - Chat with memory retrieval and SoulPrint personality
  - Input: user message, user_id, chat history
  - Process: Embeds message → Searches memories (Bedrock Titan + vector search) → Loads SoulPrint files (soul_md, identity_md, agents_md, user_md) → Calls Amazon Nova Lite
  - Output: Response text, memory count, latency
  - Used: Primary chat endpoint with full personalization

- `POST /query` - Smart routing query with memory context
  - Input: message, user_id, soulprint_text, history
  - Process: Detects intent (memory/realtime/normal) → Searches memories if relevant → Generates response via Bedrock
  - Output: QueryResponse (response, chunks_used, method, latency_ms)
  - Intent routing: `memory` (deep history dive), `memory_accept` (offer acceptance), `realtime` (current data), `normal` (general + optional memory offer)

- `POST /analyze` - Deep personality analysis from raw conversations
  - Input: user_id
  - Process: Fetches 500 recent conversations → Samples rich conversations (recent + longest + oldest) → Calls Nova Pro for analysis
  - Output: JSON profile with archetype, tone, humor, interests, communication_style, key_traits, avoid
  - Used: For initial profile generation before SoulPrint files

**SoulPrint Generation:**
- `POST /create-soulprint` - Exhaustive personality generation
  - Input: conversations array, user_id, stats (optional)
  - Process: Recursive synthesis on user messages → Generates 4 SoulPrint files (soul_md, identity_md, agents_md, user_md) → Generates memory log → Saves to Supabase
  - Output: soulprint (JSON), archetype, 4 markdown files, memory_log, conversation count
  - Used: Quick pass with 30-50 conversations for initial profile

- `POST /process-full` - Complete background pipeline with job tracking
  - Input: user_id, storage_path (Supabase Storage) OR conversations array, message_count
  - Process:
    1. Downloads parsed JSON from storage (if storage_path provided)
    2. Multi-tier chunking (micro 200 chars, medium 2000 chars, macro 5000 chars)
    3. Embeds chunks via Bedrock Titan
    4. Generates SoulPrint from embedded chunks
    5. Updates user_profiles and triggers Vercel callback
  - Output: 202 Accepted (async)
  - Job tracking: Creates `processing_jobs` record for recovery on restart
  - Used: Full pipeline after user imports ChatGPT export

- `POST /process-import` - Background SoulPrint from raw JSON
  - Input: user_id, user_email, conversations_json (raw ChatGPT format)
  - Process: Validates JSON → Dispatches to background task → Parses ChatGPT format → Runs synthesis pipeline
  - Output: 200 status (async processing)
  - Used: Legacy endpoint, processes direct JSON payloads

**Embedding & Memory:**
- `POST /embed-chunks` - Embed existing chunks for a user
  - Input: user_id
  - Process: Gets all chunks for user → Embeds via Bedrock Titan → Generates SoulPrint → Updates DB
  - Output: 200 status (async)
  - Used: When chunks exist but embeddings failed

**Health & Status:**
- `GET /health` - Basic health check
  - Returns: status, service name, RLM availability, Bedrock availability, timestamp

- `GET /health-deep` - Deep health verification
  - Checks: DB connection, `match_conversation_chunks` RPC, `match_conversation_chunks_by_tier` RPC, Bedrock embeddings, Nova Lite chat
  - Returns: Detailed check results for each component

- `GET /status` - Detailed configuration status
  - Returns: Which services are configured (RLM, Supabase, Anthropic, Bedrock, Cohere, Vercel callback)

- `GET /embedding-status/{user_id}` - Embedding progress by tier
  - Returns: Chunk counts by tier (micro/medium/macro) with/without embeddings, completion percentage

- `GET /generate-soulprint/{user_id}` - Retry SoulPrint generation from chunks
  - Used: When embedding completed but SoulPrint generation failed
  - Triggers: Vercel callback on completion

**Deprecated/Legacy:**
- `GET /test-embed` - Test embedding functionality
- `GET /test-patch` - Test database patching
- `@app.on_event("startup")` - Server startup event

---

### v1.2 Local Version (`/home/drewpullen/clawd/soulprint-landing/rlm-service/main.py`)

**Chat & Queries:**
- `POST /query` - Main query with RLM + fallback
  - Input: user_id, message, soulprint_text (optional), history (optional)
  - Process: Fetches conversation chunks → Builds context → Tries RLM first → Fallback to direct Anthropic if RLM fails
  - Output: QueryResponse (response, chunks_used, method: "rlm" or "fallback", latency_ms)
  - RLM mode: Uses RLM library for recursive memory exploration
  - Fallback: Claude Sonnet 4 direct API call

**Processing:**
- `POST /process-full` - Dispatch full pass to background task
  - Input: user_id, storage_path, conversation_count, message_count (optional)
  - Process: Updates user_profile to "processing" → Dispatches `run_full_pass` background task
  - Output: 202 Accepted (status: "accepted")
  - Background task: Calls `processors.full_pass.run_full_pass_pipeline()`

**Health:**
- `GET /health` - Basic health check
  - Returns: status, service name

---

## Data Flow: `/process-full` Pipeline Comparison

### Production Version Flow

```
1. POST /process-full (user_id, storage_path, conversation_count)
   ↓
2. Create job record in processing_jobs (for recovery on restart)
   ↓
3. Dispatch to background task: process_full_background()
   ↓
4. Download conversations from Supabase Storage (storage_path)
   OR use direct conversations array (legacy)
   ↓
5. Parse ChatGPT format (mapping structure with message tree)
   ↓
6. Create multi-tier chunks:
   - Tier 1 (micro): 200 chars - precise facts, names, dates
   - Tier 2 (medium): 2000 chars - conversation context
   - Tier 3 (macro): 5000 chars - themes, relationships
   ↓
7. Embed each chunk via Bedrock Titan v2
   (REST: POST /rest/v1/vector-embeddings)
   ↓
8. Save chunks to conversation_chunks table with embedding vectors
   ↓
9. Generate SoulPrint from chunks:
   - Sample richest conversations by scoring algorithm
   - Call recursive_synthesize() for personality analysis
   - Generate 4 SoulPrint files (soul_md, identity_md, agents_md, user_md)
   ↓
10. Save to user_profiles:
    - soulprint (JSON), archetype, soul_md, identity_md, agents_md, user_md
    - import_status = "complete", embedding_status = "complete"
    ↓
11. Call Vercel callback: POST https://soulprintengine.ai/api/import/complete
    (Triggers email notification to user)
    ↓
12. Update job record: status = "complete"
```

**Models Used:**
- Claude Sonnet 4-20250514 (recursive synthesis)
- Amazon Nova Lite/Pro (high rate limit models, ~1000 req/min)
- Amazon Titan Embed Text v2 (embeddings)

**Error Handling:**
- Job recovery system: Finds stuck jobs on startup and resumes them
- Best-effort updates to Supabase (logs warn on failure, doesn't throw)
- Alert webhook on critical failures

---

### v1.2 Local Version Flow

```
1. POST /process-full (user_id, storage_path, conversation_count, message_count)
   ↓
2. Update user_profile: import_status = "processing"
   ↓
3. Dispatch to background task: run_full_pass()
   ↓
4. Download conversations from Supabase Storage
   ↓
5. Chunk conversations via processors.conversation_chunker:
   - estimate_tokens(): len(text) // 4
   - format_conversation(): Parse mapping structure OR simplified messages format
   - chunk_conversations(): Split at sentence boundaries with 200 token overlap
   - Target: ~2000 tokens per chunk
   ↓
6. Delete existing chunks for user (fresh start)
   ↓
7. Save chunks to database (batch inserts, 100 at a time)
   ↓
8. Extract facts in parallel via processors.fact_extractor:
   - extract_facts_from_chunk(): Calls Claude Haiku 4.5
   - extract_facts_parallel(): Concurrency=10 semaphore
   - Returns: preferences[], projects[], dates[], beliefs[], decisions[]
   ↓
9. Consolidate facts with deduplication:
   - consolidate_facts(): Merge all fact lists
   - Simple dedup by name/event/decision text
   ↓
10. Hierarchical reduce if over 200K tokens:
    - Split facts into 50K token batches
    - Call Haiku 4.5 to consolidate each batch
    - Recurse if still over limit
    ↓
11. Generate MEMORY section:
    - generate_memory_section(): Haiku 4.5 creates structured markdown
    - Sections: Preferences, Projects, Important Dates, Beliefs & Values, Decisions & Context
    - Output: Human-readable markdown (NOT JSON)
    ↓
12. Save MEMORY to user_profiles.memory_md (early save)
    ↓
13. V2 Section Regeneration (processors.v2_regenerator):
    - sample_conversations_for_v2(): Top 200 conversations by richness score
    - Call Haiku 4.5 with conversations + MEMORY context
    - Regenerate all 5 sections: soul, identity, user, agents, tools
    - schemas_to_soulprint_text(): Convert to single markdown soulprint_text
    ↓
14. Save all v2 sections + soulprint_text atomically:
    - soul_md, identity_md, user_md, agents_md, tools_md
    - soulprint_text (combined markdown)
    ↓
15. Update user_profile: import_status = "complete"
```

**Models Used:**
- Claude Haiku 4.5 (all fact extraction, consolidation, memory generation, v2 regeneration)
- No embeddings or vector search (pure fact-based approach)

**Error Handling:**
- Best-effort: Functions log errors but return empty structures instead of throwing
- No early exit: If one step fails, pipeline continues with fallback values

---

## Processors Module (`/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/`)

### Structure

```
processors/
├── __init__.py
├── full_pass.py           # Orchestrator for complete pipeline
├── conversation_chunker.py # Parse & chunk conversations
├── fact_extractor.py       # Extract facts in parallel
├── memory_generator.py     # Generate MEMORY section
└── v2_regenerator.py       # Regenerate v2 sections with MEMORY context
```

### `full_pass.py` - Pipeline Orchestrator

**Key Functions:**
- `run_full_pass_pipeline(user_id, storage_path, conversation_count) -> str`
  - Main orchestrator, calls all other processors in sequence
  - Returns: Generated memory_md string
  - Steps: Download → Chunk → Save chunks → Extract facts → Consolidate → Reduce → Generate MEMORY → V2 Regen → Save all

- `delete_user_chunks(user_id)` - Best-effort chunk deletion on fresh start
- `save_chunks_batch(user_id, chunks)` - Batch insert to conversation_chunks (100 at a time)

**Database Operations:**
- Supabase REST API via httpx.AsyncClient
- Batch inserts with `is_recent` flag (180-day threshold)
- Updates `user_profiles.memory_md`, `user_profiles.soul_md`, `user_profiles.identity_md`, etc.

---

### `conversation_chunker.py` - Parsing & Chunking

**Key Functions:**
- `estimate_tokens(text) -> int`
  - Simple approximation: `len(text) // 4`

- `format_conversation(conversation) -> str`
  - Handles two formats:
    1. ChatGPT export: `mapping` dict with message tree
    2. Simplified: `messages` array
  - Traverses mapping tree in order, truncates long messages (5000 chars)
  - Skips system messages
  - Output: Formatted text with "# Title" header + "User: ..." "Assistant: ..." exchanges

- `chunk_conversations(conversations, target_tokens=2000, overlap_tokens=200) -> List[Dict]`
  - Processes all conversations
  - Skips conversations under target_tokens (keeps as single chunk)
  - Splits large conversations at sentence boundaries (`. `, `? `, `! `, `\n`)
  - Overlaps: Takes last `overlap_tokens * 4` chars from previous chunk as context for next
  - Output: List of chunk dicts with:
    - conversation_id, title, content, token_count, chunk_index, total_chunks
    - chunk_tier ("medium"), created_at

**Chunking Strategy:**
- Sentence-level splitting preserves context
- 200-token overlap prevents context loss at boundaries
- Metadata preserved: conversation_id, title, timestamps

---

### `fact_extractor.py` - Parallel Fact Extraction

**Extraction Process:**
- Claude Haiku 4.5 called with fact extraction prompt
- Temperature: 0.3 (low for factual accuracy)
- Max tokens: 2048 per chunk
- Returns JSON with structure:
  ```json
  {
    "preferences": ["fact1", "fact2"],
    "projects": [{"name": "X", "description": "Y", "details": "Z"}],
    "dates": [{"event": "X", "date": "Y"}],
    "beliefs": ["belief1", "belief2"],
    "decisions": [{"decision": "X", "context": "Y"}]
  }
  ```

**Key Functions:**
- `extract_facts_from_chunk(chunk_content, anthropic_client) -> dict`
  - Single chunk extraction, returns empty structure on error (never fails pipeline)

- `extract_facts_parallel(chunks, anthropic_client, concurrency=10) -> List[dict]`
  - asyncio.Semaphore(10) limits concurrent API calls
  - asyncio.gather() with return_exceptions=True
  - Never throws: exceptions converted to empty fact structures

- `consolidate_facts(all_facts) -> dict`
  - Merges all fact lists with deduplication:
    - Preferences: Simple string dedup
    - Projects: Dedup by name (case-insensitive)
    - Dates: Dedup by event name
    - Beliefs: Simple string dedup
    - Decisions: Dedup by decision text
  - Adds `total_count` field

- `hierarchical_reduce(consolidated_facts, anthropic_client, max_tokens=150000) -> dict`
  - Estimates tokens: `len(json.dumps()) // 4`
  - If over max_tokens:
    - Splits each category into ~50K token batches
    - Calls Haiku to consolidate each batch in parallel
    - Recursively reduces if still over limit
  - Never fails: Returns original if Haiku call fails

---

### `memory_generator.py` - MEMORY Section Generation

**Process:**
- Input: consolidated_facts dict with all extracted facts
- Claude Haiku 4.5 with temperature 0.5 (moderate for natural writing)
- Max tokens: 4096 per call

**Output Format:** Markdown with sections:
```markdown
# MEMORY

## Preferences
- Communication preferences
- Tool preferences
- etc.

## Projects
- Project name with description
- Tech stacks, timelines

## Important Dates
- Birthdays, milestones, deadlines

## Beliefs & Values
- Core principles
- What they care about

## Decisions & Context
- Key decisions with context
- Tradeoffs considered
```

**Key Functions:**
- `generate_memory_section(consolidated_facts, anthropic_client) -> str`
  - Returns markdown string (1000-5000 tokens target, 4-20KB)
  - Falls back to minimal template on error

- `_fallback_memory(consolidated_facts) -> str`
  - Returns minimal MEMORY section when generation fails
  - Shows fact counts but no detailed content

---

### `v2_regenerator.py` - V2 Section Regeneration

**Purpose:** Regenerate all 5 sections with more data + MEMORY context

**Key Functions:**
- `sample_conversations_for_v2(conversations, target_count=200) -> List[dict]`
  - Scoring algorithm: `messages*10 + user_msg_length_sum + min(user_count,asst_count)*20 + recency_bonus`
  - Returns top 200 conversations by richness (vs 30-50 in quick pass)

- `format_conversations_for_prompt(conversations, max_chars=600000) -> str`
  - Formats as readable text blocks with headers
  - Max 600K chars (~150K tokens after prompt overhead)
  - Truncates messages to 2000 chars each
  - Output:
    ```
    === Conversation: "Title" (YYYY-MM-DD) ===
    User: message content
    Assistant: response content
    ```

- `regenerate_sections_v2(conversations, memory_md, anthropic_client) -> Optional[Dict[str, dict]]`
  - Samples top 200 conversations
  - Formats conversation text
  - Calls Haiku 4.5 with system prompt (V2_SYSTEM_PROMPT) + conversations + MEMORY
  - Parses JSON response into 5 sections
  - Retry with validation nudge if JSON parse fails
  - Returns dict with: soul, identity, user, agents, tools
  - Returns None if failed

- `sections_to_soulprint_text(sections, memory_md) -> str`
  - Converts sections dict to single markdown document
  - Format: "## Section Name" headers with key-value pairs
  - Final section: "## Memory\n{memory_md}"
  - Output: Full soulprint_text saved to user_profiles

**V2 Section Schema:**
All 5 sections follow same structure as quick pass but with richer data + MEMORY context:

- **soul**: communication_style, personality_traits[], tone_preferences, boundaries, humor_style, formality_level, emotional_patterns
- **identity**: ai_name (creative), archetype, vibe, emoji_style, signature_greeting
- **user**: name, location, occupation, relationships[], interests[], life_context, preferred_address
- **agents**: response_style, behavioral_rules[], context_adaptation, memory_directives, do_not[]
- **tools**: likely_usage[], capabilities_emphasis[], output_preferences, depth_preference

---

## Helper Functions & Responsibilities

### Production Version Helpers

**Authentication & Updates:**
- `create_job(user_id, storage_path, conversation_count, message_count) -> str`
  - Creates processing_jobs record for recovery
  - Returns job_id

- `update_job(job_id, **kwargs)`
  - Updates job status/progress/step
  - Timeout: 30s

- `complete_job(job_id, success, error_message)`
  - Marks job complete or failed
  - Sets progress to 100 on success

- `get_stuck_jobs() -> list`
  - Finds jobs in "pending" or "processing" status with < 3 attempts
  - Used on startup for recovery

- `resume_stuck_jobs()`
  - Called on startup via @app.on_event("startup")
  - Resumes each stuck job with incremented attempt count

**Embeddings:**
- `embed_text_bedrock(text) -> List[float]`
  - Calls Bedrock Titan Embed Text v2 REST API
  - Returns 1024-dimensional embedding vector

- `embed_query(query) -> List[float]`
  - Tries Bedrock first, fallback to Cohere
  - Cohere: POST https://api.cohere.ai/v1/embed with embed-english-v3.0 model

**Vector Search:**
- `vector_search_chunks(user_id, query_embedding, limit=50) -> List[dict]`
  - Calls Supabase RPC: match_conversation_chunks
  - Params: query_embedding, match_user_id, match_count, match_threshold (0.3)
  - Returns top matching chunks by similarity

**Memory Search:**
- `search_memories(user_id, query, limit=30) -> List[dict]`
  - Hybrid search: Vector + keyword matching
  - RRF (Reciprocal Rank Fusion) scoring
  - Returns dicts with: title, content, match_type (hybrid/keyword/semantic), rrf_score, chunk_tier

**SoulPrint Loading:**
- `get_soulprint(user_id) -> dict`
  - Fetches soul_md, identity_md, agents_md, user_md, soulprint_text from user_profiles
  - Used in chat to inject personality context

**Context Building:**
- `build_context(chunks, soulprint, history) -> str`
  - Builds conversation context from chunks and history
  - Respects max length constraints

**Intent Detection:**
- `detect_query_intent(message, history) -> tuple[str, str]`
  - Returns: (intent, topic_override)
  - Intent: "memory", "memory_accept", "realtime", "normal"
  - Analyzes message + history to determine routing

**Supabase Updates:**
- `update_user_profile(user_id, updates) -> None`
  - PATCH user_profiles with dict of updates
  - Best-effort: Logs errors without throwing

**Model Calling:**
- `bedrock_claude_message(messages, system, model, max_tokens) -> str`
  - Calls AWS Bedrock with Nova Lite/Pro models
  - Higher rate limits than Claude direct API

**Synthesis & Analysis:**
- `recursive_synthesize(messages, user_id) -> dict`
  - Calls Claude for recursive personality analysis
  - Returns profile dict with archetype, core_essence, etc.

- `generate_soulprint_files(profile, messages, user_id) -> dict`
  - Generates 4 markdown files from profile
  - Returns dict with soul_md, identity_md, agents_md, user_md

- `generate_memory_log(messages, profile, user_id) -> str`
  - Generates today's memory log for user
  - Used for daily context refresh

**Callbacks & Alerts:**
- `alert_drew(message)`
  - Telegram notification on critical failures
  - Uses ALERT_TELEGRAM_BOT + ALERT_TELEGRAM_CHAT

- Vercel callback: POST {VERCEL_API_URL}/api/import/complete
  - Triggers email notification to user
  - Called after successful import completion

---

## Background Task Handling

### Production Version

**Startup Recovery:**
```python
@app.on_event("startup")
async def startup_event():
    # Small delay to let server initialize
    await asyncio.sleep(2)
    # Resume any stuck jobs from previous crashes
    await resume_stuck_jobs()
```

**Background Tasks:**
- `process_full_background(user_id, storage_path, conversations, job_id)`
  - Runs complete pipeline asynchronously
  - Updates job status at each step: downloading → chunking → embedding → generating
  - Saves progress to processing_jobs table for recovery
  - Calls Vercel callback on completion

- `process_import_background(user_id, user_email, conversations_json)`
  - Legacy: Parses ChatGPT JSON and runs synthesis pipeline

- `embed_chunks_background(user_id)`
  - Embeds existing chunks for a user
  - Called when chunks exist but embeddings failed

**Task Dispatch:**
```python
background_tasks.add_task(process_full_background, user_id, storage_path, conversations, job_id)
```

---

### v1.2 Local Version

**Background Tasks:**
- `run_full_pass(request: ProcessFullRequest)` in main.py
  - Called from `/process-full` endpoint
  - Dispatches: `run_full_pass_pipeline()` from processors.full_pass

**Task Dispatch:**
```python
background_tasks.add_task(run_full_pass, request)
```

**Error Handling:**
- Wrapped in try/except
- Updates user_profile on failure with full_pass_error field
- Sends alert on critical failures

---

## Integration Points

### Supabase Database

**Tables Used:**
- `user_profiles` - User soulprint data, import status, SoulPrint files
  - Fields: user_id, soulprint_text, import_status, embedding_status, soul_md, identity_md, agents_md, user_md, memory_md, full_pass_status, updated_at

- `conversation_chunks` - Searchable memory chunks with embeddings
  - Fields: user_id, conversation_id, title, content, token_count, chunk_tier, embedding (vector), chunk_index, total_chunks, created_at, is_recent, message_count

- `processing_jobs` (production only) - Job tracking for recovery
  - Fields: id, user_id, status, storage_path, conversation_count, message_count, current_step, progress, error_message, attempts, completed_at

**RPC Functions:**
- `match_conversation_chunks(query_embedding, match_user_id, match_count, match_threshold)`
  - Vector similarity search for memory retrieval
  - Returns chunks with cosine similarity > threshold

- `match_conversation_chunks_by_tier(query_embedding, match_user_id, match_tier, match_count, match_threshold)`
  - Tier-specific vector search (micro/medium/macro)

**REST Endpoints:**
- GET `/rest/v1/user_profiles` - Fetch profiles
- PATCH `/rest/v1/user_profiles` - Update profile fields
- POST/DELETE `/rest/v1/conversation_chunks` - Manage chunks
- POST `/rest/v1/processing_jobs` - Track jobs

---

### Anthropic API

**Models Used:**
- claude-sonnet-4-20250514 (production: synthesis, legacy queries)
- claude-haiku-4-5-20251001 (v1.2: all fact extraction, memory generation, v2 regeneration)

**Endpoints:**
- `messages.create()` via anthropic.Anthropic() or anthropic.AsyncAnthropic()
- Parameters: model, messages, system (optional), max_tokens, temperature

---

### AWS Bedrock (Production Only)

**Embedding Model:**
- `amazon.titan-embed-text-v2:0` - 1024-dimensional embeddings
- Called via boto3 bedrock-runtime client
- Async wrapper via httpx REST calls

**Chat Models:**
- `amazon.nova-micro-v1:0` - Fast batch processing (~1000 req/min)
- `amazon.nova-lite-v1:0` - Chat, light tasks (~1000 req/min)
- `amazon.nova-pro-v1:0` - Synthesis, merging (~1000 req/min)

**Why Nova over Claude:**
- Rate limits: ~1000 req/min vs Claude's ~20 req/min
- Cost: Lower per-token rates for high-volume processing
- For SoulPrint: Speed tradeoff acceptable vs personalization accuracy

---

### External Services

**Vercel Callback:**
- Endpoint: POST {VERCEL_API_URL}/api/import/complete?user_id={user_id}
- Triggers: Email notification, UI updates, import completion flow
- Timeout: 30s, best-effort (logs on failure)

**Telegram Alerts (Production):**
- Service: Telegram Bot API
- Endpoint: ALERT_TELEGRAM_BOT via webhook
- Channel: ALERT_TELEGRAM_CHAT
- Triggered: Critical failures, RLM unavailability, chat errors

**Cohere Embeddings (Fallback):**
- Model: embed-english-v3.0
- Used if Bedrock unavailable
- Input type: search_query

---

## Error Handling Strategy

### Production Version

**Graceful Degradation:**
- RLM required for `/query` endpoint (503 if unavailable)
- Fallback not available: Hard failure alerts
- Job recovery system restarts interrupted jobs automatically

**Error Alerting:**
- Telegram alerts on critical failures
- Sentry integration possible (not currently configured)
- Alert webhook for integration with monitoring

**Best-Effort Operations:**
- Database updates log warnings but don't throw
- Memory searches return empty list on error
- Chunk retrieval falls back to non-vector search

---

### v1.2 Local Version

**No Failure:**
- All helper functions return empty structures instead of throwing
- Pipeline continues even if individual steps fail
- Fallback from RLM to direct Anthropic API

**Logging:**
- [FullPass], [FactExtractor], [MemoryGenerator], [V2Regen] prefixes for tracing
- Exception details logged with traceback

**User-Facing:**
- import_status = "failed" with error message on failure
- import_error field stores error text (500 char limit)
- User can retry import

---

## Performance Characteristics

### Production Version

**Chunking & Embedding:**
- 10k conversations ~40k chunks
- Bedrock Titan embedding: ~100ms per chunk
- Total: ~40k seconds = 11+ hours (parallelized in batches)

**Memory Search:**
- Hybrid search: Vector + keyword matching
- RRF scoring combines both result sets
- Typical: 30-50 results in ~200ms

**Chat Response:**
- Memory search: 200ms
- Nova Lite generation: 500-1000ms
- Total: ~1-2 seconds per response

**Rate Limiting:**
- Nova models: ~1000 req/min (vs Claude 20 req/min)
- Bedrock embeddings: Batch processing recommended
- Job recovery: Prevents duplicate processing on restart

---

### v1.2 Local Version

**Fact Extraction:**
- 10 parallel Haiku calls per batch (semaphore=10)
- ~2000 chunks = 200 batches = 200 sequential rounds
- Typical: 5-10 seconds per chunk extraction
- Total: ~500-1000 seconds for full import

**MEMORY Generation:**
- Single Haiku call after consolidation
- ~5-10 seconds for full section generation

**V2 Regeneration:**
- Top 200 conversations + MEMORY context
- Single Haiku call with ~600K chars input
- ~10-15 seconds

**Total Full Pass:**
- Download: 1-5 seconds
- Chunking: 2-5 seconds
- Fact extraction: 10-30 minutes (parallel, but sequential API calls)
- Memory generation: 5-10 seconds
- V2 regeneration: 10-15 seconds
- **Total: 10-40 minutes** depending on conversation volume

---

## Key Architectural Differences

| Aspect | Production | v1.2 Local |
|--------|-----------|-----------|
| **Model** | Nova (high rate limit) | Haiku (cost-optimized) |
| **Embeddings** | Vector search (Bedrock Titan) | No embeddings (fact-based) |
| **Memory Search** | Semantic + keyword hybrid | None (on-demand extraction) |
| **Fact Extraction** | None | Parallel Haiku calls |
| **SoulPrint Files** | 4 files (soul, identity, agents, user) | 5 files + MEMORY (v2 approach) |
| **Speed** | Seconds (with embeddings) | Minutes (parallel fact extraction) |
| **Recovery** | Job tracking table | None (restart-friendly) |
| **Chat Mode** | Memory-first (always searches) | RLM-first with fallback |
| **Scaling** | Bedrock boto3 client | Asyncio semaphores |

---

*Architecture analysis: 2026-02-06*
