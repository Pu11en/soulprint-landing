# External Integrations

**Analysis Date:** 2026-02-11

## APIs & External Services

**AI & LLM Services:**
- AWS Bedrock - Primary LLM inference for chat and analysis
  - SDK: `@aws-sdk/client-bedrock-runtime`
  - Models: Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude Opus, Claude Haiku 4.5
  - Auth: AWS access key/secret via `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Used in: `lib/bedrock.ts`, `app/api/chat/route.ts`, soulprint generation

- Anthropic API (Direct) - Fallback and specialized RLM queries
  - SDK: `anthropic` (official client)
  - Model: Claude Sonnet 4 (claude-sonnet-4-20250514)
  - Auth: `ANTHROPIC_API_KEY`
  - Used in: RLM service (`rlm-service/main.py`) for recursive language models
  - Endpoint: `https://api.anthropic.com/v1/messages`

- RLM Service (Internal) - Recursive Language Model for memory-enhanced chat
  - Type: Internal REST API
  - Base URL: `RLM_SERVICE_URL` (default: `https://soulprint-landing.onrender.com`)
  - Endpoints:
    - `POST /query` - Query with conversation memory (main chat endpoint)
    - `POST /import-full` - Stream import and generate soulprint (202 Accepted)
    - `POST /process-full` - Full pass processing (deprecated, use v2)
    - `GET /health` - Health check
  - Response format: JSON with response, chunks_used, method ("rlm" or "fallback"), latency_ms
  - Auth: No auth headers (internal, behind Render firewall)
  - Called from: `app/api/chat/route.ts`

**Web Search:**
- Tavily AI - Real-time web search for current information
  - SDK: `@tavily/core`
  - Auth: `TAVILY_API_KEY`
  - Endpoint: `https://api.tavily.com/search`
  - Used in: `lib/search/tavily.ts`, RLM service for tool-calling
  - Response: Top 5 results with title, URL, content, optional quick answer
  - Integrated in: Both RLM and direct Anthropic fallback with tool calling

**Third-Party APIs:**
- Google APIs - Gmail/Drive integration (optional)
  - SDK: `googleapis`
  - Auth: OAuth2 (user-authorized)
  - Status: Available but minimal usage in current codebase

- OpenAI - Optional transcription fallback
  - SDK: `openai`
  - Auth: `OPENAI_API_KEY`
  - Used in: `app/api/transcribe/route.ts` (optional, may be deprecated)

- Cloudinary - Image storage and transformation
  - SDK: `cloudinary`
  - Auth: Cloudinary credentials (not extracted to env vars in config)
  - Status: Available but not actively used in core flow

## Data Storage

**Databases:**
- PostgreSQL (via Supabase)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`
  - Client: `@supabase/supabase-js`, `@supabase/ssr`
  - Tables:
    - `user_profiles` - User account, soulprint_text, import_status, AI personality sections
    - `conversation_chunks` - Searchable memory (3-tier chunking: 100/500/2000 chars)
    - `conversations` - Chat history
    - `branches` - Conversation branches
    - Schema pre-set up (do not modify)

**File Storage:**
- Supabase Storage - Primary file hosting
  - Buckets: `user-exports` (original ChatGPT exports), `profile-data` (soulprints)
  - Auth: Supabase service key (server-side) or user auth (client-side)
  - Format: ZIP files (ChatGPT exports), JSON (conversations), gzipped JSON (compressed)
  - Streaming download support for large files (300MB+)
  - Implementation: `app/api/storage/upload-url/route.ts`

- AWS S3 (Optional, presigner available)
  - SDK: `@aws-sdk/s3-request-presigner`
  - Status: Available but not currently active in primary flow

**Caching:**
- Upstash Redis - Rate limiting and session cache
  - Connection: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`
  - SDK: `@upstash/redis`, `@upstash/ratelimit`
  - Purpose: Enforce rate limits (standard/expensive/upload tiers)
  - Tier details in `lib/rate-limit.ts`:
    - Standard: 60 req/min
    - Expensive: 20 req/min
    - Upload: 100 req/min
  - Fail-open: If Redis down, requests allowed through
  - Prefix: `rl:standard`, `rl:expensive`, `rl:upload`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Built-in PostgreSQL + OAuth
  - Flows: Email/password, Google OAuth, GitHub OAuth (configured)
  - Client: `@supabase/ssr` (server-side session management)
  - Cookies: 30-day expiry for Safari compatibility
  - PKCE flow: Handled by server middleware
  - Implementation: `lib/supabase/server.ts`, `lib/supabase/client.ts`

**CSRF Protection:**
- @edge-csrf/nextjs - Request forgery protection
  - Status: Deprecated (no edge-safe alternative available)
  - Token storage: Module-level cache in `lib/csrf.ts`
  - Implementation: `getCsrfToken()` preferred over csrfFetch wrapper
  - Applied to: Form submissions, API mutations

