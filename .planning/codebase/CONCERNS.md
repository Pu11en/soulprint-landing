# Codebase Concerns

**Analysis Date:** 2026-02-11

## Tech Debt

### Anthropic API Cost Explosion (Fact Extraction)
- **Issue:** Fact extraction pipeline calls Haiku 4.5 with concurrency=10, making one API call per conversation chunk (2000 tokens per chunk). For a typical 100+ conversation export, this results in 2140+ parallel Haiku API calls during full pass.
- **Files:** `rlm-service/processors/fact_extractor.py` (line 114-162, `extract_facts_parallel`), `rlm-service/processors/full_pass.py` (line 195, concurrency=10)
- **Impact:**
  - Estimated cost: $0.80+ per import (2140 calls × $0.0004 per input + outputs)
  - At scale (100 users/month), costs ~$80/month just for fact extraction
  - No rate limiting or cost controls
  - Direct expense to operating margin
- **Fix approach:**
  - Batch chunks before API calls (e.g., 10 chunks per request instead of 1 per request)
  - Implement hierarchical aggregation: extract facts from top 50 conversations only, use clustering for remainder
  - Consider caching fact patterns to avoid re-extraction for similar conversations

### Full Pass Vulnerable to Render Redeploy Interruption
- **Issue:** Full pass is a background task that runs 30+ minutes (downloading 300MB+, chunking, extracting 2000+ facts, generating memory, v2 regeneration). Render redeploys kill processes after ~30s grace period.
- **Files:** `rlm-service/processors/streaming_import.py` (line 182-376, `trigger_full_pass` and `process_import_streaming`), `rlm-service/processors/full_pass.py` (line 119-245)
- **Impact:**
  - Full pass fails silently on any redeployment (happens weekly for small patches)
  - Users stuck with quick-pass only (incomplete memory, no MEMORY section)
  - No retry mechanism or checkpoint system
  - No way to know which full passes succeeded vs were killed
- **Fix approach:**
  - Implement persistent job queue (Bull/Redis or Supabase job table) that survives redeploys
  - Add checkpoints: save state after chunks, after facts, after memory so jobs can resume
  - Implement timeout handling with graceful pause and resume on next instance
  - Add observability: track full pass completion rate vs init rate

### Chunk Save Schema Mismatch
- **Issue:** `save_chunks_batch` in `full_pass.py` (line 47-116) manually filters chunk fields to match `VALID_COLUMNS` but schema enforcement is weak. If DB schema changes, saves silently fail or skip fields.
- **Files:** `rlm-service/processors/full_pass.py` (line 62-74, VALID_COLUMNS definition and filtering)
- **Impact:**
  - Chunks saved without `created_at` timestamps when field is renamed/moved
  - `is_recent` flag calculated in Python but DB may have different logic
  - Silent data loss: chunks save but missing critical fields needed for retrieval
  - No error on schema mismatch — chunks appear saved but are incomplete
- **Fix approach:**
  - Generate schema from TypeScript/database source of truth (Zod or similar)
  - Add validation after save: query back and verify field presence
  - Implement database trigger to auto-calculate `is_recent` instead of Python
  - Add retry logic with explicit schema validation

### JSON Parsing Fragility in Fact Extractor
- **Issue:** Fact extraction relies on `_try_repair_json` (line 241-303 in `fact_extractor.py`) which attempts to fix truncated JSON through heuristics. This is fragile and can silently produce invalid data structures.
- **Files:** `rlm-service/processors/fact_extractor.py` (line 241-303, `_try_repair_json`)
- **Impact:**
  - If Haiku response is truncated, repair function may corrupt the JSON structure
  - Consolidated facts may have missing or malformed entries
  - Hierarchical reduce then fails on malformed data, triggering circuit breaker
  - No validation that repaired JSON actually has the required schema
- **Fix approach:**
  - Use streaming JSON parsing instead of repair heuristics
  - Validate parsed JSON against schema before returning
  - On parse failure, return empty facts rather than repaired garbage
  - Add unit tests with truncated response samples

## Known Bugs

### Full Pass Killed by Render Redeploys
- **Symptoms:**
  - User import succeeds (quick pass completes)
  - Full pass starts but never completes
  - `full_pass_status` stays "processing" indefinitely or goes to "failed"
  - MEMORY section never generated, v2 sections never updated
