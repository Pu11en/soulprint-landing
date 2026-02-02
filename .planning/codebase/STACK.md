# Technology Stack

**Analysis Date:** 2026-02-01

## Languages

**Primary:**
- TypeScript 5 - All application and API code
- JavaScript - Configuration files (Next.js config, ESLint)
- SQL - Database migrations and Supabase functions

**Secondary:**
- HTML/CSS - Email templates (inlined styles)

## Runtime

**Environment:**
- Node.js (version not pinned, inferred from package-lock.json)

**Package Manager:**
- npm (9.x or higher)
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.1.5 - Full-stack React framework with App Router
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering

**UI Components:**
- Radix UI - Headless component library (accordion, dialog, select, slider, scroll-area, tooltip, etc.)
  - Multiple Radix components v1.x-2.x
- Tailwind CSS 3.4.19 - Utility-first CSS framework
- Tailwind Merge 3.4.0 - Resolve Tailwind conflicts
- Tailwind Animate 1.0.7 - Animation utilities

**Animation:**
- Framer Motion 12.29.2 - React animation library
- Motion 12.29.2 - Motion library (appears to be duplicate/related to Framer)

**Themes & Styling:**
- Next Themes 0.4.6 - Dark mode support
- Class Variance Authority 0.7.1 - CSS class composition

**Icons:**
- Radix UI Icons 1.3.2 - Icon components
- Lucide React 0.563.0 - Icon library

**Utilities:**
- clsx 2.1.1 - Conditional className builder
- Use Stick to Bottom 1.1.2 - Chat scroll behavior

## Testing & Build

**Testing:**
- No dedicated test framework detected in package.json (might be external)

**Build/Dev:**
- ESLint 9 - JavaScript/TypeScript linting
- ESLint Config Next 16.1.5 - Next.js ESLint rules
- TypeScript - Static type checking
- Sharp 0.34.5 - Image optimization (dev dependency for Next.js)
- PostCSS 8.5.6 - CSS transformation
- Autoprefixer 10.4.23 - Browser prefix support

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.93.1 - Supabase database/auth client
- `@supabase/ssr` 0.8.0 - Server-side Supabase session handling
- `@aws-sdk/client-bedrock-runtime` 3.980.0 - AWS Bedrock for Claude LLM
- `@aws-sdk/client-s3` 3.975.0 - AWS S3/Cloudflare R2 file storage
- `@aws-sdk/s3-request-presigner` 3.975.0 - Signed URL generation for S3
- `openai` 6.17.0 - OpenAI API (limited use, RLM preferred)
- `resend` 6.9.1 - Email delivery service
- `nodemailer` 7.0.13 - Gmail OAuth2 email sending
- `jszip` 3.10.1 - ZIP file parsing for ChatGPT exports

**Search & AI:**
- `@tavily/core` 0.7.1 - Tavily web search API
- `googleapis` 170.1.0 - Google APIs (Gemini image generation for avatars)

**Notifications:**
- `web-push` 3.6.7 - Web Push API for notifications

**Image Storage:**
- `cloudinary` 2.9.0 - Image hosting and CDN

**Components & Utils:**
- `next-env.d.ts` - Next.js type definitions
- Type definitions for Node, React, web-push, Nodemailer

## Configuration

**Environment:**
- `.env.local` - Local development environment variables (40+ vars)
- Next.js handles public variables via `NEXT_PUBLIC_` prefix
- Service/private variables stored in `.env.local` (not committed)

**Key Config Files:**
- `next.config.ts` - Next.js configuration (50MB body limit for imports, security headers)
- `tsconfig.json` - TypeScript configuration (strict mode, ES2017 target, path aliases)
- `tailwind.config.ts` - Tailwind CSS customization
- `postcss.config.mjs` - PostCSS configuration (Tailwind processing)
- `eslint.config.mjs` - ESLint configuration (Next.js + TypeScript rules)

**Path Aliases:**
- `@/*` maps to root directory (enables `import from '@/lib'`)

## Platform Requirements

**Development:**
- Node.js with npm
- Modern browser with Web Push API support
- Git

**Production:**
- Deployment: Vercel (Next.js optimized)
- Runtime: Node.js
- Max function duration: 300 seconds (5 minutes) for import processing
- Body size limit: 50MB (for large ChatGPT export files)

**Database:**
- Supabase PostgreSQL with pgvector extension
- PostgreSQL 14+ (pgvector for embeddings)

**External Services Required:**
- Supabase account (database + auth)
- AWS account (Bedrock + S3/R2)
- Cloudinary account (image generation storage)
- Resend API key (transactional email)
- Gmail OAuth2 credentials (alternative email)
- Tavily API key (web search)
- Perplexity API key (real-time search, optional)
- Google Gemini API key (avatar generation)
- RLM Service (internal, running on Render)

---

*Stack analysis: 2026-02-01*
