# Phase 6: Comprehensive Testing - Research

**Researched:** 2026-02-06
**Domain:** E2E and integration testing for Next.js App Router applications
**Confidence:** HIGH

## Summary

Comprehensive testing for Next.js App Router applications requires a layered approach combining integration tests (Vitest) and E2E tests (Playwright). The project already has Vitest + MSW + React Testing Library configured from Phase 1, establishing the foundation for integration testing. For E2E testing, Playwright is the modern standard with excellent Next.js support, offering parallelization, automatic waits, and strong debugging capabilities.

Key constraints: Tests must run offline in under 30 seconds with no external API calls. This is achievable through MSW for integration tests (intercepting network requests at the network layer) and Playwright with proper mocking patterns for E2E tests. The import flow presents the biggest testing challenge due to file uploads, asynchronous processing, and multiple external services (Supabase, RLM, Bedrock).

**Primary recommendation:** Use next-test-api-route-handler for isolated API route testing, Playwright for critical user flows (auth → import → chat), and leverage existing MSW infrastructure for consistent mocking across both layers.

## Standard Stack

The established libraries/tools for comprehensive Next.js App Router testing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.0+ | Integration test runner | Modern, fast, Vite-native with Jest compatibility. Official Next.js recommendation for unit/integration tests |
| @playwright/test | 1.49+ | E2E test framework | Industry standard for E2E, official Next.js recommended E2E framework, cross-browser support |
| MSW | 2.12+ | API mocking | Network-level interception, works in Node and browser, already configured in Phase 1 |
| @testing-library/react | 16.3+ | Component testing | De facto standard for React testing, encourages accessible patterns |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-test-api-route-handler | 5.0+ | API route testing | Isolated testing of App Router route handlers with Request/Response emulation |
| @testing-library/user-event | 14.6+ | User interaction simulation | Simulating realistic user input in component tests |
| jsdom | 28.0+ | DOM environment | Vitest environment for React component testing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright | Cypress | Cypress has better DX for debugging but slower, more flaky, requires separate test server. Playwright is faster, more stable, better parallelization |
| next-test-api-route-handler | Manual Request/Response mocking | Manual mocking is brittle, doesn't handle Next.js internals correctly (headers, cookies, redirects) |
| MSW | vi.mock() only | vi.mock() requires changing test code for each endpoint, MSW is declarative and mirrors real network behavior |

**Installation:**
```bash
# Playwright (not yet installed)
npm install -D @playwright/test
npx playwright install

# API route testing
npm install -D next-test-api-route-handler

# Already installed from Phase 1:
# - vitest
# - @testing-library/react
# - @testing-library/user-event
# - msw
# - jsdom
```

## Architecture Patterns

### Recommended Project Structure
```
tests/
├── setup.ts                    # Vitest global setup (already exists)
├── mocks/
│   ├── server.ts               # MSW server config (already exists)
│   ├── handlers.ts             # MSW request handlers (already exists)
│   └── fixtures/
│       ├── conversations.json  # Sample ChatGPT export
│       └── test-export.zip     # Valid test upload file
├── e2e/                        # NEW: Playwright tests
│   ├── auth.setup.ts           # Authentication setup project
│   ├── auth-flow.spec.ts       # Sign up/in/out tests
│   ├── import-flow.spec.ts     # Upload → process → complete
│   ├── chat-flow.spec.ts       # Authenticated chat interaction
│   └── pages/                  # Page Object Models
│       ├── LoginPage.ts
│       ├── ImportPage.ts
│       └── ChatPage.ts
├── integration/                # NEW: API route integration tests
│   └── api/
│       ├── health.test.ts
│       ├── chat.test.ts
│       └── import/
│           ├── process-server.test.ts
│           └── complete.test.ts
playwright.config.ts            # NEW: Playwright configuration
playwright/.auth/               # NEW: Cached authentication state (gitignored)
├── user.json                   # Saved session for tests

# Keep existing pattern:
lib/**/*.test.ts                # Unit tests co-located with source
app/api/**/*.test.ts            # API route tests co-located (future)
```

### Pattern 1: Integration Tests for API Routes (Vitest + next-test-api-route-handler)

