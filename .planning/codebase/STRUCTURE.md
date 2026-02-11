# Codebase Structure

**Analysis Date:** 2026-02-11

## Directory Layout

```
soulprint-landing/
├── app/                          # Next.js app directory (v14+)
│   ├── api/                      # 32+ API route handlers
│   │   ├── import/               # Import orchestration
│   │   ├── chat/                 # Chat messages & queries
│   │   ├── memory/               # Memory query & chunking
│   │   ├── rlm/                  # RLM health checks
│   │   ├── health/               # Service health
│   │   ├── admin/                # Admin endpoints
│   │   ├── storage/              # Upload tokens & URLs
│   │   └── ...
│   ├── import/                   # Upload UI page
│   ├── chat/                     # Chat interface page
│   ├── memory/                   # Memory browser page
│   ├── dashboard/                # User dashboard
│   └── ...
│
├── rlm-service/                  # Python FastAPI backend (separate deployment)
│   ├── main.py                   # FastAPI app + endpoints
│   ├── prompt_builder.py         # Versioned prompt construction
│   ├── prompt_helpers.py         # Prompt utility functions
│   ├── processors/               # Processing pipeline
│   │   ├── __init__.py
│   │   ├── streaming_import.py   # Download + parse (constant memory)
│   │   ├── quick_pass.py         # Personality generation (Haiku 4.5)
│   │   ├── full_pass.py          # Chunks + facts + memory
│   │   ├── conversation_chunker.py
│   │   ├── fact_extractor.py     # Parallel fact extraction
│   │   ├── memory_generator.py   # MEMORY section synthesis
│   │   ├── dag_parser.py         # ChatGPT tree traversal
│   │   └── ...
│   └── requirements.txt
│
├── lib/                          # Shared TypeScript utilities
│   ├── api/                      # API client utilities
│   │   ├── schemas.ts            # Zod validation schemas
│   │   ├── error-handler.ts
│   │   └── ...
│   ├── supabase/                 # Supabase client
│   ├── rlm/                      # RLM integration
│   │   └── health.ts             # Circuit breaker
│   ├── memory/                   # Memory query & chunking
│   ├── soulprint/                # Personality generation
│   ├── email/                    # Email sending
│   ├── logger/                   # Structured logging
│   ├── rate-limit.ts             # Redis rate limiting
│   ├── csrf.ts                   # CSRF token handling
│   ├── tus-upload.ts             # Resumable upload
│   └── ...
│
├── components/                   # React components
│   ├── chat/                     # Chat UI components
│   ├── auth/                     # Auth flow UI
│   ├── ui/                       # Reusable UI (button, modal, etc.)
│   └── ...
│
├── supabase/                     # Database migrations & config
│   ├── migrations/               # SQL migration files
│   │   ├── 20250127_user_profiles.sql
│   │   ├── 20250127_conversation_chunks.sql
│   │   ├── 20250127_chat_messages.sql
│   │   ├── 20250127_memory_chunks.sql
│   │   ├── 20250131_learned_facts.sql
│   │   └── ...
│   └── config.toml
│
├── public/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── ...
│
├── tests/                        # Test files
│   ├── e2e/                      # Playwright e2e tests
│   ├── integration/              # Integration tests
│   └── mocks/
│
├── __tests__/                    # Additional unit tests
│   ├── unit/
│   └── cross-lang/               # TypeScript/Python tests
│
├── .planning/                    # GSD framework docs
│   ├── codebase/                 # THIS DIRECTORY
│   ├── phases/                   # Phase plans
│   ├── config.json
│   └── ...
│
├── .env*                         # Environment files (NOT committed)
├── package.json                  # Node dependencies
├── next.config.ts                # Next.js config
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind CSS config
├── vitest.config.ts              # Vitest config
└── README.md
```

## Directory Purposes

**`app/api/`:**
- Purpose: HTTP route handlers for all backend operations
- Contains: Next.js Route Handler files (route.ts)
- Key files:
  - `import/trigger/route.ts` - Initiates import job
  - `import/complete/route.ts` - Marks import complete
  - `chat/messages/route.ts` - Save/load chat messages
  - `memory/query/route.ts` - Query conversation chunks
  - `memory/status/route.ts` - Get import progress
  - `rlm/health/route.ts` - RLM health check proxy
  - `health/supabase/route.ts` - Supabase connectivity check
  - `admin/*.ts` - Admin utilities (migrate, reset, metrics)

