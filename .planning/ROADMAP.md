# Roadmap: SoulPrint Stabilization

## Overview

This stabilization milestone hardens the SoulPrint import-to-chat flow through systematic bug fixes, security improvements, and comprehensive testing. The journey begins with establishing testing infrastructure (Phase 1), then addresses critical resource leaks and race conditions (Phases 2-3), hardens security boundaries (Phase 4), adds production observability (Phase 5), completes test coverage (Phase 6), and finishes with TypeScript strict refinement (Phase 7). Each phase delivers verifiable improvements to reliability and security.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Testing Foundation** - Vitest setup enabling verification of all fixes
- [x] **Phase 2: Memory & Resource Cleanup** - Fix leaks, timeouts, and error handling
- [x] **Phase 3: Race Condition Fixes** - Eliminate out-of-order state updates
- [ ] **Phase 4: Security Hardening** - CSRF, rate limiting, RLS audit, input validation
- [ ] **Phase 5: Observability** - Structured logging and health checks
- [ ] **Phase 6: Comprehensive Testing** - Integration and E2E test coverage
- [ ] **Phase 7: Type Safety Refinement** - Replace `any` with proper types

## Phase Details

### Phase 1: Testing Foundation
**Goal**: Vitest and React Testing Library configured and running with passing tests
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01
**Plans:** 2 plans
**Success Criteria** (what must be TRUE):
  1. Vitest runs successfully with `npm test` command
  2. At least one unit test passes (sample test for critical utility function)
  3. Test configuration supports Next.js 16 App Router components
  4. MSW configured for API mocking in tests

Plans:
- [x] 01-01-PLAN.md -- Install and configure Vitest, React Testing Library, MSW
- [x] 01-02-PLAN.md -- Create sample passing tests for cn() and XP system

### Phase 2: Memory & Resource Cleanup
**Goal**: Application memory usage plateaus under load with no resource leaks
**Depends on**: Phase 1
**Requirements**: BUG-01, REL-01, REL-02
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. Chunked upload cleanup removes stale chunks after 30-minute TTL (verified by test)
  2. RLM service calls timeout after 15 seconds maximum (down from 60s)
  3. All API routes catch exceptions and return proper error responses (no 500s without error payload)
  4. Memory usage plateaus in load testing (autocannon shows stable baseline)

Plans:
- [x] 02-01-PLAN.md -- TDD: TTL cache with background cleanup for chunked uploads
- [x] 02-02-PLAN.md -- Reduce RLM timeout to 15s, modernize AbortSignal patterns
- [x] 02-03-PLAN.md -- Standardized error handler applied to all critical API routes

### Phase 3: Race Condition Fixes
**Goal**: All async operations handle cancellation and out-of-order responses correctly
**Depends on**: Phase 2
**Requirements**: BUG-02, BUG-03, BUG-04
**Plans:** 3 plans
**Success Criteria** (what must be TRUE):
  1. Starting a new import cancels any existing processing job (verified by test)
  2. Failed chat message saves retry with exponential backoff and show error indicator
  3. Memory status polling ignores out-of-order responses using sequence tracking
  4. All fetch calls implement cancellation via AbortController

Plans:
- [x] 03-01-PLAN.md -- Duplicate import detection and 409 rejection with stuck-import override
- [x] 03-02-PLAN.md -- Reusable fetchWithRetry utility and chat message save retry with error indicator
- [x] 03-03-PLAN.md -- Sequence-tracked polling and AbortController on all chat page fetches

### Phase 4: Security Hardening
**Goal**: Production-ready security posture with defense in depth
**Depends on**: Phase 3
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Plans:** 6 plans
**Success Criteria** (what must be TRUE):
  1. All state-changing API endpoints validate CSRF tokens (POST, PUT, DELETE)
  2. API endpoints enforce per-user rate limits and return 429 with Retry-After header
  3. All Supabase tables have RLS enabled (verified by SQL query)
  4. All API route request bodies validated with Zod schemas before processing
  5. Security headers configured (X-Frame-Options, CSP, Permissions-Policy)

Plans:
- [x] 04-01-PLAN.md -- CSRF protection via @edge-csrf/nextjs middleware + CSP and Permissions-Policy headers
- [x] 04-02-PLAN.md -- Per-user rate limiting with @upstash/ratelimit on critical routes
- [x] 04-03-PLAN.md -- RLS audit and remediation scripts for all Supabase tables
- [x] 04-04-PLAN.md -- Zod validation schemas for all critical API route request bodies
- [ ] 04-05-PLAN.md -- Gap closure: CSRF client-side token integration
- [ ] 04-06-PLAN.md -- Gap closure: Rate limiting expansion to all POST/PUT/DELETE endpoints

### Phase 5: Observability
**Goal**: Production monitoring with structured logs and health checks
**Depends on**: Phase 4
**Requirements**: REL-03, REL-04
**Success Criteria** (what must be TRUE):
  1. All API routes log with correlation IDs for request tracing
  2. Structured logging includes user ID, endpoint, duration, status code
  3. Health check endpoint reports status of Supabase, Bedrock, and RLM service
  4. Health check returns degraded status when dependencies are unhealthy
**Plans**: TBD

Plans:
- [ ] 05-01: Implement structured logging with correlation IDs
- [ ] 05-02: Create health check endpoint with dependency status

### Phase 6: Comprehensive Testing
**Goal**: Critical user flows covered by integration and E2E tests
**Depends on**: Phase 5
**Requirements**: TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Import flow has end-to-end test (upload -> process -> complete)
  2. All API routes have integration tests with mocked dependencies
  3. Critical user flows tested with Playwright (auth -> import -> chat)
  4. Tests run offline in under 30 seconds with no external API calls
**Plans**: TBD

Plans:
- [ ] 06-01: Write integration tests for all API routes
- [ ] 06-02: Write end-to-end test for import flow
- [ ] 06-03: Install Playwright and write E2E tests for critical flows

### Phase 7: Type Safety Refinement
**Goal**: Replace `any` types with proper interfaces and runtime validation
**Depends on**: Phase 6
**Requirements**: TYPE-01
**Success Criteria** (what must be TRUE):
  1. Import and chat code has no `any` types (replaced with typed interfaces)
  2. External service responses validated with Zod at boundaries
  3. noUncheckedIndexedAccess enabled in tsconfig.json (API routes fixed first)
  4. TypeScript build succeeds with strict mode and no type errors
**Plans**: TBD

Plans:
- [ ] 07-01: Add noUncheckedIndexedAccess and fix API route type errors
- [ ] 07-02: Replace `any` types in import flow with proper interfaces
- [ ] 07-03: Replace `any` types in chat flow with proper interfaces

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Testing Foundation | 2/2 | Complete | 2026-02-06 |
| 2. Memory & Resource Cleanup | 3/3 | Complete | 2026-02-06 |
| 3. Race Condition Fixes | 3/3 | Complete | 2026-02-06 |
| 4. Security Hardening | 4/6 | Gap closure | - |
| 5. Observability | 0/2 | Not started | - |
| 6. Comprehensive Testing | 0/3 | Not started | - |
| 7. Type Safety Refinement | 0/3 | Not started | - |

---
*Created: 2026-02-06*
*Last updated: 2026-02-06*
