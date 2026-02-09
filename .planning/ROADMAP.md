# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- SHIPPED **v1.2 Import UX Streamline** -- Phases 1-3, 9 plans (shipped 2026-02-07)
- SHIPPED **v1.3 RLM Production Sync** -- Phases 1-5 (shipped 2026-02-07)
- SHIPPED **v1.4 Chat Personalization Quality** -- Phases 6-7 (shipped 2026-02-08)
- SHIPPED **v1.5 Full Chat Experience** -- Phases 8-13 (shipped 2026-02-08)
- SHIPPED **v2.0 AI Quality & Personalization** -- Phases 1-5, 14 plans (shipped 2026-02-09)
- ACTIVE **v2.1 Hardening & Integration** -- Phases 1-3 (in progress)

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

## v2.1 Hardening & Integration (ACTIVE)

**Milestone Goal:** Close known gaps from v2.0 — wire emotional intelligence into RLM service, fix all TypeScript test errors, and validate web search citations against hallucination.

**Overview:** This milestone addresses three independent technical debt items discovered during v2.0 execution: RLM service currently bypasses emotional intelligence features (only Bedrock fallback gets EI), cross-language and integration test files have TypeScript errors that don't affect runtime, and web search citations aren't validated before showing to users. Each phase tackles one gap and can run independently.

### Phase 1: RLM Emotional Intelligence Integration
**Goal:** RLM service uses emotional intelligence parameters for adaptive tone and relationship-aware responses

**Depends on:** Nothing (first phase)

**Requirements:** RLEI-01, RLEI-02, RLEI-03, RLEI-04

**Success Criteria** (what must be TRUE):
1. TypeScript chat route passes emotional_state and relationship_arc to RLM service in API request
2. Python PromptBuilder receives EI parameters and uses them when building RLM prompts
3. RLM responses reflect emotional context (warm tone when user is happy, supportive when anxious)
4. Both RLM primary path and Bedrock fallback produce emotionally intelligent responses

**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Wire EI parameters through TypeScript → RLM Python → PromptBuilder

### Phase 2: Test Type Safety Fixes
**Goal:** All test files compile without TypeScript errors in strict mode

**Depends on:** Nothing (independent of Phase 1)

**Requirements:** TEST-01, TEST-02, TEST-03

**Success Criteria** (what must be TRUE):
1. Cross-language sync tests (EmotionalState, PromptBuilderProfile) pass TypeScript compilation
2. Integration test mocks (complete.test.ts, process-server.test.ts) have correct type annotations
3. Running `npx tsc --noEmit` from project root produces zero errors
4. All tests still pass after type fixes (no runtime regressions)

**Plans:** TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Web Search Citation Validation
**Goal:** Web search citations are validated against source content before showing to users

**Depends on:** Nothing (independent of Phases 1-2)

**Requirements:** WSRV-01, WSRV-02, WSRV-03

**Success Criteria** (what must be TRUE):
1. Citations returned from web search are validated against actual source content
2. Hallucinated or unreachable citations are filtered out before surfacing to user
3. Valid citations display domain name source indicators in chat responses
4. User receives accurate, verifiable citations or none (never hallucinated sources)

**Plans:** TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases 1 and 2 can run in parallel (independent work). Phase 3 is also independent and can run concurrently with 1+2 or sequentially after.

Suggested: Execute 1 and 2 in parallel, then 3. Or all 3 in parallel if resource availability permits.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. RLM Emotional Intelligence Integration | 0/1 | Not started | - |
| 2. Test Type Safety Fixes | 0/TBD | Not started | - |
| 3. Web Search Citation Validation | 0/TBD | Not started | - |

---
*Last updated: 2026-02-09 -- Phase 1 planning complete*
