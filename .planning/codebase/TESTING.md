# Testing Patterns

**Analysis Date:** 2026-02-11

## Test Framework

**Runner - TypeScript:**
- Framework: Vitest (configured in `vitest.config.mts`)
- Environment: jsdom (browser-like testing)
- Assertion library: Vitest built-in expect (matches Chai/Jest syntax)

**Runner - Python:**
- Framework: pytest (used in `test_dag_parser.py`)
- No config file detected; standard pytest conventions

**Run Commands:**
```bash
# TypeScript
npm test                # Watch mode (default)
npm run test:run        # Single run (CI mode)
npm run test:e2e        # Playwright end-to-end tests

# Python (manual)
pytest rlm-service/processors/test_dag_parser.py  # Run specific test file
```

## Test File Organization

**Location:**
- TypeScript: Co-located with source code
  - `lib/api/error-handler.test.ts` next to `lib/api/error-handler.ts`
  - `lib/api/ttl-cache.test.ts` next to `lib/api/ttl-cache.ts`
  - `__tests__/` directory for integration/cross-language tests
- Python: Co-located in same package directory
  - `rlm-service/processors/test_dag_parser.py` next to `processors/dag_parser.py`

**Naming:**
- TypeScript: `{name}.test.ts` (primary convention)
- Python: `test_{name}.py`

**Structure:**
```
TypeScript:
lib/api/
├── error-handler.ts
├── error-handler.test.ts
├── schemas.ts
└── ttl-cache.test.ts

Python:
rlm-service/processors/
├── dag_parser.py
├── test_dag_parser.py
├── fact_extractor.py
└── conversation_chunker.py
```

## Test Structure

**TypeScript Pattern:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleAPIError } from '@/lib/api/error-handler';

describe('handleAPIError', () => {
  let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Setup: mock logger
    loggerErrorSpy = vi.spyOn(logger.logger, 'error').mockImplementation(() => logger.logger);
  });

  afterEach(() => {
    // Cleanup: restore spies and clear mocks
    loggerErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('should return 504 with TIMEOUT code for TimeoutError', async () => {
    const timeoutError = new Error('Operation timed out');
    timeoutError.name = 'TimeoutError';

    const response = handleAPIError(timeoutError, 'API:Test');

    expect(response.status).toBe(504);
    const body = (await response.json()) as APIErrorResponse;
    expect(body.code).toBe('TIMEOUT');
  });
});
```

**Python Pattern:**
```python
import pytest
from .dag_parser import extract_active_path, is_visible_message, extract_content

class TestExtractActivePath:
    """Tests for backward DAG traversal."""

    def test_branching_conversation_returns_active_branch(self):
        """Conversation with edits/regenerations: only active branch returned."""
        conversation = {
            "id": "conv-branch",
            "mapping": {
                "node-root": _make_node("node-root", None, ["node-user"], role=None),
                ...
            },
        }

        result = extract_active_path(conversation)

        assert len(result) == 3
        assert result[0]["content"] == "Hello"
        assert "Old response" not in [m["content"] for m in result]
```

**Key Patterns:**
- **Setup phase**: `beforeEach()` (TypeScript) or methods in class (Python)
- **Teardown phase**: `afterEach()` (TypeScript) or `finally:` blocks (Python)
- **Assertion phase**: `expect()` chains (TypeScript), `assert` statements (Python)
- **Descriptive test names**: Read as behavior specification (e.g., `test_branching_conversation_returns_active_branch`)

## Mocking

**Framework - TypeScript:**
- Tool: Vitest `vi` module (built-in mock/spy utilities)
- MSW (Mock Service Worker): For HTTP mocking — see `tests/mocks/server.ts`

**Framework - Python:**
- Pytest fixtures and helpers
- Manual mock objects (see `test_dag_parser.py` with `_make_node()` helper for fixtures)

**Common Patterns:**

**TypeScript Mocking:**
```typescript
// Mock function
vi.mock('@/lib/logger', () => ({
  logger: mockLoggerInstance,
  createLogger: vi.fn(() => mockLoggerInstance),
}))

