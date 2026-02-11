# Technology Stack

**Analysis Date:** 2026-02-11

## Languages

**Primary:**
- TypeScript 5.x - All source code, APIs, and utilities
- JSX/TSX - React components with full type safety

**Secondary:**
- JavaScript - Configuration files, scripts
- Python - RLM service (separate repo, external dependency)

## Runtime

**Environment:**
- Node.js 18+ (inferred from ES2017 target and esnext module output)
- Next.js 16.1.5 - Full-stack React framework with API routes

**Package Manager:**
- npm - `package.json` lockfile present
- No yarn or pnpm detected

## Frameworks

**Core Web:**
- Next.js 16.1.5 - Server-side rendering, API routes, file-based routing
- React 19.2.3 - UI library with hooks and server components
- React DOM 19.2.3 - DOM rendering

**UI Component System:**
- Radix UI (14+ components) - Unstyled, accessible components (`@radix-ui/*`)
  - Dialog, Dropdown Menu, Select, Slider, Tooltip, Avatar, Scroll Area, Accordion, etc.
- Tailwind CSS 3.4.19 - Utility-first CSS framework
- Class Variance Authority 0.7.1 - Component variant patterns
- Tailwind Merge 3.4.0 - Class merging utility
- Lucide React 0.563.0 - Icon library

**Styling & Animation:**
- Framer Motion 12.29.2 - Production animation library
- Motion 12.29.2 - Animation primitives
- Tailwind CSS Typography 0.5.19 - Prose styling
- Tailwind Animate 1.0.7 - Keyframe animations

**Content & Rendering:**
- React Markdown 10.1.0 - Markdown to JSX
- React Syntax Highlighter 16.1.0 - Code block highlighting
- Remark GFM 4.0.1 - GitHub Flavored Markdown support
- Rehype Sanitize 6.0.0 - HTML sanitization

**State & Utilities:**
- Zod 4.3.6 - Runtime schema validation (API request/response)
- Clsx 2.1.1 - Classname utility
- Use Stick To Bottom 1.1.2 - Chat scroll behavior

**Testing:**
- Vitest 4.0.18 - Unit/integration test runner (Vite-based)
- Playwright 1.58.2 - E2E browser automation testing
- Testing Library React 16.3.2 - Component testing utilities
- Testing Library Jest DOM 6.9.1 - DOM matchers
- Testing Library User Event 14.6.1 - User interaction simulation
- JSDOM 28.0.0 - DOM implementation for Node.js
- Mock Service Worker (MSW) 2.12.9 - HTTP mocking
- Next Test API Route Handler 5.0.3 - API route testing

**Build & Dev:**
- TypeScript 5.x - Type checking and transpilation
- ESLint 9.x - Code linting with Next.js config
- PostCSS 8.5.6 - CSS transformation
- Autoprefixer 10.4.23 - Vendor prefix injection
- Vite TSConfig Paths 6.0.5 - Path alias resolution in Vitest
- Vitejs Plugin React 5.1.3 - React plugin for Vite
- Sharp 0.34.5 - Image optimization (Next.js Image component)

## Key Dependencies

**Critical - AI/LLM:**
- @ai-sdk/anthropic 3.0.36 - Anthropic Claude integration via Vercel AI SDK
- @ai-sdk/openai 3.0.25 - OpenAI API integration via Vercel AI SDK
- ai 6.0.72 - Vercel AI SDK (streaming, message handling)
- @aws-sdk/client-bedrock-runtime 3.980.0 - AWS Bedrock Claude 3.5 Haiku access (primary chat model)
- openai 6.17.0 - OpenAI client (Whisper transcription, embedding fallback)

**Critical - Infrastructure:**
- @supabase/ssr 0.8.0 - Supabase server-side utilities for auth/sessions
- @supabase/supabase-js 2.93.1 - Supabase database, auth, and storage client
- @upstash/redis 1.36.2 - Serverless Redis client (rate limiting state)
- @upstash/ratelimit 2.0.8 - Rate limiting middleware (60/20/100 req/min tiers)

