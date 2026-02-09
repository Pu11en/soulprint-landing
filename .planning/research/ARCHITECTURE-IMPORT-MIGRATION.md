# Architecture Research: Moving Import Processing to RLM

**Domain:** Serverless-to-Worker Architecture Migration
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

Moving import processing from Vercel serverless functions (1GB RAM, 300s timeout) to RLM service on Render eliminates memory and timeout constraints. The key insight: **Vercel becomes a thin proxy**, RLM owns the entire pipeline (download → parse → quick pass → chunk → embed → full pass), and progress flows back via polling or webhooks.

**Critical decisions:**
- RLM downloads from Supabase Storage using service role key (already proven in current code)
- Quick pass generation moves from Bedrock (Vercel) to RLM (can use Anthropic or Bedrock)
- Progress reporting via database polling (simple, works with current frontend)
- DAG traversal already implemented in RLM's conversation_chunker.py

## Current Architecture (Problematic)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│  Chunked Upload (XHR) → Supabase Storage                    │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌───────────────────────────────────────────────────────────────┐
│              VERCEL (Next.js Serverless)                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  /api/import/queue-processing (thin wrapper)                  │
│         ↓                                                      │
│  /api/import/process-server (HEAVY LIFTING — PROBLEM!)        │
│         ├─ Download ZIP from Storage                          │
│         ├─ Extract conversations.json                         │
│         ├─ Parse with Zod validation                          │
│         ├─ Generate quick pass (Bedrock Haiku 4.5)            │
│         ├─ Create multi-tier chunks                           │
│         ├─ Save to database                                   │
│         └─ Fire-and-forget to RLM /process-full               │
│                                                                │
│  Constraints:                                                  │
│  • 1GB RAM (practical limit ~500MB)                           │
│  • 300s timeout                                                │
│  • No streaming progress (must complete before response)      │
│                                                                │
└────────────────────────┬──────────────────────────────────────┘
                         ↓ (fire-and-forget)
┌───────────────────────────────────────────────────────────────┐
│                    RLM (Render Worker)                         │
├───────────────────────────────────────────────────────────────┤
│  /process-full                                                 │
│         ├─ Download raw JSON from Storage                     │
│         ├─ Chunk conversations (DAG traversal)                │
│         ├─ Extract facts (parallel Haiku)                     │
│         ├─ Generate MEMORY section                            │
│         └─ Regenerate v2 sections                             │
│                                                                │
│  Resources: No practical limits                               │
└───────────────────────────────────────────────────────────────┘
```

**Problem:** Steps inside `process-server` are ALL memory-intensive. Large exports (>500MB ZIP, >100MB JSON) fail with OOM or timeout. The quick pass generation alone can take 30-60s, leaving little time for everything else.

## Target Architecture (Bulletproof)

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│  Chunked Upload (XHR) → Supabase Storage                    │
│  Poll /api/import/status for progress                       │
└───────────────┬─────────────────────────────────────────────┘
                ↓
┌───────────────────────────────────────────────────────────────┐
│              VERCEL (Next.js Serverless)                       │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  /api/import/trigger (THIN PROXY — NEW!)                      │
│         ├─ Auth check                                          │
│         ├─ Set import_status = 'processing'                   │
│         └─ POST to RLM /import with storage_path              │
│                                                                │
│  /api/import/status (NEW!)                                    │
│         └─ Return user_profiles.{import_status, progress_%}   │
│                                                                │
│  Constraints: None (just proxying)                            │
│                                                                │
└────────────────────────┬──────────────────────────────────────┘
                         ↓ (HTTP POST with storage path)
┌───────────────────────────────────────────────────────────────┐
│                    RLM (Render Worker)                         │
├───────────────────────────────────────────────────────────────┤
│  POST /import (NEW ENDPOINT — ALL PROCESSING!)                │
│         ├─ Download from Supabase Storage (service role key)  │
│         ├─ Extract conversations.json from ZIP                │
│         ├─ Parse with DAG traversal (conversation_chunker.py) │
│         ├─ Generate quick pass (Anthropic Claude Haiku 4.5)   │
│         ├─ Create multi-tier chunks                           │
│         ├─ Save chunks to database                            │
│         ├─ Update progress in database (25%, 50%, 75%, 100%)  │
│         ├─ Extract facts (parallel)                           │
│         ├─ Generate MEMORY section                            │
│         └─ Regenerate v2 sections                             │
│                                                                │
│  Resources: No practical limits on Render                     │
│  Progress: Update user_profiles.progress_percent every stage  │
└───────────────────────────────────────────────────────────────┘
```