// Spy on existing function
loggerErrorSpy = vi.spyOn(logger.logger, 'error').mockImplementation(() => logger.logger);

// Stub environment variable
vi.stubEnv('NODE_ENV', 'development');

// Restore after test
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
})
```

**Python Mocking:**
```python
# Fixture helper
def _make_node(node_id, parent, children, role="user", content_parts=None):
    """Helper to build a mapping node with message."""
    return {
        "id": node_id,
        "message": {...},
        "parent": parent,
        "children": children,
    }

# Used in test
conversation = {
    "mapping": {
        "node-root": _make_node("node-root", None, ["node-user"], role=None),
        ...
    }
}
```

**What to Mock:**
- External dependencies: Logger, rate limiter, HTTP clients (httpx in Python)
- Time-dependent behavior: Use `vi.useFakeTimers()` for time manipulation
- Error conditions: Create error instances with specific properties (e.g., `error.name = 'TimeoutError'`)

**What NOT to Mock:**
- Core business logic (the function being tested)
- Domain models or data structures
- Internal helper functions (test through public API)
- Synchronous pure functions

## Fixtures and Factories

**TypeScript Patterns:**

```typescript
// Fake timers for TTLCache tests
describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should store and retrieve value within TTL', () => {
    const cache = new TTLCache<string>(30 * 60 * 1000);
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    cache.destroy();
  });
});
```

**Python Patterns:**
```python
# Helper fixture for building conversation nodes
def _make_node(node_id, parent, children, role="user", content_parts=None, create_time=0, metadata=None):
    """Helper to build a mapping node with message."""
    msg = None
    if role is not None:
        msg = {
            "author": {"role": role},
            "content": {"parts": content_parts or [""]},
            "create_time": create_time,
            "metadata": metadata or {},
        }
    return {
        "id": node_id,
        "message": msg,
        "parent": parent,
        "children": children,
    }

# Test data location
# Fixtures defined inline in test classes (no separate fixtures directory)
# Realistic test data structures (ChatGPT export formats) defined in docstrings/comments
```

## Coverage

**Requirements:** Not enforced (no coverage threshold detected in config)
- Coverage tool: Likely available but not mandatory for CI
- Tests exist for: Error handling, caching, validation, parsing

**View Coverage:**
```bash
npm run test:run -- --coverage    # (if vitest coverage plugin installed)
```

**Focus areas with tests:**
- `lib/api/error-handler.test.ts` - Exception handling, environment-specific messages
- `lib/api/ttl-cache.test.ts` - Cache lifecycle, expiration, cleanup
- `__tests__/unit/prompt-helpers.test.ts` - Data transformation with complex rules
- `rlm-service/processors/test_dag_parser.py` - DAG traversal, message filtering

## Test Types

**Unit Tests:**
- Scope: Single function or class method
- Approach: Isolate via mocking external dependencies
- Examples: `handleAPIError()`, `TTLCache.set/get`, `extract_active_path()`, `format_section()`
- Setup: Fast, deterministic, no I/O
- TypeScript location: Co-located .test.ts files
- Python location: `test_dag_parser.py` (10+ test cases for DAG operations)

**Integration Tests:**
- Not heavily present in visible test files
- Cross-language tests exist: `__tests__/cross-lang/prompt-sync.test.ts` verifies Python and TypeScript prompt builders produce identical output
- Database integration: Mocked in unit tests, not true integration tests shown

**E2E Tests:**
- Framework: Playwright (from `package.json` script `test:e2e`)
- Location: `tests/e2e/` (inferred from vitest config exclusion)
- Not examined in detail but configured for end-to-end workflows

**Async Testing:**

```typescript
// Fake timers for async operations (cache expiration)
it('should return undefined for expired entry', () => {
  const cache = new TTLCache<string>(30 * 60 * 1000);
  cache.set('key1', 'value1');

  // Advance time past TTL
  vi.advanceTimersByTime(31 * 60 * 1000);

  expect(cache.get('key1')).toBeUndefined();
  cache.destroy();
});