**Critical - Security:**
- @edge-csrf/nextjs 2.5.2 - CSRF token generation and validation (deprecated but no edge runtime alternative)
- zod 4.3.6 - Request/response schema validation

**Search & Knowledge:**
- @tavily/core 0.7.1 - Web search API (fallback to Perplexity)
- google-trends-api 4.9.2 - Google Trends scraper (24h in-memory cache)
- googleapis 170.1.0 - Google APIs (unused currently, may be for Google auth)

**Observability & Analytics:**
- opik 1.10.8 - LLM observability (Comet platform integration for trace/eval)
- pino 10.3.0 - Structured logger
- pino-pretty 13.1.3 - Pretty-print JSON logs

**File & Media:**
- jszip 3.10.1 - ZIP file parsing (ChatGPT export handling)
- cloudinary 2.9.0 - Image CDN and generation (AI avatar storage)
- web-push 3.6.7 - Web Push API notifications (import completion)

**Email:**
- resend 6.9.1 - Email API (deprecated in favor of nodemailer)
- nodemailer 7.0.13 - SMTP email sender via Gmail OAuth2

**UI/UX:**
- next-themes 0.4.6 - Dark mode theming
- react-resizable-panels 4.6.2 - Resizable panel UI

**Performance:**
- Autocannon 8.0.0 - HTTP benchmarking tool (dev dependency)

## Configuration

**TypeScript:**
- Target: ES2017
- Strict mode enabled
- Path aliases: `@/*` → `./*` (src root)
- JSX: react-jsx (no runtime import needed)
- Isolated modules, no unchecked indexed access

**Next.js:**
- Server Actions body limit: 50MB (for large ChatGPT exports)
- Experimental features enabled for file uploads
- Security headers enforced (CSP, X-Frame-Options, etc.)
- File-based routing with `app/` directory structure

**Environment:**
- `.env.local` - Local dev configuration (not committed)
- `.env.production.local` - Production secrets (not committed)
- **Key vars required:**
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase instance URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key
  - `SUPABASE_SERVICE_ROLE_KEY` - Admin Supabase key (server-only)
  - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - Bedrock access
  - `BEDROCK_MODEL_ID` - Model ID (default: us.anthropic.claude-3-5-haiku-20241022-v1:0)
  - `RLM_SERVICE_URL` - RLM Python service URL
  - `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` - Rate limiting backend
  - `OPENAI_API_KEY` - OpenAI Whisper, embeddings fallback
  - `TAVILY_API_KEY` - Web search fallback
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Avatar storage
  - `GMAIL_USER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` - Email via Gmail OAuth2
  - `OPIK_API_KEY`, `OPIK_PROJECT_NAME`, `OPIK_WORKSPACE_NAME` - LLM observability
  - `RESEND_API_KEY` - Resend email (deprecated, kept for future use)

## Build & Deployment

**Build:**
- `npm run build` - Next.js production build with TypeScript checking
- `npm run dev` - Local development server on http://localhost:3000

**Testing:**
- `npm run test` - Run Vitest in watch mode
- `npm run test:run` - Single run with coverage
- `npm run test:e2e` - Playwright browser tests

**Linting:**
- `npm run lint` - ESLint with Next.js config

**Deployment:**
- Vercel (automatic on `git push`)
- Max function duration: 60 seconds (for streaming responses)
- Auto-scaling based on traffic

## Platform Requirements

**Development:**
- Node.js 18+
- npm 8+
- Modern browser for testing (Chrome, Firefox, Safari)

**Production:**
- AWS credentials for Bedrock access (multi-region available)
- Supabase project (PostgreSQL backend)
- Upstash Redis (serverless, no infra needed)
- Vercel deployment platform
- Email: Gmail account with OAuth2 app (alternative: Resend)
- Image CDN: Cloudinary account
- Observability: Comet/Opik account (optional)

---

*Stack analysis: 2026-02-11*
