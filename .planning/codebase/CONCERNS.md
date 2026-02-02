# Codebase Concerns

**Analysis Date:** 2026-02-01

## Critical Issues

### Silent Failures in Database Updates

**Issue: Missing Response Validation in Storage Cleanup**
- Files: `app/api/import/process-server/route.ts` (lines 101, 120, 136, 142, 152, 193)
- Problem: `.catch(() => {})` silently swallows storage deletion errors without logging
- Impact: Failed cleanup could leave orphaned files in Supabase Storage, wasting quota and leaving sensitive data accessible
- Safe modification: Add explicit error logging to catch blocks:
  ```typescript
  adminSupabase.storage.from(bucket).remove([filePath])
    .catch(e => console.warn('[ProcessServer] Cleanup failed:', e))
  ```

**Issue: Unvalidated Supabase Updates**
- Files: `app/api/import/process-server/route.ts` (line 340)
- Problem: Database update status missing error check - `await adminSupabase.from('user_profiles').update(...).eq(...)` doesn't validate response
- Impact: User import_status might not update to 'failed' even when error occurs, leaving users in stuck state
- Safe modification: Add response validation and error handling

## Tech Debt

**Placeholder Soulprint Generation**
- Files: `app/api/import/process-server/route.ts` (lines 237-242)
- Issue: Sets "Analyzing..." placeholder soulprint with `pending: true` flag, but actual generation deferred to RLM
- Impact: Users see incomplete soulprint until RLM completes (async operation)
- Timeline: Medium priority - frontend already handles `pending` flag, but UX could be improved with progress indicator

**Dead Code Not Yet Removed**
- Files: `lib/import/embedder.ts` (old Titan embedding system)
- Files: `app/api/import/process/route.ts` (old import route)
- Files: `scripts/generate-embeddings.ts` (unused script)
- Impact: Codebase confusion, maintenance burden
- Fix approach: Remove after confirming no references from active flows

**Push Notifications Disabled**
- Files: `app/api/import/complete/route.ts` (lines 163-176)
- Issue: Web push notifications commented out - requires `push_subscription` column in `user_profiles`
- Impact: Users miss import completion notifications on web/mobile
- Fix approach: Add `push_subscription` column to schema, migrate existing users, enable push code

## Security Concerns

**Environment Variable Exposure in Error Messages**
- Files: `app/api/chat/route.ts` (line 225), multiple API routes
- Risk: Error messages logged to console could contain sensitive context if not properly sanitized
- Current mitigation: Errors logged to console/Vercel logs (requires auth access to view)
- Recommendation: Review all error logging to ensure no credential exposure

**Missing Auth Check in Internal Headers**
- Files: `app/api/import/process-server/route.ts` (lines 46-48)
- Risk: Accepts `X-Internal-User-Id` header without validation - allows any caller to specify user_id
- Current mitigation: This is server-side only (Vercel environment)
- Recommendation: Validate internal header with shared secret if called from external services

**Unvalidated User Profile Data**
- Files: `app/api/chat/route.ts` (line 167)
- Risk: `profile` cast to `UserProfile` type without runtime validation of required fields
- Impact: Could crash if database returns unexpected schema
- Safe modification: Add explicit field validation before use

## Performance Bottlenecks

**Memory Search Blocking Chat Response**
- Files: `app/api/chat/route.ts` (lines 174-182)
- Problem: Vector search for memory context happens synchronously, blocking response
- Impact: If memory search is slow (network lag, vector DB issues), user sees delayed chat response
- Improvement path: Consider parallel execution with timeout fallback or async queue

**Smart Search Creates Cascading Requests**
- Files: `app/api/chat/route.ts` (lines 207-227)
- Problem: Web search can add 2-5 seconds latency to chat responses
- Impact: Users perceive slow chat when deep search is needed
- Improvement path: Implement search result caching, pre-search for common queries

**Unbounded Chat History in Context**
- Files: `app/api/chat/route.ts` (line 350)
- Problem: `messages.slice(-10)` sends last 10 messages to RLM every request
- Impact: With long conversations, context grows unbounded over time
- Improvement path: Implement sliding window with summarization for old context

## Fragile Areas

**Import Status State Machine**
- Files: `app/api/import/process-server/route.ts`, `app/api/import/complete/route.ts`
- Files: `app/chat/page.tsx` (lines 121-151)
- Why fragile: Multiple status values ('none', 'processing', 'quick_ready', 'complete', 'failed') with unclear transitions
- Complexity: RLM callback can fire in any order relative to UI polls, race conditions possible
- Safe modification: Add strict validation of status transitions, implement state machine with guards
- Test coverage gap: No tests for concurrent import completion + UI polling scenarios

