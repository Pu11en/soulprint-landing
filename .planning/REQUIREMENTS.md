# Requirements: SoulPrint v1.3

**Defined:** 2026-02-07
**Core Value:** The import-to-chat flow must work reliably every time on production

## v1.3 Requirements

### Code Merge

- [ ] **MERGE-01**: v1.2 processors/ directory (5 modules) copied to production soulprint-rlm repo with modified imports
- [ ] **MERGE-02**: Adapter layer extracts shared functions (download_conversations, update_user_profile, save_chunks_batch) from production main.py into reusable module
- [ ] **MERGE-03**: Circular import between full_pass.py and main.py resolved — processors import from adapter, not main
- [ ] **MERGE-04**: Dockerfile copies processors/ and adapters/ directories with import verification at build time

### Pipeline

- [ ] **PIPE-01**: New /process-full-v2 endpoint dispatches fact extraction, MEMORY generation, and v2 section regeneration as background task
- [ ] **PIPE-02**: Full pass pipeline completes: chunk conversations → extract facts (parallel) → consolidate → generate MEMORY → regenerate v2 sections → save to DB
- [ ] **PIPE-03**: Pipeline handles large exports (5000+ conversations) via hierarchical fact reduction without OOM
- [ ] **PIPE-04**: Pipeline failure is non-fatal — v1 soulprint sections remain functional for chat

### Deployment

- [ ] **DEPLOY-01**: Health check validates all processor modules import correctly at startup
- [ ] **DEPLOY-02**: All 14 existing production endpoints continue working after merge (zero breaking changes)
- [ ] **DEPLOY-03**: Production RLM deployed to Render with v1.2 capabilities via git push
- [ ] **DEPLOY-04**: Rollback procedure documented — git revert + push restores previous version

### Monitoring

- [ ] **MON-01**: full_pass_status field tracks pipeline state (processing/complete/failed) in user_profiles
- [ ] **MON-02**: Concurrency limit configurable via environment variable (FACT_EXTRACTION_CONCURRENCY, default 3)
- [ ] **MON-03**: Pipeline errors logged with context for debugging (user_id, step, error)

### Cutover

- [ ] **CUT-01**: Traffic can route to v1 or v2 pipeline based on configuration (gradual cutover)
- [ ] **CUT-02**: v2 pipeline validated with real user data on production before full cutover
- [ ] **CUT-03**: v1 /process-full endpoint deprecated after v2 handles 100% traffic

## Future Requirements

### Post-Merge Optimization

- **OPT-01**: Conversation size threshold — only trigger v1.2 for 50+ conversations
- **OPT-02**: MEMORY section UI — display MEMORY in profile view
- **OPT-03**: Incremental fact extraction — re-run when user uploads new export
- **OPT-04**: Admin dashboard — track processing stats (success rate, avg time, failures)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tier chunking in v1.2 | Single medium tier adequate for fact extraction |
| Replace quick pass with v1.2 | v1.2 complements, doesn't replace — users need immediate chat |
| Blocking v1.2 processing | 10-30 min wait breaks UX promise |
| Multi-language fact extraction | v2+ feature, English-first |
| Interactive fact review | v2+ feature, needs frontend work |
| Celery/Redis job queue | FastAPI BackgroundTasks sufficient for current scale |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MERGE-01 | TBD | Pending |
| MERGE-02 | TBD | Pending |
| MERGE-03 | TBD | Pending |
| MERGE-04 | TBD | Pending |
| PIPE-01 | TBD | Pending |
| PIPE-02 | TBD | Pending |
| PIPE-03 | TBD | Pending |
| PIPE-04 | TBD | Pending |
| DEPLOY-01 | TBD | Pending |
| DEPLOY-02 | TBD | Pending |
| DEPLOY-03 | TBD | Pending |
| DEPLOY-04 | TBD | Pending |
| MON-01 | TBD | Pending |
| MON-02 | TBD | Pending |
| MON-03 | TBD | Pending |
| CUT-01 | TBD | Pending |
| CUT-02 | TBD | Pending |
| CUT-03 | TBD | Pending |

**Coverage:**
- v1.3 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18

---
*Requirements defined: 2026-02-07*
*Last updated: 2026-02-07 after initial definition*
