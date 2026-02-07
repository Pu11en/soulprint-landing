# RLM Service Version Sync Analysis

**Analysis Date:** 2026-02-06

## Executive Summary

Two versions of the RLM service exist:
- **Production (Render):** `/home/drewpullen/clawd/soulprint-rlm/main.py` — 3603 lines, monolithic, feature-complete
- **v1.2 (Landing):** `/home/drewpullen/clawd/soulprint-landing/rlm-service/` — 355 lines main.py + modular `processors/` directory

**Key Finding:** v1.2 is a **cleaner rewrite that modularizes production code but doesn't include all endpoints.** The versions solve different problems:
- **Production:** Full feature set with embeddings, job tracking, multiple endpoints
- **v1.2:** Focused pipeline: conversations → chunks → facts → MEMORY → v2 regeneration

**Merge Strategy:** CANNOT drop v1.2 into production as-is. Must selectively backport v1.2's processors/ directory to production while preserving production endpoints.

---

## 1. Production `/process-full` vs v1.2 `/process-full`

### Production (3603 lines) - `process_full_background()`

**Lines 2467-3020:** Full 553-line implementation.

**Steps:**
1. Download conversations from Supabase Storage or accept direct list
2. Parse ChatGPT mapping format → extract messages with timestamps
3. **Multi-tier chunking:**
   - MICRO: 200 chars (precise facts, names, dates)
   - MEDIUM: 2000 chars (conversation context)
   - MACRO: 5000 chars (themes, relationships)
4. Filter/prioritize chunks (macro + medium + recent micro)
5. Insert chunks into Supabase (BATCH_SIZE=100)
6. **Generate SoulPrint FIRST** (enables chat immediately) - calls `generate_soulprint_from_chunks()`
7. Mark import_status = 'complete' — user can chat NOW
8. **Send email notification** via Vercel callback
9. Embed all chunks in background with Bedrock Titan (parallel, 5 concurrent)
10. Final status = 'complete' + embeddings done

**Key Feature:** **User can chat IMMEDIATELY after SoulPrint generation**, embeddings continue in background.

**Output Fields Updated:**
- `import_status` → 'complete' (step 7)
- `embedding_status` → 'processing' → 'complete'
- `memory_status` → 'building' → 'ready'
- `total_chunks`, `total_messages`, `processed_chunks`
- `soulprint`, `soulprint_text`, `archetype`
- `soul_md`, `identity_md`, `agents_md`, `user_md`
- `memory_log`

---

### v1.2 (355 lines) - `process_full_background()`

**Location:** `/home/drewpullen/clawd/soulprint-landing/rlm-service/main.py` lines 156-189

**Steps:**
1. Mark `full_pass_status` = 'processing'
2. **Import and call `run_full_pass_pipeline()` from `processors.full_pass`**
3. Full pipeline returns `memory_md`
4. Mark `full_pass_status` = 'complete'

**That's it.** v1.2 delegates ALL logic to `processors.full_pass.run_full_pass_pipeline()`

**What happens inside that function (lines 107-215 in full_pass.py):**

1. Download conversations from storage
2. Chunk with `processors.conversation_chunker.chunk_conversations()` (target_tokens=2000, overlap=200)
   - **Single tier**, 2000 char default
3. Save chunks to DB in batches (100 at a time)
4. Extract facts in parallel via `processors.fact_extractor.extract_facts_parallel()` (concurrency=10)
   - Uses Claude Haiku 4.5
   - Returns: preferences, projects, dates, beliefs, decisions (JSON)
5. Consolidate facts → dedup
6. Hierarchical reduce if over 150K tokens (recursive)
7. Generate MEMORY section via `processors.memory_generator.generate_memory_section()`
   - Returns markdown, not JSON
8. Save MEMORY to `user_profiles.memory_md`
9. **V2 Regeneration** via `processors.v2_regenerator.regenerate_sections_v2()`
   - Samples top 200 conversations
   - Calls Haiku 4.5 with MEMORY context
   - Returns all 5 sections (soul, identity, user, agents, tools)
10. Save v2 sections + soulprint_text to DB

**Output Fields Updated:**
- `full_pass_status` → 'complete'
- `memory_md` (saved early, step 8)
- `soul_md`, `identity_md`, `user_md`, `agents_md`, `tools_md` (all JSON)
- `soulprint_text` (composite markdown)

---

### Key Differences

