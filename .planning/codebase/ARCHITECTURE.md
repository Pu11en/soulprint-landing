# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Server-driven multi-tier import with memory-augmented LLM chat. The system follows a **Next.js App Router** pattern with client-side React for UI and server-side Node.js for heavy processing (file parsing, embeddings, chat).

**Key Characteristics:**
- Client uploads ChatGPT ZIP/JSON → server downloads and parses → RLM generates personality (soulprint) → conversation chunks stored in Supabase for retrieval
- Chat interface queries memory before generating responses (context-augmented generation via RLM service)
- Import flow gates chat access until processing complete
- Progressive memory availability: chat works on soulprint immediately, full memory enables as embeddings complete
- External RLM service handles embeddings, soulprint generation, and query context retrieval

## Layers

**Presentation Layer:**
- Purpose: React client components for chat, import UI, authentication screens
- Location: `app/page.tsx`, `app/chat/page.tsx`, `app/import/page.tsx`, `components/`
- Contains: Next.js page files, React components (chat UI, import wizard, auth forms), client-side state management
- Depends on: Auth service (Supabase), Chat API, Memory API, Profile API
- Used by: End users via browser

**API Layer (Route Handlers):**
- Purpose: Server-side logic exposed via REST endpoints
- Location: `app/api/` (organized by feature: chat, import, memory, profile, auth)
- Contains: Next.js route.ts files handling POST/GET requests, request validation, Supabase queries
- Key routes:
  - `app/api/chat/route.ts` - Chat message processing with RLM, memory queries, web search integration
  - `app/api/import/queue-processing/route.ts` - Orchestrates import process (5-minute max)
  - `app/api/import/process-server/route.ts` - Parses ZIP/JSON, validates ChatGPT format, calls RLM for soulprint
  - `app/api/memory/status/route.ts` - Reports import progress and memory readiness
  - `app/api/profile/ai-name/route.ts`, `app/api/profile/ai-avatar/route.ts` - AI personalization
- Depends on: Supabase (database/auth/storage), AWS Bedrock (embeddings/LLM), RLM service, external APIs (Tavily, Perplexity)
- Used by: Client components via fetch, internal server-to-server calls

**Service/Library Layer:**
- Purpose: Reusable business logic and external service integrations
- Location: `lib/` (organized by concern: supabase, memory, search, email, gamification)
- Key modules:
  - `lib/supabase/client.ts` - Browser Supabase client with SSR support
  - `lib/supabase/server.ts` - Server-side Supabase client with cookie handling
  - `lib/memory/query.ts` - Embedding queries, memory context retrieval via Bedrock
  - `lib/memory/learning.ts` - Extract and store facts from chat messages
  - `lib/search/smart-search.ts` - Intelligent search dispatcher (web or memory)
  - `lib/search/tavily.ts`, `lib/search/perplexity.ts` - Web search APIs
  - `lib/email/send.ts` - Email notifications via Resend
- Depends on: Supabase, AWS Bedrock, external APIs
- Used by: API routes, server components

**Data Layer:**
- Purpose: Database schema and queries
- Location: Supabase (PostgreSQL) with RLS policies
- Contains:
  - `user_profiles` - User metadata, soulprint text, import status (none/processing/complete/failed)
  - `conversation_chunks` - Searchable memory chunks with embeddings, layer_index (tier 1/2/3)
  - `learned_facts` - Extracted facts for fast categorized recall
  - `chat_messages` - User/assistant message history
- Accessed via: Supabase JS client (app/web) and admin client (server)

**External Services:**
- RLM Service (`https://soulprint-landing.onrender.com`) - Soulprint generation, query context retrieval, response generation
- AWS Bedrock - Claude 3.5 Haiku for naming, embeddings (Cohere v3)
- Supabase - Auth, Storage (ZIP uploads), Database
- Third-party search: Tavily API, Perplexity API

## Data Flow

**Import Flow:**

1. User uploads ZIP on `app/import/page.tsx`
2. Client extracts `conversations.json` (desktop) or uploads full ZIP (mobile)
3. Uploads to Supabase Storage (`imports/` bucket) via client
4. Calls `POST /api/import/queue-processing` with storage path
5. Queue processor updates `user_profiles.import_status = 'processing'`
6. Calls `POST /api/import/process-server` (internal)
7. Process server:
   - Downloads file from Supabase Storage
   - Validates ChatGPT format (checks for `conversations.json`, `mapping` structure)
   - Parses conversations into message arrays
   - Stores raw JSON gzipped in Supabase Storage (user-exports bucket)
   - Calls RLM `/create-soulprint` with conversation array
   - RLM returns soulprint text and multi-tier chunks
   - Inserts chunks into `conversation_chunks` table with layer_index (1/2/3)
   - Updates `user_profiles`: soulprint_text, import_status='complete'
   - Sends email notification (via background cron or sync)
8. Client polls `GET /api/memory/status` to detect completion
9. User redirected to chat

