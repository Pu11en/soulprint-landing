# Architecture Research: RLM Production Sync

**Domain:** Python FastAPI monolith refactoring to modular architecture
**Researched:** 2026-02-06
**Confidence:** HIGH

## Integration Challenge: v1.2 Processors → 3600-Line Production Monolith

### Current State

**Production (soulprint-rlm/):**
- 3603-line `main.py` (single file)
- 14+ FastAPI endpoints
- Background tasks via `FastAPI.BackgroundTasks`
- Supabase REST API via httpx (all DB operations inline)
- AWS Bedrock for embeddings + chat models
- Job recovery system (`processing_jobs` table, resume on startup)
- Vercel callback for email notification
- Dockerfile: `COPY main.py .` (single file deployment)

**v1.2 (soulprint-landing/rlm-service/):**
- 355-line `main.py` + `processors/` directory
- 5 processor modules (249-363 lines each):
  - `conversation_chunker.py` - Splits conversations into ~2000 token segments
  - `fact_extractor.py` - Parallel extraction via Claude Haiku 4.5
  - `memory_generator.py` - Creates MEMORY section from facts
  - `v2_regenerator.py` - Regenerates 5 SoulPrint sections
  - `full_pass.py` - Orchestrates the pipeline
- Each processor is standalone with own Anthropic client
- `full_pass.py` imports from `main.py`:
  ```python
  from main import download_conversations  # Line 140
  from main import update_user_profile     # Line 185
  ```

### Import Incompatibility (Critical Blocker)

**Problem:** v1.2's `full_pass.py` imports don't exist in production `main.py`.

1. **`download_conversations()` signature mismatch:**
   - v1.2 expects: `async def download_conversations(storage_path: str) -> list`
   - Production has inline code in `process_full_background()` (lines 2507-2517) but NO standalone function

2. **`update_user_profile()` doesn't exist as standalone:**
   - v1.2 expects: `async def update_user_profile(user_id: str, updates: dict)`
   - Production only has inline PATCH calls scattered throughout (lines 2497-2501, 2734-2744, etc.)

**Consequence:** Direct copy-paste of `processors/` into production will fail at import time.

---

## Recommended Architecture: Adapter Layer Pattern

### Overview

Insert an **adapter layer** between v1.2 processors and production monolith. This isolates the modular processors from the monolith's internal structure, allowing incremental migration.

```
┌─────────────────────────────────────────────────────────────┐
│                     FastAPI Endpoints                        │
│  /process-full, /chat, /query, /process-import, etc.        │
├─────────────────────────────────────────────────────────────┤
│                      Background Tasks                        │
│  process_full_background(), complete_embeddings_background() │
├─────────────────────────────────────────────────────────────┤
│                      Adapter Layer (NEW)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ adapters/supabase_adapter.py                        │    │
│  │  - download_conversations(storage_path)             │    │
│  │  - update_user_profile(user_id, updates)            │    │
│  │  - save_chunks_batch(user_id, chunks)               │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Processor Modules (v1.2)                  │
│  ┌───────────────┐  ┌─────────────┐  ┌──────────────┐      │
│  │ conversation_ │  │ fact_       │  │ memory_      │      │
│  │ chunker.py    │  │ extractor.py│  │ generator.py │      │
│  └───────────────┘  └─────────────┘  └──────────────┘      │
│  ┌───────────────┐  ┌─────────────┐                        │
│  │ v2_           │  │ full_pass.py│                        │
│  │ regenerator.py│  │ (orchestr.) │                        │
│  └───────────────┘  └─────────────┘                        │
├─────────────────────────────────────────────────────────────┤
│                   Production Monolith Code                   │
│  Supabase httpx calls, AWS Bedrock, job recovery, etc.      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|---------------|----------------|
| **Adapter Layer** | Provides clean interface for processors to interact with production systems | New file: `adapters/supabase_adapter.py` wraps existing httpx calls |
| **Processors** | Business logic for chunking, fact extraction, memory generation | Copy from v1.2, modify imports to use adapter |
| **Background Tasks** | Orchestrate pipeline execution, job recovery, progress tracking | Keep existing production code, call processors via adapter |
| **FastAPI Endpoints** | HTTP interface, request validation, background task dispatch | Keep existing, wire new pipeline as option |

---

## Integration Strategy: Three Options Analyzed

### Option 1: Adapter Layer (RECOMMENDED)

**What:** Create `adapters/supabase_adapter.py` that extracts production's inline Supabase calls into reusable functions.

**Pros:**
- Minimal risk - production code stays intact
- Processors remain standalone and testable
- Clear separation: processors = business logic, adapter = infrastructure
- Easy to swap adapter implementation later (e.g., for testing)
- Aligns with FastAPI dependency injection best practices

**Cons:**
- Adds one layer of indirection
- Adapter file needs maintenance as Supabase schema evolves

**Implementation:**
```python
# adapters/supabase_adapter.py
import httpx
import gzip
import json
from typing import List, Dict

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

