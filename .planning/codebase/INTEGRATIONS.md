# External Integrations

**Analysis Date:** 2026-01-13

## APIs & External Services

**AI/LLM Services:**
- Google Gemini - Primary SoulPrint generation and chat
  - SDK/Client: `@google/genai` npm package v1.34.0
  - Auth: API key in `GEMINI_API_KEY` env var
  - Model: `gemini-2.0-flash` (default)
  - Location: `lib/gemini/client.ts`, `lib/gemini/soulprint-generator.ts`

- OpenAI - Alternative LLM provider
  - SDK/Client: Custom client in `lib/openai/client.ts`
  - Auth: API key in `OPENAI_API_KEY` env var
  - Location: `lib/openai/soulprint-generator.ts`

**Voice Processing:**
- AssemblyAI - Voice transcription and emotional analysis
  - SDK/Client: `assemblyai` v4.19.0
  - Auth: API key in `ASSEMBLYAI_API_KEY` env var
  - Location: `lib/soulprint/assemblyai-analyzer.ts`, `app/api/voice/analyze/route.ts`
  - Features: Transcription, sentiment analysis, word-level timestamps

**Email:**
- Gmail (via Nodemailer) - Transactional emails
  - SDK/Client: `nodemailer` with OAuth2 transport
  - Auth: Gmail OAuth2 credentials in env vars
  - Location: `lib/email.ts`

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary data store
  - Connection: via `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Service Key: `SUPABASE_SERVICE_ROLE_KEY` for admin operations
  - Client: `@supabase/supabase-js` v2.84.0, `@supabase/ssr` v0.7.0
  - Location: `lib/supabase/server.ts`, `lib/supabase/client.ts`
  - Tables: `soulprints`, `profiles`, `api_keys`, `chats`, `chat_history`
  - Migrations: `supabase/migrations/*.sql`

**File Storage:**
- Supabase Storage - Potential user uploads
  - SDK/Client: `@supabase/supabase-js`
  - Auth: Same as database

**Caching:**
- None detected (no Redis or caching layer)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Email/password + OAuth
  - Implementation: `@supabase/ssr` for server-side session management
  - Token storage: HTTP-only cookies
  - Session management: JWT refresh handled by Supabase
  - Location: `lib/supabase/middleware.ts`, `middleware.ts`

**OAuth Integrations:**
- Google OAuth - Social sign-in
  - Credentials: Configured in Supabase dashboard
  - Location: `app/actions/auth.ts` (`signInWithGoogle`)
  - Scopes: email, profile

**Access Control:**
- Access Code: `7423` for beta access
  - Location: `app/actions/gate.ts`, `app/enter/page.tsx`

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry or similar)

**Analytics:**
- None detected (no Mixpanel, GA, etc.)

**Logs:**
- Console.log only
- Vercel logs for production

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js hosting
  - Deployment: Automatic on push (configured)
  - Environment vars: Vercel dashboard
  - Custom domain: `soulprintengine.ai`

**CI Pipeline:**
- Not detected (no GitHub Actions workflows)

## Environment Configuration

**Development:**
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY`
  - `ASSEMBLYAI_API_KEY`
- Optional: Gmail OAuth credentials
- Secrets location: `.env.local` (gitignored)

**Production:**
- Secrets management: Vercel environment variables
- Same vars as development
- Custom domain configured

## Webhooks & Callbacks

**Incoming:**
- OAuth Callback - `/auth/callback/route.ts`
  - Purpose: Handle OAuth redirect from Supabase
  - Verification: Supabase handles token exchange

- n8n Webhook - Voice analysis automation
  - Endpoint: Configured via `NEXT_PUBLIC_N8N_SOULPRINT_WEBHOOK`
  - Location: `lib/prosody/webhook.ts`

**Outgoing:**
- n8n Automation - SoulPrint processing
  - Endpoint: External webhook URL
  - Location: `lib/prosody/webhook.ts`
  - Trigger: Voice analysis completion

## API Endpoints

**Internal:**
- `POST /api/soulprint/generate` - Generate SoulPrint from questionnaire
- `POST /api/soulprint/submit` - Alternative submission endpoint
- `POST /api/v1/chat/completions` - OpenAI-compatible chat API
- `POST /api/gemini/chat` - Gemini chat endpoint
- `POST /api/voice/analyze` - AssemblyAI voice analysis
- `POST /api/audio/analyze` - Audio analysis

---

*Integration audit: 2026-01-13*
*Update when adding/removing external services*
