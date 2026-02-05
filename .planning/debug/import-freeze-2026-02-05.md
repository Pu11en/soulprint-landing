# Debug: Import Freezes at 50%

**Reported:** 2026-02-05 07:57 CST  
**Status:** 🟡 In Progress

---

## Problem Statement

Import progress reaches 50% then freezes indefinitely on both mobile and desktop.

**Requirements:**
- Must support 1-5GB JSON files
- Must work on mobile AND desktop
- Must show real progress (not simulated)
- Must not freeze/hang

---

## Root Cause Analysis

### The 50% Freeze

```
Progress Flow:
0-15%   → File extraction (desktop) or prep (mobile)
15-50%  → Upload to Supabase (SIMULATED progress)
50%     → Upload promise hangs, never resolves
55-95%  → Server processing (never reached)
```

**Root cause:** Supabase JS client's `.upload()` doesn't provide progress callbacks. We simulated progress with `setInterval`, capping at 50%. When upload hangs, progress freezes.

### Why Upload Hangs

1. **Large files** — Supabase client may not handle multi-GB uploads well
2. **No timeout** — Original code waited forever
3. **Mobile memory** — Browser runs out of memory processing large files

---

## Solution Design

### Approach: XHR Upload with Real Progress

Replace Supabase client upload with XMLHttpRequest:
- Real `progress` events from browser
- Configurable timeout
- Works for any file size

### Implementation Plan

| Step | Task | Status |
|------|------|--------|
| 1 | Create `lib/chunked-upload.ts` with XHR helper | ✅ Done |
| 2 | Update import page to use XHR upload | ✅ Done |
| 3 | Add mobile file size limit (>100MB blocked) | ✅ Done |
| 4 | Add scaled timeouts by file size | ✅ Done |
| 5 | Test on mobile | 🔄 Pending |
| 6 | Test on desktop with large file | 🔄 Pending |

---

## Changes Made

### 1. `lib/chunked-upload.ts` (NEW)
```typescript
// XHR upload with real progress events
export function uploadWithProgress(
  file: Blob,
  url: string,
  authToken: string,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; data?: any; error?: string }>
```

### 2. `app/import/page.tsx` (MODIFIED)
- Import `uploadWithProgress` from chunked-upload
- Replace Supabase `.upload()` with XHR
- Map upload progress to 15-50% range
- Show real percentage: "Uploading... 35%"

### 3. Mobile Safeguard
```typescript
if (isMobile && fileSizeMB > 100) {
  setErrorMessage('Your export is too large for mobile. Use desktop.');
  return;
}
```

---

## Testing Checklist

- [ ] Mobile <100MB file — should upload with real progress
- [ ] Mobile >100MB file — should show error message
- [ ] Desktop <100MB file — should upload quickly
- [ ] Desktop 100-500MB file — should upload with progress
- [ ] Desktop 1GB+ file — should upload with progress (may be slow)

---

## Session Log

### 2026-02-05 08:00 — Initial Analysis
- Identified simulated progress as root cause
- Added timeout wrapper (didn't fix core issue)

### 2026-02-05 09:05 — XHR Implementation
- Created chunked-upload.ts with XHR helper
- Updated import page to use real progress
- Added mobile file size limit
- Deployed to Vercel

### Next Steps
1. Wait for Vercel deploy (~2 min)
2. Test on mobile with small file
3. Test on desktop with Drew's 1.8GB export
4. If still failing, investigate Supabase storage limits