**Key changes:**
1. **Vercel does ZERO parsing** — just auth, store path, trigger RLM
2. **RLM owns entire pipeline** — from ZIP download to final sections
3. **Progress via database** — RLM updates `user_profiles.progress_percent`, frontend polls
4. **Quick pass moves to RLM** — uses Anthropic API (already configured)
5. **No fire-and-forget needed** — RLM endpoint returns 202 Accepted immediately, processes in background

## Component Responsibilities

| Component | Current Responsibility | New Responsibility |
|-----------|------------------------|-------------------|
| **Client (Browser)** | Upload ZIP via chunked XHR, wait for completion | Upload ZIP, poll status endpoint for progress |
| **Vercel /api/import/trigger** | N/A (new) | Auth check, mark as processing, POST to RLM with storage_path |
| **Vercel /api/import/status** | N/A (new) | Query user_profiles for {import_status, progress_percent, import_error} |
| **Vercel /api/import/process-server** | Download, parse, quick pass, chunk, save (DEPRECATED) | Remove completely |
| **RLM /import** | N/A (new) | Download from storage, parse, quick pass, chunk, embed, full pass, update progress |
| **RLM /process-full** | Full pass pipeline (facts + MEMORY) | Still used by /import internally after quick pass complete |
| **Supabase Storage** | Store uploaded files | Same — RLM downloads with service role key |
| **Supabase DB** | Store chunks, profiles | Same + add progress_percent column |

## Data Flow

### Upload Flow (Client → Vercel → Supabase)

```
User selects ZIP file
    ↓
Desktop: Extract conversations.json client-side (JSZip)
Mobile: Use full ZIP (avoid memory issues)
    ↓
Chunked XHR upload to Supabase Storage (direct, bypasses Vercel)
    ↓
Client polls /api/import/status every 2s for progress
```

**No change here** — current chunked upload works perfectly.

### Processing Flow (Vercel → RLM → Database)

```
Client calls POST /api/import/trigger { storagePath }
    ↓
Vercel /api/import/trigger:
    ├─ Auth check (getUser)
    ├─ Rate limit (expensive tier)
    ├─ Update DB: import_status = 'processing', progress_percent = 0
    └─ POST to RLM /import { user_id, storage_path }
    ↓
Return 202 Accepted to client immediately
    ↓
RLM /import (background task):
    ├─ Stage 1: Download & Parse (0% → 20%)
    │   ├─ Download from storage: GET /storage/v1/object/{path}
    │   ├─ Extract conversations.json if ZIP
    │   ├─ Parse JSON (handle both raw ChatGPT format and pre-parsed)
    │   └─ Update DB: progress_percent = 20
    │
    ├─ Stage 2: Quick Pass (20% → 40%)
    │   ├─ Sample richest conversations (existing logic)
    │   ├─ Generate 5 sections via Anthropic Haiku 4.5
    │   ├─ Save soul_md, identity_md, user_md, agents_md, tools_md
    │   └─ Update DB: progress_percent = 40, import_status = 'quick_ready'
    │
    ├─ Stage 3: Chunking (40% → 60%)
    │   ├─ Chunk conversations (DAG traversal, already implemented)
    │   ├─ Save chunks to database (batch inserts)
    │   └─ Update DB: progress_percent = 60
    │
    ├─ Stage 4: Full Pass (60% → 100%)
    │   ├─ Extract facts (parallel Haiku)
    │   ├─ Generate MEMORY section
    │   ├─ Regenerate v2 sections
    │   └─ Update DB: progress_percent = 100, import_status = 'complete'
    │
    └─ On error: Set import_status = 'failed', import_error = message
```

### Progress Reporting Flow (RLM → Database → Client)

```
RLM updates database:
    user_profiles.progress_percent = 20 (or 40, 60, 100)
    ↓
Client polls every 2s:
    GET /api/import/status → { status: 'processing', progress: 20 }
    ↓
Display progress bar: "Downloading conversations... 20%"
```

