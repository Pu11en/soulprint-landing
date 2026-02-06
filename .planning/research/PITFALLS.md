# Pitfalls Research: Next.js Stabilization & Hardening

**Domain:** Next.js 16 App Router stabilization (security, testing, TypeScript strict mode)
**Researched:** 2026-02-06
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: In-Memory State Accumulation in Serverless Functions

**What goes wrong:**
Global arrays, Maps, or objects in API routes that grow unbounded without cleanup cause serverless functions to exhaust memory over time. In the SoulPrint codebase, the chunked upload Map has no TTL or size limits, accumulating entries indefinitely.

**Why it happens:**
Developers treat serverless functions like long-running processes, forgetting that while the runtime is reused across requests (warm starts), there's no guaranteed cleanup between invocations. The mental model is "this will reset on restart" but restarts are unpredictable and infrequent on platforms like Vercel.

**Consequences:**
- Memory usage grows continuously without stabilization
- Functions eventually hit memory limits and crash
- Subsequent cold starts appear to "fix" the problem, hiding the leak
- Production incidents occur during high-traffic periods when functions stay warm longest

**Prevention:**
```typescript
// BAD: No cleanup
const uploadMap = new Map<string, ChunkData>();

// GOOD: TTL-based cleanup
const uploadMap = new Map<string, { data: ChunkData; expires: number }>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, value] of uploadMap.entries()) {
    if (value.expires < now) {
      uploadMap.delete(key);
    }
  }
}

// BETTER: Use external cache (Redis, Upstash)
const cache = new Upstash({ /* config */ });
```

**Warning signs:**
- Memory usage that grows without plateauing (use `autocannon` for load testing)
- Intermittent "out of memory" errors in production
- API route response times increasing over the life of a warm function
- Vercel dashboard showing increasing memory consumption trends

**Phase to address:**
Phase 1: Memory & Resource Cleanup - Must address before adding tests (tests will detect but not fix)