**What:** Test individual API route handlers in isolation with mocked dependencies
**When to use:** For all API routes that have business logic, auth checks, validation

**Example:**
```typescript
// Source: https://github.com/Xunnamius/next-test-api-route-handler
import { testApiHandler } from 'next-test-api-route-handler'
import * as appHandler from '@/app/api/health/route'
import { server } from '@/tests/mocks/server'
import { http, HttpResponse } from 'msw'

describe('GET /api/health', () => {
  it('returns healthy status when all services available', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.status).toBe('healthy')
        expect(data.services).toMatchObject({
          supabase: 'healthy',
          rlm: 'healthy'
        })
      }
    })
  })

  it('returns degraded when RLM unavailable', async () => {
    // Override MSW handler for this test
    server.use(
      http.get('https://soulprint-landing.onrender.com/health', () => {
        return HttpResponse.json({ status: 'error' }, { status: 500 })
      })
    )

    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' })
        const data = await response.json()

        expect(data.status).toBe('degraded')
        expect(data.services.rlm).toBe('unhealthy')
      }
    })
  })
})
```

### Pattern 2: E2E Tests with Playwright Authentication

**What:** Test complete user flows from browser perspective with cached auth state
**When to use:** Critical user journeys (auth → import → chat), cross-page interactions

**Example:**
```typescript
// Source: https://playwright.dev/docs/auth
// tests/e2e/auth.setup.ts - Setup project runs once before all tests
import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  // Perform login
  await page.goto('/login')
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!)
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!)
  await page.click('button[type="submit"]')

  // Wait for redirect to ensure cookies are set
  await page.waitForURL('/dashboard')

  // Save auth state
  await page.context().storageState({
    path: 'playwright/.auth/user.json'
  })
})

// tests/e2e/import-flow.spec.ts - Tests reuse auth state
import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/user.json' })

test('complete import flow from upload to ready', async ({ page }) => {
  await page.goto('/import')

  // Upload file
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles('tests/mocks/fixtures/test-export.zip')

  // Wait for processing to complete (poll until status changes)
  await expect(page.locator('[data-testid="import-status"]'))
    .toHaveText('complete', { timeout: 60000 })

  // Verify can navigate to chat
  await page.click('a[href="/chat"]')
  await expect(page).toHaveURL('/chat')
})
```

### Pattern 3: Page Object Model for Maintainability

**What:** Encapsulate page-specific selectors and actions in dedicated classes
**When to use:** When multiple tests interact with the same page/component

**Example:**
```typescript
// Source: https://playwright.dev/docs/pom
// tests/e2e/pages/ImportPage.ts
import { Page, Locator } from '@playwright/test'

export class ImportPage {
  readonly page: Page
  readonly fileInput: Locator
  readonly uploadButton: Locator
  readonly statusIndicator: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.fileInput = page.locator('input[type="file"]')
    this.uploadButton = page.locator('button[type="submit"]')
    this.statusIndicator = page.locator('[data-testid="import-status"]')
    this.errorMessage = page.locator('[role="alert"]')
  }

  async goto() {
    await this.page.goto('/import')
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath)
    await this.uploadButton.click()
  }

  async waitForProcessingComplete(timeout = 60000) {
    await this.statusIndicator.waitFor({ state: 'visible', timeout })
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector)
        return el?.textContent === 'complete'
      },
      this.statusIndicator,
      { timeout }
    )
  }

  async getErrorMessage() {
    return this.errorMessage.textContent()
  }
}

// Usage in test
import { ImportPage } from './pages/ImportPage'

test('shows error for invalid file', async ({ page }) => {
  const importPage = new ImportPage(page)
  await importPage.goto()
  await importPage.uploadFile('tests/mocks/fixtures/invalid.txt')

  const error = await importPage.getErrorMessage()
  expect(error).toContain('Invalid file format')
})
```

### Pattern 4: MSW Handlers for Consistent Mocking

**What:** Define network request mocks once, reuse across integration and E2E tests
**When to use:** All external API calls (RLM, Bedrock, external services)

