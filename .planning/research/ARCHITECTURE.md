# Architecture Research: Next.js 16 App Router Stabilization

**Domain:** Next.js App Router Stabilization & Hardening
**Researched:** 2026-02-06
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Browser)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Pages  │  │ Client  │  │ Server  │  │  Route  │        │
│  │  (TSX)  │  │  Comp   │  │  Comp   │  │ Handler │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
├───────┴────────────┴────────────┴────────────┴──────────────┤
│                 Next.js Middleware Chain                     │
│  ┌───────────┐  ┌──────────┐  ┌────────────────────┐       │
│  │   Auth    │→ │   CSRF   │→ │  Rate Limiting     │       │
│  │ (Supabase)│  │  Check   │  │   (WAF/Edge)       │       │
│  └───────────┘  └──────────┘  └────────────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    API Routes (Serverless)                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  /api/import/*  /api/chat/*  /api/memory/*         │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                  Shared Libraries (lib/)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Supabase │  │  Bedrock │  │   RLM    │                   │
│  │  Client  │  │   Utils  │  │  Health  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
├─────────────────────────────────────────────────────────────┤
│                   External Services                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ Supabase │  │   AWS    │  │   RLM    │                   │
│  │    DB    │  │ Bedrock  │  │ Service  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Pages (app/) | Route rendering, layout management | Server Components by default |
| Client Components | Interactive UI, state management | "use client" directive |
| Server Components | Data fetching, direct DB access | Async functions, no state |
| Route Handlers (api/) | HTTP endpoints, JSON responses | Serverless functions on Vercel |
| Middleware | Request interception, auth, CSRF | Edge runtime (lightweight) |
| Server Actions | Form handling, mutations | "use server" directive |
| Shared Libraries (lib/) | Business logic, external integrations | Pure functions, clients |

## Recommended Project Structure for Hardening

```
soulprint-landing/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (serverless)
│   │   ├── import/           # File upload/processing
│   │   ├── chat/             # Streaming chat
│   │   └── memory/           # Memory queries
│   ├── (pages)/              # Page components
│   └── middleware.ts         # CSRF, auth, rate limiting
├── lib/                      # Shared business logic
│   ├── supabase/             # DB client, auth
│   ├── bedrock.ts            # AWS Bedrock integration
│   ├── rlm/                  # External RLM service
│   └── memory/               # Memory/chunking logic
├── __tests__/                # Test files (Vitest)
│   ├── unit/                 # Unit tests for lib/
│   ├── integration/          # API route integration tests
│   └── e2e/                  # Playwright E2E tests
├── middleware.ts             # Global middleware chain
├── vitest.config.mts         # Vitest configuration
└── tsconfig.json             # TypeScript config (strict)
```

### Structure Rationale

- **__tests__/ directory**: Separate test organization by type (unit/integration/e2e) makes it easy to run subsets
- **lib/ isolation**: Pure functions and external service clients enable easier unit testing
- **middleware.ts at root**: Single entry point for all middleware concerns (auth, CSRF, rate limiting)
- **API routes grouped by domain**: `/api/import/*`, `/api/chat/*` creates clear boundaries for testing and security

## Architectural Patterns for Stabilization

### Pattern 1: Data Access Layer (DAL)

**What:** Isolate all database and external service calls in dedicated modules with built-in authorization checks.

**When to use:** When hardening an existing app to prevent security issues and improve testability.

**Trade-offs:**
- **Pros:** Centralized auth, easier to audit, testable without mocking everything
- **Cons:** Requires refactoring existing code, slight performance overhead

**Example:**
```typescript
// lib/data/auth.ts
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
});

// lib/data/user-dto.ts
import 'server-only';
import { getCurrentUser } from './auth';

export async function getUserProfile(userId: string) {
  const currentUser = await getCurrentUser();

  // Re-authorize: ensure current user can access this profile
  if (currentUser.id !== userId) {
    throw new Error('Forbidden');
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('username, soulprint_text, import_status')
    .eq('id', userId)
    .single();

  // Return only necessary fields (DTO pattern)
  return {
    username: data.username,
    hasSoulprint: !!data.soulprint_text,
    isReady: data.import_status === 'complete'
  };
}
```

### Pattern 2: Middleware Chain with CSRF Protection

**What:** Compose multiple middleware functions in a single `middleware.ts` file for auth, CSRF, and rate limiting.

**When to use:** When adding security layers to an existing Next.js app without breaking existing routes.

**Trade-offs:**
- **Pros:** Single entry point, easy to audit, runs at edge
- **Cons:** Limited runtime features (edge), must be careful with ordering

**Example:**
```typescript
// middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createCsrfProtect } from '@edge-csrf/nextjs';

// Initialize CSRF protection
const csrfProtect = createCsrfProtect({
  cookie: {
    secure: process.env.NODE_ENV === 'production',
  },
});

export async function middleware(request: NextRequest) {
  // 1. Auth check (existing)
  const response = await updateSession(request);

  // 2. CSRF protection for mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfError = await csrfProtect(request, response);
    if (csrfError) {
      return NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      );
    }
  }

  // 3. Rate limiting handled by Vercel WAF (configured separately)

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Pattern 3: API Route with Rate Limiting (Vercel WAF)

**What:** Use `@vercel/firewall` SDK to add custom rate limiting logic in API routes.

**When to use:** When you need per-user or per-organization rate limiting beyond IP-based limits.

**Trade-offs:**
- **Pros:** Flexible, can rate limit by user/org/API key, integrates with Vercel dashboard
- **Cons:** Requires Vercel deployment, configuration in dashboard + code

**Example:**
```typescript
// app/api/import/process/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@vercel/firewall';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 5 imports per hour per user
  const { rateLimited } = await checkRateLimit('import-process', {
    request,
    rateLimitKey: user.id,
  });

  if (rateLimited) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in an hour.' },
      { status: 429 }
    );
  }

  // Process import...
  return NextResponse.json({ status: 'processing' });
}
```

### Pattern 4: Serverless Memory Cleanup

**What:** Ensure proper cleanup of connections and resources since serverless functions are stateless.

**When to use:** Always, especially for database connections, file handles, and streaming responses.

**Trade-offs:**
- **Pros:** Prevents memory leaks, better performance, lower costs
- **Cons:** Requires discipline, harder to debug

**Example:**
```typescript
// app/api/chat/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let stream: ReadableStream | null = null;

  try {
    // Your streaming logic here...
    const response = await fetch('https://api.example.com/stream');
    stream = response.body;

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    // Cleanup on error
    stream?.cancel();
    return NextResponse.json({ error: 'Stream failed' }, { status: 500 });
  }
  // Note: Supabase client cleanup is automatic in Next.js
}

// For long-running processes, use explicit cleanup:
export const runtime = 'nodejs'; // If needed (default is edge)
export const maxDuration = 60; // Vercel timeout limit
```

### Pattern 5: Incremental TypeScript Strict Mode

**What:** Enable TypeScript strict mode incrementally using `@ts-expect-error` comments and per-file enforcement.

**When to use:** When migrating an existing loose TypeScript codebase to strict mode.

**Trade-offs:**
- **Pros:** Non-breaking, can prioritize high-risk files first, team can learn gradually
- **Cons:** Takes time, creates temporary inconsistency

**Example:**
```typescript
// tsconfig.json (initial state - already strict!)
{
  "compilerOptions": {
    "strict": true,  // Already enabled
    "noUncheckedIndexedAccess": true  // Add this for extra safety
  }
}

// For incremental migration in files with issues:
// lib/legacy-code.ts
import { User } from './types';

function getUser(id: string): User {
  const users = getUsersFromDB();

  // @ts-expect-error - TODO: Add proper null checking (Issue #123)
  return users[id];

  // Better approach after fix:
  // const user = users[id];
  // if (!user) throw new Error('User not found');
  // return user;
}
```

## Data Flow

### Request Flow (Page Load)

```
User navigates to /chat
    ↓
Middleware: Auth check (Supabase) → CSRF token → Pass
    ↓
Server Component: Fetch user profile (lib/data/user-dto.ts)
    ↓
Data Access Layer: getCurrentUser() + DB query (authorized)
    ↓
Server Component: Render page with data
    ↓
Client Component: Hydrate interactive elements
```

### Request Flow (API Route)

```
Client: POST /api/chat with message
    ↓
Middleware: Auth check → CSRF validation → Rate limit check
    ↓
API Route: Validate input (Zod/manual)
    ↓
API Route: Re-authorize user (getCurrentUser)
    ↓
Business Logic: Query memory (lib/memory/query.ts)
    ↓
External Service: Call AWS Bedrock for LLM response
    ↓
Stream Response: Return ReadableStream to client
    ↓
Cleanup: Close connections (if any)
```

### State Management

```
[Server State]
    ↓ (fetch on server)
[Server Components] → Render with data
    ↓ (pass props)
[Client Components] ← useState/useReducer for local UI state
    ↓ (mutations)
[Server Actions or API Routes] → Update server state
    ↓ (revalidate)
[Server Components] → Re-render with fresh data
```

### Key Data Flows

1. **Import Flow**: User uploads ZIP → API validates → Chunks created → Embeddings sent to RLM → SoulPrint saved → Email notification
2. **Chat Flow**: User message → Rate limit check → Memory query (lib/memory/) → Bedrock LLM → Stream response
3. **Auth Flow**: Login → Supabase auth → Session cookie → Middleware checks on every request

## Hardening Work Structure (Build Order)

### Phase 1: Testing Infrastructure (No Dependencies)
**Rationale:** Foundation for all other work. Catch regressions early.

1. Install Vitest + React Testing Library
2. Configure `vitest.config.mts` with jsdom environment
3. Add test script to `package.json`
4. Create `__tests__/` directory structure
5. Write first smoke test (lib utility function)

**Component boundaries to test:**
- `lib/` utilities (pure functions) - unit tests
- `lib/supabase/client.ts` - mock Supabase, test error handling
- `lib/bedrock.ts` - mock AWS SDK, test streaming

### Phase 2: API Route Testing (Depends on Phase 1)
**Rationale:** API routes are the attack surface. Need integration tests before adding security.

1. Install `next-test-api-route-handler` (optional)
2. Mock Supabase auth in tests
3. Write integration tests for `/api/import/process`
4. Write integration tests for `/api/chat/route`
5. Test error cases (401, 403, 500)

**Component boundaries to test:**
- `/api/import/*` - file upload, chunking, error handling
- `/api/chat/*` - streaming, memory queries, rate limiting
- `/api/memory/*` - CRUD operations, authorization

### Phase 3: TypeScript Strict Fixes (Parallel with Phase 2)
**Rationale:** Already in strict mode, but add `noUncheckedIndexedAccess` for extra safety.

1. Add `"noUncheckedIndexedAccess": true` to `tsconfig.json`
2. Fix index access errors in high-risk files (API routes first)
3. Add `@ts-expect-error` comments with TODOs for complex fixes
4. Create tracking issue with list of files to fix
5. Fix 5-10 files per week until clean

**Priority order:**
1. `/app/api/` routes (security-critical)
2. `lib/data/` layer (if created)
3. `lib/` utilities
4. UI components (lowest risk)

### Phase 4: Middleware Security (Depends on Phase 2 tests)
**Rationale:** Add CSRF and rate limiting after tests are in place to catch breaks.

1. Install `@edge-csrf/nextjs` for CSRF protection
2. Update `middleware.ts` with CSRF checks for mutating methods
3. Add CSRF token handling in client components
4. Test with existing API route tests
5. Configure Vercel WAF rate limiting rules in dashboard

**Integration points:**
- `middleware.ts` → All routes
- `@edge-csrf/nextjs` → POST/PUT/PATCH/DELETE requests
- Vercel WAF → IP-based rate limiting (global)

### Phase 5: Custom Rate Limiting (Depends on Phase 4)
**Rationale:** User-specific rate limiting needs middleware foundation.

1. Install `@vercel/firewall` SDK
2. Create WAF rules in Vercel dashboard
3. Add `checkRateLimit()` calls in high-risk API routes:
   - `/api/import/process` (5 per hour per user)
   - `/api/chat/route` (60 per minute per user)
   - `/api/memory/synthesize` (10 per hour per user)
4. Add rate limit tests to integration test suite
5. Monitor Vercel analytics for abuse patterns

**Component boundaries:**
- API routes that accept user input
- API routes that call expensive external services (Bedrock, RLM)

### Phase 6: Error Handling & Logging (Depends on all phases)
**Rationale:** Unified error handling after security is in place.

1. Create `lib/errors.ts` with custom error classes
2. Add error boundary components for UI
3. Standardize API error responses (JSON schema)
4. Add structured logging (consider Axiom or Sentry)
5. Test error flows in integration tests

**Integration points:**
- All API routes (consistent error responses)
- Server Components (error boundaries)
- Client Components (error boundaries + user-friendly messages)

### Phase 7: Data Access Layer Refactor (Optional, Depends on Phase 2)
**Rationale:** Big refactor. Only needed if current code mixes auth and data access.

1. Create `lib/data/auth.ts` with `getCurrentUser()`
2. Create `lib/data/user-dto.ts` with profile queries
3. Refactor API routes to use DAL instead of direct Supabase calls
4. Add unit tests for DAL functions
5. Add integration tests to verify auth still works

**Files to refactor:**
- `/app/api/import/process/route.ts`
- `/app/api/chat/route.ts`
- `/app/api/memory/query/route.ts`
- Any Server Components fetching data

## Anti-Patterns

### Anti-Pattern 1: Using `any` to Bypass TypeScript Errors

**What people do:** Add `as any` or `: any` to silence TypeScript errors during strict mode migration.

**Why it's wrong:** Defeats the purpose of strict mode. Type unsafety spreads like a virus.

**Do this instead:** Use `@ts-expect-error` with a TODO comment and issue number.

```typescript
// BAD
const user = getUser(id) as any;

// GOOD
// @ts-expect-error - TODO: Add proper User type (Issue #123)
const user = getUser(id);
```

### Anti-Pattern 2: In-Memory State in Serverless Functions

**What people do:** Use module-level variables to cache data in API routes.

**Why it's wrong:** Serverless functions are stateless. State is lost between invocations and not shared across instances.

**Do this instead:** Use external services (Redis, Supabase realtime, Vercel KV).

```typescript
// BAD
let cachedUsers: User[] = [];

export async function GET() {
  if (cachedUsers.length === 0) {
    cachedUsers = await fetchUsers();
  }
  return NextResponse.json(cachedUsers);
}

// GOOD
import { kv } from '@vercel/kv';

export async function GET() {
  let users = await kv.get<User[]>('users');
  if (!users) {
    users = await fetchUsers();
    await kv.set('users', users, { ex: 300 }); // 5 min TTL
  }
  return NextResponse.json(users);
}
```

### Anti-Pattern 3: Skipping Auth Re-checks in Server Actions

**What people do:** Assume that if a user loaded the page, they're authorized to perform the action.

**Why it's wrong:** Session could expire, user permissions could change, or action could be replayed.

**Do this instead:** Re-authorize on every Server Action call.

```typescript
// BAD
"use server";

export async function deletePost(postId: number) {
  await db.posts.delete({ where: { id: postId } });
}

// GOOD
"use server";

import { getCurrentUser } from '@/lib/data/auth';

export async function deletePost(postId: number) {
  const user = await getCurrentUser();

  const post = await db.posts.findUnique({ where: { id: postId } });
  if (!post || post.authorId !== user.id) {
    throw new Error('Unauthorized');
  }

  await db.posts.delete({ where: { id: postId } });
}
```

### Anti-Pattern 4: Testing Implementation Details

**What people do:** Test internal component state, private functions, or mock everything.

**Why it's wrong:** Tests break when refactoring, even if behavior is unchanged. False sense of security.

**Do this instead:** Test user-facing behavior and API contracts.

```typescript
// BAD
import { render } from '@testing-library/react';
import ChatInput from '@/app/chat/ChatInput';

test('ChatInput state updates', () => {
  const { rerender } = render(<ChatInput />);
  // Testing internal state - fragile!
  expect(component.state.message).toBe('');
});

// GOOD
import { render, screen, userEvent } from '@testing-library/react';
import ChatInput from '@/app/chat/ChatInput';

test('ChatInput calls onSubmit with message', async () => {
  const onSubmit = vi.fn();
  render(<ChatInput onSubmit={onSubmit} />);

  await userEvent.type(screen.getByRole('textbox'), 'Hello world');
  await userEvent.click(screen.getByRole('button', { name: /send/i }));

  expect(onSubmit).toHaveBeenCalledWith('Hello world');
});
```

### Anti-Pattern 5: No Cleanup in Streaming Responses

**What people do:** Return streaming responses without handling connection close or errors.

**Why it's wrong:** Leaves connections open, causes memory leaks on Vercel (hits function memory limits).

**Do this instead:** Always handle abort signals and cleanup.

```typescript
// BAD
export async function POST(request: NextRequest) {
  const stream = await bedrockStream(prompt);
  return new Response(stream);
}

// GOOD
export async function POST(request: NextRequest) {
  const abortController = new AbortController();

  // Cleanup on client disconnect
  request.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  try {
    const stream = await bedrockStream(prompt, {
      signal: abortController.signal
    });
    return new Response(stream);
  } catch (error) {
    if (error.name === 'AbortError') {
      return new Response('Client disconnected', { status: 499 });
    }
    throw error;
  }
}
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase | Client in `lib/supabase/` (server/client variants) | Auth automatic via middleware |
| AWS Bedrock | Streaming client in `lib/bedrock.ts` | Requires AWS credentials (env vars) |
| RLM Service | HTTP client in `lib/rlm/` | Health checks needed, retries |
| Vercel WAF | Dashboard config + SDK in API routes | Rate limiting, DDOS protection |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Middleware ↔ API Routes | HTTP request/response | Middleware sets headers, API reads them |
| Server Components ↔ Client Components | Props (RSC payload) | Cannot pass functions, only serializable data |
| API Routes ↔ lib/ utilities | Direct function calls | Keep lib/ pure for testability |
| Client ↔ Server Actions | Automatic RPC (Next.js) | CSRF protection automatic, still re-auth |

## Testing Strategy

### Unit Tests (Vitest + @testing-library/react)

**What to test:**
- `lib/` utilities (pure functions)
- React components (user interactions, not implementation)
- Data transformation functions

**Example:**
```typescript
// __tests__/unit/lib/memory/query.test.ts
import { describe, it, expect, vi } from 'vitest';
import { queryMemory } from '@/lib/memory/query';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [] }))
      }))
    }))
  }))
}));

describe('queryMemory', () => {
  it('returns empty array when no memories found', async () => {
    const result = await queryMemory('test-user-id', 'hello');
    expect(result).toEqual([]);
  });
});
```

### Integration Tests (Vitest)

**What to test:**
- API routes (request → response)
- Auth flows (middleware integration)
- Database queries (use test database)

**Example:**
```typescript
// __tests__/integration/api/import/process.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/import/process/route';
import { NextRequest } from 'next/server';

describe('POST /api/import/process', () => {
  beforeEach(async () => {
    // Setup test user in test DB
  });

  it('returns 401 without auth', async () => {
    const request = new NextRequest('http://localhost/api/import/process', {
      method: 'POST',
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('processes valid import with auth', async () => {
    const request = new NextRequest('http://localhost/api/import/process', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer test-token' },
      body: JSON.stringify({ file: 'valid-export.zip' })
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

### E2E Tests (Playwright - Optional)

**What to test:**
- Critical user flows (signup → import → chat)
- Server Components + Client Components working together
- Async Server Components (not supported in Vitest)

**Not covered in this research** - Defer to separate E2E testing phase.

## Scalability Considerations

| Concern | Current (100 users) | At 10K users | At 1M users |
|---------|---------------------|--------------|-------------|
| **API Rate Limiting** | IP-based WAF rules | User-based + IP-based | Multi-tier (free/paid), Redis-backed |
| **Serverless Costs** | Free tier sufficient | Monitor Vercel usage, optimize functions | Consider dedicated infrastructure |
| **Database Connections** | Supabase connection pooling | Increase pool size, optimize queries | Read replicas, caching layer |
| **Memory/Embeddings** | RLM service handles | Monitor RLM performance | Consider vector DB migration |
| **File Storage** | Supabase Storage (S3-backed) | CDN for static assets | Multi-region replication |

### Scaling Priorities

1. **First bottleneck:** API routes hitting rate limits → Add user-specific rate limiting with Vercel WAF
2. **Second bottleneck:** Database query performance → Add indexes, use Supabase read replicas
3. **Third bottleneck:** File upload processing time → Move to background jobs (Inngest, Vercel Cron)

## Sources

**Testing:**
- [Next.js Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) - Official Next.js testing documentation (HIGH confidence)
- [Next.js with Vitest Example](https://github.com/vercel/next.js/tree/canary/examples/with-vitest) - Official example repository (HIGH confidence)
- [NextJs Unit Testing and End-to-End Testing](https://strapi.io/blog/nextjs-testing-guide-unit-and-e2e-tests-with-vitest-and-playwright) - Comprehensive guide (MEDIUM confidence)
- [Next.js application testing with Vitest and testing library](https://medium.com/@rational_cardinal_ant_861/next-js-application-testing-with-vitest-and-testing-library-592948bb039c) - Community guide (MEDIUM confidence)
- [Test Strategy in the Next.js App Router Era](https://shinagawa-web.com/en/blogs/nextjs-app-router-testing-setup) - App Router specific patterns (MEDIUM confidence)

**Security & Middleware:**
- [How to Think About Security in Next.js](https://nextjs.org/blog/security-nextjs-server-components-actions) - Official security guide (HIGH confidence)
- [Complete Next.js security guide 2025](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices) - Comprehensive security patterns (MEDIUM confidence)
- [Edge-CSRF: CSRF protection for Next.js middleware](https://github.com/vercel/next.js/discussions/38257) - Community discussion (MEDIUM confidence)
- [@csrf-armor/nextjs](https://www.npmjs.com/package/@csrf-armor/nextjs) - CSRF protection package (MEDIUM confidence)

**Rate Limiting:**
- [Rate Limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk) - Official Vercel documentation (HIGH confidence)
- [Add Rate Limiting with Vercel](https://vercel.com/kb/guide/add-rate-limiting-vercel) - Vercel Knowledge Base (HIGH confidence)
- [Rate Limiting Your Next.js App with Vercel Edge](https://upstash.com/blog/edge-rate-limiting) - Community guide with Upstash (MEDIUM confidence)

**TypeScript:**
- [How to Incrementally Migrate an Angular Project to TypeScript Strict Mode](https://www.bitovi.com/blog/how-to-incrementally-migrate-an-angular-project-to-typescript-strict-mode) - Incremental migration patterns (MEDIUM confidence)
- [How to Configure TypeScript Strict Mode](https://oneuptime.com/blog/post/2026-01-24-typescript-strict-mode/view) - Recent guide (MEDIUM confidence)
- [typescript-strict-plugin](https://github.com/allegro/typescript-strict-plugin) - Per-file strict mode tool (MEDIUM confidence)

**Serverless & Memory:**
- [Memory Leak Prevention in Next.js](https://medium.com/@nextjs101/memory-leak-prevention-in-next-js-47b414907a43) - Community guide (MEDIUM confidence)
- [Memory Explosion in Next.js API Routes](https://community.vercel.com/t/memory-explosion-in-next-js-api-routes/25561) - Community discussion (LOW confidence, but valuable real-world issue)
- [Vercel Serverless Function Memory Limit](https://github.com/vercel/next.js/discussions/40248) - Community discussion (LOW confidence)

**Next.js 16:**
- [Next.js 16 Official Release](https://nextjs.org/blog/next-16) - Official changelog (HIGH confidence)
- [Next.js 16 Middleware & Edge Functions](https://medium.com/@mernstackdevbykevin/next-js-16-middleware-edge-functions-latest-patterns-in-2025-8ab2653bc9de) - Community guide (MEDIUM confidence)

---
*Architecture research for: Next.js 16 App Router Stabilization*
*Researched: 2026-02-06*
