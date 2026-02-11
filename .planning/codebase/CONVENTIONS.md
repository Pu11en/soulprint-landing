# Coding Conventions

**Analysis Date:** 2026-02-11

## Naming Patterns

**Files:**
- API routes: `route.ts` in Next.js `app/api/[path]/` structure
- React components: PascalCase (e.g., `Navbar.tsx`, `ThemeToggle.tsx`)
- Library functions: camelCase (e.g., `generateQuickPass`, `detectEmotion`, `handleAPIError`)
- Schema files: separate `schemas.ts` for each domain (e.g., `lib/api/schemas.ts`)
- Test files: `*.test.ts` or `*.spec.ts` co-located with source or in `__tests__` folder
- Type definitions: Grouped in `types.ts` by domain (e.g., `lib/soulprint/types.ts`)

**Functions:**
- camelCase for all functions: `generateQuickPass()`, `sectionToMarkdown()`, `getRelationshipArc()`
- Async functions use `async` keyword: `async function detectEmotion(...)`
- Handler functions prefixed with verb: `handleAPIError()`, `checkRateLimit()`, `validatePillarAnswer()`
- Factory/creator functions prefixed with verb: `createLogger()`, `createClient()`, `makeTestConversations()`

**Variables:**
- camelCase for variables and constants: `const log = createLogger()`
- Boolean variables/functions prefixed with `is`, `has`, or `should`: `isOwner`, `hasImported`, `shouldValidate`
- Constants for configuration in UPPER_CASE: `PILLAR_NAMES`, `FROM_EMAIL`, `QUICK_PASS_SYSTEM_PROMPT`
- Private module-level variables use underscore prefix or module scope closure: `const bedrockClient = new BedrockRuntimeClient(...)`

**Types:**
- Interface names: PascalCase, descriptive (e.g., `EmotionalState`, `QuickPassResult`, `APIErrorResponse`)
- Type aliases: PascalCase (e.g., `type QuestionType = 'slider' | 'text'`)
- Generic type parameters: Single uppercase letter or descriptive (e.g., `<T>`, `<TResult>`)
- Zod schemas: descriptive in camelCase with `Schema` suffix (e.g., `chatRequestSchema`, `quickPassResultSchema`)

## Code Style

**Formatting:**
- ESLint configured via `eslint.config.mjs` (ESLint 9 flat config)
- Next.js web vitals and TypeScript rules enabled: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- No explicit Prettier config file; formatting guided by ESLint rules
- 2-space indentation (standard Next.js)
- Single quotes for strings (when configured)
- Trailing commas in multi-line structures

**Linting:**
- Rules applied: ESLint 9 with Next.js web vitals and TypeScript presets
- Common patterns enforced:
  - `set-state-in-effect` rule disabled with eslint directive when intentional (hydration fixes)
  - Import organization follows natural grouping (external, then internal)
  - Unused variables flagged and must be removed

**Max Function Length:**
- Functions typically 30-60 lines
- Helper functions kept small (10-20 lines)
- Complex async operations broken into smaller, named steps

**Parameters:**
- Max 3 positional parameters; use object destructuring for more:
  ```typescript
  // Bad:
  function foo(a, b, c, d, e) { }

  // Good:
  function foo({ a, b, c, d, e }: Options) { }
  ```
- Required parameters listed first, then optional

**Return Values:**
- Explicit return types for public APIs (functions exported from modules)
- Implicit return types acceptable for small helpers
- Early returns preferred for guard clauses:
  ```typescript
  if (!user) return null;
  // Continue main logic
  ```

## Import Organization

**Order:**
1. External libraries (React, Next.js, third-party packages): `import React from 'react'`
2. Type imports from external: `import type { SomeType } from 'package'`
3. Absolute imports from `@/`: `import { cn } from '@/lib/utils'`
4. Relative imports (rare): `import { helper } from './helper'`

**Path Aliases:**
- Single base alias `@/*` → project root (configured in `tsconfig.json`)
- Used for all internal imports in `lib/`, `app/`, `components/`
- Never use relative paths like `../../../` when absolute alias available

**Examples:**
```typescript
// API route (app/api/conversations/route.ts)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleAPIError } from '@/lib/api/error-handler';
import { parseRequestBody, createConversationSchema } from '@/lib/api/schemas';
```

```typescript
// Library function (lib/soulprint/quick-pass.ts)
import { createLogger } from '@/lib/logger/index';
import { bedrockChatJSON } from '@/lib/bedrock';
import type { ParsedConversation, QuickPassResult } from '@/lib/soulprint/types';
```

## Error Handling

**Patterns:**
- All async functions wrap in try-catch at API boundaries
- Error handler function used: `handleAPIError(error, 'Context:String')` returns `Response`
- Structured logging with context: `log.error({ correlationId, context, error }, 'message')`
- Graceful degradation: Return neutral defaults on detection failures instead of throwing
  ```typescript
  // From emotional-intelligence.ts
  catch (error) {
    console.warn('[EmotionalIntelligence] Detection failed:', error);
    return neutralDefault; // Never crash chat
  }
  ```

**Error Response Structure:**
```typescript
// From lib/api/error-handler.ts
export interface APIErrorResponse {
  error: string;
  code: string;
  timestamp: string;
  correlationId?: string;
}
```

**Special Cases:**
- TimeoutError from AbortSignal → 504 TIMEOUT
- Validation errors → 400 VALIDATION_ERROR (never expose raw Zod details)
- Production vs. development: Detailed messages in dev, generic in production
- Logging is structured (Pino) not console.log

