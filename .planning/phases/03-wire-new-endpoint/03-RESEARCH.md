# Phase 3: Wire New Endpoint - Research

**Researched:** 2026-02-06
**Domain:** FastAPI endpoint development, versioning, health checks, and production deployment
**Confidence:** HIGH

## Summary

Phase 3 wires a new `/process-full-v2` endpoint alongside the existing `/process-full` v1 endpoint in production. This is a parallel deployment pattern where both versions coexist, enabling zero-downtime migration and instant rollback capability. The research focused on four critical domains: FastAPI background task mechanics, health check patterns with startup validation, backwards compatibility strategies for versioned endpoints, and rollback procedures for production deployments.

The standard approach is to create a new endpoint with a v2 suffix, use FastAPI's `BackgroundTasks` for async processing, implement lifespan hooks with `@asynccontextmanager` for startup validation, and maintain strict backwards compatibility by not modifying existing endpoint behavior. The Render.com deployment platform's health check mechanism provides automatic restart capabilities, and git-based rollback is the industry standard for production recovery.

**Primary recommendation:** Use FastAPI lifespan context manager to validate all processor module imports at startup, create `/process-full-v2` endpoint that dispatches to the new `run_full_pass_pipeline()` function via BackgroundTasks, preserve all 14 existing endpoints unchanged, and document rollback procedure with explicit git commands.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115+ | Web framework with async support | Native BackgroundTasks, lifespan hooks, automatic OpenAPI docs |
| uvicorn | 0.30+ | ASGI server for FastAPI | Standard production server for async Python web apps |
| pytest | 8.3+ | Testing framework | De facto standard for Python testing, async support |
| httpx | 0.27+ | Async HTTP client | Used by FastAPI TestClient, replaces requests for async |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-asyncio | 0.24+ | Async test support for pytest | Testing async endpoints and background tasks |
| pytest-httpx | 0.33+ | Mock httpx requests in tests | Isolating tests from external services |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FastAPI BackgroundTasks | Celery + Redis | BackgroundTasks sufficient for current scale, Celery adds operational complexity |
| Lifespan hooks | @app.on_event() decorators | on_event() deprecated in FastAPI 0.93+, lifespan is modern approach |
| URL versioning (/v2) | Header/query versioning | URL versioning simplest to implement and understand |

**Installation:**
```bash
# Already installed in soulprint-rlm, no new dependencies needed
pip install fastapi uvicorn pytest pytest-asyncio
```

## Architecture Patterns

### Recommended Project Structure
```
soulprint-rlm/
├── main.py                 # All endpoints, v1 and v2 coexist
├── adapters/               # Shared functions (Phase 1)
├── processors/             # v1.2 processing modules (Phase 2)
└── tests/
    ├── test_supabase_adapter.py
    ├── test_processors.py
    └── test_endpoints.py   # NEW: Test v1/v2 endpoints
```

### Pattern 1: Parallel Endpoint Deployment (v1 + v2)
**What:** Multiple versions of same logical endpoint coexist at different URL paths
**When to use:** Gradual migration, need backwards compatibility, want instant rollback
**Example:**
```python
# Source: FastAPI versioning patterns (https://github.com/DeanWay/fastapi-versioning)

# v1 endpoint (UNCHANGED - critical for backwards compat)
@app.post("/process-full")
async def process_full(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    """Legacy v1 pipeline - DO NOT MODIFY"""
    # ... existing implementation stays exactly the same
    background_tasks.add_task(process_full_background, ...)
    return {"status": "processing", "version": "v1"}

# v2 endpoint (NEW - uses processors from Phase 2)
@app.post("/process-full-v2")
async def process_full_v2(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    """
    v2 pipeline with fact extraction, MEMORY generation, v2 section regen.
    Uses processors/full_pass.py orchestrator.
    """
    background_tasks.add_task(run_full_pass_v2_background, ...)
    return {"status": "processing", "version": "v2"}
```

### Pattern 2: FastAPI Lifespan with Startup Validation
**What:** Async context manager that runs startup/shutdown logic, validates imports at boot
**When to use:** Need to fail fast on broken imports, initialize resources, production health checks
**Example:**
```python
# Source: FastAPI official docs (https://fastapi.tiangolo.com/advanced/events/)
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Validate all processor modules import correctly
    try:
        from processors.conversation_chunker import chunk_conversations
        from processors.fact_extractor import extract_facts_parallel
        from processors.memory_generator import generate_memory_section
        from processors.v2_regenerator import regenerate_sections_v2
        from processors.full_pass import run_full_pass_pipeline
        print("[Startup] All processor modules imported successfully")
    except ImportError as e:
        print(f"[FATAL] Processor import failed: {e}")
        raise  # Crash the app - fail fast

    yield  # Application runs here

    # Shutdown: Cleanup if needed
    print("[Shutdown] Cleanup complete")

app = FastAPI(lifespan=lifespan)
```

