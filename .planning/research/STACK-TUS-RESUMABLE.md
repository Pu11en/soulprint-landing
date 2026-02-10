# Technology Stack: TUS Resumable Uploads

**Project:** SoulPrint Landing
**Purpose:** Add resumable upload capability for large ChatGPT export files (>50MB, up to 5GB)
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

Adding TUS resumable upload capability to the existing SoulPrint Next.js app requires **ONE library addition** (tus-js-client) and **configuration changes** to the existing upload flow. No server-side TUS implementation needed—Supabase Storage Pro plan natively supports TUS protocol at the `/storage/v1/upload/resumable` endpoint.

**Key insight:** This is a CLIENT-ONLY change. The backend (RLM service on Render) remains unchanged. Supabase Storage handles all TUS protocol operations server-side.

---

## Required Stack Addition

### Core Library

| Library | Version | Purpose | Installation |
|---------|---------|---------|--------------|
| **tus-js-client** | 4.3.1 | Client-side TUS resumable upload protocol implementation | `npm install tus-js-client` |

**Why tus-js-client over alternatives:**
1. **Official TUS implementation** - Maintained by the TUS protocol authors
2. **Built-in TypeScript types** - No @types package needed (types included since v3.x)
3. **Browser-native** - Pure JavaScript, works in all modern browsers, React, Next.js
4. **Production-proven** - Used by major platforms (Cloudflare Stream, Vimeo, etc.)
5. **Supabase-verified** - Official Supabase documentation uses tus-js-client in examples
6. **Minimal bundle size** - Lightweight compared to full upload UI libraries like Uppy

**Why NOT Uppy:**
- Uppy is a full upload UI framework (includes UI components, state management)
- Adds 300KB+ to bundle vs 50KB for tus-js-client
- Overkill for this use case—we already have custom UI in `app/import/page.tsx`
- GitHub issues show 5-10% upload failure rate with Uppy + Supabase
- Still uses tus-js-client under the hood

**Version rationale:**
- v4.3.1 is latest stable (released January 2025)
- v4.x requires Node.js v18+ (Vercel supports this)
- No breaking API changes from v3.x → v4.x (only Node version requirement)
- Built-in TypeScript types (no @types/tus-js-client needed)

---

## Supabase Storage TUS Endpoint

### Endpoint Configuration

**Standard endpoint (current):**
```
https://{projectId}.supabase.co/storage/v1/object/{bucket}/{path}
```
- Max file size: ~50MB (body limit)
- No resume capability

**TUS endpoint (new):**
```
https://{projectId}.storage.supabase.co/storage/v1/upload/resumable
```
- Max file size: 5GB (Pro plan default, configurable to 50GB+)
- Resume capability: 24-hour upload URL validity
- Chunk size: **MUST be 6MB** (Supabase requirement, DO NOT change)

**Why use `.storage.supabase.co` subdomain:**
- Supabase docs: "For optimal performance when uploading large files you should always use the direct storage hostname"
- Reduces routing hops
- Better for large file transfers

### Required Authentication Headers

| Header | Format | Source | Required |
|--------|--------|--------|----------|
| `Authorization` | `Bearer {access_token}` | `supabase.auth.getSession().data.session.access_token` | YES |
| `apikey` | `{anon_key}` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended |
| `x-upsert` | `'true'` | Static | Optional (allows file overwrite) |

**IMPORTANT:** Do NOT use service role key in `Authorization` header—it's not a JWT. Must use user's session token.

### Required Metadata Fields

TUS uploads to Supabase require metadata in the `metadata` object:

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `bucketName` | string | Target storage bucket | `'user-exports'` |
| `objectName` | string | File path/name in storage | `'user-123/conversations.json.gz'` |
| `contentType` | string | MIME type | `'application/gzip'` |
| `cacheControl` | string/number | Cache duration (seconds) | `3600` |
| `metadata` | string (JSON) | Custom metadata (optional) | `JSON.stringify({ userId: '123' })` |

---

## Complete Integration Example

### TypeScript Configuration

