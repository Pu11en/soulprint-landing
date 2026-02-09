# Pitfalls Research: Moving Import Processing from Vercel to RLM on Render

**Domain:** Cross-service migration (Vercel serverless → Render background service)
**Project:** SoulPrint import processing migration
**Researched:** 2026-02-09
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Vercel Fire-and-Forget Termination

**What goes wrong:**
When you send a request to RLM from Vercel and don't await the response, Vercel terminates the serverless function immediately after sending the HTTP response to the client. This kills the RLM HTTP request mid-flight, so RLM never receives it.

**Why it happens:**
Developers assume that `fetch()` without `await` works like a background task. On traditional servers, this works. On Vercel serverless, the execution environment is terminated the moment the response is sent to the client.

**How to avoid:**
- EITHER: Await the RLM response (with short timeout just to confirm job acceptance)
- OR: Use a true background job queue (Motia, Inngest, etc.) that persists outside Vercel's lifecycle
- Current code at `queue-processing/route.ts:145-153` does this correctly with 10s timeout to confirm job acceptance

**Warning signs:**
- RLM logs show no incoming request
- Client gets 200 OK but nothing happens
- No errors anywhere — request just vanishes

**Phase to address:**
Phase 1: Core Migration — Verify job acceptance pattern before moving any processing logic

---

### Pitfall 2: Render Cold Start Breaking Import UX

**What goes wrong:**
User uploads 300MB file, client shows progress bar, Vercel queues RLM job, RLM is asleep. First request to RLM takes 60+ seconds to spin up the service. User sees "Processing..." for a minute with no feedback, assumes something broke, refreshes page, tries again, creating duplicate imports.

**Why it happens:**
Render free tier spins down after 15 minutes of inactivity. Cold start takes "up to a minute" according to Render docs. The current system has health check pings (referenced in project context) but if they fail or have gaps, cold starts happen at the worst time — during user-facing imports.

**How to avoid:**
- Keep RLM warm with scheduled pings every 10 minutes (NOT 15 — need buffer)
- Add cold-start detection in Vercel → if RLM job acceptance takes >5s, tell user "Service starting, please wait 30 seconds"
- Store "import queued at X" timestamp in DB, show elapsed time to user
- Don't rely on free tier for production — upgrade to always-on paid Render tier ($7/mo)

**Warning signs:**
- User reports "stuck on processing" then it works later
- RLM response times spike to 30-60s for first request after idle period
- Multiple imports queued in quick succession (user refreshing)

**Phase to address:**
Phase 1: Core Migration — Must have cold-start handling before launch
Phase 2: Monitoring — Add cold-start metrics to detect when pings fail

---

### Pitfall 3: Supabase Service Key Exposure in RLM

**What goes wrong:**
RLM needs to download files from Supabase Storage and update user_profiles. You pass SUPABASE_SERVICE_ROLE_KEY to RLM as env var. RLM is on Render free tier, which is public. If RLM code has a vulnerability or is compromised, the service key gives full database access — delete all users, read all chat history, etc.

**Why it happens:**
Convenience. Service role key "just works" for everything. Developers forget that RLM is a separate security boundary.

**How to avoid:**
- Use Supabase Storage signed URLs instead of service key for downloads (generate in Vercel, pass URL to RLM)
- For database writes, create a Supabase Edge Function with RLS policies — RLM calls edge function instead of direct DB access
- OR: Use Supabase's anon key + Row Level Security with service accounts (RLM authenticates as a service user with limited permissions)

**Warning signs:**
- Service key visible in RLM environment variables on Render dashboard
- No IP restrictions on Supabase service key usage
- RLM can access any table without RLS checks

**Phase to address:**
Phase 1: Core Migration — Use signed URLs for storage downloads
Phase 3: Security Hardening — Replace service key with RLS-based auth

---

### Pitfall 4: ChatGPT Export Format Variations Breaking Parsing

