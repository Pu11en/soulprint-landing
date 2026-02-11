# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

**Incomplete Web Push Notification System:**
- Issue: Web Push disabled — `push_subscription` column referenced but doesn't exist in `user_profiles` schema
- Files: `app/api/import/complete/route.ts:168-171`
- Impact: Users don't receive completion notifications; workaround is email-only (Resend email system is mostly disabled now)
- Fix approach: Either add `push_subscription` column to schema + re-enable push in import completion route, OR remove notification feature entirely if not planned

**Raw Console Statements Mixed with Structured Logging:**
- Issue: ~245 console.log/error/warn statements throughout app/lib directories alongside Pino structured logger
- Files: `lib/rlm/health.ts`, `app/api/admin/health/route.ts`, `app/chat/page.tsx`, and many others
- Impact: Production logs inconsistent — some structured (Pino JSON), some unstructured (console). Difficult to aggregate/search in production
- Fix approach: Migrate all console statements to use `createLogger()` for consistent structured logging across all modules

**Non-Null Assertions on Environment Variables:**
- Issue: 96 instances of `process.env.VAR!` throughout codebase (non-null assertion without validation)
- Files: `app/api/chat/route.ts:42,49`, `lib/memory/query.ts:74-78`, `app/api/admin/health/route.ts:36,38`, and others
- Impact: If env vars are missing at runtime (deployment misconfiguration), errors are cryptic. Tests that run without full env setup fail with confusing "Cannot read property of undefined" errors
- Fix approach: Create env validation schema (Zod) at app startup; fail with clear message listing missing vars during build/startup

**Progress Bar Freezing on Large Uploads:**
- Issue: FIXED by recent XHR implementation, but watch for regression. Root cause was Supabase SDK's atomic fetch() that provides no upload progress events
- Files: `lib/tus-upload.ts` (recently fixed), `app/import/page.tsx:45-81` (polling), `lib/import/progress-mapper.ts` (progress calculation)
- Impact: Users on slow connections or with large ChatGPT exports (>50MB) saw progress freeze at 14% for minutes, then fail or eventually succeed with no feedback
- Fix approach: Monitor XHR implementation; if issues resurface, consider resumable uploads (TUS protocol with proper auth) or chunked multipart uploads to Supabase

---

## Known Bugs

**Chat Page Over-State with 21+ useState Calls:**
- Symptoms: Slow re-renders, potential race conditions in state updates, difficult to debug state transitions
- Files: `app/chat/page.tsx:36-71` (state declarations)
- Trigger: Any interaction causing multiple state changes (sending message, loading history, polling status, saving conversation)
- Workaround: Page still functions; slowness is noticeable but not breaking. Can dismiss error notifications manually
- Fix approach: Refactor using useReducer for tightly-coupled state (messages, UI modes) or move some to custom hooks

**Memory Leak Potential in Chat Page Effect Cleanup:**
- Symptoms: Browser may use excess memory over long sessions; intervals and AbortControllers may not always be cleaned
- Files: `app/chat/page.tsx:168-278` (polling effects), refs at line 69-72 keep conversations in memory
- Trigger: Leaving chat page open for hours, switching between pages rapidly, browser refresh after long session
- Workaround: Manual page refresh; closing/reopening chat clears memory
- Fix approach: Audit all useEffect cleanup functions; ensure AbortController.abort() is always called; consider using dependency arrays more carefully

**Exported RLM Service Key Risk:**
- Symptoms: If RLM is compromised, attacker gains full Supabase database access
- Files: RLM service (external, in `soulprint-landing/rlm-service/` or `soulprint-rlm` repo) uses SUPABASE_SERVICE_ROLE_KEY for all database operations
- Trigger: RLM code vulnerability, leaked env vars, public Render dashboard exposure
- Workaround: Monitor Supabase audit logs for unauthorized access
- Fix approach: Use Supabase signed URLs for Storage downloads; implement RLS-based service account authentication for DB writes instead of service key (Phase 3 security work)

