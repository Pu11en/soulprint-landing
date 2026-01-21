# Component Cleanup Audit

**Audit Date:** 2026-01-21
**Auditor:** Claude Code
**Status:** Complete

---

## 1. VoiceRecorder Components

### Files Audited:
- `components/voice-recorder/VoiceRecorder.tsx`
- `components/voice-recorder/VoiceRecorderV2.tsx`
- `components/voice-recorder/VoiceRecorderV3.tsx`
- `components/voice-recorder/index.ts`

### Usage Analysis:

| File | Imported By | Actively Used? |
|------|-------------|----------------|
| `VoiceRecorder.tsx` | `index.ts` (exports) | **NO** - Exported but not actually imported anywhere in app |
| `VoiceRecorderV2.tsx` | None | **NO** - Not imported anywhere |
| `VoiceRecorderV3.tsx` | `app/questionnaire/new/page.tsx`, `app/questionnaire/voice-test/page.tsx` | **YES** - Actively used |

### Technical Comparison:

| Feature | VoiceRecorder (v1) | VoiceRecorderV2 | VoiceRecorderV3 |
|---------|-------------------|-----------------|-----------------|
| Audio Recording | Yes | Yes | Yes |
| Real-time Visualization | Yes (energy ring) | Yes (energy ring) | Yes (audio level) |
| Speech Transcription | No | Yes (Web Speech API) | Yes (AssemblyAI API) |
| Analysis Method | Browser-based (Meyda/Pitchy) | Browser-based (Web Speech API) | Server-side (AssemblyAI) |
| Dependencies | `voice-analyzer.ts` | `voice-analyzer-v2.ts` | `/api/voice/analyze` |
| Compact Mode | No | No | Yes |
| Production Ready | Partial | Partial | **Yes** |

### Recommendation:

**KEEP:** `VoiceRecorderV3.tsx`
- Production-quality component with AssemblyAI integration
- Has compact mode for questionnaire embedding
- Actively used in the application
- Full Emotional Signature Curve extraction

**SAFE TO DELETE:**
- `VoiceRecorder.tsx` - Legacy v1, not actively imported by any page
- `VoiceRecorderV2.tsx` - Never integrated, superseded by V3

**ACTION REQUIRED:**
- Update `components/voice-recorder/index.ts` to export VoiceRecorderV3 instead

---

## 2. Voice Analyzer Files

### Files Audited:
- `lib/soulprint/voice-analyzer.ts`
- `lib/soulprint/voice-analyzer-v2.ts`

### Usage Analysis:

| File | Imported By | Actively Used? |
|------|-------------|----------------|
| `voice-analyzer.ts` | `VoiceRecorder.tsx` | **NO** - Only imported by unused component |
| `voice-analyzer-v2.ts` | `VoiceRecorderV2.tsx` | **NO** - Only imported by unused component |

### Technical Comparison:

| Feature | voice-analyzer.ts (v1) | voice-analyzer-v2.ts |
|---------|------------------------|----------------------|
| Analysis Type | Audio-only (cadence, rhythm) | Audio + Speech transcription |
| Dependencies | Meyda, Pitchy | Web Speech API |
| Browser Compatibility | All modern browsers | Chrome/Edge only (Web Speech API) |
| Transcription | None | Real-time via Web Speech API |

### Recommendation:

**SAFE TO DELETE:** Both files
- `voice-analyzer.ts` - Only used by deleted VoiceRecorder.tsx
- `voice-analyzer-v2.ts` - Only used by deleted VoiceRecorderV2.tsx

**Note:** VoiceRecorderV3 uses server-side AssemblyAI processing via `/api/voice/analyze`, which provides superior transcription and analysis.

---

## 3. Migration Scripts

### Files Audited:
- `scripts/migrate-soulprints.ts` (kebab-case)
- `scripts/migrate_soulprints.ts` (snake_case)
- `scripts/migrate_soulprints_v31.js`

### Analysis:

| File | Purpose | Format |
|------|---------|--------|
| `migrate-soulprints.ts` | Basic migration (name/archetype extraction) | TypeScript |
| `migrate_soulprints.ts` | Full V3.1 migration with type imports | TypeScript |
| `migrate_soulprints_v31.js` | Full V3.1 migration (standalone JS) | JavaScript |

### Comparison:

1. **`migrate-soulprints.ts`** (75 lines)
   - Simple migration: extracts `name` and `archetype` from `soulprint_data`
   - Only updates records where `name` is null
   - Does NOT perform full schema migration

2. **`migrate_soulprints.ts`** (266 lines)
   - Full V3.1 migration with TypeScript types
   - Supports V1 (traits), V2 (stringified), V3 (partial) formats
   - Uses `constructDynamicSystemPrompt` from generator.ts
   - Requires TypeScript compilation to run

3. **`migrate_soulprints_v31.js`** (309 lines)
   - Same logic as `migrate_soulprints.ts` but pure JavaScript
   - Self-contained (includes `constructDynamicSystemPrompt` inline)
   - Can run directly with Node.js without compilation
   - **Most practical for one-time migrations**

### Recommendation:

**KEEP:** `scripts/migrate_soulprints_v31.js`
- Self-contained and doesn't require compilation
- Most complete migration logic
- Can be run directly: `node scripts/migrate_soulprints_v31.js`

**SAFE TO DELETE:**
- `scripts/migrate-soulprints.ts` - Incomplete migration, superseded
- `scripts/migrate_soulprints.ts` - TypeScript version, redundant with JS version

**Note:** These are one-time migration scripts. After confirming all soulprints are migrated to V3.1, ALL migration scripts can be archived or deleted.

---

## Summary: Files Safe to Delete

### Immediate Deletion (not actively used):

```
components/voice-recorder/VoiceRecorder.tsx
components/voice-recorder/VoiceRecorderV2.tsx
lib/soulprint/voice-analyzer.ts
lib/soulprint/voice-analyzer-v2.ts
scripts/migrate-soulprints.ts
scripts/migrate_soulprints.ts
```

### Files to Keep:

```
components/voice-recorder/VoiceRecorderV3.tsx  (actively used)
components/voice-recorder/index.ts             (needs update)
scripts/migrate_soulprints_v31.js              (keep for reference)
```

### Required Changes:

1. **Update `components/voice-recorder/index.ts`:**
   ```typescript
   export { VoiceRecorderV3, default } from './VoiceRecorderV3';
   ```

---

## Dependency Impact

### NPM Dependencies that may become unused after cleanup:

After removing `voice-analyzer.ts`:
- `meyda` - Audio feature extraction library (check if used elsewhere)
- `pitchy` - Pitch detection library (check if used elsewhere)

**Action:** Run `npx depcheck` after cleanup to identify unused dependencies.

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Delete VoiceRecorder.tsx | Low | Not imported anywhere |
| Delete VoiceRecorderV2.tsx | Low | Not imported anywhere |
| Delete voice-analyzer.ts | Low | Only used by deleted component |
| Delete voice-analyzer-v2.ts | Low | Only used by deleted component |
| Delete migration scripts | Low | One-time scripts, keep v31.js for reference |

---

## Next Steps (US-002)

1. Delete files listed above
2. Update `components/voice-recorder/index.ts`
3. Run `npm run build` to verify no broken imports
4. Run `npm run lint` to check for issues
5. Run `npx depcheck` to find unused dependencies
6. Remove unused npm packages if confirmed safe
