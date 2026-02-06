# Phase 2: Memory & Resource Cleanup - Research

**Researched:** 2026-02-06
**Domain:** Node.js memory management, timeout configuration, error handling
**Confidence:** HIGH

## Summary

This phase focuses on three critical areas: (1) TTL-based cleanup of in-memory chunked upload state, (2) reducing RLM service timeout with proper fallback, and (3) comprehensive error handling across all API routes. The research reveals modern Node.js patterns using AbortSignal.timeout() for cleaner timeout management, Map-based TTL cache patterns with proactive cleanup, and Next.js-specific error handling conventions.

The chunked upload system currently stores file chunks in an in-memory Map without cleanup, leading to unbounded memory growth. The RLM service uses a 60-second timeout which is too long for production. API routes have inconsistent error handling - 54 routes with 220 try-catch blocks need audit for proper error responses.

**Key findings:**
- Use Map with timestamp tracking + setInterval cleanup for TTL implementation
- Replace `AbortController + setTimeout` with modern `AbortSignal.timeout()` for RLM calls
- Standardize error handling with proper status codes and structured error payloads
- Use autocannon for load testing memory plateau verification
- Circuit breaker already exists at `lib/rlm/health.ts` with OPEN/CLOSED/HALF_OPEN states

**Primary recommendation:** Implement background cleanup with `.unref()` intervals, migrate to AbortSignal.timeout(15000) with TimeoutError detection, and create standardized error response wrapper for all API routes.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in Map | native | In-memory cache with TTL | Built-in, zero dependencies, sufficient for serverless |
| AbortSignal.timeout() | Node 17.3+ | Timeout management | Modern API, better error differentiation than AbortController |
| autocannon | latest | Load testing for memory | Fast HTTP/1.1 benchmarking, Node.js native, better for memory profiling than k6 |
| Vitest | ^2.1.8 | Test TTL cleanup logic | Already installed in Phase 1, supports fake timers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| setInterval with .unref() | native | Background cleanup | For TTL cache cleanup without blocking process exit |
| vi.useFakeTimers() | Vitest | Fast-forward time in tests | Testing TTL cleanup without real delays |
| NextResponse.json() | Next.js | Structured error responses | All API route error handling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Map-based TTL | lru-cache library | Library adds size limits + LRU eviction, but adds dependency. Map is sufficient for 30min TTL. |
| AbortSignal.timeout() | AbortController + setTimeout | Manual approach works but requires more code, can't distinguish TimeoutError from AbortError |
| autocannon | k6 or Artillery | k6 is powerful but overkill for simple memory plateau checks. Artillery is slower to start. |

**Installation:**
```bash
npm install -D autocannon  # For load testing verification
# Other tools already available (native Node.js, Vitest from Phase 1)
```

## Architecture Patterns

### Pattern 1: TTL Cache with Background Cleanup

**What:** Map-based cache storing values with expiration timestamps, plus background cleanup interval

**When to use:** In-memory temporary storage with known TTL (chunked uploads, session data, rate limiting)

**Implementation:**
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-30-nodejs-memory-cache-ttl/view

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private defaultTTL: number = 30 * 60 * 1000,  // 30 minutes
    private cleanupInterval: number = 5 * 60 * 1000  // 5 minutes
  ) {
    this.startCleanup();
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Lazy deletion on access
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    // CRITICAL: unref() prevents interval from blocking process exit
    this.cleanupTimer.unref();
  }

  private cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[TTLCache] Cleaned up ${cleaned} expired entries`);
    }

    return cleaned;
  }

  // For testing: force cleanup now
  public forceCleanup(): number {
    return this.cleanup();
  }

  // For graceful shutdown
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
  }
}

// Usage in chunked upload:
const uploadCache = new TTLCache<UploadSession>(30 * 60 * 1000); // 30min TTL
```

**Why this works:**
- Lazy deletion prevents access to expired data
- Background cleanup frees memory even if items never accessed again
- `.unref()` prevents cleanup timer from blocking Vercel serverless exit
- Lightweight - no external dependencies

### Pattern 2: Modern Timeout with AbortSignal.timeout()

**What:** Use static `AbortSignal.timeout()` method instead of manual AbortController + setTimeout

**When to use:** Any fetch call with timeout requirement (RLM, external APIs)

**Migration pattern:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static

// OLD: Manual timeout (60s in current codebase)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);
try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
} catch (error) {
  // Can't distinguish timeout from user abort
}