**RLM Service Dependency**
- Files: `app/api/chat/route.ts` (lines 83-120), `app/api/import/process-server/route.ts` (lines 294-315)
- Why fragile: Entire chat and import pipeline depends on RLM availability
- Complexity: RLM URL hardcoded via environment, no fallback strategy
- Safe modification: Implement circuit breaker pattern, graceful degradation when RLM unavailable
- Monitoring gap: No alerts if RLM becomes unhealthy - users get silent failures

**Async Email Notifications**
- Files: `app/api/import/complete/route.ts` (lines 145-161)
- Why fragile: Email sending is best-effort, no retry mechanism if Resend fails
- Complexity: No notification to admin if email fails - users never know import completed
- Safe modification: Implement email retry queue with exponential backoff
- Test coverage gap: No tests for email failure scenarios

## Known Bugs

**Pending Soulprint Display**
- Symptoms: Users see "Analyzing..." soulprint_text during RLM processing
- Files: `app/api/import/process-server/route.ts` (line 239), `app/chat/page.tsx`
- Trigger: Any user import that goes through RLM for full processing
- Workaround: Wait for RLM processing to complete, soulprint updates via callback

**Memory Status Poll Race Condition**
- Symptoms: UI shows "processing" then suddenly "complete" without smooth transition
- Files: `app/chat/page.tsx` (lines 113-162)
- Trigger: Rapid status changes during embedding completion
- Cause: 5-second poll interval means UI can miss intermediate states
- Workaround: Users can refresh page to see latest status

## Scaling Limits

**Storage Cleanup is Fire-and-Forget**
- Current: Imported ZIP files deleted via `.catch(() => {})` without validation
- Limit: If cleanup fails at scale, Supabase storage fills up and costs increase
- Scaling path: Implement cleanup queue with retries, monitor failed deletions

**Vector Search at Large Scale**
- Current: Single RPC call for hierarchical search of all chunks
- Limit: With 100k+ chunks, search latency will degrade
- Scaling path: Partition chunks by user, implement multi-stage filtering, add search indexes

**Chat History Accumulation**
- Current: Loads last 100 messages from `chat_messages` table every session (line 76 in `app/chat/page.tsx`)
- Limit: Users with 1000+ messages will see slow load times
- Scaling path: Implement pagination, archive old conversations, add summary rollups

## Dependencies at Risk

**AWS Bedrock for AI Name Generation**
- Risk: Name generation fallback is hardcoded name "Echo" - if Bedrock unavailable, all users get same name
- Impact: Poor UX, non-unique AI personalities
- Migration plan: Cache generated names, pre-generate common names

**Resend Email Service**
- Risk: No RESEND_API_KEY in some environments causes silent failure (line 7-9 in `lib/email/send.ts`)
- Impact: Users never notified that import is complete
- Migration plan: Support multiple email providers (SendGrid fallback)

**OpenAI for Embeddings** (noted as "not for soulprint" but still used)
- Risk: OPENAI_API_KEY cost at scale for every chat query
- Impact: Embeddings cost increases with user base
- Migration plan: Consider Cohere or local embeddings model

## Test Coverage Gaps

**RLM Service Failure Scenarios**
- What's not tested: RLM timeout (60s), RLM returns 500, RLM returns invalid JSON
- Files: `app/api/chat/route.ts` (lines 83-120)
- Risk: Fallback behavior untested - could crash if response parsing fails
- Priority: High

**Import Status Transitions**
- What's not tested: Status changes during concurrent operations (user retries while processing)
- Files: `app/api/import/process-server/route.ts`, `app/api/import/complete/route.ts`
- Risk: Race conditions leave users in stuck state
- Priority: High

**Email Delivery**
- What's not tested: Resend API errors, timeout, bounced emails
- Files: `lib/email/send.ts`
- Risk: Users don't know import completed, support inquiries spike
- Priority: Medium

**Memory Search Graceful Degradation**
- What's not tested: Memory search timeout (no timeout set in query)
- Files: `app/api/chat/route.ts` (line 175)
- Risk: Chat response hangs indefinitely if vector DB is slow
- Priority: Medium

**Web Search Cascading Failures**
- What's not tested: Perplexity timeout, Tavily timeout, both search providers down
- Files: `lib/search/smart-search.ts` (referenced but not reviewed)
- Risk: Smart search could take >60s and timeout chat request
- Priority: Medium

## Missing Critical Features

**Import Retry Mechanism**
- Problem: If RLM processing fails mid-way, no automatic retry or resume
- Blocks: Users must re-upload their entire export to try again
- Recommendation: Implement checkpoint system, allow resume from failed step

**Failed Notification Re-trigger**
- Problem: If email fails, no way to manually re-trigger notification
- Blocks: Support team cannot help users who completed import but didn't receive email
- Recommendation: Add admin panel to re-trigger notifications, check notification delivery status

**Chunk Visibility for Users**
- Problem: Users cannot see what conversation chunks were created or searched
- Blocks: Debugging why certain memories aren't being found
- Recommendation: Add memory browser in chat UI showing active chunks

---

*Concerns audit: 2026-02-01*
