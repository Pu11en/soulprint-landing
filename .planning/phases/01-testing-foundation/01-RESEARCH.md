# Phase 1: Testing Foundation - Research

**Researched:** 2026-02-06
**Domain:** Vitest + React Testing Library + MSW for Next.js 16 App Router
**Confidence:** HIGH

## Summary

Testing foundation for Next.js 16 App Router applications uses Vitest as the test runner (10-20x faster than Jest, native ESM support), React Testing Library for component testing, and Mock Service Worker v2 for API mocking at the network level. This stack is officially recommended by Next.js and represents the current best practice as of 2026.

**Key findings:**
- Vitest 4.x is production-ready with excellent Next.js 16 support via official guide
- React Testing Library works seamlessly for Client Components and synchronous Server Components
- MSW v2 intercepts HTTP requests at the network level (not fetch replacement)
- Async Server Components require E2E tests (Vitest doesn't support them)

**Primary recommendation:** Use Vitest with jsdom environment, configure path aliases with vite-tsconfig-paths, and set up MSW for all API/external service mocking. Start with utility function tests to validate configuration, then move to component tests.

## Standard Stack

The established libraries/tools for Next.js 16 testing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test runner and assertion library | Official Next.js recommendation, 10-20x faster than Jest, native ESM, no config transpilation needed |
| @testing-library/react | latest | Component testing utilities | De facto standard for React testing, tests user behavior not implementation |
| @testing-library/jest-dom | latest | Custom DOM matchers | Provides semantic matchers (toBeInTheDocument, toBeVisible, etc.) |
| jsdom | latest | Browser environment simulation | Required for React component testing in Node.js |
| msw | ^2.12.8 | API mocking at network level | Industry standard, intercepts real HTTP, works with fetch/axios/etc |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | latest | React support for Vite/Vitest | Required for JSX/TSX transformation |
| vite-tsconfig-paths | latest | TypeScript path alias resolution | Required if using `@/*` path aliases (this project uses them) |
| @testing-library/user-event | latest | Realistic user interaction simulation | Better than fireEvent for complex interactions (typing, clicking, etc.) |
| msw/node | Part of msw | MSW Node.js integration | Required for test environment (not browser) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest | Jest | Jest requires complex config for Next.js 16, slower, requires ts-jest for TypeScript |
| MSW | Manual fetch mocking | MSW is network-level (more realistic), handles all HTTP libs, less brittle |
| jsdom | happy-dom | happy-dom faster but less compatible, jsdom is safer default |

**Installation:**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw vite-tsconfig-paths
```

## Architecture Patterns

### Recommended Project Structure

Two common patterns exist, both valid:

**Option A: Co-located tests (Recommended for small/medium projects)**
```
app/
├── page.tsx
├── page.test.tsx          # Test next to component
lib/
├── utils.ts
├── utils.test.ts          # Test next to utility
├── gamification/
│   ├── xp.ts
│   └── xp.test.ts         # Test next to module
```

**Option B: Dedicated test directory (Recommended for large projects)**
```
src/
├── app/
├── lib/
__tests__/                 # Mirror src structure
├── app/
│   └── page.test.tsx
├── lib/
│   ├── utils.test.ts
│   └── gamification/
│       └── xp.test.ts
```

**For this project:** Option A (co-located) is recommended because:
- Project is small/medium size
- Easier to find tests when modifying code
- Next.js 16 automatically excludes `*.test.*` from build
- Can refactor to Option B later if needed

**MSW setup structure:**
```
tests/
├── setup.ts              # Vitest setup file (imports @testing-library/jest-dom)
└── mocks/
    ├── handlers.ts       # MSW request handlers
    └── server.ts         # MSW server instance
```

### Pattern 1: Utility Function Testing
**What:** Pure function testing with arrange-act-assert pattern
**When to use:** Testing utilities, calculations, parsers (e.g., XP system, cn() function)

**Example:**
```typescript
// lib/gamification/xp.test.ts
// Source: https://nextjs.org/docs/app/guides/testing/vitest
import { describe, it, expect } from 'vitest'
import { XP_CONFIG } from './xp'

describe('XP_CONFIG', () => {
  describe('calculateLevel', () => {
    it('calculates level 1 for 0 XP', () => {
      expect(XP_CONFIG.calculateLevel(0)).toBe(1)
    })

    it('calculates correct level for 150 XP', () => {
      // Level 1 threshold: 100 * 1.1 = 110
      // At 150 XP, should be level 2
      expect(XP_CONFIG.calculateLevel(150)).toBe(2)
    })
  })

  describe('getLevelProgress', () => {
    it('returns progress for current level', () => {
      const progress = XP_CONFIG.getLevelProgress(50)
      expect(progress.current).toBe(50)
      expect(progress.percentage).toBeGreaterThan(0)
      expect(progress.percentage).toBeLessThanOrEqual(100)
    })
  })
})
```

### Pattern 2: React Component Testing
**What:** Testing component rendering and user interactions
**When to use:** Client Components and synchronous Server Components

**Example:**
```typescript
// app/components/button.test.tsx
// Source: https://nextjs.org/docs/app/guides/testing/vitest
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledOnce()
  })
})
```

### Pattern 3: API Mocking with MSW
**What:** Network-level request interception for testing components that fetch data
**When to use:** Any component or function making HTTP requests

**Example:**
```typescript
// tests/mocks/handlers.ts
// Source: https://mswjs.io/docs/integrations/node
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/user', () => {
    return HttpResponse.json({
      id: '1',
      name: 'Test User',
      email: 'test@example.com'
    })
  }),

  http.post('/api/chat', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      message: 'Response to: ' + body.message
    })
  })
]
```

```typescript
// tests/mocks/server.ts
// Source: https://mswjs.io/docs/integrations/node
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

