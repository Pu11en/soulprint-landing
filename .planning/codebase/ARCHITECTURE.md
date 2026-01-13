# Architecture

**Analysis Date:** 2026-01-13

## Pattern Overview

**Overall:** Full-Stack Next.js Application with App Router

**Key Characteristics:**
- Server-side rendering with React Server Components
- Server Actions for form handling and mutations
- API routes for external integrations (LLM, voice analysis)
- Supabase for authentication and data persistence
- Multi-step questionnaire flow for SoulPrint generation

## Layers

**App Layer (app/):**
- Purpose: Page routing, layouts, and server components
- Contains: Pages, layouts, loading states, error boundaries
- Location: `app/**/*.tsx`
- Depends on: Components, Server Actions, Lib utilities

**Actions Layer (app/actions/):**
- Purpose: Server-side mutations and data operations
- Contains: `auth.ts`, `gate.ts`, `soulprint-management.ts`, `soulprint-selection.ts`, `chat-history.ts`, `api-keys.ts`
- Location: `app/actions/*.ts`
- Depends on: Supabase client, lib utilities
- Used by: Pages, components via form actions

**API Layer (app/api/):**
- Purpose: REST endpoints for external integrations
- Contains: SoulPrint generation, chat completions, voice analysis
- Location: `app/api/**/*.ts`
- Depends on: LLM clients, Supabase, external services
- Used by: Client-side fetch, external services

**Components Layer (components/):**
- Purpose: Reusable UI components
- Contains: Auth forms, dashboard UI, sections, voice recorder
- Location: `components/**/*.tsx`
- Depends on: UI primitives, lib utilities
- Used by: App pages

**Lib Layer (lib/):**
- Purpose: Core business logic and service abstractions
- Contains: Supabase clients, LLM generators, voice analysis, email
- Location: `lib/**/*.ts`
- Depends on: External SDKs
- Used by: Actions, API routes, components

## Data Flow

**SoulPrint Generation Flow:**

1. User completes questionnaire (`app/questionnaire/new/page.tsx`)
2. Answers stored in localStorage during session
3. Submit triggers `POST /api/soulprint/generate`
4. `processSoulPrint()` in `lib/soulprint/service.ts`:
   - Checks local LLM availability
   - Falls back to Gemini/OpenAI
   - Saves to Supabase `soulprints` table
5. User names SoulPrint via `updateSoulPrintName()` action
6. `switchSoulPrint()` sets context cookie
7. Redirect to `/dashboard/chat`

**Authentication Flow:**

1. User visits `/enter` or `/login`
2. Access code (`7423`) validation
3. Credentials validated via Supabase Auth
4. Session stored in HTTP-only cookies
5. Middleware checks session on protected routes
6. Server Actions access user via `createClient()`

**State Management:**
- Server: Supabase PostgreSQL for persistent data
- Client: React state, localStorage for questionnaire answers
- Session: HTTP-only cookies via @supabase/ssr

## Key Abstractions

**SoulPrint Service:**
- Purpose: Orchestrate SoulPrint generation
- Location: `lib/soulprint/service.ts`
- Pattern: Service with LLM fallback chain

**Supabase Clients:**
- Purpose: Database and auth operations
- Server: `lib/supabase/server.ts`
- Client: `lib/supabase/client.ts`
- Pattern: Factory functions for context-appropriate clients

**LLM Clients:**
- Purpose: AI text generation
- Gemini: `lib/gemini/client.ts`, `lib/gemini/soulprint-generator.ts`
- OpenAI: `lib/openai/client.ts`, `lib/openai/soulprint-generator.ts`
- Unified: `lib/llm/unified-client.ts`
- Pattern: Unified interface with provider-specific implementations

**Voice Analyzer:**
- Purpose: Extract emotional signatures from voice
- Location: `lib/soulprint/voice-analyzer.ts`, `lib/soulprint/assemblyai-analyzer.ts`
- Pattern: Strategy pattern for different analysis backends

## Entry Points

**Web Application:**
- Location: `app/layout.tsx` (root layout)
- Triggers: HTTP requests
- Responsibilities: Render pages, apply global styles, auth context

**API Routes:**
- Location: `app/api/**/route.ts`
- Triggers: HTTP requests to /api/*
- Responsibilities: Handle external integrations, LLM calls

**Server Actions:**
- Location: `app/actions/*.ts`
- Triggers: Form submissions, client invocations
- Responsibilities: Mutations, auth operations

## Error Handling

**Strategy:** Try/catch at action and API boundaries, error components for pages

**Patterns:**
- Server Actions: Return `{ success: boolean, error?: string }` or use `redirect()`
- API Routes: Return appropriate HTTP status codes with JSON error messages
- Pages: `error.tsx` boundary components
- Forms: Display error messages from action responses

## Cross-Cutting Concerns

**Logging:**
- Console.log for development
- No structured logging framework detected

**Validation:**
- Form validation in components
- Server-side validation in actions
- API route input validation

**Authentication:**
- Supabase Auth middleware in `middleware.ts`
- Session refresh on every request
- Protected routes redirect to `/login`

---

*Architecture analysis: 2026-01-13*
*Update when major patterns change*
