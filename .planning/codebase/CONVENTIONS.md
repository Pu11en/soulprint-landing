# Coding Conventions

**Analysis Date:** 2026-02-01

## Naming Patterns

**Files:**
- **Client Components:** Kebab-case with `.tsx` extension
  - Example: `login-form.tsx`, `achievement-toast.tsx`, `background-sync.tsx`
- **Server Actions:** Kebab-case TypeScript files in `app/actions/`
  - Example: `auth.ts`, `referral.ts`
- **API Routes:** Kebab-case directory structure following Next.js conventions
  - Example: `app/api/admin/health/route.ts`, `app/api/branch/route.ts`
- **Utility Libraries:** Kebab-case in `lib/` directories
  - Example: `client-soulprint.ts`, `branch-manager.ts`, `personality-analysis.ts`
- **UI Components:** PascalCase for shared UI components
  - Example: `AchievementToast.tsx`, `BreakpointDesktop.tsx`

**Functions:**
- **Server/Lib Functions:** camelCase async functions
  - Example: `extractFacts()`, `sendSoulprintReadyEmail()`, `createBranch()`, `checkSupabase()`
- **Event Handlers:** camelCase with `handle` prefix in components
  - Example: `handleEmailSignIn()`, `handleGoogleSignIn()`, `handleSubmit()`
- **Internal Helpers:** camelCase, lowercase if not exported
  - Example: `checkAndSync()`, `parseConversation()`, `getOrderedMessages()`

**Variables:**
- **State Variables:** camelCase
  - Example: `email`, `password`, `loading`, `checkingAuth`, `toastQueue`
- **Constants:** UPPER_SNAKE_CASE
  - Example: `ADMIN_EMAILS`, `FROM_EMAIL`, `XP_CONFIG`, `RARITY_COLORS`, `DB_NAME`
- **Interface Props:** PascalCase with `Props` suffix
  - Example: `ToastProps`, `AchievementToastProviderProps`

**Types & Interfaces:**
- **Exported Types:** PascalCase
  - Example: `FactCategory`, `ExtractedFact`, `ParsedConversation`, `ChatGPTMessage`, `ServiceHealth`
- **Union Types:** Named explicitly with semantic meaning
  - Example: `type XPSource = 'message' | 'memory' | 'streak' | 'achievement' | 'daily_bonus'`
- **Rarity Enums:** Lowercase strings in union types
  - Example: `'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'`

## Code Style

**Formatting:**
- **Indentation:** 2 spaces
- **Line length:** No enforced maximum (pragmatic approach)
- **Semicolons:** Used consistently throughout codebase
- **Quotes:** Double quotes for JSX/HTML, consistency with single/double in strings

**Linting:**
- **Tool:** ESLint with Next.js and TypeScript configuration
- **Config file:** `eslint.config.mjs`
- **Rules:** Based on ESLint core-web-vitals and Next.js TypeScript presets
- **Key enforcement:**
  - React/Next.js best practices
  - Core Web Vitals recommendations
  - TypeScript strict mode enabled in `tsconfig.json`

**TypeScript Configuration:**
- **Target:** ES2017
- **Strict Mode:** Enabled
- **Module Resolution:** Bundler (Next.js-aware)
- **Path Aliases:** `@/*` maps to project root (e.g., `@/lib/supabase/server`)

## Import Organization

**Order:**
1. External packages (Node.js, npm, third-party)
   - `import { NextResponse } from 'next/server'`
   - `import { createClient } from '@supabase/supabase-js'`
   - `import JSZip from 'jszip'`
2. Relative project imports (`@/` path aliases)
   - `import { createClient } from '@/lib/supabase/server'`
   - `import { Button } from '@/components/ui/button'`
   - `import { cn } from '@/lib/utils'`
3. Type imports (grouped, can use `type` keyword)
   - `import type { MemoryChunk } from './query'`
   - `import type { Achievement } from '@/lib/gamification/xp'`

**Path Aliases:**
- `@/*` resolves to project root
- Used throughout for internal imports to avoid relative paths
- Example: `@/app`, `@/lib`, `@/components`

**No Barrel Files:** Individual file imports preferred over index re-exports

## Error Handling

**Patterns:**

**Try-Catch Blocks:**
- Used in API routes and async server functions
- Catches both typed errors and unknown errors
- Example pattern from `app/api/branch/route.ts`:
```typescript
try {
  const result = await branchManager.writeToFile(username, filePath, content, branchId);
  return NextResponse.json({ success: true, ...result });
} catch (error) {
  console.error('Branch API error:', error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Internal error' },
    { status: 500 }
  );
}
```

