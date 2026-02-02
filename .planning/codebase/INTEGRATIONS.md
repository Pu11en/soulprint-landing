# External Integrations

**Analysis Date:** 2026-02-01

## APIs & External Services

**AI/LLM:**
- AWS Bedrock (Claude 3.5 Haiku) - Chat responses and memory synthesis
  - SDK: `@aws-sdk/client-bedrock-runtime`
  - Auth: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - Region: `AWS_REGION` (defaults to 'us-east-1')
  - Model: `BEDROCK_MODEL_ID` (defaults to 'us.anthropic.claude-3-5-haiku-20241022-v1:0')
  - Usage: `app/api/chat/route.ts`, `lib/memory/learning.ts`, `lib/memory/facts.ts`

- RLM Service (internal) - Memory retrieval and response generation
  - Endpoint: `https://soulprint-landing.onrender.com`
  - URL env var: `RLM_SERVICE_URL`
  - Endpoints used:
    - `POST /query` - Query memory and generate responses
    - `POST /create-soulprint` - Generate soulprint from conversations
    - `GET /health` - Health check
  - Usage: `app/api/chat/route.ts`, `app/api/soulprint/generate/route.ts`

- OpenAI - Limited use (for embeddings only, not soulprint generation)
  - SDK: `openai@6.17.0`
  - Auth: `OPENAI_API_KEY`
  - Usage: Fallback only, RLM preferred for soulprint

- Google Gemini - Avatar image generation
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
  - Auth: `GEMINI_API_KEY` or `GOOGLE_API_KEY`
  - Usage: `app/api/profile/ai-avatar/route.ts`

**Web Search:**
- Tavily - Real-time web search for factual queries
  - SDK: `@tavily/core@0.7.1`
  - Auth: `TAVILY_API_KEY`
  - Endpoints: Core SDK abstracts endpoint calls
  - Features: Search depth (basic/advanced), results limit, answer synthesis
  - Usage: `lib/search/tavily.ts`, `lib/search/smart-search.ts`

- Perplexity AI (optional) - Alternative real-time information
  - Endpoint: `https://api.perplexity.ai/chat/completions`
  - Auth: `PERPLEXITY_API_KEY`
  - Models: `sonar`, `sonar-deep-research`
  - Usage: `lib/search/perplexity.ts`, `lib/search/smart-search.ts`

## Data Storage

**Databases:**
- Supabase PostgreSQL - Primary database
  - URL: `https://swvljsixpvvcirjmflze.supabase.co` (env: `NEXT_PUBLIC_SUPABASE_URL`)
  - Auth keys:
    - Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side)
    - Service role key: `SUPABASE_SERVICE_ROLE_KEY` (server-side, secret)
  - Client SDK: `@supabase/supabase-js`, `@supabase/ssr`
  - Extensions: pgvector (for embeddings)
  - Tables:
    - `auth.users` - Built-in Supabase auth
    - `user_profiles` - User data, soulprint, import status, push subscriptions
    - `conversation_chunks` - Searchable memory chunks with embeddings
    - `import_jobs` - Import task tracking
    - `memory_chunks` - Embedded conversation fragments
    - Custom function: `search_memories(query_embedding, user_id)` - Vector similarity search

**File Storage:**
- AWS S3 / Cloudflare R2 - ChatGPT export file storage
  - SDK: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - Endpoint: `R2_ENDPOINT` (Cloudflare R2 compatible)
  - Auth:
    - Access key: `R2_ACCESS_KEY_ID`
    - Secret key: `R2_SECRET_ACCESS_KEY`
  - Bucket: `R2_BUCKET_NAME`
  - Bucket name: `user-exports`
  - Storage format: gzip-compressed conversations.json
  - Usage: `app/api/import/process-server/route.ts`, `app/api/test-r2/route.ts`

- Cloudinary - Avatar image storage and CDN
  - SDK: `cloudinary@2.9.0`
  - Cloud name: `CLOUDINARY_CLOUD_NAME` (default: 'djg0pqts6')
  - API key: `CLOUDINARY_API_KEY` (default: '136843289897238')
  - API secret: `CLOUDINARY_API_SECRET` (secret)
  - Usage: `app/api/profile/ai-avatar/route.ts` (image upload after Gemini generation)

**Caching:**
- None explicitly configured (could use Vercel KV or external Redis, not detected)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Custom built on PostgreSQL
  - Implementation: PKCE flow with cookie-based sessions
  - Client: `lib/supabase/client.ts` (browser)
  - Server: `lib/supabase/server.ts` (server actions, middleware)
  - Session handling: 30-day cookie persistence for Safari compatibility
  - Middleware: `lib/supabase/middleware.ts`

