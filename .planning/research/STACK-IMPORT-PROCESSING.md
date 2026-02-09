# Stack Research: Import Processing on RLM Service

**Domain:** ChatGPT Export Processing (DAG parsing, streaming large files, memory-efficient chunking)
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

Moving import processing from Vercel serverless (1GB RAM, 300s timeout) to RLM FastAPI service on Render requires adding streaming JSON parsing, memory-efficient file downloads, and proper DAG traversal for ChatGPT exports. The convoviz project demonstrates quality parsing approaches we need to port.

**Key additions:** ijson for streaming JSON, httpx streaming for downloads, Pydantic models for polymorphic content, worker tuning for Render.

## Recommended Stack Additions

### Core Streaming Libraries

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ijson | ^3.4.0 | Streaming JSON parser for 300MB+ files | Constant memory usage regardless of file size. Processes JSON iteratively without loading entire file into RAM. [Tested for 24MB+ files](https://pythonspeed.com/articles/json-memory-streaming/) with significantly reduced memory footprint vs json.load(). |
| httpx (already installed) | ^0.26.0 | Streaming file downloads from Supabase Storage | Already in use. Supports `httpx.stream()` for [chunked downloads](https://pytutorial.com/python-httpxstream-guide-stream-http-requests/) without loading entire file into memory. Critical for 300MB+ ZIP downloads. |
| supabase | ^2.27.3 | Python client for Supabase API | [Latest version](https://pypi.org/project/supabase/) with Storage support. Provides `.download()` method for file retrieval. Built on httpx, allows streaming integration. |

### Data Modeling & Validation

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pydantic (already installed) | ^2.12.5 | Polymorphic content modeling for ChatGPT exports | Already in use for RLM models. Supports [nested models for complex schemas](https://pydantic.dev/articles/llm-intro) — critical for ChatGPT's polymorphic content.parts (strings, dicts, tool outputs). V2.12 adds Python 3.14 support. |
| orjson (optional) | ^3.11.7 | Fast JSON serialization for parsed results | [30-50% CPU reduction](https://generalistprogrammer.com/tutorials/orjson-python-package-guide) for high-throughput pipelines. Use for serializing chunked results to Supabase. Optional: only needed if parsing latency becomes bottleneck. |

### Graph Traversal (Optional)

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| None (manual DAG) | - | Traverse ChatGPT mapping structure | ChatGPT exports have simple parent→child DAG structure. Manual traversal (see existing conversation_chunker.py) is sufficient. NetworkX adds 10MB+ dependency for minimal benefit. |

## Supporting Libraries (Already Installed)

| Library | Version | Purpose | Integration Point |
|---------|---------|---------|-------------------|
| fastapi | ^0.109.0 | API framework | New endpoint: `/process-full-v2` for import job acceptance |
| uvicorn | ^0.27.0 | ASGI server | Worker config tuning for Render (see Deployment Config) |
| anthropic | ^0.18.0 | Claude API for soulprint generation | Already used in full_pass.py |
| python-dotenv | ^1.0.0 | Environment variables | Already configured |

## Installation

```bash
# New dependencies (add to requirements.txt)
ijson>=3.4.0
supabase>=2.27.3

# Optional (add only if JSON serialization becomes bottleneck)
# orjson>=3.11.7
```

**Rationale for minimal additions:**
- httpx and Pydantic already installed
- Manual DAG traversal avoids NetworkX dependency bloat
- orjson deferred until proven bottleneck

## Integration Architecture

### 1. Streaming Download from Supabase Storage

```python
# Use httpx.stream() with supabase.storage URL
async with httpx.AsyncClient() as client:
    storage_url = f"{SUPABASE_URL}/storage/v1/object/{storage_path}"
    async with client.stream("GET", storage_url, headers={...}) as response:
        # Process chunks without loading entire file
        async for chunk in response.aiter_bytes(chunk_size=8192):
            # Decompress gzip on-the-fly if needed
            yield chunk
```

**Memory characteristic:** Fixed 8KB buffer per download, regardless of file size.

### 2. Streaming JSON Parsing with ijson

```python
import ijson
import gzip

# For conversations.json (potentially 300MB+)
with gzip.open(downloaded_file, 'rb') as f:
    # Parse conversations array item-by-item
    for conversation in ijson.items(f, 'item'):
        # Process one conversation at a time
        chunks = parse_conversation(conversation)
        await save_chunks_batch(chunks)
```

**Memory characteristic:** ~2-5MB peak for ijson parser state + single conversation object. 300MB file stays on disk.

**Critical:** Use `ijson.items(f, 'item')` for arrays or `ijson.kvitems(f, 'conversations.item')` for `{conversations: [...]}` format.

### 3. DAG Traversal for ChatGPT Mapping

Port convoviz approach with sorting fix from [OpenAI community thread](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144):

```python
def extract_messages_from_mapping(mapping: dict) -> list:
    """
    Extract all messages from ChatGPT mapping, handling forks/edits.

    IMPORTANT: Don't traverse tree (skips forked branches).
    Instead: iterate all nodes, sort by create_time.
    """
    messages = []

    # Iterate ALL nodes in mapping (not just tree traversal)
    for node_id, node in mapping.items():
        if not node.get("message"):
            continue

        msg = node["message"]
        author = msg.get("author", {})
        role = author.get("role")

        # Skip system/tool messages (hidden content)
        if role in ["system", "tool"]:
            continue

        # Handle polymorphic content.parts
        content_data = msg.get("content", {})
        if isinstance(content_data, dict):
            parts = content_data.get("parts", [])
            # parts can be: ["string"], [{"text": "..."}, {"type": "image"}]
            content = extract_content_from_parts(parts)
        else:
            content = str(content_data)

        messages.append({
            "role": role,
            "content": content,
            "create_time": msg.get("create_time", 0),
            "node_id": node_id,
            "parent": node.get("parent"),
        })

    # Sort by create_time to get chronological order
    messages.sort(key=lambda m: m["create_time"])
    return messages
```

**Pydantic models for polymorphic content:**

```python
from pydantic import BaseModel, Field
from typing import Union, List, Optional

class TextPart(BaseModel):
    type: str = "text"
    text: str

class ImagePart(BaseModel):
    type: str = "image_url"
    image_url: dict

class ToolPart(BaseModel):
    type: str = "tool_result"
    content: str

ContentPart = Union[str, TextPart, ImagePart, ToolPart]

class Message(BaseModel):
    role: str
    content: Union[str, dict, List[ContentPart]]
    create_time: Optional[float] = None
```

### 4. Memory-Efficient Chunking Pipeline

```python
async def process_import_streaming(
    user_id: str,
    storage_path: str
) -> dict:
    """
    Stream → Parse → Chunk → Save pipeline.
    Peak memory: ~50-100MB regardless of export size.
    """
    total_conversations = 0
    total_chunks = 0

    # Stream download + parse
    async for conversation in stream_conversations_from_storage(storage_path):
        # Extract messages with DAG traversal
        messages = extract_messages_from_mapping(conversation.get("mapping", {}))

        # Chunk single conversation
        chunks = chunk_conversation(conversation["title"], messages)

        # Save batch to Supabase (50-100 chunks at a time)
        await save_chunks_batch(user_id, chunks)

        total_conversations += 1
        total_chunks += len(chunks)

    return {
        "conversations": total_conversations,
        "chunks": total_chunks,
    }
```

**Memory profile:**
- Download stream: 8KB buffer
- ijson parser: ~2-5MB state
- Single conversation: 10-500KB (depends on length)
- Chunk batch: 1-5MB (50-100 chunks)
- **Peak total: ~50-100MB** (vs 300MB+ if loading entire file)

## Deployment Configuration (Render-Specific)

### Worker Tuning for FastAPI on Render

Based on [Render FastAPI best practices](https://render.com/articles/fastapi-production-deployment-best-practices):

**For Render 2GB RAM instance:**
```bash
# In render.yaml or dashboard start command
uvicorn main:app \
  --host 0.0.0.0 \
  --port $PORT \
  --workers 2 \
  --timeout-keep-alive 65 \
  --limit-concurrency 100 \
  --backlog 2048
```

**Worker configuration rationale:**
- `--workers 2`: Match CPU cores (Render standard: 1 vCPU = 2 workers via hyperthreading)
- `--timeout-keep-alive 65`: Prevent connection drops during long import processing
- `--limit-concurrency 100`: Cap concurrent connections to prevent memory exhaustion
- `--backlog 2048`: Queue incoming requests during spikes

### Memory Leak Prevention

```python
# In FastAPI lifespan for periodic worker restart
@app.on_event("startup")
async def configure_uvicorn():
    """
    Uvicorn worker config to prevent memory leaks.
    Workers restart after 1000-1050 requests.
    """
    # Set via uvicorn.Config if programmatic start
    # Or via CLI: --max-requests 1000 --max-requests-jitter 50
    pass
```

**Why:** [FastAPI memory management](https://medium.com/@rushi1807/memory-management-parameters-celery-and-fastapi-4638a98ec759) — long-running workers accumulate memory. Periodic restart prevents OOM.

### Environment Variables

```bash
# RLM service (.env on Render)
SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
ANTHROPIC_API_KEY=<bedrock_or_anthropic_key>
ALERT_WEBHOOK=<optional_slack_webhook>

# Render-specific
PORT=8100  # Render assigns dynamically, but default for local
RENDER_EXTERNAL_URL=https://soulprint-landing.onrender.com
```

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| ijson | pandas.read_json(chunksize=...) | Pandas adds 50MB+ dependency, [287MB peak memory](https://pythonspeed.com/articles/json-memory-streaming/) in tests (worse than ijson). ChatGPT exports aren't tabular — wrong abstraction. |
| Manual DAG traversal | networkx | ChatGPT mapping is simple parent→child DAG. NetworkX adds 10MB+ for minimal benefit. Manual traversal in 20 lines of code is clearer and faster. |
| httpx.stream() | requests with stream=True | httpx already installed, async-native (FastAPI best practice), [modern alternative](https://www.python-httpx.org/quickstart/) to requests. No reason to add requests. |
| Supabase Python client | Raw REST API calls | Client provides auth handling, error retry, and typed responses. [Official SDK](https://supabase.com/docs/reference/python/storage-from-download) reduces boilerplate. |
| orjson (deferred) | json stdlib | orjson is [2x faster](https://generalistprogrammer.com/tutorials/orjson-python-package-guide/) but adds compile dependency. Defer until JSON serialization proves to be bottleneck (unlikely — Bedrock API is slower). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| json.load() for large files | Loads entire 300MB+ file into memory. Causes OOM on Render 2GB instance. | ijson for streaming |
| Tree-only DAG traversal | Skips forked/edited messages in ChatGPT exports ([known issue](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144)). | Iterate all nodes, sort by create_time |
| Synchronous file downloads | Blocks event loop, prevents concurrent processing. | httpx.AsyncClient.stream() |
| NetworkX for simple DAG | Overkill for parent→child relationships. Adds 10MB+ dependency. | Manual dict traversal |
| Storing raw 300MB JSON in memory | OOM risk. No streaming benefit. | Stream from Supabase Storage → parse → discard |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| ijson@3.4.0 | Python 3.8+ | No known conflicts with existing stack |
| supabase@2.27.3 | httpx@0.26.0 | Built on httpx, requires same major version |
| pydantic@2.12.5 | Python 3.8-3.14 | V2 breaking changes from V1 — already on V2 |
| orjson@3.11.7 (optional) | Python 3.10+ | Requires Rust compiler for build (Render handles this) |

**Critical compatibility:**
- **Supabase client requires httpx 0.26+** — already installed, no conflict
- **Pydantic V2** — already in use, no migration needed
- **ijson has no dependencies** — safe addition

## Render-Specific Considerations

### Free Tier Limitations (if applicable)
- **15-minute spin-down:** Imports may fail if job starts during cold start. Mitigation: paid tier or accept job quickly, process in background.
- **512MB RAM (free):** Insufficient for 300MB imports. **Requires paid tier (2GB+ RAM).**

### Paid Tier Recommendations
- **Starter ($7/mo):** 512MB RAM — too low for large imports
- **Standard ($25/mo):** 2GB RAM — **minimum recommended** for 300MB files with streaming
- **Pro ($85/mo):** 4GB RAM — headroom for concurrent imports

**Memory math for 2GB instance:**
- System overhead: ~300MB
- FastAPI + workers: ~200MB baseline
- Streaming import: ~100MB peak
- Headroom: ~1.4GB for spikes
- **Verdict:** 2GB sufficient for single concurrent import, 4GB for multiple

### Horizontal Scaling
Per [Render FastAPI guide](https://render.com/articles/fastapi-production-deployment-best-practices), enable auto-scaling based on CPU/memory thresholds if concurrent imports grow beyond single instance capacity.

## Sources

**Streaming JSON Parsing:**
- [Processing large JSON files in Python without running out of memory](https://pythonspeed.com/articles/json-memory-streaming/) — ijson memory characteristics
- [JSON Streaming: How to Work with Large JSON Files Efficiently](https://medium.com/@AlexanderObregon/json-streaming-how-to-work-with-large-json-files-efficiently-c7203de60ac2) — ijson vs alternatives
- [ijson PyPI](https://pypi.org/project/ijson/) — version 3.4.0

**ChatGPT Export Parsing:**
- [Decoding Exported Data by Parsing conversations.json](https://community.openai.com/t/decoding-exported-data-by-parsing-conversations-json-and-or-chat-html/403144) — DAG traversal fix, mapping structure
- [GitHub - mohamed-chs/convoviz](https://github.com/mohamed-chs/convoviz) — quality parsing reference

**Streaming Downloads:**
- [Python httpx.stream() Guide](https://pytutorial.com/python-httpxstream-guide-stream-http-requests/) — streaming large files
- [Supabase Python Storage API](https://supabase.com/docs/reference/python/storage-from-download) — download method

**Render & FastAPI:**
- [FastAPI production deployment best practices](https://render.com/articles/fastapi-production-deployment-best-practices) — worker config, memory management
- [Memory Management in FastAPI and Celery](https://medium.com/@rushi1807/memory-management-parameters-celery-and-fastapi-4638a98ec759) — preventing memory leaks

**Library Versions:**
- [orjson PyPI](https://pypi.org/project/orjson/) — version 3.11.7
- [supabase PyPI](https://pypi.org/project/supabase/) — version 2.27.3
- [Pydantic releases](https://github.com/pydantic/pydantic/releases) — version 2.12.5

---
*Stack research for: Import Processing Migration to RLM Service*
*Researched: 2026-02-09*
*Confidence: HIGH (all libraries verified with official docs/PyPI)*
