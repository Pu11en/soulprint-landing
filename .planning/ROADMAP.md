# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- IN PROGRESS **v1.2 Import UX Streamline** -- Phases 1-3

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

### v1.2 Import UX Streamline (In Progress)

**Milestone Goal:** Replace monolithic soulprint_text with 7 structured context sections (OpenClaw-inspired), implement two-pass generation so users start chatting in ~30s while deep memory builds in the background.

**Phase Numbering:** Milestone-scoped (1, 2, 3). Decimal phases (1.1, 1.2) reserved for urgent insertions.

- [x] **Phase 1: Schema + Quick Pass Pipeline** (3/3 plans) -- completed 2026-02-07
- [x] **Phase 2: Full Pass Pipeline** (3/3 plans) -- completed 2026-02-07
- [ ] **Phase 3: Chat Integration + UX** -- Compose system prompt from all sections, daily memory from chat, import UX flow, email cleanup

## Phase Details

### Phase 1: Schema + Quick Pass Pipeline
**Goal**: Users who upload a ChatGPT export get 5 structured context sections (SOUL, IDENTITY, USER, AGENTS, TOOLS) generated within ~30 seconds by Haiku 4.5
**Depends on**: Nothing (first phase)
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, GEN-01, GEN-04
**Success Criteria** (what must be TRUE):
  1. After import, the database contains a SOUL section with communication style, personality traits, tone preferences, and boundaries -- not a monolithic blob
  2. After import, the database contains an IDENTITY section with AI name, archetype, vibe, and emoji style derived from the user's personality
  3. After import, the database contains a USER section with name, location, occupation, relationships, and how the user wants to be addressed
  4. After import, the database contains AGENTS (behavioral rules, response style) and TOOLS (capabilities tuned to user) sections
  5. The quick pass completes in under 60 seconds using Haiku 4.5 on Bedrock, sampling the richest conversations (not processing all of them)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Foundation: Haiku 4.5 model constant, TypeScript interfaces, Zod schema, conversation sampling, tools_md migration
- [x] 01-02-PLAN.md -- Quick pass generation module + wire into import pipeline + update reset route
- [x] 01-03-PLAN.md -- Unit tests for sampling and generation + human verification

### Phase 2: Full Pass Pipeline
**Goal**: Background processing map-reduces all conversations to produce a MEMORY section and conversation chunks, then regenerates all 5 quick-pass sections with complete data (v2)
**Depends on**: Phase 1
**Requirements**: CTX-06, GEN-02, GEN-03
**Success Criteria** (what must be TRUE):
  1. After full pass completes, the database contains a MEMORY section with curated durable facts (preferences, projects, dates, beliefs, decisions) extracted from the complete export
  2. Full pass handles large exports (88MB, 5000+ conversations) via map-reduce without hitting Vercel's 5-minute timeout
  3. After full pass, all 5 quick-pass sections (SOUL, IDENTITY, USER, AGENTS, TOOLS) are regenerated as v2 with richer, more nuanced content from complete data
  4. Full pass runs entirely in the background without blocking the user's ability to chat
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md -- Schema migration (memory_md, full_pass_status) + /process-full endpoint skeleton with background task dispatch
- [x] 02-02-PLAN.md -- Map-reduce pipeline: conversation chunking, parallel fact extraction, MEMORY section generation
- [x] 02-03-PLAN.md -- V2 section regeneration from complete data + MEMORY context, final status flow

### Phase 3: Chat Integration + UX
**Goal**: Users experience a seamless import-to-chat flow where chat opens after quick pass, system prompt is composed from all 7 sections, memory builds visibly in background, and daily memory accumulates from chat sessions
**Depends on**: Phase 2
**Requirements**: CTX-07, PROMPT-01, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, EMAIL-01, EMAIL-02
**Success Criteria** (what must be TRUE):
  1. After uploading a ChatGPT export, the user sees an "Analyzing your conversations..." loading screen that resolves when quick pass sections are ready (not placeholder text)
  2. The chat system prompt is composed from all 7 sections (SOUL + IDENTITY + USER + AGENTS + TOOLS + MEMORY + daily memory) plus dynamic conversation chunks
  3. While background processing runs, the chat shows a memory progress indicator; after full pass completes, all sections silently upgrade to v2
  4. Each chat session generates daily memory entries (learned facts, running context) that persist and are included in future system prompts
  5. No "SoulPrint is ready" email is sent after import; waitlist confirmation email remains unchanged
**Plans**: TBD

Plans:
- [ ] 03-01: System prompt composition from 7 structured sections
- [ ] 03-02: Import UX flow -- loading screen, chat gating, memory progress indicator
- [ ] 03-03: Daily memory generation from chat interactions
- [ ] 03-04: Email cleanup -- remove import completion email, preserve waitlist email

## Coverage

```
CTX-01 (SOUL)       -> Phase 1
CTX-02 (IDENTITY)   -> Phase 1
CTX-03 (USER)       -> Phase 1
CTX-04 (AGENTS)     -> Phase 1
CTX-05 (TOOLS)      -> Phase 1
CTX-06 (MEMORY)     -> Phase 2
CTX-07 (daily mem)  -> Phase 3
GEN-01 (quick pass) -> Phase 1
GEN-02 (full pass)  -> Phase 2
GEN-03 (v2 regen)   -> Phase 2
GEN-04 (Haiku 4.5)  -> Phase 1
PROMPT-01 (compose) -> Phase 3
IMP-01 (loading)    -> Phase 3
IMP-02 (gate chat)  -> Phase 3
IMP-03 (bg memory)  -> Phase 3
IMP-04 (progress)   -> Phase 3
IMP-05 (v2 upgrade) -> Phase 3
EMAIL-01 (remove)   -> Phase 3
EMAIL-02 (keep)     -> Phase 3

Mapped: 19/19
Orphans: 0
```

## Progress

**Execution Order:** 1 -> 2 -> 3 (decimal insertions execute between their surrounding integers)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema + Quick Pass Pipeline | v1.2 | 3/3 | Complete | 2026-02-07 |
| 2. Full Pass Pipeline | v1.2 | 3/3 | Complete | 2026-02-07 |
| 3. Chat Integration + UX | v1.2 | 0/4 | Not started | - |

---
*Last updated: 2026-02-07 after Phase 2 execution complete (3/3 plans, verified)*
