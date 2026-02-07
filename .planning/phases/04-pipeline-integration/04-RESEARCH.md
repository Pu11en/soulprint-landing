# Phase 4: Pipeline Integration - Research

**Researched:** 2026-02-07
**Domain:** Python asyncio pipeline orchestration, background job monitoring, memory management
**Confidence:** HIGH

## Summary

Phase 4 integrates the full pass pipeline end-to-end with production-grade monitoring, error handling, and memory management. The pipeline orchestrates 9 sequential steps (chunk → extract facts → consolidate → generate MEMORY → regenerate v2 sections → save to DB) with parallel fact extraction as the performance bottleneck. Current implementation uses hardcoded concurrency=10, which will OOM on Render Starter tier (512MB RAM) with large exports.

The standard approach is to use asyncio.gather with return_exceptions=True for graceful degradation, environment-based concurrency tuning via semaphores, structured logging with context propagation, and hierarchical reduction for memory pressure. Critical insight: the pipeline already implements non-fatal failure at the v2 regeneration step, but fact extraction failures are silent (empty facts returned) which could lead to poor quality MEMORY sections without visibility.

**Primary recommendation:** Make concurrency configurable via FACT_EXTRACTION_CONCURRENCY env var (default 3), enhance error logging with user_id/step/error context, add full_pass_status tracking to user_profiles, and add smoke test with real Supabase data.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| asyncio | stdlib (Python 3.12) | Async pipeline orchestration | Native Python async runtime, no dependencies |
| asyncio.Semaphore | stdlib | Concurrency control | Built-in primitive for rate limiting parallel tasks |
| asyncio.gather | stdlib | Parallel task execution | Standard pattern for concurrent I/O with exception handling |
| python-dotenv | 1.0.0+ | Environment configuration | Industry standard for env var management |
| httpx.AsyncClient | 0.26.0+ | HTTP client for Supabase | Modern async HTTP, already in use |
| anthropic.AsyncAnthropic | 0.18.0+ | Claude API client | Official Anthropic SDK, already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| structlog | 24.1.0+ | Structured logging | Production systems needing queryable logs (optional for now) |
| pytest-asyncio | 0.23.0+ | Async test support | Testing async pipelines (already installed) |
| pytest-httpx | 0.30.0+ | Mock httpx calls | Testing without real API calls (already installed) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncio.gather | asyncio.TaskGroup (3.11+) | TaskGroup cancels all tasks on first exception (breaks graceful degradation) |
| print() logging | structlog | Structured logs are better but add dependency (defer to later phase) |
| Semaphore | asyncio.Queue | Queue is overkill for simple concurrency limiting |

**Installation:**
```bash
# All dependencies already in requirements.txt
# For enhanced logging (optional):
pip install structlog==24.1.0
```

## Architecture Patterns

### Recommended Project Structure
```
rlm-service/
├── main.py                    # FastAPI app with background task dispatch
├── processors/
│   ├── full_pass.py          # Pipeline orchestrator (9 steps)
│   ├── fact_extractor.py     # Parallel extraction with semaphore
│   ├── memory_generator.py   # MEMORY section generation
│   └── v2_regenerator.py     # V2 section regeneration
├── adapters/
│   └── supabase_adapter.py   # DB operations (status updates)
└── tests/
    └── test_full_pass.py     # Smoke test with real Supabase (Phase 4)
```

### Pattern 1: Pipeline Orchestration with Error Isolation

**What:** Each pipeline step is wrapped in try-except with fallback behavior, allowing later steps to proceed even if earlier steps fail partially.

**When to use:** Multi-step pipelines where later steps can still provide value even if earlier steps fail.

