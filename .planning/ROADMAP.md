# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- SHIPPED **v1.2 Import UX Streamline** -- Phases 1-3, 9 plans (shipped 2026-02-07)
- SHIPPED **v1.3 RLM Production Sync** -- Phases 1-5 (shipped 2026-02-07)
- SHIPPED **v1.4 Chat Personalization Quality** -- Phases 6-7 (shipped 2026-02-08)
- SHIPPED **v1.5 Full Chat Experience** -- Phases 8-13 (shipped 2026-02-08)
- 🚧 **v2.0 AI Quality & Personalization** -- Phases 1-5 (in progress)

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

## 🚧 v2.0 AI Quality & Personalization (In Progress)

**Milestone Goal:** Make the AI sound genuinely human and deeply personalized through systematic evaluation, improved prompts, emotional intelligence, and quality awareness. The journey follows an evaluation-first approach: establish measurement infrastructure before changing any prompts, iterate with A/B testing, add emotional awareness and quality scoring, then validate everything together.

**Execution Order:**
Phases 1 → 2 → (3 + 4 in parallel) → 5

Phase 1 must complete before Phase 2 (need evaluation framework to validate prompt changes). Phases 3 and 4 can run in parallel after Phase 2 (both depend on Phase 1, neither depends on each other). Phase 5 depends on all others.

### Phase 1: Evaluation Foundation

**Goal:** Establish measurement infrastructure to baseline current system before making any changes

**Depends on:** Nothing (first phase)

**Requirements:** EVAL-01, EVAL-02, EVAL-03, EVAL-04

**Success Criteria** (what must be TRUE):
1. Developer can create Opik evaluation datasets from anonymized chat history
2. Developer can run offline experiments comparing prompt variants with aggregate scores
3. LLM-as-judge scoring rubrics produce results with >70% human agreement
4. Baseline metrics exist for personality consistency, factuality, and tone matching of current v1 prompts
5. ~~Async Opik tracing adds <100ms P95 latency overhead~~ **Deferred to Phase 5 (Integration Validation)** — latency benchmarking requires load testing infrastructure and concurrent request simulation, which is the explicit purpose of Phase 5 Success Criterion #3. Phase 1 focuses on offline evaluation infrastructure, not production latency.

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md -- Core evaluation library (datasets + judges)
- [x] 01-02-PLAN.md -- Experiment runner + baseline + CLI scripts

### Phase 2: Prompt Template System

**Goal:** Enable natural voice system prompts while maintaining personality consistency and rollback capability

**Depends on:** Phase 1 (need evaluation framework to validate prompt changes)

**Requirements:** PRMT-01, PRMT-02, PRMT-03, PRMT-04

**Success Criteria** (what must be TRUE):
1. PROMPT_VERSION environment variable controls prompt style (v1-technical vs v2-natural-voice)
2. System prompts use flowing personality primer instead of technical markdown headers
3. Next.js buildSystemPrompt() and RLM build_rlm_system_prompt() produce identical output for same sections
4. Personality instructions appear after RAG memory retrieval in prompt structure (not overridden by chunks)
5. Personality adherence is maintained within 2% of baseline metrics from Phase 1

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md -- TypeScript PromptBuilder class + wire into chat route
- [x] 02-02-PLAN.md -- Python PromptBuilder + cross-language sync tests
- [x] 02-03-PLAN.md -- v2 variant in evaluation framework for A/B comparison

### Phase 3: Emotional Intelligence

**Goal:** Enable AI to detect user emotional state and adapt response style while acknowledging uncertainty

**Depends on:** Phase 2 (emotional intelligence scaffolding uses natural voice prompt patterns)

**Requirements:** EMOT-01, EMOT-02, EMOT-03

**Success Criteria** (what must be TRUE):
1. AI detects user frustration, satisfaction, and confusion from text patterns in messages
2. AI adapts response style based on detected emotional state (more supportive when frustrated, more enthusiastic when satisfied)
3. AI explicitly acknowledges uncertainty ("I don't have enough info about X") instead of hallucinating
4. Relationship arc adjusts tone based on conversation history depth (cautious early conversations, confident in later ones)
5. Low-confidence responses use temperature 0.1-0.3 for factual grounding

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md -- Emotional intelligence module + PromptBuilder extension
- [x] 03-02-PLAN.md -- Chat route integration (emotion detection, relationship arc, dynamic temperature)
- [x] 03-03-PLAN.md -- Python PromptBuilder sync + cross-language tests

### Phase 4: Quality Scoring

**Goal:** Score each soulprint section 0-100 so AI knows its own data confidence and low-quality profiles get refined

**Depends on:** Phase 1 (quality scoring uses LLM-as-judge patterns from evaluation infrastructure)

**Requirements:** QUAL-01, QUAL-02, QUAL-03

**Success Criteria** (what must be TRUE):
1. Each soulprint section (SOUL, IDENTITY, USER, AGENTS, TOOLS) has quality scores 0-100 for completeness, coherence, specificity
2. Quality scores are stored in user_profiles.quality_breakdown JSONB column
3. Quality scores are surfaced in system prompts so AI adapts confidence level in responses
4. Soulprints scoring below 60 on any metric are automatically flagged for refinement
5. Background refinement job improves flagged soulprints without user intervention

**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md -- Quality judges + scoring orchestrator + DB migration
- [x] 04-02-PLAN.md -- PromptBuilder DATA CONFIDENCE section + chat route wiring
- [x] 04-03-PLAN.md -- Background refinement cron + import pipeline hook

### Phase 5: Integration Validation

**Goal:** Validate all v2.0 components work together through regression testing, long-session testing, and latency benchmarks

**Depends on:** Phases 1-4 (all components must be built before integration testing)

**Requirements:** VALD-01, VALD-02, VALD-03

**Success Criteria** (what must be TRUE):
1. Prompt regression test suite with 20-100 cases catches personality degradation before deploy
2. Long-session testing (10+ messages) shows no uncanny valley or personality drift
3. Async observability adds <100ms P95 latency overhead under 100 concurrent requests
4. Zero critical regressions compared to v1 baseline metrics
5. Quality scores correlate r>0.7 with user satisfaction metrics

**Plans:** TBD (will be determined during plan-phase)

Plans:
- [ ] TBD during plan-phase

## Progress

**Execution Order:**
Phases execute: 1 → 2 → (3 + 4 parallel) → 5

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Evaluation Foundation | v2.0 | 2/2 | ✓ Complete | 2026-02-08 |
| 2. Prompt Template System | v2.0 | 3/3 | ✓ Complete | 2026-02-09 |
| 3. Emotional Intelligence | v2.0 | 3/3 | ✓ Complete | 2026-02-09 |
| 4. Quality Scoring | v2.0 | 3/3 | ✓ Complete | 2026-02-09 |
| 5. Integration Validation | v2.0 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-09 -- Phase 4 complete (3/3 plans, verified 7/8 must-haves, human migration pending)*