**CRITICAL:** If you use the `lifespan` parameter, all `@app.on_event()` decorators are ignored. Must migrate fully to lifespan pattern.

### Pattern 3: BackgroundTasks for Async Processing
**What:** FastAPI's built-in mechanism to run tasks after response sent
**When to use:** Lightweight async work, no need for persistent queue, process restarts acceptable
**Example:**
```python
# Source: FastAPI background tasks docs (https://fastapi.tiangolo.com/tutorial/background-tasks/)

async def run_full_pass_v2_background(user_id: str, storage_path: str, job_id: str):
    """Background task wrapper for v2 pipeline."""
    try:
        # Import here to avoid circular deps
        from processors.full_pass import run_full_pass_pipeline

        memory_md = await run_full_pass_pipeline(
            user_id=user_id,
            storage_path=storage_path,
        )
        print(f"[v2] Pipeline complete for {user_id}")

    except Exception as e:
        print(f"[v2] Pipeline failed for {user_id}: {e}")
        # Update job status to failed
        await update_job(job_id, status="failed", error=str(e))

@app.post("/process-full-v2")
async def process_full_v2(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    # Validate request
    if not request.storage_path:
        raise HTTPException(status_code=400, detail="storage_path required")

    # Create job record
    job_id = await create_job(request.user_id, request.storage_path, ...)

    # Dispatch to background
    background_tasks.add_task(
        run_full_pass_v2_background,
        request.user_id,
        request.storage_path,
        job_id,
    )

    return {"status": "processing", "job_id": job_id, "version": "v2"}
```

**Important limitations:**
- Tasks run in same process - killed on server restart/redeploy
- No persistence - use job tracking in DB for recovery
- Exceptions swallowed by default - must log explicitly
- For mission-critical jobs, consider Celery (out of scope for Phase 3)

### Pattern 4: Health Check with Module Validation
**What:** Enhanced health endpoint that validates processor imports, not just API availability
**When to use:** Production deployments, need to detect broken modules before serving traffic
**Example:**
```python
# Source: FastAPI health check patterns (https://www.index.dev/blog/how-to-implement-health-check-in-python)

@app.get("/health")
async def health():
    """Basic health check for Render's auto-restart mechanism."""
    health_status = {
        "status": "ok",
        "service": "soulprint-rlm",
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Validate processor imports (lightweight check)
    try:
        from processors.full_pass import run_full_pass_pipeline
        health_status["processors_available"] = True
    except ImportError as e:
        health_status["processors_available"] = False
        health_status["processor_error"] = str(e)
        # Return 503 to trigger Render auto-restart
        raise HTTPException(status_code=503, detail="Processor modules unavailable")

    return health_status
```

**Render.com behavior:**
- After 60 consecutive seconds of failed health checks → auto-restart
- During deployment: New instance must pass health checks before routing traffic
- If health checks fail for 15 minutes during deploy → deploy cancelled

### Anti-Patterns to Avoid
- **Modifying v1 endpoint during v2 deployment:** Breaks backwards compatibility, users relying on v1 behavior will break
- **Using @app.on_event() with lifespan:** on_event() ignored if lifespan set, creates confusion
- **Not validating imports at startup:** Broken processor imports only discovered when endpoint called, not at deploy time
- **Relying on BackgroundTasks for critical jobs:** Tasks lost on restart - use job tracking table for recovery
- **Forgetting to test all existing endpoints:** New code can accidentally break unrelated endpoints via shared dependencies

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Endpoint versioning | Custom router prefix logic | URL path suffix (-v2) | Simple, explicit, no library needed |
| Health check automation | Custom monitoring daemon | Render's built-in health checks | Platform-native, auto-restart on failure |
| Background task queue | Custom threading/multiprocessing | FastAPI BackgroundTasks | Works with async, already integrated |
| Import validation | Runtime try/except in endpoints | Lifespan startup validation | Fail fast at boot, not during user request |
| Rollback procedure | Complex rollback scripts | git revert + push | Simple, auditable, version control native |

**Key insight:** For lightweight async tasks (<10 min, not mission-critical), FastAPI's built-in BackgroundTasks is sufficient. Don't add Celery/Redis complexity until you actually need job persistence across server restarts or multi-worker coordination.