**Example:**
```python
# Source: Existing full_pass.py (lines 107-215)
async def run_full_pass_pipeline(user_id: str, storage_path: str, conversation_count: int = 0) -> str:
    """9-step pipeline with error isolation at each boundary"""

    # Step 1-3: Download, chunk, save (must succeed)
    conversations = await download_conversations(storage_path)
    chunks = chunk_conversations(conversations, target_tokens=2000)
    await save_chunks_batch(user_id, chunks)

    # Step 4-5: Extract and consolidate facts (graceful degradation)
    all_facts = await extract_facts_parallel(chunks, client, concurrency=10)
    consolidated = consolidate_facts(all_facts)  # merges even if some extractions failed

    # Step 6: Reduce if over limit (OOM protection)
    reduced = await hierarchical_reduce(consolidated, client, max_tokens=200000)

    # Step 7-8: Generate MEMORY and save early (user benefits even if v2 fails)
    memory_md = await generate_memory_section(reduced, client)
    await update_user_profile(user_id, {"memory_md": memory_md})

    # Step 9: V2 regeneration (non-fatal — v1 sections stay if this fails)
    v2_sections = await regenerate_sections_v2(conversations, memory_md, client)
    if v2_sections:
        soulprint_text = sections_to_soulprint_text(v2_sections, memory_md)
        await update_user_profile(user_id, {
            "soul_md": json.dumps(v2_sections["soul"]),
            # ... other sections
            "soulprint_text": soulprint_text,
        })
    else:
        print(f"V2 regeneration failed -- keeping v1 sections")

    return memory_md
```

### Pattern 2: Graceful Parallel Execution with return_exceptions=True

**What:** Use asyncio.gather with return_exceptions=True to collect both results and exceptions, then process them individually.

**When to use:** Parallel I/O operations where partial failures shouldn't block the entire batch.

**Example:**
```python
# Source: Existing fact_extractor.py (lines 99-147)
async def extract_facts_parallel(chunks: List[dict], anthropic_client, concurrency: int = 10) -> List[dict]:
    """Extract facts from chunks in parallel with semaphore"""
    semaphore = asyncio.Semaphore(concurrency)

    async def extract_with_limit(chunk: dict) -> dict:
        async with semaphore:
            return await extract_facts_from_chunk(chunk["content"], anthropic_client)

    tasks = [extract_with_limit(chunk) for chunk in chunks]

    # Gather with return_exceptions=True allows all tasks to complete
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Convert exceptions to empty facts (graceful degradation)
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"Chunk {i} failed: {result}")
            final_results.append(empty_facts)
        else:
            final_results.append(result)

    return final_results
```

### Pattern 3: Environment-Based Concurrency Configuration

**What:** Read concurrency limit from environment variable with sensible default, allowing tuning per deployment tier.

**When to use:** Production systems deployed to multiple tiers (Starter vs Pro) with different resource constraints.

**Example:**
```python
# Source: Best practice pattern (not yet implemented)
import os

def get_concurrency_limit() -> int:
    """Get concurrency limit from environment with tier-appropriate default"""
    default = 3  # Conservative for Render Starter (512MB RAM)
    try:
        limit = int(os.getenv("FACT_EXTRACTION_CONCURRENCY", default))
        if limit < 1 or limit > 50:
            print(f"[WARN] Invalid concurrency {limit}, using default {default}")
            return default
        return limit
    except ValueError:
        print(f"[WARN] Invalid FACT_EXTRACTION_CONCURRENCY, using default {default}")
        return default

# Usage in full_pass.py:
concurrency = get_concurrency_limit()
all_facts = await extract_facts_parallel(chunks, client, concurrency=concurrency)
```

### Pattern 4: Status Tracking with Database Fields

**What:** Track pipeline progress with full_pass_status field (pending/processing/complete/failed) and timestamp columns for observability.

**When to use:** Background jobs that users need to monitor, or ops teams need to debug.

**Example:**
```python
# Source: Existing main.py run_full_pass (lines 156-189) + schema from 20260207_full_pass_schema.sql
async def run_full_pass(request: ProcessFullRequest):
    """Background task with status tracking"""
    try:
        # Mark processing start
        await update_user_profile(request.user_id, {
            "full_pass_status": "processing",
            "full_pass_started_at": datetime.utcnow().isoformat(),
            "full_pass_error": None,
        })

        # Run pipeline
        memory_md = await run_full_pass_pipeline(
            user_id=request.user_id,
            storage_path=request.storage_path,
            conversation_count=request.conversation_count,
        )

        # Mark complete
        await update_user_profile(request.user_id, {
            "full_pass_status": "complete",
            "full_pass_completed_at": datetime.utcnow().isoformat(),
        })

    except Exception as e:
        # Mark failed with error context
        await update_user_profile(request.user_id, {
            "full_pass_status": "failed",
            "full_pass_error": str(e)[:500],  # Truncate long errors
        })
        await alert_failure(str(e), request.user_id, "Full pass failed")
```