**`rlm-service/`:**
- Purpose: Independent Python backend for heavy processing
- Contains: FastAPI app, async processors, prompt builders
- Pattern: Fire-and-forget jobs via asyncio.create_task()
- Deployment: Render.com (separate from Vercel)
- Key files:
  - `main.py` - FastAPI app with `/import-full`, `/query`, `/health` endpoints
  - `processors/streaming_import.py` - Download + parse (constant memory)
  - `processors/quick_pass.py` - 5-section personality (Haiku 4.5 via Bedrock)
  - `processors/full_pass.py` - Chunks + facts + memory synthesis
  - `prompt_builder.py` - Versioned system prompt construction

**`lib/`:**
- Purpose: Shared TypeScript utilities used by frontend and API routes
- Pattern: Utility modules, not pages
- Key subdirectories:
  - `lib/api/schemas.ts` - Zod schemas for request validation
  - `lib/supabase/` - Supabase client initialization
  - `lib/rlm/health.ts` - Circuit breaker for RLM
  - `lib/memory/query.ts` - Chunk search logic
  - `lib/rate-limit.ts` - Redis rate limiting (Upstash)
  - `lib/logger/` - Pino structured logging

**`components/`:**
- Purpose: React UI components
- Pattern: Organized by feature, not shared vs specific
- Key subdirectories:
  - `components/chat/` - Chat message display, input, settings
  - `components/ui/` - Reusable UI (Button, Modal, etc.) - Shadcn/ui based
  - `components/auth/` - Auth flows, login, signup

**`supabase/migrations/`:**
- Purpose: Database schema definitions
- Pattern: Numbered migration files (YYYYMMDD_description.sql)
- Key tables:
  - `user_profiles` - Soulprint data, import status, AI settings
  - `conversation_chunks` - Searchable conversation segments
  - `chat_messages` - User/AI message history
  - `conversations` - Metadata about chats
  - `learned_facts` - Extracted facts from analysis
  - `conversation_embeddings` - Vector embeddings for search

**`.planning/`:**
- Purpose: GSD framework documentation
- Contains: Phase plans, codebase analysis, orchestrator config
- Pattern: `.planning/phases/NN-phase-name/` for execution plans

## Key File Locations

**Entry Points:**

| Type | Path | Purpose |
|------|------|---------|
| Frontend Upload | `app/import/page.tsx` | User-facing import UI (drag-drop, progress) |
| Chat Interface | `app/chat/page.tsx` | Main chat page with sidebar, message history |
| API Trigger | `app/api/import/trigger/route.ts` | POST endpoint to start import job |
| RLM Main | `rlm-service/main.py` | FastAPI app with `/import-full` and `/query` |
| RLM Import | `rlm-service/processors/streaming_import.py` | Download + parse entry point |
| Health Check | `app/api/health/supabase/route.ts` | Verify service connectivity |

**Configuration:**

