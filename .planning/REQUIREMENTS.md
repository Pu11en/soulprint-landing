# Requirements: SoulPrint v2.2 Bulletproof Imports

**Defined:** 2026-02-09
**Core Value:** The AI must feel like YOUR AI -- genuinely human, deeply personalized, systematically evaluated.

## v2.2 Requirements

Requirements for the Bulletproof Imports milestone. Move all heavy import processing from Vercel to RLM (Render), port convoviz-quality parsing, make imports work for any size export on any device.

### Import Processing

- [ ] **IMP-01**: All heavy import processing (download, parse, quick pass, chunk) runs on RLM service (Render), not Vercel serverless
- [ ] **IMP-02**: Import pipeline uses streaming JSON parser (ijson) for constant-memory processing of any size export (1MB to 2GB+)
- [ ] **IMP-03**: Vercel serves as thin authentication proxy that triggers RLM and returns immediately

### Parsing Quality

- [ ] **PAR-01**: Conversation parsing uses DAG traversal via current_node→parent chain (no dead branches from edits)
- [ ] **PAR-02**: Hidden messages filtered out before soulprint generation (tool outputs, browsing, reasoning traces)
- [ ] **PAR-03**: All content.parts types handled correctly (strings, images, tool results — not just parts[0])
- [ ] **PAR-04**: Both `[...]` and `{ conversations: [...] }` export formats supported

### User Experience

- [ ] **UXP-01**: User sees real processing stage progress (downloading, parsing, generating — not fake animation)
- [ ] **UXP-02**: User receives actionable error messages when import fails (not generic "something went wrong")
- [ ] **UXP-03**: Import works on any device (mobile + desktop) for any export size

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time WebSocket progress | Over-engineered — DB polling sufficient for import UX |
| In-browser parsing | Unreliable on mobile, defeats purpose of server-side processing |
| Parallel conversation processing | Complexity without proportional value — sequential is fine |
| Incremental import (append new conversations) | Feature work, not in this reliability scope |
| Import history / cancel button | Admin tooling — future milestone |
| Retry with exponential backoff | Resilience enhancement — future milestone |
| Signed URL security for Storage access | Security hardening — future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| IMP-01 | Phase 1 | Pending |
| IMP-02 | Phase 1 | Pending |
| IMP-03 | Phase 1 | Pending |
| PAR-01 | Phase 2 | Pending |
| PAR-02 | Phase 2 | Pending |
| PAR-03 | Phase 2 | Pending |
| PAR-04 | Phase 2 | Pending |
| UXP-01 | Phase 3 | Pending |
| UXP-02 | Phase 3 | Pending |
| UXP-03 | Phase 3 | Pending |

**Coverage:**
- v2.2 requirements: 10 total
- Mapped to phases: 10 (100% coverage)
- Unmapped: 0

**Phase distribution:**
- Phase 1 (Core Migration): 3 requirements
- Phase 2 (Parsing Quality): 4 requirements
- Phase 3 (UX Enhancement): 3 requirements

---
*Requirements defined: 2026-02-09*
*Traceability updated: 2026-02-09 (roadmap created)*
