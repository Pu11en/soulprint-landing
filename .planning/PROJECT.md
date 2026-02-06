# SoulPrint

## What This Is

A privacy-first AI personalization platform. Users upload their ChatGPT export, we analyze it to create a "SoulPrint" (personality profile), and they get a personalized AI assistant that remembers them. The import-to-chat flow is hardened with defense in depth after v1.1 stabilization.

## Core Value

The import-to-chat flow must work reliably every time on production — no stuck imports, no memory leaks, no silent failures.

## Requirements

### Validated

- ✓ User can sign up with email or Google OAuth — v1.0
- ✓ User can upload ChatGPT ZIP and have it processed — v1.0
- ✓ Multi-tier chunking (100/500/2000 chars) generates embeddings — v1.0
- ✓ RLM generates soulprint from conversation data — v1.0
- ✓ User can chat with AI that references their history — v1.0
- ✓ Circuit breaker falls back to direct Bedrock when RLM is down — v1.0
- ✓ Chunked upload handles files over 100MB — v1.0
- ✓ Email notification sent on import completion — v1.0
- ✓ Chunked upload cleans up stale chunks after 30min TTL — v1.1
- ✓ Duplicate import detection prevents race conditions — v1.1
- ✓ Chat message save retries with error indicator — v1.1
- ✓ Memory polling uses sequence tracking (no stale updates) — v1.1
- ✓ CSRF protection on all state-changing endpoints — v1.1
- ✓ Per-user rate limiting on 32 API endpoints — v1.1
- ✓ RLS policies audited and documented — v1.1
- ✓ Zod input validation on critical routes — v1.1
- ✓ RLM timeout reduced to 15s with fast fallback — v1.1
- ✓ Standardized error responses on all routes — v1.1
- ✓ Structured logging with Pino + correlation IDs — v1.1
- ✓ Health check endpoint with dependency monitoring — v1.1
- ✓ Zero `any` types with Zod boundary validation — v1.1
- ✓ noUncheckedIndexedAccess enabled — v1.1
- ✓ 90 passing tests (unit + integration + E2E) — v1.1
- ✓ Playwright E2E for import-to-chat flow — v1.1

### Active

- [ ] Upload → brief loading screen → redirect to chat (no email wait)
- [ ] Remove "SoulPrint is ready" email (keep waitlist email)
- [ ] Memory builds in background while user chats

### Out of Scope

- Voice upload / pillar saving — incomplete features, separate milestone
- Push notifications — disabled, needs schema changes
- Data export / GDPR portability — future milestone
- A/B testing framework — not needed yet
- Client-side encryption of exports — security enhancement, future work
- Chat pagination — optimization, not stability-critical
- Concurrent chunk uploads — performance optimization, future work

## Context

### Current State (after v1.1)

- **Codebase:** ~84K lines TypeScript, Next.js 16 App Router, Supabase, deployed on Vercel
- **Test coverage:** 90 Vitest tests (2.3s), 10 Playwright E2E tests
- **Security:** CSRF + rate limiting + Zod validation + RLS scripts ready
- **Observability:** Pino structured logging, /api/health with dependency checks
- **Type safety:** noUncheckedIndexedAccess, zero `any` in import/chat flows

### Known Issues

- 10 test mock type errors in complete.test.ts (pre-existing, runtime works)
- RLS scripts need manual execution in Supabase SQL Editor
- Some routes use console.log instead of Pino
- lib/retry.ts has no dedicated unit tests

### Key Fragile Areas (mostly addressed)

- Import pipeline has 4 stages — now with error handling, logging, and duplicate detection
- RLM service is external on Render — now with 15s timeout and circuit breaker
- Chat component — race conditions fixed with AbortController and sequence tracking
- Test framework — now established with Vitest + MSW + Playwright

## Constraints

- **Deployment**: Vercel — 5-minute function timeout, serverless execution
- **Testing**: User tests on deployed production, not localhost
- **Database**: Supabase schema changes should be avoided if possible (per CLAUDE.md)
- **External services**: RLM service is external — call it, don't modify it
- **Auth flow**: Working, don't touch it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix everything from audit | Foundation must be solid before adding features | ✓ Good — 17/17 requirements shipped |
| Production testing only | User wants to validate on deployed Vercel, not dev | ✓ Good — tests run offline |
| Exclude voice/pillar features | Focus purely on bug fixes and hardening | ✓ Good — clean scope |
| Vitest over Jest | Modern, faster, better Vite integration | ✓ Good — 2.3s test suite |
| MSW for API mocking | Service Worker approach, realistic | ✓ Good — all tests offline |
| @edge-csrf/nextjs | Only option for Edge runtime CSRF | ⚠️ Revisit — package deprecated |
| Fail-open rate limiting | Availability over security when Redis down | ✓ Good — prevents outages |
| Pino over Winston | Performance, modern JSON logging | ✓ Good — structured logs working |
| noUncheckedIndexedAccess | Prevent undefined access bugs | ✓ Good — caught 57 issues |
| Zod boundary validation | Validate external API responses at parse boundary | ✓ Good — catches malformed data |

| Remove email gate for import | Users are already chatting by the time email arrives — unnecessary wait | — Pending |

---
*Last updated: 2026-02-06 after v1.2 milestone started*
