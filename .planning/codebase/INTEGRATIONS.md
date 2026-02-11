# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**AI/LLM Models:**
- AWS Bedrock (Claude 3.5 Haiku) - Primary chat model via `@aws-sdk/client-bedrock-runtime`
  - Used in: `app/api/chat/route.ts`, `lib/memory/learning.ts`
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  - Model ID: `us.anthropic.claude-3-5-haiku-20241022-v1:0` (configurable)
  - Fallback: Vercel AI SDK supports OpenAI if Bedrock unavailable

- Anthropic (Claude 3.x) - Fallback via `@ai-sdk/anthropic`
  - SDK: Vercel AI SDK (`ai` package)
  - Used when Bedrock degraded

- OpenAI - Multiple purposes
  - Chat completion: via `@ai-sdk/openai` (Vercel AI SDK)
  - Whisper transcription: Direct API `https://api.openai.com/v1/audio/transcriptions`
    - Used in: `app/api/transcribe/route.ts`
    - Auth: `OPENAI_API_KEY` header
  - Embeddings: fallback to OpenAI if Bedrock unavailable

**RLM Service (Internal):**
- URL: `https://soulprint-landing.onrender.com` (configurable via `RLM_SERVICE_URL`)
- Endpoints:
  - `GET /health` - Health check (5s timeout)
  - `POST /create-soulprint` - Generate soulprint from conversations
  - `POST /query` - Query with memory context
- Circuit breaker pattern: `lib/rlm/health.ts`
  - CLOSED (normal) → OPEN (skip on 2 failures) → HALF_OPEN (test after 30s cooldown)
  - Fail-open: Skip RLM if circuit OPEN, allow chat to fallback to Bedrock
- Used in: `app/api/chat/route.ts`, `lib/memory/query.ts`

**Web Search:**
- Tavily API - Fallback web search
  - Package: `@tavily/core`
  - Auth: `TAVILY_API_KEY`
  - Used in: `lib/search/tavily.ts`, `app/api/cron/tasks/route.ts`
  - Scope: 5 results, basic/advanced search depth, optional answer synthesis

