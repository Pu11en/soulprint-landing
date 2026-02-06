# Project Research Summary

**Project:** SoulPrint Landing - Next.js App Hardening
**Domain:** Next.js 16 App Router production stabilization (security, testing, TypeScript strict mode)
**Researched:** 2026-02-06
**Confidence:** HIGH

## Executive Summary

SoulPrint is a production Next.js 16 application built with Supabase, AWS Bedrock, and an external RLM service that needs hardening to ensure reliability at scale. The research reveals this is a classic serverless stabilization project where the foundation exists but lacks the production-grade error handling, security layers, testing infrastructure, and resource management required for reliable operation under load.

The recommended approach prioritizes memory and resource cleanup first (preventing serverless function memory leaks), followed by security hardening (CSRF, RLS audits, rate limiting), and then comprehensive testing with Vitest and Playwright. The stack is already modern (Next.js 16, Supabase, TypeScript strict mode enabled), so the work focuses on adding production-grade patterns rather than technology replacement. TypeScript is already in strict mode, which is excellent—the effort is adding runtime validation at boundaries with Zod and fixing any loose patterns that slipped through.

Key risks include memory leaks from unbounded in-memory caches (chunked upload Map), Supabase RLS misconfiguration exposing data, and race conditions in React polling logic. These are all addressable with established patterns: TTL-based cleanup or external caching (Upstash), RLS policy audits with explicit table enablement, and AbortController-based request cancellation. The codebase is in good shape—this is refinement, not rescue.

## Key Findings

### Recommended Stack

The stack research recommends modern, Next.js 16-native tools that work well in serverless environments. The focus is on lightweight, edge-compatible libraries that don't require custom servers or complex configuration.

**Core technologies:**
- **Vitest + React Testing Library**: Unit and component testing — 10-20x faster than Jest, native ESM support, official Next.js recommendation for testing in 2025/2026
- **Playwright**: E2E testing — Multi-browser support, automatic waiting, production-ready. Required for testing async Server Components.
- **@edge-csrf/nextjs**: CSRF protection — Built specifically for Next.js Edge Runtime and Vercel, lightweight and middleware-friendly
- **@upstash/ratelimit**: Rate limiting — Purpose-built for Vercel Edge/serverless with REST API-based Redis, caches data while function is hot
- **Zod**: Runtime validation — TypeScript-first schema validation, infers types from schemas, essential for API routes and user input
- **@total-typescript/ts-reset**: Type safety improvements — "CSS reset" for TypeScript that makes JSON.parse return `unknown` instead of `any`
- **MSW (Mock Service Worker)**: API mocking in tests — Network-level interception works for both client and server testing

**Version requirements:**
- Vitest ^3.0.0 (compatible with Next.js 15/16)
- Playwright ^1.50.0 (works with App Router)
- TypeScript ^5.7.0 with strict mode fully enabled
- @upstash/ratelimit ^2.0.3 for serverless rate limiting

**Alternative considered but not recommended:**
- Jest (slower, complex ESM config)
- Arcjet security (alpha status, use individual libraries instead)
- Helmet.js (requires custom Express server, breaks Vercel optimizations)

### Expected Features

Production-ready Next.js apps require comprehensive error handling, input validation, security headers, CSRF protection, rate limiting, structured logging, request timeouts, and health check endpoints as table stakes. Missing any of these makes the app unreliable or vulnerable.

**Must have (table stakes):**
- Comprehensive error handling in all API routes (try/catch, proper HTTP status codes)
- Server-side input validation with Zod schemas
- Security headers (X-Frame-Options, CSP, Permissions-Policy)
- CSRF protection on all mutating operations (POST/PUT/DELETE)
- Rate limiting on critical routes (import, chat, expensive operations)
- Structured logging with context (correlation IDs, user IDs)
- Request timeouts on all external API calls (LLM, database, RLM service)
- File upload size limits with clear error messages
- Error boundaries at route level (error.tsx files)
- Health check endpoint for monitoring

**Should have (competitive differentiators):**
- Retry logic with exponential backoff for transient failures
- Request correlation IDs for tracing across services
- Graceful degradation when non-critical services fail
- Response size limits to prevent OOM on serverless
- Integration tests for critical API flows
- Observability integration (OpenTelemetry traces, metrics, logs)

**Defer (v2+):**
- Circuit breaker pattern (complex, needs baseline reliability first)
- Idempotency keys (needs evidence of duplicate operation problems)
- Dead letter queue (requires queue infrastructure)
- Feature flags (adds complexity, wait for evidence of need)
- Comprehensive E2E tests (expensive to maintain, focus on critical flows)
- 100% test coverage (diminishing returns after critical paths covered)

