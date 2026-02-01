# Codebase Concerns

**Analysis Date:** 2026-02-01

## Security Concerns

### Exposed Secrets in Environment File
**Risk:** Critical - All API keys, credentials, and sensitive tokens are stored in plaintext in `.env.local`

**Files:**
- `C:\Users\drewp\soulprint-landing\.env.local`

**Current mitigation:**
- `.env.local` is in `.gitignore`
- Local development only

**What's exposed:**
- AWS credentials (ACCESS_KEY_ID, SECRET_ACCESS_KEY)
- Supabase keys (ANON_KEY, SERVICE_ROLE_KEY)
- OpenAI API keys
- Perplexity, Tavily, Gmail, R2, Stripe API keys
- OAuth tokens and refresh tokens
- Slack bot tokens

**Recommendations:**
- Never commit `.env.local` to version control (already done)
- Use Vercel environment variables for production secrets
- Rotate all exposed keys immediately if repository becomes public
- Consider using AWS Secrets Manager or similar for production
- Implement secret scanning in CI/CD pipeline

### Hardcoded Admin Email Checks
**Risk:** Medium - Admin endpoints are protected by email string matching

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\admin\health\route.ts` (line 6-9)

**Current approach:**
```typescript
const ADMIN_EMAILS = [
  'drew@archeforge.com',
  'drewspatterson@gmail.com',
]
```

**Issue:**
- Email-based auth is insufficient for sensitive admin endpoints
- No rate limiting on admin endpoints
- No audit logging of admin actions

**Recommendation:**
- Implement proper admin role in database schema
- Use role-based access control (RBAC) with JWT claims
- Add audit logging for all admin operations
- Rate-limit admin endpoints
- Require multi-factor authentication for admin access

### RLM Service URL Not Validated
**Risk:** Medium - External RLM service URL is called without validation

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (lines 84-121)

**Issue:**
- RLM service URL from environment is used directly in fetch calls
- No HTTPS validation enforced
- No request signing/authentication shown
- Potential for man-in-the-middle attacks if URL compromised

**Recommendations:**
- Validate RLM URL is HTTPS before using
- Implement service-to-service authentication (API key, mTLS, or JWT)
- Add request signing for RLM calls
- Monitor for unexpected RLM failures

---

## Tech Debt

### Multiple API Endpoints for Same Functionality
**Issue:** Multiple overlapping import processing endpoints with unclear coordination

**Files affected:**
- `C:\Users\drewp\soulprint-landing\app\api\import\process\route.ts` (unified processor)
- `C:\Users\drewp\soulprint-landing\app\api\import\upload\route.ts` (triggers two-phase)
- `C:\Users\drewp\soulprint-landing\app\api\import\quick\route.ts` (phase 1)
- `C:\Users\drewp\soulprint-landing\app\api\import\process-background\route.ts` (phase 2)
- `C:\Users\drewp\soulprint-landing\app\api\import\embed-all\route.ts`
- `C:\Users\drewp\soulprint-landing\app\api\import\process-server\route.ts`

**Impact:**
- Confusing which endpoint to call
- High risk of duplicate work
- Difficult to debug failures
- Inconsistent error handling between endpoints

**Fix approach:**
- Consolidate to single primary endpoint with clear phases
- Remove redundant endpoints or mark as deprecated
- Document endpoint contract clearly
- Consider state machine pattern for import lifecycle

### Bedrock Client Initialization Scattered Across Codebase
**Issue:** Multiple manual Bedrock client initializations

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (line 16-22)
- `C:\Users\drewp\soulprint-landing\lib\memory\query.ts` (line 49-57)
- `C:\Users\drewp\soulprint-landing\lib\memory\learning.ts` (line 14-20)

**Impact:**
- Code duplication (credentials config repeated 3+ times)
- Harder to change AWS region or configuration
- Risk of inconsistent client setup
- Higher memory footprint (multiple client instances)

**Fix approach:**
- Create singleton factory in `lib/bedrock/client.ts`
- Export consistent client instance from factory
- Document configuration and retry logic centrally

### Import Page is Very Large (801 lines)
**Issue:** Single component handling too many concerns

**Files:**
- `C:\Users\drewp\soulprint-landing\app\import\page.tsx` (801 lines)

**Impact:**
- Hard to test
- Hard to modify without affecting other features
- High cognitive load
- IndexedDB, file parsing, progress tracking, reset logic all mixed

**Fix approach:**
- Extract file parsing to separate module (`lib/import/file-handler.ts`)
- Extract IndexedDB logic to separate module (`lib/import/db-client.ts`)
- Extract progress tracking to custom hook (`hooks/useImportProgress.ts`)
- Create reusable components for each step
- Reduce component to < 300 lines

### Chat Route is Complex (449 lines)
**Issue:** Single endpoint handles multiple LLM backends and fallbacks

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (449 lines)

**Impact:**
- Hard to understand request path (RLM vs Bedrock vs Perplexity vs Tavily)
- Difficult to modify LLM configuration
- Too many responsibilities in one endpoint
- Error handling is tangled

**Fix approach:**
- Create strategy pattern for LLM providers (`lib/llm/providers/`)
- Extract search logic to separate module (`lib/search/handler.ts`)
- Extract system prompt building to separate file (`lib/chat/system-prompt.ts`)
- Use composition to chain providers with fallbacks
- Reduce route handler to orchestration only

### Type Safety Issues with `any`
**Issue:** 37 instances of `any` type in app code

**Files:**
- Most prevalent in `C:\Users\drewp\soulprint-landing\app\import\page.tsx`

**Impact:**
- Loss of type checking at compile time
- Harder to refactor safely
- Runtime errors more likely
- IDE autocomplete unreliable

**Fix approach:**
- Create proper interfaces for all API responses
- Use TypeScript strict mode (`strict: true` in tsconfig - already enabled)
- Create factory functions that return properly typed data
- Type all IndexedDB operations: `IDBDatabase | null` instead of `any`

---

## Performance Bottlenecks

### Memory Search Uses Two Methods Sequentially
**Risk:** Medium - Query falls back to keyword search if embedding fails

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (lines 174-183)

**Current approach:**
```typescript
const { contextText, chunks, method } = await getMemoryContext(user.id, message, 5);
```

**Issue:**
- If embedding fails, falls back to keyword search automatically
- No timing information on fallback trigger
- Could mask performance issues

**Improvement path:**
- Add metrics for embedding vs keyword search ratio
- Implement parallel search (embeddings + keyword simultaneously)
- Cache recent embeddings to avoid recomputation
- Add observability to understand when fallback triggers

### Large Payload Chunks Transferred to Client
**Issue:** Full conversation chunks and raw JSON compressed with gzip but still large

**Files:**
- `C:\Users\drewp\soulprint-landing\app\import\page.tsx` (IndexedDB storage)
- `C:\Users\drewp\soulprint-landing\app\api\import\process\route.ts` (line 60 - rawJson)

**Impact:**
- Network transfer time on slow connections
- IndexedDB storage quota concerns on mobile
- Serialization/deserialization overhead

**Recommendation:**
- Stream large files instead of loading entirely
- Chunk processing at 100-200KB boundaries
- Consider deferring non-critical data storage
- Implement incremental background processing

### Multiple Rounds to Perplexity API
**Issue:** Web search goes through Perplexity then falls back to Tavily

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (lines 205-235)

**Current flow:**
1. Check if Perplexity API key exists
2. Call Perplexity API
3. If fails, try Tavily
4. Format results for system prompt

**Issue:**
- Perplexity failure adds 15+ seconds latency before Tavily kicks in
- No parallel attempt
- Hardcoded timeouts could be optimized per service

**Improvement:**
- Implement racing (fastest response wins)
- Set shorter timeout for Perplexity (try both quickly)
- Cache search results for common queries
- Consider pre-computing frequently searched topics

---

## Fragile Areas

### RLM Service as Critical Path
**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (lines 238-271)

**Why fragile:**
- RLM is required for chat to work well (memory retrieval)
- External service not under direct control
- 60-second timeout might be too long or too short depending on load
- Fallback to Bedrock works but degrades experience (no memory context)
- No circuit breaker pattern

**Safe modification:**
- Add RLM health check endpoint
- Implement exponential backoff on failures
- Cache previous RLM responses for fallback
- Monitor RLM response times in production
- Add alerts if RLM availability drops below 95%

**Test coverage needed:**
- Mock RLM service for chat tests
- Test timeout scenarios
- Test degraded mode (Bedrock-only chat)
- Test partial RLM failures (slow responses)

### User Profile Lazy Initialization
**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (lines 188-199)

**Why fragile:**
- AI name is auto-generated if missing
- This call happens on every chat if name wasn't set
- If it fails, name defaults to hardcoded string
- No retry logic for name generation failures
- Could lead to multiple users having same fallback name

**Safe modification:**
- Pre-generate AI name during import completion
- Only generate once and store immediately
- Add database constraint to ensure unique names per user
- Monitor failed name generation attempts

**Test coverage needed:**
- Test behavior when name generation fails
- Test parallel chat requests during name generation
- Verify uniqueness of generated names

### Multi-API Dependency Chain
**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts`