**Why polling instead of websockets/SSE:**
- Simple, works with existing frontend polling (already implemented)
- No need for WebSocket infrastructure on Vercel or RLM
- 2s poll interval is acceptable latency for import (takes minutes)
- Vercel serverless functions don't maintain connections anyway

## Integration Points

### 1. Supabase Storage Access (RLM → Supabase)

**Pattern:** HTTP GET with service role key

```python
# RLM downloads from storage (already implemented in main.py)
async def download_from_storage(storage_path: str) -> bytes:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SUPABASE_URL}/storage/v1/object/{storage_path}",
            headers={
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
        )

        if response.status_code != 200:
            raise Exception(f"Storage download failed: {response.text}")

        return response.content
```

**Config:** RLM already has `SUPABASE_SERVICE_KEY` in environment.

**Storage path format:**
- Client uploads to: `imports/{user_id}/{timestamp}-conversations.json`
- Vercel passes: `imports/{user_id}/{timestamp}-conversations.json`
- RLM downloads: `{SUPABASE_URL}/storage/v1/object/imports/{user_id}/{timestamp}-conversations.json`

### 2. Quick Pass Generation (RLM → Anthropic)

**Current:** Vercel calls Bedrock Haiku 4.5 (AWS SDK)
**Target:** RLM calls Anthropic Haiku 4.5 (Anthropic SDK)

```python
# RLM already has Anthropic client initialized
import anthropic

client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def generate_quick_pass(conversations: list) -> dict:
    """
    Sample conversations, format prompt, call Haiku 4.5.
    Returns 5 sections: soul, identity, user, agents, tools
    """
    # Sample richest conversations (port from lib/soulprint/sample.ts)
    sampled = sample_conversations(conversations)

    # Format as readable text (port from lib/soulprint/sample.ts)
    formatted_text = format_conversations_for_prompt(sampled)

    # Call Haiku with quick pass prompt (port from lib/soulprint/prompts.ts)
    response = await client.messages.create(
        model="claude-haiku-4-20250514",
        max_tokens=8192,
        temperature=0.7,
        system=QUICK_PASS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": formatted_text}],
    )

    # Parse JSON response (already structured)
    return json.loads(response.content[0].text)
```

**Port required:**
- `lib/soulprint/sample.ts` → `rlm-service/processors/quick_pass.py`
- `lib/soulprint/prompts.ts` → `rlm-service/processors/quick_pass.py`
- Zod schema validation → Python dataclass or Pydantic validation

### 3. Progress Updates (RLM → Supabase DB)

**Pattern:** HTTP PATCH to user_profiles table

```python
# Already implemented in main.py as update_user_profile
async def update_user_profile(user_id: str, updates: dict):
    async with httpx.AsyncClient() as client:
        response = await client.patch(
            f"{SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.{user_id}",
            json=updates,
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
```

**Schema change needed:**
```sql
ALTER TABLE user_profiles
ADD COLUMN progress_percent INTEGER DEFAULT 0;
```

**Progress milestones:**
- 0% - Processing started
- 20% - Download & parse complete
- 40% - Quick pass complete
- 60% - Chunking complete
- 100% - Full pass complete

### 4. Status Polling (Client → Vercel → Supabase)

**New endpoint:** `/api/import/status`

```typescript
// app/api/import/status/route.ts
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('import_status, progress_percent, import_error')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    status: profile?.import_status || 'none',
    progress: profile?.progress_percent || 0,
    error: profile?.import_error,
  });
}
```

**Client polling:**
```typescript
// app/import/page.tsx (already has polling logic)
const pollInterval = setInterval(async () => {
  const res = await fetch('/api/import/status');
  const data = await res.json();

  setProgress(data.progress);

  if (data.status === 'complete') {
    clearInterval(pollInterval);
    router.push('/chat');
  } else if (data.status === 'failed') {
    clearInterval(pollInterval);
    setErrorMessage(data.error);
  }
}, 2000); // Poll every 2s
```

## New Components

### 1. `/api/import/trigger` (Vercel)

**Purpose:** Thin proxy to trigger RLM processing
**Input:** `{ storagePath: string }`
**Output:** `{ status: 'processing' }` (202 Accepted)