| Aspect | Production | v1.2 |
|--------|-----------|------|
| **Chunking Strategy** | Multi-tier (micro/medium/macro, 200/2000/5000 chars) | Single tier (2000 token default) |
| **Embeddings** | Bedrock Titan v2 (parallel, 5 concurrent) | NOT INCLUDED |
| **SoulPrint Generation** | Direct call to `generate_soulprint_from_chunks()` | Derived from MEMORY + v2 sections |
| **Fact Extraction** | Via Haiku 4.5 in full_pass.py | Via separate fact_extractor.py (parallel, 10 concurrent) |
| **MEMORY Section** | Not generated | Explicitly created from facts, high quality |
| **V2 Sections** | Called in `generate_soulprint_from_chunks()` | Separate regeneration with 200 convos + MEMORY context |
| **Chat Access** | Immediate after SoulPrint | After full pipeline complete |
| **Background Continuation** | Embeddings continue | Everything waits for full_pass_status='complete' |

---

## 2. Production Endpoints NOT in v1.2

**All production endpoints (14 total):**

| Endpoint | Type | Purpose | v1.2? |
|----------|------|---------|-------|
| `/health` | GET | Health check | YES (same) |
| `/query` | POST | Chat with memory context | YES (same) |
| `/process-full` | POST | Async full pipeline | YES (different impl) |
| `/create-soulprint` | POST | Direct soulprint creation | NO |
| `/analyze` | POST | Analyze conversation batch | NO |
| `/chat` | POST | Direct chat (legacy) | NO |
| `/process-import` | POST | Legacy import flow | NO |
| `/embed-chunks` | POST | Embed existing chunks (standalone) | NO |
| `/embed-query` | GET | Embed query string | NO |
| `/test-embed` | GET | Test endpoint | NO |
| `/test-patch` | GET | Test endpoint | NO |
| `/generate-soulprint/{user_id}` | GET | Trigger soulprint generation | NO |
| `/status` | GET | Job status | NO |
| `/embedding-status/{user_id}` | GET | Embedding progress | NO |
| `/complete-embeddings/{user_id}` | POST | Force embedding completion | NO |

**Critical Missing Endpoints in v1.2:**
- `/embed-chunks` — needed if you want standalone embedding without full pipeline
- `/create-soulprint` — direct generation endpoint (production has internal version)
- Job tracking endpoints (`/status`, `/embedding-status`, `/complete-embeddings`) — production tracks job_id for recovery
- Legacy endpoints (`/chat`, `/process-import`, `/analyze`) — may still be called by clients

---

## 3. v1.2 Additions NOT in Production

### `processors/` Directory (Modular Decomposition)

v1.2 extracts production logic into separate files:

