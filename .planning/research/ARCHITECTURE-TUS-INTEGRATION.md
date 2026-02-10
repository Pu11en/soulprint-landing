# TUS Resumable Uploads Integration Architecture

**Project:** SoulPrint Landing
**Researched:** 2026-02-09
**Domain:** Replacing XHR uploads with TUS resumable uploads in existing Next.js + Supabase app
**Confidence:** HIGH (based on Supabase official docs + tus-js-client docs)

## Executive Summary

Supabase Storage natively supports TUS protocol for resumable uploads. The integration requires **minimal changes** to existing flow — the storage path format, RLS policies, and RLM download mechanism remain unchanged. Only the client-side upload mechanism needs replacement.

**Key finding:** TUS uploads work with **exact same storage paths** as current XHR uploads (`imports/{user_id}/{timestamp}-{filename}`), so RLM service requires **no changes**.

---

## Current Architecture

### Existing Upload Flow
```
Frontend (app/import/page.tsx)
    ↓
Extract conversations.json from ZIP (JSZip)
    ↓
lib/chunked-upload.ts (XHR with XMLHttpRequest)
    ↓
Direct upload to Supabase Storage:
POST https://{project}.supabase.co/storage/v1/object/imports/{user_id}/{timestamp}-{filename}
    ↓
Returns: storagePath = "imports/{user_id}/{timestamp}-{filename}"
    ↓
Frontend calls /api/import/trigger
    ↓
/api/import/trigger calls RLM /import-full with storagePath
    ↓
RLM downloads from Supabase Storage using storagePath
    ↓
Processing continues...
```

**Critical constraint:** RLM service uses `storagePath` to download file from Supabase. Path format must remain `imports/{user_id}/{timestamp}-{filename}`.

---

## TUS Integration Architecture

### New Upload Flow
```
Frontend (app/import/page.tsx)
    ↓
Extract conversations.json from ZIP (JSZip) ← UNCHANGED
    ↓
lib/tus-upload.ts (NEW) — tus-js-client wrapper
    ↓
Resumable upload to Supabase Storage:
POST https://{project}.storage.supabase.co/storage/v1/upload/resumable
    ↓
TUS protocol: chunked upload with resume capability
    ↓
Returns: storagePath = "imports/{user_id}/{timestamp}-{filename}" ← SAME FORMAT
    ↓
Frontend calls /api/import/trigger ← UNCHANGED
    ↓
/api/import/trigger → RLM /import-full ← UNCHANGED
    ↓
Processing continues... ← UNCHANGED
```

**What changes:** Only the upload mechanism (XHR → TUS)
**What stays the same:** Everything downstream from upload completion

---

## Component Mapping

### What Changes

| Current Component | New Component | Why Change |
|-------------------|---------------|------------|
| `lib/chunked-upload.ts` (XHR-based) | `lib/tus-upload.ts` (TUS-based) | Replace upload mechanism with resumable protocol |
| `uploadWithProgress()` function | `tusUploadWithProgress()` function | Different API for progress tracking |
| `app/import/page.tsx` (lines 529-598) | Modified upload logic | Call new TUS wrapper instead of XHR |

### What Stays Unchanged

| Component | Why No Change |
|-----------|---------------|
| JSZip extraction (lines 473-505) | Client-side ZIP parsing unaffected by upload protocol |
| Storage path format | TUS uploads use same path via metadata configuration |
| `/api/import/trigger` endpoint | Receives storagePath exactly as before |
| RLM service integration | Downloads from Supabase using same storage path |
| Supabase RLS policies | Apply to TUS uploads via bearer token auth |
| Progress UI (RingProgress component) | TUS provides same progress callbacks |
| Error handling patterns | Classify errors the same way |

---

## Technical Implementation Details

### 1. TUS Endpoint Configuration

**Current XHR endpoint:**
```typescript
const uploadUrl = `${supabaseUrl}/storage/v1/object/imports/${uploadPath}`;
```

**New TUS endpoint:**
```typescript
const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;
// Note: Uses /upload/resumable instead of /object/{path}
```

**Performance optimization:** Use direct storage hostname for large files:
```typescript
// Production: project-id.storage.supabase.co (not project-id.supabase.co)
const storageHostname = supabaseUrl.replace('.supabase.co', '.storage.supabase.co');
const tusEndpoint = `${storageHostname}/storage/v1/upload/resumable`;
```

### 2. Authentication

**Current XHR auth:**
```typescript
xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
xhr.setRequestHeader('Content-Type', contentType);
xhr.setRequestHeader('X-CSRF-Token', csrfToken);
```