**What goes wrong:**
Real-world ChatGPT exports have edge cases not present in test data. Entire JSON is one minified line with no whitespace (massive memory spike if you read entire string before parsing). Some conversations have multiple roots or no roots (DAG traversal breaks). Malformed timestamps, missing fields. Incomplete exports where recent data is present but older history is missing. Non-UTF8 characters in message content. Conversations with 1000+ messages.

**Why it happens:**
OpenAI's export format evolved over time. Exports from 2021 vs 2025 have different structures. The mapping tree structure is complex and can have malformed graphs.

**How to avoid:**
- Use streaming JSON parser (e.g., ijson in Python) instead of json.loads() on entire file
- Implement defensive DAG traversal with cycle detection and "visited" sets (current code at conversation_chunker.py:71-75 does this)
- Add fallback logic for conversations with no valid root → use first message in mapping as root
- Truncate individual messages to max length (current code does 5000 chars at conversation_chunker.py:50)
- Validate schema with Pydantic (current process-server does this at line 124 and 147)
- Gracefully skip malformed conversations instead of failing entire import

**Warning signs:**
- Import succeeds for small exports but fails on large/old exports
- RecursionError or stack overflow in logs
- User reports "some conversations missing" after import
- Memory usage spikes on RLM during parsing

**Phase to address:**
Phase 1: Core Migration — Port convoviz parsing with all defensive checks
Phase 2: Edge Case Testing — Test with real exports from 2021-2025

---

### Pitfall 5: Progress Reporting Dead Zone

**What goes wrong:**
User uploads file (progress bar works), Vercel queues job on RLM (no progress), RLM processes for 2 minutes (no progress), RLM updates DB to "complete", user still sees "processing" screen until they manually poll or refresh.

**Why it happens:**
Once Vercel hands off to RLM, there's no connection back to the client. RLM is doing heavy work but client has no idea. Current code polls every 5 seconds (import/page.tsx:198) but only AFTER detecting "processing" status.

**How to avoid:**
- Store processing stage in DB: "downloading", "parsing", "chunking", "embedding", "generating_soulprint"
- RLM updates stage field as it progresses
- Client polls stage and shows specific messages: "Analyzing 10,345 messages..." instead of generic "Processing..."
- Add timestamp to each stage so client can show elapsed time

**Warning signs:**
- User reports "stuck on processing" but import completes successfully
- No way to differentiate "downloading 300MB file" vs "generating embeddings" vs "actually stuck"
- Users refresh page thinking it's broken

**Phase to address:**
Phase 2: Progress Enhancement — Add granular stage tracking
Phase 1: Core Migration — Basic "accepted by RLM" confirmation (already exists)

---

### Pitfall 6: Memory Exhaustion on RLM When Processing Large Exports

**What goes wrong:**
User uploads 500MB conversations.json (300,000 messages). RLM downloads entire file into memory, then tries to parse with json.loads(), memory spikes to 2GB+, Render kills the process (OOM), import fails silently or with cryptic error.

**Why it happens:**
Python's json.loads() loads entire JSON into memory. FastAPI's default UploadFile handling can hold entire file in memory if not using streaming. Render free tier has 512MB RAM, paid starter has 1GB.

**How to avoid:**
- Use streaming JSON parser (ijson, simdjson) that processes file incrementally
- Download from Supabase Storage to disk first, then parse from disk (not memory)
- Process conversations in batches: parse 1000 conversations → chunk → save to DB → release memory → repeat
- Set explicit memory limits in RLM code to fail fast instead of getting OOM killed

**Warning signs:**
- RLM crashes with no error or "exit code 137" (OOM killed by OS)
- Import works for 50MB exports, fails for 300MB exports with no error message
- Memory usage spikes then service disappears from Render dashboard

**Phase to address:**
Phase 1: Core Migration — Implement streaming parser and batch processing
Phase 3: Performance Optimization — Memory profiling and limits

---

### Pitfall 7: Duplicate Import Detection Race Condition

**What goes wrong:**
User uploads file, gets "Processing...", waits 30 seconds (impatient), refreshes page, uploads same file again. Both requests pass duplicate check (both see import_status: 'none' at same instant), both start processing, database ends up with corrupted state.

