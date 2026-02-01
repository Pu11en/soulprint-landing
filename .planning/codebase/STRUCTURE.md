# Codebase Structure

**Analysis Date:** 2026-02-01

## Directory Layout

```
soulprint-landing/
├── app/                           # Next.js App Router (pages, API routes, layouts)
│   ├── layout.tsx                 # Root layout with theme/font setup
│   ├── page.tsx                   # Home page (landing + auth)
│   ├── globals.css                # Global styles (Tailwind)
│   ├── api/                       # Route handlers (HTTP endpoints)
│   │   ├── auth/                  # Auth endpoints
│   │   ├── chat/                  # Chat functionality
│   │   ├── import/                # Import/upload processing
│   │   ├── embeddings/            # Embedding generation
│   │   ├── memory/                # Memory retrieval and management
│   │   ├── profile/               # User profile (AI name, avatar)
│   │   ├── gamification/          # Achievements and XP
│   │   ├── admin/                 # Admin utilities (health, migration, reset)
│   │   ├── cron/                  # Scheduled tasks
│   │   └── ...                    # Other specialized endpoints
│   ├── chat/                      # Chat page
│   ├── import/                    # Import page (file upload flow)
│   ├── dashboard/                 # User dashboard (not actively used)
│   ├── memory/                    # Memory management page
│   ├── achievements/              # Achievements page
│   ├── admin/                     # Admin panel
│   ├── login/                     # Login redirect (auth on home)
│   ├── signup/                    # Signup redirect (auth on home)
│   ├── test/                      # Test pages (chat variants, upload testing)
│   └── actions/                   # Server actions (email, referral)
│
├── components/                    # React components (reusable UI)
│   ├── ui/                        # Base UI components (Radix UI + custom)
│   │   ├── button.tsx             # Button component
│   │   ├── card.tsx               # Card component
│   │   ├── dialog.tsx             # Modal dialog
│   │   ├── accordion.tsx          # Accordion
│   │   ├── ai-chat-input.tsx      # AI chat input field
│   │   ├── ai-chat-card.tsx       # Chat message card
│   │   ├── ring-progress.tsx      # Circular progress indicator
│   │   ├── AddToHomeScreen.tsx    # iOS PWA prompt
│   │   ├── theme-toggle.tsx       # Dark/light mode toggle
│   │   └── ...                    # ~60 UI components (mostly Radix-based)
│   │
│   ├── chat/                      # Chat-specific components
│   │   ├── telegram-chat-v2.tsx   # Main chat UI (Telegram-like style)
│   │   ├── ChatInput.tsx          # Chat message input
│   │   ├── ChatMessage.tsx        # Message display
│   │   ├── message-content.tsx    # Message content rendering
│   │   ├── BackgroundSync.tsx     # Background import sync
│   │   └── telegram-chat.tsx      # Old chat UI variant
│   │
│   ├── sections/                  # Landing page sections
│   │   ├── hero.tsx               # Hero banner
│   │   ├── features.tsx           # Features section
│   │   ├── memory-section.tsx     # Memory highlight
│   │   ├── pricing.tsx            # Pricing table
│   │   ├── faq-section.tsx        # FAQ
│   │   ├── footer.tsx             # Footer
│   │   └── ...                    # ~10 landing sections
│   │
│   ├── auth/                      # Auth components
│   │   ├── login-form.tsx         # Login form
│   │   ├── signup-modal.tsx       # Signup modal
│   │   └── security-access-modal.tsx
│   │
│   ├── auth-modal.tsx             # Main auth modal (home page)
│   ├── Navbar.tsx                 # Navigation bar
│   ├── AchievementToast.tsx       # Toast notifications
│   └── ...                        # ~5-10 other top-level components
│
├── lib/                           # Business logic and utilities
│   ├── supabase/                  # Supabase client/server setup
│   │   ├── client.ts              # Browser Supabase client
│   │   ├── server.ts              # Server Supabase client
│   │   └── middleware.ts          # Auth middleware
│   │
│   ├── import/                    # Import pipeline (core logic)
│   │   ├── parser.ts              # Parse ChatGPT JSON
│   │   ├── chunker.ts             # Split conversations into chunks
│   │   ├── soulprint.ts           # Generate personality profile
│   │   ├── embedder.ts            # Create embeddings (Bedrock Cohere)
│   │   ├── personality-analysis.ts # Analyze communication style
│   │   └── client-soulprint.ts    # Client-side soulprint generation
│   │
│   ├── memory/                    # Memory/fact extraction
│   │   ├── query.ts               # Semantic search + retrieval
│   │   ├── facts.ts               # Fact extraction logic
│   │   ├── learning.ts            # Learn from new conversations
│   │   └── synthesize.ts          # Combine facts for context
│   │
│   ├── search/                    # Web search integrations
│   │   ├── perplexity.ts          # Perplexity API client
│   │   └── tavily.ts              # Tavily API client
│   │
│   ├── gamification/              # Achievements and rewards
│   │   └── xp.ts                  # XP calculation
│   │
│   ├── email/                     # Email sending
│   │   ├── send.ts                # Email service (Resend/Nodemailer)
│   │   └── email.ts               # Email template builder
│   │
│   ├── versioning/                # Version management
│   │   └── branch-manager.ts      # Branch/deployment tracking
│   │
│   └── utils.ts                   # Utility functions (cn, classname helpers)
│
├── public/                        # Static assets
│   ├── logo.svg                   # App logo
│   ├── favicon.ico                # Favicon
│   └── manifest.json              # PWA manifest
│
├── supabase/                      # Supabase configuration
│   └── migrations/                # Database migrations
│
├── scripts/                       # Utility scripts
│   └── enable-bedrock.sh          # AWS Bedrock setup
│
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.ts             # Tailwind CSS config
├── next.config.mjs                # Next.js configuration
├── .eslintrc.json                 # ESLint config
├── .env.example                   # Environment variables template
└── .env.local                     # Secrets (not committed)
```

