# Roadmap: SoulPrint v1

## Overview

Rebuild the SoulPrint backend to achieve true personality capture. Starting with research to find the best LLM and approach, then implementing a redesigned generator and chat system that makes the AI indistinguishable from the real person.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Research** - Evaluate LLMs, companion repos, psychological frameworks
- [ ] **Phase 2: LLM Integration** - Set up chosen provider, create client
- [ ] **Phase 3: SoulPrint Generator** - Redesign prompts, improve personality extraction
- [ ] **Phase 4: System Prompt Builder** - Build dynamic prompts from SoulPrint data
- [ ] **Phase 5: Chat Integration** - Connect new LLM + system prompt to chat
- [ ] **Phase 6: Validation** - Test on self, refine, polish

## Phase Details

### Phase 1: Research
**Goal**: Determine best LLM, learn from existing companion apps, evaluate psychological frameworks
**Depends on**: Nothing (first phase)
**Research**: Likely (core purpose of phase)
**Research topics**: LLM providers for personality mimicry (Claude, GPT-4, Qwen, Llama), companion app architectures (a16z, Hukasx0, AvrilAI, ChatPsychiatrist), psychological frameworks for personality capture
**Plans**: TBD

Plans:
- [ ] 01-01: LLM evaluation and selection
- [ ] 01-02: Companion repo analysis
- [ ] 01-03: Psychological framework research

### Phase 2: LLM Integration
**Goal**: Set up chosen LLM provider with working client
**Depends on**: Phase 1
**Research**: Likely (external API integration)
**Research topics**: Chosen provider API docs, authentication, rate limits, streaming responses
**Plans**: TBD

Plans:
- [ ] 02-01: Create LLM client and basic connection
- [ ] 02-02: Test chat endpoint with new provider

### Phase 3: SoulPrint Generator
**Goal**: Redesign SoulPrint generation with better prompts and deeper personality extraction
**Depends on**: Phase 2
**Research**: Unlikely (internal work, informed by Phase 1)
**Plans**: TBD

Plans:
- [ ] 03-01: Design new generation prompts
- [ ] 03-02: Implement enhanced personality extraction
- [ ] 03-03: Improve output format and structure

### Phase 4: System Prompt Builder
**Goal**: Build dynamic system prompts that inject personality into every chat
**Depends on**: Phase 3
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 04-01: Create prompt builder from SoulPrint data
- [ ] 04-02: Inject personality patterns into system prompt

### Phase 5: Chat Integration
**Goal**: Wire new LLM and system prompt into chat interface
**Depends on**: Phase 4
**Research**: Unlikely (connecting existing pieces)
**Plans**: TBD

Plans:
- [ ] 05-01: Update chat route to use new LLM
- [ ] 05-02: Integrate system prompt builder
- [ ] 05-03: End-to-end chat testing

### Phase 6: Validation
**Goal**: Test on self, refine until AI is indistinguishable
**Depends on**: Phase 5
**Research**: Unlikely (testing and refinement)
**Plans**: TBD

Plans:
- [ ] 06-01: Self-testing and iteration
- [ ] 06-02: Final polish and cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Research | 0/3 | Not started | - |
| 2. LLM Integration | 0/2 | Not started | - |
| 3. SoulPrint Generator | 0/3 | Not started | - |
| 4. System Prompt Builder | 0/2 | Not started | - |
| 5. Chat Integration | 0/3 | Not started | - |
| 6. Validation | 0/2 | Not started | - |
