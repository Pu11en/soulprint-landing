# RLM Service Technology Stack

**Analysis Date:** 2026-02-06

## Overview

Two implementations analyzed:
- **Production**: `/home/drewpullen/clawd/soulprint-rlm/` (3603 lines, deployed on Render)
- **v1.2 Local**: `/home/drewpullen/clawd/soulprint-landing/rlm-service/` (355 lines core, modular processors)

Both use Python 3.12 + FastAPI. Production is feature-complete monolith. v1.2 is refactored with modular processor architecture.

---

## Languages & Runtime

**Python Version:**
- `3.12-slim` (both versions)
- Specified in `Dockerfile`

**Run Command:**
```bash
uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
```

---

## Core Framework

**FastAPI:**
- Version: `>=0.109.0` (both versions)
- Purpose: REST API service for soulprint generation, querying, chat
- CORS enabled for Vercel frontend + localhost dev

**Uvicorn:**
- Version: `>=0.27.0` (both versions)
- Purpose: ASGI server, handles async HTTP requests

---

## Dependencies - Production Version

**File:** `/home/drewpullen/clawd/soulprint-rlm/requirements.txt`

```
fastapi>=0.109.0
uvicorn>=0.27.0
anthropic>=0.18.0
python-dotenv>=1.0.0
httpx>=0.26.0
rlm @ git+https://github.com/alexzhang13/rlm.git
boto3>=1.34.0
botocore>=1.34.0
```

**Dependencies - v1.2 Version**

**File:** `/home/drewpullen/clawd/soulprint-landing/rlm-service/requirements.txt`

```
fastapi>=0.109.0
uvicorn>=0.27.0
anthropic>=0.18.0
python-dotenv>=1.0.0
httpx>=0.26.0
```

**Key Difference:** v1.2 removes `boto3`/`botocore` (AWS Bedrock embeddings) and `rlm` library dependency. RLM library installed separately in Dockerfile: `pip install --no-cache-dir git+https://github.com/alexzhang13/rlm.git`

---

## Anthropic API Integration

**Library:** `anthropic>=0.18.0` (both versions)

### Models Used

**Production (main.py lines 204-207):**
```python
HAIKU_MODEL = "us.anthropic.claude-3-5-haiku-20241022-v1:0"  # Legacy, fallback
SONNET_MODEL = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"  # Legacy, fallback
SONNET_4_5_MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"  # SoulPrint file generation
HAIKU_4_5_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"  # Fast queries
```

**v1.2 (processors):**
- Fact extraction: `claude-haiku-4-5-20251001`
- Memory generation: `claude-haiku-4-5-20251001`
- Full pass synthesis: `claude-sonnet-4-20250514`
- v2 regeneration: `claude-haiku-4-5-20251001`

### API Usage

**Production:** Uses Anthropic API directly via `anthropic.Anthropic()` client. Calls made in:
- `bedrock_claude_message()` — actually NOT Anthropic, this is mislabeled (see AWS Bedrock section)
- Soulprint generation: soul_md, identity_md, agents_md, user_md files
- Analysis endpoint: `/analyze`

**v1.2:** AsyncAnthropic client (`anthropic.AsyncAnthropic`) for:
- Fact extraction (`processors/fact_extractor.py`)
- Memory section generation (`processors/memory_generator.py`)
- Full pass synthesis (`processors/full_pass.py`)
- v2 regeneration (`processors/v2_regenerator.py`)

### Environment Variables

**Required:**
- `ANTHROPIC_API_KEY` — Anthropic API authentication (both versions)

**Production Additional:**
- `RLM_API_KEY` — Shared secret for /chat endpoint auth (line 1040)

---

## AWS Bedrock Integration (Production Only)

**Libraries:** `boto3>=1.34.0`, `botocore>=1.34.0`

### Configuration

**Lines 187-190 in production main.py:**
```python
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_EMBEDDING_MODEL_ID = os.getenv("BEDROCK_EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0")
```

### Models Used

**Embeddings:**
- `amazon.titan-embed-text-v2:0` (default, 1024-dim vectors)
- For conversation chunk vector search

**Chat:**
- `us.anthropic.claude-3-5-haiku-20241022-v1:0`
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0`
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0`
- `us.anthropic.claude-haiku-4-5-20251001-v1:0`