## Directory Purposes

**`app/` - Next.js App Router:**
- Purpose: Pages, layouts, API routes using Next.js 16 App Router
- Contains: Page components (`.tsx`), route handlers (`.ts`), server components/actions
- Structure follows file-based routing: `app/chat/page.tsx` → `/chat` route
- API routes: `app/api/*/route.ts` → `/api/*` endpoints

**`components/` - React Components:**
- Purpose: Reusable UI components and feature-specific components
- Organized by type: `ui/` (primitives), `chat/` (chat UI), `sections/` (landing), `auth/` (auth)
- Most use Radix UI as headless component base
- Styled with Tailwind CSS inline classes

**`lib/` - Business Logic:**
- Purpose: Core services, data processing, external integrations
- No dependencies on React; pure Node.js/JavaScript
- Used by API routes and client-side components
- Each subdirectory handles a feature domain: import, memory, search, email

**`public/` - Static Assets:**
- Purpose: Serve static files (logos, favicons, PWA manifest)
- Accessed via root-relative paths: `/logo.svg`, `/manifest.json`

**`supabase/` - Database:**
- Purpose: Store migrations, configuration, schema
- `migrations/` contains SQL files for schema setup
- Tables managed here: users, profiles, conversations, embeddings, memories

**`scripts/` - Automation:**
- Purpose: One-off utilities for setup, testing, deployment
- Example: `enable-bedrock.sh` sets up AWS Bedrock credentials

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root layout, applies global fonts/providers
- `app/page.tsx`: Home page (authenticated check + landing/auth)
- `app/chat/page.tsx`: Main chat interface (authenticated)
- `app/import/page.tsx`: Data import flow (unauthenticated redirects here)

**Configuration:**
- `package.json`: Dependencies, build scripts, version
- `tsconfig.json`: TypeScript compiler options
- `tailwind.config.ts`: Tailwind CSS theme and plugins
- `next.config.mjs`: Next.js build/runtime options

**Core Logic:**
- `lib/import/soulprint.ts`: Personality profile generation
- `lib/import/embedder.ts`: Vector embedding creation (Bedrock)
- `lib/memory/query.ts`: Semantic search for user memories
- `app/api/chat/route.ts`: Main chat endpoint (LLM + search integration)
- `app/api/import/queue-processing/route.ts`: Import orchestration

