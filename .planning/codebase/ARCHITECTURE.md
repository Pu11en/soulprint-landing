# Architecture

**Analysis Date:** 2026-02-11

## Pattern Overview

**Overall:** Next.js full-stack application with multi-tier backend services (Node.js API routes + Python RLM microservice)

**Key Characteristics:**
- **Client**: React 19 (Next.js 16) SSR app with Supabase auth
- **Server**: Next.js API routes (42 route.ts files) with service role for admin operations
- **Microservice**: Python FastAPI RLM (Recursive Language Model) for import processing and chat augmentation
- **Database**: Supabase PostgreSQL with pgvector extensions for semantic search
- **Queuing**: Fire-and-forget HTTP calls from Next.js → RLM service; polling from client
- **Auth**: Supabase SSR with cookie-based session management (30-day TTL)

## Layers

**Presentation (Browser/Client):**
- Purpose: React components for chat, import flow, dashboard
- Location: `app/` (pages), `components/` (UI)
- Contains: Page layouts (e.g., `app/chat/page.tsx`, `app/import/page.tsx`), reusable UI components, hooks
- Depends on: Supabase client, API routes (via fetch)
- Used by: Direct user interaction

**API Gateway (Next.js Routes):**
- Purpose: Thin HTTP layer for auth, rate limiting, request validation
- Location: `app/api/`
- Contains: 42 route.ts files organized by feature (chat, import, memory, profile, admin)
- Depends on: Supabase admin client, rate limiter, error handler, downstream services
- Used by: Browser client, RLM service (webhooks for import completion)

**Business Logic (Service Layer):**
- Purpose: Core domain logic (memory retrieval, fact extraction, search classification)
- Location: `lib/memory/`, `lib/search/`, `lib/evaluation/`, `lib/import/`
- Contains: Query functions, embedding logic, fact learning, search strategy
- Depends on: Supabase RPC calls, AWS Bedrock, external APIs (Perplexity, Tavily)
- Used by: API routes, RLM service

**Data Access (Supabase):**
- Purpose: Database abstraction with three client types
- Location: `lib/supabase/` (client.ts, server.ts, middleware.ts)
- Contains: Supabase client factories, cookie persistence, session refresh
- Depends on: @supabase/ssr, @supabase/supabase-js
- Used by: API routes, service layer

**RLM Microservice (Python):**
- Purpose: Async import processing and semantic memory augmentation
- Location: `rlm-service/` (separate repo deployed with main)
- Contains: FastAPI app, processors (DAG parser, chunker, embedder, quick_pass, full_pass)
- Depends on: Anthropic API, AWS Bedrock, Supabase REST API
- Used by: Next.js API routes (fire-and-forget HTTP POST)

## Data Flow

**Import Flow:**

1. User uploads ZIP file via `app/import/page.tsx`
2. File chunks uploaded to Supabase Storage via TUS protocol
3. Frontend calls `POST /api/import/trigger` with storagePath
4. API route:
   - Checks auth + rate limits
   - Sets `user_profiles.import_status = 'processing'`
   - Fires `POST http://rlm-service/import-full` (no wait)
   - Returns 202 immediately
5. RLM service (background):
   - Downloads ZIP from Supabase Storage
   - Parses conversations.json (DAG structure)
   - Creates 5-tier chunks (200→5000 chars) per `processors/conversation_chunker.py`
   - Embeds chunks with Titan Embed v2 (768-dim) via AWS Bedrock
   - Inserts chunks to `conversation_chunks` table with pgvector embedding
   - Sets `user_profiles.import_status = 'quick_ready'` or 'complete'
6. Frontend polls `GET /api/memory/status` every 3s
   - Displays progress from `user_profiles.progress_percent`
   - Redirects to `/chat` on completion

**Chat Flow:**

1. User types message in `app/chat/page.tsx`
2. Frontend calls `POST /api/chat/messages` (saves user message)
3. Frontend calls `POST /api/memory/query` with message text
   - Embeds query with Titan Embed v2 (matches RLM embeddings)
   - Retrieves chunks via Supabase RPC `match_conversation_chunks_layered` with thresholds:
     - Layer 5 (macro): 0.25 threshold, 2 chunks
     - Layer 3 (thematic): 0.35 threshold, 3 chunks
     - Layer 1 (micro): 0.45 threshold, 4 chunks
   - Fallback: keyword search if < 3 chunks found
   - Also retrieves learned facts via `match_learned_facts`
4. Conditional search augmentation via `lib/search/smart-search.ts`:
   - Classifier decides if query needs real-time info (news, prices, current events)
   - If needed: calls Perplexity API (primary) or Tavily (backup)
   - If not needed: skips search
5. Memory context formatted and sent to RLM via `POST http://rlm-service/query`:
   - Includes: soulprint_text, conversation_history, memory_chunks, optional web_search_context
   - RLM returns: personalized response
6. Response streamed back to frontend, citations included
7. After response: optional fact extraction via `lib/memory/learning.ts`
   - Calls Claude to extract durable facts from conversation
   - Embeds facts, stores in `learned_facts` table