**New TUS auth:**
```typescript
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint,
  headers: {
    authorization: `Bearer ${accessToken}`,
    'x-upsert': 'true' // Optional: overwrite if file exists
  },
  // Note: CSRF token not needed for TUS (Supabase handles in backend)
  // Note: Content-Type set via metadata.contentType
});
```

**RLS integration:** Bearer token provides user context, RLS policies apply automatically.

### 3. Storage Path Format (CRITICAL)

TUS uses **metadata** to specify path instead of URL path:

**Current XHR approach:**
```typescript
// Path encoded in URL
POST /storage/v1/object/imports/{user_id}/{timestamp}-conversations.json
```

**New TUS approach:**
```typescript
// Path specified in metadata
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint, // Generic resumable endpoint
  metadata: {
    bucketName: 'imports',
    objectName: `${user.id}/${timestamp}-${cleanName}`,
    contentType: 'application/json',
    cacheControl: '3600'
  }
});
```

**Result:** Final path is `imports/{user_id}/{timestamp}-{filename}` — **identical to current format**.

**Verification:** After upload completes, TUS returns upload URL. Extract path from URL:
```typescript
onSuccess: function () {
  // upload.url = https://.../storage/v1/object/imports/{user_id}/{timestamp}-{filename}
  const storagePath = new URL(upload.url).pathname
    .replace('/storage/v1/object/', ''); // → imports/{user_id}/{timestamp}-{filename}
}
```

### 4. Progress Tracking

**Current XHR progress:**
```typescript
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable && onProgress) {
    const percent = Math.round((e.loaded / e.total) * 100);
    onProgress(percent);
  }
});
```

**New TUS progress:**
```typescript
const upload = new tus.Upload(file, {
  onProgress: (bytesUploaded, bytesTotal) => {
    const percent = Math.round((bytesUploaded / bytesTotal) * 100);
    onProgress(percent);
  }
});
```

**Key difference:** TUS progress is method on Upload options, XHR progress is event listener.

### 5. Chunk Size

**Current XHR chunking:**
```typescript
const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB chunks
```

**New TUS chunking:**
```typescript
const upload = new tus.Upload(file, {
  chunkSize: 6 * 1024 * 1024, // 6MB chunks (Supabase requirement)
  uploadDataDuringCreation: true
});
```

**Important:** Supabase Storage requires TUS chunk size to be **6MB** (not configurable). This is smaller than current 50MB XHR chunks but provides better resume granularity.

### 6. Pause/Resume

**Current XHR:** No native pause/resume (must re-upload from start if interrupted).

**New TUS:**
```typescript
// Pause upload
upload.abort();

// Resume upload (finds previous upload automatically)
upload.findPreviousUploads().then((previousUploads) => {
  if (previousUploads.length) {
    upload.resumeFromPreviousUpload(previousUploads[0]);
  }
  upload.start();
});
```

**UI integration:** Can add "Pause" button to progress screen (currently only shows "Cancel").

### 7. Error Handling

**Current XHR errors:**
```typescript
xhr.addEventListener('error', () => {
  resolve({ success: false, error: 'Network error during upload' });
});
```

**New TUS errors:**
```typescript
const upload = new tus.Upload(file, {
  onError: (error) => {
    console.error('Upload failed:', error);
    // Map to existing error classification
    const userMessage = classifyUploadError(error);
    setErrorMessage(userMessage);
  },
  retryDelays: [0, 3000, 5000, 10000, 20000] // Auto-retry with backoff
});
```

**Advantage:** TUS has built-in retry logic (current XHR requires manual retry).

---

## Integration Points

### Frontend Changes

#### File: `lib/tus-upload.ts` (NEW)
**Purpose:** Wrapper around tus-js-client for Supabase Storage
**Exports:**
- `tusUploadWithProgress(blob, userId, filename, onProgress): Promise<{ success, storagePath?, error? }>`

**Interface:** Matches existing `uploadWithProgress()` signature where possible.

**Key responsibilities:**
1. Configure TUS endpoint with storage hostname
2. Set metadata for bucket/path/contentType
3. Handle authentication with bearer token
4. Map progress callbacks to existing UI expectations
5. Extract final storagePath from completed upload URL
6. Implement pause/resume (optional enhancement)

**Dependencies:**
```bash
npm install tus-js-client
```

#### File: `app/import/page.tsx` (MODIFIED)
**Changes:** Lines 510-598 (upload orchestration)

**Before:**
```typescript
const uploadResult = await uploadWithProgress(
  uploadBlob,
  uploadUrl,
  accessToken,
  contentType,
  (percent) => { /* progress */ }
);
```