```typescript
// app/api/import/trigger/route.ts
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const rateLimited = await checkRateLimit(user.id, 'expensive');
  if (rateLimited) return rateLimited;

  const { storagePath } = await request.json();

  // Mark as processing
  await supabase.from('user_profiles').upsert({
    user_id: user.id,
    import_status: 'processing',
    progress_percent: 0,
    import_error: null,
    processing_started_at: new Date().toISOString(),
  });

  // Trigger RLM (fire-and-forget is OK here — RLM handles everything)
  const rlmUrl = process.env.RLM_API_URL || 'https://soulprint-landing.onrender.com';

  fetch(`${rlmUrl}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      storage_path: storagePath,
    }),
  }).catch(err => {
    console.error('[Trigger] RLM call failed:', err);
    // Don't await — if RLM is down, user will see stuck processing and can retry
  });

  return NextResponse.json({ status: 'processing' }, { status: 202 });
}
```

### 2. `/api/import/status` (Vercel)

See Integration Point #4 above.

### 3. `POST /import` (RLM)

**Purpose:** Main import orchestrator (replaces process-server completely)

```python
# rlm-service/main.py
@app.post("/import")
async def import_conversations(request: ImportRequest, background_tasks: BackgroundTasks):
    """
    Accept import job and dispatch to background task.
    Returns 202 Accepted immediately.
    """
    background_tasks.add_task(run_import_pipeline, request)

    return {
        "status": "accepted",
        "message": "Import processing started",
    }


async def run_import_pipeline(request: ImportRequest):
    """
    Complete import pipeline:
    1. Download & parse (0% → 20%)
    2. Quick pass (20% → 40%)
    3. Chunk & save (40% → 60%)
    4. Full pass (60% → 100%)
    """
    try:
        # Stage 1: Download & Parse
        await update_user_profile(request.user_id, {"progress_percent": 0})

        conversations = await download_and_parse(request.storage_path)

        await update_user_profile(request.user_id, {"progress_percent": 20})

        # Stage 2: Quick Pass
        quick_pass_result = await generate_quick_pass(conversations)

        await update_user_profile(request.user_id, {
            "progress_percent": 40,
            "import_status": "quick_ready",
            "soul_md": json.dumps(quick_pass_result["soul"]),
            "identity_md": json.dumps(quick_pass_result["identity"]),
            "user_md": json.dumps(quick_pass_result["user"]),
            "agents_md": json.dumps(quick_pass_result["agents"]),
            "tools_md": json.dumps(quick_pass_result["tools"]),
        })

        # Stage 3: Chunk & Save
        chunks = chunk_conversations(conversations)
        await save_chunks_batch(request.user_id, chunks)

        await update_user_profile(request.user_id, {"progress_percent": 60})

        # Stage 4: Full Pass (existing pipeline)
        from processors.full_pass import run_full_pass_pipeline

        # Store raw conversations for full pass (same as current process-server)
        storage_path = await store_raw_conversations(request.user_id, conversations)

        await run_full_pass_pipeline(
            user_id=request.user_id,
            storage_path=storage_path,
            conversation_count=len(conversations),
        )

        await update_user_profile(request.user_id, {
            "progress_percent": 100,
            "import_status": "complete",
        })

    except Exception as e:
        await update_user_profile(request.user_id, {
            "import_status": "failed",
            "import_error": str(e)[:500],
        })
```

## Modified Components

### 1. `app/import/page.tsx`

**Changes:**
- Replace `fetch('/api/import/queue-processing')` with `fetch('/api/import/trigger')`
- Poll `fetch('/api/import/status')` every 2s instead of fake progress animation
- Update progress bar from real `progress_percent` value

**Minimal diff:**
```typescript
// OLD:
const queueRes = await fetch('/api/import/queue-processing', {
  method: 'POST',
  body: JSON.stringify({ storagePath, filename, fileSize }),
});

// NEW:
const triggerRes = await fetch('/api/import/trigger', {
  method: 'POST',
  body: JSON.stringify({ storagePath }),
});

// OLD: Fake progress animation
progressIntervalRef.current = setInterval(() => {
  currentProgress = Math.min(currentProgress + 0.5, 95);
  setProgress(Math.round(currentProgress));
}, 1000);