**Sources:**
- [Memory Leaks in React & Next.js: What Nobody Tells You](https://medium.com/@essaadani.yo/memory-leaks-in-react-next-js-what-nobody-tells-you-91c72b53d84d)
- [Next.js Official: Memory Usage Guide](https://nextjs.org/docs/app/guides/memory-usage)

---

### Pitfall 2: Service Role Key Used Client-Side or in RLS Policies

**What goes wrong:**
Using Supabase service role keys in client-side code or attempting to use `service_role` in RLS policies. The service role key bypasses RLS entirely, creating catastrophic security vulnerabilities. Adding `service_role` to RLS policies does nothing—it's not a valid role identifier.

**Why it happens:**
Misunderstanding the Supabase security model: developers think "service role" is a role they can check in policies, when it's actually a superuser bypass key. The name "service role" is misleading—it sounds like something you'd use in role-based access control.

**Consequences:**
- Complete database exposure if service key leaks
- RLS policies that appear secure but are ineffective
- In January 2025, 170+ apps built with Lovable had exposed databases due to RLS misconfigurations
- 83% of exposed Supabase databases involve RLS configuration errors

**Prevention:**
```typescript
// BAD: Service key in client
const supabase = createClient(url, process.env.NEXT_PUBLIC_SERVICE_KEY!)

// BAD: Service role in RLS policy
CREATE POLICY "admin_access" ON users
  FOR ALL USING (auth.role() = 'service_role');  -- Does nothing!

// GOOD: Service key server-only
// app/api/admin/route.ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// GOOD: Proper RLS policy
CREATE POLICY "admin_access" ON users
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );
```

**Warning signs:**
- `NEXT_PUBLIC_*` environment variable containing "service" or "secret"
- RLS policies mentioning `service_role`
- Client-side code accessing admin-only tables without errors
- TypeScript showing service key being passed to `createClient()` in client components

**Phase to address:**
Phase 2: Security Hardening - Must audit before launch

**Sources:**
- [Supabase Row Level Security Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security)
- [Why is my service role key client getting RLS errors?](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)
- [How to Secure Your Supabase Service Role Key](https://chat2db.ai/resources/blog/secure-supabase-role-key)

---

### Pitfall 3: RLS Not Enabled by Default (Exposed Tables)

**What goes wrong:**
RLS is **disabled by default** when creating tables in Supabase. Developers assume data is protected when it's actually publicly accessible via the anon key. This is the #1 cause of security issues in Supabase apps.

**Why it happens:**
The mental model from traditional backends is "access is denied by default." Supabase inverts this: access is *allowed* by default until you explicitly enable RLS and define policies. The SQL statement `CREATE TABLE` does not automatically protect the table.

**Consequences:**
- All table data readable/writable by anyone with the anon key
- Privacy violations exposing user data
- Compliance issues (GDPR, CCPA violations)
- Complete data breach if anon key is in client bundle (which it always is)

**Prevention:**
```sql
-- REQUIRED after creating any table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Then create policies
CREATE POLICY "Users can only see their own data"
  ON table_name
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Warning signs:**
- Supabase dashboard showing tables without the "RLS Enabled" badge
- Ability to query tables in browser console using just the anon key
- No RLS policies defined for production tables
- Missing `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in migrations

**Phase to address:**
Phase 2: Security Hardening - Audit all existing tables immediately

**Sources:**
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Row Level Security Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security)

---

### Pitfall 4: Race Conditions in React Polling (Out-of-Order Responses)

**What goes wrong:**
Polling endpoints in React with `setInterval` causes race conditions where older requests resolve after newer ones, overwriting correct data with stale data. This is exactly the issue in SoulPrint's chat polling where responses arrive out of order.

**Why it happens:**
Network timing is unpredictable. Request N might take 500ms while request N+1 takes 50ms. When both resolve, the older data from request N arrives last and overwrites the fresh data from N+1. Using `useEffect` with stale closures exacerbates this—the polling function captures old state values.

**Consequences:**
- Chat messages appear, disappear, then reappear
- UI shows outdated data intermittently
- User actions appear to fail then succeed randomly
- Impossible to reproduce consistently (timing-dependent)

**Prevention:**
```typescript
// BAD: Race condition guaranteed
useEffect(() => {
  const interval = setInterval(async () => {
    const data = await fetch('/api/messages');
    setMessages(data); // Overwrites with whoever finishes last!
  }, 1000);
  return () => clearInterval(interval);
}, []);

// GOOD: Track latest request
useEffect(() => {
  let requestId = 0;

  const poll = async () => {
    const currentRequestId = ++requestId;
    const data = await fetch('/api/messages');

    // Only update if this is still the latest request
    if (currentRequestId === requestId) {
      setMessages(data);
    }
  };

  const interval = setInterval(poll, 1000);
  return () => clearInterval(interval);
}, []);

// BETTER: Use AbortController to cancel stale requests
useEffect(() => {
  let abortController: AbortController | null = null;

  const poll = async () => {
    // Cancel previous request if still pending
    abortController?.abort();
    abortController = new AbortController();

    try {
      const data = await fetch('/api/messages', {
        signal: abortController.signal
      });
      setMessages(data);
    } catch (err) {
      if (err.name === 'AbortError') return; // Expected
      throw err;
    }
  };

  const interval = setInterval(poll, 1000);
  return () => {
    clearInterval(interval);
    abortController?.abort();
  };
}, []);

// BEST: Use modern patterns (SWR, TanStack Query, use() + Suspense)
import useSWR from 'swr';

function ChatMessages() {
  const { data: messages } = useSWR('/api/messages', fetcher, {
    refreshInterval: 1000,
    dedupingInterval: 500 // Built-in race condition handling
  });
}
```

**Warning signs:**
- Intermittent UI flicker showing old then new data
- "Data went backwards" reports from users
- Polling interval set faster than typical response time
- Multiple `setInterval` or polling effects without coordination
- `useRef` for tracking state but not request identity

**Phase to address:**
Phase 3: Race Condition Fixes - After security, before adding tests (tests will catch this)

**Sources:**
- [Avoiding Race Conditions when Fetching Data with React Hooks](https://dev.to/nas5w/avoiding-race-conditions-when-fetching-data-with-react-hooks-4pi9)
- [Fixing Race Conditions in React with useEffect](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)
- [React useEffect Documentation](https://react.dev/reference/react/useEffect)

---

### Pitfall 5: CSRF Protection Middleware Ordering Conflicts

**What goes wrong:**
Adding CSRF protection via `next-csrf` or edge-csrf causes middleware conflicts where token validation runs twice, in the wrong order, or incompatibly with existing API route middleware. Routes break with cryptic "CSRF token invalid" or "middleware conflict" errors.

**Why it happens:**
Next.js has multiple middleware systems that don't compose well: Edge Middleware (runs globally), API route middleware (per-route wrapping), and Route Handlers (App Router). The `next-csrf` library expects a specific middleware application order that conflicts with other middleware like authentication or logging.

**Consequences:**
- Legitimate requests blocked with "invalid CSRF token"
- Security holes where CSRF protection is bypassed accidentally
- Middleware applied twice causing double-validation failures
- Different behavior in development vs. production

**Prevention:**
```typescript
// BAD: Wrapping conflicts
// middleware.ts
export default csrf(authMiddleware(...)); // Order matters!

// BAD: Applying in wrong scope
// app/api/users/route.ts
export const POST = csrf(authRequired(handler)); // Already in global middleware!

// GOOD: Single middleware composition point
// middleware.ts
import { createMiddleware } from 'next-auth';
import { csrf } from 'edge-csrf';

const csrfProtect = csrf({
  cookie: { secure: process.env.NODE_ENV === 'production' }
});

const authMiddleware = createMiddleware(/* ... */);

export async function middleware(request: NextRequest) {
  // Order: CSRF first, then auth
  const csrfResponse = await csrfProtect(request);
  if (csrfResponse) return csrfResponse;

  return authMiddleware(request);
}

// GOOD: Exclude static and API doc routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/docs).*)',
  ]
};
```

**Warning signs:**
- "CSRF token missing" errors on forms that include the token
- Different behavior when calling APIs via browser vs. Postman
- Middleware stack traces showing multiple CSRF handlers
- Inability to test API routes in isolation
- `next-csrf` package issues referencing `pages/api` conflicts

**Phase to address:**
Phase 2: Security Hardening - Implement alongside rate limiting with careful testing

**Sources:**
- [Error: next-csrf has conflict with pages/api in Next.js](https://www.omi.me/blogs/next-js-errors/error-next-csrf-has-conflict-with-pages-api-in-next-js-causes-and-how-to-fix)
- [Edge-CSRF: CSRF protection for Next.js middleware](https://github.com/vercel/next.js/discussions/59660)
- [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)

---

### Pitfall 6: TypeScript Strict Mode Migration (Over-Using `any` and `?`)

**What goes wrong:**
When migrating to TypeScript strict mode, developers add `any` types and optional `?` modifiers everywhere to silence errors quickly, defeating the purpose of strict mode. This creates false confidence: types say "safe" but runtime behavior is still broken.

**Why it happens:**
Strict mode errors are overwhelming in untested codebases (thousands of errors). The path of least resistance is `any` or marking everything optional. The immediate goal becomes "make it compile" rather than "make it correct."

**Consequences:**
- Type system provides no actual safety
- Bugs hide behind `any` types
- Future refactors are dangerous (no type-guided refactoring)
- `strictNullChecks` useless when everything is `| undefined`

**Prevention:**
```typescript
// BAD: Silencing strict mode
function processImport(data: any) {  // Lost all type safety
  return data.conversations?.messages;  // Runtime error if wrong shape
}

// BAD: Over-using optional
interface ImportData {
  conversations?: Message[];  // Should this really be optional?
  userId?: string;  // Every field optional = no guarantees
  timestamp?: number;
}

// GOOD: Incremental strict mode with @ts-strict-ignore
// Add to files with too many errors initially
// @ts-strict-ignore
// Then remove comment when fixed

// GOOD: Precise types, leave TODO comments
interface ImportData {
  conversations: Message[];  // Required field
  userId: string;
  // TODO: Legacy data might not have timestamps, validate at boundary
  timestamp: number | null;
}

function processImport(data: unknown): ImportData {
  // Validate at system boundary
  if (!isImportData(data)) {
    throw new ValidationError('Invalid import data');
  }
  return data;
}

// GOOD: Use unknown instead of any
function parseJson(input: string): unknown {
  return JSON.parse(input);
}
```

**Warning signs:**
- More than 10% of types are `any`
- Almost every interface field has `?` optional modifier
- Type definitions don't match actual runtime data shape
- Frequent `!` non-null assertions in business logic
- Comments like `// @ts-ignore: fix later`

**Phase to address:**
Phase 4: TypeScript Strict Mode - After tests exist (tests verify types match reality)

**Sources:**
- [How to Configure TypeScript Strict Mode](https://oneuptime.com/blog/post/2026-01-24-typescript-strict-mode/view)
- [Migrating an existing TypeScript codebase to strict mode](https://alanharper.com.au/posts/2021-02-15-migrating-typescript-strict)
- [TypeScript Strict Mode Plugin (Gradual Migration)](https://github.com/allegro/typescript-strict-plugin)

---

## Moderate Pitfalls

### Pitfall 7: Testing Library Migration Using Old Enzyme Patterns

**What goes wrong:**
When adding React Testing Library to an untested codebase, developers use Enzyme-style patterns that don't work well with RTL's philosophy, leading to brittle tests that break on every refactor.

**Why it happens:**
Developers familiar with Enzyme carry over old patterns: naming the render result `wrapper`, testing implementation details, shallow rendering mental models. RTL's "test like a user" approach is fundamentally different.

**Prevention:**
```typescript
// BAD: Enzyme patterns in RTL
const wrapper = render(<MyComponent />);
wrapper.find('.button').simulate('click');

// BAD: Testing implementation details
expect(component.state().count).toBe(1);
const instance = wrapper.instance();

// GOOD: RTL user-centric patterns
const { getByRole } = render(<MyComponent />);
const button = getByRole('button', { name: /submit/i });
userEvent.click(button);

// GOOD: Test behavior, not implementation
expect(screen.getByText('Item added')).toBeInTheDocument();

// GOOD: Cleanup is automatic, don't import it
// No need for: afterEach(() => cleanup());
```

**Warning signs:**
- Tests importing `wrapper`, `instance`, `state`
- Tests breaking when renaming CSS classes
- Heavy use of `container.querySelector()`
- Manual cleanup calls (unnecessary in modern RTL)
- Tests that don't use `screen` or accessibility queries

**Phase to address:**
Phase 5: Test Coverage - Establish patterns early to avoid rewriting tests

**Sources:**
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Enzyme vs React Testing Library: A Migration Guide](https://claritydev.net/blog/enzyme-vs-react-testing-library-migration-guide)

---

### Pitfall 8: No Event Listener Cleanup (Memory Leaks in Effects)

**What goes wrong:**
Forgetting to remove event listeners, timers, or subscriptions in `useEffect` cleanup functions causes memory leaks. The number of active listeners grows unbounded over time, especially in development with React Strict Mode's double-mounting.

**Why it happens:**
Cleanup function syntax is easy to forget: `return () => { /* cleanup */ }`. Developers test the happy path (component mounts once) but miss the memory leak that occurs with remounting, navigation, or hot module replacement.

**Prevention:**
```typescript
// BAD: No cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize);
  const interval = setInterval(pollMessages, 1000);
}, []);

// GOOD: Cleanup function
useEffect(() => {
  function handleResize() { /* ... */ }

  window.addEventListener('resize', handleResize);
  const interval = setInterval(pollMessages, 1000);

  // Cleanup runs on unmount and before re-running effect
  return () => {
    window.removeEventListener('resize', handleResize);
    clearInterval(interval);
  };
}, []);

// GOOD: Cleanup external connections
useEffect(() => {
  const channel = supabase.channel('messages');
  channel.subscribe();

  return () => {
    channel.unsubscribe();
  };
}, []);
```

**Warning signs:**
- Memory usage growing in development with hot reload
- DevTools showing duplicate event listeners on global objects
- Effects running multiple times in React Strict Mode (development)
- Timers continuing after component unmount

**Phase to address:**
Phase 1: Memory & Resource Cleanup - Foundation for stability

**Sources:**
- [Memory Leak Prevention in Next.js](https://medium.com/@nextjs101/memory-leak-prevention-in-next-js-47b414907a43)
- [React useEffect Documentation](https://react.dev/reference/react/useEffect)

---

### Pitfall 9: Unclosed Database Connections in Serverless Functions

**What goes wrong:**
Opening database connections (Supabase clients, Prisma clients) in API routes without proper connection pooling or reuse causes "too many connections" errors and memory leaks.

**Why it happens:**
Traditional server code opens one connection at startup and reuses it. Serverless inverts this: each warm-start function invocation reuses the entire runtime, including any global state. Creating a new Supabase client per request exhausts connection pools.

**Prevention:**
```typescript
// BAD: New client per request
export async function GET() {
  const supabase = createClient(url, key);  // New connection!
  const data = await supabase.from('users').select();
  return Response.json(data);
}

// GOOD: Singleton client (connection pooling built-in)
// lib/supabase/server.ts
let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// GOOD: Use Supabase's built-in connection pooling
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-connection-pool': 'enabled' },
  },
});
```

**Warning signs:**
- "too many connections" errors in logs
- Increasing connection count in Supabase dashboard
- Slow API responses after high traffic (connection pool exhausted)
- Database refusing new connections intermittently

**Phase to address:**
Phase 1: Memory & Resource Cleanup

**Sources:**
- [Memory Leaks in React & Next.js: What Nobody Tells You](https://medium.com/@essaadani.yo/memory-leaks-in-react-next-js-what-nobody-tells-you-91c72b53d84d)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)

---

### Pitfall 10: Rate Limiting Without Proper User Identification

**What goes wrong:**
Implementing rate limiting based on IP addresses in serverless environments where all traffic appears to come from the same proxy IP (Vercel, Cloudflare). All users get rate-limited together.

**Why it happens:**
Traditional rate limiting uses `req.ip`, which works for VPS/dedicated servers. In serverless/edge environments behind proxies, `req.ip` is the proxy IP, not the user's IP. Must use headers like `X-Forwarded-For` or authenticated user IDs.

**Prevention:**
```typescript
// BAD: Rate limit by IP in serverless
const limiter = rateLimit({
  keyGenerator: (req) => req.ip  // All users same IP!
});

// GOOD: Use forwarded IP
import { ipAddress } from '@vercel/edge';

const limiter = rateLimit({
  keyGenerator: (req) => {
    return ipAddress(req) || 'anonymous';
  }
});

// BETTER: Use authenticated user ID
const limiter = rateLimit({
  keyGenerator: async (req) => {
    const session = await getSession(req);
    return session?.userId || ipAddress(req) || 'anonymous';
  }
});

// BEST: Tiered rate limits
const limiter = rateLimit({
  keyGenerator: async (req) => {
    const session = await getSession(req);
    if (!session) return `anon:${ipAddress(req)}`;

    const user = await getUser(session.userId);
    return user.isPremium
      ? `premium:${user.id}`
      : `user:${user.id}`;
  },
  max: (req, key) => {
    if (key.startsWith('premium:')) return 1000;
    if (key.startsWith('user:')) return 100;
    return 10; // Anonymous
  }
});
```

**Warning signs:**
- All users rate-limited simultaneously
- Rate limit resets affecting everyone at once
- Inability to distinguish users in rate limit logs
- Cloudflare/Vercel proxy IPs showing up as request origin

**Phase to address:**
Phase 2: Security Hardening - Implement alongside CSRF protection

**Sources:**
- [Rate Limiting Next.js API Routes using Upstash Redis](https://upstash.com/blog/nextjs-ratelimiting)
- [Implementing Rate Limiting in API Routes with Express and Next.js](https://dev.to/itselftools/implementing-rate-limiting-in-api-routes-with-express-and-nextjs-4ffl)

---

## Minor Pitfalls

### Pitfall 11: Vercel Serverless 60-Second Timeout Blocking User Experience

**What goes wrong:**
Long-running operations (AI processing, large file uploads) hit Vercel's 60-second timeout for serverless functions (10s for Hobby tier), causing user-facing failures. SoulPrint's RLM service timeout blocks chat during outages.

**Why it happens:**
Developers design flows assuming unlimited request time, forgetting serverless platforms enforce strict timeouts. The solution isn't "increase timeout" (not always possible) but architectural change to async processing.

**Prevention:**
```typescript
// BAD: Blocking synchronous processing
export async function POST(req: Request) {
  const file = await req.formData();
  const result = await processLargeFile(file);  // Takes 90s!
  return Response.json(result);
}

// GOOD: Job queue pattern
export async function POST(req: Request) {
  const file = await req.formData();
  const jobId = await queue.enqueueJob({ file });

  return Response.json({
    jobId,
    statusUrl: `/api/jobs/${jobId}`
  });
}

// Client polls for completion
const { data: job } = useSWR(`/api/jobs/${jobId}`, fetcher, {
  refreshInterval: (data) => data?.status === 'complete' ? 0 : 2000
});

// GOOD: Circuit breaker for external services
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callRLMService, {
  timeout: 5000,  // Fail fast
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

breaker.fallback(() => ({
  error: 'Service temporarily unavailable',
  useCache: true
}));
```

**Warning signs:**
- Function timeout errors in Vercel logs
- Users reporting "request failed" after exactly 60s
- Long-running operations in request handlers
- No status endpoints for async operations

**Phase to address:**
Phase 1: Memory & Resource Cleanup (timeout handling) and Phase 3: Race Conditions (async patterns)

**Sources:**
- [Vercel Serverless Function Limits](https://vercel.com/docs/functions/runtimes#max-duration)
- [Next.js 16 Route Handlers Explained](https://strapi.io/blog/nextjs-16-route-handlers-explained-3-advanced-usecases)

---

### Pitfall 12: Testing API Routes Without Mocking External Services

**What goes wrong:**
Tests call real external APIs (RLM service, Supabase, email APIs), causing flaky tests, expensive API usage, and test failures when services are down.

**Why it happens:**
API routes naturally call external services. Without mocking strategy, tests exercise the real integration path. This seems thorough but makes tests slow, flaky, and environment-dependent.

**Prevention:**
```typescript
// BAD: Tests hit real services
test('processes import', async () => {
  const response = await POST(mockRequest);  // Calls real RLM!
  expect(response.status).toBe(200);
});

// GOOD: Mock external services
import { vi } from 'vitest';

vi.mock('@/lib/rlm/client', () => ({
  createSoulprint: vi.fn().mockResolvedValue({ id: 'mock-123' })
}));

test('processes import', async () => {
  const response = await POST(mockRequest);
  expect(createSoulprint).toHaveBeenCalledWith(expect.objectContaining({
    conversations: expect.any(Array)
  }));
});

// GOOD: Test doubles with MSW (Mock Service Worker)
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.post('https://soulprint-rlm.com/create', (req, res, ctx) => {
    return res(ctx.json({ id: 'mock-123' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**Warning signs:**
- Tests taking minutes to run
- Test failures when internet is slow
- Surprising API bills from test runs
- Tests passing/failing based on external service status
- Need for network access to run tests

**Phase to address:**
Phase 5: Test Coverage - Establish mocking patterns early

**Sources:**
- [Testing Next.js Applications: A Complete Guide](https://trillionclues.medium.com/testing-next-js-applications-a-complete-guide-to-catching-bugs-before-qa-does-a1db8d1a0a3b)
- [Next.js Testing Documentation](https://nextjs.org/docs/app/guides/testing)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `any` to silence TypeScript errors | Fast compilation, no type errors | Complete loss of type safety, runtime errors | **Never acceptable** in new code; only during gradual strict mode migration with `//@ts-strict-ignore` |
| Skipping CSRF protection on "internal" APIs | Faster development, fewer dependencies | Vulnerable to CSRF attacks if API becomes public or used by third-party | Only acceptable for truly read-only APIs or GET endpoints |
| Polling instead of WebSockets/SSE | Simple implementation, no connection management | Higher latency, more server load, race conditions | Acceptable for low-frequency updates (<1/sec) with proper race condition handling |
| In-memory caching without TTL | Fast lookups, no external dependencies | Memory leaks, stale data | Only acceptable with explicit size limits and TTL eviction |
| Service role key for "admin" operations | Bypass RLS complexity | Complete database access if leaked | Acceptable **only** in server-side API routes, never in client code, with quarterly key rotation |
| Skipping test coverage for MVP | Faster initial development | Impossible to refactor safely later | Acceptable for true throwaway prototypes; not acceptable for production codebases |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS | Assuming service role respects RLS policies | Service role bypasses RLS completely; use server-side only, rotate quarterly |
| Supabase Tables | Assuming tables are secure by default | Explicitly `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for every table |
| AWS Bedrock / Claude | Blocking request waiting for response | Stream responses with SSE or use async job queue for long operations |
| Vercel Deployment | Relying on in-memory state between requests | Use external cache (Redis/Upstash) or accept ephemeral state loss |
| Email APIs (Resend) | Sending emails synchronously in request handler | Queue emails or use fire-and-forget with error logging |
| RLM Service | No timeout or circuit breaker | Implement 5-10s timeout with fallback behavior |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| In-memory chunked upload storage | Memory usage grows continuously | Use Cloudflare R2, S3, or Redis with TTL | >100 concurrent uploads or >10MB chunks |
| Polling without request cancellation | Multiple in-flight requests, data races | Use AbortController or SWR/TanStack Query | Polling interval <5s |
| Missing database indexes on foreign keys | Slow queries as data grows | Index all foreign key columns, query predicates | >10K rows in joined tables |
| Loading entire conversation history | Page load times increase linearly | Implement pagination or cursor-based loading | >100 messages per conversation |
| Synchronous AI embeddings | API timeout during large imports | Batch embeddings, use async processing | >100 chunks to embed |
| No connection pooling for Supabase | "Too many connections" errors | Use singleton client with pooling | >50 concurrent requests |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS disabled on tables | Complete data exposure via anon key | Audit: `SELECT tablename FROM pg_tables WHERE rowsecurity = false` |
| Service role key in client bundle | Superuser database access to attackers | Never use `NEXT_PUBLIC_*` for service keys; server-side only |
| No CSRF protection on state-changing APIs | Attackers can trigger actions on behalf of users | Implement edge-csrf or next-csrf on all POST/PUT/DELETE routes |
| No rate limiting on expensive operations | DoS via AI generation or large queries | Implement per-user rate limits using Upstash or similar |
| Trusting client-side validation | Users bypass validation via browser DevTools | Always validate on server-side; client validation is UX only |
| Storing sensitive data in localStorage | XSS attacks exfiltrate tokens/keys | Use httpOnly cookies for auth tokens; never store secrets client-side |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Import Processing:** Often missing error handling for malformed ZIP files — verify decompression errors caught and reported
- [ ] **Memory Cleanup:** Often missing TTL on in-memory caches — verify cleanup function runs on interval or size limit
- [ ] **RLS Policies:** Often missing policies for UPDATE/DELETE when only SELECT implemented — verify all operation types
- [ ] **Rate Limiting:** Often missing anonymous user limits — verify both authenticated and unauthenticated flows limited
- [ ] **Polling Effects:** Often missing cleanup/cancellation — verify useEffect returns cleanup function
- [ ] **Database Connections:** Often missing connection pooling config — verify singleton pattern or explicit pooling
- [ ] **TypeScript Strict:** Often missing runtime validation at boundaries — verify `unknown` types validated with type guards
- [ ] **CSRF Tokens:** Often missing from forms — verify token in hidden field and validated on server
- [ ] **Test Mocks:** Often missing reset between tests — verify `afterEach(() => vi.clearAllMocks())`
- [ ] **Circuit Breakers:** Often missing fallback behavior — verify what happens when circuit opens

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Memory leak in production | **LOW** | Restart serverless functions (automatic on deploy), add TTL cleanup for future |
| RLS not enabled (data exposed) | **HIGH** | 1. Enable RLS immediately 2. Audit access logs for breach 3. Notify affected users 4. Rotate keys |
| Service role key leaked | **CRITICAL** | 1. Rotate key immediately in Supabase dashboard 2. Audit database logs 3. Force re-auth all users 4. Security incident response |
| Race condition in production | **MEDIUM** | 1. Reduce polling frequency as band-aid 2. Deploy AbortController fix 3. Add E2E test for race condition |
| CSRF vulnerability exploited | **HIGH** | 1. Deploy CSRF protection 2. Invalidate all sessions 3. Audit for unauthorized actions 4. Notify users |
| TypeScript strict mode regression | **LOW** | 1. Revert to loose mode temporarily 2. Add `//@ts-strict-ignore` to problematic files 3. Fix incrementally |
| Unclosed connections exhausting pool | **MEDIUM** | 1. Restart services to reset connections 2. Implement singleton client pattern 3. Add connection limit alerts |
| 60s timeout blocking users | **MEDIUM** | 1. Add client-side timeout warning 2. Implement job queue for async processing 3. Add status polling endpoint |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| In-memory state accumulation | Phase 1: Memory & Resource Cleanup | Load test with autocannon; memory usage plateaus, doesn't grow |
| Service role key client-side | Phase 2: Security Hardening | Grep codebase for `NEXT_PUBLIC.*SERVICE` and `createClient.*service` |
| RLS not enabled | Phase 2: Security Hardening | SQL query: all tables have RLS enabled |
| Race conditions in polling | Phase 3: Race Condition Fixes | E2E test with delayed responses; UI shows correct data |
| CSRF protection conflicts | Phase 2: Security Hardening | Integration test: forms with valid token accepted, invalid rejected |
| TypeScript strict mode issues | Phase 4: TypeScript Strict Mode | Build succeeds with `strict: true`, <5% of types are `unknown` |
| Event listener leaks | Phase 1: Memory & Resource Cleanup | React DevTools: no duplicate listeners after remount |
| Unclosed DB connections | Phase 1: Memory & Resource Cleanup | Connection count stable under load |
| Rate limiting by wrong key | Phase 2: Security Hardening | Test: different users have separate rate limits |
| 60s timeout blocking UX | Phase 1: Memory & Resource Cleanup | All API routes respond <5s or use async pattern |
| Testing without mocks | Phase 5: Test Coverage | Tests run offline in <30s |
| Enzyme patterns in RTL | Phase 5: Test Coverage | No imports of `wrapper` or `instance` in tests |

---

## Sources

**Testing & Migration:**
- [Testing Next.js Applications: A Complete Guide](https://trillionclues.medium.com/testing-next-js-applications-a-complete-guide-to-catching-bugs-before-qa-does-a1db8d1a0a3b)
- [Next.js Testing Documentation](https://nextjs.org/docs/app/guides/testing)
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Enzyme vs React Testing Library: A Migration Guide](https://claritydev.net/blog/enzyme-vs-react-testing-library-migration-guide)

**Security (CSRF & Rate Limiting):**
- [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions)
- [Implementing CSRF Protection in Next.js Applications](https://medium.com/@mmalishshrestha/implementing-csrf-protection-in-next-js-applications-9a29d137a12d)
- [Edge-CSRF: CSRF protection for Next.js middleware](https://github.com/vercel/next.js/discussions/59660)
- [Rate Limiting Next.js API Routes using Upstash Redis](https://upstash.com/blog/nextjs-ratelimiting)
- [Complete Next.js security guide 2025](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)

**TypeScript Strict Mode:**
- [How to Configure TypeScript Strict Mode](https://oneuptime.com/blog/post/2026-01-24-typescript-strict-mode/view)
- [Migrating an existing TypeScript codebase to strict mode](https://alanharper.com.au/posts/2021-02-15-migrating-typescript-strict)
- [TypeScript Strict Mode Plugin (Gradual Migration)](https://github.com/allegro/typescript-strict-plugin)

**React Race Conditions:**
- [Avoiding Race Conditions when Fetching Data with React Hooks](https://dev.to/nas5w/avoiding-race-conditions-when-fetching-data-with-react-hooks-4pi9)
- [Fixing Race Conditions in React with useEffect](https://maxrozen.com/race-conditions-fetching-data-react-with-useeffect)
- [React useEffect Documentation](https://react.dev/reference/react/useEffect)

**Memory Management & Serverless:**
- [Memory Leaks in React & Next.js: What Nobody Tells You](https://medium.com/@essaadani.yo/memory-leaks-in-react-next-js-what-nobody-tells-you-91c72b53d84d)
- [Memory Leak Prevention in Next.js](https://medium.com/@nextjs101/memory-leak-prevention-in-next-js-47b414907a43)
- [Next.js Official: Memory Usage Guide](https://nextjs.org/docs/app/guides/memory-usage)
- [Next.js 16 Route Handlers Explained](https://strapi.io/blog/nextjs-16-route-handlers-explained-3-advanced-usecases)

**Supabase RLS & Security:**
- [Supabase Row Level Security Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security)
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Why is my service role key client getting RLS errors?](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z)
- [How to Secure Your Supabase Service Role Key](https://chat2db.ai/resources/blog/secure-supabase-role-key)

---
*Pitfalls research for: Next.js 16 App Router stabilization and hardening*
*Researched: 2026-02-06*
