# CLAUDE.md - SoulPrint Development Context

## Project Overview

SoulPrint is a privacy-first AI personalization platform. Users upload their ChatGPT export ZIP, it gets analyzed to create a "SoulPrint" (personality profile with conversation memory), and they get a personalized AI assistant that knows their context.

**Live URL:** Deployed on Vercel (auto-deploy from `main` branch)
**RLM Service:** https://soulprint-landing.onrender.com (Python FastAPI, separate repo in `rlm-service/`)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.5 (App Router) |
| Language | TypeScript (strict mode) |
| React | 19.2.3 (Server Components) |
| Styling | Tailwind CSS 3.4.19 + shadcn/ui (Radix primitives) |
| Database | Supabase (PostgreSQL + Auth + Storage + RLS) |
| LLM | AWS Bedrock (Claude Haiku 4.5) |
| Embeddings | Cohere Embed v3 (768-dim vectors) |
| RLM Service | Python FastAPI on Render |
| Email | Resend |
| Rate Limiting | Upstash Redis |
| Search | Tavily + Perplexity APIs |
| Testing | Vitest (unit) + Playwright (E2E) + MSW (mocking) |
| Logging | Pino (structured JSON) |
| CI/CD | Vercel (deploy) + GitHub Actions (LLM regression) |

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build (run to check for type/build errors)
npm run lint       # ESLint check
npm run test       # Vitest unit/integration tests (watch mode)
npm run test:run   # Vitest single run (CI)
npm run test:e2e   # Playwright E2E tests
```

## Directory Structure

```
app/                          # Next.js App Router
  layout.tsx                  # Root layout (fonts, theme, metadata, PWA)
  page.tsx                    # Landing page
  globals.css                 # Tailwind directives + custom resets
  login/page.tsx              # Login
  signup/page.tsx             # Signup
  enter/page.tsx              # Generic auth entry
  auth/callback/route.ts      # OAuth callback handler
  dashboard/page.tsx          # User dashboard
  import/page.tsx             # ChatGPT export upload flow
  chat/page.tsx               # Main chat interface (memory-integrated)
  memory/page.tsx             # Memory/knowledge browser
  complete/page.tsx           # Onboarding completion
  whitepaper/page.tsx         # Whitepaper
  architecture/page.tsx       # Architecture docs
  chat-demo/page.tsx          # Public chat demo
  chat-preview/page.tsx       # Chat preview
  waitlist-confirmed/page.tsx # Waitlist confirmation
  api/                        # API routes (see API Routes section)

components/
  ui/                         # shadcn/ui primitives (button, input, dialog, card, etc.)
  chat/                       # Chat UI (ChatMessage, ChatInput, conversation-sidebar, etc.)
  chat-variants/              # Alternative chat designs (GlassmorphicChat)
  auth/                       # Auth forms (login-form, signup-modal)
  sections/                   # Landing page sections (hero, features, faq, pricing, footer)
  theme/                      # Theme provider (next-themes)

lib/
  supabase/                   # Supabase clients (client.ts for browser, server.ts for Node)
  soulprint/                  # Soulprint generation (quick-pass, sampling, prompts, EI scoring)
  memory/                     # Memory system (query, learning, facts extraction)
  search/                     # Web search (tavily, perplexity, smart-search, citations)
  evaluation/                 # Quality scoring (LLM judges, experiments, datasets)
  rlm/                        # RLM service client (health/circuit breaker)
  email/                      # Email sending (Resend)
  logger/                     # Pino structured logger
  api/                        # API utilities (error-handler, Zod schemas, TTL cache)
  bedrock.ts                  # AWS Bedrock client setup
  csrf.ts                     # CSRF token management
  rate-limit.ts               # Upstash rate limiting (tiered)
  retry.ts                    # Retry with exponential backoff
  utils.ts                    # General utilities (cn classname merger)

supabase/
  migrations/                 # 48+ SQL migrations (schema evolution)

tests/
  setup.ts                    # Vitest setup (mocks for logger, rate-limit)
  mocks/                      # MSW server and handlers
  integration/api/            # API route integration tests
  e2e/                        # Playwright E2E tests

