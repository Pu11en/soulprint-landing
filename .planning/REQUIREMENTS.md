# Requirements: SoulPrint v2.1 Hardening & Integration

**Defined:** 2026-02-09
**Core Value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

## v2.1 Requirements

Requirements for the Hardening & Integration milestone. Closes known gaps from v2.0.

### RLM Emotional Intelligence

- [x] **RLEI-01**: RLM service receives emotional_state parameter from TypeScript chat route
- [x] **RLEI-02**: RLM service receives relationship_arc parameter from TypeScript chat route
- [x] **RLEI-03**: Python PromptBuilder uses emotional_state and relationship_arc when building RLM prompts
- [x] **RLEI-04**: Both RLM and Bedrock fallback paths produce emotionally intelligent responses

### Test Quality

- [ ] **TEST-01**: Cross-language sync tests compile without type errors (EmotionalState, PromptBuilderProfile)
- [ ] **TEST-02**: Integration test mocks (complete.test.ts, process-server.test.ts) compile without type errors
- [ ] **TEST-03**: All test files pass TypeScript strict mode checks (zero errors in `npx tsc --noEmit`)

### Web Search Validation

- [ ] **WSRV-01**: Web search citations are validated against source content before surfacing to user
- [ ] **WSRV-02**: Hallucinated or unreachable citations are filtered out or flagged
- [ ] **WSRV-03**: User sees citation source indicators (domain name) alongside search-informed responses

## Out of Scope

| Feature | Reason |
|---------|--------|
| Linguistic mirroring | Feature work, not tech debt — future milestone |
| Memory narrative improvements | Feature work — future milestone |
| RLS audit execution | Manual task, not code work |
| Chat pagination | Optimization, not in this cleanup scope |
| Test coverage expansion | Only fixing existing broken tests, not writing new ones |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RLEI-01 | Phase 1 | ✓ Complete |
| RLEI-02 | Phase 1 | ✓ Complete |
| RLEI-03 | Phase 1 | ✓ Complete |
| RLEI-04 | Phase 1 | ✓ Complete |
| TEST-01 | Phase 2 | Pending |
| TEST-02 | Phase 2 | Pending |
| TEST-03 | Phase 2 | Pending |
| WSRV-01 | Phase 3 | Pending |
| WSRV-02 | Phase 3 | Pending |
| WSRV-03 | Phase 3 | Pending |

**Coverage:**
- v2.1 requirements: 10 total
- Mapped to phases: 10 (100% coverage)
- Unmapped: 0

**Phase Distribution:**
- Phase 1 (RLM EI Integration): 4 requirements
- Phase 2 (Test Type Safety): 3 requirements
- Phase 3 (Web Search Validation): 3 requirements

---
*Requirements defined: 2026-02-09*
*Traceability updated: 2026-02-09*
