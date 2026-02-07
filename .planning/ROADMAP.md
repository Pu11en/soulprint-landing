# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- SHIPPED **v1.2 Import UX Streamline** -- Phases 1-3, 9 plans (shipped 2026-02-07)
- 🚧 **v1.3 RLM Production Sync** -- Phases 1-5 (in progress)
- 📋 **v1.4 Chat Personalization Quality** -- Phases 6-7 (planned)

## Phases

<details>
<summary>v1.0 MVP (Phase 1) -- SHIPPED 2026-02-01</summary>

- [x] Phase 1: Mobile MVP (4 UAT tests passed)

See: `.planning/milestones/v1.0-MVP-ROADMAP.md`

</details>

<details>
<summary>v1.1 Stabilization (Phases 1-7) -- SHIPPED 2026-02-06</summary>

- [x] Phase 1: Testing Foundation (2/2 plans) -- completed 2026-02-06
- [x] Phase 2: Memory & Resource Cleanup (3/3 plans) -- completed 2026-02-06
- [x] Phase 3: Race Condition Fixes (3/3 plans) -- completed 2026-02-06
- [x] Phase 4: Security Hardening (6/6 plans) -- completed 2026-02-06
- [x] Phase 5: Observability (2/2 plans) -- completed 2026-02-06
- [x] Phase 6: Comprehensive Testing (3/3 plans) -- completed 2026-02-06
- [x] Phase 7: Type Safety Refinement (3/3 plans) -- completed 2026-02-06

See: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>v1.2 Import UX Streamline (Phases 1-3) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Schema + Quick Pass Pipeline (3/3 plans) -- completed 2026-02-07
- [x] Phase 2: Full Pass Pipeline (3/3 plans) -- completed 2026-02-07
- [x] Phase 3: Chat Integration + UX (3/3 plans) -- completed 2026-02-07

See: `.planning/milestones/v1.2-ROADMAP.md`

</details>

## 🚧 v1.3 RLM Production Sync (In Progress)

**Milestone Goal:** Sync v1.2 processor modules into production soulprint-rlm repo, fix incompatibilities, deploy full pass pipeline to Render.

This milestone merges v1.2's modular processor architecture into the production RLM service running on Render. The work follows a safe, incremental migration pattern: create adapter layer to break circular imports, copy processor modules with modified imports, wire new /process-full-v2 endpoint alongside existing v1 pipeline, implement full pass background processing, and gradually shift traffic from v1 to v2. Zero breaking changes to existing endpoints, instant rollback capability at every step.

### Phase 1: Dependency Extraction
**Goal**: Adapter layer exists and processors can import shared functions without circular dependencies
**Depends on**: Nothing (first phase)
**Requirements**: MERGE-02, MERGE-03
**Success Criteria** (what must be TRUE):
  1. adapters/supabase_adapter.py contains extracted functions (download_conversations, update_user_profile, save_chunks_batch)
  2. Production schema verified — chunk_tier enum values documented
  3. Adapter functions have unit tests with 100% coverage
  4. No production code modified (main.py unchanged, zero risk)
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — TDD: Supabase adapter layer with 100% test coverage

### Phase 2: Copy & Modify Processors
**Goal**: v1.2 processor modules are integrated and Dockerfile can build container with all modules verified
**Depends on**: Phase 1
**Requirements**: MERGE-01, MERGE-04
**Success Criteria** (what must be TRUE):
  1. processors/ directory contains 5 modules from v1.2 with imports modified to use adapter
  2. Dockerfile builds successfully and imports all processor modules at build time
  3. Processor unit tests pass in isolation with mocked adapter
  4. pytest and pytest-asyncio installed and working
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Copy 5 processor modules to production, modify full_pass.py imports, update Dockerfile
- [x] 02-02-PLAN.md — Write processor unit tests and update pytest coverage config

### Phase 3: Wire New Endpoint
**Goal**: /process-full-v2 endpoint exists alongside /process-full v1 with parallel deployment capability
**Depends on**: Phase 2
**Requirements**: PIPE-01, DEPLOY-01, DEPLOY-02, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. /process-full-v2 endpoint accepts requests and dispatches background task
  2. Health check validates all processor modules import correctly at startup
  3. All 14 existing production endpoints continue working (backwards compatibility verified)
  4. Rollback procedure documented with concrete git revert commands
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Migrate to lifespan, add /process-full-v2 endpoint, enhance /health
- [x] 03-02-PLAN.md — Backwards compatibility tests and rollback documentation

### Phase 4: Pipeline Integration
**Goal**: Full pass pipeline completes end-to-end with monitoring and handles large exports gracefully
**Depends on**: Phase 3
**Requirements**: PIPE-02, PIPE-03, PIPE-04, MON-01, MON-02, MON-03
**Success Criteria** (what must be TRUE):
  1. Pipeline executes all 9 steps: chunk → extract facts (parallel) → consolidate → generate MEMORY → regenerate v2 sections → save to DB
  2. Large exports (5000+ conversations) complete without OOM via hierarchical fact reduction
  3. Pipeline failure is non-fatal — users can chat with v1 sections if v2 processing fails
  4. full_pass_status field tracks pipeline state (processing/complete/failed)
  5. FACT_EXTRACTION_CONCURRENCY configurable via environment variable (default 3 for Render Starter tier)
  6. Pipeline errors logged with context (user_id, step, error) for debugging
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Pipeline hardening: configurable concurrency, status tracking, enhanced error logging
- [x] 04-02-PLAN.md — Integration tests for pipeline + SQL migration for full_pass_status columns