// Direct async/await
it('should return 504 with TIMEOUT code for TimeoutError', async () => {
  const response = handleAPIError(timeoutError, 'API:Test');
  const body = (await response.json()) as APIErrorResponse;
  expect(body.code).toBe('TIMEOUT');
});
```

**Error Testing:**

```typescript
it('should handle unknown error types (string)', async () => {
  const response = handleAPIError('string error', 'API:Test');

  expect(response.status).toBe(500);
  const body = (await response.json()) as APIErrorResponse;
  expect(body.code).toBe('UNKNOWN_ERROR');
});

// Python pattern: verify error handling in non-raising code
def test_empty_mapping_returns_empty(self):
    """Empty conversation mapping returns empty message list."""
    conversation = {
        "id": "conv-empty",
        "mapping": {},
        "current_node": None,
    }

    result = extract_active_path(conversation)

    assert result == []
```

## Setup & Environment

**TypeScript Setup (`tests/setup.ts`):**
```typescript
import '@testing-library/jest-dom/vitest'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'
import { server } from './mocks/server'

// Mock logger to prevent Pino from writing during tests
const mockLoggerInstance = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLoggerInstance),
}

vi.mock('@/lib/logger', () => ({
  logger: mockLoggerInstance,
  createLogger: vi.fn(() => mockLoggerInstance),
}))

// Mock rate limiting to prevent Redis calls
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())
```

**Environment Variables in Tests (`vitest.config.mts`):**
```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./tests/setup.ts'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    RLM_SERVICE_URL: 'https://soulprint-landing.onrender.com',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    BEDROCK_MODEL_ID: 'test-model',
  },
},
```

## Common Testing Patterns

**Complex Object Testing:**
```typescript
// TTLCache with generic type
interface UploadSession {
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
}

it('should handle complex object values', () => {
  const cache = new TTLCache<UploadSession>(30 * 60 * 1000);
  const session: UploadSession = {
    chunks: [Buffer.from('chunk1'), Buffer.from('chunk2')],
    totalChunks: 5,
    receivedChunks: 2,
  };

  cache.set('upload-123', session);
  const retrieved = cache.get('upload-123');

  expect(retrieved?.totalChunks).toBe(5);
  expect(retrieved?.chunks).toHaveLength(2);
});
```

**Boundary Testing:**
```typescript
// Time boundary (exactly at TTL edge)
it('should return value at 29 minute boundary (just before expiration)', () => {
  const cache = new TTLCache<string>(30 * 60 * 1000);
  cache.set('key1', 'value1');

  vi.advanceTimersByTime(29 * 60 * 1000);
  expect(cache.get('key1')).toBe('value1');
});

it('should return undefined at 30 minute boundary (exact expiration)', () => {
  const cache = new TTLCache<string>(30 * 60 * 1000);
  cache.set('key1', 'value1');

  vi.advanceTimersByTime(30 * 60 * 1000);
  expect(cache.get('key1')).toBeUndefined();
});
```

**Python Behavior Specification:**
```python
def test_multiple_string_parts(self):
    """Multiple string parts concatenated with newline."""
    node = _make_node("node-1", None, [], role="user",
                     content_parts=["Part 1", "Part 2"])
    content = extract_content(node["message"])
    assert content == "Part 1\nPart 2"
```

## Test Verification Strategy

**AAA Pattern (Arrange, Act, Assert):**
1. **Arrange**: Set up test data and mocks
2. **Act**: Call the function being tested
3. **Assert**: Verify the result matches expectations

**Example (TypeScript):**
```typescript
it('should update user_profiles with progress_percent', async () => {
  // Arrange: mock httpx response
  const mockClient = vi.mock('httpx');

  // Act: call update_progress
  await update_progress(user_id, 50, 'chunking');

  // Assert: verify PATCH request sent with correct payload
  expect(mockClient.patch).toHaveBeenCalledWith(
    expect.stringContaining('user_profiles'),
    expect.objectContaining({ progress_percent: 50 })
  );
});
```

---

*Testing analysis: 2026-02-11*
