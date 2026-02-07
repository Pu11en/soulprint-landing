# Requirements: SoulPrint v1.2

**Defined:** 2026-02-06
**Core Value:** The import-to-chat flow must work reliably every time on production

## v1.2 Requirements

### Structured Context -- 7 Sections (OpenClaw-inspired)

- [ ] **CTX-01**: Import generates a **SOUL** section (persona, tone, boundaries -- communication style, personality traits, tone preferences) from ChatGPT export
- [ ] **CTX-02**: Import generates an **IDENTITY** section (AI name, archetype, vibe, emoji style) derived from SOUL analysis
- [ ] **CTX-03**: Import generates a **USER** section (name, location, occupation, relationships, life context, how they want to be addressed) from ChatGPT export
- [ ] **CTX-04**: Import generates an **AGENTS** section (operating instructions, behavioral rules, response style, memory directives -- customized to user's personality)
- [ ] **CTX-05**: Import generates a **TOOLS** section (AI capabilities, what it can do, customized to user's likely usage patterns)
- [ ] **CTX-06**: Background processing generates a **MEMORY** section (curated durable facts -- preferences, projects, dates, beliefs, decisions) from full export
- [ ] **CTX-07**: Chat interactions generate **daily memory** entries (learned facts per session, running context from SoulPrint chats)

### Two-Pass Generation Pipeline

- [ ] **GEN-01**: Quick pass (Vercel, Haiku 4.5): sample richest conversations -> generate SOUL, IDENTITY, USER, AGENTS, TOOLS (~15-30s)
- [ ] **GEN-02**: Full pass (RLM background): map-reduce all conversations -> generate MEMORY + conversation chunks/embeddings
- [ ] **GEN-03**: After full pass completes, regenerate SOUL v2, IDENTITY v2, USER v2, AGENTS v2, TOOLS v2 with complete data
- [ ] **GEN-04**: Use Haiku 4.5 (us.anthropic.claude-haiku-4-5-20251001-v1:0) for all generation calls

### System Prompt Composition

- [ ] **PROMPT-01**: Chat system prompt is composed from all 7 sections: SOUL + IDENTITY + USER + AGENTS + TOOLS + MEMORY + daily memory + dynamic chunks

### Import UX Flow

- [ ] **IMP-01**: After upload, user sees "Analyzing your conversations..." loading screen while quick pass generates SOUL + IDENTITY + USER + AGENTS + TOOLS
- [ ] **IMP-02**: Chat opens only after quick pass sections are ready (not placeholder text)
- [ ] **IMP-03**: MEMORY section and conversation chunks build in background after chat opens
- [ ] **IMP-04**: Chat shows memory progress indicator while background processing continues
- [ ] **IMP-05**: After full pass completes, all sections silently upgrade to v2 (richer, more nuanced)

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
| Multi-platform channels | v2+ -- need solid single-platform first |
| Per-user cloud instances | v2+ -- architecture not ready |
| BOOTSTRAP.md one-time ritual | OpenClaw feature, not needed for web chat |
| On-device processing | We're cloud-first on Vercel/Supabase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTX-01 | Phase 1 | Complete |
| CTX-02 | Phase 1 | Complete |
| CTX-03 | Phase 1 | Complete |
| CTX-04 | Phase 1 | Complete |
| CTX-05 | Phase 1 | Complete |
| CTX-06 | Phase 2 | Complete |
| CTX-07 | Phase 3 | Pending |
| GEN-01 | Phase 1 | Complete |
| GEN-02 | Phase 2 | Complete |
| GEN-03 | Phase 2 | Complete |
| GEN-04 | Phase 1 | Complete |
| PROMPT-01 | Phase 3 | Pending |
| IMP-01 | Phase 3 | Pending |
| IMP-02 | Phase 3 | Pending |
| IMP-03 | Phase 3 | Pending |
| IMP-04 | Phase 3 | Pending |
| IMP-05 | Phase 3 | Pending |
| EMAIL-01 | Phase 3 | Pending |
| EMAIL-02 | Phase 3 | Pending |

**Coverage:**
- v1.2 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-07 -- Phase 2 requirements (CTX-06, GEN-02, GEN-03) marked Complete*
