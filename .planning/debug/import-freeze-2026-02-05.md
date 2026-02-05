# Debug: Import Freezes at 50%

**Reported:** 2026-02-05 07:57 CST
**Status:** 🔴 Active

## Problem Statement

Import progress reaches 50% in ~4 seconds, then freezes indefinitely.

## Symptoms

- Progress bar fills to 50% quickly (~4 sec)
- No movement after that
- No error shown to user
- No crash or timeout

## Code Analysis

### Progress Flow

```
0-5%    → Extracting conversations.json from ZIP (JSZip)
5-15%   → Extraction complete
15-50%  → Uploading to Supabase Storage (simulated progress)
50%     → Upload should complete, progress jumps to 55%
55-95%  → Server processing (queue-processing API)
100%    → Done
```

### The 50% Cap

```javascript
uploadProgressIntervalRef.current = setInterval(() => {
  setProgress(p => Math.min(p + 5, 50)); // CAPS at 50%
}, 500);
```

Progress is capped at 50% during upload. Only cleared when upload promise resolves.

### Upload Code

```javascript
const { data, error } = await supabase.storage
  .from('imports')
  .upload(uploadPath, uploadBlob, {
    upsert: true,
    contentType: ...
  });
// <-- Stuck here. Promise never resolves.
```

## Hypotheses

### H1: Upload hanging (Promise never resolves)
- **Evidence:** Stuck at exactly 50% (the cap)
- **Test:** Check browser network tab for pending request
- **Likely:** HIGH

### H2: File too large for Supabase
- **Evidence:** 1.8GB export → extracted JSON could be 500MB+
- **Test:** Check extracted file size in console
- **Likely:** MEDIUM

### H3: RLS policy blocking upload
- **Evidence:** None yet
- **Test:** Check Supabase logs
- **Likely:** LOW (would throw error)

### H4: Browser memory issue
- **Evidence:** Large file extraction
- **Test:** Check browser memory usage
- **Likely:** LOW (extraction completed)

## Fixes Applied

### Fix 1: Add timeout (2026-02-05 08:00)
```javascript
const uploadTimeoutMs = uploadBlob.size > 100 * 1024 * 1024 ? 5 * 60 * 1000 : 2 * 60 * 1000;
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Upload timed out...')), uploadTimeoutMs)
);
await Promise.race([uploadPromise, timeoutPromise]);
```

### Fix 2: Better progress simulation
- Slower interval for large files (2s vs 500ms)
- +2% instead of +5% per tick

## Investigation Steps

1. [ ] Get browser console logs (`[Import]` messages)
2. [ ] Check Network tab for pending/failed requests
3. [ ] Check extracted file size
4. [ ] Check Supabase storage logs
5. [ ] Test with smaller file

## Console Logs to Look For

```
[Import] Desktop: extracting conversations.json from ZIP...
[Import] Extracted conversations.json: XXX MB (original ZIP: XXX MB)
[Import] Starting client-side upload: ... (XXX MB)
[Import] Upload completed, checking result...  <-- If this never appears, upload hung
```

## Resolution

TBD

---

## Session Log

### 2026-02-05 08:00 CST
- Drew reported freeze at 50%
- Analyzed code, identified upload promise not resolving
- Added timeout wrapper (5 min for large files)
- Added better logging
- Rebuilt and restarted dev server
- Waiting for Drew to test with console open