- **Files:** `rlm-service/main.py` (line 217-249, `run_full_pass`), `rlm-service/processors/streaming_import.py` (line 185-263, `trigger_full_pass`)
- **Trigger:** Any Render deployment while full pass is running (happens ~weekly)
- **Workaround:** Manual re-import (user re-uploads export)

### Hierarchical Reduce Circuit Breaker Too Aggressive
- **Symptoms:**
  - Facts start reducing normally
  - After 5 consecutive batches fail, circuit breaker kicks in
  - Remaining facts kept as-is without reduction
  - Final output still oversized, memory_md truncated or empty
- **Files:** `rlm-service/processors/fact_extractor.py` (line 394-407, circuit breaker logic)
- **Trigger:** Models experiencing high latency or errors during batch reduction
- **Workaround:** None — stuck with incomplete memory

### Incomplete Error Propagation in Import Flow
- **Symptoms:**
  - Quick pass fails silently (import_status stays "processing")
  - User sees infinite loading spinner
  - Error not recorded in database
  - No alert to Drew
- **Files:** `rlm-service/processors/streaming_import.py` (line 266-419, `process_import_streaming`), exception handling is best-effort but doesn't guarantee status update
- **Trigger:** Streaming download fails mid-way or ijson parse error
- **Workaround:** User manually retries import

## Security Considerations

### Supabase REST API Calls Without Rate Limiting
- **Risk:** All background tasks (`download_conversations`, `update_user_profile`, `save_chunks_batch`) make direct HTTP calls to Supabase REST API without client-side rate limiting. If callback hell happens or tasks retry, API quota could be exhausted.
- **Files:** `rlm-service/main.py` (line 118-136, `update_user_profile`), `rlm-service/processors/full_pass.py` (line 18-116)
- **Current mitigation:** Supabase account has rate limits, but no application-level circuit breaker
- **Recommendations:**
  - Add exponential backoff with jitter to all Supabase REST calls
  - Implement circuit breaker pattern for REST endpoints
  - Monitor API quota usage and alert when >70%

### Secrets in Render Logs
- **Risk:** If any Anthropic/Supabase API calls fail with full request/response logged, secrets could leak to Render logs
- **Files:** `rlm-service/main.py` (line 88-100, logging Supabase response.text), `rlm-service/processors/full_pass.py` (line 111, logging Supabase response.text)
- **Current mitigation:** Errors logged with `response.text` but not full headers/auth
- **Recommendations:**
  - Redact auth headers in all error logs
  - Never log full HTTP responses, only status codes and truncated messages
  - Add structured logging with secret masking

