# SoulPrint

## What This Is

A privacy-first AI personalization platform. Users upload their ChatGPT export, we analyze it to create a "SoulPrint" (personality profile), and they get a personalized AI assistant that deeply remembers them. The AI adapts its tone based on emotional state, acknowledges uncertainty in low-confidence areas, uses semantic search over conversation history for relevant context, and tracks per-user costs to ensure affordability.

## Core Value

The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

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
- ✓ Opik evaluation datasets & experiments for systematic prompt testing — v2.0
- ✓ Natural voice system prompts (replace technical headers with personality) — v2.0
- ✓ Versioned prompt system (v1-technical / v2-natural-voice) with cross-language parity — v2.0
- ✓ Emotional intelligence: emotion detection, relationship arc, dynamic temperature — v2.0
- ✓ Soulprint quality scoring (0-100) with automated refinement — v2.0
- ✓ DATA CONFIDENCE in system prompts so AI acknowledges uncertainty — v2.0
- ✓ Prompt regression testing with CI/CD automation — v2.0
- ✓ Long-session personality drift detection — v2.0
- ✓ Latency benchmarking infrastructure — v2.0
- ✓ All import processing runs on RLM (Render) with streaming JSON — v2.2
- ✓ DAG traversal parsing (convoviz-quality), hidden message filtering — v2.2
- ✓ Real progress UI with stage indicators and visibility-aware polling — v2.2
- ✓ Actionable error classification (10 categories) — v2.2
- ✓ Full pass auto-triggered after quick pass (chunks, facts, memory, v2 sections) — v2.2

- ✓ Animated stage-based progress with visual transitions (Upload → Extract → Analyze → Build Profile) — v2.4
- ✓ Mobile-optimized progress states with Framer Motion GPU-composited animations — v2.4
- ✓ LLM-based smart search routing (Haiku 4.5 classifier, heuristic fallback, Opik tracing) — v2.4
- ✓ Google Trends integration filtered by user interests, injected into dailyMemory — v2.4
- ✓ Parallel chat route prep (classifier + emotion + memory + DB in Promise.allSettled) — v2.4
- ✓ SearchValueJudge for evaluating search routing decisions — v2.4
- ✓ Full pass pipeline reliably completes with error propagation, retry with backoff — v3.0
- ✓ Fact extraction reduced to concurrency=5 with exponential backoff on rate limits — v3.0
- ✓ MEMORY section validated before save, retries 2x on placeholder content — v3.0
- ✓ Full pass retry mechanism from chat UI (persisted storage_path, /retry-full-pass) — v3.0
- ✓ pgvector HNSW index on conversation_chunks with Titan Embed v2 (768-dim) — v3.0
- ✓ Semantic search in RLM /query (top 8 chunks, cosine similarity, threshold 0.3) — v3.0
- ✓ memory_md wired into chat system prompt via RLM and PromptBuilder — v3.0
- ✓ Per-user import cost tracking (CostTracker, Haiku $1/$5 per 1M, Titan $0.02 per 1M) — v3.0
- ✓ Admin import costs endpoint with budget verification (all_under_budget flag) — v3.0
- ✓ MemoryDepthJudge + A/B experiment script for quality measurement — v3.0

### Active

(None — next milestone requirements to be defined via `/gsd:new-milestone`)

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
- NLP libraries (winkNLP, compromise) — LLM-based extraction more accurate
- Sentiment analysis libraries — Claude has native emotional intelligence via prompts
- Real-time soulprint updates during chat — causes personality drift
- Perfect linguistic mimicry — uncanny valley risk
- Exposed evaluation scores to users — gamification anxiety

## Context

### Current State (after v3.0)

- **Codebase:** ~107K lines TypeScript + Python, Next.js 16 App Router, Supabase, deployed on Vercel
- **RLM service:** FastAPI on Render with full pass pipeline (conversation chunking, fact extraction, MEMORY generation, v2 regeneration, embedding generation, cost tracking)
- **Deep Memory:** pgvector HNSW index on conversation_chunks, Titan Embed v2 (768-dim), semantic search in RLM /query endpoint (top 8, threshold 0.3)
- **Cost Tracking:** CostTracker instruments full pipeline, saves per-user costs to import_cost_json, admin endpoint at /api/admin/import-costs
- **Evaluation:** Opik evaluation framework with 4 LLM-as-judge metrics (personality consistency, factuality, tone matching, memory depth), A/B experiment script for quick_ready vs full_pass comparison
- **Prompts:** Versioned PromptBuilder (v1-technical, v2-natural-voice), cross-language Python parity, DATA CONFIDENCE sections, memory_md + memoryContext integration
- **Emotional Intelligence:** Emotion detection (Haiku 4.5), relationship arc tracking, dynamic temperature, uncertainty acknowledgment
- **Quality:** Three-dimensional scoring (completeness, coherence, specificity), daily refinement cron, import pipeline hooks
- **CI/CD:** GitHub Actions regression testing on prompt file changes, autocannon latency benchmarking
- **Test coverage:** 112+ Vitest tests, Playwright E2E (import-to-chat + long-session drift detection)
- **Security:** CSRF + rate limiting + Zod validation + RLS scripts ready
- **Observability:** Pino structured logging, /api/health with dependency checks, structured pipeline logging with user_id + step context
- **Type safety:** noUncheckedIndexedAccess, zero `any` in import/chat flows
- **AI pipeline:** Two-pass generation — quick pass (Haiku 4.5 on Bedrock, ~30s) + full pass (Haiku 4.5 on Anthropic API, background with cost tracking)