## Common Pitfalls

### Pitfall 1: Forgetting to Import Processors in Lifespan
**What goes wrong:** Processor modules import fine in Dockerfile RUN check, but fail at runtime due to missing env vars or runtime-only dependencies
**Why it happens:** Dockerfile import check is build-time, lifespan validation is runtime with real environment
**How to avoid:**
- Import ALL processor modules in lifespan startup
- Use actual import paths: `from processors.full_pass import run_full_pass_pipeline`
- Let exceptions bubble up - crash the app on import failure
**Warning signs:** Health check passes but endpoint returns 500 when called

### Pitfall 2: Accidentally Breaking v1 Endpoints
**What goes wrong:** New v2 code changes shared dependencies (Pydantic models, helper functions), v1 endpoints break
**Why it happens:** v1 and v2 share `ProcessFullRequest` model, changes to model affect both
**How to avoid:**
- DO NOT modify existing Pydantic models if used by v1
- Create new models for v2 if needed (ProcessFullV2Request)
- Run integration tests for ALL 14 existing endpoints before merging
**Warning signs:** v1 endpoint tests start failing after v2 code added

### Pitfall 3: Health Check Returns 200 During Broken Deploy
**What goes wrong:** Health endpoint returns success even though processors can't import, Render routes traffic to broken instance
**Why it happens:** Health check doesn't validate processor imports, only checks API is running
**How to avoid:**
- Add processor import validation to /health endpoint
- Return 503 Service Unavailable if imports fail
- Test health check behavior with intentionally broken import
**Warning signs:** Deploy succeeds but users get 500 errors when calling /process-full-v2

### Pitfall 4: Background Task Exceptions Silently Swallowed
**What goes wrong:** v2 pipeline fails mid-execution, no error visible, user stuck in "processing" state forever
**Why it happens:** FastAPI BackgroundTasks doesn't propagate exceptions to response, must log explicitly
**How to avoid:**
- Wrap entire background task in try/except
- Log ALL exceptions with context (user_id, step, error message)
- Update job status to "failed" on exception
- Set timeout expectations (if processing takes >30min, mark as failed)
**Warning signs:** Jobs stuck in "processing" status, no error logs

### Pitfall 5: Rollback Documentation Uses Wrong Git SHA
**What goes wrong:** Rollback procedure documented with example SHA, not actual production commit, rollback fails
**Why it happens:** Documentation written before knowing which commit is "last good version"
**How to avoid:**
- Document rollback PROCEDURE, not specific SHA
- Use `git log --oneline -5` to find last good commit at rollback time
- Test rollback procedure in staging before production
- Keep rollback window <24hrs (longer = more commits to wade through)
**Warning signs:** Rollback command reverts to wrong version, doesn't fix issue

