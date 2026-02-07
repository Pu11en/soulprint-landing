# Stack Research: RLM Production Sync

**Domain:** FastAPI Modular Code Merge
**Researched:** 2026-02-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies (Already Present)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Python | 3.12 | Runtime | Current production version, stable for FastAPI async operations |
| FastAPI | >=0.109.0 | Web framework | Built-in dependency injection, async-first, automatic API docs |
| Uvicorn | >=0.27.0 | ASGI server | Production-ready async server for FastAPI |
| Anthropic | >=0.18.0 | LLM API | Claude models for soulprint generation, fact extraction |
| httpx | >=0.26.0 | Async HTTP | Required for Supabase calls and external API integrations |
| python-dotenv | >=1.0.0 | Config | Environment variable management |

**No new dependencies needed.** All required libraries already present in requirements.txt.

### Testing Tools (New - Required for Merge Validation)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| pytest | >=8.0.0 | Test framework | Test all 14 endpoints after merge to ensure backwards compatibility |
| pytest-asyncio | >=0.23.0 | Async test support | Required for testing async FastAPI endpoints |
| httpx[testing] | (included with httpx) | TestClient | FastAPI's recommended testing client |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Docker | Containerization | Already configured for Render deployment |
| .dockerignore | Build optimization | Exclude __pycache__, .git, tests from image |

## Installation

```bash
# Core dependencies (already installed)
pip install -r requirements.txt

# Testing dependencies (NEW - add for merge validation)
pip install pytest>=8.0.0 pytest-asyncio>=0.23.0

# Or update requirements.txt:
echo "pytest>=8.0.0" >> requirements.txt
echo "pytest-asyncio>=0.23.0" >> requirements.txt
```

## Merge Strategy: Modular Monolith Pattern

### Recommended Approach: Package-Based Organization

**Use Python packages with explicit `__init__.py` exposure** instead of adapter pattern or dependency injection containers.

| Aspect | Approach | Why |
|--------|----------|-----|
| Directory Structure | processors/ as Python package | Clean separation, relative imports prevent circular dependencies |
| Function Exposure | Explicit imports in processors/__init__.py | Clear public API, hides implementation details |
| Import Resolution | Relative imports in processors, absolute in main.py | FastAPI-recommended pattern, avoids circular imports |
| Integration | Import processors.* in main.py | Monolith endpoints call modular processors directly |

### Concrete Implementation Pattern

```python
# processors/__init__.py
"""
Public API for SoulPrint processing modules.
Exposes only the functions that main.py needs.
"""
from .conversation_chunker import chunk_conversations
from .fact_extractor import extract_facts_parallel, consolidate_facts, hierarchical_reduce
from .memory_generator import generate_memory_section
from .v2_regenerator import regenerate_sections_v2, sections_to_soulprint_text

__all__ = [
    'chunk_conversations',
    'extract_facts_parallel',
    'consolidate_facts',
    'hierarchical_reduce',
    'generate_memory_section',
    'regenerate_sections_v2',
    'sections_to_soulprint_text',
]

# main.py (production monolith)
from processors import (
    chunk_conversations,
    extract_facts_parallel,
    consolidate_facts,
    hierarchical_reduce,
    generate_memory_section,
    regenerate_sections_v2,
    sections_to_soulprint_text,
)
```

### Import Incompatibility Resolution

**Problem:** full_pass.py imports `download_conversations` and `update_user_profile` from main — but these functions exist in both v1.2 main.py (355 lines) and production main.py (3603 lines) with **identical signatures**.

**Solution:** No adapter needed. The functions are compatible.

```python
# Both versions have identical signatures (verified via grep):

# v1.2 main.py
async def download_conversations(storage_path: str) -> list

# Production main.py
async def download_conversations(storage_path: str) -> list

# v1.2 main.py
async def update_user_profile(user_id: str, updates: dict)

# Production main.py
async def update_user_profile(user_id: str, updates: dict)
```

**Action:** Replace v1.2 main.py imports with production main.py imports. No signature changes needed.

```python
# processors/full_pass.py - BEFORE (v1.2)
from main import download_conversations, update_user_profile

# processors/full_pass.py - AFTER (merged into production)
# No changes needed - same imports work with production main.py
from main import download_conversations, update_user_profile
```

## Dockerfile Changes

**Current Dockerfile already supports multi-file structure.** Line 14: `COPY . .` copies entire rlm-service directory including processors/.

**Recommended optimization:**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install git for pip install from GitHub
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy and install dependencies FIRST (cache optimization)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir git+https://github.com/alexzhang13/rlm.git

# Copy application code LAST (frequently changes, invalidates cache)
COPY main.py .
COPY processors/ ./processors/

# Expose port (Render uses PORT env var, default 10000)
EXPOSE 10000

# Run - use PORT env var from Render
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
```

**Why this order:** Dependencies change rarely (cache hit), application code changes frequently (cache miss acceptable). This saves ~30-60 seconds per rebuild during development.

## Testing Strategy for Merge Validation

### Phase 1: Endpoint Compatibility Tests

Create tests/test_endpoints.py to verify all 14 existing endpoints work after merge.

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_endpoint():
    """Verify /health still works (table stakes)"""
    response = client.get("/health")
    assert response.status_code == 200

def test_query_endpoint():
    """Verify /query still works with RLM"""
    response = client.post("/query", json={
        "user_id": "test-user",
        "message": "Hello",
        "history": []
    })
    assert response.status_code in [200, 422]  # 422 = validation error OK

def test_process_full_endpoint():
    """Verify NEW /process-full endpoint exists"""
    response = client.post("/process-full", json={
        "user_id": "test-user",
        "storage_path": "test/path.json"
    })
    # Endpoint should exist (not 404)
    assert response.status_code != 404
```