**Circuit Breaker Uses In-Memory State (Lost on Restart):**
- Symptoms: If RLM becomes unhealthy and Next.js deployment restarts, circuit breaker state resets — requests flood back to failing RLM
- Files: `lib/rlm/health.ts:14-17` (module-level state: `lastFailureTime`, `consecutiveFailures`, `state`)
- Trigger: RLM outage + serverless function restart within 30-second cooldown window
- Workaround: RLM recovers, requests eventually succeed after the restart syncs
- Fix approach: Store circuit breaker state in Redis (shared across all serverless instances) instead of in-memory

---

## Security Considerations

**CSRF Token Fetched from `/api/health/supabase` on Every POST:**
- Risk: GET to health endpoint on every form submission; if health endpoint becomes slow/down, all mutations fail
- Files: `lib/csrf.ts:23` (getCsrfToken calls `/api/health/supabase`)
- Current mitigation: Token is cached after first fetch (line 8, 19); if cache available, no request made
- Recommendations: Consider fetching CSRF token on page load instead of first mutation; cache has no TTL — consider 1-hour expiry; add fallback endpoint if health check endpoint becomes unavailable

**Rate Limiting Fails Open (Redis Down = Allow All):**
- Risk: If Upstash Redis is down, all rate limits are disabled; attacker can brute-force APIs
- Files: `lib/rate-limit.ts:97-101` (try/catch returns null on error)
- Current mitigation: Fail-open is intentional for availability; assumes Redis downtime is brief; other layers (auth, validation) still protect
- Recommendations: Add monitoring for Redis failures; set flag in memory to warn/alert on repeated failures; consider stricter fallback limits (e.g., allow 10 req/min from same user instead of unlimited)

**96 Environment Variables Validated Only at Runtime:**
- Risk: Missing critical vars (OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) go undetected until first API call using them
- Files: Throughout `app/api/` and `lib/`
- Current mitigation: Non-null assertions assume CI/CD catches this; production deployments have full env setup
- Recommendations: Create Zod schema for all required env vars; validate synchronously at app startup (before any requests); fail fast with clear error message

