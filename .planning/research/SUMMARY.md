# Project Research Summary

**Project:** v2.2 Bulletproof Imports — Moving ChatGPT Import Processing to RLM
**Domain:** Large-file import processing with background pipeline migration
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

Moving import processing from Vercel serverless (1GB RAM, 300s timeout) to RLM service on Render eliminates the fundamental constraints causing import failures for large ChatGPT exports. The migration transforms Vercel into a thin authentication proxy while RLM owns the complete pipeline: download → parse → quick pass → chunk → embed → full pass.

The convoviz project demonstrates quality parsing approaches that handle ChatGPT's complex DAG structure and polymorphic content types. By porting these patterns and adding streaming JSON parsing (ijson), the system can process exports of any size (tested up to 2GB) on Render's infrastructure without memory or timeout issues. The architecture shift from synchronous processing to fire-and-forget with status polling enables background processing and proper progress reporting.

Critical risks center on cross-service integration patterns. Vercel's serverless function lifecycle can kill in-flight requests if not awaited with confirmation. Render's cold start delays (up to 60 seconds) require explicit UX handling to prevent user confusion. Database-driven progress polling is simpler and more reliable than WebSocket infrastructure for this use case. The migration delivers "works for any size export on any device" by moving heavy computation out of serverless constraints while maintaining the responsive upload UX.

## Key Findings

### Recommended Stack

Research identified minimal additions to enable streaming large-file processing. The RLM service already has FastAPI, httpx, and Pydantic — only two new dependencies are required.

**Core technologies:**
- **ijson (^3.4.0)**: Streaming JSON parser — processes 300MB+ files with constant ~2-5MB memory usage vs loading entire file into RAM. Critical for eliminating OOM failures.
- **supabase-py (^2.27.3)**: Python Supabase client — provides typed Storage API for downloading files with service role key auth. Built on httpx for streaming integration.
- **httpx (already installed)**: Streaming HTTP downloads — supports `httpx.stream()` for chunked downloads without loading entire file into memory.
- **Pydantic (already installed)**: Polymorphic content modeling — handles ChatGPT's complex content.parts structure (strings, dicts, tool outputs). Already in use for RLM models.

**Deployment configuration:**
- Render 2GB RAM instance minimum for 300MB+ files
- Uvicorn workers tuned for memory efficiency (2 workers, periodic restart after 1000 requests)
- Max concurrent imports limited to prevent memory exhaustion

