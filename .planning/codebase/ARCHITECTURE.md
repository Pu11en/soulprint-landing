# Architecture

**Analysis Date:** 2026-02-01

## Pattern Overview

**Overall:** Next.js 16 Full-Stack Application with Modular Service Architecture

**Key Characteristics:**
- Client-server separation using Next.js App Router with SSR/SSG support
- Multi-layer service architecture: Presentation (React Components) → API Routes (Route Handlers) → Backend Services (Node.js libraries) → External Services
- Real-time data flow orchestrated through API endpoints with streaming support
- Asynchronous background processing for long-running operations (imports, embeddings)
- External service integration: AWS Bedrock (LLM/embeddings), Supabase (database/auth), RLM Service (memory retrieval)

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage client-side state
- Location: `app/` (pages), `components/`
- Contains: React components (TSX), page components, layout definitions
- Depends on: API routes, Supabase client SDK
- Used by: Browser/client applications

**API/Route Handler Layer:**
- Purpose: Handle HTTP requests, orchestrate business logic, manage auth/permissions
- Location: `app/api/*/route.ts`
- Contains: Route handlers using Next.js App Router patterns
- Depends on: Service libraries (`lib/`), Supabase admin client, external APIs
- Used by: Client-side fetch calls, external webhooks

**Service/Business Logic Layer:**
- Purpose: Core business operations: import processing, embeddings, memory queries, LLM interactions
- Location: `lib/`
- Contains: Modules for import pipeline, embeddings, memory, search, email, gamification
- Depends on: SDK clients (Bedrock, Supabase, OpenAI), data parsing utilities
- Used by: API routes, other services

**Data Layer:**
- Purpose: Manage data persistence and retrieval
- Location: Supabase (PostgreSQL) + Storage buckets
- Contains: User profiles, conversations, embeddings, raw imports, profile data
- Technologies: PostgreSQL (database), pgvector (vector search), Supabase Storage (file storage)
- Used by: Service layer through Supabase client

**External Services Integration:**
- Purpose: Outsource specialized functionality
- Services: AWS Bedrock (Claude LLM, Cohere embeddings), Supabase Auth, RLM Service (memory retrieval), Perplexity API (web search), Tavily API (web search), Resend (email), Nodemailer (email)
- Used by: Service layer, API routes

## Data Flow

**User Authentication Flow:**

1. User arrives at `/` (home page)
2. Auth modal or signup/login page prompts credentials
3. Client calls Supabase auth endpoints
4. Session stored in cookies/local storage
5. Route handlers check auth via Supabase server client
6. Authenticated requests include credentials in headers

**Import Flow (ChatGPT Data → Personalized AI):**

1. User navigates to `/import` page
2. User exports ChatGPT data (ZIP file)
3. Client extracts conversations.json (desktop) or uploads full ZIP (mobile)
4. Client uploads to Supabase Storage (`imports/` bucket)
5. Client calls `/api/import/queue-processing` with storage path
6. Queue processing endpoint:
   - Downloads file from storage
   - Extracts and parses conversations
   - Chunks conversations into segments
   - Calls `/api/soulprint/generate` to create personality profile
   - Stores chunks in database
7. Background embedding job triggered:
   - `/api/embeddings/process` embeds all chunks using AWS Bedrock (Cohere Embed v3)
   - Stores embeddings in Supabase with pgvector
8. AI name auto-generated from soulprint on first chat
9. Email notification sent when ready

**Chat Flow (User Question → AI Response):**

1. User sends message in `/chat` page
2. Message queued locally (handle concurrent requests)
3. Client calls `/api/chat` POST endpoint with message + history
4. Server-side (route handler `/api/chat/route.ts`):
   - Verifies user authentication
   - Calls RLM Service if available (memory retrieval + response generation)
   - Fallback to Bedrock Claude if RLM unavailable
   - Optionally calls web search APIs if "deep search" enabled
   - Streams response back to client as SSE (Server-Sent Events)
5. Client displays streamed response token-by-token
6. Message saved to database for history
7. Memory learning triggered: `/api/memory/learning` extracts facts from conversation

**State Management:**

- **Client-side State:** React hooks (useState, useRef) for UI state, message queue management
- **Server-side State:** Route handlers manage request/response lifecycle; no persistent request state
- **Persistent State:** Supabase database (conversations, embeddings, user profiles, memories)
- **Session State:** Supabase auth via cookies (30-day expiration)
- **Cache:** Query results cached in memory during request lifecycle; no cross-request caching

## Key Abstractions

**Soulprint:**
- Purpose: Represents extracted personality profile from user's ChatGPT history
- Examples: `lib/import/soulprint.ts`, `app/api/soulprint/generate/route.ts`
- Pattern: Structured data object containing identity, professional, relationships, interests, beliefs, communication style
- Flow: Generated from conversation sample → stored as text summary → used to generate AI name, inform responses

