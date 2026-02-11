# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- TypeScript 5 - All Next.js frontend and API routes
- Python 3.12 - RLM service backend at `rlm-service/`

**Secondary:**
- JavaScript (Node.js runtime for Next.js)

## Runtime

**Frontend/API:**
- Node.js (via Next.js 16.1.5)
- Deployed to: Vercel (auto-deploy on git push to main)

**Backend (RLM Service):**
- Python 3.12-slim (Docker container)
- Deployed to: Render (auto-deploy from separate `soulprint-rlm` repo)
- Entry point: `rlm-service/main.py` via Uvicorn
- Container exposes port 10000

**Package Managers:**
- npm (Node.js dependencies)
- pip (Python dependencies)

## Frameworks

**Frontend/API:**
- Next.js 16.1.5 - React SSR/SSG framework, API routes
- React 19.2.3 - UI library
- Tailwind CSS 3.4.19 - Utility-first styling
- Framer Motion 12.29.2 - Animation library
- Radix UI - Accessible component primitives

**Backend (RLM Service):**
- FastAPI 0.109.0+ - Python web framework for REST API
- Uvicorn 0.27.0+ - ASGI server

**Build/Dev:**
- Next.js build system (TypeScript compilation, code splitting)
- Vite (via vite-tsconfig-paths for test imports)
- ESLint 9 - Linting
- TypeScript 5 - Type checking

## Key Dependencies

**Critical - AI & LLM:**
- `@ai-sdk/anthropic` 3.0.36 - Vercel AI SDK for Anthropic Claude models
- `@ai-sdk/openai` 3.0.25 - Vercel AI SDK for OpenAI models
- `@aws-sdk/client-bedrock-runtime` 3.980.0 - AWS Bedrock (Claude Sonnet, Haiku models)
- `anthropic` 6.17.0 - Official Anthropic API client (for direct calls)
- `rlm` - Recursive Language Models library (installed via Git from GitHub in Dockerfile)

**Critical - Authentication & Session:**
- `@supabase/ssr` 0.8.0 - Server-side auth for Next.js
- `@supabase/supabase-js` 2.93.1 - Supabase client SDK
- `@edge-csrf/nextjs` 2.5.2 - CSRF protection (deprecated but no edge-safe alternative)

**Infrastructure:**
- `@upstash/redis` 1.36.2 - Upstash Redis client for caching/rate limiting
- `@upstash/ratelimit` 2.0.8 - Rate limiting library built on Upstash Redis
- `httpx` (Python) - Async HTTP client for RLM service
- `ijson` (Python) - Memory-efficient JSON streaming for large file processing

**Search & Integration:**
- `@tavily/core` 0.7.1 - Tavily web search API
- `googleapis` 170.1.0 - Google APIs (Google Drive/Gmail integration)
- `cloudinary` 2.9.0 - Image storage and transformation

**Storage & Upload:**
- `jszip` 3.10.1 - Client-side ZIP file handling
- `web-push` 3.6.7 - Web push notifications
- `@aws-sdk/s3-request-presigner` 3.975.0 - S3 presigned URLs (optional, not actively used)

**Observability & Logging:**
- `pino` 10.3.0 - Structured JSON logger
- `pino-pretty` 13.1.3 - Pretty printing for pino (dev only)
- `opik` 1.10.8 - Observability/tracing for LLM applications

**Email & Communication:**
- `resend` 6.9.1 - Resend email service (API maintained, but sendSoulprintReadyEmail removed)
- `nodemailer` 7.0.13 - SMTP email client

**Utilities:**
- `zod` 4.3.6 - Runtime schema validation
- `clsx` 2.1.1 - Conditional classname utility
- `tailwind-merge` 3.4.0 - Merge Tailwind classes intelligently
- `next-themes` 0.4.6 - Dark mode management

**Content & Rendering:**
- `react-markdown` 10.1.0 - Markdown to React rendering
- `react-syntax-highlighter` 16.1.0 - Code syntax highlighting
- `rehype-sanitize` 6.0.0 - HTML sanitization
- `remark-gfm` 4.0.1 - GitHub-flavored Markdown support

## Configuration

**Environment Variables:**

The stack requires these environment variables (never stored in codebase):

**Supabase (Database & Auth):**
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anonymous key (for client-side auth)
- `SUPABASE_SERVICE_ROLE_KEY` - Admin key (server-side only, `.env.local`)

**AWS Bedrock (LLM):**
- `AWS_REGION` - AWS region (default: `us-east-1`)
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials

**RLM Service:**
- `RLM_SERVICE_URL` - URL to RLM service (e.g., `https://soulprint-landing.onrender.com`)

**Anthropic (Direct API calls from RLM):**
- `ANTHROPIC_API_KEY` - Anthropic API key (used by RLM service and some RLM fallback queries)

**Upstash (Redis & Rate Limiting):**
- `UPSTASH_REDIS_URL` - Upstash Redis connection URL
- `UPSTASH_REDIS_TOKEN` - Upstash Redis auth token

**External APIs:**
- `TAVILY_API_KEY` - Tavily web search API key
- `OPENAI_API_KEY` - OpenAI API key (optional, for transcription)
- `RESEND_API_KEY` - Resend email service API key

**Monitoring & Observability:**
- `ALERT_WEBHOOK` - Optional Slack/Discord webhook for RLM failure alerts (RLM service)

**Build & Deployment:**
- `NEXT_PUBLIC_*` - Prefix exposes to browser (only non-sensitive config)
- `NODE_ENV` - `development`, `production`, or `test`

**TypeScript Configuration (`tsconfig.json`):**
- Strict mode enabled
- Path alias: `@/*` maps to project root
- ES2017 target
- Module resolution: `bundler` (Next.js 13+)
- Plugins: `next` for automatic type generation

**Next.js Configuration (`next.config.ts`):**
- Body size limit: 50MB (for large ChatGPT exports)
- Security headers: DENY frame-options, CSP, XSS protection
- CSP allows: Supabase, RLM service, Upstash
- Experimental: Server Actions with custom body size

## Platform Requirements

**Development:**
- Node.js 18+ (for Next.js 16)
- npm or yarn
- Python 3.12+ (if running RLM service locally)
- Git (for GitHub integration)

**Production:**
- Vercel hosting (Next.js frontend/API)
- Render hosting (RLM Python service)
- Supabase (PostgreSQL database)
- Upstash Redis (rate limiting, session cache)
- AWS Bedrock access (LLM inference)
- Optional: Google Cloud, Tavily, Resend, Anthropic API

**Database:**
- PostgreSQL via Supabase
- Tables: `user_profiles`, `conversation_chunks`, `conversations`, `branches`, etc.

**Storage:**
- Supabase Storage buckets: `user-exports`, `profile-data`, etc.
- Cloudinary (optional, image transformation)

---

*Stack analysis: 2026-02-11*
