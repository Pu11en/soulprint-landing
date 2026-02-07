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
- ✓ 7-section structured context (SOUL, IDENTITY, USER, AGENTS, TOOLS, MEMORY, daily memory) — v1.2
- ✓ Two-pass generation: quick pass (~30s, Haiku 4.5) + full pass (RLM background) — v1.2
- ✓ System prompt composed from all 7 sections + daily memory + dynamic chunks — v1.2
- ✓ Chat gated on quick pass completion with "Analyzing..." loading screen — v1.2
- ✓ Import email removed; users redirect to chat immediately — v1.2
- ✓ V2 sections silently upgrade after full pass completes — v1.2
- ✓ Memory progress indicator during background processing — v1.2
- ✓ 112 passing tests (unit + integration + E2E) — v1.2

### Active

#### v1.4 Chat Personalization Quality

- [ ] RLM /query prompt rewritten with OpenClaw-inspired personality system
- [ ] All 7 structured sections (soul, identity, user, agents, tools, memory) passed from Next.js to RLM
- [ ] AI names itself based on user's chat history analysis
- [ ] Pending DB migrations executed (section columns exist in production)
- [ ] Updated RLM deployed to Render with new prompt system
- [ ] Chat responses embody user's personality profile, not generic responses

### Out of Scope

- Voice upload / pillar saving — incomplete features, separate milestone
- Push notifications — disabled, needs schema changes
- Data export / GDPR portability — future milestone
- A/B testing framework — not needed yet
- Client-side encryption of exports — security enhancement, future work
- Chat pagination — optimization, not stability-critical
- Concurrent chunk uploads — performance optimization, future work
- Multi-platform channels (SMS, Telegram, WhatsApp) — v2+ OpenClaw-style gateway
- Per-user cloud instances — v2+ each SoulPrint as deployable agent

## Current Milestone: v1.4 Chat Personalization Quality

**Goal:** Make the AI actually feel like *your* AI — OpenClaw-inspired prompt system that uses all structured sections to create a personalized chat experience.

**Target features:**
- RLM prompt rewrite with personality injection from all 7 sections
- Section passing pipeline (Next.js → RLM → Anthropic API)
- AI self-naming from chat history
- DB migration execution for section persistence
- RLM production deployment with new prompt system

## Context

### Current State (after v1.2)

- **Codebase:** ~86K lines TypeScript + Python, Next.js 16 App Router, Supabase, deployed on Vercel
- **RLM service:** FastAPI on Render with full pass pipeline (conversation chunking, fact extraction, MEMORY generation, v2 regeneration)
- **Test coverage:** 112 Vitest tests, 10 Playwright E2E tests
- **Security:** CSRF + rate limiting + Zod validation + RLS scripts ready
- **Observability:** Pino structured logging, /api/health with dependency checks
- **Type safety:** noUncheckedIndexedAccess, zero `any` in import/chat flows
- **AI pipeline:** Two-pass generation — quick pass (Haiku 4.5 on Bedrock, ~30s) + full pass (Haiku 4.5 on Anthropic API, background)

### Known Issues

- 10 test mock type errors in complete.test.ts (pre-existing, runtime works)
- RLS scripts need manual execution in Supabase SQL Editor
- Database migrations pending: `20260206_add_tools_md.sql`, `20260207_full_pass_schema.sql`
- Some routes use console.log instead of Pino
- lib/retry.ts has no dedicated unit tests

### Key Fragile Areas (mostly addressed)

- Import pipeline has 4 stages — now with error handling, logging, and duplicate detection
- RLM service is external on Render — now with 15s timeout, circuit breaker, and full pass pipeline
- Chat component — race conditions fixed with AbortController and sequence tracking
- Full pass failure is non-fatal — v1 sections stay, user can chat

## Constraints

- **Deployment**: Vercel — 5-minute function timeout, serverless execution
- **Testing**: User tests on deployed production, not localhost
- **Database**: Supabase schema changes should be avoided if possible (per CLAUDE.md)
- **External services**: RLM service deploys from separate repo (Pu11en/soulprint-rlm) to Render
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

| Remove email gate for import | Users are already chatting by the time email arrives — unnecessary wait | ✓ Good — users go straight to chat |
| OpenClaw-inspired structured context | Modular SOUL/USER/MEMORY sections vs monolithic soulprint_text blob | ✓ Good — 7 sections, clean composition |
| Two-pass pipeline | Quick pass for speed, full pass for depth | ✓ Good — ~30s to chat, v2 upgrade in background |

| Separate soulprint-rlm repo | Production RLM deploys from Pu11en/soulprint-rlm, not soulprint-landing/rlm-service/ | — Pending |
| Hybrid merge for RLM sync | Add v1.2 processors to production without breaking existing endpoints | — Pending |

---
*Last updated: 2026-02-07 after v1.3 milestone started*