// NEW: Poll real progress
progressIntervalRef.current = setInterval(async () => {
  const statusRes = await fetch('/api/import/status');
  const statusData = await statusRes.json();

  setProgress(statusData.progress);

  if (statusData.status === 'complete') {
    clearInterval(progressIntervalRef.current);
    router.push('/chat');
  } else if (statusData.status === 'failed') {
    clearInterval(progressIntervalRef.current);
    setErrorMessage(statusData.error);
    setStatus('error');
  }
}, 2000);
```

### 2. `rlm-service/processors/conversation_chunker.py`

**No changes needed** — DAG traversal already implemented (lines 71-116).

### 3. `rlm-service/main.py`

**Changes:**
- Add `POST /import` endpoint (new)
- Add `run_import_pipeline` function (new)
- Port quick pass generation from Vercel (new helper functions)

## Deprecated Components

### 1. `/api/import/process-server` (Vercel)

**Action:** Delete completely after migration complete.

**Reason:** All processing moved to RLM. Keeping this endpoint creates confusion and maintenance burden.

### 2. `/api/import/queue-processing` (Vercel)

**Action:** Delete or redirect to `/api/import/trigger` with deprecation warning.

## Build Order

### Phase 1: Foundation (No User Impact)

**Goal:** Set up new endpoints without breaking existing flow.

1. **Database schema change:**
   ```sql
   ALTER TABLE user_profiles ADD COLUMN progress_percent INTEGER DEFAULT 0;
   ```

2. **Create `/api/import/status` (Vercel):**
   - Returns current import_status and progress_percent
   - Test with existing users (should return 0% for old imports)

3. **Create RLM helpers (no endpoints yet):**
   - Port `lib/soulprint/sample.ts` → `rlm-service/processors/quick_pass.py`
   - Port `lib/soulprint/prompts.ts` → `rlm-service/processors/quick_pass.py`
   - Test quick pass generation with sample data

**Validation:** Existing imports still work, new endpoints don't break anything.

### Phase 2: RLM Pipeline (Parallel Path)

**Goal:** Build complete RLM pipeline, test independently.

4. **Create `POST /import` endpoint (RLM):**
   - Download from storage
   - Parse conversations (reuse conversation_chunker logic)
   - Generate quick pass (use ported helpers)
   - Chunk and save
   - Call existing full_pass_pipeline
   - Update progress at each stage

5. **Test RLM pipeline end-to-end:**
   - Manual POST to `/import` with test user
   - Verify progress updates in database
   - Verify quick pass sections saved correctly
   - Verify chunks created
   - Verify full pass completes

**Validation:** RLM pipeline works independently, doesn't affect production.

### Phase 3: Frontend Switch (Feature Flag)

**Goal:** Route new imports through RLM, keep old path as fallback.

6. **Create `/api/import/trigger` (Vercel):**
   - Thin proxy to RLM
   - Returns 202 Accepted immediately

7. **Update `app/import/page.tsx`:**
   - Add feature flag: `USE_RLM_IMPORT` environment variable
   - If enabled: call `/api/import/trigger` + poll `/api/import/status`
   - If disabled: use old `/api/import/queue-processing` path
   - Update progress bar to use real progress_percent

8. **Deploy with `USE_RLM_IMPORT=false`:**
   - All users still use old path
   - New code exists but inactive

**Validation:** No user-visible changes, feature flag works.

### Phase 4: Gradual Rollout

**Goal:** Test RLM path with increasing traffic.

9. **Enable for 10% of users:**
   ```typescript
   const USE_RLM_IMPORT = Math.random() < 0.1;
   ```
   - Monitor error rates, completion times
   - Check for stuck imports (>15min processing)

10. **Increase to 50%, then 100%:**
    - Iterate based on monitoring
    - Fix issues before full rollout

**Validation:** RLM path handles production load, no regressions.

### Phase 5: Cleanup

**Goal:** Remove old code, simplify architecture.

11. **Delete deprecated endpoints:**
    - `/api/import/process-server`
    - `/api/import/queue-processing`

12. **Remove feature flag:**
    - Hard-code RLM path in frontend

13. **Delete unused libs:**
    - `lib/soulprint/quick-pass.ts` (moved to RLM)
    - Bedrock imports from Vercel

**Validation:** Cleaner codebase, single path for imports.

## Scaling Considerations

| Scale | Bottleneck | Mitigation |
|-------|------------|------------|
| 0-100 users/day | None | RLM on Render Standard ($21/mo) handles this easily |
| 100-1000 users/day | RLM concurrency | Background task queue (already using FastAPI BackgroundTasks) |
| 1000+ users/day | Database writes | Batch inserts (already implemented in full_pass.py) |
| 10K+ users/day | Supabase API rate limits | Add retry logic with exponential backoff |

**Current setup sufficient for:**
- 100 imports/day = ~1 every 15 min (RLM easily handles)
- Each import takes 2-5 minutes (no timeout issues)
- RLM can process multiple imports concurrently (FastAPI async)

**When to scale RLM:**
- If >10 concurrent imports are common
- Solution: Scale Render instance to larger size or multiple workers

## Anti-Patterns to Avoid

### Anti-Pattern 1: Websockets for Progress

**What people do:** Set up WebSocket connection from client → Vercel → RLM for real-time progress.

**Why it's wrong:**
- Vercel serverless functions don't maintain connections
- Requires complex infrastructure (Redis pub/sub, etc.)
- Overkill for import (takes minutes, not milliseconds)

**Do this instead:** Database polling every 2s is simple and sufficient.

### Anti-Pattern 2: Synchronous RLM Call

**What people do:** Vercel calls RLM and awaits full pipeline completion.

**Why it's wrong:**
- Vercel timeout (300s) still applies
- User must keep page open entire time
- No progress reporting

**Do this instead:** Fire-and-forget to RLM, poll for status.

### Anti-Pattern 3: Duplicate Parsing

**What people do:** Vercel parses conversations, sends to RLM, RLM parses again.

**Why it's wrong:**
- Wastes memory on Vercel
- Duplicates work
- Increases latency

**Do this instead:** Vercel only handles auth and triggers RLM with storage_path. RLM does all parsing.

### Anti-Pattern 4: Quick Pass in Both Places

**What people do:** Generate quick pass in Vercel (for immediate chat access), then regenerate in RLM (for full pass).

**Why it's wrong:**
- Costs 2x AI API calls
- Quick pass quality inconsistent between v1 and v2
- Adds complexity

**Do this instead:** RLM generates quick pass once. User waits 20-40s for quick pass, then can chat immediately while full pass continues.

## Error Handling & Resilience

### RLM Unavailable

**Scenario:** RLM service is down or slow to respond.

**Detection:**
- Vercel `/api/import/trigger` has 10s timeout on POST to RLM
- If timeout or error, mark import as failed immediately

**Recovery:**
- User sees error: "Processing service unavailable. Please try again."
- Retry button triggers new upload + trigger

### Import Stuck

**Scenario:** RLM crashes mid-processing, progress stops.

**Detection:**
- Frontend detects `processing_started_at` >15min with no progress
- Shows "Import stuck" warning

**Recovery:**
- User can re-import (duplicate guard allows retry after 15min)
- RLM restart picks up from database state

### Storage Download Fails

**Scenario:** Supabase Storage returns 404 or 500.

**Detection:**
- RLM catches exception in download_from_storage

**Recovery:**
- Update user_profiles: `import_status = 'failed'`, `import_error = 'File not found'`
- User sees error, can re-upload

### Quick Pass Fails

**Scenario:** Anthropic API error or malformed response.

**Detection:**
- RLM catches exception in generate_quick_pass

**Recovery:**
- Skip quick pass, proceed with empty sections
- Full pass will regenerate sections later
- User can still chat (with generic AI name and placeholder text)

## Sources

**HIGH Confidence (Direct Code Inspection):**
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/main.py` - RLM service structure, Supabase integration patterns
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/full_pass.py` - Background task pattern, progress updates
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/conversation_chunker.py` - DAG traversal already implemented
- `/home/drewpullen/clawd/soulprint-landing/app/api/import/process-server/route.ts` - Current problematic architecture
- `/home/drewpullen/clawd/soulprint-landing/app/import/page.tsx` - Frontend upload and polling patterns

**MEDIUM Confidence (Environment Knowledge):**
- Vercel serverless constraints (1GB RAM, 300s timeout) - standard platform limits
- Render worker capabilities - no practical limits for this workload
- Supabase Storage API - standard REST API with service role key auth
- FastAPI BackgroundTasks - standard async task handling

**Architectural Patterns:**
- Thin proxy pattern (Vercel → RLM) - common serverless-to-worker migration
- Database polling for progress - simpler than WebSockets for long-running tasks
- Fire-and-forget with status polling - standard async job pattern

---
*Architecture research for: Moving Import Processing to RLM*
*Researched: 2026-02-09*
