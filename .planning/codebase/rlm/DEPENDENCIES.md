# RLM Service Dependencies & Configuration

**Analysis Date:** 2026-02-06

## Dependencies Comparison

### requirements.txt Differences

**Production (soulprint-rlm):**
```
fastapi>=0.109.0
uvicorn>=0.27.0
anthropic>=0.18.0
python-dotenv>=1.0.0
httpx>=0.26.0

# RLM - Recursive Language Models
rlm @ git+https://github.com/alexzhang13/rlm.git

# AWS Bedrock for Titan embeddings
boto3>=1.34.0
botocore>=1.34.0
```

**v1.2 Local (rlm-service):**
```
fastapi>=0.109.0
uvicorn>=0.27.0
anthropic>=0.18.0
python-dotenv>=1.0.0
httpx>=0.26.0
```

**Key Differences:**
- **Production includes RLM package**: `rlm @ git+https://github.com/alexzhang13/rlm.git` (git dependency)
- **Production includes AWS Bedrock**: `boto3>=1.34.0`, `botocore>=1.34.0` for Titan embeddings
- **v1.2 is minimal**: Only core FastAPI, HTTP, and Anthropic dependencies

**Status:** v1.2 is missing critical production dependencies.

---

## Python Imports Used by Production main.py

**Standard Library:**
- `os` - Environment variables
- `re` - Regular expressions
- `json` - JSON parsing
- `time` - Time operations
- `asyncio` - Async operations
- `datetime` (datetime, date) - Timestamp handling

**External Packages:**
- `httpx` (async HTTP client)
- `anthropic` (Claude API)
- `fastapi` (web framework)
- `fastapi.middleware.cors` (CORS support)
- `pydantic` (data validation)
- `python-dotenv` (environment loading)
- `rlm` (Recursive Language Models) - **OPTIONAL** with fallback
- `boto3` (AWS Bedrock) - **OPTIONAL** with fallback
- `botocore.config` (Bedrock config) - **OPTIONAL** with fallback

**Verification Result:** All imports in production main.py are covered by requirements.txt. boto3/botocore use try/except blocks, so they're optional.

---

## Dockerfile Differences

