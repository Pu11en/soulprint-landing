# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5.x - Application code, type safety throughout
- JavaScript (ESM) - Configuration files, build scripts

**Secondary:**
- CSS/HTML - Styling via Tailwind CSS, UI markup
- SQL - Supabase PostgreSQL queries and migrations

## Runtime

**Environment:**
- Node.js 20+ (via Next.js)
- Browser: Modern browsers with ES2017+ support

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.5 - React SSR framework, API routes, server actions
- React 19.2.3 - UI component library

**UI Components & Design:**
- @radix-ui/* (v1.2-2.2) - Headless UI components (accordion, dialog, select, slider, tooltip, etc.)
- lucide-react 0.563.0 - Icon library
- Tailwind CSS 3.4.19 - Utility-first styling
- framer-motion 12.29.2 - Animation library
- motion 12.29.2 - Additional motion utilities
- tailwindcss-animate 1.0.7 - Animation presets
- next-themes 0.4.6 - Dark mode support
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Conditional CSS class combining
- tailwind-merge 3.4.0 - Tailwind class merging

**Testing:**
- No testing framework detected in dependencies

**Build/Dev:**
- ESLint 9.x - Code linting (eslint-config-next integration)
- TypeScript compiler - Bundled with Next.js
- PostCSS 8.5.6 - CSS transformation via Tailwind
- Autoprefixer 10.4.23 - CSS vendor prefixing
- sharp 0.34.5 - Image optimization

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.93.1 - PostgreSQL database client with auth, realtime, and storage APIs
- @supabase/ssr 0.8.0 - Supabase-specific server-side rendering helpers
- @aws-sdk/client-bedrock-runtime 3.980.0 - Claude AI model access via AWS Bedrock
- @aws-sdk/client-s3 3.975.0 - S3/R2 object storage
- @aws-sdk/s3-request-presigner 3.975.0 - Signed URL generation for S3/R2
- openai 6.17.0 - OpenAI API client (fallback for embeddings/analysis)

**AI & ML:**
- @tavily/core 0.7.1 - Web search API integration
- googleapis 170.1.0 - Google Gmail API for email
- nodemailer 7.0.13 - Email sending (via Gmail OAuth2)

**Data & Processing:**
- jszip 3.10.1 - ZIP file reading/processing
- zlib - Native gzip compression (embedded in Node.js)

**Web Push:**
- web-push 3.6.7 - Push notification delivery
- use-stick-to-bottom 1.1.2 - UI utility for chat scrolling

**Observability:**
- cloudinary 2.9.0 - Image hosting and optimization (or general media)
- resend 6.9.1 - Email delivery service

## Configuration

**Environment:**
All configuration via `.env.local` (not committed, secrets only):

**Required env vars:**
- `AWS_REGION` - AWS region (us-east-1)
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `BEDROCK_MODEL_ID` - Claude model ID (e.g., `us.anthropic.claude-3-5-haiku-20241022-v1:0`)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-only)
- `OPENAI_API_KEY` - OpenAI API key
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER` - Gmail OAuth
- `TAVILY_API_KEY` - Tavily web search API
- `PERPLEXITY_API_KEY` - Perplexity AI API
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` - Cloudflare R2 storage
- `RLM_SERVICE_URL` - Remote learning/memory service endpoint
- `NEXT_PUBLIC_SITE_URL` - Frontend URL

**Build:**
- `tsconfig.json` - TypeScript configuration
  - Target: ES2017
  - Module resolution: bundler
  - Path alias: `@/*` → project root
  - Strict mode enabled
- `next.config.ts` - Next.js configuration
  - Server action body size limit: 50MB
  - Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
- `eslint.config.mjs` - ESLint configuration (flat config format)
  - Extends: eslint-config-next core-web-vitals and TypeScript
- `tailwind.config.ts` - Tailwind CSS configuration
  - Dark mode via class
  - Custom fonts (Inter, Koulen, Geist, Host Grotesk, Cinzel, JetBrains Mono)
  - CSS variables for theming
- `postcss.config.mjs` - PostCSS configuration (Tailwind + autoprefixer)

## Platform Requirements

**Development:**
- Node.js 20+
- npm/yarn
- .env.local file with all secrets
- AWS account with Bedrock access
- Supabase project
- Cloudflare R2 bucket

**Production:**
- Deployment: Vercel (detected via vercel.json)
- Next.js server runtime (Node.js)
- Environment variables set in Vercel dashboard
- OIDC token for Vercel deployments

---

*Stack analysis: 2026-02-01*
