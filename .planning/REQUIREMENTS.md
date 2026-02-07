# Requirements: SoulPrint v1.4

**Defined:** 2026-02-07
**Core Value:** The AI must feel like YOUR AI — personalized chat using structured sections, not generic responses.

## v1.4 Requirements

### Prompt System

- [ ] **PROMPT-01**: AI chat uses all 7 structured sections (SOUL/IDENTITY/USER/AGENTS/TOOLS/MEMORY) in system prompt, not generic filler
- [ ] **PROMPT-02**: RLM `/query` endpoint and Next.js Bedrock fallback use a shared prompt template so personality is consistent regardless of which path handles the request
- [ ] **PROMPT-03**: System prompt uses OpenClaw-inspired natural language personality (values/principles, not robotic "NEVER do X" rules)
- [ ] **PROMPT-04**: System prompt includes anti-generic instructions — no "Great question!", "I'd be happy to help!", or "How can I assist you today?"

### AI Identity

- [ ] **IDENT-01**: AI refers to itself by its generated name (e.g., "I'm Echo") naturally in conversation
- [ ] **IDENT-02**: First message uses personality sections to craft a personalized greeting, not a generic "Hello"

### Memory & Context

- [ ] **MEM-01**: System prompt instructs model to reference retrieved conversation chunks naturally ("Like we discussed..." not ignoring context)
- [ ] **MEM-02**: Section validation filters "not enough data" placeholders before prompt composition

### Infrastructure

- [ ] **INFRA-01**: Pending DB migrations executed (section columns exist in production)
- [ ] **INFRA-02**: Updated RLM deployed to Render with new prompt system

## Future Requirements (deferred)

- Token budget system with progressive context loading — measure usage first, optimize later
- Section quality scoring and threshold enforcement — get personalization working first
- Multi-candidate name generation with validation pipeline — existing name gen is sufficient for beta
- Prompt injection sanitization at import time — acceptable risk for small trusted beta
- Conversation topic detection influencing AGENTS behavior
- Personality refinement UI for manual section editing
- Response format preferences from TOOLS section

## Out of Scope

| Feature | Reason |
|---------|--------|
| Voice personalization | Entirely different tech stack |
| Real-time tone mirroring | Sentiment analysis, v2+ |
| Multi-workspace personas | v2+ |
| Personality presets/sharing | Not needed for beta |
| Progressive learning from chats | v2+ |
| Token budgeting | Measure first, optimize later |
| Prompt injection prevention | Small trusted beta |

## Traceability

| Requirement | Phase | Plan(s) | Status |
|-------------|-------|---------|--------|
| PROMPT-01 | Phase 6 | TBD | Pending |
| PROMPT-02 | Phase 6 | TBD | Pending |
| PROMPT-03 | Phase 6 | TBD | Pending |
| PROMPT-04 | Phase 6 | TBD | Pending |
| IDENT-01 | Phase 6 | TBD | Pending |
| IDENT-02 | Phase 6 | TBD | Pending |
| MEM-01 | Phase 6 | TBD | Pending |
| MEM-02 | Phase 6 | TBD | Pending |
| INFRA-01 | Phase 6 | TBD | Pending |
| INFRA-02 | Phase 7 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 10 total
- Mapped to phases: 10 (100% coverage)
- Unmapped: 0

**Phase distribution:**
- Phase 6 (Prompt Foundation): 9 requirements
- Phase 7 (Production Deployment): 1 requirement

---
*10 requirements across 4 categories*
*Last updated: 2026-02-07 — v1.4 roadmap complete*