### Pattern 4: Setup File Configuration
**What:** Global test setup executed before all tests
**When to use:** Always - configures jest-dom matchers and MSW

**Example:**
```typescript
// tests/setup.ts
// Sources:
// - https://markus.oberlehner.net/blog/using-testing-library-jest-dom-with-vitest
// - https://mswjs.io/docs/integrations/node
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen())

// Reset handlers after each test (important for test isolation)
afterEach(() => server.resetHandlers())

// Clean up after tests are finished
afterAll(() => server.close())
```

### Anti-Patterns to Avoid

- **Testing implementation details:** Don't test CSS classes, internal state, or component structure. Test user-visible behavior.
- **Destructuring from render():** Use `screen` queries instead of destructuring from `render()` return value
- **Not awaiting async operations:** Always await `userEvent` interactions and `findBy*` queries
- **Using getBy* for async content:** Use `findBy*` (async) or `waitFor()` for content that appears after render
- **Asserting on CSS styles:** Don't test `style` attributes or className; test visibility with `toBeVisible()` instead
- **Hand-rolling fetch mocks:** Use MSW instead of `vi.mock('fetch')` - more realistic and maintainable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mocking fetch/axios | Manual `vi.mock()` on fetch | MSW handlers | Network-level, works with all HTTP libs, more realistic, easier to maintain |
| User interactions | `fireEvent` | `@testing-library/user-event` | Simulates real user behavior (multiple events per action), better async handling |
| Custom DOM matchers | Manual `.toBe()` checks | `@testing-library/jest-dom` | Semantic matchers with better error messages |
| Path alias resolution | Manual tsconfig parsing | `vite-tsconfig-paths` plugin | Automatic, maintained, handles edge cases |
| Component isolation | Complex manual setup | `render()` from RTL | Handles providers, cleanup, queries automatically |
| Async waiting | Manual `setTimeout` loops | `waitFor()`, `findBy*` queries | Proper retry logic, timeout handling, better errors |

**Key insight:** Testing infrastructure has matured significantly. The standard stack handles edge cases you won't discover until production (DOM cleanup between tests, timer management, memory leaks, etc.). Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: Testing Implementation Details
**What goes wrong:** Tests break when refactoring without behavior changes (e.g., checking className, internal state)
**Why it happens:** Natural inclination to test what's "testable" rather than what matters to users
**How to avoid:**
- Query by role, label, or text (what users see): `screen.getByRole('button', { name: /submit/i })`
- Don't query by test IDs unless absolutely necessary
- Ask: "Would a user know/care about this?"
**Warning signs:** Importing component internals, checking `classList.contains()`, testing props directly

**Example:**
```typescript
// ❌ BAD - Tests implementation
expect(button.classList.contains('bg-blue-500')).toBe(true)

// ✅ GOOD - Tests user-visible behavior
expect(screen.getByRole('button')).toBeVisible()
```

### Pitfall 2: Not Awaiting User Interactions
**What goes wrong:** "Warning: An update to X inside a test was not wrapped in act(...)" errors
**Why it happens:** `userEvent` is async but developers forget to await
**How to avoid:**
- Always `await` userEvent methods: `await user.click(button)`
- Set up user with `const user = userEvent.setup()` at test start
- Use `findBy*` queries (async) for content that appears after interaction
**Warning signs:** `act()` warnings, flaky tests, "element not found" errors

