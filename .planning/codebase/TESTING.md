# Testing Patterns

**Analysis Date:** 2026-02-01

## Test Framework

**Status:** No formal testing framework configured

- No test runner found (Jest, Vitest not installed)
- No test files in `src/` or `app/` directories (only node_modules contain specs from dependencies)
- No test scripts in `package.json`

**Assertion Library:** Not applicable

**Run Commands:** Not applicable

## Test Organization

**Current State:**
- Testing is not part of the codebase development workflow
- Quality assurance relies on manual testing, integration testing via live services, and type safety via TypeScript strict mode

## Testing Approach

Instead of unit tests, the codebase relies on:

1. **TypeScript Strict Mode** (`tsconfig.json` has `"strict": true`)
   - Type checking catches many errors at compile time
   - Examples:
     - `interface UserProfile { soulprint_text: string | null; }` enforces null-safety
     - Function parameters require explicit types: `async function embedQuery(text: string): Promise<number[]>`
     - Type unions enforce valid states: `import_status: 'none' | 'quick_ready' | 'processing' | 'complete' | 'failed'`

2. **Runtime Logging & Monitoring** (console-based)
   - Detailed console logs with scope prefixes track execution flow
   - Errors are logged immediately for debugging
   - Example from `lib/memory/query.ts`:
     ```typescript
     console.log(`[RLM] Found ${chunks.length} chunks across layers (Macro:${macroChunks.length}, Thematic:${thematicChunks.length}, Micro:${microChunks.length})`);
     ```
   - Search cache monitoring via `getSearchStats()` in `lib/search/smart-search.ts`

3. **Integration Testing with Live Services**
   - Code interacts directly with:
     - Supabase (vector DB, auth, storage)
     - AWS Bedrock (Claude model calls)
     - Cohere Embed v3 (via Bedrock)
     - Perplexity API (web search)
     - Tavily API (web search fallback)
   - Errors from these services are caught and logged
   - Fallback chains ensure graceful degradation (e.g., Tavily if Perplexity fails)

4. **Manual Testing Patterns**
   - Import flow tested via `app/api/debug/test-import/route.ts`
   - Chat endpoint tested with various message types
   - Admin endpoints in `app/api/admin/` provide manual intervention tools

## Error Handling as Testing

**Patterns in code that surface bugs:**

1. **Validation with Early Returns**
   ```typescript
   // app/api/import/process-server/route.ts
   if (!Array.isArray(rawConversations)) {
     throw new Error('Invalid file format. Expected a ChatGPT export (array of conversations).');
   }
   if (rawConversations.length === 0) {
     throw new Error('No conversations found in file.');
   }
   const hasValidChatGPTFormat = rawConversations.some((conv: any) =>
     conv && typeof conv === 'object' && conv.mapping && typeof conv.mapping === 'object'
   );
   if (!hasValidChatGPTFormat) {
     throw new Error("This doesn't look like a ChatGPT export...");
   }
   ```

2. **Null Safety Checks**
   ```typescript
   // app/api/chat/route.ts
   const { data: { user }, error: authError } = await supabase.auth.getUser();
   if (authError || !user) {
     return new Response(
       JSON.stringify({ error: 'Unauthorized' }),
       { status: 401, headers: { 'Content-Type': 'application/json' } }
     );
   }
   ```

3. **Optional Chaining & Fallbacks**
   ```typescript
   // app/api/chat/route.ts
   const textBlock = response.output?.message?.content?.find(
     (block): block is ContentBlock.TextMember => 'text' in block
   );
   const name = textBlock?.text?.trim().replace(/['"]/g, '') || 'Echo';
   ```

4. **Error Context Preservation**
   ```typescript
   // app/api/import/process-server/route.ts
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Processing failed';
     console.error('[ProcessServer] Error:', errorMessage);
     if (userId) {
       await adminSupabase.from('user_profiles').update({
         import_status: 'failed',
         import_error: errorMessage,
         updated_at: new Date().toISOString(),
       }).eq('user_id', userId);
     }
     return NextResponse.json({ error: errorMessage }, { status: 500 });
   }
   ```

## Test Scenarios (Manual)

**Import Flow:**
- Small ChatGPT export (JSON directly)
- Large ChatGPT export (ZIP with conversations.json)
- Invalid format (wrong JSON structure)
- Empty conversations
- Oversized files (>500MB)
- Network interruptions during download/upload

**Chat Flow:**
- First message (auto-generates AI name)
- Message with memory context (RLM retrieves chunks)
- Web search needed (Smart Search detects and performs)
- RLM service unavailable (fallback to Bedrock)
- Long conversation history (pagination)
- Concurrent messages (queue handling)

**Memory/Embedding:**
- Vector similarity search (returns top-k chunks)
- Layered search (macro/thematic/micro chunks)
- Keyword fallback when vector search fails
- Learned facts retrieval
- Rate limiting on searches

**Search Integration:**
- Cache hit detection
- Perplexity API call success
- Tavily fallback when Perplexity fails
- Both services unavailable (graceful degradation)
- Query normalization for cache keys
- Citation formatting

## What's Not Tested (Gaps)

- **Component behavior** - No React component tests
- **State management edge cases** - useState/useRef logic in `app/chat/page.tsx`
- **Concurrent operations** - Message queue processing under load
- **Database constraints** - Uniqueness, foreign key violations
- **Rate limiting under load** - 10 req/min per user behavior at scale
- **Memory limits** - Vercel 1GB RAM constraint with large ChatGPT exports
- **Authentication edge cases** - Session hijacking, token expiration

## Monitoring & Observability

**Built-in Debugging:**
- Health check endpoints: `app/api/chat/health/route.ts`, `app/api/health/supabase/route.ts`, `app/api/rlm/health/route.ts`
- Admin endpoints for manual testing: `app/api/admin/health/route.ts`, `app/api/admin/metrics/route.ts`
- Detailed console logging throughout request/response cycles

**What to Add for Better Testing:**
- Unit test framework (Jest or Vitest) for utility functions
- E2E tests for critical flows (import, chat, search)
- API contract testing (validate Supabase/Bedrock response shapes)
- Performance benchmarks (embedding latency, search speed)
- Load testing (concurrent users, concurrent uploads)

---

*Testing analysis: 2026-02-01*