### Pitfall 6: Not Testing Render Health Check Integration
**What goes wrong:** Health check works locally but fails on Render due to environment differences
**Why it happens:** Render uses Docker HEALTHCHECK command, different from manual curl testing
**How to avoid:**
- Verify Dockerfile HEALTHCHECK command calls /health endpoint
- Test health check in Docker container locally before deploying
- Check Render dashboard for health check status after deploy
- Health check must complete in <10s (Render's timeout)
**Warning signs:** Render shows service as unhealthy even though /health endpoint works manually

## Code Examples

Verified patterns from official sources:

### Creating Parallel v2 Endpoint
```python
# Source: FastAPI versioning (https://medium.com/@bhagyarana80/versioning-rest-apis-in-fastapi-without-breaking-old-clients-736f75e7dd6e)

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# Request model (SHARED by v1 and v2 - DO NOT MODIFY)
class ProcessFullRequest(BaseModel):
    user_id: str
    storage_path: Optional[str] = None
    conversation_count: Optional[int] = None
    message_count: Optional[int] = None

# v1 endpoint (EXISTING - DO NOT TOUCH)
@app.post("/process-full")
async def process_full(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    """v1 pipeline - LEGACY, DO NOT MODIFY"""
    # ... existing v1 implementation
    return {"status": "processing", "version": "v1"}

# v2 endpoint (NEW)
@app.post("/process-full-v2")
async def process_full_v2(request: ProcessFullRequest, background_tasks: BackgroundTasks):
    """
    v2 pipeline with v1.2 processors:
    - Fact extraction (parallel)
    - MEMORY generation
    - v2 section regeneration
    """
    # Validate required fields
    if not request.storage_path:
        raise HTTPException(
            status_code=400,
            detail="storage_path required for v2 pipeline"
        )

    # Create job record for recovery
    job_id = await create_job(
        request.user_id,
        request.storage_path,
        request.conversation_count or 0,
        request.message_count or 0,
    )

    # Dispatch to background
    background_tasks.add_task(
        run_full_pass_v2_background,
        request.user_id,
        request.storage_path,
        job_id,
    )

    return {
        "status": "processing",
        "version": "v2",
        "job_id": job_id,
        "message": "v2 pipeline started: fact extraction → MEMORY → v2 sections",
    }

async def run_full_pass_v2_background(
    user_id: str,
    storage_path: str,
    job_id: Optional[str],
):
    """Background task for v2 pipeline."""
    try:
        # Import processor orchestrator
        from processors.full_pass import run_full_pass_pipeline

        print(f"[v2] Starting pipeline for user {user_id}")

        # Run full pass pipeline
        memory_md = await run_full_pass_pipeline(
            user_id=user_id,
            storage_path=storage_path,
        )

        print(f"[v2] Pipeline complete for {user_id}")

        if job_id:
            await update_job(
                job_id,
                status="complete",
                progress=100,
                current_step="complete",
            )

    except Exception as e:
        print(f"[v2] Pipeline failed for {user_id}: {e}")

        if job_id:
            await update_job(
                job_id,
                status="failed",
                error=str(e),
            )
```

### Lifespan with Import Validation
```python
# Source: FastAPI lifespan docs (https://fastapi.tiangolo.com/advanced/events/)

from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup/shutdown lifecycle.

    Startup:
    - Validate all processor modules import correctly
    - Fail fast on broken imports (crash the app)

    Shutdown:
    - Cleanup if needed (currently none)
    """
    print("[Startup] Validating processor modules...")

    try:
        # Import all processor modules to validate
        from processors.conversation_chunker import chunk_conversations
        from processors.fact_extractor import (
            extract_facts_parallel,
            consolidate_facts,
            hierarchical_reduce,
        )
        from processors.memory_generator import generate_memory_section
        from processors.v2_regenerator import (
            regenerate_sections_v2,
            sections_to_soulprint_text,
        )
        from processors.full_pass import run_full_pass_pipeline

        print("[Startup] ✓ All processor modules imported successfully")

    except ImportError as e:
        print(f"[FATAL] Processor import failed: {e}")
        raise  # Crash the app - Render will not route traffic

    yield  # Application runs here

    # Shutdown
    print("[Shutdown] Cleanup complete")

app = FastAPI(
    title="SoulPrint RLM Service",
    lifespan=lifespan,  # Register lifespan hooks
)

# IMPORTANT: Remove all @app.on_event() decorators if using lifespan
# They will be ignored and cause confusion
```

### Enhanced Health Check
```python
# Source: FastAPI health check best practices (https://www.index.dev/blog/how-to-implement-health-check-in-python)

from datetime import datetime
from fastapi import HTTPException

@app.get("/health")
async def health():
    """
    Health check for Render auto-restart.

    Validates:
    - API is running
    - Processor modules can import

    Returns 200 if healthy, 503 if broken.
    Render auto-restarts after 60s of 503 responses.
    """
    health_status = {
        "status": "ok",
        "service": "soulprint-rlm",
        "timestamp": datetime.utcnow().isoformat(),
    }

    # Validate processor imports (lightweight check)
    try:
        from processors.full_pass import run_full_pass_pipeline
        health_status["processors"] = "available"
    except ImportError as e:
        health_status["processors"] = "unavailable"
        health_status["error"] = str(e)

        # Return 503 to trigger Render auto-restart
        raise HTTPException(
            status_code=503,
            detail=f"Processor modules unavailable: {e}",
        )

    return health_status
```

### Testing Backwards Compatibility
```python
# Source: pytest FastAPI testing (https://fastapi.tiangolo.com/tutorial/testing/)

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_v1_endpoint_unchanged():
    """Verify v1 /process-full still works after v2 added."""
    response = client.post(
        "/process-full",
        json={
            "user_id": "test-user",
            "storage_path": "user-exports/test/conversations.json",
            "conversation_count": 100,
        },
    )

    assert response.status_code == 200
    data = response.json()

    # v1 endpoint must return these fields
    assert data["status"] == "processing"
    assert data["user_id"] == "test-user"
    assert "job_id" in data or "conversation_count" in data

def test_v2_endpoint_new():
    """Verify v2 /process-full-v2 works."""
    response = client.post(
        "/process-full-v2",
        json={
            "user_id": "test-user",
            "storage_path": "user-exports/test/conversations.json",
        },
    )

    assert response.status_code == 200
    data = response.json()

    # v2 endpoint returns version field
    assert data["status"] == "processing"
    assert data["version"] == "v2"
    assert "job_id" in data

def test_all_existing_endpoints_still_work():
    """Integration test: All 14 production endpoints still respond."""
    endpoints = [
        ("GET", "/health"),
        ("GET", "/health-deep"),
        ("GET", "/status"),
        ("POST", "/chat", {"user_id": "test", "message": "hi"}),
        # ... test all 14 endpoints
    ]

    for method, path, *body in endpoints:
        if method == "GET":
            response = client.get(path)
        else:
            response = client.post(path, json=body[0] if body else {})

        # Should not return 500 or 404
        assert response.status_code in (200, 400, 422), \
            f"{method} {path} returned {response.status_code}"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @app.on_event() decorators | Lifespan context manager | FastAPI 0.93+ (2023) | Cleaner lifecycle, better testing support |
| Manual versioning libraries | URL suffix pattern (-v2) | Industry standard 2024+ | Simpler, no dependencies |
| Custom health check logic | Platform-native health checks | Render/k8s standard | Auto-restart, zero-downtime deploys |
| Synchronous background tasks | FastAPI BackgroundTasks | FastAPI native | Works with async, simpler than Celery |

**Deprecated/outdated:**
- `@app.on_event("startup")` and `@app.on_event("shutdown")` - Replaced by lifespan, ignored if lifespan is set
- Separate health check libraries (fastapi-health, fastapi-healthchecks) - Nice-to-have but not necessary for simple validation
- Complex versioning libraries (fastapi-versioning) - Overkill for simple URL suffix pattern

## Open Questions

1. **Should health check validate DB connectivity or just imports?**
   - What we know: Current /health-deep does full DB validation, /health is lightweight
   - What's unclear: Does import-only validation catch enough issues for production?
   - Recommendation: Keep /health lightweight (imports only), use /health-deep for pre-deploy verification

2. **How to handle in-flight v1 jobs during v2 deployment?**
   - What we know: BackgroundTasks killed on restart, job recovery exists in processing_jobs table
   - What's unclear: Should deployment wait for in-flight jobs to complete?
   - Recommendation: Document recovery procedure, accept that in-flight jobs may need retry (already tracked in DB)

3. **Should v2 endpoint accept legacy conversations field for backwards compat?**
   - What we know: v1 supports both storage_path and conversations, v2 only uses storage_path
   - What's unclear: Will any client code call v2 with conversations field?
   - Recommendation: Accept conversations field but log deprecation warning, only process storage_path

## Sources

### Primary (HIGH confidence)
- FastAPI official docs - Background Tasks: https://fastapi.tiangolo.com/tutorial/background-tasks/
- FastAPI official docs - Lifespan Events: https://fastapi.tiangolo.com/advanced/events/
- FastAPI official docs - Testing: https://fastapi.tiangolo.com/tutorial/testing/
- Render documentation - Health Checks: https://render.com/docs/health-checks
- Render article - FastAPI production best practices: https://render.com/articles/fastapi-production-deployment-best-practices

### Secondary (MEDIUM confidence)
- FastAPI versioning patterns (Medium): https://medium.com/@bhagyarana80/versioning-rest-apis-in-fastapi-without-breaking-old-clients-736f75e7dd6e
- FastAPI health check implementation (Index.dev): https://www.index.dev/blog/how-to-implement-health-check-in-python
- Git revert rollback patterns (Medium): https://medium.com/version-control-system/git-rollback-45a7ff8b4b0d
- pytest FastAPI testing guide: https://pytest-with-eric.com/pytest-advanced/fastapi-fastapi-testing/

### Tertiary (LOW confidence)
- OneUpTime background tasks article (Feb 2026): https://oneuptime.com/blog/post/2026-02-02-fastapi-background-tasks/view
- Better Stack FastAPI background tasks: https://betterstack.com/community/guides/scaling-python/background-tasks-in-fastapi/

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - FastAPI, pytest, uvicorn are industry standards, verified in production repo
- Architecture: HIGH - Patterns verified from official FastAPI docs and production Render setup
- Pitfalls: MEDIUM - Based on common patterns and production RLM codebase, not all tested in this specific context

**Research date:** 2026-02-06
**Valid until:** 60 days (FastAPI stable, patterns unlikely to change)
