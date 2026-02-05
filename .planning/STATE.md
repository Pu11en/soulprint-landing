# SoulPrint — Current State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** Import your ChatGPT history → Get an AI that knows you
**Current focus:** v1.1 Phase 2 — Hardening (reliability, errors, reset)

---

## Milestone Status

**v1.0 MVP** — SHIPPED 2026-02-01
- Phase 1: Mobile MVP (4/4 UAT tests passed)

**v1.1 Polish** — IN PROGRESS
- **Phase 2: Hardening** ← ACTIVE
- Phase 3: Retention (planned)
- Phase 4: Growth (planned)

---

## Current Phase: Hardening

### Status: PLANNING → READY TO EXECUTE

**Objective:** Make it work reliably for real users

### Issues Found (2026-02-04)

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | Reset button only works for admin emails | 🔴 CRITICAL | `api/admin/reset-user/route.ts` |
| 2 | Users can't retry after failed import | 🔴 CRITICAL | `app/import/page.tsx` |
| 3 | Error messages not shown to users | 🟡 HIGH | Multiple |
| 4 | No progress indicator during import | 🟡 HIGH | `app/import/page.tsx` |
| 5 | No progress indicator during embedding | 🟡 HIGH | `app/chat/page.tsx` |
| 6 | "Analyzing..." placeholder soulprint | 🟡 HIGH | `process-server/route.ts` |
| 7 | Large files (>500MB) hit memory limits | 🟢 MEDIUM | Vercel limits |

### Completed (Phase 2)
- [x] Issue audit complete
- [x] Created TASKS.md with full map
- [ ] Fix reset button for users
- [ ] Add error handling
- [ ] Add progress indicators

### Next Actions
1. **Add user self-reset** (not just admin)
2. **Surface error messages in UI**
3. **Add progress indicators**

---

## Fix Plan (Phase 2)

See: `.planning/milestones/v1.1-PHASE2-SPEC.md` (to be created)

### Sprint 1: Critical Fixes (Today)
```
[ ] 1. User self-reset button (any logged-in user can reset their own data)
[ ] 2. Add Google account email to admin list (Drew's kidquick360)
[ ] 3. Show error messages on import page
[ ] 4. Show error messages on chat page
```

### Sprint 2: Progress UX (This Week)
```
[ ] 5. Progress bar during ZIP upload
[ ] 6. Processing status with stages
[ ] 7. Embedding progress indicator
[ ] 8. Soulprint generation status
```

### Sprint 3: Edge Cases (Next Week)
```
[ ] 9. Large file chunked upload
[ ] 10. Import retry after partial failure
[ ] 11. Stuck import detection + auto-recovery
```

---

## Key Technical Specs (LOCKED)

| Spec | Value | Notes |
|------|-------|-------|
| **Embeddings** | Cohere Embed v3 via Bedrock | 1024 dimensions, NOT OpenAI |
| **LLM** | Claude 3.5 Haiku via Bedrock | Primary for chat & soulprint |
| **Chunking** | 5-layer RLM | 200/500/1000/2000/5000 char |
| **Vector DB** | Supabase pgvector | IVFFlat index |
| **Schema** | 12 tables | See PROJECT.md |

---

## Session Log

### 2026-02-04 22:30 CST
**Focus:** Issue audit + planning
- Drew reports Phase 1 broken, reset button not working
- Discovered: Reset only works for 2 admin emails
- Created TASKS.md with 23 tasks mapped
- Generated Nano Banana Pro architecture visual
- Dev server running locally
- **Status:** Planning complete, ready to execute Sprint 1

### 2026-01-31 00:00 CST
**Focus:** GSD Discovery & Documentation
- Created comprehensive `.planning/` documentation
- Mapped entire codebase structure
- **Status:** Discovery complete

---

## Architecture Summary

```
User → Next.js (Vercel) → Supabase (DB/Auth/Storage)
                      ↘
                   RLM Service (Render) → Bedrock (Claude/Cohere)
                      ↗
         Perplexity/Tavily (Web Search)
```

---

## Environment

- **Prod URL:** https://www.soulprintengine.ai
- **Local:** http://localhost:3000 (running)
- **Supabase:** swvljsixpvvcirjmflze
- **Vercel Project:** soulprint-landing
- **RLM Service:** soulprint-landing.onrender.com

---

## Blockers

| Blocker | Status | Resolution |
|---------|--------|------------|
| Reset button only for admins | ACTIVE | Sprint 1, Task 1 |
| kidquick360 email not admin | ACTIVE | Need email from Drew |

---
*Last updated: 2026-02-04 22:35 CST*