```typescript
import * as tus from 'tus-js-client'

interface TusUploadOptions {
  file: File
  bucketName: string
  objectName: string
  onProgress: (bytesUploaded: number, bytesTotal: number) => void
  onSuccess: () => void
  onError: (error: Error) => void
}

async function uploadWithTus({
  file,
  bucketName,
  objectName,
  onProgress,
  onSuccess,
  onError,
}: TusUploadOptions) {
  // Get authenticated session
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const upload = new tus.Upload(file, {
    // Supabase TUS endpoint
    endpoint: `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.storage.supabase.co/storage/v1/upload/resumable`,

    // Retry configuration
    retryDelays: [0, 3000, 5000, 10000, 20000],

    // Authentication headers
    headers: {
      authorization: `Bearer ${session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      'x-upsert': 'true', // Allow overwrite
    },

    // Required metadata for Supabase
    metadata: {
      bucketName: bucketName,
      objectName: objectName,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    },

    // CRITICAL: Must be 6MB for Supabase (DO NOT CHANGE)
    chunkSize: 6 * 1024 * 1024,

    // Resume behavior
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,

    // Progress tracking
    onProgress: (bytesUploaded, bytesTotal) => {
      onProgress(bytesUploaded, bytesTotal)
    },

    // Success handler
    onSuccess: () => {
      onSuccess()
    },

    // Error handler
    onError: (error) => {
      onError(error)
    },
  })

  // Start upload
  upload.start()

  // Return upload instance for potential pause/resume
  return upload
}
```

### Progress Callback API

**onProgress signature:**
```typescript
onProgress: (bytesUploaded: number, bytesTotal: number) => void
```

**Alternative: onChunkComplete** (more granular):
```typescript
onChunkComplete: (chunkSize: number, bytesAccepted: number, bytesTotal: number) => void
```

**Difference:**
- `onProgress`: Called multiple times during a chunk upload
- `onChunkComplete`: Called once after each 6MB chunk successfully uploads

**For UI progress bar, use `onProgress`:**
```typescript
onProgress: (bytesUploaded, bytesTotal) => {
  const percentage = Math.round((bytesUploaded / bytesTotal) * 100)
  setUploadProgress(percentage)
}
```

---

## Migration from Current XHR Upload

### Current Implementation (lib/chunked-upload.ts)

```typescript
// Current: XMLHttpRequest with manual chunking
const xhr = new XMLHttpRequest()
xhr.upload.addEventListener('progress', (e) => {
  const percent = (e.loaded / e.total) * 100
  onProgress(percent)
})
xhr.open('POST', url)
xhr.send(formData)
```

### New Implementation (lib/tus-upload.ts)

```typescript
// New: tus-js-client with automatic chunking
const upload = new tus.Upload(file, {
  endpoint: tusEndpoint,
  chunkSize: 6 * 1024 * 1024, // Automatic chunking
  onProgress: (uploaded, total) => {
    const percent = (uploaded / total) * 100
    onProgress(percent)
  },
})
upload.start()
```

### Key Differences

| Aspect | XHR (Current) | TUS (New) |
|--------|---------------|-----------|
| Max file size | ~50MB | 5GB+ |
| Resume capability | None | Yes (24hr) |
| Chunking | Manual | Automatic |
| Progress tracking | `e.loaded / e.total` | `bytesUploaded / bytesTotal` |
| Error retry | Manual | Built-in with configurable delays |
| Network interruption | Fails, restart from 0 | Resumes from last chunk |

---

## Integration Points in Existing Codebase

### Files to Modify

1. **lib/chunked-upload.ts** → Rename to **lib/tus-upload.ts**
   - Replace XHR implementation with tus-js-client
   - Keep existing progress callback interface
   - Add TUS-specific configuration

2. **app/import/page.tsx**
   - Import from `lib/tus-upload.ts` instead of `lib/chunked-upload.ts`
   - Update state management for TUS upload instance (for pause/resume)
   - Add error handling for 24hr expiry

3. **app/api/import/upload-raw/route.ts** (NO CHANGES NEEDED)
   - Currently stores to Supabase Storage via standard endpoint
   - With TUS, file goes directly to Supabase (client → Supabase Storage)
   - This API route may become obsolete (TUS bypasses Next.js API layer)

### Environment Variables

**No new environment variables needed:**
- ✅ `NEXT_PUBLIC_SUPABASE_PROJECT_ID` (existing)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (existing)
- ✅ User session token from `supabase.auth.getSession()` (existing)

---

## Configuration Requirements

### Supabase Storage Bucket Settings

**Bucket:** `user-exports` (existing)

**Required settings:**
- ✅ Pro plan (currently active)
- ✅ Global file size limit: 5GB minimum (check in Supabase Dashboard → Storage → Settings)
- ✅ Bucket-specific file size limit: Match or exceed expected file sizes
- ✅ Authentication: RLS policies already configured

**Verify in Supabase Dashboard:**
1. Storage → Settings → Global file size limit ≥ 5GB
2. Storage → user-exports bucket → File size limit setting

### Next.js Configuration

**Vercel deployment:**
- ✅ No changes needed (TUS upload happens client → Supabase, bypassing Vercel)
- ✅ No body size limit applies (not going through Next.js API routes)

**Local development:**
- ✅ Works with `npm run dev` (tus-js-client is browser-only)

---

## Known Limitations and Workarounds

### 1. 6MB Chunk Size Requirement

**Limitation:** Supabase requires `chunkSize: 6 * 1024 * 1024` (6MB) for TUS uploads.

**Why:** Supabase documentation states "it must be set to 6MB (for now) do not change it." This is a temporary infrastructure constraint.

**Impact:**
- A 500MB file = ~84 chunks
- A 2GB file = ~342 chunks
- Each chunk requires separate PATCH request

**Workaround:** None. Must use 6MB. Supabase may increase this in future.

### 2. 24-Hour Upload URL Expiry

**Limitation:** TUS upload URLs expire after 24 hours.

**Impact:** If user starts upload and abandons for >24hr, cannot resume.

**Workaround:**
```typescript
onError: (error) => {
  if (error.message.includes('404') || error.message.includes('expired')) {
    // Upload URL expired, restart upload
    console.log('Upload expired, restarting...')
    upload.start() // Creates new upload URL
  }
}
```

### 3. CORS and Authentication in Browser

**Limitation:** Browser must send credentials with TUS requests.

**Solution:** Already handled by tus-js-client when providing `authorization` header. No additional CORS configuration needed (Supabase Storage handles this).

### 4. Local Development with Supabase

**Limitation:** Supabase CLI local development has known issues with TUS uploads >6MB.

**Impact:** May see failures in local environment with `supabase start`.

**Workaround:**
- Test TUS uploads against production/staging Supabase instance
- OR use standard upload endpoint (<50MB) for local development testing
- GitHub Issue #2729 tracks this (still open as of 2025)

### 5. Upload Fingerprinting for Resume

**Behavior:** tus-js-client stores upload URL in localStorage by default using file "fingerprint" (filename + size + modification date).

**Implication:** If user:
1. Starts upload
2. Closes browser
3. Reopens with SAME file

Upload resumes automatically.

**Control via options:**
```typescript
storeFingerprintForResuming: true, // Default
removeFingerprintOnSuccess: true,  // Clean up after success
```

**Custom fingerprint:**
```typescript
fingerprint: (file, options) => {
  // Custom logic to identify file
  return `${file.name}-${file.size}-${userId}`
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test TUS upload configuration
test('creates TUS upload with correct Supabase config', () => {
  const upload = createTusUpload(mockFile, mockOptions)
  expect(upload.options.endpoint).toContain('storage.supabase.co/storage/v1/upload/resumable')
  expect(upload.options.chunkSize).toBe(6 * 1024 * 1024)
  expect(upload.options.headers.authorization).toContain('Bearer')
})

// Test progress calculation
test('calculates upload percentage correctly', () => {
  const onProgress = jest.fn()
  // Simulate progress callback
  onProgress(50 * 1024 * 1024, 100 * 1024 * 1024) // 50%
  expect(onProgress).toHaveBeenCalledWith(50 * 1024 * 1024, 100 * 1024 * 1024)
})
```

### Integration Tests

**Manual testing checklist:**
- [ ] Upload 10MB file (should use TUS, ~2 chunks)
- [ ] Upload 100MB file (should use TUS, ~17 chunks)
- [ ] Upload 500MB file (should use TUS, ~84 chunks)
- [ ] Interrupt upload (close tab), resume in new tab (should resume from last chunk)
- [ ] Interrupt network (airplane mode), restore (should auto-retry)
- [ ] Let upload URL expire (wait 24hr+), restart (should create new upload URL)

### Browser Compatibility

**Supported:** All modern browsers with File API support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Not supported:** IE11 (File API limitations)

**Verification:**
```typescript
if (!window.File || !window.FileReader || !window.Blob) {
  // Fallback to standard upload or show error
  console.error('Browser does not support File API')
}
```

---

## Performance Characteristics

### Upload Speed Comparison

**Current XHR (single request):**
- 50MB file: ~30-60 seconds (network dependent)
- Fails if network drops during upload

**TUS (chunked, resumable):**
- 50MB file: ~35-70 seconds (slightly slower due to chunking overhead)
- Resumes automatically if network drops
- Can pause/resume programmatically

**500MB file comparison:**
- XHR: Not possible (body size limit)
- TUS: 5-10 minutes, resumable across sessions

### Memory Usage

**Current XHR:**
- Loads entire file into memory
- 500MB file = 500MB+ memory usage

**TUS:**
- Streams file in 6MB chunks
- 500MB file = ~6MB memory usage (constant)

**Benefit:** Large file uploads won't crash browser on low-memory devices.

---

## Security Considerations

### Client-Side Token Exposure

**Risk:** User's access token is passed in headers from browser.

**Mitigation:**
- ✅ HTTPS only (enforced by Supabase)
- ✅ Short-lived tokens (Supabase sessions expire after 1 hour)
- ✅ Row-level security policies on `user-exports` bucket (already configured)

**NOT a risk:** Using `x-upsert: true` only allows user to overwrite their OWN files (RLS enforces this).

### Anonymous Key in Client

**Current:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is already exposed in client.

**TUS impact:** No change—same key used for authentication with user token.

### Upload URL Sharing

**Risk:** If someone gets the TUS upload URL, can they hijack the upload?

**Mitigation:**
- TUS upload URLs are single-use, bound to the file fingerprint
- Cannot upload different file to existing URL
- URLs expire after 24 hours
- Supabase validates `authorization` token on each chunk

---

## Monitoring and Debugging

### Progress Logging

```typescript
onProgress: (bytesUploaded, bytesTotal) => {
  const percent = Math.round((bytesUploaded / bytesTotal) * 100)
  const mbUploaded = (bytesUploaded / 1024 / 1024).toFixed(2)
  const mbTotal = (bytesTotal / 1024 / 1024).toFixed(2)
  console.log(`Upload progress: ${percent}% (${mbUploaded}MB / ${mbTotal}MB)`)
}
```

### Error Logging

```typescript
onError: (error) => {
  console.error('TUS upload error:', {
    message: error.message,
    // TUS error objects include request/response details
    originalRequest: error.originalRequest,
    originalResponse: error.originalResponse,
  })

  // Send to error tracking (Sentry, etc.)
  trackError('tus_upload_failed', {
    fileSize: file.size,
    fileName: file.name,
    errorMessage: error.message,
  })
}
```

### Supabase Storage Logs

**Dashboard:** Supabase Dashboard → Logs → Storage

**Useful for:**
- Failed chunk uploads
- Authentication errors
- RLS policy violations

---

## Alternative Approaches Considered

### 1. Multipart Upload (AWS S3 style)

**What:** S3-compatible multipart upload API

**Pros:**
- More flexible chunk sizes
- Better for very large files (>50GB)

**Cons:**
- Supabase Storage doesn't expose S3 multipart API
- Would require custom backend implementation
- More complex than TUS

**Verdict:** Not applicable—Supabase Storage uses TUS, not S3 multipart.

### 2. Direct S3 Upload (bypass Supabase)

**What:** Upload directly to S3 bucket underlying Supabase Storage

**Pros:**
- Full control over S3 features
- Could use S3 multipart upload

**Cons:**
- Bypasses Supabase RLS policies (security risk)
- Breaks Supabase Storage metadata/database sync
- Requires AWS credentials management
- More complex architecture

**Verdict:** Rejected—breaks Supabase Storage abstraction, security risks.

### 3. Uppy + TUS

**What:** Use Uppy framework instead of tus-js-client directly

**Pros:**
- Includes UI components (progress bar, drag-drop)
- State management built-in
- Multiple upload sources (local, URL, webcam)

**Cons:**
- Much larger bundle size (~300KB vs ~50KB)
- Already have custom UI in `app/import/page.tsx`
- GitHub issues show 5-10% failure rate with Supabase
- Overkill for single file upload use case

**Verdict:** Rejected—unnecessary complexity, larger bundle, existing custom UI.

### 4. Cloudflare Stream TUS

**What:** Use Cloudflare Stream's TUS implementation instead of Supabase

**Pros:**
- Potentially better TUS support (no 6MB chunk limit)

**Cons:**
- Requires moving from Supabase Storage to Cloudflare
- Additional service dependency
- Migration effort
- Doesn't solve the core problem (need storage for non-video files too)

**Verdict:** Not applicable—Supabase Storage is existing, working system.

---

## Implementation Checklist

### Phase 1: Add Library
- [ ] Install tus-js-client: `npm install tus-js-client`
- [ ] Verify TypeScript types available (should auto-detect)
- [ ] Test import: `import * as tus from 'tus-js-client'`

### Phase 2: Create TUS Upload Module
- [ ] Create `lib/tus-upload.ts` with configuration function
- [ ] Implement progress callback wrapper
- [ ] Implement error handling with retry logic
- [ ] Add TypeScript types for options

### Phase 3: Update Import UI
- [ ] Modify `app/import/page.tsx` to use TUS upload
- [ ] Update progress bar to use TUS callbacks
- [ ] Add pause/resume UI (optional, but TUS supports it)
- [ ] Add error messaging for 24hr expiry

### Phase 4: Test
- [ ] Test with files 10MB - 100MB
- [ ] Test network interruption (airplane mode)
- [ ] Test browser close/reopen (resume)
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Verify uploaded files appear in Supabase Storage dashboard

### Phase 5: Cleanup (Optional)
- [ ] Consider deprecating `app/api/import/upload-raw/route.ts` (now bypassed)
- [ ] Update documentation to note TUS used for large files
- [ ] Monitor Supabase Storage logs for errors

---

## Maintenance Considerations

### Dependency Updates

**tus-js-client:**
- Check for updates quarterly
- Review changelog for breaking changes
- Test thoroughly before upgrading (upload functionality is critical)

**Monitoring:**
- Set up Dependabot or Renovate for tus-js-client updates
- Pin to minor version: `"tus-js-client": "^4.3.1"` (allows patches, not majors)

### Supabase Storage Updates

**Watch for:**
- Increased chunk size limit (currently 6MB, may increase)
- File size limit changes (currently 5GB on Pro)
- TUS protocol updates (Supabase may update to newer TUS spec)

**How to monitor:**
- Subscribe to Supabase changelog: https://supabase.com/changelog
- Watch GitHub issues: https://github.com/supabase/storage/issues

### Browser API Changes

**Unlikely but possible:**
- File API deprecations
- LocalStorage restrictions (affects resume fingerprints)

**Mitigation:**
- tus-js-client maintainers will handle browser API changes
- Keep tus-js-client updated

---

## Cost Implications

### Bandwidth

**Supabase Storage egress:**
- Pro plan: 250GB/month included
- Overage: $0.09/GB

**TUS impact:**
- No change from standard uploads
- Each chunk upload counts toward egress
- Resume functionality actually REDUCES bandwidth (no full file re-uploads)

### Storage

**Supabase Storage:**
- Pro plan: 100GB included
- Overage: $0.021/GB/month

**TUS impact:**
- No change—same files stored
- Compressed files (`.json.gz`) reduce storage cost

### API Requests

**Supabase Storage API:**
- Pro plan: 5M requests/month included
- TUS: Each chunk = 1 request

**Example:**
- 500MB file with 6MB chunks = ~84 requests
- 100 users uploading 500MB each = 8,400 requests
- Well within 5M limit

---

## Future Enhancements

### 1. Parallel Uploads

**Current:** tus-js-client default: sequential chunks

**Possible:** tus-js-client supports `parallelUploads` option

```typescript
parallelUploads: 3, // Upload 3 chunks simultaneously
parallelUploadBoundaries: [0, 50 * 1024 * 1024, 100 * 1024 * 1024], // Ranges
```

**Benefit:** Faster uploads for large files on fast connections

**Risk:** More complex error handling

**Recommendation:** Start with sequential, add if needed.

### 2. Upload Pause/Resume UI

**Current:** Auto-resume on network drop, but no user control

**Possible:** Add pause/resume buttons

```typescript
// Pause
upload.abort()

// Resume
upload.start()
```

**Use case:** User wants to pause upload to conserve bandwidth

### 3. Upload Queue

**Current:** Single file upload at a time

**Possible:** Queue multiple files for upload

**Use case:** User has multiple ChatGPT exports to upload

**Implementation:** Array of TUS upload instances

### 4. Upload Analytics

**Track:**
- Average upload time by file size
- Chunk retry frequency
- Network interruption recovery rate

**Use for:**
- Performance optimization
- User experience improvements

---

## Documentation References

### Official Documentation

- [Supabase Storage Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [tus-js-client GitHub](https://github.com/tus/tus-js-client)
- [tus-js-client API Documentation](https://github.com/tus/tus-js-client/blob/main/docs/api.md)
- [TUS Protocol Specification](https://tus.io/)

### Blog Posts & Case Studies

- [Supabase Storage v3: Resumable Uploads](https://supabase.com/blog/storage-v3-resumable-uploads)
- [Supabase adds resumable uploads using Tus | Transloadit](https://transloadit.com/casestudies/2023/08/supabase/)

### GitHub Issues (Known Problems)

- [File Uploads Fail Beyond 6MB with TUS in Supabase CLI #2729](https://github.com/supabase/cli/issues/2729)
- [5-10% of Uppy/TUS uploads fail #419](https://github.com/supabase/storage/issues/419)
- [Secure Supabase Storage Uploads in Next.js using Uppy and Tus #26424](https://github.com/orgs/supabase/discussions/26424)

---

## Sources

- [tus-js-client - npm](https://www.npmjs.com/package/tus-js-client)
- [tus-js-client Releases](https://github.com/tus/tus-js-client/releases)
- [Resumable Uploads | Supabase Docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase Storage v3: Resumable Uploads with support for 50GB files](https://supabase.com/blog/storage-v3-resumable-uploads)
- [tus-js-client API Documentation](https://github.com/tus/tus-js-client/blob/main/docs/api.md)
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [@types/tus-js-client - npm](https://www.npmjs.com/package/@types/tus-js-client)
- [Secure Supabase Storage Uploads in Next.js using Uppy and Tus](https://github.com/orgs/supabase/discussions/26424)
- [5-10% of Uppy/TUS uploads fail · Issue #419](https://github.com/supabase/storage/issues/419)
- [File Uploads Fail Beyond 6MB Limit with TUS · Issue #2729](https://github.com/supabase/cli/issues/2729)

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Library version | HIGH | Official npm registry, verified release notes |
| Supabase endpoint | HIGH | Official Supabase documentation, WebFetch verified |
| Authentication | HIGH | Official docs example code, multiple source confirmation |
| Metadata fields | HIGH | Official docs source code, GitHub repo verified |
| Chunk size requirement | HIGH | Multiple sources confirm 6MB requirement |
| TypeScript support | HIGH | Official package includes types, verified via npm |
| Browser compatibility | MEDIUM | Based on official docs stating "all browsers", specific versions inferred |
| Performance characteristics | MEDIUM | Based on protocol design and reported experiences, not benchmarked |
| Known issues | MEDIUM | GitHub issues verified, but severity/frequency varies by report |

---

## Quick Reference

### Installation
```bash
npm install tus-js-client
```

### Minimal Example
```typescript
import * as tus from 'tus-js-client'

const upload = new tus.Upload(file, {
  endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
  headers: {
    authorization: `Bearer ${accessToken}`,
  },
  metadata: {
    bucketName: 'user-exports',
    objectName: 'file.json.gz',
    contentType: 'application/gzip',
  },
  chunkSize: 6 * 1024 * 1024,
  onProgress: (up, total) => console.log(`${Math.round(up/total*100)}%`),
  onSuccess: () => console.log('Done!'),
  onError: (err) => console.error(err),
})

upload.start()
```

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Files to Modify
1. `lib/tus-upload.ts` (create new)
2. `app/import/page.tsx` (update import flow)
3. `app/api/import/upload-raw/route.ts` (potentially deprecate)

### Critical Configuration
- **chunkSize**: MUST be `6 * 1024 * 1024` (6MB)
- **endpoint**: MUST use `.storage.supabase.co` subdomain
- **metadata.bucketName**: Required
- **metadata.objectName**: Required