**Testing:**
- `app/api/debug/test-import/route.ts`: Test import processing
- `app/test/page.tsx`: Chat UI test page
- `app/test-upload/page.tsx`: File upload test

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Components: PascalCase (e.g., `ChatInput.tsx`, `HeroSection.tsx`)
- Utilities: camelCase (e.g., `chunker.ts`, `parser.ts`)
- Styles: Inline Tailwind or camelCase class names (e.g., `bg-slate-900`, `rounded-lg`)

**Directories:**
- Feature directories: lowercase (e.g., `import/`, `memory/`, `chat/`)
- UI component directory: `ui/` (centralized Radix-based components)
- Section components: `sections/` (landing page areas)
- Feature-specific components: matching feature name (e.g., `chat/` for chat, `auth/` for auth)

**Variables/Functions:**
- camelCase for variables, functions, methods
- PascalCase for components, types, interfaces, classes
- SCREAMING_SNAKE_CASE for constants (e.g., `EMBEDDING_BATCH_SIZE`, `DB_NAME`)

**Types/Interfaces:**
- Prefixed with I or suffixed with Type for clarity (not enforced, convention)
- Examples: `ChatMessage`, `ParsedConversation`, `LLMExtraction`, `EmbeddedChunk`
- Exported from function files or dedicated `.d.ts` files

## Where to Add New Code

**New Feature Endpoint:**
- Primary code: `app/api/feature-name/route.ts`
- Business logic: `lib/feature-name/` directory with modules
- Tests: Co-locate with logic in `lib/feature-name/*.test.ts` (if tests exist)
- Example: Adding notifications → `app/api/notifications/route.ts` + `lib/notifications/send.ts`

**New UI Component:**
- If reusable primitive: `components/ui/component-name.tsx`
- If feature-specific: `components/feature-name/component-name.tsx`
- Style with Tailwind inline classes
- Export from component file; optionally add to barrel file if in `components/ui/`

**New Landing Page Section:**
- Location: `components/sections/new-section.tsx`
- Import in `app/page.tsx` to add to landing
- Name consistently: `*-section.tsx` suffix

**New Feature Page:**
- Location: `app/feature-name/page.tsx`
- Create `app/feature-name/` directory for route
- If complex, create `app/feature-name/layout.tsx` for nested layouts
- Wrap with auth check using Supabase client: `createClient().auth.getSession()`

**Utilities/Helpers:**
- Shared helpers: `lib/utils.ts` (e.g., `cn()` classname merger)
- Domain-specific utilities: `lib/feature-name/utility.ts`
- Type definitions: Inline in same file or `lib/types.ts` if global

**Database Queries:**
- Migration files: `supabase/migrations/[timestamp]_description.sql`
- Query logic: `lib/` modules with Supabase client calls
- Don't create separate DAL layer; queries inline in service functions

## Special Directories

**`app/api/`:**
- Purpose: HTTP route handlers (REST API)
- Generated: No (source files)
- Committed: Yes
- Pattern: Each folder has a `route.ts` file exporting `GET`, `POST`, `PUT`, `DELETE`
- Auth: Check `session` in handler, return 401 if unauthorized

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes (created by `npm run build`)
- Committed: No (.gitignored)
- Contains: Compiled JavaScript, server functions, static exports

**`node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (.gitignored)
- Lock file: `package-lock.json` (committed for reproducibility)

**`public/`:**
- Purpose: Static assets served at root
- Generated: No (source files)
- Committed: Yes
- Access: `/filename` in HTML/CSS/code

**`supabase/migrations/`:**
- Purpose: Database schema migrations
- Generated: No (manually created)
- Committed: Yes (essential for schema)
- Pattern: `[timestamp]_description.sql` files executed in order

**`.env.local`:**
- Purpose: Environment variables (development)
- Generated: No (manually created)
- Committed: No (.gitignored for secrets)
- Required vars: See `.env.example` or docs

---

*Structure analysis: 2026-02-01*
