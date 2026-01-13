# Codebase Structure

**Analysis Date:** 2026-01-13

## Directory Layout

```
Soulprint-roughdraft/
├── app/                    # Next.js App Router pages and routes
│   ├── (marketing)/        # Marketing pages layout group
│   ├── actions/            # Server Actions
│   ├── api/                # API routes
│   ├── auth/               # Auth callback handlers
│   ├── dashboard/          # Main app dashboard pages
│   ├── enter/              # Gate/access control page
│   ├── login/              # Login page
│   ├── questionnaire/      # SoulPrint questionnaire flow
│   ├── signup/             # Signup page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/             # Reusable React components
│   ├── auth/               # Auth-related components
│   ├── dashboard/          # Dashboard UI components
│   ├── providers/          # Context providers
│   ├── sections/           # Landing page sections
│   ├── ui/                 # Base UI primitives (Radix-based)
│   ├── visualizer/         # 3D visualizer components
│   └── voice-recorder/     # Voice recording components
├── lib/                    # Core business logic
│   ├── gemini/             # Google Gemini client
│   ├── letta/              # Companion personality
│   ├── llm/                # Unified LLM client
│   ├── openai/             # OpenAI client and generators
│   ├── prosody/            # Voice cadence analysis
│   ├── soulprint/          # SoulPrint generation logic
│   ├── supabase/           # Supabase client utilities
│   ├── visualizer/         # 3D visualization logic
│   ├── email.ts            # Email sending
│   ├── env.ts              # Environment validation
│   ├── questions.ts        # Questionnaire questions
│   ├── streak.ts           # Streak CRM integration
│   └── utils.ts            # Shared utilities
├── public/                 # Static assets
├── scripts/                # Utility scripts
├── supabase/               # Database configuration
│   ├── migrations/         # SQL migrations
│   └── schema.sql          # Full schema
├── backend/                # Backend utilities (if used)
├── middleware.ts           # Auth middleware
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── tailwind.config.ts      # Tailwind CSS config
├── next.config.ts          # Next.js config
└── postcss.config.mjs      # PostCSS config
```

## Directory Purposes

**app/:**
- Purpose: Next.js App Router - pages, layouts, routes
- Contains: Page components, route handlers, server actions
- Key files: `layout.tsx`, `page.tsx`
- Subdirectories: Route groups and nested routes

**app/actions/:**
- Purpose: Server Actions for mutations
- Contains: `auth.ts`, `gate.ts`, `soulprint-management.ts`, `soulprint-selection.ts`, `chat-history.ts`, `api-keys.ts`, `test-agent.ts`
- Key files: `auth.ts` (signUp, signIn, signOut, signInWithGoogle)

**app/api/:**
- Purpose: API route handlers
- Contains: REST endpoints for external integrations
- Key files: `soulprint/generate/route.ts`, `voice/analyze/route.ts`, `v1/chat/completions/route.ts`, `gemini/chat/route.ts`

**app/dashboard/:**
- Purpose: Main authenticated app interface
- Contains: Dashboard pages (chat, profile, settings, reactor, bot, pricing, welcome)
- Key files: `page.tsx` (redirect logic), `chat/page.tsx`, `welcome/page.tsx`

**app/questionnaire/:**
- Purpose: SoulPrint creation flow
- Contains: Multi-step questionnaire, voice test, completion
- Key files: `new/page.tsx`, `complete/page.tsx`, `intro/page.tsx`, `voice-test/page.tsx`

**components/:**
- Purpose: Reusable UI components
- Contains: Auth forms, dashboard UI, landing sections
- Key files: `auth/login-form.tsx`, `dashboard/sidebar.tsx`, `sections/hero.tsx`

**lib/:**
- Purpose: Core business logic and utilities
- Contains: Service modules, API clients, helpers
- Key files: `soulprint/service.ts`, `supabase/server.ts`, `questions.ts`

**lib/supabase/:**
- Purpose: Supabase client factories
- Contains: `server.ts`, `client.ts`, `middleware.ts`
- Key files: `server.ts` (createClient for server components)

**lib/soulprint/:**
- Purpose: SoulPrint generation logic
- Contains: `service.ts`, `generator.ts`, `db.ts`, `voice-analyzer.ts`, `assemblyai-analyzer.ts`
- Key files: `service.ts` (main orchestrator)

**lib/gemini/:**
- Purpose: Google Gemini AI integration
- Contains: `client.ts`, `soulprint-generator.ts`, `file-search.ts`, `types.ts`
- Key files: `client.ts` (singleton client)

**supabase/:**
- Purpose: Database schema and migrations
- Contains: SQL files for schema management
- Key files: `schema.sql`, `migrations/*.sql`

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout, global providers, fonts
- `app/page.tsx` - Landing page
- `middleware.ts` - Auth middleware for protected routes

**Configuration:**
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript configuration with `@/*` alias
- `tailwind.config.ts` - Tailwind CSS with custom theme
- `next.config.ts` - Next.js configuration
- `.env.local` - Environment variables (gitignored)

**Core Logic:**
- `lib/soulprint/service.ts` - SoulPrint generation orchestration
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/gemini/client.ts` - Gemini AI client singleton
- `lib/questions.ts` - Questionnaire questions and categories
- `app/actions/auth.ts` - Authentication actions

**Authentication:**
- `middleware.ts` - Route protection
- `app/actions/auth.ts` - Auth server actions
- `lib/supabase/middleware.ts` - Session management

## Naming Conventions

**Files:**
- kebab-case for all files (`login-form.tsx`, `voice-analyzer.ts`)
- `page.tsx` for route pages (Next.js convention)
- `route.ts` for API routes (Next.js convention)
- `layout.tsx` for layouts (Next.js convention)

**Directories:**
- kebab-case for all directories
- Route groups with parentheses `(marketing)`
- Dynamic routes with brackets `[id]`

**Special Patterns:**
- `*.ts` for TypeScript modules
- `*.tsx` for React components
- `index.ts` for barrel exports in some libs

## Where to Add New Code

**New Page:**
- Implementation: `app/{route}/page.tsx`
- Layout: `app/{route}/layout.tsx` (if needed)

**New API Endpoint:**
- Implementation: `app/api/{endpoint}/route.ts`
- Use `GET`, `POST`, etc. exports

**New Server Action:**
- Implementation: `app/actions/{name}.ts`
- Add `"use server"` directive

**New Component:**
- UI primitives: `components/ui/{name}.tsx`
- Feature components: `components/{feature}/{name}.tsx`
- Dashboard: `components/dashboard/{name}.tsx`

**New Service/Logic:**
- Business logic: `lib/{domain}/{name}.ts`
- Utilities: `lib/utils.ts` or `lib/{domain}/utils.ts`

## Special Directories

**public/**
- Purpose: Static assets served at root
- Source: Manual placement
- Committed: Yes

**node_modules/**
- Purpose: npm dependencies
- Source: `npm install`
- Committed: No (gitignored)

**.next/**
- Purpose: Next.js build output
- Source: `npm run build`
- Committed: No (gitignored)

**supabase/migrations/**
- Purpose: Database migration history
- Source: Manual SQL files
- Committed: Yes

---

*Structure analysis: 2026-01-13*
*Update when directory structure changes*
