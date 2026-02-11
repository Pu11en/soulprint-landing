# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner:**
- Vitest 4.0.18 (ESM-native, faster than Jest)
- Config: `vitest.config.mts`
- Environment: jsdom (for React component testing)

**Assertion Library:**
- Testing Library (React): `@testing-library/react`
- Vitest native: `expect()`, `describe()`, `it()`, `beforeEach()`, `afterEach()`

**Run Commands:**
```bash
npm run test              # Run tests in watch mode
npm run test:run         # Run tests once (CI mode)
npm run test:e2e         # Playwright E2E tests
```

## Test File Organization

**Location:**
- **Unit/Integration:** Co-located with source (`lib/soulprint/__tests__/quick-pass.test.ts`)
- **Library tests:** Next to module (`lib/utils.test.ts`)
- **Integration tests:** Under `tests/integration/api/` with route structure mirrored
- **Cross-language tests:** Under `__tests__/cross-lang/` for sync validation

**Naming:**
- `*.test.ts` suffix (preferred)
- File structure mirrors source structure for integration tests

**Example Structure:**
```
lib/
├── soulprint/
│   ├── quick-pass.ts
│   ├── emotional-intelligence.ts
│   └── __tests__/
│       ├── quick-pass.test.ts
│       └── emotional-intelligence.test.ts
tests/
├── setup.ts
├── mocks/
│   └── server.ts
└── integration/
    └── api/
        ├── health.test.ts
        ├── chat-messages.test.ts
        └── import/
            └── complete.test.ts
```

## Test Structure

**Suite Organization:**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateQuickPass } from '@/lib/soulprint/quick-pass';
import { bedrockChatJSON } from '@/lib/bedrock';

// Mock before import of module under test
vi.mock('@/lib/bedrock', () => ({
  bedrockChatJSON: vi.fn(),
}));

describe('generateQuickPass', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.mocked(bedrockChatJSON).mockReset();
  });

  it('returns parsed result when Bedrock returns valid JSON', async () => {
    // Arrange
    vi.mocked(bedrockChatJSON).mockResolvedValue(MOCK_RESULT);

    // Act
    const result = await generateQuickPass(makeTestConversations());

    // Assert
    expect(result).not.toBeNull();
    expect(result!.soul.communication_style).toBe(MOCK_RESULT.soul.communication_style);
  });
});
```

**Patterns:**
- `beforeEach()` resets mocks and state before each test
- `afterEach()` cleans up (MSW handlers, mocks)
- Arrange-Act-Assert (AAA) pattern per test
- Descriptive test names: `it('returns X when Y happens')`
- One logical assertion per test (multiple related assertions OK)

## Mocking

**Framework:** Vitest `vi` + MSW (Mock Service Worker) for HTTP

**Mocking Pattern:**

```typescript
// 1. Mock before importing module under test
vi.mock('@/lib/bedrock', () => ({
  bedrockChatJSON: vi.fn(),
}));

// 2. Import after mock is registered
import { generateQuickPass } from '@/lib/soulprint/quick-pass';
import { bedrockChatJSON } from '@/lib/bedrock';

// 3. Type-safe mocked function
const mockedBedrockChatJSON = vi.mocked(bedrockChatJSON);

// 4. In tests, reset and configure
mockedBedrockChatJSON.mockResolvedValue(MOCK_RESULT);
mockedBedrockChatJSON.mockRejectedValue(new Error('Service down'));
```

**HTTP Mocking (MSW):**

```typescript
// tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const server = setupServer(
  http.get('https://soulprint-landing.onrender.com/health', () => {
    return HttpResponse.json({ status: 'healthy' });
  }),
  http.get('https://test.supabase.co/rest/v1/profiles', () => {
    return HttpResponse.json([]);
  }),
);