**Why it happens:**
Current duplicate detection (queue-processing/route.ts:54-87) checks import_status === 'processing' but the check and the update are not atomic. Between check and update, a second request can sneak in.

**How to avoid:**
- Use optimistic locking: include processing_started_at in WHERE clause when updating status
- Or: Use Postgres advisory locks in Supabase to ensure only one request can set import_status = 'processing' at a time
- Or: Use a distributed lock (Redis) with TTL
- Return 409 Conflict immediately if lock acquisition fails

**Warning signs:**
- Two imports processing simultaneously for same user
- Import completes but user sees wrong conversation count
- Database shows total_conversations: 150 but only 75 chunks exist

**Phase to address:**
Phase 1: Core Migration — Add atomic lock acquisition (Postgres advisory lock or conditional update)

---

### Pitfall 8: Cross-Service Authentication Token Expiry

**What goes wrong:**
Vercel generates Supabase Storage signed URL (valid for 1 hour), passes URL to RLM. RLM gets queued, starts processing 90 minutes later (Render was doing cold start + busy with other users). RLM tries to download file, gets 403 Forbidden, import fails.

**Why it happens:**
Signed URLs have expiration. Long queue times + cold starts mean URL might expire before RLM uses it.

**How to avoid:**
- Don't use signed URLs for cross-service communication — use service-to-service auth instead
- Or: Store file path in DB, RLM generates its own signed URL right before download
- Or: Use presigned URLs with long expiry (24 hours) only for import flow, rotate service key regularly
- Add retry logic with token refresh

**Warning signs:**
- Imports fail with 403/401 errors only during busy times (when queue is long)
- Works fine in testing (low latency) but fails in production

**Phase to address:**
Phase 1: Core Migration — Use storage path + admin download, not presigned URLs
Phase 3: Security Hardening — Reevaluate auth pattern with short-lived tokens

---

### Pitfall 9: Status Update Failures Leave User Stuck

**What goes wrong:**
RLM completes processing successfully, tries to update user_profiles status to 'complete', but Supabase is unreachable (network hiccup, rate limit, etc.). Update fails silently. User sits on "Processing..." screen forever even though their data is ready.

**Why it happens:**
Current RLM code (main.py:109-127) does best-effort updates with try/catch. If update fails, there's no retry, no alert, no recovery mechanism.

**How to avoid:**
- Implement exponential backoff retry for status updates (3 attempts over 10 seconds)
- If all retries fail, write to dead letter queue or alert webhook
- Store processing completion timestamp in RLM, compare with DB status
- Client-side: after 10 minutes of "processing", show "Check import status" button

**Warning signs:**
- User reports stuck but data exists in DB
- import_status = 'processing' but soulprint_text is populated
- No error logs in RLM but user sees error state

**Phase to address:**
Phase 2: Resilience — Add retry logic and dead letter queue
Phase 4: Admin Tools — Manual status fix UI

---

### Pitfall 10: DAG Traversal Stack Overflow on Deep Conversations

**What goes wrong:**
User has a single conversation with 500+ back-and-forth messages (1000 nodes in the mapping tree). Recursive DAG traversal (conversation_chunker.py:71-116) hits Python's default recursion limit (1000), throws RecursionError, import fails.

**Why it happens:**
ChatGPT's mapping structure is a tree where each message points to children. Recursive traversal works for normal conversations but breaks on edge cases.

**How to avoid:**
- Convert recursive traversal to iterative with explicit stack (queue-based BFS or stack-based DFS)
- Or: Increase Python recursion limit but risky
- Or: Detect deep trees and switch to iterative algorithm
- Current code has cycle detection (visited set) but not depth protection

**Warning signs:**
- RecursionError in RLM logs
- Import fails only on specific users (those with very long conversations)
- Error happens during parsing phase