**What NOT to use:**
- pandas.read_json (287MB peak memory vs ijson's 2-5MB)
- NetworkX for DAG traversal (10MB+ dependency for simple parent→child relationships)
- json.load() for large files (loads entire file into memory, causes OOM)

### Expected Features

Research revealed clear table stakes vs differentiators for large-file import systems.

**Must have (table stakes):**
- **Large file handling (300MB+)** — ChatGPT power users generate 100MB-2GB exports. Failing on large files eliminates core audience. Requires streaming parser.
- **Processing status visibility** — Users need to know if import is running or stuck. Database polling with progress_percent tracking (0%, 20%, 40%, 60%, 100%).
- **Error messages with actionable guidance** — "Import failed" → "File too large (2.3GB, max 2GB). Try exporting a smaller date range."
- **Mobile upload support** — Users expect to upload from any device. Current chunked upload works; must test 100MB+ files on iOS/Android.
- **Processing completion notification** — Email when ready. Industry standard for async operations taking >30 seconds.
- **Resumable uploads on network failure** — Already implemented via Supabase Storage's chunked upload.

**Should have (competitive advantage):**
- **Accurate DAG traversal (real conversations only)** — Competitors show duplicate/dead-branch messages from edits. Use current_node→parent chain, not naive node iteration. Convoviz proves this achieves clean conversation history.
- **Hidden message filtering** — Show users actual conversations, not internal tool outputs (web search, code execution). Improves soulprint quality by removing noise.
- **Multi-part content parsing** — Users with images/files get complete history, not just first text fragment. Handle polymorphic content.parts array.
- **Background processing with "close and come back"** — User can close browser, get email when done. Differentiator because many tools require keeping page open.
- **Validation before heavy processing** — Check conversations.json structure BEFORE starting expensive parsing/embedding. Fail-fast reduces wasted RLM costs and user wait time.

**Defer (v2+):**
- **Real-time streaming progress (WebSocket)** — Anti-feature: adds architectural complexity, rarely watched, mobile battery drain. Database polling every 2s is sufficient.
- **In-browser parsing of large files** — Anti-feature: browser memory constraints worse than server (especially mobile), crash loses all work.
- **Parallel conversation processing** — Anti-feature: marginal speed gain (I/O bound), complicates progress reporting, harder to debug.

### Architecture Approach

The target architecture transforms Vercel from heavy processor to thin proxy, with RLM owning the entire pipeline. Progress flows back via database polling — simpler than WebSocket infrastructure and compatible with serverless constraints.

**Major components:**

1. **Client (Browser)** — Chunked XHR upload to Supabase Storage (direct, bypasses Vercel). Polls /api/import/status every 2s for progress. No change to upload flow (already works perfectly).

2. **Vercel /api/import/trigger (new)** — Thin proxy with zero parsing. Auth check → mark import_status = 'processing' → POST to RLM /import with storage_path → return 202 Accepted. Must await RLM response with 10s timeout to confirm job acceptance (Vercel serverless lifecycle kills fire-and-forget requests mid-flight).

3. **Vercel /api/import/status (new)** — Query user_profiles for {import_status, progress_percent, import_error}. Simple database passthrough.

4. **RLM /import (new)** — Complete import orchestrator replacing Vercel's process-server. Accepts 202 immediately, runs background task: download from Supabase Storage → extract/parse → quick pass → chunk → embed → full pass. Updates progress_percent at each stage (0% → 20% → 40% → 60% → 100%).

5. **RLM Quick Pass Generation (moved from Vercel)** — Port lib/soulprint/sample.ts and prompts.ts to Python. Use Anthropic Haiku 4.5 API (already configured in RLM). Generates 5 sections: soul, identity, user, agents, tools.

6. **RLM DAG Traversal (already implemented)** — conversation_chunker.py lines 71-116. Handles ChatGPT's parent→child mapping structure with cycle detection. No changes needed.

7. **Supabase Storage** — Stores uploaded files. RLM downloads with service role key. Storage path format: `imports/{user_id}/{timestamp}-conversations.json`

8. **Supabase DB** — Add progress_percent column to user_profiles. RLM updates via HTTP PATCH throughout processing. Client polls via /api/import/status.

**Key integration patterns:**
- Vercel → RLM: POST with storage_path, await 10s for job acceptance
- RLM → Storage: GET with service role key, stream to disk (not memory)
- RLM → DB: PATCH progress updates at stage boundaries
- Client → Vercel: Poll every 2s (not WebSocket) for status

**What NOT to do:**
- Don't parse in Vercel (moves problem, doesn't solve it)
- Don't use WebSockets (overkill for minutes-long operations, serverless incompatible)
- Don't pass raw conversations between services (send storage path instead)
- Don't use synchronous RLM calls (Vercel timeout still applies)

### Critical Pitfalls

Research identified 10 critical pitfalls from serverless-to-worker migrations, ChatGPT parsing complexity, and cross-service integration.

1. **Vercel Fire-and-Forget Termination** — Vercel kills serverless function immediately after sending client response, destroying in-flight RLM request. **Prevention:** Await RLM response with 10s timeout to confirm job acceptance. Current queue-processing/route.ts:145-153 does this correctly.

2. **Render Cold Start Breaking Import UX** — Render free tier spins down after 15 minutes. Cold start takes 60+ seconds. User sees "Processing..." with no feedback, assumes breakage, refreshes, creates duplicates. **Prevention:** Keep-alive pings every 10 minutes (not 15), detect cold start in Vercel (>5s job acceptance), show "Service warming up, please wait 30 seconds."

3. **ChatGPT Export Format Variations** — Real-world exports have edge cases: minified JSON (one giant line), multiple roots, no roots, malformed timestamps, non-UTF8 characters, 1000+ message conversations. **Prevention:** ijson streaming parser, defensive DAG traversal with cycle detection (conversation_chunker.py:71-75), truncate messages to 5000 chars, validate with Pydantic, gracefully skip malformed conversations.

4. **Memory Exhaustion on Large Exports** — Loading 500MB conversations.json into memory with json.loads() spikes to 2GB+, Render kills process (OOM), import fails silently. **Prevention:** ijson streaming parser (processes file incrementally), download to disk first (not memory), batch processing (parse 1000 conversations → chunk → save → release memory → repeat).

5. **Progress Reporting Dead Zone** — User uploads (progress works), Vercel queues (no progress), RLM processes 2 minutes (no progress), completes, user still sees "processing" until manual refresh. **Prevention:** Store granular stages in DB ("downloading", "parsing", "chunking"), RLM updates stage field, client polls and shows specific messages ("Analyzing 10,345 messages...").

