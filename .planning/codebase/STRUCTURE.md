# Codebase Structure

**Analysis Date:** 2026-01-12

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
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Landing page
├── components/             # Reusable React components
│   ├── auth/               # Auth-related components
│   ├── dashboard/          # Dashboard UI components
│   ├── sections/           # Landing page sections
│   ├── ui/                 # Base UI primitives
│   └── voice-recorder/     # Voice recording components
├── lib/                    # Core business logic
│   ├── supabase/           # Supabase client utilities
│   ├── soulprint/          # SoulPrint generation logic
│   ├── openai/             # OpenAI client and generators
│   ├── gemini/             # Google Gemini client
│   ├── llm/                # Unified LLM client
│   ├── prosody/            # Voice cadence analysis
│   ├── letta/              # Companion personality
│   ├── questions.ts        # Questionnaire questions
│   ├── email.ts            # Email sending
│   ├── streak.ts           # Streak CRM integration
│   └── utils.ts            # Shared utilities
├── public/                 # Static assets
│   └── images/             # Images
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
- Key files: `layout.tsx`, `page.tsx`, `middleware.ts`
- Subdirectories: Route groups and nested routes

**app/actions/:**
- Purpose: Server Actions for mutations
- Contains: `auth.ts`, `gate.ts`, `soulprint-management.ts`, `soulprint-selection.ts`, `chat-history.ts`, `api-keys.ts`, `test-agent.ts`
- Key files: `auth.ts` (signUp, signIn, signOut, signInWithGoogle)

**app/api/:**
- Purpose: API route handlers
- Contains: REST endpoints for external integrations
- Key files: `soulprint/generate/route.ts`, `waitlist/route.ts`, `v1/chat/completions/route.ts`

**app/dashboard/:**
- Purpose: Main authenticated app interface
- Contains: Dashboard pages (chat, profile, settings, reactor)
- Key files: `page.tsx` (redirect logic), `chat/page.tsx`, `welcome/page.tsx`

**app/questionnaire/:**
- Purpose: SoulPrint creation flow
- Contains: Multi-step questionnaire, voice test, completion
- Key files: `new/page.tsx`, `complete/page.tsx`

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
- Contains: `service.ts`, `generator.ts`, `db.ts`, `voice-analyzer.ts`
- Key files: `service.ts` (main orchestrator)

## Key File Locations

**Entry Points:**
- `app/layout.tsx` - Root layout, global providers
- `app/page.tsx` - Landing page
- `middleware.ts` - Auth middleware for protected routes

**Configuration:**
- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.ts` - Next.js configuration
- `.env.local` - Environment variables (gitignored)

**Core Logic:**
- `lib/soulprint/service.ts` - SoulPrint generation orchestration
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/openai/soulprint-generator.ts` - OpenAI generation
- `lib/questions.ts` - Questionnaire questions and categories
- `app/actions/auth.ts` - Authentication actions

**Authentication:**
- `middleware.ts` - Route protection
- `app/actions/auth.ts` - Auth server actions
- `components/auth/login-form.tsx` - Login UI with PIN gate

**Testing:**
- Not detected (no test directory or config)

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
- `index.ts` not commonly used (direct imports preferred)

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

---

*Structure analysis: 2026-01-12*
*Update when directory structure changes*
