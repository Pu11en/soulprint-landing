# Coding Conventions

**Analysis Date:** 2026-01-13

## Naming Patterns

**Files:**
- kebab-case for all files (`login-form.tsx`, `soulprint-management.ts`)
- `page.tsx`, `layout.tsx`, `route.ts` for Next.js conventions
- No `.test.ts` files detected (no test naming convention established)

**Functions:**
- camelCase for all functions (`signIn`, `createClient`, `processSoulPrint`)
- Async functions use standard names (no special prefix)
- Server Actions: action verbs (`signUp`, `signOut`, `updateSoulPrintName`)
- Event handlers: `handle*` or `on*` patterns

**Variables:**
- camelCase for variables and parameters
- UPPER_SNAKE_CASE for constants (`ACCESS_CODE = "7423"`)
- No underscore prefix for private members

**Types:**
- PascalCase for interfaces and types (`SoulPrint`, `QuestionnaireAnswer`)
- No `I` prefix for interfaces
- Props types suffixed with `Props` (`LoginFormProps`)

## Code Style

**Formatting:**
- 2 space indentation
- Single quotes for strings (based on observed code)
- Semicolons used (consistent)
- No `.prettierrc` detected (uses defaults)

**Linting:**
- ESLint 9.x with flat config (`eslint.config.mjs`)
- Extends Next.js recommended rules
- Run: `npm run lint`

## Import Organization

**Order:**
1. React/Next.js imports (`react`, `next/*`)
2. External packages (`@supabase/*`, `framer-motion`)
3. Internal modules (`@/lib/*`, `@/components/*`)
4. Relative imports (`./`, `../`)
5. Type imports (`import type {}`)

**Grouping:**
- Blank line between groups
- No strict alphabetical sorting observed

**Path Aliases:**
- `@/` maps to project root (configured in `tsconfig.json`)
- `@/components/*`, `@/lib/*`, `@/app/*`

## Error Handling

**Patterns:**
- Server Actions return `{ success: boolean, error?: string }` or use `redirect()`
- API routes return appropriate HTTP status codes with JSON
- Try/catch at boundary level (actions, API routes)

**Error Types:**
- No custom error classes detected
- Errors thrown with descriptive messages
- `redirect()` used for auth failures

**Example from `app/actions/auth.ts`:**
```typescript
export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({...});
  if (error) {
    return { error: error.message };
  }
  revalidatePath('/', 'layout');
  redirect('/dashboard/welcome');
}
```

## Logging

**Framework:**
- `console.log` for debugging
- `console.error` for errors
- `console.warn` for warnings
- No structured logging framework

**Patterns:**
- Debug logs with `[Component]` prefixes in some files
- API routes log request processing steps
- Should consider structured logging for production

## Comments

**When to Comment:**
- API endpoint descriptions (JSDoc-style headers)
- Complex business logic
- Configuration notes

**JSDoc/TSDoc:**
- Used for API route documentation
- Not consistently used elsewhere
- Type annotations provide most documentation

**TODO Comments:**
- Format: `// TODO: description`
- None found in current codebase (previously removed)

## Function Design

**Size:**
- Most functions under 50 lines
- Server Actions tend to be longer (orchestration)
- API routes well-structured with clear sections

**Parameters:**
- Use `FormData` for form actions
- Destructure objects for multiple params
- Type parameters explicitly

**Return Values:**
- Server Actions: `{ success, error? }` or `redirect()`
- API routes: `NextResponse.json()` with status
- Components: JSX

## Module Design

**Exports:**
- Named exports preferred
- Default exports for page components (Next.js convention)
- Re-export from index files in some libs (`lib/gemini/index.ts`)

**Server/Client:**
- `"use server"` directive for Server Actions
- `"use client"` directive for client components
- Server Components are default in app/

**Example patterns:**
```typescript
// Server Action
"use server"
export async function signUp(formData: FormData) {...}

// Client Component
"use client"
export function LoginForm() {...}

// Server Component (default)
export default async function DashboardPage() {...}
```

## React Patterns

**Hooks:**
- `useState` for local state
- `useEffect` for side effects
- `useRouter` for navigation
- Custom hooks not detected

**Component Structure:**
```typescript
"use client"

import { useState } from "react"
// ... other imports

export function ComponentName() {
    const [state, setState] = useState(...)

    // handlers
    const handleAction = () => {...}

    // effects
    useEffect(() => {...}, [deps])

    return (
        // JSX
    )
}
```

---

*Convention analysis: 2026-01-13*
*Update when patterns change*