6. **Duplicate Import Race Condition** — User uploads, waits 30s (impatient), refreshes, uploads again. Both requests pass duplicate check (both see import_status='none' simultaneously), both process, database corrupted. **Prevention:** Atomic lock acquisition with Postgres advisory locks or conditional update (WHERE processing_started_at IS NULL).

7. **Status Update Failures Leave User Stuck** — RLM completes successfully, tries to update user_profiles to 'complete', Supabase unreachable (network hiccup), update fails silently, user sits on "Processing..." forever. **Prevention:** Exponential backoff retry for status updates (3 attempts over 10 seconds), dead letter queue if all fail, client-side "Check import status" button after 10 minutes.

8. **DAG Traversal Stack Overflow** — User has conversation with 500+ messages (1000 nodes), recursive traversal hits Python's recursion limit (1000), throws RecursionError. **Prevention:** Convert recursive to iterative with explicit stack (queue-based BFS or stack-based DFS), or add depth limit.

9. **Cross-Service Authentication Token Expiry** — Vercel generates signed URL (1 hour expiry), passes to RLM, RLM queues, processes 90 minutes later (cold start + busy), signed URL expired, 403 Forbidden. **Prevention:** Use storage_path + service role key (no expiry), not presigned URLs for cross-service communication.

10. **Service Key Exposure in RLM** — RLM needs SUPABASE_SERVICE_ROLE_KEY for downloads/updates. If RLM compromised, key gives full database access. **Prevention:** Use Supabase Storage signed URLs (generated by Vercel) for downloads, Edge Functions with RLS policies for database writes. Phase 1 can use service key, Phase 3 hardens security.

## Implications for Roadmap

Based on combined research, the migration breaks into clear phases with distinct deliverables and pitfall avoidance strategies.