| File | Purpose |
|------|---------|
| `package.json` | Node dependencies, dev scripts |
| `next.config.ts` | Next.js build config |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.ts` | Tailwind CSS theme |
| `vitest.config.ts` | Test runner config |
| `rlm-service/requirements.txt` | Python dependencies |

**Core Logic:**

| Module | Path | Purpose |
|--------|------|---------|
| Streaming Import | `rlm-service/processors/streaming_import.py` | Download + ijson parse (constant memory) |
| Quick Pass | `rlm-service/processors/quick_pass.py` | Generate 5 personality sections via Haiku 4.5 |
| Full Pass | `rlm-service/processors/full_pass.py` | Chunk conversations, extract facts, generate memory |
| DAG Parser | `rlm-service/processors/dag_parser.py` | Traverse ChatGPT message tree to active path |
| Fact Extractor | `rlm-service/processors/fact_extractor.py` | Parallel fact extraction from chunks |
| Prompt Builder | `rlm-service/prompt_builder.py` | Construct system prompts from sections |
| Circuit Breaker | `lib/rlm/health.ts` | RLM health tracking + failover |

**Testing:**

| Category | Location | Pattern |
|----------|----------|---------|
| E2E Tests | `tests/e2e/` | Playwright browser tests |
| Integration Tests | `tests/integration/api/import/` | API integration tests |
| Unit Tests | `__tests__/unit/` | Vitest unit tests |
| Mocks | `tests/mocks/` | Fixture data, mock responses |

## Naming Conventions

**Files:**

| Pattern | Example | Usage |
|---------|---------|-------|
| `route.ts` | `app/api/import/trigger/route.ts` | Next.js API route handlers |
| `page.tsx` | `app/import/page.tsx` | Next.js page components |
| `*.processor.ts` | N/A (Python only) | Processor modules in RLM |
| `*.test.ts` or `*.spec.ts` | `lib/api/schemas.test.ts` | Test files |
| `*.sql` | `20250127_user_profiles.sql` | Supabase migrations |

**Directories:**

| Pattern | Example | Usage |
|---------|---------|-------|
| Feature-based | `app/api/import/`, `components/chat/` | Group related features |
| Numbered phases | `.planning/phases/01-core-migration/` | GSD phase directories |
| Utility modules | `lib/api/`, `lib/memory/`, `lib/rlm/` | Shared code by domain |

**Functions/Variables:**

| Pattern | Example | Usage |
|---------|---------|-------|
| camelCase | `processImportStreaming`, `shouldAttemptRLM()` | TypeScript/Python functions |
| PascalCase | `QueryRequest`, `PromptBuilder` | Classes, types |
| SCREAMING_SNAKE | `FILE_SIZE_LIMIT`, `COOLDOWN_MS` | Constants |
| With prefix | `[streaming_import]`, `[FullPass]` | Log scope prefix |

## Where to Add New Code

**New Feature (e.g., Preferences, Settings):**

1. **Frontend UI:**
   - Create page: `app/settings/page.tsx`
   - Create components: `components/settings/PreferencesForm.tsx`
   - Use Shadcn/ui components from `components/ui/`

2. **API Endpoint:**
   - Create route: `app/api/user/preferences/route.ts`
   - Add Zod schema to: `lib/api/schemas.ts`
   - Add rate limit check: `checkRateLimit(user.id, 'standard')`

3. **Database:**
   - Create migration: `supabase/migrations/YYYYMMDD_description.sql`
   - Include RLS policies
   - Add indexes for queries

4. **Tests:**
   - Integration test: `tests/integration/api/user/preferences.test.ts`
   - Component test: `components/settings/__tests__/PreferencesForm.test.tsx`

**New Processor (e.g., Memory Enhancement):**

1. **Python Processor:**
   - Add to: `rlm-service/processors/new_processor.py`
   - Implement as async function
   - Return dict with results
   - Include [scope] logging prefix

2. **Orchestration in Full Pass:**
   - Integrate into: `rlm-service/processors/full_pass.py`
   - Call from run_full_pass_pipeline()
   - Save results to database via Supabase REST API

3. **Tests:**
   - Unit test: `rlm-service/processors/test_new_processor.py`
   - Integration test: `tests/integration/api/import/full-pass.test.ts`

**New RLM Endpoint:**

1. **Add to RLM:**
   - Define Pydantic request model in `rlm-service/main.py`
   - Implement async handler with @app.post() decorator
   - Call background_tasks.add_task() or asyncio.create_task()

2. **Next.js Proxy:**
   - Create route: `app/api/rlm/new-endpoint/route.ts`
   - Proxy POST to RLM service
   - Apply auth + rate limiting

3. **Frontend:**
   - Call from UI via: `fetch('/api/rlm/new-endpoint', {method: 'POST', ...})`

**New Database Table:**

1. **Create Migration:**
   - File: `supabase/migrations/YYYYMMDD_table_name.sql`
   - Include CREATE TABLE, indexes, RLS policies
   - Use `references auth.users(id) on delete cascade`

2. **Type Definition:**
   - Add to database type file if needed: `lib/database.types.ts`

3. **Query Functions:**
   - Add to relevant `lib/*/` module
   - Use Supabase JS client for Next.js
   - Use httpx + REST API for RLM

## Special Directories

**`.planning/`:**
- Purpose: GSD framework orchestrator data
- Generated: Partially (phase plans created by orchestrator, codebase docs by mapper)
- Committed: Yes, version controlled

**`rlm-service/.pytest_cache/`:**
- Purpose: pytest cache directory
- Generated: Yes (auto-created by pytest)
- Committed: No (in .gitignore)

**`node_modules/`, `__pycache__/`:**
- Purpose: Dependencies
- Generated: Yes (npm install, pip install)
- Committed: No (in .gitignore)

**`.next/`, `build/`:**
- Purpose: Build artifacts
- Generated: Yes (next build, python builds)
- Committed: No (in .gitignore)

**`.env`, `.env.local`, `.env.*.local`:**
- Purpose: Environment variables and secrets
- Generated: Manual (development)
- Committed: No (in .gitignore) - NEVER commit secrets

---

*Structure analysis: 2026-02-11*
