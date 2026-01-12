# Technology Stack

**Analysis Date:** 2026-01-12

## Languages

**Primary:**
- TypeScript 5.x - All application code

**Secondary:**
- JavaScript - Config files (next.config.ts, tailwind.config.ts)
- CSS - Global styles and Tailwind

## Runtime

**Environment:**
- Node.js (Next.js 16.0.7)
- React 19.2.0

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.0.7 - Full-stack React framework with App Router
- React 19.2.0 - UI framework

**Testing:**
- Not detected (no test framework configured)

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation
- PostCSS + Autoprefixer - CSS processing
- Tailwind CSS 3.4.15 - Utility-first CSS

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.x - Authentication and database client
- `@supabase/ssr` - Server-side rendering support for Supabase
- `openai` 4.x - GPT-4o for SoulPrint generation
- `@google/generative-ai` - Google Gemini API (alternative LLM)
- `assemblyai` 4.19.0 - Voice transcription

**UI/UX:**
- `framer-motion` - Animations
- `@radix-ui/*` - Headless UI components
- `lucide-react` - Icons
- `tailwind-merge`, `clsx`, `class-variance-authority` - CSS utilities

**Audio Analysis:**
- `meyda` - Audio feature extraction
- `hark` - Speech detection
- `pitchy` - Pitch analysis

**Infrastructure:**
- `nodemailer` - Email sending (Gmail OAuth2)
- `three` + `@react-three/fiber` + `@react-three/drei` - 3D visualizations

## Configuration

**Environment:**
- `.env.local` for secrets (gitignored)
- Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`
- Email: Gmail OAuth2 credentials

**Build:**
- `next.config.ts` - Next.js configuration
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS plugins

## Platform Requirements

**Development:**
- Any platform with Node.js
- No external dependencies (Supabase hosted)

**Production:**
- Vercel - Configured for deployment
- PostgreSQL via Supabase (hosted)
- File storage via Supabase Storage

---

*Stack analysis: 2026-01-12*
*Update after major dependency changes*