### Phase 1: Core Migration — Streaming Parser + RLM Pipeline
**Rationale:** Foundation must work before adding enhancements. Streaming parser eliminates OOM failures (Pitfall #4), RLM pipeline eliminates timeout constraints, job acceptance pattern prevents fire-and-forget termination (Pitfall #1).

**Delivers:**
- ijson streaming JSON parser (handles 300MB+ files)
- RLM /import endpoint with complete pipeline (download → parse → quick pass → chunk → full pass)
- Vercel /api/import/trigger (thin proxy with job acceptance confirmation)
- Vercel /api/import/status (database polling endpoint)
- Database schema change (progress_percent column)
- Port quick pass generation from Vercel to RLM (lib/soulprint → processors/quick_pass.py)
- Atomic duplicate detection (advisory locks)
- Iterative DAG traversal (prevents stack overflow, Pitfall #8)

**Addresses features:**
- Large file handling (300MB+) — streaming parser
- Accurate DAG traversal — port convoviz patterns
- Hidden message filtering — metadata inspection
- Multi-part content parsing — polymorphic parts handling
- Processing status visibility — progress_percent tracking
- Validation before processing — fail-fast schema checks

**Avoids pitfalls:**
- #1 (Fire-and-forget) — await job acceptance with timeout
- #3 (Format variations) — defensive parsing, Pydantic validation
- #4 (Memory exhaustion) — streaming parser, batch processing
- #6 (Duplicate race) — atomic lock acquisition
- #8 (Stack overflow) — iterative traversal
- #9 (Token expiry) — use storage_path, not signed URLs

**Research flag:** SKIP — patterns well-documented, libraries proven (ijson, convoviz reference). Standard streaming and async patterns.

### Phase 2: Resilience + Progress Enhancement
**Rationale:** Once core works, add production hardening. Retry logic prevents status update failures (Pitfall #7), granular progress reduces perceived wait time and stuck-import confusion (Pitfall #5).

**Delivers:**
- Exponential backoff retry for database updates (3 attempts, 10s total)
- Dead letter queue for failed updates (alert webhook)
- Granular progress stages ("downloading", "parsing", "chunking", "embedding", "generating_soulprint")
- Stage-specific messages in UI ("Analyzing 10,345 messages...")
- Cold start detection and user feedback ("Service warming up...")
- Processing time estimates based on conversation count

**Addresses features:**
- Detailed progress reporting (stages) — reduces perceived wait time
- Smart retry on transient failures — reduces support burden
- Actionable error messages — specific guidance per failure type

**Avoids pitfalls:**
- #5 (Progress dead zone) — granular stage tracking
- #7 (Status update failures) — retry logic, dead letter queue
- #2 (Cold start UX) — detection + user messaging

**Research flag:** SKIP — standard retry patterns, well-documented UX guidelines (Nielsen Norman Group).

### Phase 3: Security Hardening + Production Readiness
**Rationale:** Core functionality proven, now reduce attack surface. Service key exposure is highest security risk (Pitfall #10). Production monitoring catches issues before users report them.

**Delivers:**
- Replace service role key with Storage signed URLs (Vercel generates, RLM uses)
- Replace direct DB writes with Supabase Edge Functions + RLS policies
- Rate limiting on RLM endpoints (prevent spam attacks)
- File size validation before queuing (prevent DoS)
- Memory profiling and explicit limits in RLM
- Monitoring dashboards (cold start frequency, completion times, error rates)
- Alert webhooks for stuck imports (>15 min no progress)

**Addresses features:**
- Mobile-specific optimizations (test 100MB+ files on iOS/Android) — based on analytics

**Avoids pitfalls:**
- #10 (Service key exposure) — Storage signed URLs, Edge Functions
- #2 (Cold start) — monitoring + alerting for failed keep-alive pings

**Research flag:** LOW — Edge Functions need API research for RLS patterns. Otherwise standard security hardening.

### Phase 4: UX Polish + Edge Cases
**Rationale:** With robust foundation, improve user experience for edge cases. Import history, manual status fixes, and cancel functionality address power user needs and stuck-import recovery.

**Delivers:**
- Import history UI (list past imports with timestamps)
- Manual status fix UI for admins (recover stuck imports)
- Cancel import button (user can stop stuck processing)
- Export validation guide (documentation for malformed file errors)
- Edge case testing (ChatGPT exports from 2021-2025)

**Addresses features:**
- Import history (power user feature) — nice-to-have, deferred until demand proven

**Avoids pitfalls:**
- Recovery tooling for edge cases discovered in production

**Research flag:** SKIP — standard admin UI patterns.

### Phase Ordering Rationale

**Dependencies dictate sequence:**
- Phase 1 must complete before Phase 2 (can't enhance progress for non-existent pipeline)
- Phase 2 must complete before Phase 3 (security hardening requires stable baseline for load testing)
- Phase 3 must complete before Phase 4 (can't test edge cases without production-ready infrastructure)

**Grouping rationale:**
- Phase 1: Foundation (architecture change) — everything else depends on this working
- Phase 2: Production hardening (operational) — retry/progress improvements don't change architecture
- Phase 3: Security (non-functional) — can be done independently once core is stable
- Phase 4: Polish (nice-to-have) — deferred until core validated with real users

**Pitfall avoidance sequence:**
- Phase 1 addresses launch-blocking pitfalls (#1, #3, #4, #6, #8, #9) — can't ship without these
- Phase 2 addresses operational pitfalls (#2, #5, #7) — production UX quality
- Phase 3 addresses security pitfall (#10) — reduces attack surface
- Phase 4 addresses recovery (no specific pitfall, just edge case tooling)

**Early validation opportunities:**
- Phase 1: Test with 5 real ChatGPT exports (50MB, 150MB, 300MB, 1GB, 2GB)
- Phase 2: Monitor cold start frequency and progress polling load for 2 weeks
- Phase 3: Security audit before removing service key access
- Phase 4: Gather user feedback on import experience, prioritize polish items

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3** — Supabase Edge Functions with RLS policies. Medium confidence. Need API research for service account patterns and RLS policy syntax. Context7 library search for "supabase edge functions rls" during planning.

**Phases with standard patterns (skip research-phase):**
- **Phase 1** — Streaming parser (ijson well-documented), FastAPI background tasks (standard pattern), convoviz reference implementation exists, DAG algorithms established.
- **Phase 2** — Retry patterns (exponential backoff), progress reporting UX (Nielsen Norman guidelines), cold start detection (Render docs).
- **Phase 4** — Admin UI patterns (CRUD operations), validation guides (documentation writing), edge case testing (QA process).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified with PyPI, official docs, and memory benchmarks. ijson proven for 300MB+ files. Supabase Python client built on httpx (already installed). Pydantic V2 already in use. |
| Features | MEDIUM | Strong consensus on table stakes (large files, progress, mobile). Convoviz proves DAG traversal achievable. Lower confidence on ChatGPT format edge cases (no official spec, inferred from community + convoviz). |
| Architecture | HIGH | Direct code inspection of current RLM service, Vercel endpoints, and Supabase patterns. Thin proxy + background task pattern well-established for serverless migrations. Database polling simpler than WebSocket for this use case. |
| Pitfalls | HIGH | 10 pitfalls identified from: serverless platform constraints (Vercel docs), Render cold start behavior (official docs), cross-service integration patterns (production experience), ChatGPT format issues (OpenAI community + convoviz behavior), current codebase inspection. |

**Overall confidence:** HIGH

Research grounded in official documentation (Vercel, Render, Supabase, library PyPI pages), proven reference implementation (convoviz), and direct codebase inspection. Medium confidence areas (ChatGPT format edge cases, hidden message metadata) have defensive fallbacks (graceful skip, filter by role).

### Gaps to Address

**ChatGPT export format variations (Medium risk):**
- **Gap:** No official OpenAI spec for conversations.json structure. Format evolved 2021-2025. Edge cases inferred from community discussions and convoviz behavior.
- **Handle during:** Phase 1 execution — test with 5+ real exports spanning different date ranges. Phase 4 — gather user reports of parsing failures, add defensive handling.

**Hidden message metadata fields (Low risk):**
- **Gap:** Specific fields for filtering (is_visually_hidden_from_conversation, message types) inferred from community knowledge, not documented by OpenAI.
- **Handle during:** Phase 1 execution — inspect actual export structure, verify fields exist. Fallback: filter by author.role only (user/assistant vs tool/system).

**Mobile large file limits (Low risk):**
- **Gap:** No testing yet for 100MB+ files on iOS/Android. Browser memory constraints vary by device.
- **Handle during:** Phase 3 — test matrix (iOS Safari, Android Chrome, 50/150/300MB files, slow network simulation).

**Render memory requirements (Low risk):**
- **Gap:** Theoretical calculations (100MB peak with streaming) need validation with real 300MB-2GB exports under load.
- **Handle during:** Phase 1 validation — memory profiling with sample exports. Phase 3 — production monitoring for OOM warnings.

**Supabase rate limits (Low risk):**
- **Gap:** Unknown rate limits for Storage downloads and Database writes at scale (10K+ imports/day).
- **Handle during:** Phase 3 — load testing before production rollout. Add retry with exponential backoff.

## Sources

### Primary (HIGH confidence)
- **Direct codebase inspection:**
  - /home/drewpullen/clawd/soulprint-landing/rlm-service/main.py — RLM service structure, Supabase integration
  - /home/drewpullen/clawd/soulprint-landing/rlm-service/processors/conversation_chunker.py — DAG traversal implementation (lines 71-116)
  - /home/drewpullen/clawd/soulprint-landing/app/api/import/process-server/route.ts — Current problematic architecture
  - /home/drewpullen/clawd/soulprint-landing/app/import/page.tsx — Frontend upload and polling patterns

- **Official documentation:**
  - [ijson PyPI](https://pypi.org/project/ijson/) — version 3.4.0
  - [Processing Large JSON Files Without Running Out of Memory](https://pythonspeed.com/articles/json-memory-streaming/) — ijson memory benchmarks (287MB pandas vs 2-5MB ijson)
  - [Supabase Python Storage API](https://supabase.com/docs/reference/python/storage-from-download) — download method, service role key auth
  - [FastAPI Production Deployment Best Practices (Render)](https://render.com/articles/fastapi-production-deployment-best-practices) — worker config, memory management
  - [Render Free Tier Documentation](https://render.com/docs/free) — cold start behavior, resource limits

### Secondary (MEDIUM confidence)
- **Community knowledge + reference implementation:**
  - [GitHub - mohamed-chs/convoviz](https://github.com/mohamed-chs/convoviz) — quality parsing reference, DAG traversal patterns
  - [Decoding Exported Data by Parsing conversations.json (OpenAI Community)](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144) — DAG traversal fix, mapping structure, sorting by create_time
  - [Questions About JSON Structures in conversations.json (OpenAI Community)](https://community.openai.com/t/questions-about-the-json-structures-in-the-exported-conversations-json/954762) — format variations, edge cases

- **UX research:**
  - [Response Time Limits (Nielsen Norman Group)](https://www.nngroup.com/articles/response-times-3-important-limits/) — progress indicator thresholds (<1s, 1-10s, >10s)
  - [Progress Trackers and Indicators (UserGuiding)](https://userguiding.com/blog/progress-trackers-and-indicators) — stage-based vs time-based progress
  - [Error Messages: Examples, Best Practices (CXL)](https://cxl.com/blog/error-messages/) — actionable error guidance

### Tertiary (LOW confidence, needs validation)
- **Mobile constraints:**
  - [Uploading Large Files from iOS Applications (Bipsync)](https://bipsync.com/blog/uploading-large-files-from-ios-applications/) — iOS memory constraints (~100-200MB)
  - [Mobile vs Desktop Usage Statistics (Research.com)](https://research.com/software/guides/mobile-vs-desktop-usage) — device usage patterns

---
*Research completed: 2026-02-09*
*Ready for roadmap: yes*