**Phase to address:**
Phase 1: Core Migration — Rewrite traversal as iterative or add depth limit

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using service role key in RLM | Simple setup | Full DB access from external service | Never |
| Synchronous file parsing | Simple code | Memory explosion on large files | Only for files <10MB |
| Best-effort status updates | Simpler code | Users stuck on processing | Never |
| Cold start checks every 15 min | Stays within free tier | Occasional cold starts | MVP only |
| Vercel awaits RLM with 10s timeout | Ensures job acceptance | Couples function lifetime | Acceptable |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel → RLM | Fire-and-forget fetch | Await with short timeout |
| RLM → Supabase Storage | Download to memory | Stream to disk |
| RLM → Supabase DB | Update once at end | Update stage throughout |
| Client → Server | Poll from page load | Detect processing first |
| Service-to-service auth | Share service key | Use signed URLs or RLS |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading JSON into memory | OOM crash | Use streaming parser | Files >500MB |
| Recursive DAG traversal | RecursionError | Convert to iterative | Conversations >500 messages |
| N+1 database updates | Slow imports | Batch updates | >10,000 chunks |
| Cold starts during import | 60s wait | Keep-alive pings | After 15 min idle |
| Polling every 1s | High load | Poll every 5s | >100 concurrent imports |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service role key in RLM | Full database access | Use Storage signed URLs |
| No rate limiting on RLM | Spam attacks | Add API key auth |
| Long expiry signed URLs | Data leak | Use short expiry (1hr) |
| No file size validation | DoS attack | Check size before queuing |
| RLM writes any profile | Data manipulation | Use RLS permissions |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No cold start feedback | User thinks it's broken | Show "Service warming up..." |
| Generic "Processing..." | Can't tell if stuck | Show granular stages |
| Can't cancel stuck import | User stuck until timeout | Add cancel button |
| Generic error messages | Can't troubleshoot | Specific error messages |
| Status update fails | Chat locked after success | Check both status AND soulprint |

## "Looks Done But Isn't" Checklist

- [ ] File parsing handles 1-line minified JSON
- [ ] DAG traversal iterative or depth-limited
- [ ] Status updates retry on failure
- [ ] Progress reporting granular stages
- [ ] Cold start handling with feedback
- [ ] Duplicate detection atomic
- [ ] Memory limits prevent OOM
- [ ] Error recovery user-friendly
- [ ] Cross-service auth secure
- [ ] Edge case testing complete

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| User stuck on processing | LOW | Admin sets status to complete |
| Duplicate chunks | MEDIUM | Delete chunks, re-run import |
| RLM OOM crash | HIGH | Delete partial data, user retries |
| Service key leaked | HIGH | Rotate key, audit logs |
| Cold start timeout | LOW | User retries when warm |
| Malformed export | MEDIUM | Add defensive parsing, retry |
| Fire-and-forget killed | LOW | Fix code, user retries |
| RecursionError | MEDIUM | Fix traversal, user retries |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fire-and-forget termination | Phase 1 | RLM logs show job accepted |
| Cold start UX | Phase 1 | User sees warming message |
| Service key exposure | Phase 1 + Phase 3 | No keys in RLM env |
| ChatGPT format variations | Phase 1 | Test 5 real exports |
| Progress dead zone | Phase 2 | Granular stage updates |
| Memory exhaustion | Phase 1 | Monitor memory <512MB |
| Duplicate race | Phase 1 | Concurrent attempts blocked |
| Token expiry | Phase 1 | Test 90 min delay |
| Status update failures | Phase 2 | Verify retry logic |
| DAG stack overflow | Phase 1 | Test 1000+ message conversation |

## Sources

- [Render Free Tier Documentation](https://render.com/docs/free)
- [FastAPI Large File Handling](https://medium.com/@connect.hashblock/async-file-uploads-in-fastapi-handling-gigabyte-scale-data-smoothly-aec421335680)
- [ChatGPT Export Format Issues](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144)
- Codebase analysis: queue-processing, process-server, RLM service

---

*Researched: 2026-02-09*
*Confidence: HIGH*
