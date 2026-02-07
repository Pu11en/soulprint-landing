# Pitfalls Research: RLM Production Sync

**Domain:** Merging modular Python processors into live 3603-line FastAPI monolith on Render
**Researched:** 2026-02-06
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Circular Import Deadlock at Runtime (Not Build Time)

**What goes wrong:**
Processors import functions from `main.py` (`from main import download_conversations`, `from main import update_user_profile`), while `main.py` imports from processors (`from processors.full_pass import run_full_pass_pipeline`). This creates a circular dependency that fails **at runtime** when the import chain executes, not at startup. The error manifests as `ImportError: cannot import name 'X' from partially initialized module 'main'` when background tasks trigger.

**Why it happens:**
Python executes imports top-to-bottom. When `main.py` imports `processors.full_pass`, Python starts loading `full_pass.py`. When `full_pass.py` hits `from main import download_conversations`, Python tries to access `main.py` which is still mid-import. The circular loop causes one module to see a partially-initialized version of the other. This works during development if you never trigger the code path, but breaks in production when users actually call the endpoint.

**Consequences:**
- Production endpoint returns 500 error on first real usage
- Works in local testing if you don't exercise full code path
- Impossible to debug without understanding Python import mechanics
- Forces emergency rollback during user activity

**Prevention:**

```python
# BAD: Circular imports at top-level (current v1.2 structure)
# main.py
from processors.full_pass import run_full_pass_pipeline

# processors/full_pass.py
from main import download_conversations
from main import update_user_profile

# SOLUTION 1: Extract shared code into separate module (RECOMMENDED)
# lib/storage.py
async def download_conversations(storage_path: str):
    # Moved from main.py
    ...

async def update_user_profile(user_id: str, updates: dict):
    # Moved from main.py
    ...

# main.py
from lib.storage import download_conversations, update_user_profile
from processors.full_pass import run_full_pass_pipeline

# processors/full_pass.py
from lib.storage import download_conversations, update_user_profile
# No import from main.py — circular broken!

# SOLUTION 2: Lazy imports inside functions (quick fix)
# processors/full_pass.py
async def run_full_pass_pipeline(...):
    # Import inside function, after main.py fully loaded
    from main import download_conversations
    from main import update_user_profile

    conversations = await download_conversations(storage_path)
    await update_user_profile(user_id, {...})

# SOLUTION 3: Pass dependencies via function parameters
# main.py
async def run_full_pass(request: ProcessFullRequest):
    from processors.full_pass import run_full_pass_pipeline
    memory_md = await run_full_pass_pipeline(
        user_id=request.user_id,
        storage_path=request.storage_path,
        download_fn=download_conversations,  # Pass as dependency
        update_fn=update_user_profile,
    )

# processors/full_pass.py
async def run_full_pass_pipeline(
    user_id: str,
    storage_path: str,
    download_fn: Callable,  # Receive as parameter
    update_fn: Callable,
):
    conversations = await download_fn(storage_path)
    await update_fn(user_id, {...})
```

**Warning signs:**
- `from main import` statements in processors/ directory
- `from processors import` statements in main.py
- Imports working locally but failing in Docker container
- "partially initialized module" errors in Render logs
- Functions work when called directly but fail when invoked via endpoint

**Phase to address:**
Phase 1: Dependency Extraction — Must happen before merging processors into production