**After:**
```typescript
const uploadResult = await tusUploadWithProgress(
  uploadBlob,
  user.id,
  uploadFilename,
  (percent) => { /* progress — same callback */ }
);
```

**Mobile detection logic:** UNCHANGED (still use JSZip extraction threshold)
**Progress mapping logic:** UNCHANGED (still maps to 15-50% range)
**Error classification:** UNCHANGED (reuse existing `classifyImportError()`)

### Backend Changes

**NONE.** Backend endpoints remain unchanged:
- `/api/import/trigger` receives storagePath exactly as before
- RLM service `/import-full` uses storagePath to download from Supabase
- Supabase RLS policies apply via user auth context

### Database Changes

**NONE.** Schema unchanged, TUS uploads result in same storage objects.

---

## Data Flow Comparison

### Current Flow (XHR)
```
1. User uploads ZIP
2. JSZip extracts conversations.json (client-side)
3. XHR POST to /storage/v1/object/imports/{path}
   - Auth: Bearer token in header
   - Body: Raw file blob
   - Progress: upload.addEventListener('progress')
4. Success → storagePath = "imports/{user_id}/{timestamp}-{filename}"
5. POST /api/import/trigger { storagePath }
6. Trigger → RLM /import-full { user_id, storage_path }
7. RLM downloads from Supabase, processes, saves to DB
```

### New Flow (TUS)
```
1. User uploads ZIP ← SAME
2. JSZip extracts conversations.json (client-side) ← SAME
3. TUS POST to /storage/v1/upload/resumable
   - Auth: Bearer token in headers
   - Metadata: { bucketName: 'imports', objectName: '{user_id}/{timestamp}-{filename}' }
   - Body: Chunked (6MB parts)
   - Progress: onProgress callback
   - Resumable: Can pause/resume
4. Success → extract storagePath from upload.url
   - storagePath = "imports/{user_id}/{timestamp}-{filename}" ← SAME FORMAT
5. POST /api/import/trigger { storagePath } ← SAME
6. Trigger → RLM /import-full { user_id, storage_path } ← SAME
7. RLM downloads from Supabase, processes, saves to DB ← SAME
```

**Commonalities:**
- Same authentication mechanism (Supabase session token)
- Same storage path format (RLM compatibility)
- Same trigger endpoint
- Same backend processing

**Differences:**
- Upload protocol (XHR → TUS)
- Chunk size (50MB → 6MB)
- Resume capability (none → automatic)
- Retry logic (manual → built-in)

---

## RLS Policy Compatibility