**OAuth Integrations:**
- Gmail OAuth2 - Email sending via Nodemailer
  - Credentials:
    - User: `GMAIL_USER`
    - Client ID: `GMAIL_CLIENT_ID`
    - Client Secret: `GMAIL_CLIENT_SECRET`
    - Refresh Token: `GMAIL_REFRESH_TOKEN`
  - Library: `nodemailer`
  - Usage: `lib/email.ts` (alternative to Resend)

## Email & Notifications

**Email Services:**
- Resend - Transactional email (primary)
  - SDK: `resend@6.9.1`
  - Auth: `RESEND_API_KEY`
  - From: `noreply@soulprint.so`
  - Templates: Soulprint ready notifications
  - Usage: `lib/email/send.ts`, `app/api/import/complete/route.ts`

- Gmail - Email sending (fallback)
  - SDK: `nodemailer`
  - Auth: OAuth2 (see Authentication section)
  - From: User's Gmail address (env: `GMAIL_USER`)
  - Usage: `lib/email.ts`

**Push Notifications:**
- Web Push API - Browser push notifications
  - SDK: `web-push@3.6.7`
  - Subscription storage: `user_profiles.push_subscription` (Supabase)
  - VAPID keys: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (required)
  - Usage: `app/api/push/subscribe/route.ts`, `app/api/import/complete/route.ts`

## Webhooks & Callbacks

**Incoming:**
- None detected in API routes

**Outgoing:**
- RLM Service callbacks - Processing status updates
  - Via: `RLM_SERVICE_URL/query` and `/create-soulprint`
  - Method: Blocking HTTP requests (no async webhooks)

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Rollbar, etc.)

**Logs:**
- Console logging (console.log/error) with prefixes like `[Chat]`, `[Email]`, `[Push]`
- No structured logging service detected

**Health Checks:**
- `app/api/chat/health/route.ts` - Checks OpenAI, Supabase, Perplexity, Tavily
- `app/api/admin/rlm-status/route.ts` - RLM service health
- `app/api/health/supabase/route.ts` - Supabase connectivity

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js optimized)
  - Deployments: Auto-deploy on git push
  - Env vars: Configured in Vercel dashboard

**CI Pipeline:**
- None detected (auto-deploy on main branch push)

**Build Commands:**
```
npm run dev       # Development server
npm run build     # Production build
npm start         # Production server
npm run lint      # ESLint check
```

## Environment Configuration

**Required env vars (Critical):**
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service role key]

# AWS (Bedrock + S3/R2)
AWS_ACCESS_KEY_ID=[key]
AWS_SECRET_ACCESS_KEY=[secret]
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-haiku-20241022-v1:0

# S3/R2
R2_ENDPOINT=[cloudflare r2 endpoint]
R2_ACCESS_KEY_ID=[key]
R2_SECRET_ACCESS_KEY=[secret]
R2_BUCKET_NAME=user-exports

# Email (Resend)
RESEND_API_KEY=[key]

# Search
TAVILY_API_KEY=[key]
PERPLEXITY_API_KEY=[key, optional]

# Avatar Generation
GEMINI_API_KEY=[key]
CLOUDINARY_CLOUD_NAME=djg0pqts6
CLOUDINARY_API_KEY=136843289897238
CLOUDINARY_API_SECRET=[secret]

# RLM Service
RLM_SERVICE_URL=https://soulprint-landing.onrender.com

# Push Notifications
VAPID_PUBLIC_KEY=[key]
VAPID_PRIVATE_KEY=[secret]

# Gmail (Optional, fallback)
GMAIL_USER=[email]
GMAIL_CLIENT_ID=[id]
GMAIL_CLIENT_SECRET=[secret]
GMAIL_REFRESH_TOKEN=[token]

# Optional
OPENAI_API_KEY=[key, RLM preferred]
```

**Secrets location:**
- `.env.local` (development, not committed)
- Vercel environment variables dashboard (production)

## Data Flow

**Import Flow:**
1. User uploads ChatGPT export (ZIP) → `app/import/page.tsx`
2. Raw JSON stored in S3/R2 → `user-exports` bucket
3. Server-side processing → `app/api/import/process-server/route.ts`
4. Multi-tier chunking created
5. Chunks sent to RLM for embedding
6. RLM generates soulprint
7. Data saved to Supabase (`user_profiles`, `conversation_chunks`)
8. Email notification sent via Resend
9. Push notification sent to subscribed browsers

**Chat Flow:**
1. User message → `app/api/chat/route.ts`
2. Optional: Tavily/Perplexity web search for real-time info
3. Query RLM service for memory context
4. AWS Bedrock (Claude) generates response
5. Learn from chat → Store in Supabase memory chunks

---

*Integration audit: 2026-02-01*