**Dependencies (in order):**
1. Supabase Auth (check user)
2. Supabase DB (fetch profile)
3. Memory query (could call Bedrock embeddings)
4. RLM service (optional but crucial)
5. Perplexity or Tavily (web search if enabled)
6. Bedrock (fallback LLM)

**Issue:** Each dependency failure has cascading effects
- Missing profile → undefined behavior
- Memory query timeout → chat delays
- RLM unavailable → no memory in fallback
- Both web search services down → no current information

**Mitigation needed:**
- Implement feature flags for each service
- Add graceful degradation per service
- Implement timeout strategies per call
- Return structured error responses indicating which service failed

---

## Known Bugs

### .env.local Syntax Issue
**Symptom:** `.env.local` file contains a "nul" file at root

**Files affected:**
- `C:\Users\drewp\soulprint-landing\nul` (spurious file)

**Investigation:** Appears to be a Windows redirection artifact

**Fix:** Delete `nul` file from repository root

---

## Scaling Limits

### Database Query Patterns Without Indexes
**Risk:** Performance degrades as user base grows

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts` (line 161 - user_profiles select)
- `C:\Users\drewp\soulprint-landing\app\api\import\process\route.ts` (line 91 - duplicate import check)

**Current capacity:**
- Likely fine for < 10K active users
- At 100K+ users, unindexed lookups could become slow

**Scaling path:**
- Verify indexes exist on `user_profiles.user_id`
- Verify indexes exist on `conversation_chunks.user_id, created_at`
- Monitor slow query logs in Supabase
- Implement read replicas for frequently accessed tables
- Consider denormalizing user profile data for faster lookup

### Embedding Batch Size Fixed at 96
**Files:**
- `C:\Users\drewp\soulprint-landing\lib\memory\query.ts` (line 100 - BATCH_SIZE = 96)

**Issue:**
- Fixed batch size not optimal for all scenarios
- No adaptive batching based on payload size
- Could timeout with large embeddings

**Improvement:**
- Make batch size configurable per model
- Implement dynamic sizing based on token count
- Monitor embedding latencies and adjust batch size
- Consider streaming for very large batches

### Storage for Raw Exports
**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\import\process\route.ts` (line 178 - raw_export_path)