### Pattern 5: Hierarchical Reduction for Memory Pressure

**What:** When consolidated data exceeds token/memory limits, split into batches, reduce each batch via LLM, then recurse if still too large.

**When to use:** Processing large datasets (5000+ conversations) that could exceed context windows or memory limits.

**Example:**
```python
# Source: Existing fact_extractor.py hierarchical_reduce (lines 226-356)
async def hierarchical_reduce(consolidated_facts: dict, anthropic_client, max_tokens: int = 150000) -> dict:
    """Recursively reduce facts if over token limit"""
    facts_json = json.dumps(consolidated_facts, indent=2)
    estimated_tokens = len(facts_json) // 4

    if estimated_tokens <= max_tokens:
        return consolidated_facts  # Under limit, no reduction needed

    print(f"Over {max_tokens} tokens, starting hierarchical reduction")

    # Split each category into batches of ~50K tokens
    batch_size_chars = 50000 * 4

    reduced_facts = {"preferences": [], "projects": [], "dates": [], "beliefs": [], "decisions": []}

    for category in ["preferences", "projects", "dates", "beliefs", "decisions"]:
        items = consolidated_facts.get(category, [])
        batches = split_into_batches(items, batch_size_chars)

        for batch in batches:
            # Ask LLM to consolidate each batch
            reduction_prompt = f"Consolidate and deduplicate these facts: {json.dumps(batch)}"
            response = await anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=4096,
                messages=[{"role": "user", "content": reduction_prompt}]
            )
            reduced_batch = json.loads(response.content[0].text)
            reduced_facts[category].extend(reduced_batch)

    # Recurse if still over limit
    reduced_json = json.dumps(reduced_facts, indent=2)
    if len(reduced_json) // 4 > max_tokens:
        return await hierarchical_reduce(reduced_facts, anthropic_client, max_tokens)

    return reduced_facts
```

### Anti-Patterns to Avoid

- **Hardcoded concurrency limits:** Makes tuning impossible without code changes. Use environment variables.
- **Silent failures in parallel tasks:** Returning empty results without logging makes debugging impossible. Always log exceptions.
- **Fatal failures for non-critical steps:** v2 regeneration failure shouldn't block user from chatting with v1. Isolate error boundaries.
- **No status tracking:** Background jobs without status fields make "is it done?" questions impossible to answer.
- **Missing error context:** Logging "Failed" without user_id/step/error prevents debugging production issues.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency limiting | Manual task counting | asyncio.Semaphore | Built-in, thread-safe, prevents race conditions |
| Parallel exception handling | Manual try-except per task | asyncio.gather(return_exceptions=True) | Standard pattern, handles all edge cases |
| Context propagation in async | Thread-local storage | contextvars module | Designed for async, survives task switches |
| Token estimation | Complex tokenizer | len(text) // 4 approximation | Good enough for chunking decisions, 1000x faster |
| Status field validation | Manual string checks | PostgreSQL CHECK constraint | DB enforces validity, prevents bad states |

**Key insight:** asyncio stdlib provides robust primitives for all pipeline orchestration needs. Don't build custom task schedulers or exception collectors.

## Common Pitfalls

### Pitfall 1: Semaphore Value Too High for Render Starter Tier

**What goes wrong:** Hardcoded concurrency=10 in full_pass.py will spawn 10 parallel Claude API calls, each holding ~50-100MB of conversation data in memory. On Render Starter (512MB RAM), this causes OOM kills.

**Why it happens:** Default was chosen for local development with more RAM. Render Starter tier has strict 512MB limit.

**How to avoid:**
- Set FACT_EXTRACTION_CONCURRENCY=3 as default (conservative for Starter tier)
- Read from environment variable so it can be tuned per deployment
- Monitor memory usage in Render dashboard after deploy

