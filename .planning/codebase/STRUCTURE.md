# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
soulprint-landing/
├── app/                          # Next.js App Router pages & API routes
│   ├── page.tsx                  # Landing page (home)
│   ├── layout.tsx                # Root layout with providers
│   ├── login/                    # Login page
│   ├── signup/                   # Signup page
│   ├── enter/                    # Entry redirect logic
│   ├── dashboard/                # Post-auth home/onboarding
│   ├── import/                   # Import wizard (ZIP upload)
│   ├── chat/                     # Chat interface
│   ├── memory/                   # Memory management page (future)
│   ├── chat-demo/                # Demo chat (unauthenticated)
│   ├── api/
│   │   ├── auth/                 # Auth callbacks, signout
│   │   ├── chat/                 # Chat message processing
│   │   │   └── route.ts          # POST /api/chat (main chat handler)
│   │   ├── import/               # Import orchestration
│   │   │   ├── queue-processing/ # Queues import job
│   │   │   ├── process-server/   # Server-side file processing
│   │   │   └── complete/         # Completion notification
│   │   ├── memory/               # Memory/chunk operations
│   │   │   ├── status/           # GET import progress
│   │   │   ├── query/            # Query memory API
│   │   │   ├── synthesize/       # Generate summary from chunks
│   │   │   └── delete/           # Delete memory
│   │   ├── profile/              # User profile customization
│   │   │   ├── ai-name/          # AI assistant naming
│   │   │   └── ai-avatar/        # AI avatar generation
│   │   ├── admin/                # Admin-only operations
│   │   │   ├── health/           # Service health checks
│   │   │   ├── metrics/          # Usage metrics
│   │   │   ├── reset-user/       # Delete user data
│   │   │   └── migrate/          # Data migrations
│   │   ├── gamification/         # Achievement tracking
│   │   ├── voice/                # Voice enrollment/verification
│   │   └── cron/                 # Scheduled tasks
│   ├── globals.css               # Tailwind + app styles
│   └── actions/                  # Server actions (if used)
│
├── lib/                          # Reusable libraries & utilities
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client
│   │   └── middleware.ts         # Auth middleware
│   ├── memory/
│   │   ├── query.ts              # Embedding queries, context retrieval
│   │   ├── learning.ts           # Extract & store facts from chat
│   │   └── facts.ts              # Fact extraction helpers
│   ├── search/
│   │   ├── smart-search.ts       # Web/memory search dispatcher
│   │   ├── tavily.ts             # Tavily API wrapper
│   │   └── perplexity.ts         # Perplexity API wrapper
│   ├── email/
│   │   ├── send.ts               # Resend email notifications
│   │   └── templates/            # Email template strings
│   ├── gamification/
│   │   └── xp.ts                 # XP calculation, achievements
│   ├── versioning/
│   │   └── branch-manager.ts     # Version tracking (future)
│   ├── email.ts                  # Email configuration
│   ├── utils.ts                  # Utility functions (cn, etc.)
│   └── ARCHITECTURE.md           # Old/reference architecture doc
│
├── components/                   # React components (organization by type)
│   ├── ui/                       # Reusable UI primitives
│   │   ├── button.tsx            # Button component
│   │   ├── card.tsx              # Card layout
│   │   ├── dialog.tsx            # Modal dialog
│   │   ├── input.tsx             # Text input
│   │   ├── avatar.tsx            # Avatar display
│   │   ├── ring-progress.tsx     # Circular progress indicator
│   │   ├── background-beams.tsx  # Animated background
│   │   ├── spotlight.tsx         # Spotlight effect
│   │   ├── AddToHomeScreen.tsx   # iOS A2HS prompt
│   │   ├── theme-toggle.tsx      # Dark/light mode switch
│   │   ├── accordion.tsx         # Accordion (Radix UI)
│   │   ├── select.tsx            # Dropdown select
│   │   └── ruixen-bento-cards.tsx # Bento grid layout
│   │
│   ├── chat/                     # Chat-specific components
│   │   ├── telegram-chat-v2.tsx  # Main chat UI (mobile-first)
│   │   ├── ChatMessage.tsx       # Single message bubble
│   │   ├── ChatInput.tsx         # Input field + voice
│   │   └── message-content.tsx   # Rich message rendering
│   │
│   ├── sections/                 # Page sections (landing)
│   │   ├── hero.tsx              # Hero section
│   │   ├── feature-blog-section.tsx # Features
│   │   ├── memory-section.tsx    # Memory demonstration
│   │   ├── faq-section.tsx       # FAQ accordion
│   │   ├── footer.tsx            # Footer
│   │   └── navbar.tsx            # Navigation
│   │
│   ├── auth/                     # Authentication components
│   │   ├── login-form.tsx        # Login form
│   │   ├── signup-modal.tsx      # Signup form
│   │   └── security-access-modal.tsx # Access code entry
│   │
│   ├── AchievementToast.tsx      # Achievement notification provider
│   ├── HalftoneBackground.tsx    # Halftone pattern background
│   └── Navbar.tsx                # App navbar
│
├── .planning/
│   └── codebase/                 # GSD codebase analysis documents
│       ├── ARCHITECTURE.md       # (this file's subject)
│       ├── STRUCTURE.md          # (this file)
│       ├── STACK.md              # Technology stack
│       ├── INTEGRATIONS.md       # External services
│       ├── CONVENTIONS.md        # Code style
│       ├── TESTING.md            # Testing patterns
│       └── CONCERNS.md           # Tech debt & issues
│
├── public/                       # Static assets
│   ├── logo.svg                  # SoulPrint logo
│   ├── manifest.json             # PWA manifest
│   └── icons/                    # Favicon, app icons
│
├── package.json                  # Node dependencies
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.ts            # Tailwind CSS config
├── next.config.ts                # Next.js configuration
└── CLAUDE.md                     # Project context & requirements
```

## Directory Purposes

**app/:**
Purpose: Next.js App Router pages and API routes (the entire application structure)
Contains: Page files (.tsx), route handlers (route.ts), layouts
Key pattern: File-based routing (e.g., `app/chat/page.tsx` → `/chat`, `app/api/chat/route.ts` → `/api/chat`)

**app/api/:**
Purpose: Server-side REST API endpoints
Contains: POST/GET handlers for chat, import, memory, profile, admin, gamification, voice
Pattern: Organized by feature domain (chat/, import/, memory/)

**lib/:**
Purpose: Reusable, non-React utilities and business logic
Contains: Supabase clients, external API wrappers, memory/search helpers, email templates
Usage: Imported by both API routes and components
Pattern: Organized by concern (supabase/, memory/, search/, email/)

**lib/supabase/:**
Purpose: Database and auth abstraction
Files:
- `client.ts` - Browser client (SSR-compatible, cookie-based sessions)
- `server.ts` - Server client (async cookie handling, service role access)
- `middleware.ts` - Auth middleware for protected routes

**lib/memory/:**
Purpose: Memory/knowledge management
Files:
- `query.ts` - Embedding queries using Bedrock Cohere embeddings
- `learning.ts` - Extract facts from chat and store in DB
- `facts.ts` - Fact-related helpers

**lib/search/:**
Purpose: Web search integration (Tavily, Perplexity)
Files:
- `smart-search.ts` - Dispatcher that picks search engine based on query
- `tavily.ts` - Tavily API client
- `perplexity.ts` - Perplexity API client

**lib/email/:**
Purpose: Email sending and templates
Files:
- `send.ts` - Resend SDK integration, email dispatch
- Template strings for notifications (import complete, etc.)

**components/:**
Purpose: React components (presentational and container)
Organization:
- `ui/` - Reusable primitives (Button, Card, Input, etc.) - mostly Radix UI
- `chat/` - Chat-specific UI (message bubbles, input, telegram-style layout)
- `sections/` - Landing page sections
- `auth/` - Login, signup forms
- Root: Provider components, layout wrappers

**components/chat/:**
Purpose: All chat interface components
Key files:
- `telegram-chat-v2.tsx` - Main chat container (layout, message list, input)
- `ChatMessage.tsx` - Single message bubble with swipe actions
- `ChatInput.tsx` - Text input + voice button
- `message-content.tsx` - Rich content rendering for messages

**components/ui/:**
Purpose: Reusable UI components
Pattern: Mostly Radix UI wrapped with Tailwind styling
Examples: Button, Card, Dialog, Input, Avatar, etc.
Special: `ring-progress.tsx` (custom circular progress), `background-beams.tsx` (animated background)

**public/:**
Purpose: Static assets served by Next.js
Contains: Logo, favicon, PWA manifest, icons

**.planning/codebase/:**
Purpose: GSD analysis documents
Contains: ARCHITECTURE.md, STRUCTURE.md, STACK.md, INTEGRATIONS.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

## Key File Locations

**Entry Points:**
- `app/page.tsx` - Landing/home (checks auth, redirects logged-in users to dashboard)
- `app/layout.tsx` - Root HTML layout, providers (AchievementToastProvider), fonts
- `app/chat/page.tsx` - Chat interface (queries memory status, renders TelegramChatV2)
- `app/import/page.tsx` - Import wizard (upload ZIP, track progress, show completion)

**Configuration:**
- `package.json` - Dependencies (Next.js, React, Supabase, AWS SDK, Radix UI, Tailwind, Framer Motion)
- `tsconfig.json` - TypeScript paths (e.g., `@/*` → `./`)
- `next.config.ts` - Next.js config (image optimization, redirects)
- `tailwind.config.ts` - Tailwind CSS theme (colors, spacing)

**Core Logic:**
- `app/api/chat/route.ts` - Chat message handler (context retrieval, RLM call, streaming response)
- `app/api/import/process-server/route.ts` - File parsing, soulprint generation via RLM
- `lib/memory/query.ts` - Embedding queries using Bedrock
- `lib/search/smart-search.ts` - Web search dispatcher

**Testing:**
- No test files in current structure (tests would go in `__tests__/` or `.test.ts` alongside source)

## Naming Conventions

**Files:**
- Page files: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase (e.g., `ChatMessage.tsx`, `TelegramChatV2.tsx`)
- Utilities: camelCase (e.g., `smart-search.ts`, `ring-progress.tsx`)
- Styles: Global CSS in `app/globals.css`, inline Tailwind in components

**Directories:**
- Feature domains: kebab-case (e.g., `chat/`, `import/`, `memory/`)
- Component types: lowercase plural (e.g., `sections/`, `ui/`, `auth/`)

**Components:**
- Functional components with PascalCase names
- Props interfaces: `<ComponentName>Props` (e.g., `TelegramChatV2Props`)
- Internal helpers: camelCase functions
- State hooks: `const [variable, setVariable] = useState(...)`

**API Routes:**
- Named exports for HTTP methods: `export async function POST(request)`, `export async function GET()`
- Error responses: `NextResponse.json({ error: string }, { status: number })`
- Success responses: `NextResponse.json({ success: true, data: any })`

**Database:**
- Table names: snake_case (e.g., `user_profiles`, `conversation_chunks`)
- Column names: snake_case (e.g., `user_id`, `import_status`, `soulprint_text`)

**Environment Variables:**
- Uppercase with underscores (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- `NEXT_PUBLIC_*` prefix for browser-accessible vars

## Where to Add New Code

**New Chat Feature:**
- Component: `components/chat/[feature-name].tsx`
- Handler: `app/api/chat/[sub-route]/route.ts` (if new endpoint needed)
- Library: `lib/chat/[helper-name].ts` (for shared logic)
- Page updates: Integrate into `app/chat/page.tsx`

**New API Endpoint:**
- Create: `app/api/[feature]/[action]/route.ts`
- Supabase queries: Add to `lib/supabase/` if reusable, else inline in route
- Auth check: Use `supabase.auth.getUser()` at route start
- Error handling: Wrap in try-catch, return JSON with error status

**New UI Component:**
- Primitive: `components/ui/[component-name].tsx` (reusable across app)
- Feature-specific: `components/[feature]/[component-name].tsx` (used in one feature)
- Styles: Use Tailwind classes (no external CSS files)

**New Library/Utility:**
- Service integration: `lib/[service]/[method-name].ts` (e.g., `lib/search/tavily.ts`)
- Shared logic: `lib/[concern]/[module-name].ts` (e.g., `lib/memory/query.ts`)
- Re-export public API from module file (e.g., `export { embedQuery } from './embed.ts'`)

**Database Schema Changes:**
- Supabase Tables are pre-created (don't create in code)
- New columns: Use Supabase dashboard, then update Supabase client types
- Migrations: Document in CONCERNS.md if manual intervention needed

## Special Directories

**app/api/admin/:**
Purpose: Admin-only operations (health checks, metrics, user reset, data migrations)
Generated: No
Committed: Yes (contains sensitive logic, but protected by auth checks)

**public/:**
Purpose: Static assets served directly by Next.js
Generated: No
Committed: Yes

**.next/:**
Purpose: Build output and cache (Next.js internal)
Generated: Yes (created during `npm run build`)
Committed: No (in .gitignore)

**node_modules/:**
Purpose: Installed dependencies
Generated: Yes (from package.json)
Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-01*
