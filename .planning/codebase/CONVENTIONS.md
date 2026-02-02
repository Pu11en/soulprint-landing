# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- API routes use kebab-case: `app/api/chat/route.ts`, `app/api/import/process-server/route.ts`
- Component files use PascalCase: `components/chat/telegram-chat-v2.tsx`
- Utility modules use camelCase: `lib/utils.ts`, `lib/email/send.ts`
- Page components use lowercase: `app/chat/page.tsx`, `app/import/page.tsx`
- Directories use kebab-case for multi-word names: `app/api/import/`, `lib/search/`

**Functions:**
- Server actions (marked with `'use server'`) use camelCase: `signUp()`, `signIn()`, `signOut()`, `signInWithGoogle()`
- Async utility functions use camelCase with clear purpose: `embedQuery()`, `embedBatch()`, `searchMemoryLayered()`, `getMemoryContext()`
- Handler functions in API routes are named `POST`, `GET`, `PUT`, `DELETE` following Next.js convention
- Private/internal functions use camelCase with helper semantics: `getSupabaseAdmin()`, `normalizeQuery()`, `checkCache()`

**Variables:**
- State variables use camelCase: `const [isLoading, setIsLoading]`, `const [messages, setMessages]`
- Constants use UPPER_SNAKE_CASE: `const MAX_FILE_SIZE_MB = 500`, `const RATE_LIMIT_MAX = 10`, `const CACHE_TTL_MS = 5 * 60 * 1000`
- Type/interface variables in lowercase during destructuring: `const { message, history = [] } = body`
- Ref variables end with `Ref`: `messageQueueRef`, `processingPromiseRef`

**Types:**
- Interfaces use PascalCase: `interface ChatMessage`, `interface UserProfile`, `interface SmartSearchResult`
- Type unions are descriptive: `'user' | 'assistant'`, `'none' | 'quick_ready' | 'processing' | 'complete'`
- Query response types map database rows: `interface ChunkRpcRow`, `interface ChunkTableRow`, `interface LearnedFactRow`

## Code Style

**Formatting:**
- ESLint: v9 with `eslint-config-next` and TypeScript rules enabled
- Indentation: 2 spaces (enforced via ESLint)
- Line length: No strict limit, but code is kept readable
- Quotes: Single quotes for strings except in JSX attributes
- Semicolons: Used consistently

**Linting:**
- ESLint config: `eslint.config.mjs` with core-web-vitals and TypeScript plugins
- Ignored paths: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Next.js best practices enforced (image optimization, layout patterns, etc.)

**TypeScript:**
- Strict mode enabled: `"strict": true`
- Target: ES2017 with ESNext modules
- Path aliases: `@/*` maps to project root
- JSX: react-jsx (automatic runtime)
- Isolated modules: enabled for faster builds

## Import Organization

**Order:**
1. Standard library/Node imports: `import { NextRequest } from 'next/server'`
2. Third-party packages: `import JSZip from 'jszip'`, `import { Resend } from 'resend'`
3. Internal modules with path alias: `import { createClient } from '@/lib/supabase/server'`
4. Relative imports (rare): used only when necessary

**Path Aliases:**
- `@/*`: Project root imports (standard Next.js pattern)
- Examples: `@/lib/supabase/server`, `@/components/chat/telegram-chat-v2`, `@/app/actions/auth`

**Comment blocks:**
- Top-level file comments describe purpose: `/** Server-side import processing for large files (mobile-friendly) */`
- Section comments in functions mark major steps: `// Step 1: Check if search is needed`, `// VALIDATION: Ensure this is a valid ChatGPT export`
- Inline comments explain "why", not "what": `// 5 minute TTL` rather than `// Set TTL to 5 minutes`

## Error Handling

**Patterns:**
- Try-catch blocks for async operations with specific error messages
- Validation happens early with clear error returns: `if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 })`
- HTTP responses use NextResponse for consistency: `NextResponse.json({ error: msg }, { status: 500 })`
- Database errors are caught and logged before re-throwing: `if (error) { console.error(...); throw new Error(...) }`
- Graceful degradation: non-critical failures log warnings but don't crash: `adminSupabase.storage.from(bucket).remove([filePath]).catch(() => {})`