rlm-service/                  # Python FastAPI RLM backend (separate service)
scripts/                      # Evaluation, benchmarking, regression test scripts
public/                       # Static assets (images, fonts, icons, splash screens)
```

## API Routes

### Core User Flows
- `POST /api/chat` - Main chat endpoint (streaming via Bedrock)
- `POST /api/chat/messages` - Save chat messages to DB
- `POST /api/import/trigger` - Trigger RLM import processing (fire-and-forget)
- `POST /api/import/complete` - Callback from RLM when import finishes (sends email)

### Memory & Conversations
- `GET /api/conversations` - List user conversations
- `GET|PUT|DELETE /api/conversations/[id]` - CRUD single conversation
- `POST /api/conversations/[id]/title` - Generate conversation title
- `POST /api/memory/query` - Query memory chunks (vector search)
- `GET /api/memory/list` - List memory chunks
- `DELETE /api/memory/delete` - Delete memory chunks
- `GET /api/memory/status` - Memory processing status
- `POST /api/memory/synthesize` - Cron: synthesize/improve memory (every 6 hours)

### Profile & Quality
- `POST /api/profile/ai-name` - Generate AI assistant name
- `POST /api/profile/ai-avatar` - Generate AI avatar
- `POST /api/quality/score` - Score response quality
- `POST /api/cron/quality-refinement` - Cron: refine quality (daily 3 AM)

### Admin
- `GET /api/admin/health` - Full health check (all services)
- `GET /api/admin/metrics` - System metrics
- `POST /api/admin/migrate` - Run DB migrations
- `POST /api/admin/rechunk` - Rechunk user data
- `POST /api/admin/reset-user` - Reset user data
- `GET /api/admin/rlm-status` - RLM service status

### Health
- `GET /api/health` - Basic health
- `GET /api/health/supabase` - Supabase connectivity
- `GET /api/rlm/health` - RLM service health
- `GET /api/chat/health` - Chat service health

## Database Schema (Supabase)

### Key Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | User data, soulprint, import status, personality profile, AI name |
| `conversation_chunks` | Searchable conversation segments with tier (micro/medium/macro) and 768-dim embeddings |
| `conversations` | Chat conversation grouping |
| `chat_messages` | Individual messages (role, content, timestamps) |
| `learned_facts` | Extracted facts with category and confidence |
| `memory_chunks` | Synthesized vector-searchable memory |
| `raw_conversations` | Original ChatGPT export storage paths |
| `embedding_status` | Track embedding progress per user |
| `gamification` | Message counts, learning levels, streaks |
| `referral_tracking` | Referral program data |
| `pending_waitlist` | Waitlist entries |

### Import Status Flow (user_profiles.import_status)
```
'none'       -> No import started
'processing' -> Chunking/embedding in progress
'complete'   -> Ready to chat
'failed'     -> Error occurred (check import_error column)
```

### RLS Policies
- Users can only read/update their own data
- Service role key bypasses RLS for admin operations
- Supabase Auth auto-creates user_profiles on signup via trigger

### Storage Buckets
- `user-exports` - Raw gzipped ChatGPT exports

## Architecture Patterns

### Authentication
- Supabase Auth with PKCE OAuth flow
- Middleware auto-refreshes auth sessions from cookies
- Check auth: `supabase.auth.getUser()` in server components/API routes
- Redirect unauthenticated users to login

### Middleware (`middleware.ts`)
- CSRF protection (Double Submit Cookie via @edge-csrf/nextjs)
- Supabase auth session refresh
- Correlation ID generation for request tracing
- Skips CSRF for server actions and internal server-to-server calls
- Runs on all routes except static assets (\_next/static, images, favicon)

### Rate Limiting (`lib/rate-limit.ts`)
Three tiers via Upstash Redis:
- `standard` - 60 req/min (reads, memory queries)
- `expensive` - 20 req/min (AI chat, soulprint, import)
- `upload` - 100 req/min (chunked file uploads)

Fail-open: gracefully skips if Redis is unavailable.

### Error Handling (`lib/api/error-handler.ts`)
- Standardized API error responses with correlation IDs
- Zod validation schemas for all API inputs (`lib/api/schemas.ts`)
- Try-catch in all async handlers with context logging

### Logging (`lib/logger/`)
- Pino structured JSON logs in production
- Pretty-printed in development
- Context-aware child loggers with correlation IDs

### Chat Blocking Logic
In `app/chat/page.tsx`, check `user_profiles.import_status`:
- `'none'` -> Redirect to /import
- `'processing'` -> Show "Still processing..." screen
- `'complete'` -> Allow chat
- `'failed'` -> Show error, allow re-import

### Import Flow
```
User uploads ZIP -> Extract conversations.json
  -> Store original (gzip) in Supabase Storage (user-exports bucket)
  -> POST /api/import/trigger (fire-and-forget to RLM)
  -> RLM creates multi-tier chunks:
       Tier 1 (micro): ~100 chars (facts, names, dates)
       Tier 2 (medium): ~500 chars (topic context, preferences)
       Tier 3 (macro): ~2000 chars (full conversation flow)
  -> RLM generates embeddings + soulprint
  -> POST /api/import/complete callback
  -> Save to DB, send email notification
  -> User can access /chat