**State Management:**

- **Import Status**: Stored in `user_profiles.import_status` (single source of truth)
- **Chat History**: `chat_messages` table (not conversations, just messages)
- **Memory**: Two tables:
  - `conversation_chunks` (pre-processed from import)
  - `learned_facts` (extracted from chat exchanges)
- **Client-side**: React state for UI (messages, conversations, loading states)
- **Real-time**: No websockets; polling for import status, fetch for chat messages

## Key Abstractions

**MemoryChunk:**
- Purpose: Retrieved conversation context for chat augmentation
- Examples: `lib/memory/query.ts` returns array of MemoryChunk
- Pattern: Interface with id, title, content, similarity score, layer_index

**LearnedFact:**
- Purpose: Durable user facts extracted from conversations
- Examples: preferences, relationships, milestones, beliefs
- Pattern: Stored with embedding, category, confidence score

**APIRequest Validation:**
- Purpose: Centralized schema validation via Zod
- Examples: `saveMessageSchema`, `memoryQuerySchema` in `lib/api/schemas.ts`
- Pattern: Zod schema → parseRequestBody() → returns data or Response

**RateLimit Tiers:**
- Purpose: Tiered request limiting via Upstash Redis
- Levels: standard (60/min), expensive (20/min), upload (100/min)
- Pattern: Fail-open if Redis down, async check returns Response on limit

**Error Handling:**
- Purpose: Standardized error response with correlation ID tracing
- Examples: `handleAPIError()` in `lib/api/error-handler.ts`
- Pattern: Catch unknown error → structured response with timestamp + correlationId

## Entry Points

**Web:**
- Location: `app/layout.tsx` (root layout with theme provider)
- Triggers: All page requests
- Responsibilities: Font loading, metadata, CSS globals, layout wrapper

**Homepage:**
- Location: `app/page.tsx`
- Triggers: GET /
- Responsibilities: Auth check (redirect to /dashboard if logged in), marketing content

**Chat:**
- Location: `app/chat/page.tsx`
- Triggers: GET /chat
- Responsibilities: Auth required, memory status check, message history load

**Import:**
- Location: `app/import/page.tsx`
- Triggers: GET /import
- Responsibilities: Auth required, file upload UI, progress polling

**API Routes (42 total):**
- Chat: `POST /api/chat/messages` (save), `POST /api/chat` (stream response)
- Memory: `POST /api/memory/query` (search), `POST /api/memory/synthesize` (learn facts)
- Import: `POST /api/import/trigger` (start), `POST /api/import/complete` (webhook from RLM)
- Admin: `GET /api/admin/health`, `POST /api/admin/metrics`, etc.

**Middleware:**
- Location: `middleware.ts`
- Triggers: All requests
- Responsibilities: CSRF validation, auth session refresh, correlation ID injection

## Error Handling

**Strategy:** Fail-safe with structured logging and client-facing error messages

**Patterns:**
- **Auth Errors**: Return 401 Unauthorized, redirect unauthenticated users to /login
- **Validation Errors**: Return 400 Bad Request with Zod error details
- **Rate Limit Errors**: Return 429 Too Many Requests with Retry-After header
- **Server Errors**: Return 500 Internal Server Error, log with correlationId for tracing
- **Timeout Errors**: Return 504 Gateway Timeout if memory search or RLM exceeds deadline
- **Graceful Fallback**: If RLM unavailable, chat still works (no memory context)
- **Import Failures**: Stored in `user_profiles.import_error`, displayed in UI

## Cross-Cutting Concerns

**Logging:** Structured logging via Pino (`lib/logger/`)
- All API routes create logger with context (userId, correlationId, endpoint)
- Memory operations log duration, chunks found, method (semantic vs fallback)
- RLM service logs processor steps, token usage, costs

**Validation:** Zod schemas in `lib/api/schemas.ts`
- All POST requests validated before processing
- Schemas: saveMessageSchema, memoryQuerySchema, conversationTitleSchema, etc.
- Validation failure returns 400 with error details

**Authentication:** Supabase SSR cookie-based
- `lib/supabase/server.ts`: Creates authenticated client from request cookies
- `lib/supabase/client.ts`: Browser client with automatic token refresh
- Middleware refreshes tokens on each request
- 30-day session TTL with Safari compatibility (sameSite: lax)

**Rate Limiting:** Upstash Redis with 3 tiers
- `lib/rate-limit.ts`: Tiered limits (standard/expensive/upload)
- Fail-open: If Redis down, allow request through
- Checked at start of POST endpoints, returns 429 if exceeded

**CSRF Protection:** @edge-csrf/nextjs (Double Submit Cookie)
- Applied in middleware to all POST/PUT/DELETE except server actions
- Skipped for Next.js server actions (already CSRF-safe)
- Skipped for internal X-Internal-User-Id calls
- Token injection handled by middleware

**Correlation Tracing:** UUID per request
- Generated in middleware, injected as X-Correlation-Id header
- Threaded through all logs for request lifecycle tracing
- Passed to client for debugging (included in error responses)

---

*Architecture analysis: 2026-02-11*