**Example:**
```typescript
// Source: https://mswjs.io/docs/quick-start/
// tests/mocks/handlers.ts - Already exists, extend for new endpoints
import { http, HttpResponse } from 'msw'

export const handlers = [
  // RLM endpoints
  http.post('https://soulprint-landing.onrender.com/create-soulprint', () => {
    return HttpResponse.json({
      soulprint: 'Mocked soulprint text for testing',
      success: true,
    })
  }),

  http.post('https://soulprint-landing.onrender.com/query', async ({ request }) => {
    const body = await request.json() as { query: string }
    return HttpResponse.json({
      response: `Mocked response for: ${body.query}`,
      memory_used: true,
    })
  }),

  // Bedrock (AWS SDK uses node-fetch internally)
  http.post('https://bedrock-runtime.*.amazonaws.com/model/*/invoke-with-response-stream', () => {
    // Mock streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"chunk": "Hello"}\n\n'))
        controller.enqueue(encoder.encode('data: {"chunk": " world"}\n\n'))
        controller.close()
      }
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  }),
]
```

### Anti-Patterns to Avoid

- **Testing implementation details:** Don't test internal state or private methods. Test behavior from user/consumer perspective
- **Shared mutable state:** Don't reuse objects across tests. Each test should create fresh instances in beforeEach
- **Hard-coded timeouts:** Use Playwright's auto-wait and explicit locators instead of `page.waitForTimeout(5000)`
- **UI-coupled selectors:** Avoid CSS class selectors that change with styling. Use data-testid, role, or label selectors
- **E2E for everything:** Don't test edge cases in E2E. Use fast integration tests for edge cases, E2E for happy paths only
- **No test isolation:** Don't let tests depend on each other's side effects. Each test should be runnable independently

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API route testing | Manual Request/Response mocking | next-test-api-route-handler | Handles Next.js internals (headers, cookies, edge runtime), maintained against Next.js releases |
| Network mocking | Fetch/axios mocks with vi.mock() | MSW (Mock Service Worker) | Works at network level, same handlers for Node/browser, more realistic than module mocks |
| File upload testing | Custom multipart/form-data parsing | FormData + setInputFiles() | Playwright and Vitest support FormData natively, avoids parsing complexity |
| Authentication state | Login before each test | Playwright storageState | 60-80% faster test execution by reusing cached auth sessions |
| Waiting for async updates | page.waitForTimeout() | Playwright auto-wait + expect() | Auto-retry assertions until condition met, eliminates flaky timeouts |
| Test parallelization | Custom worker pools | Playwright workers | Built-in parallelization with isolated browser contexts per worker |

**Key insight:** Modern testing tools have solved common patterns. Don't rebuild authentication caching, network mocking, or async waiting. Use proven libraries and focus on application-specific test logic.

## Common Pitfalls

### Pitfall 1: Flaky E2E Tests from Implicit Waits

**What goes wrong:** Tests pass locally but fail in CI due to timing issues. Developers start ignoring test failures as "just flakiness."

**Why it happens:** Using hard-coded `waitForTimeout()` or not waiting for network requests to complete before assertions. Different environments (CI vs local) have different performance characteristics.

**How to avoid:**
- Use Playwright's auto-wait: `await page.locator('text=Success').waitFor()`
- Use assertion retries: `await expect(locator).toHaveText('Expected', { timeout: 5000 })`
- Wait for network idle: `await page.waitForLoadState('networkidle')`
- Never use `page.waitForTimeout()` except for debugging

**Warning signs:**
- Tests that pass on retry but fail on first run
- Different results between local and CI
- Tests that only fail under load or when run in parallel

### Pitfall 2: Testing Async Server Components with Vitest

**What goes wrong:** Tests fail with "Cannot read properties of undefined" or timeout errors when testing Server Components with async data fetching.

**Why it happens:** Vitest does not support async Server Components due to React Server Components being new to the ecosystem. The testing environment doesn't properly handle server-side async rendering.

**How to avoid:**
- Use E2E tests (Playwright) for async Server Components
- Use integration tests for the underlying data fetching functions
- Test synchronous components with Vitest, async flows with Playwright
- Don't try to force Vitest to render async Server Components

**Warning signs:**
- Errors about missing React context in server component tests
- Tests timing out when rendering components with async data fetching
- Mocking entire component tree just to test a Server Component