**`processors/conversation_chunker.py` (249 lines)**
- `estimate_tokens()` — simple char-based estimator (1 token ≈ 4 chars)
- `format_conversation()` — handles both ChatGPT mapping format and simplified format
- `chunk_conversations()` — splits into ~2000 token segments with 200 token overlap
- **Does NOT do multi-tier chunking** (production's micro/medium/macro)

**`processors/fact_extractor.py` (357 lines)**
- `extract_facts_from_chunk()` — Haiku 4.5 call, returns JSON with 5 categories
- `extract_facts_parallel()` — concurrent extraction with semaphore (default 10)
- `consolidate_facts()` — dedup & merge with counts
- `hierarchical_reduce()` — recursive reduction if over 150K tokens
- **NOT in production** — production embeds directly, doesn't extract facts

**`processors/memory_generator.py` (124 lines)**
- `generate_memory_section()` — Haiku 4.5 call, returns markdown MEMORY section
- `_fallback_memory()` — minimal fallback on error
- **NEW in v1.2** — production doesn't generate structured MEMORY

**`processors/v2_regenerator.py` (363 lines)**
- `sample_conversations_for_v2()` — score-based sampling (top 200)
- `format_conversations_for_prompt()` — readable text for LLM
- `regenerate_sections_v2()` — Haiku 4.5 with MEMORY context, returns all 5 sections
- `sections_to_soulprint_text()` — convert sections dict to markdown
- **Partial overlap with production** — production has similar logic inline

**`processors/__init__.py`** — Empty package marker

---

## 4. Can v1.2 `processors/` Be Dropped Into Production As-Is?

**Short answer: NO, but with significant caveats.**

**Issues:**

### Import Problem #1: `full_pass.py` imports from `main.py`

**Line 140 in full_pass.py:**
```python
from main import download_conversations
from main import update_user_profile
```

In v1.2, this works because `main.py` is in the same directory.

**In production repo:** main.py has both functions, but:
- `download_conversations()` is at line ~1500 (named differently, different signature)
- `update_user_profile()` is NOT in production's main.py

**Result:** **Imports would break if processors/ dropped into production.**

### Import Problem #2: Missing dependencies in processors

v1.2 processors import:
```python
import os, json, httpx, asyncio, gzip
from datetime import datetime, timedelta
from typing import Optional, List, Dict
```

All standard/available, but production needs **additional config exports:**
- `SUPABASE_URL` — not in processor, imported from main
- `SUPABASE_SERVICE_KEY` — not in processor, imported from main
- `ANTHROPIC_API_KEY` — used in processors, imported from os

**Issue:** v1.2 passes config via function arguments. Production passes via global env.

### Algorithmic Differences

**Chunking:**
- Production: multi-tier (micro/medium/macro)
- v1.2: single tier (2000 tokens)
- **Cannot coexist** — different database schemas expected

**Fact extraction:**
- Production: doesn't do it
- v1.2: does it (new capability)
- **Can coexist** — but requires Haiku API calls

**Embeddings:**
- Production: Bedrock Titan
- v1.2: not included
- **Cannot replace** — v1.2 would break embedding flow

---

## 5. Does v1.2 `full_pass.py` Import From Production `main.py`? Will Those Imports Work?

**What v1.2 imports from main.py:**

```python
# Line 140
from main import download_conversations
from main import update_user_profile
```

**Will these work in production?**

### `download_conversations()`

**v1.2 signature (line 123):**
```python
async def download_conversations(storage_path: str) -> list:
    """Download conversations.json from Supabase Storage"""
    # Returns: list of conversations (JSON)
    # Handles gzip decompression
```

**Production location:** Line ~1500-1600 range, similar function exists but with different implementation details. **Name matches, but different handling of gzip.**

**Verdict:** **Mostly compatible**, but may need signature adjustment.

### `update_user_profile()`

**v1.2 signature (line 102):**
```python
async def update_user_profile(user_id: str, updates: dict):
    """Update user_profiles table via Supabase REST API"""
    # PATCH with best-effort error handling
```

**Production:** **DOES NOT EXPORT THIS FUNCTION** as standalone. Production has inline PATCH calls throughout `process_full_background()`.

**Verdict:** **WILL FAIL** — function doesn't exist in production main.py for import.

---

## 6. Conflicting Function Names or Data Models

### Function Name Conflicts

| Name | Production | v1.2 | Issue |
|------|-----------|------|-------|
| `process_full_background()` | Line 2467 | Line 156 | Different signatures, different behavior |
| `download_conversations()` | Line ~1500 | Line 123 | Similar but different |
| `parse_chatgpt_conversations()` | Line 868 | Not in main | Only in production |
| `recursive_synthesize()` | Line 1088 | Not in main | Only in production |
| `generate_soulprint_files()` | Line 1342 | Not in main | Only in production |

### Data Model Conflicts

**Database columns expected:**

Production's `conversation_chunks` expects:
```
- user_id
- conversation_id
- title
- content
- chunk_tier (values: "micro", "medium", "macro")
- message_count
- created_at
- is_recent (boolean)
- embedding (vector, nullable)
```

v1.2's `conversation_chunks` expects:
```
- user_id
- conversation_id
- title
- content
- chunk_tier (values: "medium" only, hardcoded)
- created_at
- message_count (0 by default)
- is_recent (calculated, not stored)
```

**Verdict:** **Incompatible** — v1.2 doesn't generate micro/macro chunks, so searching by chunk_tier would fail for those.

---

## 7. Safest Merge Strategy

### Option A: REPLACE (Risky)

Replace production main.py entirely with v1.2 + new endpoints.

**Pros:**
- Cleaner code
- Modular

**Cons:**
- Loses all production endpoints (breaking changes)
- Loses Bedrock embedding capability (required for search)
- Loses job tracking (recovery, progress)
- Loses email notifications (Vercel callback)
- Breaking change for any clients calling legacy endpoints

**Verdict:** NOT RECOMMENDED.

---

### Option B: ADD v1.2 to Production (Recommended)

Keep production main.py intact, but **extract processors/ into production repo:**

1. **Copy processors/ directory to production:**
   ```
   /home/drewpullen/clawd/soulprint-rlm/processors/
   ├── __init__.py
   ├── conversation_chunker.py
   ├── fact_extractor.py
   ├── memory_generator.py
   ├── v2_regenerator.py
   └── full_pass.py (modified, see below)
   ```

2. **Modify `full_pass.py` to work with production imports:**
   ```python
   # Instead of: from main import download_conversations
   # Use: accept as parameter or import with conditional

   async def run_full_pass_pipeline(
       user_id: str,
       storage_path: str,
       conversation_count: int = 0,
       download_fn=None,  # pass production's download_conversations
       update_fn=None     # pass production's update_user_profile
   ):
       if download_fn:
           conversations = await download_fn(storage_path)
       else:
           # fallback
       ...
   ```

3. **In production main.py, add new `/full-pass-v2` endpoint:**
   ```python
   @app.post("/full-pass-v2")
   async def full_pass_v2(request: ProcessFullRequest, background_tasks: BackgroundTasks):
       """New pipeline: facts → MEMORY → v2 sections (no embeddings)"""
       background_tasks.add_task(
           run_full_pass_pipeline,
           user_id=request.user_id,
           storage_path=request.storage_path,
           conversation_count=request.conversation_count,
           download_fn=download_conversations,  # pass existing function
           update_fn=update_user_profile_via_patch  # wrapper
       )
       return {"status": "accepted"}
   ```

4. **Keep existing `/process-full` unchanged** — it still handles embeddings + immediate chat

5. **Make `/process-full` call v1.2 pipeline optionally:**
   ```python
   # In process_full_background, after soulprint generation:
   # Optional: run fact extraction + MEMORY generation
   if request.generate_memory:
       memory_md = await run_full_pass_pipeline(...)
       await update_user_profile(..., memory_md=memory_md)
   ```

---

### Option C: Hybrid (Best for Features)

**Use v1.2's logic to enhance production without replacing:**

1. Extract `processors/conversation_chunker.py` → production can use better chunking
2. Extract `processors/fact_extractor.py` + `memory_generator.py` → new `/generate-facts` endpoint
3. Extract `processors/v2_regenerator.py` → new `/regenerate-v2-sections` endpoint
4. Keep production's `/process-full` for backwards compatibility
5. Allow frontend to optionally call fact generation, MEMORY generation separately

**Advantages:**
- Zero breaking changes
- New capabilities available opt-in
- Production embeddings still work
- Job tracking preserved
- Can A/B test

**Example new flow:**
```
1. POST /process-full → chunks + embeddings + soulprint (existing)
2. Async job:
   3. POST /generate-facts → extract facts from chunks
   4. POST /generate-memory → create MEMORY section
   5. POST /regenerate-v2 → create v2 sections with MEMORY
   6. User gets progressively richer profile
```

---

## 8. Recommended Action Plan

### Phase 1: Evaluate Impact (This Week)
- [ ] Test v1.2 /process-full against production data
- [ ] Measure: chunks created, facts extracted, MEMORY quality
- [ ] Compare to production output

### Phase 2: Backport Processors (Next Week)
- [ ] Copy processors/ to production repo
- [ ] Modify imports to use production's Supabase helpers
- [ ] Add `/generate-facts`, `/generate-memory`, `/regenerate-v2-sections` endpoints
- [ ] Deploy as optional experimental endpoints

### Phase 3: Test Hybrid Flow (Week After)
- [ ] Create new user import test
- [ ] Call /process-full (gets chunks + embeddings + quick soulprint)
- [ ] Async call new endpoints (facts → MEMORY → v2)
- [ ] Verify all data saved correctly
- [ ] No breaking changes to existing clients

### Phase 4: Stabilize (Following Week)
- [ ] Fix any integration issues
- [ ] Document new endpoints for frontend
- [ ] Remove v1.2 as separate service (merge complete)

---

## Critical Migration Notes

### Chunking Strategy Mismatch
- Production: 3 tiers with 3 different sizes → designed for retrieval quality
- v1.2: 1 tier → simpler but loses specificity
- **Resolution:** Keep production's multi-tier chunking, use v1.2's fact extraction ON TOP

### Embedding Pipeline
- Production: Embeds after SoulPrint generation
- v1.2: Doesn't embed at all
- **Resolution:** Keep production's embedding pipeline, skip it if calling /generate-memory-only

### Database Schema
- Don't change conversation_chunks schema
- v1.2 saves data correctly to existing schema
- No migration needed

### Environment Variables
- v1.2 needs: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
- Production has all of these
- No new secrets required

---

## Summary Table

| Aspect | Production | v1.2 | Sync Approach |
|--------|-----------|------|---------------|
| Main endpoints | 14 | 2 | Keep all production, add v1.2 features as optional |
| /process-full logic | Chunks + Embeds + SoulPrint | Facts + MEMORY + V2 | Keep production flow, add v1.2 as alternate |
| Chunking | Multi-tier | Single tier | Keep production's chunking |
| Embeddings | Bedrock Titan | None | Keep production's embedding |
| Fact extraction | Not done | Done (Haiku 4.5) | Import from v1.2 as NEW capability |
| MEMORY generation | Not done | Done (markdown) | Import from v1.2 as NEW capability |
| V2 regeneration | Inline | Modular | Import from v1.2 for cleaner code |
| Job tracking | Yes (job_id) | No (status field) | Keep production's job model |
| Imports compatibility | N/A | Breaks in production | Need wrapper functions |
| Breaking changes | N/A | Significant if merged directly | Use option C (Hybrid) to avoid breaks |

---

*Analysis complete. Ready for merge planning.*
