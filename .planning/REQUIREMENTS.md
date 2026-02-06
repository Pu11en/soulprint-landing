# Requirements: SoulPrint v1.2

**Defined:** 2026-02-06
**Core Value:** The import-to-chat flow must work reliably every time on production

## v1.2 Requirements

### Structured Context (OpenClaw-inspired)

- [ ] **CTX-01**: Import generates a SOUL section (communication style, personality traits, tone preferences, boundaries) from ChatGPT export
- [ ] **CTX-02**: Import generates a USER section (name, location, occupation, relationships, life context) from ChatGPT export
- [ ] **CTX-03**: Import generates a MEMORY section (preferences, active projects, important dates, beliefs, decisions) from ChatGPT export
- [ ] **CTX-04**: AI name and archetype are derived from SOUL analysis
- [ ] **CTX-05**: Chat system prompt is composed from SOUL + USER + MEMORY + dynamic chunks + learned facts

### Import UX

- [ ] **IMP-01**: After upload, user sees "Analyzing your conversations..." loading screen while SOUL + USER are generated
- [ ] **IMP-02**: Chat opens only after SOUL + USER sections are ready (not placeholder text)
- [ ] **IMP-03**: MEMORY section and conversation chunks build in background after chat opens
- [ ] **IMP-04**: Chat shows memory progress indicator while background processing continues

### Email Cleanup

- [ ] **EMAIL-01**: Remove "SoulPrint is ready" email from import completion callback
- [ ] **EMAIL-02**: Keep waitlist confirmation email unchanged

## Future Requirements

### Multi-Platform (v2+)

- **PLAT-01**: Users can access their SoulPrint AI via SMS
- **PLAT-02**: Users can access their SoulPrint AI via Telegram
- **PLAT-03**: Users can access their SoulPrint AI via WhatsApp
- **PLAT-04**: Gateway routes messages from any channel to same AI context

### Cloud Instances (v2+)

- **INST-01**: Each SoulPrint is a deployable agent instance
- **INST-02**: Automated provisioning of new SoulPrint instances

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-platform channels | v2+ — need solid single-platform first |
| Per-user cloud instances | v2+ — architecture not ready |
| BOOTSTRAP.md one-time ritual | OpenClaw feature, not needed for web chat |
| Daily memory files (YYYY-MM-DD.md) | OpenClaw pattern for local-first, we use DB |
| On-device processing | We're cloud-first on Vercel/Supabase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTX-01 | TBD | Pending |
| CTX-02 | TBD | Pending |
| CTX-03 | TBD | Pending |
| CTX-04 | TBD | Pending |
| CTX-05 | TBD | Pending |
| IMP-01 | TBD | Pending |
| IMP-02 | TBD | Pending |
| IMP-03 | TBD | Pending |
| IMP-04 | TBD | Pending |
| EMAIL-01 | TBD | Pending |
| EMAIL-02 | TBD | Pending |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 0
- Unmapped: 11

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after initial definition*