**Chat Flow:**

1. User enters message on `app/chat/page.tsx`
2. Message immediately added to local state (optimistic update)
3. Calls `POST /api/chat` with message + history
4. Chat route:
   - Fetches user's soulprint and profile
   - Calls `smartSearch()` if deep search enabled (web search via Tavily/Perplexity)
   - Calls RLM `/query` with:
     - user_id
     - message
     - soulprint_text
     - chat history
     - web_search_context (if applicable)
   - RLM queries internal memory store, retrieves relevant chunks, generates response
   - Streams response back via SSE (data: chunks)
   - Saves message and response to `chat_messages` table
   - Learns from chat: `learnFromChat()` extracts key facts → stored in `learned_facts`
5. Component displays streaming response in real-time

**Memory Availability Model:**

- **Immediate**: Soulprint generated = chat works (knows user personality)
- **Progressive**: Conversation chunks stored as embeddings complete (memory enriches over time)
- **Full**: All chunks processed = complete conversation context available

## State Management

**Import Status States:**
- `none` - No import started
- `processing` - File parsing/RLM soulprint in progress
- `complete` - Soulprint ready, memory available
- `failed` - Error during import (shows on import page + chat status bar)

**Memory Status States (in `user_profiles`):**
- `embedding_status`: 'processing' | 'complete' (background chunking)
- `total_chunks`, `processed_chunks` - Progress tracking for UI
- `memory_status`: 'building' | 'ready' (user-facing availability)

**Chat State (client-side):**
- Message queue with mutex to prevent overlapping requests
- Message buffer + streaming parser for SSE responses
- Poll interval for memory status (5s) to display progress bar

## Key Abstractions

**RLM Service Contract:**
- `/create-soulprint` (POST): Converts conversations → personality profile + multi-tier chunks
- `/query` (POST): Context retrieval + response generation
- Internal: Manages embeddings, vector similarity search, chunk storage

**Multi-Tier Chunking:**
- **Tier 1** (100 chars): Facts, names, dates ("User: What is X? Assistant: X is...")
- **Tier 2** (500 chars): Topic understanding, context ("Full Q&A about topic")
- **Tier 3** (2000 chars): Complex flows ("Multi-turn conversation")
- Stored with `layer_index` in `conversation_chunks` table

**Smart Search Dispatcher:**
- `lib/search/smart-search.ts` routes to Tavily or Perplexity based on query
- Returns `SmartSearchResult` with context text + sources
- Passed to RLM for web-aware response generation

## Entry Points

**User-Facing:**
- `app/page.tsx` - Landing page, auth redirect logic
- `app/import/page.tsx` - Import wizard (multi-step: export → upload → processing → done)
- `app/chat/page.tsx` - Main chat interface with memory polling
- `app/login/page.tsx`, `app/signup/page.tsx` - Auth flows

**Administrative:**
- `app/admin/page.tsx` - Admin dashboard
- `app/api/admin/*` - Health checks, metrics, user reset, re-chunking

**Background:**
- `app/api/cron/tasks/route.ts` - Scheduled tasks (email notifications, recurring reminders)

## Error Handling

**Strategy:** Graceful degradation with user-friendly error messages.

**Patterns:**
- File validation: Checks for `conversations.json` existence, `mapping` structure in ChatGPT export. Throws with clear message if invalid.
- Size limits: 500MB max (Vercel memory constraint). Returns `"File too large... Maximum is 500MB"` if exceeded.
- API failures: RLM unavailable → falls back to basic Bedrock response generation (no context)
- Network errors: Automatic retry on client with exponential backoff (for chat messages only, not imports)
- Stuck imports: Detects if processing >15 minutes, allows user to retry with `import?reimport=true`
- Auth errors: Missing session → redirect to login
- Supabase RLS violations: Caught and logged, surface generic error to user

## Cross-Cutting Concerns

**Logging:**
- Console logs with [Module] prefix for tracing: `[Chat]`, `[ProcessServer]`, `[QueueProcessing]`
- Used for debugging, not for production monitoring

**Validation:**
- Upfront: File format, ChatGPT structure, auth status
- Runtime: Chunk size, message length, vector dimensions
- Use explicit error messages for user guidance

**Authentication:**
- Supabase Auth (PKCE flow for OAuth) with 30-day cookie persistence
- Server components use `createClient()` from `lib/supabase/server.ts`
- Client components use `createClient()` from `lib/supabase/client.ts`
- Admin operations use service role key (limited to specific endpoints)

**Rate Limiting:**
- RLM timeout: 60s for `/query`, 290s for import processing
- Vercel maxDuration: 300s (5 min) for import routes
- Message queue prevents concurrent chat requests

**Privacy:**
- All file uploads to Supabase Storage (not sent to external LLM)
- Soulprint text stored encrypted at rest (Supabase default)
- RLM service holds only conversation data during processing (not persisted)

---

*Architecture analysis: 2026-02-01*