### Known Issues

- RLS scripts need manual execution in Supabase SQL Editor
- Database migrations pending: `20260206_add_tools_md.sql`, `20260207_full_pass_schema.sql`, `20260209_quality_breakdown.sql`
- import_cost_json TEXT column needs to be added to user_profiles in Supabase
- Some routes use console.log instead of Pino
- lib/retry.ts has no dedicated unit tests
- Token estimation in chunker uses len()/4 — approximate but functional

### Key Fragile Areas (mostly addressed)

- Import pipeline has 4 stages — now with error handling, logging, and duplicate detection
- RLM service is external on Render — now with 15s timeout, circuit breaker, and full pass pipeline
- Chat component — race conditions fixed with AbortController and sequence tracking
- Full pass failure is non-fatal — v1 sections stay, user can chat

## Constraints

- **Deployment**: Vercel — 5-minute function timeout, serverless execution
- **Testing**: User tests on deployed production, not localhost
- **Database**: Supabase schema changes should be avoided if possible (per CLAUDE.md)
- **External services**: RLM service deploys from soulprint-landing/rlm-service/ to Render
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
| Remove email gate for import | Users are already chatting by the time email arrives | ✓ Good — users go straight to chat |
| OpenClaw-inspired structured context | Modular SOUL/USER/MEMORY sections vs monolithic blob | ✓ Good — 7 sections, clean composition |
| Two-pass pipeline | Quick pass for speed, full pass for depth | ✓ Good — ~30s to chat, v2 upgrade in background |
| Monorepo for RLM | RLM service moved to soulprint-landing/rlm-service/ | ✓ Good — single deploy |
| Switch to Sonnet 4.5 for chat | Nova Lite can't follow personality instructions | ✓ Good — natural personality |
| OpenClaw-style prompt | Minimal preamble, let sections define personality | ✓ Good — deployed to production |
| Evaluation-first approach | Build measurement before changing prompts | ✓ Good — baseline before changes |
| Haiku 4.5 for emotion detection | Fast, cheap (150 max tokens, temp 0.2) | ✓ Good — ~200ms overhead |
| Fail-safe neutral EI defaults | Never crash chat on detection error | ✓ Good — zero EI-related failures |
| Three separate quality judges | Specialized evaluation per dimension | ✓ Good — parallel scoring in ~2-3s |
| Fire-and-forget quality scoring | Non-blocking in import, cron catches failures | ✓ Good — no import slowdown |
| P97.5 latency percentile | autocannon limitation vs P95 | ✓ Good — close approximation |
| PR-triggered regression testing | Only on prompt file changes, avoids expensive evals | ✓ Good — cost-efficient CI |
| Supabase pgvector (not Pinecone) | No new infra, ALTER TABLE + HNSW index | ✓ Good — zero new services |
| Titan Embed v2 768-dim | Cheaper than 1024-dim, matches Bedrock pricing tier | ✓ Good — $0.02/1M tokens |
| HNSW over IVFFlat | Better recall for <1M rows | ✓ Good — instant similarity search |
| Concurrency 5 for fact extraction | Prevents rate limits vs aggressive 10 | ✓ Good — reliable completion |
| Optional cost_tracker parameter | Backwards compatible instrumentation | ✓ Good — zero breaking changes |
| SHA256 reverse lookup for eval | Hash all user_ids, match against dataset | ✓ Good — privacy-preserving |

## Latest Milestone: v3.0 Deep Memory (SHIPPED 2026-02-11)

**Delivered:** Reliable full pass pipeline with semantic memory search, cost tracking, and quality measurement. The AI now references specific user history via pgvector semantic search, pipeline costs tracked per-user, and A/B evaluation infrastructure measures memory quality impact.

## Next Milestone

To be defined via `/gsd:new-milestone`.

---
*Last updated: 2026-02-11 after v3.0 milestone shipped*