### Phase 2: Processor Unit Tests

Test individual processors independently.

```python
# tests/test_processors.py
from processors import chunk_conversations, consolidate_facts

def test_chunk_conversations():
    """Verify chunker creates expected output"""
    conversations = [{"id": "1", "title": "Test", "mapping": {}}]
    chunks = chunk_conversations(conversations, target_tokens=2000)
    assert len(chunks) >= 1
    assert all("content" in chunk for chunk in chunks)
```

### Phase 3: Integration Tests

Test full_pass_pipeline end-to-end with mock data.

```python
# tests/test_integration.py
import pytest
from processors.full_pass import run_full_pass_pipeline

@pytest.mark.asyncio
async def test_full_pass_pipeline_with_mock_data():
    """Test complete pipeline with minimal mock data"""
    # Requires mocking Supabase/Anthropic calls
    # Verifies pipeline doesn't crash on integration
    pass  # Implementation depends on mocking strategy
```

### Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_endpoints.py

# Run with coverage
pytest --cov=. --cov-report=term-missing
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Import Strategy | Python packages with __init__.py | Dependency Injection container (python-dependency-injector) | Adds complexity, external dependency. FastAPI's built-in DI sufficient for endpoints, not needed for internal processor calls |
| Import Strategy | Relative imports in processors/ | Adapter pattern for incompatible functions | Functions are already compatible. Adapter adds unnecessary indirection |
| Testing | pytest + TestClient | Manual curl testing | Not repeatable, doesn't catch regressions, slow feedback |
| Dockerfile COPY | Explicit COPY main.py + processors/ | COPY . . (wildcard) | Current approach works but less cache-efficient. Explicit is better for build time optimization |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `from processors.full_pass import *` | Wildcard imports obscure what's actually used, break static analysis | Explicit imports: `from processors import run_full_pass_pipeline` |
| `async def` in pytest tests | TestClient is synchronous, mixing async complicates test execution | Regular `def test_*()` functions with synchronous TestClient calls |
| `import main` in processors without circular import checks | Can cause circular import if main also imports processors | Use relative imports within processors/, absolute for main.py imports |
| Copying `__pycache__/` or `.git/` to Docker | Bloats image size by 10-50MB, slows builds | Add .dockerignore with common exclusions |

## Stack Patterns by Variant

**If processors need to call each other (processor-to-processor):**
- Use relative imports: `from .conversation_chunker import chunk_conversations`
- Keeps processors directory self-contained
- Example: memory_generator.py might call fact_extractor.py utilities

**If main.py needs to call processors (endpoint-to-processor):**
- Use absolute imports: `from processors import chunk_conversations`
- Clear API boundary between monolith and modules
- Example: /process-full endpoint calls run_full_pass_pipeline

**If processors need utilities from main.py (processor-to-monolith):**
- Import directly: `from main import download_conversations, update_user_profile`
- Only import shared utilities, never import the FastAPI app instance
- Example: full_pass.py needs Supabase helper functions

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fastapi>=0.109.0 | uvicorn>=0.27.0 | FastAPI 0.109+ requires Uvicorn 0.27+ for optimal async performance |
| anthropic>=0.18.0 | python>=3.8 | Async client requires Python 3.8+; using 3.12 is ideal |
| pytest>=8.0.0 | pytest-asyncio>=0.23.0 | Newer pytest versions have better async support |
| httpx>=0.26.0 | fastapi.testclient | TestClient uses httpx internally, version must align |

## Sources

**Official Documentation (HIGH confidence):**
- [FastAPI Multi-File Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/) — Package structure, APIRouter, relative imports
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/) — DI system for avoiding circular imports
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/) — TestClient usage, pytest conventions
- [FastAPI Docker Deployment](https://fastapi.tiangolo.com/deployment/docker/) — COPY order for cache optimization
- [Python Modules Documentation](https://docs.python.org/3/tutorial/modules.html) — __init__.py, __all__, package organization

**Community Best Practices (MEDIUM confidence, verified with official docs):**
- [FastAPI Project Structure for Large Applications (2026)](https://medium.com/@devsumitg/the-perfect-structure-for-a-large-production-ready-fastapi-app-78c55271d15c) — Modular monolith patterns
- [Dependency Injection in FastAPI: 2026 Playbook](https://thelinuxcode.com/dependency-injection-in-fastapi-2026-playbook-for-modular-testable-apis/) — DI vs external containers
- [Resolving FastAPI Circular References Error](https://www.slingacademy.com/article/resolving-fastapi-circular-references-error/) — Circular import solutions
- [Real Python: What Is Python's __init__.py For?](https://realpython.com/python-init-py/) — Package organization patterns
- [pytest with FastAPI Testing](https://pytest-with-eric.com/pytest-advanced/pytest-fastapi-testing/) — Testing patterns for refactoring

**Architecture Patterns (MEDIUM confidence):**
- [Modular Monolith Architecture](https://breadcrumbscollector.tech/modular-monolith-in-python/) — Python-specific modular monolith strategies
- [FastAPI Modular Monolith Starter Kit](https://github.com/arctikant/fastapi-modular-monolith-starter-kit) — Reference implementation
- [Refactoring Guru: Adapter Pattern in Python](https://refactoring.guru/design-patterns/adapter/python/example) — When adapter pattern is appropriate (not needed here)

---
*Stack research for: RLM Production Sync (v1.2 processors/ merge)*
*Researched: 2026-02-06*