### Pitfall 3: Not Isolating Tests (Shared State)

**What goes wrong:** Test A passes in isolation but fails when run after Test B. Tests produce different results when run in different orders.

**Why it happens:** Tests modify shared state (database, global variables, module-level mocks) without cleanup. Subsequent tests inherit polluted state.

**How to avoid:**
- Reset all mocks in `afterEach(() => vi.clearAllMocks())`
- Use `server.resetHandlers()` to restore default MSW handlers after each test
- Create fresh instances of objects in `beforeEach`, not at module level
- Use Playwright's `test.use()` for test-specific configuration
- Run tests with `--no-threads` to detect state sharing issues

**Warning signs:**
- Tests pass when run alone but fail in suite: `vitest run single.test.ts` works, `vitest run` fails
- Test order affects results
- Need to run tests in specific sequence

### Pitfall 4: Mocking Supabase Auth in Wrong Environment

**What goes wrong:** Tests fail with "cookieStore is not defined" when testing API routes that use Supabase auth (via next/headers).

**Why it happens:** Vitest runs in Node environment by default, but Supabase client creation in route handlers expects Next.js request context. The `createClient` from `@/lib/supabase/server` depends on `cookies()` from `next/headers`, which isn't available in test environment.

**How to avoid:**
- Mock `next/headers` in `tests/setup.ts` for Vitest environment
- Use `next-test-api-route-handler` which properly emulates Next.js environment
- For E2E tests, use real Supabase with test database or mock at network level with MSW
- Don't mock Supabase client directly; mock the underlying database calls or HTTP requests

**Warning signs:**
- "cookies is not a function" errors in route handler tests
- Tests requiring extensive mocking of Next.js internals
- Different behavior between test and production auth flows

### Pitfall 5: Slow E2E Tests (>30s Constraint Violation)

**What goes wrong:** E2E test suite takes minutes to run, violating the 30-second constraint. CI becomes a bottleneck.

**Why it happens:** Running too many E2E tests, testing edge cases that should be integration tests, or not using parallelization effectively.

**How to avoid:**
- **Scope E2E tests to critical user flows only:** Auth flow, import happy path, basic chat interaction
- **Use integration tests for edge cases:** Invalid uploads, error states, validation failures
- **Enable Playwright parallelization:** Configure workers in `playwright.config.ts`
- **Cache authentication state:** Don't log in for every test (saves 5-10s per test)
- **Mock slow external services:** RLM, Bedrock should be mocked to return instantly
- **Measure and monitor:** Run with `--reporter=html` to see which tests are slow

**Warning signs:**
- Test suite takes longer than 30 seconds total
- Individual E2E tests take >10 seconds
- Tests waiting for real external API responses
- Running 20+ E2E test cases (should be ~5-10 for critical flows)

### Pitfall 6: File Upload Tests Not Offline

**What goes wrong:** Import flow tests fail when run offline or in CI without network access. Tests upload to real Supabase storage.

**Why it happens:** Not mocking file upload endpoints. Supabase SDK makes actual HTTP requests to storage API.

**How to avoid:**
- Mock Supabase Storage API with MSW handlers for upload/download endpoints
- Use `next-test-api-route-handler` which supports MSW integration
- Create fixture files in `tests/mocks/fixtures/` for consistent test data
- For Playwright tests, intercept storage requests with `page.route()`
- Verify no network requests in tests: MSW should be in 'error' mode for unhandled requests

**Warning signs:**
- Tests fail with network errors when WiFi disconnected
- CI tests intermittently fail with timeout errors
- Test coverage drops when offline
- Seeing actual HTTP requests in test logs

## Code Examples

Verified patterns from official sources:

### Integration Test: API Route with Auth and Validation