**Chunk:**
- Purpose: Atomic unit of conversation data for embedding and retrieval
- Examples: `lib/import/chunker.ts`
- Pattern: Extracted segments of conversations with metadata (source conversation ID, title, message count)
- Usage: Chunked conversations embedded → stored with vectors → retrieved via semantic search

**Embedding:**
- Purpose: Vector representation of text for semantic search
- Examples: `lib/import/embedder.ts`
- Pattern: Text → AWS Bedrock Cohere Embed v3 → 1024-dim vector → stored in Supabase pgvector column
- Flow: Conversation chunks → embeddings → stored in `conversation_embeddings` table → queried by RLM for context

**Memory:**
- Purpose: Extracted facts/insights learned from conversations
- Examples: `lib/memory/facts.ts`, `lib/memory/learning.ts`
- Pattern: Short factual statements about user (name, job, interests, preferences)
- Flow: Chat messages → learning module extracts facts → stored in `user_facts` table → used for personalization

**RLM Service:**
- Purpose: External memory retrieval and response generation
- Examples: Integration in `app/api/chat/route.ts`
- Pattern: Remote service called via HTTP POST with user_id, message, soulprint, history
- Returns: Generated response + metadata (chunks used, method, latency)

## Entry Points

**Home Page:**
- Location: `app/page.tsx`
- Triggers: Initial load or root navigation
- Responsibilities: Auth check (redirect to chat if authenticated), render landing page with sections, auth modal for signup/login

**Chat Page:**
- Location: `app/chat/page.tsx`
- Triggers: User clicks "Start" after auth or navigates to `/chat`
- Responsibilities: Load chat history, display messages, handle user input, manage message queue, poll memory status, display settings modal

**Import Page:**
- Location: `app/import/page.tsx`
- Triggers: User hasn't imported data yet (auth check in `/api/memory/status`)
- Responsibilities: Guide export process, handle file upload, show progress, call import API, display success/error

**API Route: `/api/chat`:**
- Location: `app/api/chat/route.ts`
- Triggers: POST request from chat page
- Responsibilities: Auth verification, memory retrieval, LLM invocation, web search (optional), response streaming

**API Route: `/api/import/queue-processing`:**
- Location: `app/api/import/queue-processing/route.ts`
- Triggers: POST from import page after upload
- Responsibilities: Download file from storage, parse conversations, chunk data, generate soulprint, queue embeddings

## Error Handling

**Strategy:** Multi-layer error handling with user-friendly fallbacks

**Patterns:**

**Client-side Error Handling:**
- Try-catch blocks around fetch calls
- Display user-friendly error messages
- Network errors show retry buttons
- Large file errors suggest reducing file size
- Session errors redirect to login

**Server-side Error Handling:**
- Route handlers wrap async logic in try-catch
- Return structured error responses with `error` and optional `code` fields
- Log errors to console for debugging
- Return 401 for auth failures, 400 for validation, 500 for server errors
- Example: `app/api/chat/route.ts` catches RLM failures and falls back to Bedrock

**Service Layer Error Handling:**
- Libraries throw descriptive errors with context
- Callers decide whether to retry, fallback, or propagate
- Example: `lib/import/embedder.ts` throws on batch embedding failures
- Example: `lib/memory/query.ts` returns empty results on query failures (graceful degradation)

## Cross-Cutting Concerns

**Logging:**
- Pattern: `console.log/error` with context prefixes like `[Chat]`, `[Import]`, `[Memory]`
- Examples: `console.log('[Chat] Calling RLM service...')`, `console.error('[Import] Upload error:', error)`
- Not centralized; scattered through route handlers and services

**Validation:**
- Pattern: Manual validation in route handlers (check auth, validate input shape)
- Example: `/api/import/queue-processing` validates storagePath, filename
- No centralized validation schema (no Zod/Yup); type safety via TypeScript

**Authentication:**
- Pattern: Supabase JWT in cookies (httpOnly, 30-day expiration)
- Checked via: `createClient().auth.getSession()` on client, `createServerComponentClient()` on server
- Protected routes check session in page components or route handlers
- Redirect to login on unauthorized access

**Authorization:**
- Pattern: User isolation via user_id in route handlers
- Example: `/api/chat` uses `user.id` to query user's memories and embeddings
- Admin routes check user role (if implemented)

**Rate Limiting:**
- Not explicitly implemented; relies on external services' rate limits
- Supabase, Bedrock, Perplexity, Tavily all have limits
- No client-side request throttling

---

*Architecture analysis: 2026-02-01*