// tests/setup.ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// In test, override handler
server.use(
  http.get('https://soulprint-landing.onrender.com/health', () => {
    return HttpResponse.json({ error: 'Down' }, { status: 500 });
  })
);
```

**What to Mock:**
- External service calls (Bedrock, Supabase, RLM)
- Time-dependent functions (Date, setTimeout)
- Logger (Pino) to prevent test output pollution
- Rate limiter (Redis) in unit tests
- File system operations (Cloudinary uploads)

**What NOT to Mock:**
- Pure utility functions (no side effects)
- Validation libraries (Zod)
- Error handling utilities
- Core business logic when testing full flow
- Internal service dependencies (test their real behavior)

## Fixtures and Factories

**Test Data Pattern:**

```typescript
// At module level, define realistic mock data
const MOCK_QUICK_PASS_RESULT: QuickPassResult = {
  soul: {
    communication_style: 'Direct and concise',
    personality_traits: ['analytical', 'curious'],
    // ... all fields
  },
  identity: { /* ... */ },
  // ... all sections
};

// Factory function for creating variable test data
function makeTestConversations(count = 5): ParsedConversation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `conv-${i}`,
    title: `Test Conversation ${i}`,
    createdAt: '2025-06-15T12:00:00Z',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      // ... minimum messages for test
    ],
  }));
}
```

**Location:**
- Fixtures defined at top of test file (before describe)
- Factory functions defined above describe blocks
- Shared fixtures in `tests/fixtures/` if used across multiple tests

**Realistic Data:**
- Full interface implementation (no partial objects)
- Values that exercise code paths (e.g., personality_traits array)
- Use actual domain values (not just `'test'`, `'data'`)

## Coverage

**Requirements:** No explicit target enforced, but coverage gaps identified in code

**View Coverage:**
```bash
npm run test:run -- --coverage
```

**Coverage Gaps (Known):**
- E2E tests for full import flow (UI -> API -> RLM)
- Cross-browser voice recording flow
- Error recovery paths in complex async operations
- Rate limiting edge cases (Redis failure modes)

## Test Types

**Unit Tests:**
- Scope: Single function/module in isolation
- Location: `lib/**/__tests__/*.test.ts` or `lib/**.test.ts`
- Mocks: All external dependencies
- Examples:
  - `lib/utils.test.ts` - Tests `cn()` class name utility
  - `lib/soulprint/__tests__/quick-pass.test.ts` - Tests generation logic
  - `lib/api/error-handler.test.ts` - Tests error transformation

**Integration Tests:**
- Scope: Full API route with mocked external services
- Location: `tests/integration/api/**/*.test.ts`
- Mocks: MSW for HTTP, some modules (logger, rate limiter)
- Real usage: Zod schemas, Supabase client SDK, error handlers
- Examples:
  - `tests/integration/api/health.test.ts` - Tests health check endpoint
  - `tests/integration/api/chat-messages.test.ts` - Tests chat flow

**E2E Tests:**
- Framework: Playwright
- Scope: Full user flow (not in codebase yet, only Playwright config exists)
- Location: Would be `tests/e2e/`
- No mocking: Real deployment/staging environment
- Usage pattern defined but not implemented

## Testing Patterns

**Async Testing:**

```typescript
it('returns parsed QuickPassResult when Bedrock succeeds', async () => {
  mockedBedrockChatJSON.mockResolvedValue(MOCK_QUICK_PASS_RESULT);

  const result = await generateQuickPass(makeTestConversations());

  expect(result).not.toBeNull();
});

it('returns null when Bedrock throws error', async () => {
  mockedBedrockChatJSON.mockRejectedValue(new Error('Service unavailable'));

  const result = await generateQuickPass(makeTestConversations());
  expect(result).toBeNull(); // Fail-safe pattern
});
```

**Error Testing:**

```typescript
it('returns 504 for TimeoutError', async () => {
  const timeoutError = new Error('Operation timed out');
  timeoutError.name = 'TimeoutError';

  const response = handleAPIError(timeoutError, 'API:Test');

  expect(response.status).toBe(504);
  const body = await response.json();
  expect(body.code).toBe('TIMEOUT');
});

it('includes error message in development', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const error = new Error('Detailed message');

  const response = handleAPIError(error, 'API:Test');
  const body = await response.json();

  expect(body.error).toBe('Detailed message');
});

it('returns generic message in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const error = new Error('Sensitive details');

  const response = handleAPIError(error, 'API:Test');
  const body = await response.json();

  expect(body.error).toBe('An error occurred'); // Generic
});
```

**Validation Testing (Zod):**

```typescript
it('accepts valid data', async () => {
  const result = await parseRequestBody(mockRequest, chatRequestSchema);

  if (result instanceof Response) {
    fail('Expected validated data, got error Response');
  }

  expect(result.message).toBeDefined();
  expect(result.history).toEqual([]);
});