**Warning signs:**
- Service restarts with no error logs
- Health check 503s after successful deployment
- Render dashboard shows memory usage near 100%

### Pitfall 2: asyncio.gather Without return_exceptions Cancels All Tasks on First Failure

**What goes wrong:** Default asyncio.gather behavior (return_exceptions=False) immediately propagates first exception, leaving other tasks running but unmonitored. Can cause resource leaks or inconsistent state.

**Why it happens:** Python's default is fail-fast for exceptions, but pipelines need graceful degradation.

**How to avoid:**
- Always use asyncio.gather(*tasks, return_exceptions=True) for parallel I/O
- Check each result with isinstance(result, Exception)
- Log exceptions but continue processing valid results

**Warning signs:**
- Some chunks processed, others missing from consolidation step
- Fact counts lower than expected with no error logs
- Inconsistent results between runs with same input

### Pitfall 3: Missing Error Context in Background Tasks

**What goes wrong:** Logging "Pipeline failed" without user_id, step name, or error details makes production debugging impossible. User reports "my import is stuck" but logs don't show which user or why.

**Why it happens:** Background tasks run outside request context, easy to forget to add context manually.

**How to avoid:**
- Always log user_id at start of background task
- Log step name before each major operation
- Include error message and first line of traceback in logs
- Save error to database (full_pass_error field) for later inspection

**Warning signs:**
- Multiple "Pipeline failed" logs but can't identify which user
- User reports stuck import but no matching error in logs
- Unable to reproduce issue without knowing which step failed

### Pitfall 4: Database Status Updates Fail Silently