```typescript
// Source: https://www.npmjs.com/package/next-test-api-route-handler
// tests/integration/api/chat.test.ts
import { testApiHandler } from 'next-test-api-route-handler'
import * as appHandler from '@/app/api/chat/route'
import { createMocks } from 'node-mocks-http'

describe('POST /api/chat', () => {
  it('requires authentication', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        // No auth headers
        const response = await fetch({
          method: 'POST',
          body: JSON.stringify({ message: 'Hello' }),
        })

        expect(response.status).toBe(401)
      }
    })
  })

  it('validates message length', async () => {
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Mock auth would go here in real test
          },
          body: JSON.stringify({
            message: 'x'.repeat(10001) // Exceeds 10k limit
          }),
        })

        const data = await response.json()
        expect(response.status).toBe(400)
        expect(data.code).toBe('VALIDATION_ERROR')
      }
    })
  })

  it('streams AI response with mocked Bedrock', async () => {
    // MSW handler already mocks Bedrock endpoint
    await testApiHandler({
      appHandler,
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: JSON.stringify({
            message: 'What is RLM?',
            conversationId: 'test-123'
          }),
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/event-stream')

        // Verify streaming response
        const reader = response.body?.getReader()
        const { value } = await reader!.read()
        const text = new TextDecoder().decode(value)
        expect(text).toContain('data:')
      }
    })
  })
})
```

### E2E Test: Complete Import Flow

```typescript
// Source: https://playwright.dev/docs/intro + https://medium.com/@ayushbhavsar1402/testing-file-uploads-downloads-and-pdfs-using-playwright-cd1de7bb2315
// tests/e2e/import-flow.spec.ts
import { test, expect } from '@playwright/test'
import { ImportPage } from './pages/ImportPage'

test.describe('Import Flow', () => {
  test.use({ storageState: 'playwright/.auth/user.json' })

  test('successfully imports ChatGPT export', async ({ page }) => {
    const importPage = new ImportPage(page)

    // Navigate to import page
    await importPage.goto()

    // Upload valid file
    await importPage.uploadFile('tests/mocks/fixtures/test-export.zip')

    // Verify upload started
    await expect(importPage.statusIndicator).toHaveText('processing', {
      timeout: 5000
    })

    // Wait for processing to complete (mocked RLM should be fast)
    await expect(importPage.statusIndicator).toHaveText('complete', {
      timeout: 30000
    })

    // Verify success message shown
    await expect(page.locator('text=Import complete')).toBeVisible()

    // Verify can navigate to chat
    await page.click('a[href="/chat"]')
    await expect(page).toHaveURL('/chat')
  })

  test('shows error for invalid file format', async ({ page }) => {
    const importPage = new ImportPage(page)
    await importPage.goto()

    // Upload invalid file
    await importPage.uploadFile('tests/mocks/fixtures/invalid.txt')

    // Verify error message
    const error = await importPage.getErrorMessage()
    expect(error).toContain('Invalid file format')

    // Verify still on import page
    await expect(page).toHaveURL('/import')
  })

  test('blocks chat access during processing', async ({ page }) => {
    await page.goto('/chat')

    // Should redirect to import page if not complete
    await expect(page).toHaveURL('/import')
    await expect(page.locator('text=Processing')).toBeVisible()
  })
})
```

### Playwright Config with Parallelization

```typescript
// Source: https://playwright.dev/docs/test-parallel
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail build on CI if tests left .only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit workers
  workers: process.env.CI ? 1 : undefined, // 1 in CI, 50% of cores locally

  // Shared timeout
  timeout: 30 * 1000, // 30s max per test

  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for setup + tests
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Chromium tests depend on setup
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Web server config
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
```

### MSW Setup for Offline Testing