## Monitoring & Observability

**Error Tracking & Alerts:**
- Alert Webhook (Optional) - Failure notifications
  - Env: `ALERT_WEBHOOK`
  - Purpose: Slack/Discord webhook for RLM service failures
  - Used in: `rlm-service/main.py` alert_failure() function
  - Format: JSON message with error details and user ID

**Logging:**
- Pino - Structured JSON logging
  - SDK: `pino`, `pino-pretty`
  - Implementation: `lib/logger/` directory
  - Format: JSON with context (service, level, timestamp)
  - Pretty printing in dev via `pino-pretty`
  - Used in: API routes, RLM service

**Tracing & Observability:**
- Opik - LLM observability and tracing
  - SDK: `opik`
  - Purpose: Trace LLM calls for evaluation
  - Implementation: `lib/opik.ts`, used in chat endpoint tracing
  - Functions: `traceChatRequest()`, `flushOpik()`

## CI/CD & Deployment

**Frontend Hosting:**
- Vercel - Automatic deployment
  - Trigger: Git push to `main` branch on GitHub
  - Repo: `Pu11en/soulprint-landing`
  - Builds Next.js application
  - Environment variables via Vercel dashboard

**Backend Hosting:**
- Render - RLM Python service
  - Trigger: Git push to separate `soulprint-rlm` repo
  - Config: `rlm-service/render.yaml` (docker deployment)
  - Build: Dockerfile with Python 3.12-slim
  - Entry: `uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}`
  - Important: Must push RLM changes to `soulprint-rlm` repo, not main repo

**Repository Strategy:**
- RLM source code duplicated across repos:
  - Primary development: `soulprint-landing/rlm-service/`
  - Deployment source: `soulprint-rlm/` (separate GitHub repo)
  - Workflow: Copy changed files to soulprint-rlm, commit and push separately

**CI Pipeline:**
- GitHub Actions (configured in both repos)
- Tests: npm test (vitest), pytest for Python
- Linting: ESLint for TypeScript

## Environment Configuration

**Required Environment Variables:**

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL` (public, safe for browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` (secret, server-side only)

**AWS Bedrock:**
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

**RLM Service:**
- `RLM_SERVICE_URL` (default: https://soulprint-landing.onrender.com)

**Anthropic API:**
- `ANTHROPIC_API_KEY`

**Upstash:**
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`

**Tavily Search:**
- `TAVILY_API_KEY`

**Email (Optional):**
- `RESEND_API_KEY`

**Observability (Optional):**
- `ALERT_WEBHOOK`

**Deployment:**
- Vercel: Set via dashboard environment variables
- Render: Set via render.yaml `envVars` section

**Secrets Location:**
- `.env.local` - Local development (git-ignored)
- `.env.production.local` - Production secrets (git-ignored)
- Vercel Environment: Vercel dashboard
- Render Environment: Render dashboard or render.yaml

## Webhooks & Callbacks

**Incoming:**
- `POST /import-full` (RLM service) - Import job handler
  - Accepts: user_id, storage_path, file_type, conversation_count
  - Returns: 202 Accepted, processing async
  - Called from: `app/api/import/route.ts`

- `POST /query` (RLM service) - Chat query with memory
  - Accepts: user_id, message, history, soulprint_text, sections, emotional_state
  - Returns: response, chunks_used, method, latency_ms
  - Called from: `app/api/chat/route.ts`

**Outgoing:**
- Alert Webhook (Optional Slack/Discord)
  - Triggered on RLM failures
  - Format: JSON with error details

**Web Push (Optional):**
- `web-push` SDK available for push notifications
- Status: Setup present but not actively integrated in current flow

## Rate Limiting & Quotas

**Per-User Limits (Upstash Redis):**
- Standard endpoints: 60 requests/minute
- Expensive endpoints (AI calls): 20 requests/minute
- Upload endpoints: 100 requests/minute
- Fail-open strategy: If Redis unavailable, requests allowed

**API Quotas:**
- Bedrock: AWS account quota
- Anthropic: API rate limits by plan
- Tavily: Based on subscription tier
- OpenAI: Based on subscription tier

## Security Considerations

**CORS:**
- RLM service allows:
  - `http://localhost:3000` (development)
  - `https://*.vercel.app` (production preview)
  - Credentials: Enabled

**Content Security Policy (next.config.ts):**
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'  # Next.js requirement
style-src 'self' 'unsafe-inline'  # Tailwind requirement
img-src 'self' data: blob: https:
font-src 'self' data:
connect-src 'self' https://swvljsixpvvcirjmflze.supabase.co https://soulprint-landing.onrender.com https://*.upstash.io
frame-ancestors 'none'
```

**API Key Management:**
- Never stored in git (`.env` files git-ignored)
- Separate dev/prod environments
- Service keys: Server-side only
- Public keys: Marked with `NEXT_PUBLIC_` prefix

---

*Integration audit: 2026-02-11*
