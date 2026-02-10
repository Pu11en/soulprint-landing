# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- SHIPPED **v1.2 Import UX Streamline** -- Phases 1-3, 9 plans (shipped 2026-02-07)
- SHIPPED **v1.3 RLM Production Sync** -- Phases 1-5 (shipped 2026-02-07)
- SHIPPED **v1.4 Chat Personalization Quality** -- Phases 6-7 (shipped 2026-02-08)
- SHIPPED **v1.5 Full Chat Experience** -- Phases 8-13 (shipped 2026-02-08)
- SHIPPED **v2.0 AI Quality & Personalization** -- Phases 1-5, 14 plans (shipped 2026-02-09)
- SHIPPED **v2.1 Hardening & Integration** -- Phases 1-3 (shipped 2026-02-09)
- ACTIVE **v2.2 Bulletproof Imports** -- Phases 1-3 (in progress)

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

<details>
<summary>v1.3 RLM Production Sync (Phases 1-5) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Dependency Extraction (1/1 plans) -- completed 2026-02-06
- [x] Phase 2: Copy & Modify Processors (2/2 plans) -- completed 2026-02-07
- [x] Phase 3: Wire New Endpoint (2/2 plans) -- completed 2026-02-07
- [x] Phase 4: Pipeline Integration (2/2 plans) -- completed 2026-02-07
- [x] Phase 5: Gradual Cutover (5/5 plans) -- completed 2026-02-07

See: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>v1.4 Chat Personalization Quality (Phases 6-7) -- SHIPPED 2026-02-08</summary>

- [x] Phase 6: Prompt Foundation (5/5 plans) -- completed 2026-02-07
- [x] Phase 7: Production Deployment (2/2 plans) -- completed 2026-02-08

See: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>v1.5 Full Chat Experience (Phases 8-13) -- SHIPPED 2026-02-08</summary>

- [x] Phase 8: DB Schema & Migration (1/1 plans) -- completed 2026-02-08
- [x] Phase 9: Streaming Responses (2/2 plans) -- completed 2026-02-08
- [x] Phase 10: Conversation Management UI (2/2 plans) -- completed 2026-02-08
- [x] Phase 11: Rich Rendering & Dark Mode (3/3 plans) -- completed 2026-02-08
- [x] Phase 12: Web Search Hardening (TBD plans) -- completed 2026-02-08
- [x] Phase 13: Voice Input (TBD plans) -- completed 2026-02-08

See: `.planning/milestones/v1.5-ROADMAP.md`

</details>

<details>
<summary>v2.0 AI Quality & Personalization (Phases 1-5) -- SHIPPED 2026-02-09</summary>

- [x] Phase 1: Evaluation Foundation (2/2 plans) -- completed 2026-02-08
- [x] Phase 2: Prompt Template System (3/3 plans) -- completed 2026-02-09
- [x] Phase 3: Emotional Intelligence (3/3 plans) -- completed 2026-02-09
- [x] Phase 4: Quality Scoring (3/3 plans) -- completed 2026-02-09
- [x] Phase 5: Integration Validation (3/3 plans) -- completed 2026-02-09

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Hardening & Integration (Phases 1-3) -- SHIPPED 2026-02-09</summary>

- [x] Phase 1: RLM Emotional Intelligence Integration (1/1 plans) -- completed 2026-02-09
- [x] Phase 2: Test Type Safety Fixes (1/1 plans) -- completed 2026-02-09
- [x] Phase 3: Web Search Citation Validation (2/2 plans) -- completed 2026-02-09

See: Previous active milestone content (collapsed)

</details>

## v2.2 Bulletproof Imports (ACTIVE)

**Milestone Goal:** Move all heavy import processing from Vercel to RLM (Render), port convoviz-quality parsing (DAG traversal, hidden message filtering, polymorphic parts), make imports work for any size export on any device.

**Overview:** This milestone eliminates the fundamental constraint causing import failures: Vercel serverless (1GB RAM, 300s timeout) cannot handle large ChatGPT exports. By moving all heavy processing to RLM on Render with streaming JSON parsing, we enable any size export (tested up to 2GB) on any device. Convoviz-quality parsing patterns ensure accurate conversation history (no dead branches from edits) and complete content handling (images, attachments). Real progress reporting and actionable error messages complete the bulletproof experience.

### Phase 1: Core Migration - RLM Pipeline with Streaming
**Goal:** All heavy import processing runs on RLM service (Render) with streaming JSON parser for constant-memory processing

**Depends on:** Nothing (first phase)

**Requirements:** IMP-01, IMP-02, IMP-03

**Success Criteria** (what must be TRUE):
1. User uploads ChatGPT export (any size), Vercel authenticates and immediately returns 202 Accepted
2. RLM service downloads from Supabase Storage and processes export with constant memory usage (no OOM failures on 300MB+ files)
3. Import completes successfully for 300MB+ exports that previously failed on Vercel
4. Database shows progress updates (progress_percent) throughout RLM processing pipeline

**Plans:** 5 plans in 4 waves

Plans:
- [x] 01-01-PLAN.md — Database schema + RLM streaming dependencies (Wave 1)
- [x] 01-02-PLAN.md — Port quick pass logic to Python (Wave 1, parallel with 01-01)
- [x] 01-03-PLAN.md — RLM streaming import endpoint (Wave 2)
- [x] 01-04-PLAN.md — Vercel thin proxy integration (Wave 3)
- [x] 01-05-PLAN.md — End-to-end verification (Wave 4, checkpoint)

### Phase 2: Parsing Quality - DAG Traversal and Content Handling
**Goal:** Conversation parsing uses DAG traversal for accurate history and handles all content types correctly

**Depends on:** Phase 1 (needs RLM pipeline established) -- COMPLETE

**Requirements:** PAR-01, PAR-02, PAR-03, PAR-04

**Success Criteria** (what must be TRUE):
1. User's soulprint contains only actual conversation history (no duplicate or dead-branch messages from edits)
2. User's soulprint excludes hidden internal content (tool outputs, browsing traces, reasoning steps)
3. User's conversations with images or attachments are fully captured (all content.parts, not just parts[0])
4. Import works for both raw array and wrapped export formats ([...] and { conversations: [...] })

**Plans:** 1 plan in 1 wave

Plans:
- [ ] 02-01-PLAN.md — DAG traversal helpers, streaming import integration, chunker update (Wave 1)

### Phase 3: UX Enhancement - Progress and Error Clarity
**Goal:** Users see real processing progress and receive actionable error messages when imports fail

**Depends on:** Phase 2 (needs complete pipeline for accurate progress tracking)

**Requirements:** UXP-01, UXP-02, UXP-03

**Success Criteria** (what must be TRUE):
1. User sees specific processing stages ("Downloading export", "Parsing conversations", "Generating soulprint") instead of generic spinner
2. User receives specific error guidance when import fails (e.g., "File too large (2.3GB, max 2GB)" not "Something went wrong")
3. User successfully imports 100MB+ files from mobile devices (iOS Safari, Android Chrome)
4. User can close browser during import and return later to see completion (no page-open requirement)

**Plans:** TBD

Plans:
- [ ] TBD during planning

## Progress

**Execution Order:**
Phases execute sequentially: 1 -> 2 -> 3. Each phase builds on the previous infrastructure.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Migration | 5/5 | Complete | 2026-02-10 |
| 2. Parsing Quality | 0/1 | Ready | - |
| 3. UX Enhancement | 0/TBD | Not started | - |

---
*Last updated: 2026-02-10 -- Phase 2 planned (1 plan), ready for execution*