**Example:**
```typescript
// ❌ BAD - Not awaiting
const user = userEvent.setup()
user.click(button) // Missing await!
expect(screen.getByText('Clicked')).toBeInTheDocument()

// ✅ GOOD - Properly awaited
const user = userEvent.setup()
await user.click(button)
expect(await screen.findByText('Clicked')).toBeInTheDocument()
```

### Pitfall 3: Async Server Components
**What goes wrong:** Cannot render async Server Components in Vitest
**Why it happens:** Vitest doesn't support React's async component rendering (new in React 19)
**How to avoid:**
- Extract synchronous logic to separate functions and test those
- Use E2E tests (Playwright) for async Server Components
- Test API routes separately from components
**Warning signs:** TypeScript errors when importing Server Components, render() failures with async components

### Pitfall 4: Incorrect Path Alias Resolution
**What goes wrong:** Tests fail with "Cannot find module '@/lib/utils'" even though code builds
**Why it happens:** Vitest doesn't read tsconfig.json paths by default
**How to avoid:** Install and configure `vite-tsconfig-paths` plugin in vitest.config
**Warning signs:** Module not found errors for `@/*` imports in tests

**Example:**
```typescript
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths' // ← Required!

export default defineConfig({
  plugins: [tsconfigPaths(), react()], // ← Order matters
  test: {
    environment: 'jsdom',
  },
})
```

### Pitfall 5: Forgetting MSW Server Cleanup
**What goes wrong:** Tests interfere with each other, handlers from one test affect others
**Why it happens:** MSW server needs explicit reset between tests
**How to avoid:**
- Use `afterEach(() => server.resetHandlers())` in setup file
- Use `beforeAll/afterAll` for server lifecycle, not `beforeEach/afterEach`
**Warning signs:** Flaky tests, wrong mock data appearing, tests pass in isolation but fail together

### Pitfall 6: Using screen After Unmount
**What goes wrong:** "Unable to find element" errors when querying after component cleanup
**Why it happens:** React Testing Library automatically unmounts after each test
**How to avoid:** Don't query screen outside test scope, each test gets fresh render
**Warning signs:** Intermittent failures, "TestingLibraryElementError" messages

### Pitfall 7: Missing TypeScript Types
**What goes wrong:** TypeScript errors: "Cannot find name 'describe'" or "'toBeInTheDocument' does not exist"
**Why it happens:** TypeScript doesn't know about Vitest globals or jest-dom matchers
**How to avoid:**
- Add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to tsconfig.json
- Import from setup file: `import '@testing-library/jest-dom/vitest'`
- Use `globals: true` in vitest.config if you want global describe/it/expect
**Warning signs:** Red squiggles in IDE, TypeScript compile errors in tests

## Code Examples

Verified patterns from official sources:

### Complete Vitest Configuration
```typescript
// vitest.config.mts
// Source: https://nextjs.org/docs/app/guides/testing/vitest
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['node_modules', '.next', 'dist'],
  },
})
```

### Complete Setup File
```typescript
// tests/setup.ts
// Sources:
// - https://markus.oberlehner.net/blog/using-testing-library-jest-dom-with-vitest
// - https://mswjs.io/docs/integrations/node
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### Testing Utility Function (Good First Test)
```typescript
// lib/utils.test.ts
// Source: React Testing Library best practices
import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible')
  })

  it('merges Tailwind classes correctly', () => {
    // twMerge deduplicates conflicting classes
    expect(cn('px-2 px-4')).toBe('px-4')
  })
})
```

### Testing Complex Calculations
```typescript
// lib/gamification/xp.test.ts
// Source: Vitest documentation patterns
import { describe, it, expect } from 'vitest'
import { XP_CONFIG } from './xp'

describe('XP System', () => {
  describe('calculateLevel', () => {
    it.each([
      [0, 1],
      [50, 1],
      [110, 2],
      [500, 3],
    ])('returns level %i for %i XP', (xp, expectedLevel) => {
      expect(XP_CONFIG.calculateLevel(xp)).toBe(expectedLevel)
    })
  })

  describe('getLevelProgress', () => {
    it('returns valid progress data', () => {
      const progress = XP_CONFIG.getLevelProgress(50)

      expect(progress).toEqual({
        current: expect.any(Number),
        needed: expect.any(Number),
        percentage: expect.any(Number),
      })
      expect(progress.percentage).toBeGreaterThanOrEqual(0)
      expect(progress.percentage).toBeLessThanOrEqual(100)
    })
  })
})
```

### MSW Handler for External API
```typescript
// tests/mocks/handlers.ts
// Source: https://mswjs.io/docs/integrations/node
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock RLM service
  http.post('https://soulprint-landing.onrender.com/query', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      response: 'Mocked response',
      memory_used: true,
    })
  }),

  // Mock Supabase (if needed)
  http.get('https://swvljsixpvvcirjmflze.supabase.co/rest/v1/*', () => {
    return HttpResponse.json({ data: [] })
  }),
]
```

### Component Test with User Interaction
```typescript
// components/chat-input.test.tsx
// Source: https://testing-library.com/docs/user-event/intro
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './chat-input'