// NEW: AbortSignal.timeout() (reduce to 15s)
try {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000)  // 15s timeout
  });
  // Success
} catch (error) {
  // Can distinguish error types!
  if (error.name === 'TimeoutError') {
    console.error('RLM timed out after 15s');
    // Record circuit breaker failure
    recordFailure();
    return null; // Fallback to Bedrock
  } else if (error.name === 'AbortError') {
    console.error('Request aborted by user');
  }
  throw error;
}
```

**Benefits:**
- Cleaner syntax (no manual clearTimeout)
- `TimeoutError` DOMException vs `AbortError` - can distinguish timeout from abort
- No memory leak from forgotten setTimeout
- Better for circuit breaker logic (explicit timeout detection)

**Node.js support:** Node 17.3+ (Vercel uses Node 20+, fully supported)

### Pattern 3: Standardized API Error Handling

**What:** Consistent try-catch with proper error responses across all API routes

**When to use:** Every Next.js API route (54 routes need audit)

**Current inconsistency:**
```typescript
// GOOD example (memory/query/route.ts):
try {
  // ... business logic
  return NextResponse.json({ chunks, facts });
} catch (error) {
  console.error('Memory query error:', error);
  return NextResponse.json(
    { error: 'Failed to query memory' },  // User-friendly message
    { status: 500 }  // Proper status code
  );
}

// BAD example (what to avoid):
} catch (err) {
  console.error('Error:', err);
  return NextResponse.json({ error: err.message }, { status: 500 });
  // PROBLEM: Exposes internal error messages, no error type handling
}
```

**Standard pattern:**
```typescript
// Source: https://nextjs.org/docs/app/getting-started/error-handling

interface ErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