it('returns 400 for invalid JSON', async () => {
  const invalidRequest = { json: () => Promise.reject(new SyntaxError()) };

  const result = await parseRequestBody(invalidRequest, chatRequestSchema);

  expect(result).toBeInstanceOf(Response);
  expect(result.status).toBe(400);
});

it('fills default values from schema', async () => {
  const partial = { message: 'Hi' }; // Missing 'history'

  const result = await parseRequestBody(mockRequest, chatRequestSchema);

  expect(result.history).toEqual([]); // Default applied
});
```

**Mock Spy Testing:**

```typescript
it('logs error with structured context', () => {
  const loggerErrorSpy = vi.spyOn(logger, 'error')
    .mockImplementation(() => logger);

  handleAPIError(new Error('test'), 'API:Test');

  expect(loggerErrorSpy).toHaveBeenCalled();
  loggerErrorSpy.mockRestore();
});

it('calls Bedrock with correct model', async () => {
  mockedBedrockChatJSON.mockResolvedValue(MOCK_RESULT);

  await generateQuickPass(makeTestConversations());

  expect(mockedBedrockChatJSON).toHaveBeenCalledTimes(1);
  const callArgs = mockedBedrockChatJSON.mock.calls[0]![0];
  expect(callArgs.model).toBe('HAIKU_45');
});
```

**Partial/Edge Case Testing:**

```typescript
it('fills missing fields with defaults via Zod preprocess', async () => {
  // Bedrock returns partial response
  mockedBedrockChatJSON.mockResolvedValue({
    soul: { communication_style: 'Direct' },
    identity: { ai_name: 'Spark' },
    // user, agents, tools missing
  });

  const result = await generateQuickPass(makeTestConversations());

  expect(result).not.toBeNull();
  expect(result!.soul.communication_style).toBe('Direct');
  expect(result!.soul.personality_traits).toEqual([]); // Default
  expect(result!.user.name).toBe(''); // Default
});

it('returns null when given empty conversations', async () => {
  const result = await generateQuickPass([]);

  expect(result).toBeNull();
  expect(mockedBedrockChatJSON).not.toHaveBeenCalled();
});
```

## Setup and Teardown

**Global Setup (`tests/setup.ts`):**

```typescript
import '@testing-library/jest-dom/vitest';
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Mock logger
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLoggerInstance),
};

vi.mock('@/lib/logger', () => ({
  logger: mockLoggerInstance,
  createLogger: vi.fn(() => mockLoggerInstance),
}));

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// MSW lifecycle
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());
```

**Per-Test Setup:**

```typescript
describe('generateQuickPass', () => {
  beforeEach(() => {
    // Reset mocks (most important)
    mockedBedrockChatJSON.mockReset();
  });

  afterEach(() => {
    // Most cleanup handled globally, but can override here
  });
});
```

## Test Utilities

**Helper Functions in Tests:**

```typescript
// Factory for creating test data with variability
function makeTestConversations(count = 5): ParsedConversation[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `conv-${i}`,
    // ... minimal required fields
  }));
}

// Example usage
it('processes multiple conversations', async () => {
  const conversations = makeTestConversations(10);
  const result = await generateQuickPass(conversations);
  expect(result).not.toBeNull();
});
```

**API Route Testing Utility:**

```typescript
import { testApiHandler } from 'next-test-api-route-handler';

it('returns 200 with health status', async () => {
  await testApiHandler({
    appHandler, // Route handler function
    async test({ fetch }) {
      const response = await fetch({ method: 'GET' });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('healthy');
    },
  });
});
```

## Running Tests

**Watch Mode (Development):**
```bash
npm run test
# Reruns tests on file changes
```

**CI Mode (Single Run):**
```bash
npm run test:run
# Runs all tests once, exits with status code
```

**Specific Test File:**
```bash
npm run test:run -- lib/utils.test.ts
npm run test:run -- tests/integration/api/health.test.ts
```

**With Coverage:**
```bash
npm run test:run -- --coverage
```

**Debug Mode:**
```bash
npm run test -- --inspect-brk
# Then open chrome://inspect in Chrome
```

---

*Testing analysis: 2026-02-11*