### AWS Bedrock Credentials Not Validated on Startup
- **Risk:** `quick_pass.py` (line 95-100) checks credentials at runtime but doesn't fail hard — raises ValueError which is caught and becomes import_error
- **Files:** `rlm-service/processors/quick_pass.py` (line 95-100, credential check)
- **Current mitigation:** Check happens, but error messaging is vague to user
- **Recommendations:**
  - Add health check endpoint that validates all credentials
  - Fail container startup if credentials missing (don't silently defer to first import)
  - Return 503 if credentials invalid until fixed

## Performance Bottlenecks

### Memory Usage During Download + Parse
- **Problem:** Streaming import downloads to temp file, but if download is slow and large (300MB+), Render's limited RAM could cause OOM
- **Files:** `rlm-service/processors/streaming_import.py` (line 63-88, `download_streaming`), `rlm-service/main.py` (line 139-214, `download_conversations`)
- **Cause:**
  - Large file streaming to disk uses queue buffering
  - ijson parser loads entire file structure in memory after download
  - No memory monitoring or graceful degradation
- **Improvement path:**
  - Implement streaming ijson parsing directly from network stream (no temp file)
  - Add memory gauge: monitor RSS and warn if >80% of container limit
  - Implement chunked ZIP extraction (extract one conversation at a time if ZIP)
  - Consider splitting imports into smaller batches server-side if >100 conversations

### Fact Extraction Parallelization Saturates Render Instance
- **Problem:** `extract_facts_parallel` with concurrency=10 makes 10 simultaneous API calls. On a single Render instance, this blocks other requests (health checks, progress updates, query requests).
- **Files:** `rlm-service/processors/fact_extractor.py` (line 114-162, concurrency=10)
- **Cause:** Full pass runs in background but still blocks event loop during parallel gather
- **Improvement path:**
  - Reduce concurrency to 3-5 and spread extraction over longer period (allow interruptions)
  - Implement queue-based extraction that runs async to incoming requests
  - Add request priority: health checks > query > background tasks

### Token Estimation Algorithm Is Inaccurate
- **Problem:** Token estimation uses `len(text) // 4` (line 11-22 in `conversation_chunker.py`). Claude actually tokenizes at ~3.5 chars per token, leading to undersized chunks (1600 actual tokens when targeting 2000, wastes API calls).
- **Files:** `rlm-service/processors/conversation_chunker.py` (line 11-22, `estimate_tokens`)
- **Cause:** Hardcoded approximation without considering actual tokenizer
- **Improvement path:**
  - Use `tiktoken` library with Claude's tokenizer for accurate estimates
  - Adjust target_tokens based on actual vs. estimated to self-correct
  - Cache token counts per chunk to avoid recalculation

## Fragile Areas

### V2 Regeneration Assumes Light Conversation Format
- **Files:** `rlm-service/processors/v2_regenerator.py` (line 84-154, `sample_conversations_for_v2`), `rlm-service/processors/full_pass.py` (line 164-172, `conversations_light`)
- **Why fragile:**
  - Full pass creates a "light" version of conversations (first 20 messages only) for v2 regen (line 169)
  - If full_pass fails midway and v2_regenerator is called with unfiltered conversations, it may hit token limits
  - No validation that input format matches expectations
  - Mapping access assumes old ChatGPT export format (line 190-206 in v2_regenerator)
- **Safe modification:**
  - Add schema validation for input conversations before sampling
  - Make v2_regenerator work with both light and full formats
  - Add unit tests with sample ChatGPT exports in different formats

### DAG Parser Only Extracts Active Path
- **Files:** `rlm-service/processors/dag_parser.py`
- **Why fragile:**
  - ChatGPT conversations are DAGs (branches, regenerations). Parser extracts only "active" (most recent) path
  - If user branches conversation and returns to old branch, that context is lost
  - No warning that data is being dropped
  - Chunker relies on this format without validation
- **Safe modification:**
  - Add comment in chunker warning about data loss
  - Consider storing branch metadata for future recovery
  - Add unit test with branched conversation to verify extraction

### Main Service Endpoints Have No Timeout Enforcement
- **Files:** `rlm-service/main.py` (line 561-684, all endpoints)
- **Why fragile:**
  - `/process-full` and `/import-full` have no timeout (fire-and-forget background tasks)
  - If task hangs, it consumes a process slot forever
  - Render has limited process capacity, eventual denial of service
- **Safe modification:**
  - Add explicit timeout to all background tasks
  - Implement task cancellation after timeout
  - Return timeout errors to client instead of silent failure

## Scaling Limits

### Current Capacity
- **Single Render Instance:** Up to 5 concurrent imports (limited by RAM and API concurrency)
- **API Call Rate:** 10 parallel calls per import × 2140 chunks = 21,400 concurrent Anthropic requests at peak (far beyond rate limits)
- **Storage:** Chunks saved to Supabase (100KB each × 2000 chunks × 100 users = 20GB annually) — not a hard limit but costs grow

### Limit: Full Pass Processing Time
- **Current:** 30 minutes per import (download + chunk + extract + reduce + memory + v2)
- **Breaking point:** Exports >200 conversations fail to process in 30 minutes (see `FULL_PASS_TIMEOUT_SECONDS` line 182 in streaming_import.py)
- **Scaling path:**
  - Implement queue-based processing (Bull, RQ, or Celery)
  - Distribute extraction across multiple workers
  - Cache embedding results to avoid re-extraction on retries

### Limit: Anthropic API Quota
- **Current:** At 100 concurrent Haiku calls, quota hits within minutes
- **Current mitigation:** Semaphore concurrency=10, but still 10 parallel calls per import
- **Scaling path:**
  - Switch to batch API for fact extraction (higher throughput, lower cost)
  - Implement global rate limiter across all RLM instances
  - Add circuit breaker to fail gracefully if API quota exhausted

### Limit: Render RAM
- **Container RAM:** Typically 512MB-1GB depending on plan
- **Current usage per import:** ~200MB (large JSON in memory during parsing)
- **Breaking point:** Simultaneous large imports cause OOM
- **Scaling path:**
  - Migrate to serverless function (AWS Lambda, Google Cloud Run) with auto-scaling
  - Implement streaming pipeline that never holds full conversation in memory
  - Add memory monitoring and graceful degradation (refuse new imports if >70% usage)

## Dependencies at Risk

### RLM Library (rlm package)
- **Risk:** Installed from GitHub at Docker build time (`git+https://github.com/alexzhang13/rlm.git` in Dockerfile line 11). No version pinning. If repo deleted or moved, builds fail.
- **Impact:** New deployments fail, can't scale horizontally
- **Migration plan:**
  - Pin to specific commit hash instead of main branch
  - Consider vendoring RLM code directly if it's not actively maintained
  - Monitor upstream repo for deprecation notices

### Anthropic Python SDK Breaking Changes
- **Risk:** Currently installed with `anthropic[bedrock]>=0.18.0` — no upper bound. Major version upgrades (1.0+) often break API.
- **Impact:** New deployments could fail if package breaks compatibility
- **Migration plan:**
  - Pin to specific minor version: `anthropic==0.18.0` (or latest 0.x)
  - Test SDK upgrades in staging before production
  - Monitor release notes for deprecations

## Missing Critical Features

### No Observability for Background Tasks
- **Problem:** Full pass runs in background with no way to track progress or errors except checking database status
- **Blocks:** Can't debug why imports fail, can't predict completion time, no metrics on success rate
- **Solution:**
  - Add structured logging to all background tasks with trace IDs
  - Implement progress webhook that frontend can poll
  - Add OpenTelemetry instrumentation for distributed tracing

### No Resumption/Retry Logic for Failed Imports
- **Problem:** If full pass fails midway (e.g., network timeout during chunk save), entire pipeline must restart
- **Blocks:** Large imports (300MB+ files) fail frequently and waste API quota restarting from beginning
- **Solution:**
  - Implement checkpoint system: save state after each major step
  - Add idempotent save operations (upsert chunks, don't re-extract facts)
  - Implement exponential backoff for retries

### No Cost Tracking or Budget Alerts
- **Problem:** Fact extraction makes 2000+ API calls per import with no visibility into costs or way to set spending limits
- **Blocks:** Can't optimize for cost, no early warning if quota about to exceed budget
- **Solution:**
  - Add cost calculation in fact extraction (track calls, estimate spend)
  - Implement budget threshold alerts (Slack notification at $X spent)
  - Add cost-optimization options: fewer chunks, faster (less accurate) models

## Test Coverage Gaps

### Untested Chunk Save with Schema Mismatch
- **What's not tested:** What happens when DB schema changes or a field is missing from VALID_COLUMNS
- **Files:** `rlm-service/processors/full_pass.py` (line 47-116, `save_chunks_batch`)
- **Risk:** Silent data loss — chunks appear saved but missing fields
- **Priority:** High — causes production data corruption
- **Fix:** Add integration test that queries back chunks and verifies all fields present

### Untested Full Pass Interruption/Timeout
- **What's not tested:** What happens if full pass times out at each stage (download, chunk, extract, memory, v2)
- **Files:** `rlm-service/processors/streaming_import.py` (line 182-263), `rlm-service/processors/full_pass.py`
- **Risk:** Unknown error states, incomplete data saved
- **Priority:** High — Render redeploys happen weekly
- **Fix:** Add chaos test that kills full pass at each stage and verifies graceful failure

### Untested Memory Usage with Large Exports
- **What's not tested:** Importing 300MB+ export on limited RAM container
- **Files:** `rlm-service/processors/streaming_import.py` (line 266-419), `rlm-service/main.py` (line 139-214)
- **Risk:** Silent OOM errors, user stuck with "processing" status
- **Priority:** Medium — affects power users
- **Fix:** Add load test with 300MB mock export to detect memory thresholds

### Untested Fact Extraction JSON Repair
- **What's not tested:** Actual truncated Haiku responses and whether `_try_repair_json` produces valid output
- **Files:** `rlm-service/processors/fact_extractor.py` (line 241-303)
- **Risk:** Silent data corruption if repair produces malformed JSON
- **Priority:** Medium — depends on model output quality
- **Fix:** Add unit tests with sample truncated responses and verify repaired JSON validates against schema

### Untested DAG Parser with Branched Conversations
- **What's not tested:** ChatGPT exports with branched conversations (user selected a different assistant response)
- **Files:** `rlm-service/processors/dag_parser.py`
- **Risk:** Silent data loss if branches contain important context
- **Priority:** Low — depends on user behavior
- **Fix:** Add unit test with branched conversation and verify parser extracts correct path

---

*Concerns audit: 2026-02-11*
