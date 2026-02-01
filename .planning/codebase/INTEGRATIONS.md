# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**AI & LLM:**
- **AWS Bedrock (Claude)** - Primary LLM for chat and content generation
  - SDK/Client: `@aws-sdk/client-bedrock-runtime`
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Model: `BEDROCK_MODEL_ID` (e.g., Claude 3.5 Haiku)
  - Usage: Chat responses, AI name generation, personality analysis
  - Implementation: `app/api/chat/route.ts`, `lib/import/personality-analysis.ts`

- **OpenAI** - Fallback for embeddings and content analysis
  - SDK/Client: `openai`
  - Auth: `OPENAI_API_KEY`
  - Usage: Text embeddings, soulprint generation
  - Implementation: `app/api/import/process/route.ts`

**Web Search & Intelligence:**
- **Perplexity AI (Sonar)** - Real-time web search with citations
  - Auth: `PERPLEXITY_API_KEY`
  - Models: `sonar` (quick), `sonar-deep-research` (comprehensive)
  - Usage: Current news, time-sensitive information, facts
  - Implementation: `lib/search/perplexity.ts`, `app/api/chat/route.ts`
  - Timeout: 10s for normal, 30s for deep research

- **Tavily** - Web search fallback
  - SDK/Client: `@tavily/core`
  - Auth: `TAVILY_API_KEY`
  - Usage: Backup search when Perplexity unavailable
  - Implementation: `lib/search/tavily.ts`

**Email:**
- **Gmail (OAuth2)** - Email sending for waitlist confirmations, task notifications
  - SDK/Client: `nodemailer` with Gmail service
  - Auth: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER`
  - Implementation: `lib/email/send.ts`, `lib/email.ts`
  - Formats: Waitlist confirmation, task email with citations
  - From address: `SoulPrint <[GMAIL_USER]>`

- **Resend** - Alternative email delivery service
  - SDK/Client: `resend`
  - Auth: Not found in current implementation
  - Status: Available but not actively used

**Voice & Audio:**
- **Assembly AI** - Audio transcription and processing
  - Auth: `ASSEMBLYAI_API_KEY`
  - Usage: Voice input transcription
  - Implementation: `app/api/transcribe/route.ts`

- **Google APIs (GoogleAuth)** - Gmail integration via googleapis
  - SDK/Client: `googleapis`
  - Auth: Gmail OAuth credentials
  - Implementation: Email sending pipeline

## Data Storage

**Databases:**
- **Supabase (PostgreSQL)** - Primary database
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server)
  - Client: `@supabase/supabase-js` with SSR mode (`@supabase/ssr`)
  - Auth: Supabase auth via email/OAuth
  - Tables: user_profiles, conversations, chunks, embeddings, memories, gamification data
  - Features: RLS (row-level security), realtime subscriptions, vector search
  - Implementation: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`

**File Storage:**
- **Cloudflare R2** - Object storage for user uploads and files
  - SDK/Client: `@aws-sdk/client-s3` (S3-compatible)
  - Auth: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
  - Bucket: `soulprint-uploads`
  - Operations: Upload, download, delete, signed URL generation
  - Signed URLs: Generated via `@aws-sdk/s3-request-presigner`
  - Implementation: `app/api/test-r2/route.ts`, `app/api/import/upload/route.ts`

- **Cloudinary** - Image hosting and optimization
  - SDK/Client: `cloudinary`
  - Status: Available in dependencies, purpose unclear from codebase scan

**Caching:**
- Not detected in current implementation

## Authentication & Identity

**Auth Provider:**
- **Supabase Auth** - User authentication and session management
  - Implementation: `lib/supabase/server.ts` (server-side), `lib/supabase/client.ts` (client-side)
  - Methods: Email/password, OAuth (via Supabase providers)
  - Session: Cookie-based (30-day max age) with PKCE flow
  - Middleware: `middleware.ts` for session refresh and route protection
  - Voice Verification: Optional verification flag passed in chat requests

- **Gmail OAuth** - Email credentials (for sending via Gmail)
  - Flow: OAuth2 with refresh tokens
  - Purpose: Email delivery authorization

- **Vercel OIDC** - Deployment authentication
  - Token: `VERCEL_OIDC_TOKEN`
  - Purpose: GitHub Actions / deployment authentication

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, etc.)
- Console logging used for debugging

**Logs:**
- Console-based logging with prefixes (e.g., `[Chat]`, `[Memory]`, `[Import]`)
- Structured error logging in API routes

## CI/CD & Deployment

**Hosting:**
- **Vercel** - Frontend and API hosting
  - Config: `vercel.json`
  - Environment: Development branch tracked
  - OIDC: Enabled for secure deployments

**CI Pipeline:**
- GitHub Actions (implied but not found in current scan)
- Automated deployments via Vercel

## Environment Configuration

**Required env vars (critical):**
- `AWS_REGION` - AWS operations
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `BEDROCK_MODEL_ID` - Claude model selection
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Client-side DB
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side DB access
- `OPENAI_API_KEY` - Embeddings and analysis
- `PERPLEXITY_API_KEY` - Web search
- `TAVILY_API_KEY` - Web search fallback
- `GMAIL_*` (4 vars) - Email sending
- `R2_*` (4 vars) - File storage
- `RLM_SERVICE_URL` - External memory service

**Optional env vars:**
- `ASSEMBLYAI_API_KEY` - Audio transcription
- `NEXT_PUBLIC_SITE_URL` - Site URL for links
- `VERCEL_OIDC_TOKEN` - Deployment auth

**Secrets location:**
- `.env.local` (development, not committed)
- Vercel dashboard (production)

## Webhooks & Callbacks

**Incoming:**
- `app/api/waitlist/confirm/route.ts` - Waitlist confirmation link callback
- `app/api/cron/tasks/route.ts` - Scheduled task execution (time-based triggers)

**Outgoing:**
- Email confirmations sent via Gmail/Nodemailer
- Push notifications via `web-push`
- RLM service calls to `RLM_SERVICE_URL` for memory operations

## External Service Health Checks

**Health endpoints** (for monitoring service availability):
- `app/api/chat/health/route.ts` - Chat/Bedrock health
- `app/api/chat/perplexity-health/route.ts` - Perplexity service health
- `app/api/health/supabase/route.ts` - Supabase connection
- `app/api/rlm/health/route.ts` - Remote learning/memory service

## Integration Patterns

**Service Initialization:**
- Lazy initialization used for SDK clients (avoid build-time errors)
- Environment variable validation at runtime
- Fallback patterns (e.g., Perplexity → Tavily for search)

**Error Handling:**
- API errors return JSON with error messages
- Service failures logged to console with context prefix
- Graceful degradation (e.g., chat works without web search)
- Timeout handling (AbortSignal) on external API calls

**Rate Limiting:**
- Not explicitly configured in current scans

---

*Integration audit: 2026-02-01*