(Note: These are Anthropic models accessible via Bedrock, not native Bedrock models)

### Functions

**Embedding:**
- `get_bedrock_client()` (line 258) — Creates boto3 bedrock-runtime client
- `embed_text_bedrock()` (line 278) — Calls `bedrock_client.invoke_model()` with Titan v2
- `batch_embed_texts_bedrock()` (line 333) — Parallel batch embedding, max 5 concurrent

**Chat:**
- `bedrock_claude_message()` (line 357) — Invokes Bedrock converse API, handles message formatting

### Health Check (line 1832)
```python
test_embedding = await embed_text_bedrock("health check test")
```

### Startup Recovery (line 3556)
`startup_check_incomplete_embeddings()` — Auto-resume failed embedding jobs on server restart

---

## RLM Library Integration

**Source:** `git+https://github.com/alexzhang13/rlm.git`

### Production Usage

**Imported** (line 26):
```python
from rlm import RLM
RLM_AVAILABLE = True  # (or False if import fails)
```

**Status:** Library imported but **minimal active usage detected**. No `RLM()` instantiation found in main.py. Library availability checked at startup (line 1713) but not actively called for core operations.

### v1.2 Usage

**Does NOT appear in main.py.** Referenced in requirements but not used directly. v1.2 processors implement their own logic instead of relying on RLM library abstractions.

---

## Supabase Integration

**Client:** `httpx.AsyncClient()` — REST API calls (async)

### Connection

**Required Env Vars:**
- `SUPABASE_URL` — Base URL (e.g., `https://swvljsixpvvcirjmflze.supabase.co`)
- `SUPABASE_SERVICE_KEY` — Service role key for admin operations

### Tables Accessed

**Production & v1.2:**
- `user_profiles` — User data, soulprint text, import status
- `conversation_chunks` — Searchable chunks with embeddings
- `processing_jobs` — Job recovery system (production only, track import progress)

### API Endpoints Used

**Common:**
- REST API: `/rest/v1/{table}` for CRUD operations
- Storage API: `/storage/v1/object/{path}` for file download
- RPC: `/rest/v1/rpc/{function_name}` for vector search

**Vector Search Functions:**
- `match_conversation_chunks` — Similarity search across tiers
- `match_conversation_chunks_by_tier` — Tier-specific search

---

## HTTP Client

**Library:** `httpx>=0.26.0` (both versions)

**Usage:**
- Supabase REST API calls
- Background task coordination
- Health checks
- Alert webhooks (production)

**Pattern:** Async context managers with timeout:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.get(...)
```

---

## Environment Variables Required

### Both Versions

| Variable | Purpose | Example |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://swvljsixpvvcirjmflze.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `ANTHROPIC_API_KEY` | Anthropic API auth | `sk-ant-...` |

### Production Only

| Variable | Purpose | Example | Default |
|----------|---------|---------|---------|
| `AWS_ACCESS_KEY_ID` | AWS credentials | - | (required for embeddings) |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials | - | (required for embeddings) |
| `AWS_REGION` | AWS region | `us-east-1` | `us-east-1` |
| `BEDROCK_EMBEDDING_MODEL_ID` | Bedrock embedding model | `amazon.titan-embed-text-v2:0` | `amazon.titan-embed-text-v2:0` |
| `COHERE_API_KEY` | Fallback embeddings | `co-...` | Optional |
| `ALERT_TELEGRAM_BOT` | Telegram bot token | - | Optional |
| `ALERT_TELEGRAM_CHAT` | Telegram chat ID | `7414639817` | Optional |
| `RLM_API_KEY` | Auth for /chat endpoint | - | Optional |
| `VERCEL_API_URL` | Frontend domain | `https://www.soulprintengine.ai` | Optional |

### v1.2 Additional

| Variable | Purpose |
|----------|---------|
| `ALERT_WEBHOOK` | Optional webhook for failure alerts |

---

## Docker Configuration

**Both versions use Python 3.12-slim**

### Production Dockerfile

**File:** `/home/drewpullen/clawd/soulprint-rlm/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app

# Install git for pip install from GitHub
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:${PORT:-10000}/health').raise_for_status()"

EXPOSE 10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
```

**Key:** Health check calls `/health` endpoint, requires `httpx` library