**Concern:**
- Compressed JSON stored in Supabase Storage
- No retention policy set
- Could grow unbounded

**Scaling path:**
- Set automated cleanup (30-90 day retention)
- Monitor storage usage trends
- Consider S3 Glacier for long-term retention
- Implement archive strategy for large exports

---

## Test Coverage Gaps

### Import Processing Not Fully Tested
**What's not tested:**
- Two-phase import completion
- Chunk batching (BATCH_SIZE logic)
- Raw JSON compression and storage
- Import state transitions (pending → complete)

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\import\process\route.ts`
- `C:\Users\drewp\soulprint-landing\app\api\import\upload\route.ts`

**Risk:** High - Import is critical path. Silent failures likely.

**Priority:** High

### Chat Fallback Chains Not Tested
**What's not tested:**
- RLM service timeout behavior
- Perplexity → Tavily fallback
- Bedrock-only mode (when RLM down)
- Parallel search requests during slow RLM responses

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts`

**Risk:** Medium - User experience degrades silently

**Priority:** High

### Memory Query Embedding Failures Not Tested
**What's not tested:**
- Bedrock embedding API errors
- Fallback to keyword search behavior
- Handling of very large documents
- Edge cases in similarity matching

**Files:**
- `C:\Users\drewp\soulprint-landing\lib\memory\query.ts`

**Risk:** Medium - Memory features fail silently

**Priority:** Medium

### Auth Middleware Not Tested
**What's not tested:**
- Token expiration handling
- Session refresh logic
- Cookie management
- Protected route access

**Files:**
- `C:\Users\drewp\soulprint-landing\lib\supabase\middleware.ts`

**Risk:** High - Auth is foundational

**Priority:** High

---

## Dependencies at Risk

### Custom RLM Service (External)
**Risk:** High - Proprietary service not under direct control

**Impact:** If RLM goes down:
- Chat functionality degrades to Bedrock without memory
- No conversation context retrieval
- Premium feature becomes basic

**Migration plan:**
- Keep Bedrock fallback working (already done)
- Document how to switch to pure Bedrock mode
- Build in-house memory service as backup
- Set SLA expectation with RLM provider

### Perplexity API Dependency
**Risk:** Medium - Proprietary API, pricing changes possible

**Impact:**
- Web search feature unavailable if Perplexity down
- Falls back to Tavily

**Migration plan:**
- Keep Tavily as always-available fallback (already done)
- Monitor Perplexity pricing and availability
- Consider implementing custom search with Tavily alone

### Bedrock AWS Dependency
**Risk:** Medium - Regional availability, service deprecation possible

**Impact:**
- Chat completely non-functional if Bedrock unavailable
- No fallback LLM provider

