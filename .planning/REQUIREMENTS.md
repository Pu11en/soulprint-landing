# Requirements: SoulPrint

**Defined:** 2026-02-11
**Core Value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

## v3.0 Requirements

Requirements for v3.0 Deep Memory. Each maps to roadmap phases.

### Pipeline Reliability

- [x] **PIPE-01**: Full pass chunk saves raise errors on failure instead of silently swallowing HTTP errors
- [x] **PIPE-02**: Fact extraction retries failed chunks with exponential backoff, concurrency reduced from 10 to 3-5
- [x] **PIPE-03**: MEMORY section validated before save — reject placeholder/fallback content, retry generation
- [x] **PIPE-04**: full_pass_status properly tracked end-to-end with error details surfaced in chat UI
- [x] **PIPE-05**: User or system can re-trigger a failed full pass without re-importing

### Memory in Chat

- [x] **MEM-01**: memory_md from full pass is passed to RLM service and included in chat system prompt
- [x] **MEM-02**: Conversation chunks retrieved via semantic search during chat for RAG context
- [x] **MEM-03**: Chat quality measurably improves when full pass is complete vs quick_ready (Opik A/B evaluation)

### Vector Search

- [x] **VSRC-01**: pgvector extension enabled, embedding column added to conversation_chunks with HNSW index
- [x] **VSRC-02**: Titan Embed v2 (768 dims) embeddings generated for all chunks during full pass
- [x] **VSRC-03**: Semantic similarity search at query time replaces "fetch recent chunks" approach
- [x] **VSRC-04**: Embedding cost under $0.10 per user import (verified by cost tracking)

### Cost Tracking

- [x] **COST-01**: Per-user import cost tracked (LLM calls + embeddings) and visible in admin panel

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Memory

- **AMEM-01**: Real-time learning updates conversation_chunks during chat sessions
- **AMEM-02**: Memory decay — older chunks weighted lower in search results
- **AMEM-03**: User can view and manage their memory (delete specific facts)

### Multi-Model Embeddings

- **EMBED-01**: Support multiple embedding models (OpenAI, Cohere) for quality comparison
- **EMBED-02**: Re-embedding pipeline to upgrade existing chunks when models improve

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time soulprint updates during chat | Causes personality drift — established decision |
| Client-side vector search | Requires downloading all embeddings — too much data |
| Dedicated vector DB (Pinecone/Weaviate) | pgvector on Supabase is sufficient, no new infra |
| Embedding during quick pass | Quick pass must stay fast (~30s); embeddings are full pass only |
| User-facing memory controls | v3.0 is infrastructure — user controls are future |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PIPE-01 | Phase 1: Pipeline Reliability | Done |
| PIPE-02 | Phase 1: Pipeline Reliability | Done |
| PIPE-03 | Phase 1: Pipeline Reliability | Done |
| PIPE-04 | Phase 1: Pipeline Reliability | Done |
| PIPE-05 | Phase 1: Pipeline Reliability | Done |
| VSRC-01 | Phase 2: Vector Infrastructure | Done |
| VSRC-02 | Phase 2: Vector Infrastructure | Done |
| MEM-01 | Phase 3: Memory in Chat | Pending |
| MEM-02 | Phase 3: Memory in Chat | Pending |
| VSRC-03 | Phase 3: Memory in Chat | Pending |
| COST-01 | Phase 4: Cost & Quality Measurement | Pending |
| MEM-03 | Phase 4: Cost & Quality Measurement | Pending |
| VSRC-04 | Phase 4: Cost & Quality Measurement | Pending |

**Coverage:**
- v3.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0
- Coverage: 100% ✓

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 after v3.0 roadmap creation (100% coverage)*
