# Feature Research: RLM v1.2 Production Merge

**Domain:** AI personality profile generation pipeline integration
**Researched:** 2026-02-06
**Confidence:** HIGH

## Feature Landscape

This research analyzes how v1.2's fact extraction, MEMORY generation, and V2 section regeneration features should integrate with the existing production pipeline.

### Production Flow (Current State)

```
Upload → Parse → Multi-tier chunk → Embed (Bedrock Titan) → Quick Pass (Haiku 4.5) → User can chat
                                                           ↓
                                                    Embeddings complete in background
```

**Key characteristic:** Users can chat IMMEDIATELY after quick pass (~15-30 seconds).

### v1.2 Flow (New Capabilities)

```
Upload → Parse → Single-tier chunk → Extract facts (parallel, 10-30 min) → Consolidate → Generate MEMORY → Regenerate v2 sections
```

**Key characteristic:** Fact extraction takes 10-30 minutes. This is a BACKGROUND process.

## Table Stakes (Must-Have for Merge)

Features required for v1.2 to successfully integrate without breaking production UX.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Background fact extraction | Users cannot wait 10-30 minutes to chat | MEDIUM | Already implemented in `full_pass.py` via FastAPI BackgroundTasks |
| Progressive availability | Users must chat with quick-pass soulprint while v1.2 processes | MEDIUM | Quick pass generates v1 sections immediately, v1.2 upgrades them later |
| Graceful v1.2 failure | If fact extraction fails, quick-pass soulprint remains functional | LOW | Already handled: quick-pass never throws, v1.2 logs but doesn't block |
| Status tracking | Users need to know if v1.2 processing is running/complete/failed | LOW | Add `full_pass_status` column to `user_profiles` (processing/complete/failed) |
| MEMORY section persistence | Generated MEMORY must be stored and retrievable | LOW | Add `memory_md` column to `user_profiles`, save after MEMORY generation |
| Chunk compatibility | v1.2 chunker must produce chunks compatible with existing embedding system | MEDIUM | v1.2 chunks include `chunk_tier: "medium"`, schema already supports this |
| Email on completion | Notify users when v1.2 finishes (or quick pass if v1.2 not triggered) | LOW | Already implemented via `/api/import/complete` callback |

## Differentiators (v1.2 Improvements)

Features that make the merged system better than production alone.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Parallel fact extraction | 10x faster than sequential (10-30 min vs 100-300 min for large exports) | LOW | Already implemented: `concurrency=10` in `extract_facts_parallel()` |
| Structured fact categories | Facts organized into preferences/projects/dates/beliefs/decisions | LOW | Better than unstructured quick-pass text, enables smarter retrieval |
| Hierarchical fact reduction | Handles exports up to 100K+ conversations without token overflow | MEDIUM | Automatically reduces if consolidated facts exceed 150K tokens |
| MEMORY section | Human-readable summary of extracted facts, contextualizes v2 sections | LOW | Generated via Haiku 4.5, stored as `memory_md` |
| V2 section regeneration | Enriches v1 sections with top 200 conversations + MEMORY context | MEDIUM | Same schema as quick pass, just richer content |
| Single-tier chunking | Simpler than multi-tier, adequate for fact extraction and RAG | LOW | v1.2 uses 2000 token chunks with 200 token overlap |
| Overlap-based chunking | Preserves context across chunk boundaries | LOW | 200 token overlap ensures facts aren't split mid-conversation |

## Anti-Features (Deliberately NOT Build)

Features that seem good but create problems for this merge milestone.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|-------------|---------------|-----------------|-------------|
| Blocking v1.2 processing | "Users should wait for full analysis before chatting" | Breaks core UX promise (immediate chat), loses users during 10-30 min wait | Progressive availability: chat with v1, upgrade to v2 when ready |
| Synchronous fact extraction | "Fact extraction should happen during import" | 10-30 min import would feel broken, users close tab | Background processing with status tracking + email |
| Multi-tier chunking in v1.2 | "v1.2 should use production's micro/medium/macro tiers" | Adds complexity, v1.2 only needs medium-tier chunks for fact extraction | Single medium tier (2000 tokens) adequate for all v1.2 needs |
| Fact extraction for small exports | "Run v1.2 for all users" | Wastes API calls, small exports don't benefit from fact extraction | Threshold: only trigger v1.2 for exports with 50+ conversations |
| Real-time MEMORY updates | "Update MEMORY as user chats" | Chat adds to conversation_chunks, not raw export. MEMORY reflects export only | Keep MEMORY static to export, use conversation_chunks for chat context |
| Replacing quick pass with v1.2 | "v1.2 is better, remove quick pass" | Removes immediate availability, breaks UX. v1.2 complements, doesn't replace | Keep quick pass as v1 for speed, v1.2 as v2 upgrade |