describe('ChatInput', () => {
  it('calls onSubmit when form is submitted', async () => {
    const handleSubmit = vi.fn()
    const user = userEvent.setup()

    render(<ChatInput onSubmit={handleSubmit} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'Hello world')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(handleSubmit).toHaveBeenCalledWith('Hello world')
  })

  it('disables submit when input is empty', () => {
    render(<ChatInput onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest | 2023-2024 | 10-20x faster, native ESM, no transpilation config needed |
| Manual fetch mocking | MSW v2 | 2023 (v2.0 released) | Network-level mocking, framework-agnostic, more realistic |
| fireEvent | @testing-library/user-event | 2020-2021 | More realistic user interactions, better async handling |
| Pages Router testing | App Router testing | 2023-2024 | New patterns for Server Components (async not supported in unit tests) |
| happy-dom | jsdom | Ongoing | jsdom more compatible but slower; happy-dom gaining traction for speed |

**Deprecated/outdated:**
- **jest.config.js with babel**: Replaced by vitest.config with native ESM - no transpilation needed
- **MSW v1 API**: MSW v2 uses Fetch API primitives, different setup (`http.get` vs `rest.get`)
- **enzyme**: Deprecated, replaced by React Testing Library since React 16.8+ (hooks)
- **@testing-library/react-hooks**: Merged into main library, no longer separate package

## Open Questions

Things that couldn't be fully resolved:

1. **Async Server Component Testing**
   - What we know: Vitest doesn't support async Server Components (official Next.js docs confirm)
   - What's unclear: Timeline for support, if ever (React 19 feature is new)
   - Recommendation: Use E2E tests (Playwright, Phase 6) for async Server Components; extract testable logic to utilities

2. **Next.js 16 Specific Changes**
   - What we know: Official Next.js Vitest guide works with Next.js 16 (confirmed by web search dated 2026)
   - What's unclear: Any Next.js 16-specific edge cases not documented yet
   - Recommendation: Start with standard setup, address issues as discovered

3. **MSW with Supabase Client**
   - What we know: MSW intercepts HTTP requests; Supabase uses REST API
   - What's unclear: Whether Supabase SSR client needs special handling
   - Recommendation: Start with standard MSW handlers for Supabase endpoints; may need to mock `createClient()` if SSR client doesn't use standard fetch

## Sources

### Primary (HIGH confidence)
- [Testing: Vitest | Next.js](https://nextjs.org/docs/app/guides/testing/vitest) - Official Next.js documentation
- [Configuring Vitest | Vitest](https://vitest.dev/config/) - Official Vitest documentation
- [Node.js integration - Mock Service Worker](https://mswjs.io/docs/integrations/node) - Official MSW documentation
- [Using Testing Library jest-dom with Vitest - Markus Oberlehner](https://markus.oberlehner.net/blog/using-testing-library-jest-dom-with-vitest) - Verified setup pattern

### Secondary (MEDIUM confidence)
- [React Testing Library + Vitest: The Mistakes That Bite](https://medium.com/@samueldeveloper/react-testing-library-vitest-the-mistakes-that-haunt-developers-and-how-to-fight-them-like-ca0a0cda2ef8) - Common pitfalls guide
- [Where to put your tests in a Node project structure](https://coreycleary.me/where-to-put-your-tests-in-a-node-project-structure) - Directory structure patterns
- [API Testing with Vitest in Next.js](https://medium.com/@sanduni.s/api-testing-with-vitest-in-next-js-a-practical-guide-to-mocking-vs-spying-5e5b37677533) - API testing patterns

### Tertiary (LOW confidence)
- Version numbers from npm search (Vitest 4.0.18, MSW 2.12.8) - should be verified during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js docs + official Vitest/MSW docs all agree
- Architecture: HIGH - Multiple authoritative sources + Next.js example repo confirms patterns
- Pitfalls: MEDIUM - Based on community articles and documentation, but consistently reported

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - testing tooling is stable, not fast-moving)