```typescript
// Source: https://vitest.dev/guide/mocking/requests + https://mswjs.io/docs/quick-start/
// tests/setup.ts (already exists, extend)
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from './mocks/server'

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error' // Fail on unmocked requests (ensures offline)
  })
})

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers()
})

// Clean up after all tests
afterAll(() => {
  server.close()
})

// Mock next/headers for API route tests
import { vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
}))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest | Vitest | 2023 | 10x faster test runs, native ESM support, Vite integration |
| Cypress | Playwright | 2023-2024 | Better parallelization, more stable, cross-browser support built-in |
| Manual Request mocking | next-test-api-route-handler | 2023 | Accurate Next.js behavior emulation, handles App Router correctly |
| fetch/axios mocks | MSW | 2022-2023 | Network-level mocking works in Node + browser, more realistic |
| Login before every test | storageState caching | 2023 | 60-80% faster E2E test execution |
| CSS selectors | data-testid + role selectors | Ongoing | More stable tests, better accessibility |

**Deprecated/outdated:**
- **Jest:** Still works but Vitest is faster and better integrated with modern tooling (Vite, ESM)
- **enzyme:** React Testing Library is the standard, enzyme doesn't support React 18+ hooks well
- **Page Router testing patterns:** App Router has different testing requirements (Server Components, route handlers)
- **waitForTimeout() in Playwright:** Use auto-wait and expect() with timeout instead

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase RLS Testing in Integration Tests**
   - What we know: Can mock Supabase client at network level with MSW
   - What's unclear: Best pattern for testing RLS policies without hitting real database
   - Recommendation: Use network-level mocks for integration tests, consider separate RLS verification tests against test database if RLS bugs are common

2. **Import Flow Processing Time in E2E Tests**
   - What we know: Real processing can take 30s-5min depending on file size
   - What's unclear: How to realistically test timeout/progress without waiting full duration
   - Recommendation: Mock RLM to return instantly, test timeout behavior separately with integration tests using artificial delays

3. **Streaming Response Testing (Bedrock AI Chat)**
   - What we know: Can mock streaming with ReadableStream in MSW
   - What's unclear: Best pattern for asserting on stream chunks in integration tests
   - Recommendation: Test stream parsing logic separately, E2E test should verify stream starts and completes, not content

## Sources

### Primary (HIGH confidence)
- [Playwright Official Documentation - Installation](https://playwright.dev/docs/intro) - Installation, configuration, project setup
- [Playwright Official Documentation - Authentication](https://playwright.dev/docs/auth) - Storage state pattern, setup projects
- [Playwright Official Documentation - Parallelism](https://playwright.dev/docs/test-parallel) - Worker configuration, performance
- [Next.js Official Documentation - Testing with Vitest](https://nextjs.org/docs/app/guides/testing/vitest) - App Router limitations, setup
- [Next.js Official Documentation - Testing with Playwright](https://nextjs.org/docs/pages/guides/testing/playwright) - Official Next.js integration
- [MSW Official Documentation - Quick Start](https://mswjs.io/docs/quick-start/) - Network mocking patterns
- [Vitest Official Documentation - Mocking Requests](https://vitest.dev/guide/mocking/requests) - MSW integration
- [next-test-api-route-handler - npm](https://www.npmjs.com/package/next-test-api-route-handler) - API route testing library

### Secondary (MEDIUM confidence)
- [Testing Next.js app router API routes - Arcjet Blog](https://blog.arcjet.com/testing-next-js-app-router-api-routes/) - App Router testing patterns
- [End-to-End Testing Auth Flows with Playwright and Next.js - Test Double](https://testdouble.com/insights/how-to-test-auth-flows-with-playwright-and-next-js) - Auth testing patterns
- [Testing File Uploads with Playwright - Medium](https://medium.com/@ayushbhavsar1402/testing-file-uploads-downloads-and-pdfs-using-playwright-cd1de7bb2315) - File upload testing
- [Page Object Model with Playwright - BrowserStack](https://www.browserstack.com/guide/page-object-model-with-playwright) - POM pattern examples
- [Integration Testing vs End-to-End Testing - Autonoma AI](https://www.getautonoma.com/blog/integration-vs-e2e-testing) - When to use each approach
- [Unit and E2E Tests with Vitest & Playwright - Strapi](https://strapi.io/blog/nextjs-testing-guide-unit-and-e2e-tests-with-vitest-and-playwright) - Combined testing strategy

### Tertiary (LOW confidence - flagged for validation)
- Various Medium articles and blog posts from search results - Patterns verified against official docs before inclusion

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Next.js recommendations, widely adopted in ecosystem
- Architecture patterns: HIGH - Verified from official Playwright/Vitest/MSW documentation
- Common pitfalls: MEDIUM - Based on community experience and official troubleshooting guides, some project-specific assumptions
- Code examples: HIGH - Sourced from official documentation and maintained libraries
- Offline testing constraint: HIGH - MSW and Playwright both designed for offline operation

**Research date:** 2026-02-06
**Valid until:** ~60 days (testing tools are relatively stable, but Next.js releases may introduce changes)