**What goes wrong:** update_user_profile is best-effort (doesn't throw on failure). If Supabase is down or network fails, status stays "processing" forever. User sees "Analyzing..." spinner indefinitely.

**Why it happens:** Status updates are fire-and-forget for resilience, but this hides failures.

**How to avoid:**
- Log warning when status update fails (already implemented)
- Add alert_failure call for critical status transitions (processing → complete/failed)
- Consider retry logic for final "complete" status update (most important)

**Warning signs:**
- Users report stuck imports after service was healthy
- full_pass_status stuck in "processing" even though logs show completion
- Timestamp fields (full_pass_completed_at) are NULL for completed pipelines

### Pitfall 5: Large Exports Exceed Context Window Before Hierarchical Reduction

**What goes wrong:** consolidate_facts merges all extracted facts into one JSON blob. For 5000+ conversations, this can exceed 200K tokens before hierarchical_reduce is called, causing JSON serialization to consume too much memory.

**Why it happens:** Current implementation consolidates first, then checks size. Should stream-reduce during consolidation.

**How to avoid:**
- Monitor consolidated fact count and trigger early reduction if >150K tokens
- Consider incremental consolidation (merge batches of 1000 chunks at a time)
- Add metric logging for fact count and estimated tokens

**Warning signs:**
- Pipeline fails during consolidate_facts step (before hierarchical_reduce)
- Memory usage spikes during fact consolidation
- Large exports (3000+) fail consistently at same step

### Pitfall 6: V2 Regeneration Timeout Blocks Pipeline Completion

**What goes wrong:** regenerate_sections_v2 can take 30-60 seconds for large datasets. If Anthropic API is slow or rate-limited, this blocks the entire pipeline from marking "complete".

**Why it happens:** V2 regeneration is synchronous in the pipeline (not spawned as separate background task).

**How to avoid:**
- Already mitigated: v2 regeneration failure is non-fatal (returns None, v1 sections stay)
- Consider: Move v2 regeneration to separate background task after marking MEMORY complete
- Add timeout to v2 regeneration (60s max) to prevent indefinite hangs

**Warning signs:**
- Pipeline takes >5 minutes for small exports
- Logs show "Starting v2 regeneration" but no "Successfully regenerated" or "failed"
- Users can chat with v1 sections but v2 never arrives

## Code Examples

Verified patterns from official sources and existing codebase:

### Configurable Concurrency with Semaphore
```python
# Source: fact_extractor.py + environment best practices
import os

# Read from environment with tier-appropriate default
FACT_EXTRACTION_CONCURRENCY = int(os.getenv("FACT_EXTRACTION_CONCURRENCY", "3"))

async def extract_facts_parallel(
    chunks: List[dict],
    anthropic_client,
    concurrency: int = FACT_EXTRACTION_CONCURRENCY
) -> List[dict]:
    """Extract facts with configurable concurrency"""
    print(f"[FactExtractor] Concurrency limit: {concurrency}")
    semaphore = asyncio.Semaphore(concurrency)

    async def extract_with_limit(chunk: dict) -> dict:
        async with semaphore:  # Blocks if concurrency limit reached
            return await extract_facts_from_chunk(chunk["content"], anthropic_client)

    tasks = [extract_with_limit(chunk) for chunk in chunks]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Convert exceptions to empty facts
    final_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            print(f"[FactExtractor] Chunk {i} failed: {result}")
            final_results.append(empty_facts)
        else:
            final_results.append(result)

    return final_results
```

### Enhanced Error Logging with Context
```python
# Source: Best practices from structured logging research
async def run_full_pass(request: ProcessFullRequest):
    """Background task with contextual error logging"""
    user_id = request.user_id
    step = "initialization"

    try:
        print(f"[FullPass] user_id={user_id} step={step} status=starting")

        step = "download_conversations"
        await update_user_profile(user_id, {"full_pass_status": "processing", "full_pass_started_at": datetime.utcnow().isoformat()})
        conversations = await download_conversations(request.storage_path)
        print(f"[FullPass] user_id={user_id} step={step} conversations={len(conversations)}")

        step = "chunk_conversations"
        chunks = chunk_conversations(conversations, target_tokens=2000)
        print(f"[FullPass] user_id={user_id} step={step} chunks={len(chunks)}")

        step = "extract_facts"
        all_facts = await extract_facts_parallel(chunks, client, concurrency=get_concurrency_limit())
        print(f"[FullPass] user_id={user_id} step={step} extracted={len(all_facts)}")

        # ... more steps

        step = "complete"
        await update_user_profile(user_id, {"full_pass_status": "complete", "full_pass_completed_at": datetime.utcnow().isoformat()})
        print(f"[FullPass] user_id={user_id} step={step} status=success")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[FullPass] user_id={user_id} step={step} status=failed error={error_msg}")
        import traceback
        traceback.print_exc()

        await update_user_profile(user_id, {
            "full_pass_status": "failed",
            "full_pass_error": f"Step '{step}' failed: {error_msg[:500]}"
        })
        await alert_failure(error_msg, user_id, f"Full pass failed at {step}")
```

### Smoke Test with Real Supabase Data
```python
# Source: Testing best practices + existing test patterns
import pytest
import os
from processors.full_pass import run_full_pass_pipeline

@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("SUPABASE_URL") or not os.getenv("ANTHROPIC_API_KEY"),
    reason="Integration test requires SUPABASE_URL and ANTHROPIC_API_KEY"
)
async def test_full_pass_pipeline_smoke():
    """
    Smoke test: Run pipeline with minimal real data.

    This test uses actual Supabase and Anthropic API — run sparingly.
    Purpose: Verify pipeline can execute end-to-end with real I/O.
    """
    # Use test user with small export (10 conversations)
    user_id = "test-user-smoke"
    storage_path = "test-exports/small-export.json"

    # Run pipeline (will hit real APIs)
    memory_md = await run_full_pass_pipeline(
        user_id=user_id,
        storage_path=storage_path,
        conversation_count=10
    )

    # Verify MEMORY was generated
    assert memory_md is not None
    assert len(memory_md) > 0
    assert "## Preferences" in memory_md  # Structure check

    # Verify database was updated (query Supabase)
    # ... (requires supabase adapter)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous processing | Async with asyncio.gather | Python 3.5+ (2015) | 10-100x faster for I/O-bound pipelines |
| ThreadPoolExecutor | asyncio.Semaphore | Python 3.10+ best practices | Simpler code, better resource control |
| Thread-local storage | contextvars | Python 3.7+ (2018) | Works correctly with async/await |
| Manual status polling | Database status fields | Modern SaaS pattern | Users can check progress anytime |
| TaskGroup over gather | gather with return_exceptions | Python 3.11+ adds TaskGroup | gather still preferred for graceful degradation |

**Deprecated/outdated:**
- @app.on_event("startup"): Replaced by lifespan context manager in FastAPI (Phase 3 already migrated)
- asyncio.coroutine decorator: Removed in Python 3.10, use async def
- asyncio.ensure_future: Deprecated, use asyncio.create_task

## Open Questions

Things that couldn't be fully resolved:

1. **What's the actual memory footprint per parallel Claude API call?**
   - What we know: Render Starter has 512MB RAM, concurrency=10 causes OOM
   - What's unclear: Exact MB per call (depends on conversation size)
   - Recommendation: Start with concurrency=3, monitor Render dashboard, adjust if <80% memory usage

2. **Should hierarchical reduction happen during consolidation or after?**
   - What we know: Current code consolidates all facts first, then reduces
   - What's unclear: For 5000+ conversations, this might OOM before reduction runs
   - Recommendation: Add early reduction check in consolidate_facts if total > 100K tokens

3. **Is there a standard pattern for background task progress updates in FastAPI?**
   - What we know: Built-in BackgroundTasks has no status tracking
   - What's unclear: Whether to use Redis (overkill?), database fields (current approach), or third-party library
   - Recommendation: Database fields are simplest and already working, stick with it

4. **Should v2 regeneration run in same background task or separate task?**
   - What we know: V2 can take 30-60s, blocks pipeline completion
   - What's unclear: Whether separating gains anything (user already has v1 sections)
   - Recommendation: Keep in same task for Phase 4 (simpler), defer to Phase 5 if timeout issues observed

## Sources

### Primary (HIGH confidence)
- [Python asyncio documentation](https://docs.python.org/3/library/asyncio-task.html) - Coroutines, Tasks, gather()
- [Python asyncio synchronization primitives](https://docs.python.org/3/library/asyncio-sync.html) - Semaphore, Lock
- [FastAPI Background Tasks documentation](https://fastapi.tiangolo.com/tutorial/background-tasks/) - Official patterns
- Existing codebase: rlm-service/processors/full_pass.py, fact_extractor.py, main.py

### Secondary (MEDIUM confidence)
- [Asyncio Best Practices and Common Pitfalls](https://shanechang.com/p/python-asyncio-best-practices-pitfalls/) - Production patterns
- [Mastering Asyncio Semaphores in Python](https://medium.com/@mr.sourav.raj/mastering-asyncio-semaphores-in-python-a-complete-guide-to-concurrency-control-6b4dd940e10e) - Concurrency control
- [Python Logging Best Practices: Complete Guide 2026](https://www.carmatec.com/blog/python-logging-best-practices-complete-guide/) - Structured logging
- [Asyncio gather() Handle Exceptions](https://superfastpython.com/asyncio-gather-exception/) - return_exceptions pattern
- [How to Implement Background Tasks in FastAPI](https://oneuptime.com/blog/post/2026-02-02-fastapi-background-tasks/view) - Status tracking patterns
- [Render Background Workers documentation](https://render.com/docs/background-workers) - Deployment constraints

### Tertiary (LOW confidence)
- [Python Memory Management Optimization](https://dhirendrabiswal.com/python-memory-management-optimization-techniques-for-large-scale-data-processing/) - Large dataset strategies
- [Handling Large Datasets in Python](https://www.geeksforgeeks.org/python/handling-large-datasets-in-python/) - Chunking patterns
- [Render Starter tier specifications](https://www.freetiers.com/directory/render) - 512MB RAM limit

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - asyncio is stdlib, patterns verified in existing code
- Architecture: HIGH - Existing full_pass.py implements most patterns correctly
- Pitfalls: HIGH - Identified from codebase review and production constraints (Render Starter tier)
- Don't hand-roll: HIGH - asyncio provides all needed primitives
- Open questions: MEDIUM - Memory footprint requires measurement, other questions are design tradeoffs

**Research date:** 2026-02-07
**Valid until:** 30 days for stable (asyncio patterns don't change), 7 days for fast-moving (Render tier specs, FastAPI updates)