- Google Trends API
  - Package: `google-trends-api`
  - Used in: `lib/search/google-trends.ts`
  - Caching: 24-hour in-memory cache
  - Category mapping: tech, crypto, sports, health, business, politics, entertainment
  - Fail-open: Stale cache preferred over no data

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary database
  - Provider: Managed PostgreSQL (supabase.co)
  - Instance: `https://swvljsixpvvcirjmflze.supabase.co`
  - Schema:
    - `user_profiles` - User data, soulprint, import status, AI name/avatar
    - `conversations` - Chat conversation metadata
    - `messages` - Chat messages (user/assistant pairs)
    - `conversation_chunks` - Memory chunks with embeddings (multi-tier: 100/500/2000 char)
    - `learned_facts` - Extracted facts from chats (categories: preferences, relationships, milestones, beliefs, decisions, events)
    - `waitlist` - Email signup tracking
  - Client: `@supabase/supabase-js` + `@supabase/ssr`
  - Auth:
    - Client: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - Server: `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
  - RLS: Row-level security enforced; admin key used for service operations

**File Storage:**
- Supabase Storage (S3-compatible)
  - Buckets:
    - `imports` - Raw ChatGPT conversation JSON exports (gzipped)
    - (Inferred from code: user-exports bucket mentioned in CLAUDE.md)
  - Upload method: Signed URLs generated server-side via `app/api/storage/upload-url/route.ts`
  - Access: Read via authenticated client, write via signed URLs
  - Lifecycle: Manual management (no auto-delete policy detected)

- Cloudinary CDN - Image hosting
  - Service: Image generation and CDN delivery
  - Auth: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - Used in: `app/api/profile/ai-avatar/route.ts`
  - Purpose: AI avatar image storage and delivery

**Caching:**
- Upstash Redis (Serverless)
  - Provider: Upstash.io (Redis on Vercel's infrastructure)
  - Auth: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
  - Purpose: Rate limit state tracking
  - Key prefixes:
    - `rl:standard` - 60 req/min sliding window
    - `rl:expensive` - 20 req/min sliding window
    - `rl:upload` - 100 req/min sliding window
  - Fail-open: If Redis unavailable, requests allowed through (availability > security)

- In-memory caching:
  - Google Trends: 24-hour cache in `lib/search/google-trends.ts`
  - CSRF token: Module-level cache in `lib/csrf.ts`
  - RLM circuit breaker state: In-memory in `lib/rlm/health.ts`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom implementation
  - Method: Magic links / OAuth (configured in Supabase project)
  - Session: Cookie-based (30-day maxAge for Safari persistence)
  - Cookie config: `sameSite: 'lax'`, `secure: true` in production
  - Server-side auth via `lib/supabase/server.ts`
  - Client-side auth via `lib/supabase/client.ts`
  - PKCE flow support for security (handled by Supabase)

**CSRF Protection:**
- @edge-csrf/nextjs middleware
  - Token generation: Per-request via middleware
  - Token delivery: `X-CSRF-Token` response header
  - Token retrieval: `lib/csrf.ts` (cached client-side)
  - Validation: Middleware checks on state-changing requests (POST/PUT/DELETE/PATCH)
  - Deprecation note: Maintained despite deprecation (no edge-runtime alternative available)

## Monitoring & Observability

**Error Tracking & Logging:**
- Pino structured logger (`lib/logger.ts`)
  - Format: JSON logs with correlation IDs
  - Pretty-printing: `pino-pretty` in dev
  - Request tracking: Correlation IDs via headers
  - Used in: All API routes, chat processing, memory operations

- Opik (Comet) - LLM observability
  - SDK: `opik` package
  - Dashboard: https://www.comet.com/opik
  - Auth: `OPIK_API_KEY`, `OPIK_PROJECT_NAME`, `OPIK_WORKSPACE_NAME`
  - Traces recorded:
    - Chat requests: `traceChatRequest()` in `lib/opik.ts`
    - Soulprint generation: `traceQuickPass()`
    - Memory learning: `traceLearnedFact()`
    - Full end-to-end message flow with metadata
  - Used in: `app/api/chat/route.ts`, soulprint generation endpoints

**Health Checks:**
- RLM service health: `app/api/rlm/health/route.ts` - 5s timeout
- Supabase health: `app/api/health/route.ts` - Simple connectivity check
- Admin RLM status: `app/api/admin/rlm-status/route.ts` - Detailed circuit breaker state

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js native)
  - Git integration: Auto-deploy on `git push` to main
  - Environment: Managed via Vercel dashboard (not in repo)
  - Max function duration: 60 seconds (streaming chat responses)
  - Scaling: Auto-scales with traffic

**Git-based CI:**
- GitHub (repository: `Pu11en/soulprint-landing`)
  - No explicit CI config detected (Vercel handles builds)
  - Deployment: Automatic on push to main branch

**Database Migrations:**
- Manual (Supabase dashboard)
- SQL migrations tracked if in `.sql` files (none detected in public code)

## Webhooks & Callbacks

**Incoming Webhooks:**
- Supabase Auth callbacks: `app/auth/callback/route.ts`
  - Triggered by OAuth providers on user signup/login
  - Handles PKCE flow completion, session creation

**Outgoing Webhooks:**
- Web Push notifications: `app/api/import/complete/route.ts`
  - Service: `web-push` package
  - Trigger: Import processing complete
  - Purpose: Notify user import ready without email
  - Keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (not detected in vars, may be hardcoded)

- Email notifications: Asynchronous via `lib/email.ts`
  - Trigger: Import complete, task reminders, waitlist confirmation
  - Provider: Gmail via OAuth2
  - Auth: `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`
  - Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s)

## Environment Configuration

**Required Environment Variables:**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<public-key>
SUPABASE_SERVICE_ROLE_KEY=<admin-key>

# AWS Bedrock
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0

# RLM Service
RLM_SERVICE_URL=https://soulprint-landing.onrender.com

# Rate Limiting (Upstash)
UPSTASH_REDIS_URL=<redis-url>
UPSTASH_REDIS_TOKEN=<token>

# OpenAI (Whisper, embeddings)
OPENAI_API_KEY=<key>

# Web Search
TAVILY_API_KEY=<key>

# Images (Cloudinary)
CLOUDINARY_CLOUD_NAME=djg0pqts6
CLOUDINARY_API_KEY=136843289897238
CLOUDINARY_API_SECRET=<secret>

# Email (Gmail OAuth2)
GMAIL_USER=<email>
GMAIL_CLIENT_ID=<id>
GMAIL_CLIENT_SECRET=<secret>
GMAIL_REFRESH_TOKEN=<token>

# Observability (Opik)
OPIK_API_KEY=<key>
OPIK_PROJECT_NAME=soulprint
OPIK_WORKSPACE_NAME=default
```

**Secrets Location:**
- `.env.local` (development, .gitignored)
- `.env.production.local` (production, .gitignored)
- Vercel Environment Variables (production - not in repo)

**Optional Variables:**
- `RESEND_API_KEY` - Email service (deprecated, kept for future use)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` - Web Push (not detected)

## Integration Patterns

**Fail-Open Architecture:**
- RLM degradation: Chat falls back to Bedrock directly
- Rate limiting down: Requests allowed through (Redis unavailable)
- Google Trends down: In-memory cache used, returns stale data

**Circuit Breaker Pattern:**
- RLM service: `lib/rlm/health.ts` (CLOSED → OPEN → HALF_OPEN)
  - 2 consecutive failures trigger OPEN state
  - 30s cooldown before HALF_OPEN test
  - Single successful call returns to CLOSED

**Request Validation:**
- Zod schemas in `lib/api/schemas.ts` for all POST/PUT/PATCH endpoints
- Body size limit: 50MB for imports
- Centralized error handling in `lib/api/error-handler.ts`

**Rate Limiting:**
- 3-tier sliding window (Upstash Redis):
  - Standard: 60 req/min (memory queries, profile reads)
  - Expensive: 20 req/min (AI chat, avatar generation, import)
  - Upload: 100 req/min (chunked file uploads)
- Per-user limiting by `user_id`
- Returns HTTP 429 with `Retry-After` header

---

*Integration audit: 2026-02-11*