### v1.2 Dockerfile

**File:** `/home/drewpullen/clawd/soulprint-landing/rlm-service/Dockerfile`

```dockerfile
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir git+https://github.com/alexzhang13/rlm.git

# Copy entire service directory (supports multi-file structure)
COPY . .

EXPOSE 10000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
```

**Key Differences:**
- Installs RLM library explicitly in Dockerfile (not in requirements.txt)
- Copies entire service directory (supports processor modules in v1.2)
- No health check endpoint (vs production)
- Simpler CMD (no shell wrapper)

---

## API Endpoints Comparison

### Production (15+ endpoints)

**Chat & Query:**
- `POST /chat` — Chat with memory context (requires RLM_API_KEY header)
- `POST /query` — Query with chunks (returns method: "rlm" or "fallback")
- `POST /analyze` — Deep personality analysis on conversation history

**Import & Processing:**
- `POST /process-import` — Background import from imported_chats table
- `POST /process-full` — Full import pipeline (chunking → embeddings → soulprint)
- `POST /embed-chunks` — Batch embed conversation chunks
- `GET /generate-soulprint/{user_id}` — Generate soulprint from existing chunks
- `POST /create-soulprint` — Create soulprint from conversation export

**Status & Recovery:**
- `POST /complete-embeddings/{user_id}` — Resume failed embeddings
- `GET /embedding-status/{user_id}` — Check embedding progress
- `GET /status` — Global status summary

**Health:**
- `GET /health` — Basic health check
- `GET /health-deep` — Deep check (DB, vector search, embeddings, chat)

**Testing:**
- `GET /test-embed` — Test Bedrock embeddings
- `GET /test-patch` — Test chunk patching flow

### v1.2 (3 core endpoints)

- `POST /process-full` — Full import pipeline (chunking + processing)
- `POST /query` — Query with chunks
- `GET /health` — Health check

**Note:** v1.2 strips down to essentials, removes job recovery and granular status endpoints

---

## Key Technical Differences: Production vs v1.2

| Feature | Production | v1.2 |
|---------|-----------|------|
| **Size** | 3603 lines | 355 lines (main) + processors |
| **Architecture** | Monolithic | Modular processors |
| **Embeddings** | AWS Bedrock Titan v2 (1024-dim) | None (v1.2 skips embeddings) |
| **Chat Provider** | AWS Bedrock (Anthropic models) | Anthropic API directly |
| **RLM Library** | Imported but minimal use | Not used directly |
| **Job Recovery** | Full system (processing_jobs table) | None |
| **Health Checks** | Deep health check (DB, vectors, embeddings, chat) | Basic only |
| **Alert System** | Telegram + webhook | Webhook only |
| **Processors** | Inline in main.py | Modular (`processors/` package) |
| **API Endpoints** | 15+ | 3 |
| **Status Tracking** | Granular (progress %, current_step) | None |

---

## Build & Deployment

**Development:**
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install git+https://github.com/alexzhang13/rlm.git  # if using RLM
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Production (Render):**
- Dockerfile is used for image build
- Environment variables injected at deployment time
- PORT env var defaults to 10000
- Health check for rolling restarts

---

## Dependency Resolution

**RLM Library:**
- Sourced from GitHub: `alexzhang13/rlm.git` (main branch assumed)
- Requires `git` in Docker image
- Potential breaking changes if upstream updates

**AWS Bedrock (Production):**
- Requires AWS credentials in environment
- Must have `bedrock-runtime` service access in AWS region
- Fallback to Cohere API if AWS unavailable

**Anthropic API:**
- Direct HTTPS calls to Anthropic endpoints
- Rate limits apply per key
- Both versions rely on single ANTHROPIC_API_KEY

---

## Summary

**Production** is a feature-complete, job-tracking system with:
- AWS Bedrock for embeddings + chat models
- Comprehensive health/status endpoints
- Recovery system for stuck imports
- Telegram alerting

**v1.2** is a streamlined refactor with:
- Modular processor architecture (easier to extend)
- Direct Anthropic API usage (simpler credentials)
- No vector search (focuses on LLM synthesis instead)
- Smaller deployment footprint

Migration path: Production RLM → v1.2 processors model for cleaner code organization.

---

*Stack analysis: 2026-02-06*