**Anti-features (don't build):**
- Real-time everything via WebSockets (use streaming where it matters, polling for status)
- Auto-retry all errors (retry only transient errors, fail fast on client errors)
- Universal caching (cache strategically, fresh data better than fast wrong data)
- Perfect uptime guarantees (focus on fast recovery instead)

### Architecture Approach

The architecture follows Next.js 16 App Router best practices with clear separation of concerns: Server Components for data fetching, Client Components for interactivity, API routes for external integrations, and middleware for cross-cutting concerns (auth, CSRF, rate limiting).

**Major components:**
1. **Middleware Chain** — Single composition point for auth (Supabase), CSRF protection, and rate limiting. Runs at edge for all requests before routing.
2. **API Routes (Serverless)** — Grouped by domain (/api/import/*, /api/chat/*, /api/memory/*) for clear security boundaries and testing isolation.
3. **Data Access Layer (lib/)** — Pure functions and external service clients (Supabase, Bedrock, RLM) with built-in authorization checks. Enables testing without mocking everything.
4. **Testing Infrastructure (__tests__/)** — Organized by type (unit, integration, e2e) for running subsets independently.

**Key architectural patterns:**
- **Data Access Layer (DAL)**: Isolate all database calls with centralized authorization checks (prevents unauthorized access bugs)
- **Middleware composition**: Single point for CSRF, auth, rate limiting (easier to audit, correct ordering guaranteed)
- **Serverless memory cleanup**: Explicit cleanup of connections, streams, event listeners (prevents memory leaks in warm functions)
- **Incremental TypeScript strict**: Use `@ts-expect-error` with TODOs for gradual migration without breaking builds

**Data flow:**
- User uploads ZIP → Extract conversations.json → Store compressed in Supabase Storage → Create multi-tier chunks → Send to RLM for embedding → Generate soulprint → Save to DB → Email notification → User can chat
- Chat message → Middleware (auth, CSRF, rate limit) → API route validates input → Query memory → Call Bedrock with streaming → Return SSE stream → Client displays incrementally

**Integration boundaries:**
- Supabase: Client in lib/supabase/ (server/client variants) with connection pooling
- AWS Bedrock: Streaming client in lib/bedrock.ts with abort controllers
- RLM Service: HTTP client with health checks, circuit breaker for timeouts
- Vercel WAF: Dashboard config + SDK in API routes for user-based rate limiting

### Critical Pitfalls

Research identified 12 pitfalls, ranked by severity. Top 5 must be addressed before launch:

1. **In-memory state accumulation in serverless functions** — Global Maps/arrays that grow unbounded (e.g., chunked upload Map with no TTL) cause OOM errors. Prevention: Use external cache (Upstash Redis) or implement TTL-based cleanup. Warning signs: Memory usage grows continuously without plateau, intermittent OOM errors.

2. **Service role key used client-side or in RLS policies** — Using `SUPABASE_SERVICE_ROLE_KEY` in client code or checking `auth.role() = 'service_role'` in RLS policies (does nothing). Prevention: Service key server-only, never in `NEXT_PUBLIC_*` variables. RLS policies use `auth.uid()` not service role.

3. **RLS not enabled by default (exposed tables)** — Supabase disables RLS by default; tables are publicly accessible until explicitly enabled. Prevention: Run `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;` for every table, audit dashboard for "RLS Enabled" badge.

4. **Race conditions in React polling** — Older API requests resolving after newer ones overwrite correct data with stale data. Prevention: Track request ID and only update state if still latest request, or use AbortController to cancel stale requests, or use SWR/TanStack Query with built-in deduping.

5. **CSRF protection middleware ordering conflicts** — Adding CSRF protection causes middleware conflicts where validation runs twice or in wrong order. Prevention: Single middleware composition point with correct ordering (CSRF before auth), exclude static assets in matcher config.

**Additional concerns:**
- TypeScript strict mode migration: Avoid using `any` to silence errors, use `@ts-expect-error` with TODOs instead
- Event listener cleanup: Always return cleanup function in useEffect for listeners, timers, subscriptions
- Database connections: Use singleton Supabase client with connection pooling, not new client per request
- Rate limiting by wrong key: Use `ipAddress(req)` or authenticated user ID, not `req.ip` (always proxy IP in serverless)
- 60-second timeout: Use job queue pattern for long operations, circuit breaker for external service calls

## Implications for Roadmap

Based on research, suggested 5-phase structure addresses dependencies systematically:

### Phase 1: Memory & Resource Cleanup
**Rationale:** Foundation for all stability work. Memory leaks mask other issues and make testing unreliable. Must fix before adding comprehensive tests (tests will detect but not fix leaks).

**Delivers:** Stable resource usage that plateaus under load, no unbounded memory growth

**Addresses:**
- In-memory chunked upload Map with TTL or migration to Upstash
- Event listener cleanup in all useEffect hooks
- Database connection pooling with singleton Supabase client
- Request timeouts on all external API calls (Bedrock, RLM)
- Proper streaming response cleanup with abort controllers

**Avoids:** Pitfall #1 (in-memory state), #8 (event listener leaks), #9 (unclosed connections), #11 (60s timeouts)

**Verification:** Load test with autocannon shows memory plateaus, connection count stable

### Phase 2: Security Hardening
**Rationale:** Security vulnerabilities are launch blockers. Must audit before production exposure. Independent of testing infrastructure.

**Delivers:** Production-ready security posture with defense in depth

**Addresses:**
- Audit all Supabase tables for RLS enablement
- Verify service role key never in client bundle (grep for NEXT_PUBLIC patterns)
- Implement CSRF protection with @edge-csrf/nextjs in middleware
- Add rate limiting with @upstash/ratelimit (per-user on import/chat endpoints)
- Configure security headers (X-Frame-Options, CSP, Permissions-Policy)
- Server-side input validation with Zod on all API routes

**Uses:** @edge-csrf/nextjs, @upstash/ratelimit, Zod, next-secure-headers

**Avoids:** Pitfall #2 (service role client-side), #3 (RLS disabled), #5 (CSRF conflicts), #10 (rate limiting by wrong key)

**Verification:**
- SQL query shows all tables have RLS enabled
- Grep codebase finds no `NEXT_PUBLIC.*SERVICE` variables
- Integration tests verify CSRF token validation
- Load test verifies per-user rate limiting works

### Phase 3: Race Condition Fixes
**Rationale:** After security, before comprehensive testing. Tests will catch race conditions but fixing them first prevents flaky tests.

**Delivers:** Deterministic data flow with no out-of-order state updates

**Addresses:**
- Polling logic in chat using AbortController or request ID tracking
- Any other fetch calls without request cancellation
- Async operations that don't handle component unmount

**Implements:** AbortController pattern, consider migrating to SWR/TanStack Query for complex cases

**Avoids:** Pitfall #4 (polling race conditions)

**Verification:** E2E test with delayed network responses shows correct final state

### Phase 4: Testing Infrastructure
**Rationale:** After cleanup and security, establish testing foundation. Tests verify previous phases worked and catch future regressions.

**Delivers:** Comprehensive test coverage for critical paths with fast, reliable test suite

**Addresses:**
- Install Vitest + React Testing Library for unit/component tests
- Install Playwright for E2E tests of critical flows
- Configure MSW for API mocking in tests
- Create test directory structure (__tests__/unit, integration, e2e)
- Write integration tests for all API routes
- Write unit tests for lib/ utilities
- Write E2E tests for 3-5 critical user flows (auth → import → chat)

**Uses:** Vitest, Playwright, React Testing Library, MSW

**Avoids:** Pitfall #7 (Enzyme patterns), #12 (testing without mocks)

**Verification:** Tests run offline in <30s, no external API calls, CI passes

### Phase 5: TypeScript Strict Refinement
**Rationale:** TypeScript already in strict mode, but research found areas to tighten (noUncheckedIndexedAccess, runtime validation at boundaries).

**Delivers:** Type safety extends to runtime with validation at system boundaries

**Addresses:**
- Add `noUncheckedIndexedAccess: true` to tsconfig.json
- Fix index access errors in high-risk files (API routes first)
- Add Zod schemas at all system boundaries (API input, external service responses)
- Replace any remaining `any` types with `unknown` + type guards
- Use @total-typescript/ts-reset for safer JSON.parse/fetch

**Uses:** @total-typescript/ts-reset, Zod for runtime validation

**Avoids:** Pitfall #6 (over-using any/optional types)

**Verification:** Build succeeds with strict + noUncheckedIndexedAccess, no `any` in new code

### Phase Ordering Rationale

- **Phase 1 first**: Memory leaks make everything unreliable. Can't trust tests or monitoring with unstable resource usage.
- **Phase 2 before testing**: Security is launch-blocking. Testing validates security controls but doesn't define them.
- **Phase 3 before comprehensive tests**: Race conditions cause flaky tests. Fix determinism before investing in test coverage.
- **Phase 4 before TypeScript refinement**: Tests verify type safety improvements actually work at runtime.
- **Phase 5 last**: TypeScript strict already enabled; this phase tightens incrementally with tests catching issues.

**Dependencies:**
- Phase 2 can run parallel with Phase 1 (independent concerns)
- Phase 3 depends on Phase 1 (need stable baseline to identify races)
- Phase 4 depends on Phases 1-3 (tests unreliable without stable foundation)
- Phase 5 depends on Phase 4 (tests verify type improvements)

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (Memory Cleanup)**: Decision point on Upstash vs. in-memory TTL for chunked uploads — may need cost/performance research
- **Phase 2 (Rate Limiting)**: Vercel WAF pricing and limits not fully researched — verify Pro plan requirements

Phases with standard patterns (no additional research needed):

- **Phase 3**: React race conditions have well-documented solutions (AbortController, SWR)
- **Phase 4**: Vitest and Playwright setup documented in official Next.js guides
- **Phase 5**: TypeScript strict migration patterns widely documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vitest and Playwright officially recommended by Next.js docs (verified Jan 2026), Upstash is battle-tested for serverless, Zod is de facto standard |
| Features | HIGH | Features list based on official Next.js security guide and multiple authoritative sources on production best practices |
| Architecture | HIGH | Patterns align with Next.js 16 official docs (Data Access Layer, middleware composition, serverless cleanup) |
| Pitfalls | MEDIUM-HIGH | Pitfalls sourced from community experience, official docs, and real incident reports. RLS issues confirmed via Supabase docs and security audits. |

**Overall confidence:** HIGH

The stack is modern and well-supported. The architectural patterns are documented in official Next.js guides. The pitfalls are validated by both official sources (Supabase RLS guide, Next.js security docs) and real-world incident reports (170+ Lovable apps with exposed databases in Jan 2025).

### Gaps to Address

Minor gaps that need validation during implementation:

- **Upstash cost at scale**: Research shows it's cost-effective for typical usage, but SoulPrint's specific rate limiting needs (per-user import limits) may need cost monitoring in Phase 2. Mitigation: Start with Upstash, monitor costs, fallback to Vercel KV if needed.

- **RLM service reliability**: External RLM service timeout behavior not fully documented. Phase 1 should implement circuit breaker with clear fallback (use cached soulprint, degrade gracefully). Mitigation: Health check endpoint + timeout testing.

- **Playwright for async Server Components**: Research confirms Playwright is the only option for E2E testing async Server Components (Vitest doesn't support them yet). No gap, just confirming Phase 4 must use Playwright, not just Vitest.

- **TypeScript strict + Next.js 16**: Already enabled, but noUncheckedIndexedAccess may reveal issues with array/object access in older code. Phase 5 should prioritize API routes (security-critical) over UI components. Mitigation: Use `@ts-expect-error` with TODOs for non-critical files.

## Sources

### Primary Sources (HIGH confidence)

**Official Documentation:**
- [Next.js Testing: Vitest](https://nextjs.org/docs/app/guides/testing/vitest) — Vitest officially recommended for Next.js testing
- [Next.js Testing: Playwright](https://nextjs.org/docs/app/guides/testing/playwright) — E2E testing best practices
- [Next.js Security Guide](https://nextjs.org/blog/security-nextjs-server-components-actions) — Server Components security patterns
- [Next.js Memory Usage Guide](https://nextjs.org/docs/app/guides/memory-usage) — Serverless memory management
- [Supabase Row Level Security Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS patterns and common mistakes
- [Upstash Rate Limiting Overview](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview) — Serverless rate limiting architecture

**Package Documentation:**
- [Zod Official Docs](https://zod.dev/) — TypeScript-first validation
- [TypeScript ESLint Shared Configs](https://typescript-eslint.io/users/configs/) — Strict type-checked configuration
- [MSW Official Docs](https://mswjs.io/) — API mocking strategy

### Secondary Sources (MEDIUM confidence)

**Stack & Testing:**
- [Vitest vs Jest Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/) — Performance benchmarks
- [Vitest vs Jest 2026 Analysis (DEV Community)](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) — Ecosystem trends

**Security:**
- [Complete Next.js security guide 2025 (TurboStarter)](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices) — Comprehensive security checklist
- [Supabase Row Level Security Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security) — RLS configuration patterns
- [Rate Limiting Your Next.js App with Vercel Edge (Upstash)](https://upstash.com/blog/edge-rate-limiting) — Serverless rate limiting implementation

**Pitfalls:**
- [Memory Leaks in React & Next.js: What Nobody Tells You](https://medium.com/@essaadani.yo/memory-leaks-in-react-next-js-what-nobody-tells-you-91c72b53d84d) — Common serverless memory issues
- [Avoiding Race Conditions when Fetching Data with React Hooks](https://dev.to/nas5w/avoiding-race-conditions-when-fetching-data-with-react-hooks-4pi9) — React polling patterns
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library) — Testing best practices
- [How to Configure TypeScript Strict Mode](https://oneuptime.com/blog/post/2026-01-24-typescript-strict-mode/view) — Incremental strict migration

### Real-World Validation

- **RLS misconfiguration incidents**: 170+ Lovable-built apps with exposed databases in January 2025 (83% RLS configuration errors)
- **Service role key issues**: Multiple GitHub discussions and Supabase docs troubleshooting service role in RLS policies
- **Memory leak patterns**: Next.js official docs added memory usage guide in response to serverless memory issues

---
*Research completed: 2026-02-06*
*Ready for roadmap: yes*
