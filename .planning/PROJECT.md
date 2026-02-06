# SoulPrint Stabilization

## What This Is

A hardening pass on the SoulPrint codebase — fixing bugs, plugging security holes, adding type safety, and getting test coverage in place so the import flow works reliably on production. This isn't new features; it's making the existing foundation solid.

## Core Value

The import-to-chat flow must work reliably every time on production — no stuck imports, no memory leaks, no silent failures.

## Requirements

### Validated

- ✓ User can sign up with email or Google OAuth — existing
- ✓ User can upload ChatGPT ZIP and have it processed — existing
- ✓ Multi-tier chunking (100/500/2000 chars) generates embeddings — existing
- ✓ RLM generates soulprint from conversation data — existing
- ✓ User can chat with AI that references their history — existing
- ✓ Circuit breaker falls back to direct Bedrock when RLM is down — existing
- ✓ Chunked upload handles files over 100MB — existing
- ✓ Email notification sent on import completion — existing

### Active

- [ ] Fix memory leak in chunked upload (stale chunks never cleaned up)
- [ ] Add proper TypeScript types (replace `any` in import/chat code)
- [ ] Fix stuck import detection (race condition allows duplicate jobs)
- [ ] Add CSRF protection on state-changing API endpoints
- [ ] Reduce RLM timeout from 60s to 15s (chat blocked during outages)
- [ ] Add rate limiting on API endpoints
- [ ] Add test coverage for import flow (end-to-end)
- [ ] Fix silent message save failures in chat
- [ ] Fix memory status poll race condition (out-of-order responses)

### Out of Scope

- Voice upload / pillar saving — incomplete features, separate milestone
- Push notifications — disabled, needs schema changes
- Data export / GDPR portability — future milestone
- A/B testing framework — not needed for stabilization
- Client-side encryption of exports — security enhancement, future work
- Chat pagination — optimization, not stability-critical
- Concurrent chunk uploads — performance optimization, future work

## Context

The codebase mapping surfaced ~20 issues across tech debt, bugs, security, performance, and missing features. This milestone addresses the critical subset that affects the core import-to-chat reliability. The app deploys to Vercel via git push. Testing will happen on the deployed production version.

Key fragile areas:
- Import pipeline has 4 stages that can each fail independently
- RLM service is an external dependency on Render (can be slow/down)
- Chat component has race conditions in state management
- No test framework is set up yet (no Jest, Vitest, or test files exist)

## Constraints

- **Deployment**: Vercel — 5-minute function timeout, serverless execution
- **Testing**: User tests on deployed production, not localhost
- **Database**: Supabase schema changes should be avoided if possible (per CLAUDE.md)
- **External services**: RLM service is external — call it, don't modify it
- **Auth flow**: Working, don't touch it

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix everything from audit | Foundation must be solid before adding features | — Pending |
| Production testing only | User wants to validate on deployed Vercel, not dev | — Pending |
| Exclude voice/pillar features | Focus purely on bug fixes and hardening | — Pending |

---
*Last updated: 2026-02-06 after initialization*