**Error Type Guards:**
- Always check `error instanceof Error` before accessing `.message`
- Fallback to generic message if not Error instance
- Example: `error instanceof Error ? error.message : 'Internal error'`

**Response Format:**
- API errors: `{ error: string }` JSON with appropriate HTTP status codes
- Server actions: `{ error?: string }` or `{ success: boolean, error?: string }`
- Example from `app/actions/auth.ts`:
```typescript
if (error) {
    return { error: error.message }
}
return { success: true }
```

**Supabase API Errors:**
- Responses include `{ data, error }` tuple
- Check error field: `if (error) { return { error: error.message } }`
- Example from `app/api/admin/health/route.ts`:
```typescript
const { data, error } = await adminClient.from('profiles').select('id').limit(1);
if (error) {
  return { status: 'degraded', latency_ms, message: error.message };
}
```

## Logging

**Framework:** Native `console` object (no logging library)

**Patterns:**
- **Info/Success:** `console.log()` with prefixed context
  - `console.log('[Email] Soulprint ready email sent to ${to}')`
  - `console.log('[SoulPrint LLM] Batch ${i + 1}/${batches.length} complete')`
- **Errors:** `console.error()` with prefixed context
  - `console.error('[Email] Failed to send:', error)`
  - `console.error('Branch API error:', error)`
  - `console.error('[Learning] Failed to extract facts:', error)`

**Context Prefixes:**
- Prefixed with service/module name in brackets: `[Email]`, `[SoulPrint LLM]`, `[Learning]`, `[Personality]`
- Helps with log aggregation and debugging

**No Logging Middleware:** Observability is minimal, logs go to stdout

## Comments

**When to Comment:**
- Complex algorithms: Explain the "why" not the "what"
- Data structure transformations: Show before/after or intent
- Non-obvious logic: Particularly around chat parsing, memory extraction
- Configuration explanations: Why certain values are chosen

**JSDoc/TSDoc:**
- Used for functions with complex signatures or important utilities
- Minimal but present for public APIs
- Example from `lib/branch/route.ts`:
```typescript
/**
 * Branch API - Handles file versioning for user edits
 *
 * POST /api/branch - Create a branch or write to existing branch
 * GET /api/branch - List branches (optionally filtered by user)
 * GET /api/branch?id=xxx - Get specific branch
 */
```
- Example from `lib/email/send.ts`:
```typescript
/**
 * Email sending utility using Resend
 */
```
- Example from `lib/memory/facts.ts`:
```typescript
/**
 * Extract durable facts from memory chunks using Bedrock Claude
 */
export async function extractFacts(chunks: MemoryChunk[]): Promise<ExtractedFact[]>
```

## Function Design

**Size:** No strict enforced limits observed, but most functions range 20-50 lines

**Parameters:**
- Named parameters in objects for functions with multiple arguments
- Example: `sendEmail({ to, subject, html, text })`
- Server actions use FormData for form submissions
- API routes destructure `request.json()` before passing to handler

**Return Values:**
- Consistent patterns by context:
  - **API Routes:** `NextResponse.json()` with status codes
  - **Server Actions:** `{ success: boolean, error?: string }` or `{ error: string }`
  - **Utilities:** Typed returns matching exported interfaces

**Async/Await:**
- Heavily used in server functions and API routes
- Used in client components with useEffect
- Error handling with try-catch blocks

## Module Design

**Exports:**
- **Named Exports:** Preferred for functions and types
  - `export async function sendEmail(...)`
  - `export interface ExtractedFact { ... }`
  - `export const XP_CONFIG = { ... }`
- **Default Exports:** Used for React components and page components
  - `export function LoginForm() { ... }`
  - `export default function Page() { ... }`

**File Organization:**
- **Type Definitions:** At top of file, before implementations
- **Constants:** After imports, before functions
- **Main Exports:** Named exports with clear function signatures
- **Helper Functions:** Private (non-exported) helpers below main functions

**Module Examples:**
- `lib/gamification/xp.ts` exports: `XP_CONFIG`, `type XPSource`, `interface XPGain`, `interface UserStats`, `RARITY_COLORS`
- `lib/email/send.ts` exports: `function sendSoulprintReadyEmail(...)`
- `lib/memory/facts.ts` exports: `type FactCategory`, `interface ExtractedFact`, `function extractFacts()`, `function groupFactsByCategory()`, `function getHighConfidenceFacts()`

---

*Convention analysis: 2026-02-01*