### Current RLS Policy (Assumed)
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
USING (
  bucket_id = 'imports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

### TUS Upload Behavior
```
User authenticates → session provides auth.uid()
TUS upload includes bearer token → Supabase validates user
Metadata specifies objectName: '{user_id}/{timestamp}-{filename}'
RLS policy checks: (storage.foldername(name))[1] === auth.uid()
✓ PASSES — user_id in metadata matches authenticated user
```

**No policy changes needed.** TUS uploads go through same RLS validation as XHR uploads.

---

## Component Boundaries

### Client-Side (Browser)
**Responsibilities:**
- File selection and ZIP extraction (JSZip)
- Upload orchestration with TUS protocol
- Progress tracking and UI updates
- Error handling and user feedback

**New dependencies:**
- `tus-js-client` (upload protocol implementation)

**Files modified:**
- `lib/tus-upload.ts` (NEW)
- `app/import/page.tsx` (upload logic)
- `package.json` (add tus-js-client dependency)

### API Layer (Next.js)
**Responsibilities:** UNCHANGED
- Authenticate trigger requests
- Call RLM service with storage path
- Update user_profiles status

**Files:** NO CHANGES
- `/api/import/trigger` works as-is

### RLM Service (External)
**Responsibilities:** UNCHANGED
- Download file from Supabase using storagePath
- Parse conversations
- Generate soulprint
- Update database with results

**Interface:** NO CHANGES
- Receives same storage_path format
- Downloads from Supabase with same credentials

### Supabase (Storage + DB)
**Responsibilities:** UNCHANGED
- Store uploaded files in imports bucket
- Apply RLS policies based on user context
- Provide download URLs to RLM service

**Configuration:** NO CHANGES
- Bucket settings remain the same
- RLS policies apply to both XHR and TUS uploads

---

## Migration Strategy

### Phase 1: Parallel Implementation (Safe)
```typescript
// lib/tus-upload.ts — new TUS implementation
export async function tusUploadWithProgress(...) { /* TUS logic */ }

// lib/chunked-upload.ts — keep existing XHR
export async function uploadWithProgress(...) { /* Current XHR */ }

// app/import/page.tsx — feature flag
const USE_TUS = process.env.NEXT_PUBLIC_USE_TUS_UPLOAD === 'true';
const uploadResult = USE_TUS
  ? await tusUploadWithProgress(...)
  : await uploadWithProgress(...);
```

**Benefits:**
- Can test TUS in production with small user percentage
- Easy rollback if issues discovered
- Compare performance/reliability metrics

### Phase 2: Full Cutover
```typescript
// app/import/page.tsx — use TUS directly
const uploadResult = await tusUploadWithProgress(...);

// lib/chunked-upload.ts — deprecate or remove
// (Keep for historical reference or delete if confident)
```

### Phase 3: Cleanup (Optional)
- Remove `lib/chunked-upload.ts`
- Remove XHR-related code paths
- Update documentation

---

## Performance Considerations

### Current XHR Performance
| Metric | XHR Upload |
|--------|------------|
| Chunk size | 50MB |
| Resume on disconnect | ❌ No (must restart) |
| Retry logic | Manual (no auto-retry) |
| Concurrent parts | Serial chunks |
| Mobile reliability | ⚠️ Poor (large chunks crash on low memory) |

### TUS Performance
| Metric | TUS Upload |
|--------|-----------|
| Chunk size | 6MB (Supabase requirement) |
| Resume on disconnect | ✅ Yes (automatic) |
| Retry logic | Built-in exponential backoff |
| Concurrent parts | Configurable (default serial) |
| Mobile reliability | ✅ Better (smaller chunks + resume) |

**Trade-off:** Smaller chunks = more HTTP requests, but better resume granularity and mobile stability.

**Network efficiency:** TUS overhead is minimal (metadata in headers), actual file data transfer same as XHR.

---

## Testing Strategy

### Unit Tests
**New file:** `lib/tus-upload.test.ts`
- Mock tus.Upload constructor
- Verify metadata configuration
- Test progress callback mapping
- Test error classification
- Verify storagePath extraction

### Integration Tests
**Modified:** `app/import/page.test.tsx`
- Mock tusUploadWithProgress
- Verify upload orchestration
- Test progress UI updates
- Test error handling flows

### Manual Testing Checklist
1. **Small file (<10MB):** Verify upload completes, path correct
2. **Large file (>100MB):** Verify chunking works, progress accurate
3. **Network interruption:** Disconnect Wi-Fi mid-upload → reconnect → verify resume
4. **Mobile upload:** Test on iOS/Android with large file
5. **Concurrent uploads:** Multiple users uploading simultaneously
6. **RLM integration:** Verify RLM downloads file successfully after TUS upload
7. **RLS policies:** Verify users can only upload to own folder

### Monitoring
**Metrics to track:**
- Upload success rate (TUS vs XHR baseline)
- Average upload time for same file sizes
- Resume frequency (how often users benefit from resume capability)
- Error types and frequencies
- Mobile vs desktop performance differences

---

## Risk Assessment

### Low Risk
✅ **Storage path format compatibility:** TUS produces same paths as XHR
✅ **RLS policy compatibility:** Bearer token auth works identically
✅ **Backend compatibility:** Trigger endpoint unchanged
✅ **RLM compatibility:** Downloads using same storage paths

### Medium Risk
⚠️ **Library compatibility:** tus-js-client may have browser compatibility issues
**Mitigation:** Test on Safari, Chrome, Firefox, mobile browsers

⚠️ **Chunk size change:** 6MB chunks vs 50MB may affect performance
**Mitigation:** Monitor upload times, compare to XHR baseline

⚠️ **Resume state management:** TUS stores upload state in browser storage
**Mitigation:** Test with browser storage disabled/full, handle gracefully

### High Risk
❌ **None identified.** Integration is low-risk due to isolated client-side changes.

---

## Open Questions

### Resolved
✅ **Q: Does TUS support the same storage path format as XHR?**
A: Yes, via metadata.objectName configuration.

✅ **Q: Do RLS policies apply to TUS uploads?**
A: Yes, bearer token provides user context, RLS validates normally.

✅ **Q: Does RLM need changes to download TUS-uploaded files?**
A: No, storage path format is identical.

### Needs Validation
⚠️ **Q: What's the actual chunk size limit for Supabase TUS?**
**Assumption:** 6MB based on docs, but test with larger chunks.

⚠️ **Q: How long do TUS upload URLs remain valid?**
**Assumption:** 24 hours based on docs, verify in practice.

⚠️ **Q: Does Supabase charge differently for TUS vs standard uploads?**
**Research needed:** Check pricing docs for any TUS-specific costs.

---

## Dependencies

### New NPM Packages
```json
{
  "dependencies": {
    "tus-js-client": "^4.3.0"
  }
}
```

**Why tus-js-client:**
- Maintained by TUS protocol authors
- Broad browser compatibility (IE10+)
- Well-documented API
- Active development (last release 2024)
- TypeScript types included

**Alternative considered: Uppy**
- More full-featured (UI components, multi-file)
- Heavier bundle size (60KB+ vs 15KB for tus-js-client)
- Unnecessary complexity for single-file upload
- **Decision:** Use tus-js-client directly for lighter bundle

### Existing Dependencies (Unchanged)
- `jszip` — ZIP extraction (already installed)
- `@supabase/supabase-js` — Auth and storage client
- Next.js, React — No version changes needed

---

## Build Order

### Iteration 1: TUS Upload Module
**Goal:** Create working TUS wrapper with same interface as XHR

**Tasks:**
1. Install tus-js-client
2. Create `lib/tus-upload.ts`
3. Implement `tusUploadWithProgress()` function
4. Write unit tests
5. Verify TypeScript compilation

**Deliverable:** Standalone TUS module ready for integration

### Iteration 2: Frontend Integration
**Goal:** Wire TUS upload into import page

**Tasks:**
1. Modify `app/import/page.tsx` upload logic
2. Map progress callbacks to existing UI
3. Update error handling to classify TUS errors
4. Add feature flag for A/B testing
5. Update TypeScript types if needed

**Deliverable:** Import page using TUS upload (behind feature flag)

### Iteration 3: Testing & Validation
**Goal:** Verify end-to-end flow works correctly

**Tasks:**
1. Test small/large file uploads
2. Test network interruption/resume
3. Test mobile devices
4. Verify RLM downloads TUS-uploaded files
5. Check RLS policy enforcement
6. Monitor error rates and performance

**Deliverable:** TUS upload tested and ready for production

### Iteration 4: Rollout & Cleanup
**Goal:** Move from feature flag to default

**Tasks:**
1. Enable TUS for 10% of users
2. Monitor metrics for 48 hours
3. If stable: enable for 50% of users
4. If stable: enable for 100% of users
5. Remove XHR code path
6. Update documentation

**Deliverable:** TUS as default upload mechanism

---

## Success Criteria

### Must-Have
✅ TUS uploads create files at `imports/{user_id}/{timestamp}-{filename}` (RLM compatibility)
✅ RLM service downloads TUS-uploaded files successfully
✅ Progress tracking works on desktop and mobile
✅ RLS policies enforce user folder restrictions
✅ Error messages are user-friendly

### Should-Have
✅ Upload resumes automatically after network interruption
✅ Mobile uploads succeed for large files (>100MB)
✅ Upload time comparable to or better than XHR
✅ Feature flag allows gradual rollout

### Nice-to-Have
⚠️ Pause/resume UI controls (currently just "Cancel")
⚠️ Upload speed metrics (bytes/sec) in progress UI
⚠️ Multi-file upload support (future enhancement)

---

## Sources

**HIGH Confidence (Official Documentation):**
- [Supabase Storage Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) — TUS endpoint, auth, metadata format
- [Supabase Storage v3 Blog Post](https://supabase.com/blog/storage-v3-resumable-uploads) — Feature announcement, 50GB file support
- [Supabase Official Example](https://github.com/supabase/supabase/tree/master/examples/storage/resumable-upload-uppy) — Uppy + TUS integration code
- [tus-js-client GitHub](https://github.com/tus/tus-js-client) — API reference, code examples
- [tus-js-client NPM](https://www.npmjs.com/package/tus-js-client) — Package info, installation

**MEDIUM Confidence (Community Discussions):**
- [Supabase Discussion #22039](https://github.com/orgs/supabase/discussions/22039) — Local dev setup with TUS
- [Supabase Discussion #26424](https://github.com/orgs/supabase/discussions/26424) — Secure uploads without exposing keys
- [Transloadit Case Study](https://transloadit.com/casestudies/2023/08/supabase/) — TUS implementation details

**LOW Confidence (Inferred from Current Codebase):**
- RLS policy structure — assumed from storage path patterns in code
- Current chunked upload threshold (2GB) — found in chunked-upload.ts
- Mobile device detection logic — found in import/page.tsx

---

*Architecture research complete: 2026-02-09*
*Next step: Create implementation summary with phase structure*
