# External Integrations

**Analysis Date:** 2026-01-12

## APIs & External Services

**AI/LLM Services:**
- OpenAI - Primary SoulPrint generation (GPT-4o)
  - SDK/Client: `openai` npm package v4.x
  - Auth: API key in `OPENAI_API_KEY` env var
  - Location: `lib/openai/client.ts`, `lib/openai/soulprint-generator.ts`

- Google Gemini - Alternative LLM provider
  - SDK/Client: `@google/generative-ai`
  - Auth: API key in `GEMINI_API_KEY` env var
  - Location: `lib/gemini/client.ts`, `lib/gemini/soulprint-generator.ts`

**Voice Processing:**
- AssemblyAI - Voice transcription and analysis
  - SDK/Client: `assemblyai` v4.19.0
  - Auth: API key in `ASSEMBLYAI_API_KEY` env var
  - Location: `lib/soulprint/assemblyai-analyzer.ts`

**Email:**
- Gmail (via Nodemailer) - Transactional emails
  - SDK/Client: `nodemailer` with OAuth2 transport
  - Auth: Gmail OAuth2 credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
  - Location: `lib/email.ts`

**CRM:**
- Streak - Lead management and tracking
  - Integration method: REST API via fetch
  - Auth: API key hardcoded in `lib/streak.ts`
  - Location: `lib/streak.ts`
  - Note: Used for waitlist/gate registrations

## Data Storage

**Databases:**
- PostgreSQL on Supabase - Primary data store
  - Connection: via `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  - Client: `@supabase/supabase-js` v2.x, `@supabase/ssr`
  - Location: `lib/supabase/server.ts`, `lib/supabase/client.ts`
  - Tables: `soulprints`, `profiles`, `api_keys`, `chats`, `chat_history`

**File Storage:**
- Supabase Storage - User uploads, audio files
  - SDK/Client: `@supabase/supabase-js`
  - Auth: Same as database
  - Buckets: Not explicitly configured in code

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

**Access Control:**
- PIN Gate: Hardcoded `7423` for beta access
  - Location: `components/auth/login-form.tsx`, `app/actions/gate.ts`
- Access Code: `7423` for registration
  - Location: `app/actions/gate.ts`

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
  - Location: `vercel.json` (if exists), `next.config.ts`

**CI Pipeline:**
- Not detected (no GitHub Actions workflows)

## Environment Configuration

**Development:**
- Required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY`
  - `GEMINI_API_KEY` (optional)
  - `ASSEMBLYAI_API_KEY`
  - Gmail OAuth credentials
- Secrets location: `.env.local` (gitignored)

**Production:**
- Secrets management: Vercel environment variables
- Same vars as development

## Webhooks & Callbacks

**Incoming:**
- OAuth Callback - `/auth/callback/route.ts`
  - Purpose: Handle OAuth redirect from Supabase
  - Verification: Supabase handles token exchange

**Outgoing:**
- Streak CRM - On registration
  - Endpoint: Streak API
  - Location: `lib/streak.ts` (`createStreakLead`)
  - Trigger: User completes gate registration

- Gmail - On registration
  - Endpoint: Gmail SMTP via OAuth2
  - Location: `lib/email.ts` (`sendConfirmationEmail`)
  - Trigger: User completes gate registration

## API Endpoints

**Internal:**
- `POST /api/soulprint/generate` - Generate SoulPrint from questionnaire
- `POST /api/soulprint/submit` - Alternative submission endpoint
- `POST /api/v1/chat/completions` - OpenAI-compatible chat API
- `POST /api/gemini/chat` - Gemini chat endpoint
- `POST /api/voice/analyze` - Voice analysis
- `POST /api/audio/analyze` - Audio analysis
- `POST /api/waitlist` - Waitlist submission (Streak integration)

---

*Integration audit: 2026-01-12*
*Update when adding/removing external services*