**Error Messages:**
- User-facing errors are clear and actionable: `"File too large (500MB). Maximum is 500MB. Please export fewer conversations or contact support."`
- Technical errors log enough context for debugging: `[ProcessServer] Download error: ${downloadError}`
- Error context includes operation scope: `[Chat] RLM service error:`, `[SmartSearch] Perplexity failed:`

## Logging

**Framework:** Native `console` (no external logger)

**Patterns:**
- All logging uses `console.log()` for info, `console.error()` for errors, `console.warn()` for warnings
- Log messages use scope prefix in brackets: `[Chat]`, `[ProcessServer]`, `[SmartSearch]`, `[Email]`, `[Memory]`, `[RLM]`
- Logging is contextual and helps trace execution: logs show feature, status, and key metrics
- Examples:
  ```typescript
  console.log('[Chat] Calling RLM service...');
  console.log(`[Chat] Found ${chunks.length} memories via ${method}`);
  console.log('[ProcessServer] Downloaded ${sizeMB.toFixed(1)}MB');
  console.error('[Chat] Name generation failed:', error);
  ```
- Non-critical async operations log failures without blocking: `learnFromChat(...).catch(err => { console.log('[Chat] Learning failed (non-blocking):', err); })`

## Comments

**When to Comment:**
- Complex logic or non-obvious decisions: `// Check if query is in cache and still valid`
- Business logic explanations: `// Store original (gzip) → Supabase Storage`, `// ChatGPT format - traverse the mapping properly`
- Configuration rationale: `// Cohere v3 supports context`, `// Critical for v3`
- Multi-step processes benefit from section headers

**JSDoc/TSDoc:**
- Function signatures include parameter and return type info
- Example from `smart-search.ts`:
  ```typescript
  /**
   * Normalize query for cache key
   */
  function normalizeQuery(query: string): string { ... }

  /**
   * Smart Search - Main function
   *
   * Automatically determines if search is needed and performs it.
   * Returns formatted context for the AI.
   */
  export async function smartSearch(message: string, ...): Promise<SmartSearchResult> { ... }
  ```
- Comments above type definitions explain purpose: `// Database row types for proper typing`

## Function Design

**Size:** Functions are focused and generally under 100 lines; larger processes are broken into steps with comments

**Parameters:**
- Avoid excessive positional parameters; use options objects for optional flags
- Example pattern: `smartSearch(message, userId, options: { forceSearch?, skipCache?, preferDeep? } = {})`
- Named exports preferred for utility functions

**Return Values:**
- Explicit return types on all functions: `Promise<MemoryChunk[]>`, `SmartSearchResult | null`
- Consistent error handling: errors thrown or returned in result objects
- Nullable returns use explicit `| null`: `async function searchLearnedFacts(...): Promise<LearnedFactResult[]>`

## Module Design

**Exports:**
- Utility modules export named functions: `export async function embedQuery(...)`, `export function getMemoryContext(...)`
- Barrel files not used; direct imports from specific modules
- Server action files export multiple handlers: `export async function signUp(...)`, `export async function signIn(...)`

**Module Purpose:**
- Each file has a clear, single responsibility
- Examples:
  - `lib/email/send.ts` - Email delivery via Resend
  - `lib/memory/query.ts` - Memory search and retrieval
  - `lib/search/smart-search.ts` - Intelligent web search orchestration
  - `app/api/chat/route.ts` - Chat request handler with RLM/Bedrock logic
  - `app/actions/auth.ts` - Server-side authentication actions

**Data Flow:**
- Server actions in `app/actions/` handle form input and redirect logic
- API routes in `app/api/` handle HTTP requests and return JSON/streams
- Lib modules provide utilities and business logic
- Components in `app/` pages use client-side hooks and fetch APIs

---

*Convention analysis: 2026-02-01*