function handleAPIError(error: unknown, context: string): Response {
  console.error(`[${context}] Error:`, error);

  // Type-safe error handling
  if (error instanceof Error) {
    // Known error types
    if (error.name === 'TimeoutError') {
      return NextResponse.json<ErrorResponse>(
        { error: 'Request timed out', code: 'TIMEOUT' },
        { status: 504 }
      );
    }

    // Don't expose internal error messages in production
    const message = process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error';

    return NextResponse.json<ErrorResponse>(
      { error: message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json<ErrorResponse>(
    { error: 'An unexpected error occurred', code: 'UNKNOWN_ERROR' },
    { status: 500 }
  );
}

// Usage:
export async function POST(request: NextRequest) {
  try {
    // ... business logic
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error, 'API:SomethingRoute');
  }
}
```

**Status code guidelines:**
- 400: Bad request (invalid input)
- 401: Unauthorized (no/invalid auth)
- 404: Not found
- 500: Internal server error (caught exceptions)
- 504: Gateway timeout (external service timeout)

### Pattern 4: Load Testing for Memory Verification

**What:** Use autocannon to verify memory plateau under sustained load

**When to use:** After implementing TTL cleanup, verify memory doesn't grow unbounded

**Testing approach:**
```bash
# Source: https://github.com/mcollina/autocannon

# Install
npm install -D autocannon

# Basic load test (30 seconds, 10 concurrent connections)
npx autocannon -c 10 -d 30 http://localhost:3000/api/import/chunked-upload

# Memory profiling during load test:
# 1. Start Next.js with inspect flag
node --inspect $(which next) dev

# 2. In another terminal, run autocannon
npx autocannon -c 10 -d 60 http://localhost:3000/api/health

# 3. Open Chrome DevTools (chrome://inspect), take heap snapshots
#    - Snapshot at start
#    - Snapshot after 30s
#    - Snapshot after 60s
#    - Compare: Memory should plateau, not grow linearly
```

**Success criteria:**
```typescript
// Memory usage pattern:
// ✅ GOOD (plateau):
//   0-10s:  50MB -> 80MB   (initial growth)
//   10-30s: 80MB -> 85MB   (plateau with GC cycles)
//   30-60s: 85MB -> 87MB   (stable)

// ❌ BAD (leak):
//   0-10s:  50MB -> 80MB
//   10-30s: 80MB -> 120MB  (continuous growth)
//   30-60s: 120MB -> 170MB (memory leak!)
```

**Alternative: Node.js built-in profiler**
```bash
# Using Node.js --heap-prof flag
node --heap-prof $(which next) dev

# Generates *.heapprofile files on exit
# Analyze with Chrome DevTools Performance tab
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circuit breaker from scratch | Custom retry/backoff logic | Existing `lib/rlm/health.ts` | Already implements OPEN/CLOSED/HALF_OPEN states with 30s cooldown |
| Custom timeout wrapper | Wrapper function with setTimeout | `AbortSignal.timeout()` | Native API, better error types, no memory leaks |
| LRU cache with eviction | Custom eviction algorithm | `lru-cache` npm package OR simple TTL Map | Eviction is complex, TTL is sufficient for this use case |
| Load testing framework | Custom HTTP benchmarking | `autocannon` | Battle-tested, Node.js native, excellent for memory profiling |
| Error logging service | Custom error tracking | Console.error + Vercel logs | Vercel captures all console output, searchable in dashboard |

**Key insight:** The existing circuit breaker at `lib/rlm/health.ts` is well-designed. Don't replace it. Instead, integrate the new 15s timeout with the existing `recordSuccess()` and `recordFailure()` calls. The circuit breaker prevents cascading failures by skipping RLM when it's known to be down.

## Common Pitfalls

### Pitfall 1: Cleanup Timer Blocks Process Exit

**What goes wrong:** Using `setInterval()` without `.unref()` prevents Node.js process from exiting cleanly in serverless environments

**Why it happens:** By default, active timers keep the event loop alive. In Vercel serverless, this prevents function termination and causes billing issues.

**How to avoid:**
```typescript
// BAD:
const timer = setInterval(() => cleanup(), 300000);
// Process won't exit until clearInterval called

// GOOD:
const timer = setInterval(() => cleanup(), 300000);
timer.unref();  // Allow process to exit even if timer is active
// Serverless function can terminate normally
```

**Warning signs:**
- Vercel function timeouts (10s default, hits max)
- "Function did not terminate" errors
- Elevated serverless costs

**Source:** [How to Create Memory Cache with TTL in Node.js](https://oneuptime.com/blog/post/2026-01-30-nodejs-memory-cache-ttl/view)

### Pitfall 2: Forgetting Lazy Deletion in TTL Cache

**What goes wrong:** Background cleanup runs every 5 minutes, but expired entries are still accessible in the meantime

**Why it happens:** Only implementing proactive cleanup without lazy deletion means stale data is served for up to 5 minutes after expiration.

**How to avoid:** Always combine two strategies:
1. **Lazy deletion:** Check TTL in `.get()` method
2. **Proactive cleanup:** Background interval removes expired entries

```typescript
get(key: string): T | undefined {
  const entry = this.cache.get(key);
  if (!entry) return undefined;

  // CRITICAL: Check expiration on every access
  if (Date.now() > entry.expiresAt) {
    this.cache.delete(key);
    return undefined;
  }

  return entry.value;
}
```

**Warning signs:**
- Tests show expired data still accessible
- Stale upload sessions cause conflicts

### Pitfall 3: Not Distinguishing Timeout from Abort

**What goes wrong:** Using `AbortController + setTimeout` makes all aborts look the same - can't tell if it was timeout vs user cancellation

**Why it happens:** Both timeout and manual abort throw the same error type

**How to avoid:** Use `AbortSignal.timeout()` which throws `TimeoutError` DOMException:

```typescript
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
} catch (error) {
  if (error.name === 'TimeoutError') {
    // Definitely a timeout - record circuit breaker failure
    recordFailure();
    return fallback();
  }
  // Some other error - don't penalize circuit breaker
  throw error;
}
```

**Warning signs:**
- Circuit breaker opens too aggressively
- Fallback logic triggers on wrong errors

**Source:** [AbortSignal.timeout() MDN Documentation](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)

### Pitfall 4: Exposing Internal Errors to Users

**What goes wrong:** Returning raw `error.message` in API responses leaks internal implementation details, database schema, or credentials

**Why it happens:** Quick `catch (err) { return { error: err.message } }` pattern

**How to avoid:**
```typescript
// BAD:
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
  // Could expose: "ECONNREFUSED to postgres://user:pass@..."
}

// GOOD:
catch (error) {
  console.error('[Context] Error:', error); // Log full error for debugging

  const userMessage = process.env.NODE_ENV === 'development'
    ? error instanceof Error ? error.message : 'Unknown error'
    : 'An unexpected error occurred'; // Generic in production

  return NextResponse.json({ error: userMessage }, { status: 500 });
}
```

**Warning signs:**
- Database connection strings in error responses
- Internal file paths visible to users
- Security scanning tools flagging information disclosure

**Source:** [Next.js Error Handling Best Practices](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/)

### Pitfall 5: Memory Leaks from Event Listeners

**What goes wrong:** Adding event listeners without cleanup in long-running Node.js processes causes gradual memory accumulation

**Why it happens:** Each listener allocates memory. Without cleanup, old listeners persist even when objects are no longer needed.

**How to avoid:** Always provide cleanup for event emitters:

```typescript
// BAD:
function setupMonitoring() {
  process.on('uncaughtException', handler);
  // Never removed - memory leak
}

// GOOD:
function setupMonitoring() {
  const handler = (error) => { /* ... */ };
  process.on('uncaughtException', handler);

  // Return cleanup function
  return () => {
    process.off('uncaughtException', handler);
  };
}

const cleanup = setupMonitoring();
// Later: cleanup();
```

**Warning signs:**
- Memory usage grows slowly over time
- MaxListenersExceededWarning in logs
- Node.js inspector shows increasing listener count

**Mitigation for serverless:** Less critical in Vercel's serverless model since processes are short-lived, but still good practice for local dev and Edge runtime.

### Pitfall 6: Testing TTL Without Fake Timers

**What goes wrong:** Testing 30-minute TTL with real timers makes tests take 30 minutes

**Why it happens:** Calling `setTimeout(cleanup, 30 * 60 * 1000)` and waiting for it

**How to avoid:** Use Vitest fake timers:

```typescript
// Source: https://vitest.dev/api/#vi-usefaketimers

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TTL Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers(); // Mock timers
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers
  });

  it('should clean up after 30 minutes', () => {
    const cache = new TTLCache(30 * 60 * 1000); // 30min TTL
    cache.set('key', 'value');

    expect(cache.get('key')).toBe('value');

    // Fast-forward 29 minutes - should still exist
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(cache.get('key')).toBe('value');

    // Fast-forward 1 more minute - should be gone
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(cache.get('key')).toBeUndefined();

    cache.destroy();
  });
});
```

**Warning signs:**
- Tests take minutes to run
- CI timeouts on test suite
- Can't test TTL edge cases

## Code Examples

### Example 1: Migrate Chunked Upload to TTL Cache

```typescript
// File: app/api/import/chunked-upload/route.ts
// Current: In-memory Map without cleanup (lines 4-6)
// Source: Verified from codebase

// BEFORE:
const chunkStore = new Map<string, {
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
}>();
// No cleanup - memory leak!

// AFTER:
interface UploadSession {
  chunks: Buffer[];
  totalChunks: number;
  receivedChunks: number;
  createdAt: number;  // For monitoring
}

const uploadCache = new TTLCache<UploadSession>(
  30 * 60 * 1000,  // 30min TTL (BUG-01 requirement)
  5 * 60 * 1000    // 5min cleanup interval
);

export async function POST(req: NextRequest) {
  const uploadId = req.headers.get('X-Upload-Id') || `${user.id}-${Date.now()}`;

  // Replace chunkStore.get() with cache.get()
  let session = uploadCache.get(uploadId);

  if (!session) {
    session = {
      chunks: new Array(totalChunks).fill(null),
      totalChunks,
      receivedChunks: 0,
      createdAt: Date.now(),
    };
    uploadCache.set(uploadId, session);
  }

  // ... rest of upload logic

  if (session.receivedChunks === totalChunks) {
    // Clean up immediately on completion
    uploadCache.delete(uploadId);
    // ... upload to Supabase
  }
}

// Optional: Export cleanup function for tests
export function getUploadCacheStats() {
  return {
    size: uploadCache.size,
    cleanup: () => uploadCache.forceCleanup(),
  };
}
```

### Example 2: Reduce RLM Timeout to 15s

```typescript
// File: app/api/chat/route.ts (line 137)
// Source: Verified from codebase

// BEFORE (60s timeout):
const response = await fetch(`${rlmUrl}/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* ... */ }),
  signal: AbortSignal.timeout(60000), // Too long!
});