**Migration plan:**
- Add OpenAI GPT-4 as fallback provider (credentials already exist)
- Implement provider selection logic
- Monitor Bedrock deprecations from AWS
- Test OpenAI fallback regularly

---

## Missing Critical Features

### No Conversation Backup/Export for Users
**Problem:** Users cannot export their chat history after import

**Impact:**
- Data portability concern
- Lock-in effect
- GDPR compliance issue (right to data portability)

**Recommendation:** Implement `/api/memory/export` endpoint

### No Explicit User Consent for Data Processing
**Problem:** No explicit opt-in for storage/processing of imported conversations

**Impact:**
- Privacy/compliance risk
- Users unaware of data storage duration
- GDPR/CCPA implications

**Recommendation:**
- Add explicit consent modal before import starts
- Document data retention policy
- Implement delete-after-X-days option

### No Rate Limiting on User Chat Requests
**Problem:** No per-user rate limits on chat endpoint

**Files:**
- `C:\Users\drewp\soulprint-landing\app\api\chat\route.ts`

**Impact:**
- Expensive API calls (Bedrock, Perplexity) uncontrolled
- Potential for cost explosion from abuse
- No protection against token-stuffing attacks

**Recommendation:**
- Implement Redis-based rate limiting (e.g., 100 requests/hour per user)
- Return 429 status when limit exceeded
- Add X-RateLimit headers to responses
- Log violations for monitoring

### No Metrics/Observability on API Endpoints
**Problem:** Limited visibility into system behavior

**Files:** All API routes

**Impact:**
- Hard to debug performance issues
- Can't track which features are used
- Can't detect anomalies in user behavior

**Recommendation:**
- Add structured logging (JSON format)
- Track latencies per service call
- Log success/failure rates per endpoint
- Monitor error patterns

---

## Build and Configuration Issues

### Test Output Files Left in Repository
**Problem:** Multiple test output files committed

**Files:**
- `C:\Users\drewp\soulprint-landing\test-output.txt`
- `C:\Users\drewp\soulprint-landing\test-output-2.txt`
- `C:\Users\drewp\soulprint-landing\test-output-3.txt`
- `C:\Users\drewp\soulprint-landing\test-output-final.txt`
- `C:\Users\drewp\soulprint-landing\test-output-v3.txt`
- `C:\Users\drewp\soulprint-landing\models-output.txt`
- `C:\Users\drewp\soulprint-landing\import_check.html`
- `C:\Users\drewp\soulprint-landing\build.log`

**Impact:**
- Repository bloat
- Confusing for new developers
- Should be in `.gitignore`

**Fix:**
- Add these patterns to `.gitignore`:
  ```
  test-output*.txt
  models-output.txt
  import_check.html
  build.log
  *.log
  ```

### TypeScript Build Cache Not Cleared
**Files:**
- `C:\Users\drewp\soulprint-landing\tsconfig.tsbuildinfo` (660KB)

**Issue:**
- Build cache file is large and not typically committed
- Should be in `.gitignore` or `.gitattributes`

**Fix:**
- Add to `.gitignore`: `tsconfig.tsbuildinfo`

### No Environment Validation at Startup
**Problem:** Missing required env vars aren't detected until runtime

**Files:**
- All API routes that use `process.env.KEY!`

**Impact:**
- Deploy with missing config goes unnoticed until request hits that code path
- Could take hours to discover missing API key

**Recommendation:**
- Add startup validation script
- Create `lib/env.ts` with runtime checks
- Fail fast if required vars missing
- Export validated config as object

---

## Documentation Gaps

### Unclear Import Flow
**Problem:** Multiple import endpoints with complex phases

**Impact:**
- Hard for new developers to understand flow
- Easy to add wrong endpoint in new features
- Difficult to debug import failures

**Recommendation:**
- Create diagram of import state machine
- Document each endpoint's exact responsibility
- Add decision tree for which endpoint to call

### RLM Service Contract Undocumented
**Problem:** RLM expectations not defined

**Impact:**
- Assumptions about RLM API could be wrong
- Timeout values chosen arbitrarily (60 seconds)
- Error handling unclear

**Recommendation:**
- Document RLM request/response format
- Document timeout expectations
- Clarify what happens when RLM has no memory
- Add version pinning if available

### No API Error Response Standard
**Problem:** Error responses vary by endpoint

**Impact:**
- Client code has to handle multiple error formats
- Harder to implement universal error handling
- Error messages inconsistent

**Recommendation:**
- Define error response schema:
  ```json
  {
    "error": "error_code",
    "message": "Human readable message",
    "statusCode": 400,
    "details": {}
  }
  ```
- Use consistently across all endpoints
- Document error codes as enum

---

*Concerns audit: 2026-02-01*