**Hardcoded Admin Email List:**
- Risk: Admin health endpoint has hardcoded email whitelist in code
- Files: `app/api/admin/health/route.ts:10-13`
- Current mitigation: Only 2 emails (Drew's), not in .env
- Recommendations: Move admin emails to Supabase `profiles` table with `role: 'admin'` field; update health endpoint to check role instead of hardcoded list

---

## Performance Bottlenecks

**Chat Page with 1140 Lines and Heavy Real-Time Polling:**
- Problem: Single component handles messages, conversations, progress polling, settings, renaming, all with complex state
- Files: `app/chat/page.tsx:1-1140` (full file)
- Cause: No component extraction; polling happens on every mount; message history loaded synchronously
- Improvement path: Extract TelegramChat component, ConversationSidebar logic, MemoryStatus into separate components; memoize with React.memo; lazy-load message history (infinite scroll); debounce polling triggers

**RLM Health Check Makes Real API Call During Health Endpoint:**
- Problem: `/api/admin/health` calls Perplexity API with actual message ("ping") just to validate API key
- Files: `app/api/admin/health/route.ts:139-150` (Perplexity health check)
- Cause: No ping-only endpoint on Perplexity; health check uses actual API quota
- Improvement path: Cache Perplexity health status for 5 minutes; only re-check if cache expires or on manual request

**Timeout Function Uses setTimeOut in Promise.race (No AbortSignal):**
- Problem: `lib/memory/query.ts:20-28` uses setTimeout + Promise.race for timeout, which doesn't cancel the original promise
- Files: `lib/memory/query.ts:15-28`
- Cause: Older pattern before AbortSignal was widely available
- Improvement path: Use AbortSignal.timeout() and pass signal to underlying async operations (e.g., Bedrock client, Supabase queries)

**Prompt Builder Constructs 732-Line System Prompt:**
- Problem: `lib/soulprint/prompt-builder.ts` builds system prompts with full memory context, Bedrock operations, emotional intelligence logic, all as inline strings
- Files: `lib/soulprint/prompt-builder.ts:1-732`
- Cause: Versioned prompt system (v1-technical, v2-natural-voice, v3-openclaw) with all versions in one file; prompt generation happens on every chat request
- Improvement path: Move prompts to external files; cache compiled prompts; lazy-load only the active version

**Regex Matching in Smart Search**
- Problem: `lib/search/smart-search.ts` uses multiple regex patterns for classification and extraction
- Files: `lib/search/smart-search.ts:1-378` (378 lines)
- Cause: Multiple regex operations on user input without pre-compilation or caching
- Improvement path: Pre-compile regex patterns at module load; cache compiled patterns; consider using a trie or keyword matching for common queries

---

## Fragile Areas

**Import Flow Race Condition Windows:**
- Files: `app/api/import/trigger/route.ts`, `app/api/import/process/route.ts`, `app/import/page.tsx`
- Why fragile: Client uploads file → triggers import → starts polling. If polling arrives before RLM job starts, it may see old status. If user re-imports while first import still processing, duplicate jobs queue.
- Safe modification: Add import_id to URL/state; client polls specific import_id; RLM respects "stuck-import override" flag (already implemented via BUG-03 phase)
- Test coverage: Integration tests cover duplicate import detection; E2E test covers happy path; missing: network delay scenarios, rapid re-imports, polling race conditions

**Multi-Tier Chunking Tier Selection Logic:**
- Files: RLM service (external) handles tier selection; JavaScript side doesn't enforce tiers
- Why fragile: RLM may embed all tiers but client search only uses one tier; if tier size limits change, embedding quality degrades silently
- Safe modification: Store tier metadata with each chunk; validate chunk tier on retrieval; monitor embedding quality metrics
- Test coverage: Unit tests for progress mapping exist; missing: tier quality degradation tests, chunk tier matching tests

**Full Pass (v2-v3 Prompt Generation) Status Not User-Visible:**
- Files: `app/chat/page.tsx:248-250` (fullPassStatus state), `app/api/memory/status/route.ts` (response includes fullPassStatus)
- Why fragile: Full pass can fail silently if RLM timeout occurs; user sees "ready" but v2/v3 prompts not available; no user feedback that memory is incomplete
- Safe modification: Show user "Memory still building..." with progress; explain that AI will improve as memory grows; don't block chat
- Test coverage: Integration tests for memory status polling; missing: full pass timeout scenarios, degradation mode testing

**Memory Query Timeout Using setTimeOut + Promise.race:**
- Files: `lib/memory/query.ts:15-28` (withTimeout function)
- Why fragile: Promise continues executing after timeout; if query is database-heavy, it continues consuming resources
- Safe modification: Replace with AbortSignal.timeout(); pass signal to all underlying async operations
- Test coverage: No explicit timeout tests; memory query tests pass happy path

**Citation Formatter Assumes Search Results Are Valid:**
- Files: `lib/search/citation-formatter.ts`
- Why fragile: If smart search returns malformed results or missing fields, formatter may throw or return empty citations
- Safe modification: Validate citation schema before formatting; fallback to generic "See search results" if validation fails
- Test coverage: Citation validator exists (`lib/search/citation-validator.ts`); missing: malformed input tests, edge case handling

---

## Scaling Limits

**Database: Supabase Free Plan 500MB Limit:**
- Current capacity: ~500MB total for all tables (profiles, chunks, conversations, learned_facts, etc.)
- Limit: ~50MB per file size for Supabase uploads; total table space limited
- Scaling path: Upgrade to Pro plan ($25/mo) → 100GB; implement table partitioning by user_id; archive old conversations

**RLM: Render Free Tier 512MB RAM / 15-Min Cold Start:**
- Current capacity: Single import of ~300MB conversations.json uses >2GB RAM (crashes on free tier)
- Limit: Cold starts spike response times to 60+ seconds; sleep after 15 min inactivity
- Scaling path: Upgrade to Render paid tier ($7-25/mo for 1-4GB RAM); implement keep-alive pings; stream JSON parsing instead of full load

**Rate Limiting: 20 req/min for Expensive Operations:**
- Current capacity: 20 chat requests/min per user (expensive tier); 60 standard/min (queries)
- Limit: Power users (fast typers, deep search every message) hit limit; burst requests fail
- Scaling path: Increase limits as business model supports; implement request queuing instead of hard rejection; tiered pricing (premium users = higher limits)

**Bedrock Claude Model: 60s Timeout, 100k Token Max:**
- Current capacity: Chat route has maxDuration=60s for long-context prompts
- Limit: Very long conversation histories timeout; streaming stops after 60s
- Scaling path: Batch process long histories; summarize old messages into facts; increase maxDuration to 120s if business supports

**CSRF Token Caching: Single Token for Entire Session:**
- Current capacity: One cached token per browser tab
- Limit: Token expiry not handled; stale token causes 403 on mutations
- Scaling path: Add token refresh logic; detect 403 and refresh token; implement 1-hour TTL with refresh

---

## Scaling Concerns

**Vercel Serverless Function Chaining: Vercel → RLM → Vercel:**
- Current architecture: Client → Vercel (queue job) → RLM (process) → Vercel (receive webhook) → Supabase (update)
- Issue: Each step adds 100-500ms latency; cascading failures if any step times out
- Improvement: Direct RLM → Supabase writes; Vercel only handles auth/upload; eliminate unnecessary callbacks

**Chunked Upload Storage: 3 Tiers × Many Conversations = Many Rows:**
- Current capacity: 1,000 conversations × 3 tiers × 5-50 chunks per tier = 15,000-150,000 rows per user
- Limit: Supabase query time degrades with row count; searching all chunks becomes slow
- Improvement: Implement chunk vector database (Pinecone, Weaviate) for similarity search; Supabase becomes document store only

**Polling-Based Status Updates: Client Polls Every 5 Seconds:**
- Current capacity: 100 concurrent imports × 1 poll/5s = 20 polls/sec from clients
- Limit: Each poll queries `user_profiles` for status; database load scales with concurrent users
- Improvement: Use Server-Sent Events or WebSocket for push updates instead of client polling

---

## Dependencies at Risk

**@edge-csrf/nextjs: Package Marked Deprecated:**
- Risk: No longer maintained; newer Next.js versions may not support it; alternative middleware recommended
- Impact: CSRF protection relies on deprecated package; future Next.js upgrades may break
- Migration plan: Evaluate @dj/csrf or implement custom CSRF token generation; requires middleware refactor (Phase 4 already implemented, but package choice is brittle)

**Bedrock Runtime SDK: AWS SDK v3 (Large Bundle):**
- Risk: AWS SDK v3 adds ~2MB to bundle; using only ConverseCommand but importing entire client library
- Impact: Cold start time, bundle size inflation, slow serverless function startup
- Migration plan: Consider AWS Lambda Layer for SDK; or use fetch() directly to Bedrock API instead of SDK (requires manual signing with Sigv4)

**Supabase JS Client: Works But Lacks RLS Type Safety:**
- Risk: RLS policies exist in database but not enforced by TypeScript compiler; easy to bypass accidentally
- Impact: Potential data leaks if developer forgets to add `.select()` with proper filters
- Migration plan: Type-safe Supabase client wrapper; generate types from RLS policies

---

## Test Coverage Gaps

**Import Flow Edge Cases Not Covered:**
- What's not tested: Duplicate import detection mid-upload, upload cancellation (AbortController), network timeout recovery, resumable upload, large file uploads (>500MB), malformed ZIP files
- Files: `app/api/import/trigger/route.ts`, `lib/tus-upload.ts`, `app/import/page.tsx`
- Risk: Production may encounter edge cases that cause silent failures or duplicate processing
- Priority: High (import is core flow)

**Chat Page State Machine Not Formally Tested:**
- What's not tested: Message queue during AI response, out-of-order responses, concurrent message saves, polling race conditions, conversation switching during active message send
- Files: `app/chat/page.tsx:66-350` (message handling and state)
- Risk: Race conditions cause lost messages or incorrect conversation context
- Priority: High (chat is core UX)

**Memory Query Timeout Behavior:**
- What's not tested: Timeout during embedding, timeout during search, timeout + retry behavior, memory query cancellation via AbortController
- Files: `lib/memory/query.ts`
- Risk: Timeout silently returns null, causing degraded search experience without user feedback
- Priority: Medium (degrades gracefully but silent)

**Emotional Intelligence Scoring:**
- What's not tested: Temperature adaptation based on emotional state, relationship arc progression, uncertainty handling in different contexts
- Files: `lib/soulprint/emotional-intelligence.ts`
- Risk: Emotional state detection may be inaccurate; incorrect temperature causes tone mismatch
- Priority: Medium (affects personalization quality)

**RLM Failure Handling:**
- What's not tested: RLM returns 500, RLM returns malformed response, RLM timeout after 15s, RLM partially completes soulprint generation
- Files: `app/api/chat/route.ts:200+` (RLM calls), circuit breaker in `lib/rlm/health.ts`
- Risk: Graceful degradation not tested; user may see errors instead of fallback to v1 prompts
- Priority: High (critical dependency)

---

## Missing Critical Features

**Push Notification Completion Alerts:**
- Problem: Users don't know when import completes; must manually check chat page or wait for email
- Blocks: Native app (PWA) notifications; real-time UX
- Affected files: `app/api/import/complete/route.ts:168-171` (disabled), `lib/email/send.ts` (email mostly disabled)

**Resumable Uploads for Large Files:**
- Problem: Users with slow/flaky connections lose upload progress if connection drops; restart entire upload
- Blocks: Users >100MB conversations; international users with poor connectivity
- Affected files: `lib/tus-upload.ts` (uses atomic XHR, not resumable)

**Chunk Tier Quality Monitoring:**
- Problem: No metrics on whether 3-tier chunking improves search quality vs 1-tier; unclear if costs justify complexity
- Blocks: Optimization decisions; may be unnecessary complexity
- Affected files: RLM service, no client-side tracking

**User-Facing Memory Quality Feedback:**
- Problem: User doesn't know if "memory building" succeeded or failed; full pass silently fails with no user notification
- Blocks: Users can't understand why AI doesn't remember things they mentioned
- Affected files: `app/chat/page.tsx:248-250` (fullPassStatus exists but not displayed), `app/api/memory/status/route.ts`

**Soulprint Regeneration Without Re-Upload:**
- Problem: If soulprint generation fails or user wants to update personality profile, must re-import entire ChatGPT export
- Blocks: Users can't fix personality descriptions; must start from scratch
- Affected files: All of import flow (no partial regeneration support)

---

## Monitoring & Observability Gaps

**No Metrics Dashboard for Import Success/Failure Rates:**
- What's missing: Tracking import completion rate, average processing time, chunk quality scores, RLM performance
- Impact: Can't detect trends (e.g., RLM getting slower, more timeouts); decision-making is reactive not proactive

**Circuit Breaker State Not Persisted (In-Memory Only):**
- What's missing: Shared circuit state across serverless instances; persisted across restarts
- Impact: If Next.js redeploys during RLM outage, circuit resets; requests flood failing RLM again

**No Distributed Tracing for Multi-Service Calls:**
- What's missing: End-to-end request tracing from client through Vercel through RLM back to client
- Impact: Hard to debug slow requests; can't see where bottleneck is (RLM? Network? Supabase?)

**Opik Integration Incomplete:**
- What's found: `app/api/chat/route.ts` has `traceChatRequest()` and `flushOpik()` calls
- What's missing: Not all critical paths instrumented (memory search, citation validation, embedding); Opik dashboard not integrated into monitoring workflow

---

*Concerns audit: 2026-02-11*