// AFTER (15s timeout with better error handling):
try {
  const response = await fetch(`${rlmUrl}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      message,
      soulprint_text: soulprintText,
      history,
      web_search_context: webSearchContext,
    }),
    signal: AbortSignal.timeout(15000),  // REL-01: 15s timeout
  });

  if (!response.ok) {
    console.log('[Chat] RLM service error:', response.status);
    recordFailure();
    return null;
  }

  const data = await response.json();
  console.log('[Chat] RLM success:', data.method, data.latency_ms + 'ms');
  recordSuccess();
  return data;

} catch (error) {
  // Better error differentiation
  if (error instanceof Error && error.name === 'TimeoutError') {
    console.error('[Chat] RLM timed out after 15s - falling back to Bedrock');
    recordFailure();
    return null;  // Circuit breaker will open after 2 failures
  }

  console.log('[Chat] RLM service unavailable:', error);
  recordFailure();
  return null;
}
```

### Example 3: Standardized Error Handler

```typescript
// File: lib/api/error-handler.ts (NEW FILE)
// Pattern: https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/

interface APIErrorResponse {
  error: string;
  code?: string;
  details?: string;
  timestamp?: string;
}

export function handleAPIError(
  error: unknown,
  context: string,
  includeDetails = false
): Response {
  const timestamp = new Date().toISOString();
  console.error(`[${context}] ${timestamp}:`, error);

  // Timeout errors (from AbortSignal.timeout)
  if (error instanceof Error && error.name === 'TimeoutError') {
    return NextResponse.json<APIErrorResponse>(
      {
        error: 'Request timed out',
        code: 'TIMEOUT',
        timestamp,
      },
      { status: 504 }
    );
  }

  // Authentication errors
  if (error instanceof Error && error.message.includes('auth')) {
    return NextResponse.json<APIErrorResponse>(
      {
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        timestamp,
      },
      { status: 401 }
    );
  }

  // Generic errors
  if (error instanceof Error) {
    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json<APIErrorResponse>(
      {
        error: isDev ? error.message : 'An error occurred',
        code: 'INTERNAL_ERROR',
        details: includeDetails && isDev ? error.stack : undefined,
        timestamp,
      },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json<APIErrorResponse>(
    {
      error: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp,
    },
    { status: 500 }
  );
}

// Usage in any API route:
export async function POST(request: NextRequest) {
  try {
    // ... business logic
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error, 'API:MyRoute');
  }
}
```

### Example 4: Test TTL Cleanup

```typescript
// File: lib/chunked-upload.test.ts (NEW FILE)
// Pattern: https://vitest.dev/guide/mocking/timers

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TTLCache } from './ttl-cache';

describe('TTLCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should expire entries after TTL', () => {
    const cache = new TTLCache<string>(1000); // 1 second TTL

    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');

    // Fast-forward 900ms - should still exist
    vi.advanceTimersByTime(900);
    expect(cache.get('key1')).toBe('value1');

    // Fast-forward another 200ms (total 1100ms) - should be gone
    vi.advanceTimersByTime(200);
    expect(cache.get('key1')).toBeUndefined();

    cache.destroy();
  });

  it('should clean up in background', () => {
    const cache = new TTLCache<string>(1000, 500); // 1s TTL, 500ms cleanup

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    // Fast-forward past TTL but before cleanup
    vi.advanceTimersByTime(1100);

    // Items exist in Map but expired (lazy deletion not triggered yet)
    expect(cache.size).toBe(2);

    // Trigger cleanup interval
    vi.advanceTimersByTime(500);

    // Background cleanup should have removed expired items
    const cleaned = cache.forceCleanup();
    expect(cleaned).toBeGreaterThan(0);
    expect(cache.size).toBe(0);

    cache.destroy();
  });

  it('should handle concurrent uploads without collision', () => {
    interface UploadSession {
      chunks: number[];
      totalChunks: number;
    }

    const cache = new TTLCache<UploadSession>(30000);

    const upload1 = { chunks: [1, 2, 3], totalChunks: 3 };
    const upload2 = { chunks: [4, 5], totalChunks: 2 };

    cache.set('user1-upload', upload1);
    cache.set('user2-upload', upload2);

    expect(cache.get('user1-upload')).toEqual(upload1);
    expect(cache.get('user2-upload')).toEqual(upload2);

    cache.destroy();
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AbortController + setTimeout | AbortSignal.timeout() | Node 17.3+ (Apr 2022) | Cleaner syntax, better error types (TimeoutError vs AbortError) |
| Manual cleanup loops | Map + setInterval with .unref() | Node 0.10+ (2013) | Prevents serverless function hanging, automatic process exit |
| try-catch with err.message | Structured error responses | Next.js 13+ (2022) | Better client error handling, no info leakage |
| Generic Map for cache | TTL-aware cache patterns | Ongoing best practice | Memory safety, automatic cleanup |

**Deprecated/outdated:**
- **Domain module:** Node.js domains for error handling (deprecated since Node 4) - use try-catch instead
- **process.on('uncaughtException'):** Catching all errors globally - handle errors at source instead
- **No timeout on fetch:** Leaving fetch without timeout - always use AbortSignal.timeout() or signal

## Open Questions

### Question 1: Should cleanup interval be configurable per environment?

**What we know:**
- 5-minute cleanup interval works for development
- Production Vercel serverless functions are short-lived (10s default, 300s max)
- Each function invocation gets fresh memory

**What's unclear:**
- Do we need cleanup at all in serverless? Or only in local dev?
- If functions are <10s, TTL cleanup may never run

**Recommendation:**
- Keep TTL cache for safety, but recognize cleanup may not run in serverless
- Rely on lazy deletion (checked on every access) as primary mechanism
- Background cleanup is defense-in-depth for abandoned uploads

### Question 2: What's the right balance for RLM timeout?

**What we know:**
- Current: 60s timeout
- Requirement: 15s timeout (REL-01)
- Circuit breaker opens after 2 consecutive failures

**What's unclear:**
- Is 15s too aggressive for RLM cold starts?
- Should we have different timeouts for different endpoints?

**Recommendation:**
- Start with 15s for `/query` endpoint (most common)
- Monitor circuit breaker open/close frequency in logs
- If too many timeouts, consider 20s, but keep <30s
- Use circuit breaker to prevent cascading failures

### Question 3: How to test circuit breaker integration?

**What we know:**
- Circuit breaker exists at `lib/rlm/health.ts`
- Has OPEN/CLOSED/HALF_OPEN states
- 30s cooldown after opening

**What's unclear:**
- How to test circuit breaker state transitions without 30s delays?
- Should we expose circuit breaker state for testing?

**Recommendation:**
- Make cooldown configurable for tests: `new CircuitBreaker({ cooldownMs: 1000 })`
- Use Vitest fake timers to fast-forward cooldown
- Export `getCircuitStatus()` function (already exists) for test assertions

## Sources

### Primary (HIGH confidence)

- [Node.js Memory Cache with TTL](https://oneuptime.com/blog/post/2026-01-30-nodejs-memory-cache-ttl/view) - TTL cache patterns
- [AbortSignal.timeout() - MDN](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) - Official API documentation
- [Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) - Official error handling guide
- [Vitest API Reference](https://vitest.dev/api/) - Testing timeouts and fake timers
- Codebase files verified:
  - `app/api/import/chunked-upload/route.ts` (lines 4-6, 29-52)
  - `app/api/chat/route.ts` (lines 109-155)
  - `lib/rlm/health.ts` (complete circuit breaker implementation)
  - 54 API routes with 220 try-catch blocks (grep analysis)

### Secondary (MEDIUM confidence)

- [Circuit Breaker Pattern in Node.js](https://github.com/nodeshift/opossum) - Opossum library patterns
- [Autocannon GitHub](https://github.com/mcollina/autocannon) - Load testing tool
- [Better Stack: Error Handling in Next.js](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/) - Error handling patterns
- [Understanding AbortController in Node.js](https://betterstack.com/community/guides/scaling-nodejs/understanding-abortcontroller/) - AbortController guide

### Tertiary (LOW confidence)

- [Memory Leak Debugging in Node.js](https://dev.to/mohammad_waseem_c31f3a26f/mastering-memory-leak-debugging-in-nodejs-a-devops-approach-without-documentation-19lk) - General debugging approaches (not verified for this codebase)

## Metadata

**Confidence breakdown:**
- TTL cache patterns: HIGH - Verified with official 2026 article + Node.js native APIs
- AbortSignal.timeout(): HIGH - MDN documentation + Node.js 20+ support confirmed
- Error handling patterns: HIGH - Official Next.js docs + codebase verification
- Circuit breaker integration: HIGH - Existing implementation verified in codebase
- Load testing approach: MEDIUM - autocannon recommended but not tested yet

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable Node.js/Next.js patterns, unlikely to change)

**Key files requiring modification:**
1. `app/api/import/chunked-upload/route.ts` - Add TTL cache (BUG-01)
2. `app/api/chat/route.ts` - Reduce timeout to 15s (REL-01)
3. `app/api/import/process-server/route.ts` - Update RLM call timeout
4. All 54 API routes - Audit error handling (REL-02)
5. NEW: `lib/api/ttl-cache.ts` - TTL cache implementation
6. NEW: `lib/api/error-handler.ts` - Standardized error handler