### Production Dockerfile (`/home/drewpullen/clawd/soulprint-rlm/Dockerfile`)
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install git (required for pip install from GitHub)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Copy and install requirements first (for caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY main.py .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:${PORT:-10000}/health').raise_for_status()"

# Expose port (Render uses PORT env var)
EXPOSE 10000

# Run
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
```

### v1.2 Dockerfile (`/home/drewpullen/clawd/soulprint-landing/rlm-service/Dockerfile`)
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install git for pip install from GitHub
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir git+https://github.com/alexzhang13/rlm.git

# Copy entire service directory (supports multi-file structure)
COPY . .

# Expose port (Render uses PORT env var, default 10000)
EXPOSE 10000

# Run - use PORT env var from Render
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
```

**Key Differences:**

| Aspect | Production | v1.2 |
|--------|-----------|------|
| **Git install** | In requirements.txt (cleaner) | Explicit RUN command (less clean) |
| **Health check** | Yes - httpx health probe | No |
| **COPY strategy** | Only `main.py` (minimal) | All files with `COPY .` (supports modular structure) |
| **CMD format** | Shell wrapper `sh -c` | Direct uvicorn (simpler) |

**Implications:**
- Production is optimized for single-file monolith
- v1.2 supports multi-file processors (actual directory: `processors/`)
- v1.2 lacks health check (Render may struggle to restart)

---

## render.yaml Comparison

Both versions are **identical**:

```yaml
services:
  - type: web
    name: soulprint-rlm
    env: docker
    dockerfilePath: ./Dockerfile
    envVars:
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
```

No differences detected.

---

## .gitignore Differences

**Production:**
```
.env
__pycache__/
*.pyc
.venv/
venv/
```

**v1.2:**
```
venv/
.env
```

**Differences:**
- Production includes `__pycache__/` and `*.pyc` (Python bytecode)
- Production includes `.venv/` (virtual env variant)
- v1.2 is minimal (just venv and .env)

**Status:** Production is more complete.

---

## Production-Only Files

### `sql/create_processing_jobs.sql`

Located at: `/home/drewpullen/clawd/soulprint-rlm/sql/create_processing_jobs.sql`

**Purpose:** Database schema for job recovery system

**Contents:**
- `processing_jobs` table with status tracking (pending, processing, complete, failed)
- Columns: user_id, status, storage_path, conversation_count, message_count, current_step, progress, error_message, attempts, timestamps
- Indexes: status, user_id
- Triggers: auto-update `updated_at`
- RLS policies for user access and service role full access

**v1.2 Status:** This table is **NOT** created in v1.2 - it relies on external schema or doesn't implement job recovery.

### `test_patch_fix.sh`

Located at: `/home/drewpullen/clawd/soulprint-rlm/test_patch_fix.sh`

**Purpose:** Test script for production verification

**v1.2 Status:** Not present in local version.

---

## Directory Structure Differences

**Production (soulprint-rlm):**
```
/home/drewpullen/clawd/soulprint-rlm/
├── main.py                 # Monolithic service (138KB)
├── sql/
│   └── create_processing_jobs.sql  # Schema for job recovery
├── requirements.txt        # Full dependencies
├── Dockerfile              # Production-optimized
├── render.yaml
├── .gitignore
├── README.md
└── test_patch_fix.sh
```

**v1.2 (soulprint-landing/rlm-service):**
```
/home/drewpullen/clawd/soulprint-landing/rlm-service/
├── main.py                 # Service entry (11KB)
├── processors/             # Modular processors
│   ├── __init__.py
│   ├── v2_regenerator.py
│   ├── full_pass.py
│   ├── fact_extractor.py
│   ├── conversation_chunker.py
│   └── memory_generator.py
├── requirements.txt        # Minimal dependencies
├── Dockerfile              # Modular-friendly
├── render.yaml
└── .gitignore
```

**Key Difference:** Production is a single 138KB monolith; v1.2 has modular structure but smaller scope.

---

## Critical Gaps in v1.2

| Gap | Impact | Fix |
|-----|--------|-----|
| Missing RLM package | Cannot run RLM at all | Add to requirements.txt + git dependency |
| Missing boto3/botocore | No AWS Bedrock embeddings | Add to requirements.txt |
| No health check in Dockerfile | Render may not detect failures | Add HEALTHCHECK directive |
| No processing_jobs table | No job recovery after crashes | Run create_processing_jobs.sql in Supabase |
| No job recovery system | Incomplete imports get stuck | Implement job tracking in main.py |

---

## Environment Variables Required

Both versions expect:

```bash
SUPABASE_URL                # Supabase project URL
SUPABASE_SERVICE_KEY        # Service role key for DB operations
ANTHROPIC_API_KEY           # Claude API key
```

**Production additionally expects:**
- No additional vars, but boto3/botocore use AWS credentials (typically from IAM role on Render)

**Optional (v1.2):**
- `ALERT_WEBHOOK` - For Discord/Slack failure notifications

---

## Build & Deployment Configuration

**Base Image:** Both use `python:3.12-slim`

**Python Version:** 3.12

**Port:** 10000 (both)

**Deploy Command:**
- Production: `sh -c "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"`
- v1.2: `uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}`

---

## Dependency Summary Table

| Package | Production | v1.2 | Required | Notes |
|---------|-----------|------|----------|-------|
| fastapi | >=0.109.0 | >=0.109.0 | Yes | Web framework |
| uvicorn | >=0.27.0 | >=0.27.0 | Yes | ASGI server |
| anthropic | >=0.18.0 | >=0.18.0 | Yes | Claude API |
| python-dotenv | >=1.0.0 | >=1.0.0 | Yes | Environment loading |
| httpx | >=0.26.0 | >=0.26.0 | Yes | Async HTTP client |
| rlm | git URL | ❌ | Yes | Recursive Language Models |
| boto3 | >=1.34.0 | ❌ | Optional | AWS Bedrock embeddings |
| botocore | >=1.34.0 | ❌ | Optional | Bedrock client config |

---

## Recommendations for v1.2 → Production Alignment

1. **Add to requirements.txt:**
   ```
   # RLM - Recursive Language Models
   rlm @ git+https://github.com/alexzhang13/rlm.git

   # AWS Bedrock for Titan embeddings
   boto3>=1.34.0
   botocore>=1.34.0
   ```

2. **Update Dockerfile:**
   - Move RLM install to requirements.txt
   - Add HEALTHCHECK directive
   - Consider COPY strategy for modular structure

3. **Add SQL schema:**
   - Run `sql/create_processing_jobs.sql` in Supabase
   - Implement job tracking in main.py for crash recovery

4. **Expand .gitignore:**
   - Add `__pycache__/` and `*.pyc`
   - Add `.venv/`

5. **Production main.py features needed in v1.2:**
   - Job recovery system (create_job, update_job)
   - AWS Bedrock fallback for embeddings
   - Error tracking with httpx calls

---

*Dependencies analysis: 2026-02-06*