## Logging

**Framework:** Pino (structured logging)

**Creation Pattern:**
```typescript
import { createLogger } from '@/lib/logger/index';
const log = createLogger('API:ChatMessages');
```

**Patterns:**
- Log at API boundaries with context string: `createLogger('API:RouteName')`
- Module-level loggers for libraries: `createLogger('Service:Bedrock')`
- Structured logging with context objects: `log.info({ userId, duration }, 'Request completed')`
- Sensitive fields auto-redacted: auth tokens, passwords, API keys
- Development: Pretty-printed colored output via pino-pretty
- Production: JSON structured logs for aggregation

**When to Log:**
- Errors: Always log with context and stack (dev only)
- Warnings: Recoverable issues, degraded functionality
- Info: Important state transitions, operations completed
- Debug: Detailed diagnostic info (only in dev)

## Comments

**When to Comment:**
- Complex algorithms or business logic requiring explanation
- Non-obvious design decisions (WHY, not WHAT)
- Sections explaining next steps or future work (marked with // TODO, // FIXME)
- Deprecated features or workarounds (e.g., "Resend client kept for future use")
- JSDoc for public API functions

**JSDoc/TSDoc:**
```typescript
/**
 * Generate structured personality sections from ChatGPT conversations.
 *
 * Samples richest conversations, sends to Haiku 4.5 for analysis,
 * validates with Zod. Returns null on any failure.
 *
 * @param conversations - All parsed conversations from ChatGPT export
 * @returns QuickPassResult with all 5 sections, or null on failure
 */
export async function generateQuickPass(
  conversations: ParsedConversation[],
): Promise<QuickPassResult | null> {
```

**Comment Style:**
- Use `/**` for multi-line JSDoc blocks
- Use `//` for inline comments
- Avoid obvious comments (`const x = 5; // set x to 5`)

## Validation

**Framework:** Zod for runtime validation

**Location:** Centralized in `lib/api/schemas.ts` by domain

**Pattern:**
```typescript
// Define schema
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message required').max(50000),
  history: z.array(chatMessageSchema).max(100).default([]),
});

// Use in handler
const result = await parseRequestBody(request, chatRequestSchema);
if (result instanceof Response) return result; // Validation failed
const { message, history } = result; // Fully typed
```

**Validation Helper:**
- Use `parseRequestBody(request, schema)` from `lib/api/schemas.ts`
- Returns validated data or 400 Response
- Never expose raw Zod error details (security)

**Zod Patterns:**
- `.safeParse()` always used for optional/permissive parsing
- `.default()` used for optional fields with fallbacks
- `.preprocess()` for transforming data before validation
- `.refine()` for cross-field validation logic
- `.passthrough()` for allowing extra fields (ChatGPT exports)
- `.nullish()` (null | undefined) for missing optional fields

## Module Design

**Exports:**
- Named exports for utilities, helpers, types: `export function foo() {}`
- Default export for page components: `export default function Page() {}`
- Type exports when needed: `export type { TypeName }`

**Barrel Files:**
- Used for re-exporting at domain boundary (e.g., `lib/index.ts`)
- Minimal use; prefer explicit imports from modules

**Module-Level Organization:**
```typescript
// 1. Imports (external, types, internal)
// 2. Types & Interfaces
// 3. Constants
// 4. Helper functions (private)
// 5. Main exported functions
// 6. Validation/Schema exports
```

**Example from `lib/soulprint/quick-pass.ts`:**
```typescript
// 1. Imports
import { createLogger } from '@/lib/logger/index';
import type { ParsedConversation, QuickPassResult } from '@/lib/soulprint/types';

// 2. Module-level constant
const log = createLogger('Soulprint:QuickPass');

// 3-4. Helper function
function makeTestConversations(count = 5): ParsedConversation[] { }

// 5-6. Exported main function with JSDoc
export async function generateQuickPass(...) { }
export function sectionToMarkdown(...) { }
```

## Type Safety

**Configuration:**
- `strict: true` in tsconfig.json
- `noUncheckedIndexedAccess: true` prevents accessing array/object without bounds check
- All API responses typed: `NextResponse.json<APIErrorResponse>(data, options)`

**Type Inference:**
- TypeScript infers types where possible (return types on functions)
- Explicit types required for public APIs and complex functions
- Generic types used for reusable validation: `<T extends z.ZodType>`

## Special Patterns

**Bedrock Client (Singleton):**
- Module-level initialization: `const bedrockClient = new BedrockRuntimeClient(...)`
- Credentials from environment variables (non-null assertions safe at module level)
- Used across functions without re-initialization

**Supabase Client (Factory):**
- Different clients for different contexts:
  - `createClient()` from `@/lib/supabase/server` for user context
  - `createAdminClient()` from `@supabase/supabase-js` for server-side operations
- Admin client getter wrapped in function: `function getSupabaseAdmin() { }`

**Rate Limiting Pattern:**
- Check rate limit early in handler: `const rateLimited = await checkRateLimit(user.id, 'tier')`
- Return rate limit response if triggered: `if (rateLimited) return rateLimited`
- Three tiers: 'standard', 'expensive', 'upload'

**Fail-Safe Pattern (Critical):**
- Services that enhance (not block) must never throw
- Always return safe default on error: `catch (error) { return neutralDefault; }`
- Example: Emotion detection returns neutral state instead of crashing chat

---

*Convention analysis: 2026-02-11*