```

### State Management
No centralized store (Redux/Zustand). Patterns used:
- **Server Components** for server-side data fetching (minimize client state)
- **useState/useRef** for local component state
- **Supabase** as source of truth (polling for status updates)
- **next-themes** for dark/light mode via context
- **AbortController** + refs for race condition prevention in chat

## Conventions

### File Naming
- Pages/routes: lowercase with hyphens (`chat-demo`)
- Components: PascalCase (`ChatMessage.tsx`)
- Utilities/services: camelCase with hyphens (`error-handler.ts`)
- Tests: `.test.ts` (unit) or `.spec.ts` (E2E)

### Imports
- Always use `@/` path alias (absolute imports, never `../../`)
- Group: React/Next.js -> external libraries -> local modules
- Use `import type { }` for type-only imports

### TypeScript
- Strict mode enabled (`noUncheckedIndexedAccess: true`)
- Validate external data with Zod schemas
- Prefer `unknown` over `any`
- Interfaces for data shapes, types for unions/intersections

### API Routes
- Export named functions per HTTP method: `export async function POST(req: NextRequest)`
- Validate request body with Zod via `parseRequestBody()`
- Return `NextResponse.json()` for all responses
- Rate limit checks at route entry
- Include correlation ID in error responses

### Components
- Server Components by default (add `'use client'` only when needed)
- shadcn/ui primitives in `components/ui/`
- Props interfaces suffixed with `Props`
- Tailwind for all styling (no CSS modules)

### Async Patterns
- `async/await` everywhere (no `.then()` chains)
- `AbortController` for cancellable requests
- Retry with exponential backoff (`lib/retry.ts`)
- Timeout protection for external service calls

### Security
- CSRF tokens on all state-changing requests
- Rate limiting on all API routes
- RLS on all database tables
- Zod validation on all inputs
- CSP headers configured in `next.config.ts`
- No credentials in client-side code

## Environment Variables

### Required
```
NEXT_PUBLIC_SUPABASE_URL       # Supabase instance URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Public Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      # Admin Supabase key (server only)
AWS_ACCESS_KEY_ID              # AWS credentials for Bedrock
AWS_SECRET_ACCESS_KEY          # AWS credentials for Bedrock
```

### Service Integrations
```
RLM_API_URL                    # RLM service (default: https://soulprint-landing.onrender.com)
RESEND_API_KEY                 # Email delivery
UPSTASH_REDIS_URL              # Rate limiting Redis
UPSTASH_REDIS_TOKEN            # Rate limiting auth
TAVILY_API_KEY                 # Web search
PERPLEXITY_API_KEY             # Alternative web search
OPIK_API_KEY                   # LLM evaluation
```

### Optional
```
AWS_REGION                     # Default: us-east-1
BEDROCK_MODEL_ID               # Default: us.anthropic.claude-3-5-haiku-20241022-v1:0
NEXT_PUBLIC_APP_URL            # App root URL (for email links)
OPENAI_API_KEY                 # Fallback embeddings only
ADMIN_MIGRATION_SECRET         # Admin route protection
VAPID_PUBLIC_KEY               # Web Push (not fully enabled)
VAPID_PRIVATE_KEY              # Web Push (not fully enabled)
```

## Testing

### Unit/Integration (Vitest)
- Config: `vitest.config.mts` (jsdom environment)
- Setup: `tests/setup.ts` (mocks logger, rate-limit)
- Mocks: MSW for HTTP (`tests/mocks/`), manual mocks for services
- Run: `npm test` (watch) or `npm run test:run` (CI)

### E2E (Playwright)
- Config: `playwright.config.ts` (Chromium only, 30s timeout)
- Tests: `tests/e2e/` (smoke, import flow, auth, long sessions)
- Page objects: `tests/e2e/pages/BasePage.ts`
- Auto-starts dev server
- Run: `npm run test:e2e`

### LLM Regression (GitHub Actions)
- Workflow: `.github/workflows/llm-regression.yml`
- Triggers on PR changes to prompt files or manual dispatch
- Uses Opik for quality evaluation against baseline

## Cron Jobs (Vercel)
- `/api/memory/synthesize` - Every 6 hours (memory improvement)
- `/api/cron/quality-refinement` - Daily at 3 AM (quality metrics)

## What NOT to Change
- Supabase schema (managed via migrations in `supabase/migrations/`)
- RLM service (external, call its API)
- Auth flow (working, uses Supabase PKCE)
- Middleware CSRF/auth logic (security-critical)

## Key External Services

| Service | Purpose | Health Check |
|---------|---------|-------------|
| Supabase | DB, Auth, Storage | `GET /api/health/supabase` |
| AWS Bedrock | LLM (Claude Haiku) | `GET /api/chat/health` |
| RLM (Render) | Soulprint generation, memory embedding | `GET /api/rlm/health` |
| Upstash Redis | Rate limiting | Fail-open (no health check) |
| Resend | Email | Used on-demand |
| Tavily | Web search | `GET /api/chat/health` |
| Perplexity | Web search | `GET /api/chat/perplexity-health` |
