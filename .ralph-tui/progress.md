# Ralph Progress Log

This file tracks progress across iterations. It's automatically updated
after each iteration and included in agent prompts for context.

## Codebase Patterns (Study These First)

- **Voice Recording Architecture:** VoiceRecorderV3 is the production component using server-side AssemblyAI via `/api/voice/analyze`. Older V1/V2 used browser-based analysis (Meyda/Pitchy, Web Speech API) but are deprecated.
- **Component Versioning:** Versioned components (V2, V3) indicate evolution - always check which version is actively imported before making changes.
- **Migration Scripts:** One-time migration scripts exist in `/scripts/` - prefer standalone JS versions that can run without TypeScript compilation.

---

## 2026-01-21 - US-001
- What was implemented: Complete audit of duplicate/versioned components
- Files changed:
  - Created `CLEANUP-AUDIT.md` with detailed analysis and recommendations
- **Learnings:**
  - VoiceRecorderV3.tsx is the only actively used voice recorder (imported by questionnaire pages)
  - VoiceRecorder.tsx and VoiceRecorderV2.tsx are legacy and can be deleted
  - voice-analyzer.ts and voice-analyzer-v2.ts are only used by deleted components
  - migrate_soulprints_v31.js is the most complete/practical migration script
  - The codebase has a pattern of keeping old versions alongside new - need cleanup
---