async def download_conversations(storage_path: str) -> list:
    """Download conversations.json from Supabase Storage (extracted from line 2507-2540)"""
    path_parts = storage_path.split("/", 1)
    bucket = path_parts[0]
    file_path = path_parts[1] if len(path_parts) > 1 else ""

    download_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}"

    async with httpx.AsyncClient(timeout=300.0) as client:
        response = await client.get(
            download_url,
            headers={"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
        )
        if response.status_code != 200:
            raise Exception(f"Storage download failed: {response.status_code}")

        content = response.content
        try:
            content = gzip.decompress(content)
        except Exception:
            pass  # Not gzipped

        return json.loads(content)

async def update_user_profile(user_id: str, updates: dict):
    """Update user_profiles table (extracted from inline PATCH calls)"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }
        await client.patch(
            f"{SUPABASE_URL}/rest/v1/user_profiles",
            params={"user_id": f"eq.{user_id}"},
            headers=headers,
            json=updates,
        )

async def save_chunks_batch(user_id: str, chunks: List[dict]):
    """Save conversation chunks (from v1.2's full_pass.py)"""
    # Implementation mirrors v1.2's save_chunks_batch
    ...
```

**Modify v1.2 processors:**
```python
# processors/full_pass.py
from adapters.supabase_adapter import download_conversations, update_user_profile

# Rest of file unchanged
```

**Integration point:**
```python
# main.py - wire into existing endpoint
@app.post("/process-full-v2")
async def process_full_v2(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    """NEW endpoint using v1.2 pipeline"""
    background_tasks.add_task(run_full_pass_v2, request)
    return {"status": "accepted", "pipeline": "v1.2"}

async def run_full_pass_v2(request: ProcessFullRequest):
    """Background task using v1.2 processors"""
    from processors.full_pass import run_full_pass_pipeline
    await run_full_pass_pipeline(
        user_id=request.user_id,
        storage_path=request.storage_path,
        conversation_count=request.conversation_count,
    )
```

---

### Option 2: Inline Extraction (Refactor Monolith First)

**What:** Extract `download_conversations()` and `update_user_profile()` as standalone functions in production `main.py`, then import processors.

**Pros:**
- No new files (adapter layer)
- Production monolith becomes slightly more modular

**Cons:**
- HIGH RISK - modifying 3603-line monolith before testing processors
- Harder to rollback if processors have bugs
- Doesn't address future modularity (still importing from main.py)
- Violates "separate concerns" principle (processors know about main.py)

**NOT RECOMMENDED** - refactor monolith AFTER processors proven in production.

---

### Option 3: Processors Import Adapter, Adapter Imports Main

**What:** Processors import adapter, adapter imports from production `main.py` (after extracting functions).

**Pros:**
- Clear dependency chain: processors → adapter → main
- Processors stay decoupled from main.py internals

**Cons:**
- Still requires refactoring monolith first (same risk as Option 2)
- Circular dependency risk if main.py tries to import processors

**Verdict:** Good long-term, but requires Option 2's risky refactor first. Do Option 1, migrate to Option 3 later.

---

## Recommended Build Order (Safe Merge Strategy)

### Phase 1: Create Adapter Layer
**Goal:** Provide clean interface without touching production logic.

1. Create `adapters/` directory
2. Create `adapters/supabase_adapter.py` with functions extracted from production inline code:
   - `download_conversations(storage_path: str) -> list`
   - `update_user_profile(user_id: str, updates: dict)`
   - `save_chunks_batch(user_id: str, chunks: List[dict])`
3. Test adapter functions in isolation (unit tests with mocked httpx)

**Deliverable:** `adapters/supabase_adapter.py` with 100% test coverage

---

### Phase 2: Copy v1.2 Processors
**Goal:** Get processors into production repo, modify imports.

1. Create `processors/` directory
2. Copy all 5 processor files from v1.2:
   - `conversation_chunker.py`
   - `fact_extractor.py`
   - `memory_generator.py`
   - `v2_regenerator.py`
   - `full_pass.py`
3. Modify `full_pass.py` imports:
   ```python
   # OLD (v1.2)
   from main import download_conversations, update_user_profile

   # NEW (production)
   from adapters.supabase_adapter import download_conversations, update_user_profile
   ```
4. Test processors in isolation (with mocked adapter)

**Deliverable:** `processors/` directory with modified imports

---

### Phase 3: Wire New Endpoint
**Goal:** Add parallel endpoint for v1.2 pipeline without touching existing endpoints.

1. Add new endpoint `/process-full-v2` (or rename existing to `/process-full-v1`, new as `/process-full`)
2. Create background task `run_full_pass_v2()` that calls `processors.full_pass.run_full_pass_pipeline()`
3. Keep existing `/process-full` endpoint using old monolithic code
4. Test v2 endpoint with canary user (manual trigger)

**Deliverable:** Two parallel pipelines (v1 monolith, v2 modular) both functional

---

### Phase 4: Gradual Cutover
**Goal:** Shift traffic from v1 to v2, monitor for issues.

1. Route 10% of users to v2 pipeline (feature flag or user_id % 10)
2. Monitor error rates, processing times, completion rates
3. If stable for 48 hours, increase to 50%
4. If stable for 7 days, increase to 100%
5. Deprecate v1 endpoint after 30 days of 100% v2

**Deliverable:** v2 pipeline handling 100% of production traffic

---

### Phase 5: Clean Up Monolith (LATER)
**Goal:** Extract remaining monolithic code into modules.

1. Extract embedding logic into `processors/embedder.py`
2. Extract SoulPrint generation into `processors/soulprint_generator.py`
3. Move adapter functions into production `main.py` as standalone functions
4. Processors import from `main.py` directly (Option 3 approach)

**Deliverable:** Modular monolith with clean component boundaries

---

## Dockerfile Changes

### Current Dockerfile
```dockerfile
# Production
COPY main.py .
```

### New Dockerfile (Phase 2+)
```dockerfile
# Production after processors added
COPY main.py .
COPY adapters/ ./adapters/
COPY processors/ ./processors/
```

**Impact:** Image size increases ~150KB (5 processor files + adapter). Negligible.

---

## Integration Points with Existing Production

### 1. Job Recovery System
**Production has:** `processing_jobs` table with resume-on-startup logic (lines 56-168)

**Integration:** v1.2 pipeline respects existing job tracking.
```python
# In run_full_pass_v2()
if job_id:
    await update_job(job_id, status="processing", current_step="chunking", progress=10)
# ... processors run ...
await complete_job(job_id, success=True)
```

**No changes needed** - job recovery system is agnostic to which pipeline runs.

---

### 2. Vercel Callback (Email Notification)
**Production has:** Hardcoded callback to `https://www.soulprintengine.ai` (line 192)

**Integration:** v1.2 pipeline triggers same callback after completion.
```python
# After full_pass.py completes
async with httpx.AsyncClient() as client:
    await client.post(
        f"{VERCEL_API_URL}/api/import/complete",
        headers={"Authorization": f"Bearer {RLM_API_KEY}"},
        json={"user_id": user_id, "status": "complete"}
    )
```

**No changes needed** - callback is environment variable, same for both pipelines.

---

### 3. Background Task Pattern
**Production uses:** `FastAPI.BackgroundTasks` for fire-and-forget processing

**v1.2 uses:** Same pattern in 355-line `main.py`

**Integration:** Perfect alignment - no architectural mismatch.
```python
# Both use identical pattern
background_tasks.add_task(run_full_pass_v2, request)
```

**No changes needed** - background task infrastructure already exists.

---

### 4. AWS Bedrock Client Sharing
**Production has:** Global `get_bedrock_client()` function (line 258-275)

**v1.2 has:** Each processor creates own `anthropic.AsyncAnthropic()` client

**Integration challenge:** Processors use Anthropic API directly, production uses AWS Bedrock wrapper.

**Solution:** Dependency injection via adapter.
```python
# adapters/supabase_adapter.py
def get_anthropic_client():
    """Returns Bedrock-backed client for production, direct client for v1.2"""
    if USE_BEDROCK_CLAUDE:
        # Return wrapper that routes to bedrock_claude_message()
        return BedrockAnthropicAdapter()
    else:
        return anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
```

**Changes needed:** Pass client to processors instead of hardcoding.
```python
# processors/full_pass.py
async def run_full_pass_pipeline(user_id, storage_path, anthropic_client=None):
    if not anthropic_client:
        from adapters.supabase_adapter import get_anthropic_client
        anthropic_client = get_anthropic_client()
    # ... rest of pipeline uses anthropic_client
```

---

## Data Flow: v1.2 Pipeline in Production

### Request Flow
```
POST /process-full-v2 (user_id, storage_path, conversation_count)
    ↓
[FastAPI validates request]
    ↓
background_tasks.add_task(run_full_pass_v2, request)
    ↓
[Return 202 Accepted immediately]
```

### Background Processing Flow
```
run_full_pass_v2(request)
    ↓
processors.full_pass.run_full_pass_pipeline(user_id, storage_path, conversation_count)
    ↓
┌─────────────────────────────────────────────────┐
│ Step 1: Download conversations                  │
│ adapters.supabase_adapter.download_conversations│
│ → httpx GET from Supabase Storage               │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 2: Chunk conversations                     │
│ processors.conversation_chunker.chunk_convos    │
│ → Returns List[dict] (2000 token chunks)        │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 3: Save chunks to DB                       │
│ adapters.supabase_adapter.save_chunks_batch     │
│ → httpx POST to conversation_chunks table       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 4: Extract facts (parallel)                │
│ processors.fact_extractor.extract_facts_parallel│
│ → Calls Claude Haiku 4.5 for each chunk         │
│ → Returns consolidated fact dict                │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 5: Generate MEMORY section                 │
│ processors.memory_generator.generate_memory     │
│ → Calls Claude Haiku 4.5 with consolidated facts│
│ → Returns markdown string                       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 6: Save MEMORY to DB                       │
│ adapters.supabase_adapter.update_user_profile   │
│ → httpx PATCH user_profiles.memory_md           │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 7: V2 Section Regeneration                 │
│ processors.v2_regenerator.regenerate_sections_v2│
│ → Calls Claude with top 200 convos + MEMORY     │
│ → Returns 5 sections (soul, identity, etc.)     │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 8: Save all sections to DB                 │
│ adapters.supabase_adapter.update_user_profile   │
│ → httpx PATCH user_profiles (6 fields)          │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ Step 9: Notify Vercel (triggers email)          │
│ httpx POST to VERCEL_API_URL/api/import/complete│
└─────────────────────────────────────────────────┘
```

---

## Architectural Patterns Applied

### 1. Adapter Pattern (Core Pattern)
**Source:** Extracted from production inline code → clean interface for processors

**Why:** Decouples processors from Supabase implementation details. Processors don't know about httpx, headers, or URL construction.

**Reference:** [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/) - adapter functions become injectable dependencies

---

### 2. Service Layer Pattern
**Source:** Processors = business logic, Adapter = infrastructure

**Why:** Separates "what to do" (processors) from "how to do it" (adapter). Makes testing easier.

**Reference:** [FastAPI Best Practices - Service Layer](https://github.com/zhanymkanov/fastapi-best-practices#1-project-structure-consistent--predictable) - business logic separated from endpoints

---

### 3. Modular Monolith
**Source:** Production stays single deployment artifact, but internally modular

**Why:** Gets benefits of modularity (testability, maintainability) without microservices complexity.

**Reference:** [Modular Monolith in Python](https://breadcrumbscollector.tech/modular-monolith-in-python/) - modules communicate through interfaces, not direct imports

---

### 4. Parallel Deployment (Strangler Fig)
**Source:** v1 and v2 pipelines coexist, gradual cutover

**Why:** De-risks migration. Can rollback to v1 instantly if v2 has issues.

**Reference:** [Refactoring Old Monolith Architecture](https://medium.com/insiderengineering/refactoring-old-monolith-architecture-a-comprehensive-guide-7c192d7612e8) - incremental migration strategy

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Main Imports
**What people do:** `from main import download_conversations` in processors

**Why it's wrong:** Tight coupling - processors can't be tested without full main.py. Circular dependency risk.

**Do this instead:** Use adapter layer - processors import from `adapters.supabase_adapter`

---

### Anti-Pattern 2: Big Bang Refactor
**What people do:** Refactor entire 3603-line main.py before testing processors

**Why it's wrong:** High risk - if processors have bugs, can't separate "refactor bugs" from "processor bugs"

**Do this instead:** Adapter layer first, processors second, refactor monolith LAST after v2 proven stable

---

### Anti-Pattern 3: Processors Create Own Clients
**What people do:** Each processor creates `anthropic.AsyncAnthropic()` inside function

**Why it's wrong:** Can't control which backend (Bedrock vs direct API), can't mock for testing

**Do this instead:** Dependency injection - pass `anthropic_client` as parameter, create in adapter

---

### Anti-Pattern 4: Global State Sharing
**What people do:** Processors read from global variables (e.g., `SUPABASE_URL`)

**Why it's wrong:** Hard to test, environment-dependent, can't override per-request

**Do this instead:** Dependency injection - adapter reads env vars, processors receive configured clients

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1000 users | Adapter layer sufficient - monolith handles load |
| 1K-10K users | Consider separating embedding worker from main API (separate Render service) |
| 10K-100K users | Separate background workers (Celery/ARQ + Redis), async job queue |
| 100K+ users | Split into microservices - processors become standalone service, adapter becomes API client |

### Scaling Priorities

1. **First bottleneck:** Background task queue (FastAPI.BackgroundTasks has no persistence)
   - **Fix:** Migrate to ARQ (async Redis queue) - integrates seamlessly with FastAPI async
   - **Reference:** [FastAPI BackgroundTasks vs ARQ](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)

2. **Second bottleneck:** Anthropic API rate limits (20 req/min for Claude)
   - **Fix:** Already using AWS Bedrock (1000 req/min for Nova models) - no change needed

---

## Sources

### FastAPI Architecture
- [FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices)
- [Structuring a FastAPI Project: Best Practices](https://dev.to/mohammad222pr/structuring-a-fastapi-project-best-practices-53l6)
- [FastAPI Bigger Applications - Multiple Files](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [FastAPI Modular Monolith Starter](https://github.com/arctikant/fastapi-modular-monolith-starter-kit)

### Modular Monolith Patterns
- [Modular Monolith in Python](https://breadcrumbscollector.tech/modular-monolith-in-python/)
- [Modular Monoliths: The Architecture Pattern We Don't Talk Enough About](https://backendengineeringadventures.substack.com/p/modular-monoliths-the-architecture)
- [Refactoring Old Monolith Architecture](https://medium.com/insiderengineering/refactoring-old-monolith-architecture-a-comprehensive-guide-7c192d7612e8)

### Background Tasks
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Managing Background Tasks in FastAPI: BackgroundTasks vs ARQ + Redis](https://davidmuraya.com/blog/fastapi-background-tasks-arq-vs-built-in/)
- [Managing Background Tasks and Long-Running Operations in FastAPI](https://leapcell.io/blog/managing-background-tasks-and-long-running-operations-in-fastapi)

### Dependency Injection
- [FastAPI Dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [Mastering Dependency Injection in FastAPI](https://medium.com/@azizmarzouki/mastering-dependency-injection-in-fastapi-clean-scalable-and-testable-apis-5f78099c3362)
- [Dependencies with yield - FastAPI](https://fastapi.tiangolo.com/tutorial/dependencies/dependencies-with-yield/)

---

*Architecture research for: RLM Production Sync (v1.2 processors → production monolith)*
*Researched: 2026-02-06*