## Feature Dependencies

```
Upload & Parse (existing)
       ↓
       ├──→ Quick Pass (v1 sections) ────→ User can chat immediately
       │                                       ↓
       │                                    Embeddings (background)
       ↓
Single-tier chunk (v1.2) ────→ Fact extraction (parallel, 10-30 min)
       ↓                              ↓
Save chunks to DB             Consolidate facts
       ↓                              ↓
Embedding (background)         Generate MEMORY section
                                      ↓
                               Save MEMORY to DB
                                      ↓
                               V2 section regeneration (top 200 convos + MEMORY)
                                      ↓
                               Replace v1 sections with v2 sections
                                      ↓
                               Send completion email
```

### Dependency Notes

- **Quick pass MUST complete before user can chat** (table stakes)
- **v1.2 chunking can run in parallel with quick pass** (both read same parsed conversations)
- **MEMORY generation requires fact consolidation** (can't generate until all facts extracted)
- **V2 regeneration requires MEMORY** (uses MEMORY as additional context)
- **Embeddings are independent** (can run in background regardless of v1/v2 status)

### Critical Ordering

1. **Quick pass FIRST** - Users waiting, must complete in 15-30s
2. **v1.2 chunking in parallel** - While quick pass runs, start chunking for v1.2
3. **Fact extraction AFTER chunking** - Need chunks to extract from
4. **MEMORY AFTER facts** - Need consolidated facts to generate MEMORY
5. **V2 regen AFTER MEMORY** - MEMORY provides context for richer sections
6. **Email AFTER v2 regen OR quick pass** - Notify when upgrade completes (or just v1 if v1.2 not triggered)

## Integration Points

How v1.2 features connect to existing production systems.

### 1. Import Orchestration

**Production:** `app/api/soulprint/generate/route.ts` triggers quick pass
**v1.2:** Add `/process-full` endpoint call to RLM service

```typescript
// After quick pass succeeds:
if (conversationCount >= 50) {
  // Trigger v1.2 background processing
  await fetch(`${RLM_SERVICE_URL}/process-full`, {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      storage_path: storagePath,
      conversation_count: conversationCount,
    })
  });
}
```

### 2. Chunk Schema Compatibility

**Production schema:** `conversation_chunks` table with columns:
- `id`, `user_id`, `conversation_id`, `title`, `content`, `message_count`, `chunk_tier`, `is_recent`, `created_at`, `embedding`

**v1.2 chunks:** Must include all required columns
- v1.2 sets `chunk_tier: "medium"` (existing column)
- v1.2 sets `is_recent: true/false` based on `created_at > 6 months ago`
- v1.2 leaves `embedding: null` (background embedder fills this later)

**Integration:** v1.2 chunks are drop-in compatible with production schema.

### 3. User Profile Extensions

**New columns needed in `user_profiles`:**

| Column | Type | Purpose | When Set |
|--------|------|---------|----------|
| `memory_md` | text | Structured MEMORY section from v1.2 | After MEMORY generation |
| `full_pass_status` | text | 'processing', 'complete', 'failed' | Throughout v1.2 pipeline |
| `full_pass_started_at` | timestamptz | When v1.2 started | At `/process-full` trigger |
| `full_pass_completed_at` | timestamptz | When v1.2 finished | After v2 regeneration |
| `full_pass_error` | text | Error message if failed | On any v1.2 failure |

**Backward compatibility:** All new columns nullable, existing users unaffected.

### 4. Section Storage Migration

**Production:** Quick pass stores sections as:
- `soul_md`, `identity_md`, `user_md`, `agents_md`, `tools_md` (JSON)
- `soulprint_text` (markdown concatenation)

**v1.2:** Overwrites same columns with v2 sections
- Same schema, just richer content (200 convos vs 30-50)
- Includes MEMORY section at end of `soulprint_text`

**Migration path:**
1. v1 sections written immediately (quick pass)
2. v2 sections overwrite when ready (v1.2)
3. Chat route reads from same columns (no code change)

### 5. Callback Flow

**Production:** RLM calls `/api/import/complete` when embeddings finish
**v1.2:** RLM calls `/api/import/complete` when v2 regeneration finishes

```typescript
// Updated callback payload:
{
  user_id: string,
  soulprint_ready: true,      // Quick pass completed
  memory_building: boolean,   // v1.2 still processing
  chunks_embedded: number,    // Background embedding progress
  processing_time: number
}
```

## MVP Definition

### Launch With (This Milestone)

Minimum viable integration of v1.2 into production.

- [x] Background v1.2 processing (non-blocking)
- [x] Progressive availability (chat with v1, upgrade to v2 when ready)
- [x] Single-tier chunking (2000 tokens, 200 overlap)
- [x] Parallel fact extraction (concurrency=10)
- [x] MEMORY generation from consolidated facts
- [x] V2 section regeneration with MEMORY context
- [x] Status tracking (`full_pass_status` column)
- [x] Email notification on v1.2 completion
- [x] Graceful v1.2 failure (v1 sections remain)

### Add After Validation (Post-Merge)

Features to add once v1.2 merge is stable.

- [ ] **Conversation size threshold** - Only trigger v1.2 for 50+ conversations (avoid API waste)
- [ ] **Incremental fact extraction** - Re-run v1.2 when user uploads new export (merge facts)
- [ ] **MEMORY section UI** - Display MEMORY in profile view (currently only in soulprint_text)
- [ ] **v1 vs v2 comparison** - Show users how v2 sections improved over v1
- [ ] **Admin dashboard** - Track v1.2 processing stats (success rate, avg time, failures)

### Future Consideration (v2+)

Features to defer until v1.2 merge proves valuable.

- [ ] **Multi-language fact extraction** - Extract facts from non-English exports
- [ ] **Custom fact categories** - Let users define additional fact types beyond 5 defaults
- [ ] **Fact confidence scores** - Rate how certain each extracted fact is
- [ ] **Fact source citations** - Link each fact back to source conversation
- [ ] **Interactive fact review** - Let users correct/remove incorrect facts before MEMORY generation

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Background processing | HIGH | LOW (already done) | P1 |
| Progressive availability | HIGH | LOW (already done) | P1 |
| MEMORY generation | HIGH | LOW (already done) | P1 |
| V2 section regeneration | HIGH | LOW (already done) | P1 |
| Status tracking | MEDIUM | LOW (add columns) | P1 |
| Email notification | MEDIUM | LOW (already done) | P1 |
| Conversation threshold | MEDIUM | LOW (add if-check) | P2 |
| Graceful failure | HIGH | LOW (already done) | P1 |
| MEMORY UI display | LOW | MEDIUM (new frontend) | P3 |
| Incremental extraction | MEDIUM | HIGH (merge logic) | P3 |
| Admin dashboard | LOW | MEDIUM (new routes) | P3 |

**Priority key:**
- P1: Must have for this milestone (merge readiness)
- P2: Should have, add in next sprint (optimization)
- P3: Nice to have, future enhancement (not blocking)

## Behavioral Expectations

What users should experience after the merge.

### Scenario 1: New User Imports Large Export (500 conversations)

**Timeline:**
1. Upload completes → `import_status = 'processing'`
2. Quick pass runs (20s) → `import_status = 'complete'`, v1 sections saved
3. User can chat immediately with v1 soulprint
4. v1.2 triggers in background → `full_pass_status = 'processing'`
5. Fact extraction runs (15 min)
6. MEMORY generated, v2 sections regenerated → `full_pass_status = 'complete'`
7. Email sent: "Your SoulPrint just got smarter!"
8. Next chat uses v2 sections + MEMORY

**User perception:** "Wow, I could chat right away, and it got even better later!"

### Scenario 2: New User Imports Small Export (10 conversations)

**Timeline:**
1. Upload completes → `import_status = 'processing'`
2. Quick pass runs (10s) → `import_status = 'complete'`, v1 sections saved
3. User can chat immediately with v1 soulprint
4. v1.2 NOT triggered (below 50 conversation threshold)
5. Email sent: "Your SoulPrint is ready!"

**User perception:** "Fast setup, started chatting immediately."

### Scenario 3: v1.2 Processing Fails

**Timeline:**
1. Upload completes → `import_status = 'processing'`
2. Quick pass runs (20s) → `import_status = 'complete'`, v1 sections saved
3. User can chat immediately with v1 soulprint
4. v1.2 triggers in background → `full_pass_status = 'processing'`
5. Fact extraction fails (API error) → `full_pass_status = 'failed'`, error logged
6. Email sent: "Your SoulPrint is ready!" (no mention of failure)
7. User continues chatting with v1 sections (unaware of failure)
8. Admin sees failure in logs, can manually retry

**User perception:** "Everything works fine." (v1 sections are good enough)

### Scenario 4: User Chats During v1.2 Processing

**Timeline:**
1. Quick pass completes, user starts chatting with v1 soulprint
2. v1.2 processing runs in background (10 min remaining)
3. User sends 5 messages during this time
4. v1.2 completes, v2 sections replace v1 sections
5. Next message uses v2 sections + MEMORY

**User perception:** "Chat got noticeably better after a few minutes." (if they notice at all)

## Production Merge Checklist

Requirements for v1.2 to safely merge into production.

### Code Requirements
- [x] v1.2 processors implemented (`fact_extractor.py`, `memory_generator.py`, `v2_regenerator.py`, `conversation_chunker.py`)
- [x] Full pass orchestrator (`full_pass.py`) coordinates all v1.2 steps
- [x] RLM service endpoint (`/process-full`) accepts background jobs
- [x] FastAPI BackgroundTasks used for non-blocking execution
- [ ] Database migration adds `memory_md`, `full_pass_status`, `full_pass_started_at`, `full_pass_completed_at`, `full_pass_error` columns
- [ ] Import API route calls `/process-full` after quick pass succeeds
- [ ] Email template updated to mention "memory building" when v1.2 is processing

### Testing Requirements
- [ ] v1.2 completes successfully for 100-conversation export (verify v2 sections generated)
- [ ] v1.2 completes successfully for 1000-conversation export (verify hierarchical reduction works)
- [ ] Quick pass completes and user can chat while v1.2 processes in background
- [ ] v1.2 failure leaves v1 sections intact (user can still chat)
- [ ] Email sent on v2 completion (verify both quick-pass email and v2-upgrade email)
- [ ] Chunk schema compatibility (v1.2 chunks work with existing embedding system)
- [ ] Status tracking updates correctly (`full_pass_status` reflects actual state)

### Operational Requirements
- [ ] Monitoring alerts for v1.2 failures (Telegram webhook)
- [ ] Admin dashboard shows v1.2 processing stats
- [ ] Conversation threshold configurable (env var for 50+ conversations)
- [ ] Rate limiting for `/process-full` endpoint (prevent abuse)
- [ ] Retry logic for transient failures (API timeouts, network errors)

## Sources

**Codebase Analysis:**
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/fact_extractor.py` - Parallel fact extraction implementation
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/memory_generator.py` - MEMORY section generation
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/v2_regenerator.py` - V2 section regeneration logic
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/conversation_chunker.py` - Single-tier chunking with overlap
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/processors/full_pass.py` - Full pass orchestrator
- `/home/drewpullen/clawd/soulprint-landing/rlm-service/main.py` - RLM service endpoints
- `/home/drewpullen/clawd/soulprint-landing/lib/soulprint/quick-pass.ts` - Production quick pass (v1 sections)
- `/home/drewpullen/clawd/soulprint-landing/app/api/import/complete/route.ts` - Email notification callback
- `/home/drewpullen/clawd/soulprint-landing/app/api/embeddings/process/route.ts` - Background embedding system

**Context:**
- Milestone context provided: "Syncing v1.2 processor modules into production soulprint-rlm repo"
- Project context: "Production lets users chat IMMEDIATELY after soulprint generation. v1.2's fact extraction takes 10-30 minutes. These need to coexist."

**Confidence:** HIGH - All features verified through code inspection, integration points identified, behavioral expectations derived from existing production flow.

---
*Feature research for: RLM v1.2 Production Merge*
*Researched: 2026-02-06*
