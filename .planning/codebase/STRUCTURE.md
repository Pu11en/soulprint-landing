# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
soulprint-landing/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── api/                # 42 API route handlers
│   │   ├── admin/          # Admin-only endpoints (health, metrics, migrate, reset-user, etc.)
│   │   ├── auth/           # Auth flows (callback, signout)
│   │   ├── chat/           # Chat endpoints (messages, streaming)
│   │   ├── cron/           # Background jobs (daily-trends, quality-refinement)
│   │   ├── import/         # Import pipeline (trigger, complete, retry-full-pass)
│   │   ├── memory/         # Memory retrieval (query, facts, synthesis)
│   │   ├── profile/        # User profile (ai-name, ai-avatar)
│   │   ├── conversations/  # Conversation CRUD
│   │   └── ...             # Other feature routes
│   ├── actions/            # Next.js server actions (auth.ts, referral.ts)
│   ├── chat/               # Chat page (main UI, client component)
│   ├── import/             # Import page (upload flow, client component)
│   ├── dashboard/          # User dashboard
│   ├── [auth routes]/      # login/, signup/, auth/callback/
│   ├── layout.tsx          # Root layout (fonts, theme, metadata)
│   ├── page.tsx            # Homepage (marketing, auth check)
│   ├── template.tsx        # Page transition wrapper
│   └── globals.css         # Global styles
│
├── components/             # Reusable React components
│   ├── chat/               # Chat-specific UI (message, input, sidebar, telegram-chat-v2)
│   ├── import/             # Import UI (animated-progress-stages)
│   ├── auth/               # Auth components (login, signup modals)
│   ├── ui/                 # Shadcn UI components (button, dialog, tooltip, etc.)
│   ├── sections/           # Page sections (hero, faq, feature-blog, memory-section)
│   ├── theme/              # Theme provider (dark/light mode)
│   └── chat-variants/      # Legacy chat component variants
│
├── lib/                    # Shared business logic and utilities
│   ├── api/                # API layer utilities
│   │   ├── schemas.ts      # Zod validation schemas
│   │   ├── error-handler.ts # Standardized error responses
│   │   └── ttl-cache.ts    # In-memory TTL cache
│   ├── memory/             # Memory retrieval system
│   │   ├── query.ts        # Vector search, hierarchical layer filtering
│   │   ├── facts.ts        # Fact extraction from chunks
│   │   └── learning.ts     # Fact learning from conversations
│   ├── search/             # Search integrations
│   │   ├── smart-search.ts # Search classifier + orchestrator
│   │   ├── perplexity.ts   # Perplexity API (primary)
│   │   ├── tavily.ts       # Tavily API (backup)
│   │   ├── google-trends.ts # Google Trends integration
│   │   ├── citation-validator.ts # Citation validation
│   │   └── search-classifier.ts # Query classification
│   ├── import/             # Import pipeline (deprecated - RLM now handles)
│   │   └── progress-mapper.ts # Map RLM progress to UI
│   ├── soulprint/          # User personality profile
│   │   ├── personality-analysis.ts # Deep profile extraction
│   │   └── quick-pass.ts   # Fast client-side analysis (deprecated)
│   ├── evaluation/         # LLM evaluation framework
│   │   ├── datasets.ts     # Test data generation
│   │   ├── judges.ts       # Quality judges (memory, relevance, etc.)
│   │   └── statistical-validation.ts # Statistical testing
│   ├── supabase/           # Database clients
│   │   ├── client.ts       # Browser client
│   │   ├── server.ts       # SSR client
│   │   └── middleware.ts   # Token refresh middleware
│   ├── email/              # Email service
│   │   └── send.ts         # Resend integration
│   ├── logger/             # Structured logging
│   │   └── index.ts        # Pino logger factory
│   ├── rlm/                # RLM service client
│   │   └── health.ts       # RLM health checks
│   ├── rate-limit.ts       # Upstash rate limiting (3 tiers)
│   ├── csrf.ts             # CSRF token management
│   ├── bedrock.ts          # AWS Bedrock client
│   ├── tus-upload.ts       # TUS protocol resumable upload
│   ├── retry.ts            # Retry with exponential backoff
│   ├── opik.ts             # Opik observability integration
│   └── utils.ts            # Tailwind merge utility
│
├── rlm-service/            # Python FastAPI microservice (separate repo, included here)
│   ├── main.py             # FastAPI app with /query and /import-full endpoints
│   ├── processors/         # Data processing pipeline
│   │   ├── conversation_chunker.py  # 5-tier hierarchical chunking
│   │   ├── embedding_generator.py   # Titan Embed v2 (768-dim) via Bedrock
│   │   ├── dag_parser.py            # Parse ChatGPT conversation tree
│   │   ├── full_pass.py             # Complete import processing
│   │   ├── quick_pass.py            # Fast soulprint generation (deprecated)
│   │   ├── memory_generator.py      # Synthesize context for chat
│   │   └── ...                      # Other processors
│   ├── prompt_builder.py   # Prompt templating system
│   └── requirements.txt    # Python dependencies
│
├── public/                 # Static assets
│   ├── icons/              # Icon files
│   ├── images/             # Image files
│   └── splash/             # App splash screens
│
├── supabase/               # Database migrations
│   ├── migrations/         # SQL migration files (auth, tables, RPC functions)
│   └── config.toml         # Local Supabase config
│
├── tests/                  # Test files
│   ├── e2e/                # Playwright E2E tests
│   ├── integration/        # Integration tests (API + import)
│   └── mocks/              # Test fixtures and MSW mocks
│
├── __tests__/              # Alternative test directory
│   ├── unit/               # Unit tests
│   └── cross-lang/         # Python/JS interop tests
│
├── scripts/                # Utility scripts
│   ├── create-eval-dataset.ts  # Generate evaluation datasets
│   └── compare-prompts*.ts     # Prompt comparison utilities
│
├── .planning/              # GSD framework directories
│   ├── phases/             # Implementation phases
│   ├── codebase/           # Codebase analysis (this file)
│   └── config.json         # GSD configuration
│
├── middleware.ts           # Next.js middleware (CSRF, auth, correlation ID)
├── next.config.js          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Node.js dependencies
├── eslint.config.mjs       # ESLint configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── README.md               # Project documentation
```

## Directory Purposes

**app/api/**
- Purpose: All API endpoints organized by feature domain
- Contains: 42 route.ts files for REST API
- Key files: `chat/messages/route.ts`, `import/trigger/route.ts`, `memory/query/route.ts`

**app/[pages]/**
- Purpose: Authenticated and marketing pages
- Contains: Page components (chat, import, dashboard, login, signup)
- Key files: `chat/page.tsx`, `import/page.tsx`, `page.tsx` (marketing)

**components/chat/**
- Purpose: Chat interface components
- Contains: Message display, chat input, conversation sidebar, telegram-chat-v2 UI
- Key files: `telegram-chat-v2.tsx` (main chat), `conversation-sidebar.tsx`, `message-content.tsx`

**components/import/**
- Purpose: Import flow UI
- Contains: Upload progress display, stage animations
- Key files: `animated-progress-stages.tsx` (progress bar with stages)

**lib/memory/**
- Purpose: Semantic memory retrieval for chat augmentation
- Contains: Vector search, fact extraction, fact learning
- Key files: `query.ts` (hierarchical search with 5 layers), `facts.ts`, `learning.ts`

**lib/search/**
- Purpose: Real-time web search integration and classification
- Contains: Perplexity/Tavily APIs, search classifier, citation validation
- Key files: `smart-search.ts` (orchestrator), `search-classifier.ts` (decides if needed)

**lib/supabase/**
- Purpose: Database abstraction with client factory pattern
- Contains: Three client types (browser, SSR, admin)
- Key files: `client.ts`, `server.ts`, `middleware.ts`

**lib/evaluation/**
- Purpose: LLM response quality evaluation
- Contains: Quality judges, datasets, statistical validation
- Key files: `judges.ts` (memory, relevance, personalization judges), `datasets.ts`

**rlm-service/**
- Purpose: Asynchronous import processing and chat memory augmentation
- Contains: FastAPI app, DAG parser, chunker, embedder, processors
- Key files: `main.py` (endpoints), `processors/conversation_chunker.py`, `processors/embedding_generator.py`

**supabase/migrations/**
- Purpose: Database schema and RPC functions
- Contains: SQL files for tables, indexes, pgvector functions
- Key tables: `user_profiles`, `conversation_chunks`, `learned_facts`, `chat_messages`

## Key File Locations

**Entry Points:**

- `app/layout.tsx` - Root layout with fonts, theme, metadata
- `app/page.tsx` - Homepage (marketing + auth redirect)
- `middleware.ts` - CSRF, auth session, correlation ID injection
- `rlm-service/main.py` - RLM service endpoints (/query, /import-full)

**Configuration:**

- `next.config.js` - Next.js config (experimental, experimental.jsxPackageSource)
- `tsconfig.json` - TypeScript strict mode enabled
- `tailwind.config.ts` - Tailwind with custom colors (orange, midnight)
- `.env.local` / `.env.production.local` - Environment variables
- `supabase/config.toml` - Local Supabase studio config

**Core Logic:**

- `app/api/chat/messages/route.ts` - Save chat messages
- `app/api/chat/route.ts` - Stream chat responses with memory context
- `app/api/import/trigger/route.ts` - Initiate import (calls RLM /import-full)
- `app/api/memory/query/route.ts` - Retrieve memory context (semantic search)
- `lib/memory/query.ts` - Hierarchical vector search with 5-layer filtering
- `lib/search/smart-search.ts` - Decide if web search needed, call Perplexity/Tavily
- `rlm-service/processors/conversation_chunker.py` - Create 5-tier chunks

**Testing:**

- `tests/e2e/` - Playwright tests for full user flows
- `tests/integration/api/import/` - Import pipeline tests
- `__tests__/unit/` - Unit tests for utilities
- `lib/soulprint/__tests__/` - Soulprint generation tests

## Naming Conventions

**Files:**

- API routes: `[feature]/[action]/route.ts` (e.g., `api/chat/messages/route.ts`)
- Client components: `[Feature].tsx` or `[feature]-[variant].tsx` (e.g., `ChatMessage.tsx`, `telegram-chat-v2.tsx`)
- Server utilities: lowercase with hyphens (e.g., `error-handler.ts`, `progress-mapper.ts`)
- Tests: `[filename].test.ts` or `[filename].spec.ts`
- Python processors: snake_case (e.g., `conversation_chunker.py`, `embedding_generator.py`)

**Directories:**

- Feature domains: lowercase plural (e.g., `components/chat/`, `lib/memory/`, `app/api/import/`)
- Nested routes: `[id]/` for dynamic segments (e.g., `api/conversations/[id]/`)
- Utilities: flat in lib (e.g., `lib/rate-limit.ts`, `lib/csrf.ts`)

**Components:**

- Page components: `'use client'` at top, export default
- Feature-specific: `export function ComponentName() {}`
- Styled with Tailwind + Shadcn UI components

**Type definitions:**

- Inline in files where used (no separate types/ directory except `types/` at root)
- Zod schemas in `lib/api/schemas.ts` (source of truth for validation)
- Database row types defined in functions that use them

## Where to Add New Code

**New Feature (e.g., new memory endpoint):**
- Endpoint: `app/api/memory/[action]/route.ts`
- Service logic: `lib/memory/[action].ts` (new file or existing file)
- Schema: Add to `lib/api/schemas.ts`
- Tests: `tests/integration/api/memory/[action].test.ts`

**New UI Component:**
- Page: `app/[feature]/page.tsx` (if new page)
- Component: `components/[feature]/component-name.tsx` (reusable) or inline in page
- Styles: Tailwind classes in JSX, use Shadcn UI components
- Tests: `tests/e2e/[feature].spec.ts` for user flows

**New Python processor (RLM):**
- Processor: `rlm-service/processors/[processor_name].py`
- Register in: `rlm-service/main.py` (new route or existing processor chain)
- Tests: `rlm-service/processors/test_[processor_name].py`

**Utilities and Helpers:**
- API utilities: `lib/api/[utility].ts`
- Database: `lib/supabase/[helper].ts`
- Search: `lib/search/[search_type].ts`
- Logging: Use `createLogger` from `lib/logger/`

**Environment Configuration:**
- Add to `.env.local` or `.env.production.local`
- Document in CLAUDE.md (project instructions)
- Reference in code via `process.env.VAR_NAME`

## Special Directories

**rlm-service/:**
- Purpose: Python FastAPI microservice for import and chat
- Generated: No (committed to git)
- Committed: Yes (single-repo architecture with Next.js)
- Deployment: Auto-deploys with main branch to Render

**.next/:**
- Purpose: Next.js build artifacts
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**node_modules/:**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No

**supabase/.temp/**
- Purpose: Local Supabase CLI temp files
- Generated: Yes
- Committed: No

**.planning/:**
- Purpose: GSD framework planning documents
- Generated: Yes (by /gsd commands)
- Committed: Yes (tracked in git)

**public/**
- Purpose: Static assets served as-is
- Generated: No (manually added)
- Committed: Yes

---

*Structure analysis: 2026-02-11*
