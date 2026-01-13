# Technology Stack

**Analysis Date:** 2026-01-13

## Languages

**Primary:**
- TypeScript 5.x - All application code (`tsconfig.json`)

**Secondary:**
- JavaScript - Build scripts, config files (`postcss.config.mjs`, `eslint.config.mjs`)
- SQL - Database migrations (`supabase/migrations/*.sql`)

## Runtime

**Environment:**
- Node.js (latest LTS) - Server runtime
- Browser runtime - React 19 client-side rendering

**Package Manager:**
- npm 10.x
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 16.0.7 - Full-stack web framework with App Router (`next.config.ts`)
- React 19.2.0 - UI framework
- Tailwind CSS 3.4.15 - Utility-first CSS framework (`tailwind.config.ts`)

**Testing:**
- Not detected - No test framework configured

**Build/Dev:**
- TypeScript 5.x - Type checking
- ESLint 9.x - Linting (`eslint.config.mjs`)
- PostCSS 8.x - CSS processing (`postcss.config.mjs`)
- autoprefixer 10.x - CSS vendor prefixing

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.84.0 - Database/auth client (`lib/supabase/`)
- `@supabase/ssr` 0.7.0 - Server-side Supabase helpers (`lib/supabase/server.ts`)
- `@google/genai` 1.34.0 - Gemini AI integration (`lib/gemini/`)
- `assemblyai` 4.19.0 - Voice transcription/analysis (`lib/soulprint/assemblyai-analyzer.ts`)
- `framer-motion` 11.11.17 - Animation library

**UI Components:**
- `@radix-ui/*` - Headless UI primitives (dialog, select, slider, accordion)
- `lucide-react` 0.460.0 - Icon library
- `class-variance-authority` 0.7.1 - Component variants
- `clsx` 2.1.1 - Class name utility
- `tailwind-merge` 2.6.0 - Tailwind class merging

**3D/Visualization:**
- `three` 0.181.2 - 3D graphics (`lib/visualizer/`)
- `@react-three/fiber` 9.4.0 - React Three.js wrapper
- `@react-three/drei` 10.7.7 - Three.js helpers
- `meyda` 5.6.3 - Audio feature extraction

**Infrastructure:**
- `nodemailer` 7.0.12 - Email sending (`lib/email.ts`)
- `next-themes` 0.4.6 - Theme management

## Configuration

**Environment:**
- `.env.local` for development secrets (gitignored)
- `.env.example` documents required variables
- Key configs: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `ASSEMBLYAI_API_KEY`

**Build:**
- `tsconfig.json` - TypeScript configuration with path alias `@/*`
- `next.config.ts` - Next.js configuration
- `tailwind.config.ts` - Tailwind with custom colors, fonts, animations
- `postcss.config.mjs` - PostCSS with Tailwind and autoprefixer

## Platform Requirements

**Development:**
- Any platform with Node.js
- No Docker required

**Production:**
- Vercel deployment (optimized for Next.js)
- Supabase for database/auth (managed PostgreSQL)
- External APIs: Google Gemini, AssemblyAI

---

*Stack analysis: 2026-01-13*
*Update after major dependency changes*