### Phase 5: Gradual Cutover
**Goal**: v2 pipeline handles 100% of production traffic and v1 endpoint is deprecated
**Depends on**: Phase 4
**Requirements**: CUT-01, CUT-02, CUT-03, DEPLOY-03
**Success Criteria** (what must be TRUE):
  1. Traffic routes to v1 or v2 pipeline based on configuration (10% → 50% → 100% cutover)
  2. v2 pipeline validated with real user data on production before full cutover
  3. v1 /process-full endpoint deprecated after v2 handles 100% traffic for 7+ days
  4. Production RLM deployed to Render with v1.2 capabilities via git push
**Plans**: 5 plans

Plans:
- [x] 05-01-PLAN.md — Add V2_ROLLOUT_PERCENT traffic routing to Next.js import route
- [x] 05-02-PLAN.md — Add deprecation headers to v1 /process-full endpoint
- [x] 05-03-PLAN.md — Cutover runbook, validation SQL, and production deployment verification
- [ ] 05-04-PLAN.md — Gap closure: Add deprecation headers to production RLM and push to Render
- [ ] 05-05-PLAN.md — Gap closure: Deploy Next.js with V2_ROLLOUT_PERCENT and verify production stack

## 📋 v1.4 Chat Personalization Quality (Planned)

**Milestone Goal:** Make the AI actually feel like YOUR AI — OpenClaw-inspired prompt system that uses all structured sections to create a personalized chat experience.

This milestone eliminates the generic assistant feeling by implementing proper personality injection. The existing database already stores 7 structured sections (SOUL/IDENTITY/USER/AGENTS/TOOLS/MEMORY/ai_name) from the import pipeline, but the chat system doesn't fully utilize them. Phase 6 builds a consistent prompt template used by both Next.js and RLM, filters placeholder text, incorporates the AI's generated name, and adds anti-generic language instructions. Phase 7 deploys the updated RLM service to production and validates end-to-end personality consistency. This is architectural work, not new features — we're composing existing data into prompts that create genuine personalization.

### Phase 6: Prompt Foundation
**Goal**: AI chat uses all 7 sections with consistent personality across Next.js and RLM, no generic filler
**Depends on**: Phase 5
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, IDENT-01, IDENT-02, MEM-01, MEM-02, INFRA-01
**Success Criteria** (what must be TRUE):
  1. System prompt includes all 7 structured sections (SOUL/IDENTITY/USER/AGENTS/TOOLS/MEMORY) when they exist, not generic boilerplate
  2. RLM /query endpoint and Next.js Bedrock fallback produce identical prompts given the same user sections (tested via prompt hash comparison)
  3. AI refers to itself by generated name naturally in conversation (e.g., "I'm Echo" not "I am an AI assistant")
  4. First message from AI is personalized using IDENTITY section, not a generic "Hello, how can I help?"
  5. System prompt uses natural language personality (values/principles from SOUL.md) instead of robotic "NEVER do X" rules
  6. System prompt explicitly forbids chatbot clichés ("Great question!", "I'd be happy to help!")
  7. System prompt instructs model to reference retrieved memory chunks naturally ("Like we discussed..." not ignoring context)
  8. Section validation filters "not enough data" placeholders before prompt composition
  9. Pending DB migrations executed in production (section columns exist and are queryable)
**Plans**: 4 plans

Plans:
- [ ] 06-01-PLAN.md — TDD: Section validation (cleanSection) + formatting (formatSection) helpers with tests
- [ ] 06-02-PLAN.md — Next.js prompt update: use new helpers, add memory/anti-generic instructions, personalized greeting
- [ ] 06-03-PLAN.md — RLM prompt consistency: Python helpers matching TypeScript, identical base prompt
- [ ] 06-04-PLAN.md — Execute pending DB migrations in Supabase (checkpoint)

### Phase 7: Production Deployment
**Goal**: Updated RLM deployed to Render with new prompt system, personality verified end-to-end
**Depends on**: Phase 6
**Requirements**: INFRA-02
**Success Criteria** (what must be TRUE):
  1. Production RLM service on Render includes updated prompt composition code from Phase 6
  2. End-to-end test with real user data confirms AI uses personalized greeting and references its name
  3. RLM /query responses are observably different from generic Claude (references user context, uses personality traits)
  4. Rollback procedure documented in case personality changes are negatively received
**Plans**: TBD

Plans:
- [ ] 07-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dependency Extraction | v1.3 | 1/1 | Complete | 2026-02-06 |
| 2. Copy & Modify Processors | v1.3 | 2/2 | Complete | 2026-02-07 |
| 3. Wire New Endpoint | v1.3 | 2/2 | Complete | 2026-02-07 |
| 4. Pipeline Integration | v1.3 | 2/2 | Complete | 2026-02-07 |
| 5. Gradual Cutover | v1.3 | 3/5 | Gap closure | - |
| 6. Prompt Foundation | v1.4 | 0/4 | Planned | - |
| 7. Production Deployment | v1.4 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-07 after v1.4 roadmap creation*