**Sources:**
- [Python Circular Import: Causes, Fixes, and Best Practices | DataCamp](https://www.datacamp.com/tutorial/python-circular-import)
- [Avoiding Circular Imports in Python | Brex Tech Blog](https://medium.com/brexeng/avoiding-circular-imports-in-python-7c35ec8145ed)
- [Circular Imports in Python: The Architecture Killer That Breaks Production](https://dev.to/vivekjami/circular-imports-in-python-the-architecture-killer-that-breaks-production-539j)

---

### Pitfall 2: Dockerfile Not Copying `processors/` Directory

**What goes wrong:**
The production Dockerfile uses `COPY . .` which should copy all files, but if `.dockerignore` excludes `processors/` or if the directory doesn't exist at build time, the container builds successfully but crashes at runtime with `ModuleNotFoundError: No module named 'processors'`. This is especially insidious because the build succeeds and health checks pass until a user triggers the code path.

**Why it happens:**
Docker's multi-stage builds and `.dockerignore` files can silently exclude directories. The current production Dockerfile has `COPY . .` but if you add processors/ in a development environment where `.dockerignore` contains `__pycache__/` patterns, it might exclude the whole directory if misconfigured. Additionally, Python's module resolution in Docker depends on WORKDIR, COPY paths, and CMD execution method all aligning correctly.

**Consequences:**
- Build succeeds, tests pass (if they don't import processors), deploy succeeds
- First production request importing processors crashes
- Rollback required during user activity
- No warning until runtime execution

**Prevention:**

```dockerfile
# BAD: Implicit copy (can fail silently)
COPY . .

# GOOD: Explicit verification in Dockerfile
COPY . .

# Verify critical directories exist at build time
RUN ls -la /app/processors/ || (echo "ERROR: processors/ not copied!" && exit 1)

# BEST: Explicit COPY with build-time checks
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .
COPY processors/ ./processors/
COPY lib/ ./lib/ 2>/dev/null || echo "No lib/ directory (optional)"

# Verify Python can import modules
RUN python -c "import processors.full_pass; print('✓ processors.full_pass')" || exit 1
RUN python -c "import processors.conversation_chunker; print('✓ conversation_chunker')" || exit 1
```

```bash
# Test locally before deploying to Render
docker build -t rlm-test .
docker run --rm rlm-test python -c "import processors.full_pass; print('Import works')"

# If this fails, your production deploy will also fail at runtime
```

**Warning signs:**
- Build logs don't show `processors/` being copied
- `docker run -it <image> ls -la /app` missing processors/
- Health endpoint works but `/process-full` returns 500
- ModuleNotFoundError only in production, not locally
- Error message: `No module named 'processors'` or `No module named 'processors.full_pass'`

**Phase to address:**
Phase 1: Dependency Extraction (update Dockerfile alongside code refactor)

**Sources:**
- [Debugging ImportError and ModuleNotFoundErrors in your Docker image](https://pythonspeed.com/articles/importerror-docker/)
- [Fixing ModuleNotFoundError: No Module Named "App" in FastAPI Docker - Complete Guide 2026](https://copyprogramming.com/howto/modulenotfounderror-no-module-named-app-fastapi-docker)
- [How to Fix 'No such file or directory' Error When Running Docker Image](https://www.pythontutorials.net/blog/no-such-file-or-directory-error-while-running-docker-image/)

---

### Pitfall 3: Database Schema Mismatch (`chunk_tier` Enum Values)

**What goes wrong:**
Production database expects `chunk_tier` values like `"small"`, `"medium"`, `"large"` (multi-tier chunking), but v1.2 processors only generate `"medium"` (single-tier chunking). When processors insert chunks, Postgres rejects them with `constraint violation: invalid chunk_tier value` or `enum type mismatch`. Alternatively, if the database accepts the values, queries filtering by tier return no results, breaking retrieval logic.

**Why it happens:**
Production evolved to support multi-tier chunking after v1.2 was developed. The database schema changed (added enum constraint or changed accepted values), but v1.2 code wasn't updated to match. Database constraints are enforced at INSERT time, causing immediate failures. Even without constraints, semantic mismatches break queries.

**Consequences:**
- Chunks fail to save to database
- Full pass pipeline crashes mid-execution
- User sees "processing" status forever (never completes)
- Data corruption if mismatched tiers partially saved
- Retrieval returns empty results despite chunks existing

**Prevention:**

```python
# STEP 1: Verify production schema before merge
# Run this query on production Supabase:
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'conversation_chunks'
  AND column_name = 'chunk_tier';

# Check if chunk_tier is enum type:
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (
  SELECT oid FROM pg_type WHERE typname = 'chunk_tier_enum'
);
-- Expected output: small, medium, large (or similar)

# STEP 2: Update processors to match production schema
# processors/conversation_chunker.py
def chunk_conversations(
    conversations: list,
    target_tokens: int = 2000,
    overlap_tokens: int = 200
) -> List[Dict]:
    # ...
    all_chunks.append({
        "conversation_id": str(conversation_id),
        "title": title,
        "content": chunk_content,
        "token_count": estimate_tokens(chunk_content),
        "chunk_index": chunk_idx,
        "total_chunks": total_chunks,
        "chunk_tier": "medium",  # ⚠️ Must match production enum!
        "created_at": created_at,
    })

# STEP 3: Test insertion in staging/dev environment
# Create test endpoint that uses processor code:
@app.post("/test-chunk-insertion")
async def test_chunk_insertion():
    from processors.conversation_chunker import chunk_conversations
    test_conversations = [{"title": "Test", "messages": [...]}]
    chunks = chunk_conversations(test_conversations)

    # Attempt insertion
    await save_chunks_batch("test-user", chunks)
    return {"status": "ok", "chunks": len(chunks)}

# STEP 4: Add schema validation in code
VALID_CHUNK_TIERS = ["small", "medium", "large"]  # From production schema

def validate_chunk(chunk: dict):
    if chunk["chunk_tier"] not in VALID_CHUNK_TIERS:
        raise ValueError(
            f"Invalid chunk_tier '{chunk['chunk_tier']}'. "
            f"Must be one of: {VALID_CHUNK_TIERS}"
        )
```

**Migration strategy for live production:**

```sql
-- Option 1: If adding new tier values (backward compatible)
ALTER TYPE chunk_tier_enum ADD VALUE 'ultra-small';
ALTER TYPE chunk_tier_enum ADD VALUE 'ultra-large';
-- Safe to run on live database, doesn't affect existing rows

-- Option 2: If changing tier values (DANGEROUS - requires downtime)
-- Step 1: Add new column with new enum
CREATE TYPE chunk_tier_new AS ENUM ('xs', 's', 'm', 'l', 'xl');
ALTER TABLE conversation_chunks ADD COLUMN chunk_tier_new chunk_tier_new;

-- Step 2: Migrate data
UPDATE conversation_chunks SET chunk_tier_new = 'm' WHERE chunk_tier = 'medium';
UPDATE conversation_chunks SET chunk_tier_new = 's' WHERE chunk_tier = 'small';
-- etc.

-- Step 3: Drop old column, rename new (requires downtime)
ALTER TABLE conversation_chunks DROP COLUMN chunk_tier;
ALTER TABLE conversation_chunks RENAME COLUMN chunk_tier_new TO chunk_tier;
DROP TYPE chunk_tier_enum;
ALTER TYPE chunk_tier_new RENAME TO chunk_tier_enum;
```

**Warning signs:**
- INSERT errors mentioning `chunk_tier` in Render logs
- Database constraint violation errors
- Chunks table empty despite processing completing
- `full_pass_status = 'processing'` never reaching 'complete'
- Different chunk_tier values in development vs. production

**Phase to address:**
Phase 1: Dependency Extraction (audit schema as part of integration planning)

**Sources:**
- [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations)
- [Upgrading | Supabase Docs](https://supabase.com/docs/guides/platform/upgrading)
- [Declarative database schemas | Supabase Docs](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

---

### Pitfall 4: No Rollback Plan for Render Auto-Deploy Failures

**What goes wrong:**
Render auto-deploys on every `git push` to main with zero-downtime by default. But if the new deployment crashes (circular import, missing module, schema mismatch), Render's health checks fail and it doesn't route traffic to the new instance. The old instance keeps running, but Render marks the deploy as "failed." If you force another push to fix it, you're debugging in production with users seeing errors on the edge cases the health check doesn't cover.

**Why it happens:**
Zero-downtime deploys require health checks to pass before switching traffic. If health checks only test `/health` endpoint (which doesn't import processors), the deploy succeeds until a user calls `/process-full`, which then fails. Render doesn't automatically rollback code — you must manually revert the commit or redeploy an older version.

**Consequences:**
- Failed deploy marked as "deployed" if health checks pass
- Users experience 500 errors on specific endpoints
- Panic debugging in production
- No automated rollback, requires manual git revert
- Downtime measured in minutes while you identify and revert

**Prevention:**

```python
# SOLUTION 1: Comprehensive health check that imports all modules
@app.get("/health")
async def health():
    """Health check that verifies all critical imports work"""
    try:
        # Import all processor modules to catch circular imports early
        from processors.full_pass import run_full_pass_pipeline
        from processors.conversation_chunker import chunk_conversations
        from processors.fact_extractor import extract_facts_parallel
        from processors.memory_generator import generate_memory_section
        from processors.v2_regenerator import regenerate_sections_v2

        # Verify database connectivity
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/conversation_chunks?limit=1",
                headers={"apikey": SUPABASE_SERVICE_KEY},
                timeout=5.0,
            )
            if response.status_code != 200:
                raise Exception(f"DB health check failed: {response.status_code}")

        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "modules": "ok",
            "database": "ok",
        }
    except Exception as e:
        # Render will detect this as unhealthy and not switch traffic
        raise HTTPException(status_code=503, detail=f"Unhealthy: {str(e)}")

# SOLUTION 2: Pre-deploy smoke test script
# scripts/smoke-test.sh
#!/bin/bash
set -e

echo "Running smoke tests against deployed service..."

# Test health endpoint
curl -f https://soulprint-rlm.onrender.com/health || exit 1

# Test that endpoints exist (don't call them, just check 405 vs 404)
curl -f -X POST https://soulprint-rlm.onrender.com/process-full \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "%{http_code}" | grep -E "405|422|401" || exit 1

echo "✓ Smoke tests passed"

# SOLUTION 3: Manual rollback procedure documented
# .planning/runbooks/ROLLBACK.md
```

**Rollback procedure:**

```bash
# EMERGENCY ROLLBACK STEPS

# 1. Identify last working commit
git log --oneline -10
# Example output:
# abc123f (HEAD -> main) Merge processors into main.py
# def456g Fix CSRF bug
# ghi789h Add rate limiting

# 2. Revert to last working commit
git revert abc123f --no-edit
git push origin main

# Render automatically deploys the revert within 2-3 minutes

# 3. If revert doesn't work, force deploy from specific commit
git reset --hard def456g
git push --force origin main
# ⚠️ WARNING: --force overwrites history, coordinate with team

# 4. Alternative: Use Render dashboard manual deploy
# Render Dashboard → Service → Manual Deploy → Select previous commit SHA
```

**Warning signs:**
- Health endpoint returns 200 but other endpoints crash
- Render logs showing errors but health checks passing
- Deploy marked "Live" but users reporting 500 errors
- No smoke tests in CI/CD pipeline
- No documented rollback procedure

**Phase to address:**
Phase 2: Deployment Safety (implement before merging processors)

**Sources:**
- [FastAPI production deployment best practices | Render](https://render.com/articles/fastapi-production-deployment-best-practices)
- [Deploying on Render – Render Docs](https://render.com/docs/deploys)
- [Deploy a FastAPI App – Render Docs](https://render.com/docs/deploy-fastapi)

---

### Pitfall 5: Memory/CPU Spike from 10 Concurrent Haiku Calls

**What goes wrong:**
The fact extractor uses `asyncio.gather()` with `concurrency=10` to parallelize Anthropic API calls. When a user with 200 conversations uploads (creating ~300 chunks), the service spawns 10 concurrent Haiku 4.5 calls, each consuming ~200MB memory for response buffering. On Render's free tier (512MB RAM), this causes OOM errors. On paid tier, it causes CPU throttling and costs $2-5 per user import in API fees.

**Why it happens:**
Developers optimize for latency (parallel = faster) without considering resource constraints. Each concurrent HTTP request to Anthropic's API holds memory for the request body, response streaming, and JSON parsing. Python's `asyncio` doesn't enforce memory limits — it spawns all 10 tasks simultaneously. In production, multiple users can trigger this concurrently, multiplying the resource usage.

**Consequences:**
- Service OOM crashes during large imports
- Render restarts service, users see "processing failed"
- API cost explosion (10 parallel calls × 30 batches = 300 calls per user)
- CPU throttling delays all requests, not just the import
- Other users experience slow response times

**Prevention:**

```python
# BAD: Unbounded concurrency (current v1.2 code)
async def extract_facts_parallel(
    chunks: List[dict],
    anthropic_client,
    concurrency: int = 10  # ⚠️ Too high for production!
):
    semaphore = asyncio.Semaphore(concurrency)
    tasks = [extract_with_limit(chunk) for chunk in chunks]
    results = await asyncio.gather(*tasks)
    return results

# GOOD: Environment-aware concurrency limits
MAX_CONCURRENCY = int(os.getenv("FACT_EXTRACTION_CONCURRENCY", "3"))

async def extract_facts_parallel(
    chunks: List[dict],
    anthropic_client,
    concurrency: int = MAX_CONCURRENCY  # Default: 3
):
    # Monitor memory usage
    print(f"[FactExtractor] Starting {len(chunks)} chunks with concurrency={concurrency}")

    semaphore = asyncio.Semaphore(concurrency)
    # ... rest of code

# BETTER: Adaptive concurrency based on available memory
import psutil

def get_safe_concurrency() -> int:
    """Calculate safe concurrency based on available memory"""
    available_mb = psutil.virtual_memory().available / (1024 * 1024)

    # Each Haiku call uses ~200MB, keep 256MB headroom
    max_concurrent = int((available_mb - 256) / 200)
    return max(1, min(max_concurrent, 10))

async def extract_facts_parallel(chunks: List[dict], anthropic_client):
    concurrency = get_safe_concurrency()
    print(f"[FactExtractor] Auto-detected concurrency: {concurrency}")
    # ...

# BEST: Job queue pattern for true background processing
from celery import Celery

celery = Celery('rlm', broker='redis://localhost:6379')

@celery.task(rate_limit='10/m')  # Max 10 tasks per minute
def extract_facts_task(chunk: dict):
    """Single chunk extraction as isolated task"""
    # Celery handles concurrency, retries, monitoring
    return extract_facts_from_chunk(chunk, anthropic_client)

async def extract_facts_parallel(chunks: List[dict]):
    # Queue all tasks
    task_ids = [extract_facts_task.delay(chunk) for chunk in chunks]

    # Celery processes them at controlled rate
    results = [task.get() for task in task_ids]
    return results
```

**Resource limits in production:**

```yaml
# render.yaml (explicit resource configuration)
services:
  - type: web
    name: soulprint-rlm
    runtime: python
    plan: starter  # 512MB RAM, 0.5 CPU
    envVars:
      # Limit concurrency based on plan
      - key: FACT_EXTRACTION_CONCURRENCY
        value: 2  # Safe for 512MB RAM

      # Monitor memory usage
      - key: MEMORY_LIMIT_MB
        value: 512

# For production tier (2GB RAM):
# FACT_EXTRACTION_CONCURRENCY=5
```

**Warning signs:**
- Memory usage spikes during imports (check Render metrics)
- OOM errors in logs: `MemoryError` or `killed by signal 9`
- Service restarts during `/process-full` calls
- High Anthropic API bills ($50+/month for low traffic)
- CPU usage at 100% during imports
- Other API routes slow during background processing

**Phase to address:**
Phase 3: Resource Optimization (after merge works, before scaling to users)

**Sources:**
- [Background Tasks - FastAPI](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Parallel Execution in FastAPI: Run Tasks the Smart Way | Medium](https://medium.com/@rameshkannanyt0078/parallel-execution-in-fastapi-run-tasks-the-smart-way-c29cc75b4775)
- [The Complete Guide to Background Processing with FastAPI × Celery/Redis](https://blog.greeden.me/en/2026/01/27/the-complete-guide-to-background-processing-with-fastapi-x-celery-redishow-to-separate-heavy-work-from-your-api-to-keep-services-stable/)

---

### Pitfall 6: Different Chunking Strategies Creating Duplicate Data

**What goes wrong:**
Production has multi-tier chunking (100 chars, 500 chars, 2000 chars per conversation). v1.2 has single-tier chunking (2000 chars only). When you merge, if both chunking strategies run (one from old code, one from new), you get duplicate chunks in the database — production chunks with `tier='small'` and v1.2 chunks with `tier='medium'` for the same conversations. Retrieval logic breaks because it finds multiple conflicting chunks per conversation.

**Why it happens:**
Merging assumes "new code replaces old code," but if endpoints call different chunking functions, both code paths run. The database doesn't enforce "one chunking strategy per user" constraint. Old imports processed with multi-tier chunking coexist with new imports using single-tier chunking. Queries don't filter by chunking version, returning mixed results.

**Consequences:**
- Database bloat (3x chunks per conversation if both strategies run)
- Retrieval returns duplicate/conflicting context
- Memory section generation uses wrong chunks
- User experiences degraded chat quality (duplicate facts)
- Storage costs increase unnecessarily

**Prevention:**

```python
# SOLUTION 1: Add chunking_version field to database
# Migration SQL:
ALTER TABLE conversation_chunks
ADD COLUMN chunking_version INTEGER DEFAULT 1;

CREATE INDEX idx_chunks_version
ON conversation_chunks(user_id, chunking_version);

# Always query with version filter:
async def get_conversation_chunks(user_id: str, version: int = 2):
    params = {
        "user_id": f"eq.{user_id}",
        "chunking_version": f"eq.{version}",
        "select": "...",
    }

# SOLUTION 2: Delete old chunks before re-chunking
async def run_full_pass_pipeline(user_id: str, ...):
    # Step 0: Clean slate
    print(f"[FullPass] Deleting existing chunks for user {user_id}")
    await delete_user_chunks(user_id)  # Already in full_pass.py

    # Step 1: Chunk with new strategy
    chunks = chunk_conversations(conversations)
    await save_chunks_batch(user_id, chunks)

# SOLUTION 3: One chunking function, remove old one
# main.py - DELETE old multi-tier chunking code
# processors/conversation_chunker.py - KEEP as single source of truth

# Verify only one chunking function exists:
grep -r "def chunk_conversations" rlm-service/
# Should return ONLY: processors/conversation_chunker.py

# SOLUTION 4: Migration script for existing data
async def migrate_chunks_to_v2(user_id: str):
    """Re-process all conversations with v2 chunking strategy"""
    # Get original conversations
    storage_path = f"user-exports/{user_id}/conversations.json.gz"
    conversations = await download_conversations(storage_path)

    # Delete v1 chunks
    await delete_user_chunks(user_id)

    # Generate v2 chunks
    chunks = chunk_conversations(conversations)  # v2 strategy
    await save_chunks_batch(user_id, chunks)

    print(f"[Migration] Migrated {len(chunks)} chunks for user {user_id}")
```

**Data consistency check:**

```sql
-- Verify no duplicate chunks per conversation
SELECT user_id, conversation_id, COUNT(*) as chunk_count
FROM conversation_chunks
GROUP BY user_id, conversation_id
HAVING COUNT(*) > 10  -- Suspiciously high
ORDER BY chunk_count DESC;

-- Check for mixed chunking versions
SELECT user_id, chunk_tier, COUNT(*) as count
FROM conversation_chunks
GROUP BY user_id, chunk_tier
ORDER BY user_id, chunk_tier;
-- Should show consistent tier distribution per user
```

**Warning signs:**
- Chunk counts 2-3x higher than expected
- Same conversation appearing multiple times in queries
- Memory section contains duplicate facts
- Database storage growing faster than user growth
- Different users have wildly different chunk counts for similar data

**Phase to address:**
Phase 1: Dependency Extraction (decide on single chunking strategy before merge)

**Sources:**
- [Stop Writing Monolithic FastAPI Apps — This Modular Setup Changed Everything | Medium](https://medium.com/@bhagyarana80/stop-writing-monolithic-fastapi-apps-this-modular-setup-changed-everything-44b9268f814c)
- [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations)

---

## Moderate Pitfalls

### Pitfall 7: Import Path Changes Breaking Existing Tests

**What goes wrong:**
Production has tests (if any) that import from `main.py` functions. When you move functions to `lib/storage.py` or change module structure, existing tests break with `ImportError` or `AttributeError`. Tests that mock functions at the old path continue passing but mock nothing in production code.

**Why it happens:**
Python mocking relies on exact import paths. If tests do `@mock.patch('main.download_conversations')` but you moved the function to `lib.storage`, the mock patches the wrong location. The test passes (because it mocks *something*) but doesn't actually test production code.

**Prevention:**

```python
# BAD: Mock references old import path
# test_main.py
from unittest.mock import patch

@patch('main.download_conversations')  # ⚠️ Breaks if function moved
async def test_full_pass(mock_download):
    mock_download.return_value = [...]
    # Test runs but doesn't cover real code!

# GOOD: Mock at point of use, not definition
@patch('processors.full_pass.download_conversations')  # Where it's imported
async def test_full_pass(mock_download):
    mock_download.return_value = [...]

# BETTER: Use dependency injection (no mocking needed)
# processors/full_pass.py
async def run_full_pass_pipeline(
    user_id: str,
    storage_path: str,
    download_fn: Callable = None,  # Injectable
    update_fn: Callable = None,
):
    download_fn = download_fn or download_conversations
    update_fn = update_fn or update_user_profile

    conversations = await download_fn(storage_path)
    await update_fn(user_id, {...})

# test_full_pass.py
async def test_full_pass():
    async def fake_download(path):
        return [{"title": "Test"}]

    async def fake_update(user_id, updates):
        pass

    # No mocking, just pass test doubles
    memory = await run_full_pass_pipeline(
        user_id="test",
        storage_path="test.gz",
        download_fn=fake_download,
        update_fn=fake_update,
    )

    assert "MEMORY" in memory
```

**Refactor checklist:**

```bash
# STEP 1: Find all tests before refactoring
find . -name "test_*.py" -o -name "*_test.py"

# STEP 2: Search for mocks that will break
grep -r "@patch\|@mock\|Mock\|MagicMock" tests/
# Note all paths being mocked

# STEP 3: After moving functions, update mocks
# Find: @patch('main.download_conversations')
# Replace: @patch('lib.storage.download_conversations')

# STEP 4: Run tests to verify
pytest tests/ -v

# STEP 5: Check test coverage still applies
pytest --cov=processors --cov=lib tests/
```

**Warning signs:**
- Tests pass but coverage drops significantly
- Tests importing from old paths still passing
- Mocks patching functions that no longer exist at that path
- Integration tests passing but unit tests failing
- Coverage report shows 0% for newly moved modules

**Phase to address:**
Phase 1: Dependency Extraction (update tests alongside code refactor)

**Sources:**
- [Testing Next.js Applications (applies to FastAPI too)](https://trillionclues.medium.com/testing-next-js-applications-a-complete-guide-to-catching-bugs-before-qa-does-a1db8d1a0a3b)
- [FastAPI Testing Documentation](https://fastapi.tiangolo.com/tutorial/testing/)

---

### Pitfall 8: Anthropic Client Initialization Differences (Bedrock vs Direct)

**What goes wrong:**
Production uses AWS Bedrock for some Anthropic API calls (enterprise billing), while v1.2 uses `anthropic.AsyncAnthropic()` directly. Merging creates two different client initialization patterns. Some endpoints use Bedrock client, others use direct client. API calls fail with authentication errors or wrong model IDs because Bedrock uses different model naming (`anthropic.claude-haiku-4-5-v1:0` vs. `claude-haiku-4-5-20251001`).

**Why it happens:**
Production evolved to use Bedrock for cost allocation and enterprise support, but v1.2 was developed in isolation using direct Anthropic SDK. Different client types have slightly different APIs and require different credentials (`AWS_ACCESS_KEY` vs. `ANTHROPIC_API_KEY`). Model IDs differ between platforms.

**Consequences:**
- Some API calls fail with "model not found" errors
- Authentication errors on Bedrock calls if `AWS_ACCESS_KEY` not set
- Inconsistent billing (some calls to Anthropic direct, some to Bedrock)
- Cannot track API usage centrally
- Different rate limits apply to different calls

**Prevention:**

```python
# SOLUTION 1: Abstract client creation into factory
# lib/anthropic_client.py
import os
import anthropic

USE_BEDROCK = os.getenv("USE_BEDROCK", "false").lower() == "true"

def create_anthropic_client():
    """Factory for creating Anthropic client based on environment"""
    if USE_BEDROCK:
        import boto3

        bedrock_client = boto3.client(
            service_name='bedrock-runtime',
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )

        return anthropic.AsyncAnthropicBedrock(
            aws_client=bedrock_client,
        )
    else:
        return anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )

def get_model_id(model_name: str) -> str:
    """Map model names to platform-specific IDs"""
    if USE_BEDROCK:
        model_map = {
            "haiku-4.5": "anthropic.claude-haiku-4-5-v1:0",
            "sonnet-4": "anthropic.claude-sonnet-4-v1:0",
        }
        return model_map.get(model_name, model_name)
    else:
        model_map = {
            "haiku-4.5": "claude-haiku-4-5-20251001",
            "sonnet-4": "claude-sonnet-4-20250514",
        }
        return model_map.get(model_name, model_name)

# SOLUTION 2: Update processors to use factory
# processors/fact_extractor.py
from lib.anthropic_client import create_anthropic_client, get_model_id

async def extract_facts_from_chunk(chunk_content: str):
    client = create_anthropic_client()

    response = await client.messages.create(
        model=get_model_id("haiku-4.5"),  # Platform-agnostic
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": FACT_EXTRACTION_PROMPT + "\n" + chunk_content
        }]
    )

    return response.content[0].text

# SOLUTION 3: Environment-based configuration
# .env.production (Render)
USE_BEDROCK=true
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# .env.development (local)
USE_BEDROCK=false
ANTHROPIC_API_KEY=sk-ant-...
```

**Warning signs:**
- Mixed `anthropic.AsyncAnthropic` and Bedrock client initialization
- Model ID errors: "model not found" in production
- Different API costs than expected (Bedrock vs. direct pricing)
- Some endpoints work locally but fail in production
- Authentication errors only in production

**Phase to address:**
Phase 1: Dependency Extraction (standardize client creation before merge)

**Sources:**
- [FastAPI production deployment best practices | Render](https://render.com/articles/fastapi-production-deployment-best-practices)
- [Managing Background Tasks and Long-Running Operations in FastAPI](https://leapcell.io/blog/managing-background-tasks-and-long-running-operations-in-fastapi)

---

### Pitfall 9: Environment Variables Not Propagated to Processors

**What goes wrong:**
Processors read environment variables (`os.getenv("SUPABASE_URL")`) but Render doesn't inject them during runtime if processors are imported at module-level. Global variable initialization happens at import time, before Render sets env vars, resulting in `None` values. API calls fail with "missing credentials" errors.

**Why it happens:**
Python executes module-level code at import time. If `main.py` imports `processors.full_pass` at startup, and `full_pass.py` has `SUPABASE_URL = os.getenv("SUPABASE_URL")` at top-level, that runs before Render's environment is fully initialized. The variable captures `None` and never updates.

**Consequences:**
- Database calls fail with "missing API key"
- Health check passes (uses main.py's env vars) but processors fail
- Works locally (env vars loaded from .env early) but fails in production
- Mysterious "unauthorized" errors in background tasks

**Prevention:**

```python
# BAD: Module-level environment variable capture
# processors/full_pass.py
import os

SUPABASE_URL = os.getenv("SUPABASE_URL")  # ⚠️ Captured at import time
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

async def save_chunks_batch(user_id: str, chunks: List[dict]):
    # Uses SUPABASE_URL captured at import — might be None!
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SUPABASE_URL}/rest/v1/conversation_chunks",
            ...
        )

# GOOD: Lazy evaluation of environment variables
# processors/full_pass.py
import os

def get_supabase_url() -> str:
    """Lazy env var lookup at call time"""
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise RuntimeError("SUPABASE_URL environment variable not set")
    return url

def get_supabase_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_KEY environment variable not set")
    return key

async def save_chunks_batch(user_id: str, chunks: List[dict]):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{get_supabase_url()}/rest/v1/conversation_chunks",
            headers={
                "apikey": get_supabase_key(),
                "Authorization": f"Bearer {get_supabase_key()}",
            },
            ...
        )

# BETTER: Centralized configuration with validation
# lib/config.py
from pydantic import BaseSettings, Field

class Settings(BaseSettings):
    supabase_url: str = Field(..., env="SUPABASE_URL")
    supabase_service_key: str = Field(..., env="SUPABASE_SERVICE_KEY")
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")

    class Config:
        env_file = ".env"
        case_sensitive = False

# Singleton pattern
_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()  # Validates all required env vars
    return _settings

# processors/full_pass.py
from lib.config import get_settings

async def save_chunks_batch(user_id: str, chunks: List[dict]):
    settings = get_settings()  # Lazy, validated access

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/conversation_chunks",
            headers={
                "apikey": settings.supabase_service_key,
                ...
            }
        )
```

**Startup validation:**

```python
# main.py
from lib.config import get_settings

@app.on_event("startup")
async def validate_environment():
    """Fail fast if environment variables missing"""
    try:
        settings = get_settings()
        print(f"✓ Environment validated")
        print(f"  - Supabase URL: {settings.supabase_url}")
        print(f"  - Anthropic API key: {'*' * 20}{settings.anthropic_api_key[-4:]}")
    except Exception as e:
        print(f"✗ Environment validation failed: {e}")
        raise
```

**Warning signs:**
- "missing credentials" errors only in background tasks
- Health endpoint works but `/process-full` fails
- Different behavior locally vs. production
- Environment variables shown in Render dashboard but not accessible in code
- Errors like "NoneType object has no attribute 'split'" when using env var

**Phase to address:**
Phase 1: Dependency Extraction (centralize config alongside refactor)

**Sources:**
- [FastAPI Deployment Guide for 2026 (Production Setup)](https://www.zestminds.com/blog/fastapi-deployment-guide/)
- [🔥 FastAPI in Production: Build, Scale & Deploy – Series A: Codebase Design](https://dev.to/mrchike/fastapi-in-production-build-scale-deploy-series-a-codebase-design-ao3)

---

## Minor Pitfalls

### Pitfall 10: Logging Differences Between Main and Processors

**What goes wrong:**
Production `main.py` uses structured logging (JSON format for log aggregation), while processors use `print()` statements. When processors run, their output isn't captured by Render's log aggregation, making debugging impossible. Logs appear locally but vanish in production.

**Why it happens:**
`print()` outputs to stdout, which Render captures, but structured loggers (using Python's `logging` module) output to different streams. If main.py configures logging to go to a file or specific handler, processors' `print()` statements bypass that configuration.

**Prevention:**

```python
# SOLUTION: Shared logging configuration
# lib/logger.py
import logging
import sys

def get_logger(name: str) -> logging.Logger:
    """Get or create logger with standard formatting"""
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)

    return logger

# processors/fact_extractor.py
from lib.logger import get_logger

logger = get_logger(__name__)

async def extract_facts_parallel(chunks: List[dict], ...):
    # Replace print() with logger
    logger.info(f"Starting parallel extraction for {len(chunks)} chunks")
    # ...
    logger.info(f"Parallel extraction complete: {len(results)} results")

# main.py
from lib.logger import get_logger

logger = get_logger(__name__)

@app.on_event("startup")
async def startup():
    logger.info("RLM Service starting up")
```

**Phase to address:**
Phase 3: Resource Optimization (quality-of-life improvement, not critical)

---

### Pitfall 11: No Integration Tests for Processor Pipeline

**What goes wrong:**
Processors have individual unit tests, but no integration test verifying the full pipeline (chunking → fact extraction → memory generation) works end-to-end. Production breaks when processors work individually but fail when chained together.

**Why it happens:**
Unit tests mock each step, so they pass even if the output format of one step is incompatible with the input format of the next. Integration tests are harder to write because they require test data and take longer to run.

**Prevention:**

```python
# tests/integration/test_full_pass.py
import pytest
import gzip
import json

@pytest.mark.integration
async def test_full_pass_pipeline_end_to_end():
    """Test complete pipeline with real test data"""

    # Step 1: Create test conversations
    test_conversations = [
        {
            "id": "conv_1",
            "title": "Test Conversation",
            "create_time": 1234567890,
            "messages": [
                {"role": "user", "content": "What is RoboNuggets?"},
                {"role": "assistant", "content": "RoboNuggets is your crypto portfolio tracker."}
            ]
        }
    ]

    # Step 2: Save as gzipped JSON (simulate storage)
    test_path = "/tmp/test-conversations.json.gz"
    with gzip.open(test_path, 'wt', encoding='utf-8') as f:
        json.dump(test_conversations, f)

    # Step 3: Run full pipeline
    from processors.full_pass import run_full_pass_pipeline

    memory_md = await run_full_pass_pipeline(
        user_id="test-user",
        storage_path=test_path,
        conversation_count=1,
    )

    # Step 4: Verify output structure
    assert "MEMORY" in memory_md
    assert "RoboNuggets" in memory_md  # Test fact extracted
    assert len(memory_md) > 100  # Non-trivial output

    # Step 5: Verify chunks saved to database
    chunks = await get_conversation_chunks("test-user")
    assert len(chunks) > 0
    assert chunks[0]["content"] is not None
```

**Phase to address:**
Phase 4: Testing & Validation (before production rollout)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Lazy imports inside functions (`from main import X` in function body) | Breaks circular imports quickly | Slower import time, harder to track dependencies | Only as temporary fix during refactor; must extract shared code eventually |
| Deleting all chunks before re-chunking | Simple, guaranteed consistency | Loses existing chunks if new chunking fails | Acceptable if wrapped in transaction or with backup |
| High concurrency (10+ parallel API calls) | Faster user-facing latency | Memory spikes, OOM crashes, API cost explosion | Never acceptable on Render free tier; max 3-5 on paid |
| Single-tier chunking only | Simpler implementation, less storage | Poor retrieval precision (can't target small facts vs. full context) | Acceptable for MVP; must migrate to multi-tier for production quality |
| Skipping health check improvements | Faster initial deployment | Silent failures in production (health passes, endpoints crash) | Never acceptable when merging critical changes |
| Using `print()` instead of logging | No setup required | Debugging impossible in production | Only acceptable in throwaway scripts, not production processors |

---

## Integration Gotchas

Common mistakes when connecting modular code to existing monolith.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|---------------|------------------|
| Circular imports | `from main import X` at top of processor file | Extract shared code to `lib/` or use lazy imports |
| Dockerfile | Assuming `COPY . .` copies everything | Explicitly verify processors/ with `RUN ls -la /app/processors/` |
| Database schema | Assuming chunk_tier values match production | Query production schema, verify enum values before merge |
| Environment variables | Capturing env vars at module level (`SUPABASE_URL = os.getenv(...)`) | Use lazy getters or Pydantic Settings |
| Client initialization | Mixing Bedrock and direct Anthropic clients | Centralize client factory in `lib/anthropic_client.py` |
| Logging | Using `print()` in processors, `logging` in main | Shared logger from `lib/logger.py` |
| Chunking strategy | Running both old and new chunking code | Delete old chunks, use single chunking function |
| API concurrency | Default concurrency=10 for parallel calls | Environment-aware limits (3 for Render Starter, 5 for Pro) |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded parallel API calls | Memory spike, OOM crashes | Concurrency limits (3-5), adaptive based on available memory | >100 chunks processed simultaneously |
| Module-level env var capture | "Missing credentials" errors in production | Lazy env var getters or Pydantic Settings | Import-time vs. runtime env var availability differs |
| No chunking version tracking | Database bloat, duplicate chunks | Add `chunking_version` field, filter queries by version | After switching chunking strategies |
| No health check module imports | Deploy succeeds, endpoints crash at runtime | Comprehensive health check importing all modules | First user request triggers new code path |
| Mixed chunking strategies | Retrieval returns duplicates/conflicts | Single chunking function, delete old implementations | Multiple imports processed with different strategies |
| Direct Anthropic SDK vs. Bedrock | "Model not found" errors, billing confusion | Client factory abstracting Bedrock vs. direct | Production uses Bedrock, dev uses direct (or vice versa) |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Environment variables in logs | Credentials leaked to log aggregation | Use `'*' * 20 + key[-4:]` when logging keys |
| No validation of chunk_tier values | Database constraint violations, SQL injection | Whitelist valid tier values before INSERT |
| Service role key in processor code | If processors exposed via separate service, key leaks | Use per-service credentials, not global service role key |
| Unbounded background task execution | DoS via spawning thousands of background tasks | Rate limit `/process-full` endpoint per user |
| No timeout on Anthropic API calls | Hung requests consuming memory forever | Set `timeout=60.0` on all httpx/anthropic calls |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Processors merged:** Often missing explicit `COPY processors/` in Dockerfile — verify `RUN ls -la /app/processors/` in build
- [ ] **Circular imports fixed:** Often missing shared code extraction — verify no `from main import` in processors/
- [ ] **Health check updated:** Often missing processor imports — verify health endpoint imports all modules
- [ ] **Concurrency limits set:** Often missing environment-based limits — verify `FACT_EXTRACTION_CONCURRENCY` env var
- [ ] **Database schema aligned:** Often missing chunk_tier enum verification — query production schema before deploy
- [ ] **Client factory created:** Often missing Bedrock vs. direct abstraction — verify single `create_anthropic_client()` function
- [ ] **Chunking deduplicated:** Often missing deletion of old chunking code — grep for multiple `chunk_conversations` definitions
- [ ] **Environment config centralized:** Often missing lazy env var access — verify no module-level `os.getenv()`
- [ ] **Logging standardized:** Often missing logger replacement of `print()` — grep for `print(` in processors/
- [ ] **Integration tests added:** Often missing full pipeline test — verify test calls run_full_pass_pipeline() end-to-end

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Circular import at runtime | **MEDIUM** | 1. Rollback deploy via git revert 2. Extract shared code to lib/ 3. Redeploy |
| Missing processors/ directory | **MEDIUM** | 1. Rollback deploy 2. Update Dockerfile with explicit COPY 3. Test locally with `docker run` 4. Redeploy |
| Database schema mismatch | **HIGH** | 1. Add chunking_version field 2. Mark new chunks with version=2 3. Update queries to filter by version |
| No rollback plan executed | **LOW** | 1. Identify last working commit SHA 2. `git revert <commit>` 3. `git push` (Render auto-deploys) |
| Memory spike from concurrency | **MEDIUM** | 1. Set FACT_EXTRACTION_CONCURRENCY=2 in Render dashboard 2. Restart service 3. Monitor memory |
| Duplicate chunking strategies | **HIGH** | 1. Run migration script deleting old chunks 2. Re-process with single strategy 3. Remove old code |
| Import path breaking tests | **LOW** | 1. Update @patch() decorators to new paths 2. Run pytest 3. Fix coverage gaps |
| Anthropic client mismatch | **MEDIUM** | 1. Implement client factory 2. Replace all direct client creation 3. Test both Bedrock and direct modes |
| Environment vars not propagated | **MEDIUM** | 1. Replace module-level `os.getenv()` with lazy getters 2. Add startup validation 3. Redeploy |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Circular import deadlock | Phase 1: Dependency Extraction | `python -c "import processors.full_pass"` succeeds |
| Dockerfile not copying processors/ | Phase 1: Dependency Extraction | `docker run <image> ls -la /app/processors/` shows files |
| Database schema mismatch | Phase 1: Dependency Extraction | Query production chunk_tier enum values match code |
| No rollback plan | Phase 2: Deployment Safety | Documented rollback procedure in .planning/runbooks/ |
| Memory/CPU spike from concurrency | Phase 3: Resource Optimization | `FACT_EXTRACTION_CONCURRENCY` env var set, memory usage flat |
| Duplicate chunking strategies | Phase 1: Dependency Extraction | Grep shows single `chunk_conversations` definition |
| Import path breaking tests | Phase 1: Dependency Extraction | `pytest tests/` passes with >80% coverage |
| Anthropic client mismatch | Phase 1: Dependency Extraction | Client factory handles both Bedrock and direct |
| Environment vars not propagated | Phase 1: Dependency Extraction | Startup validation logs all required env vars |
| Logging differences | Phase 3: Resource Optimization | All processors use shared logger, no `print()` |
| No integration tests | Phase 4: Testing & Validation | Integration test runs full pipeline end-to-end |

---

## Sources

**FastAPI Modular Architecture:**
- [Stop Writing Monolithic FastAPI Apps — This Modular Setup Changed Everything | Medium](https://medium.com/@bhagyarana80/stop-writing-monolithic-fastapi-apps-this-modular-setup-changed-everything-44b9268f814c)
- [🔥 FastAPI in Production: Build, Scale & Deploy – Series A: Codebase Design](https://dev.to/mrchike/fastapi-in-production-build-scale-deploy-series-a-codebase-design-ao3)
- [FastAPI at Scale: How I Split a Monolith into Ten Fast-Deploying Microservices | Medium](https://medium.com/@bhagyarana80/fastapi-at-scale-how-i-split-a-monolith-into-ten-fast-deploying-microservices-a6b1b33c37b2)

**Python Circular Imports:**
- [Python Circular Import: Causes, Fixes, and Best Practices | DataCamp](https://www.datacamp.com/tutorial/python-circular-import)
- [Avoiding Circular Imports in Python | Brex Tech Blog](https://medium.com/brexeng/avoiding-circular-imports-in-python-7c35ec8145ed)
- [Circular Imports in Python: The Architecture Killer That Breaks Production](https://dev.to/vivekjami/circular-imports-in-python-the-architecture-killer-that-breaks-production-539j)
- [The Circular Import Trap in Python — and How to Escape It | Medium](https://medium.com/@denis.volokh/the-circular-import-trap-in-python-and-how-to-escape-it-9fb22925dab6)

**Docker & Python Module Imports:**
- [Debugging ImportError and ModuleNotFoundErrors in your Docker image](https://pythonspeed.com/articles/importerror-docker/)
- [Fixing ModuleNotFoundError: No Module Named "App" in FastAPI Docker - Complete Guide 2026](https://copyprogramming.com/howto/modulenotfounderror-no-module-named-app-fastapi-docker)
- [How to Fix 'No such file or directory' Error When Running Docker Image](https://www.pythontutorials.net/blog/no-such-file-or-directory-error-while-running-docker-image/)

**Render Deployment & Zero-Downtime:**
- [FastAPI production deployment best practices | Render](https://render.com/articles/fastapi-production-deployment-best-practices)
- [Deploy a FastAPI App – Render Docs](https://render.com/docs/deploy-fastapi)
- [Deploying on Render – Render Docs](https://render.com/docs/deploys)
- [FastAPI Deployment Guide for 2026 (Production Setup)](https://www.zestminds.com/blog/fastapi-deployment-guide/)

**FastAPI Background Tasks & Concurrency:**
- [Background Tasks - FastAPI](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Parallel Execution in FastAPI: Run Tasks the Smart Way | Medium](https://medium.com/@rameshkannanyt0078/parallel-execution-in-fastapi-run-tasks-the-smart-way-c29cc75b4775)
- [The Complete Guide to Background Processing with FastAPI × Celery/Redis](https://blog.greeden.me/en/2026/01/27/the-complete-guide-to-background-processing-with-fastapi-x-celery-redishow-to-separate-heavy-work-from-your-api-to-keep-services-stable/)
- [Managing Background Tasks and Long-Running Operations in FastAPI](https://leapcell.io/blog/managing-background-tasks-and-long-running-operations-in-fastapi)

**Database Migrations (Supabase):**
- [Database Migrations | Supabase Docs](https://supabase.com/docs/guides/deployment/database-migrations)
- [Upgrading | Supabase Docs](https://supabase.com/docs/guides/platform/upgrading)
- [Declarative database schemas | Supabase Docs](https://supabase.com/docs/guides/local-development/declarative-database-schemas)
- [Supabase Managing database migrations across multiple environments](https://dev.to/parth24072001/supabase-managing-database-migrations-across-multiple-environments-local-staging-production-4emg)

---

*Pitfalls research for: Merging v1.2 processors into 3603-line production FastAPI monolith on Render*
*Researched: 2026-02-06*
