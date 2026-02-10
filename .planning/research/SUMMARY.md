# Research Summary: TUS Resumable Uploads for v2.3 Universal Uploads

**Milestone:** v2.3 Universal Uploads
**Domain:** Browser-based resumable file uploads for ChatGPT exports (1MB-5GB)
**Researched:** 2026-02-09
**Overall Confidence:** HIGH

## Executive Summary

Adding TUS (The Upload Server) protocol to SoulPrint is a **low-risk, high-value upgrade** that solves mobile upload reliability issues with minimal architectural changes. The integration is client-side only — requiring one new library (tus-js-client), one new module (lib/tus-upload.ts), and modifications to the upload orchestration in app/import/page.tsx. No backend changes, no database schema changes, no RLM service changes.

**Critical insight:** TUS uploads produce identical storage paths to existing XHR uploads (imports/{user_id}/{timestamp}-{filename}), ensuring zero impact on downstream processing. The primary value is automatic resume on network interruption, better mobile reliability via smaller 6MB chunks, and built-in exponential retry logic.

**Estimated effort:** 1-2 days implementation + testing, gradual rollout via feature flag.

## Key Technical Decisions

### 1. Client-Side Integration Only

**Decision:** Integrate TUS at the browser upload layer only. No server-side changes.

**Rationale:**
- Supabase Storage natively supports TUS protocol at `/storage/v1/upload/resumable` endpoint
- Current backend flow (trigger API → RLM service) works with storage paths, not upload mechanism
- TUS metadata configuration produces same storage path format as XHR uploads
- RLS policies apply automatically via bearer token authentication

**What changes:**
- `lib/tus-upload.ts` (NEW) — wrapper around tus-js-client
- `app/import/page.tsx` (MODIFIED) — upload orchestration (lines 510-598)
- `package.json` (MODIFIED) — add tus-js-client dependency

**What stays unchanged:**
- `/api/import/trigger` endpoint
- RLM service integration
- Supabase RLS policies
- Database schema
- Storage bucket configuration

### 2. Library Selection: tus-js-client (not Uppy)

**Decision:** Use tus-js-client directly instead of Uppy framework.

**Rationale:**
- Lighter bundle (15KB vs 60KB+)
- Simple API vs full UI framework (already have custom UI)
- Native TypeScript types included
- Maintained by TUS protocol authors
- Supabase official docs use tus-js-client in examples

**Installation:**
```bash
npm install tus-js-client
```

### 3. Hardcoded 6MB Chunk Size (Supabase Requirement)

**Decision:** Use exactly 6MB chunks. Do not make configurable.

**Rationale:**
- Supabase Storage requires 6MB chunks for TUS uploads (documentation explicitly states "must be 6MB, do not change")
- Non-6MB chunks cause upload stalls at 6MB mark or complete failures
- Smaller than current 50MB XHR chunks, but provides better resume granularity and mobile compatibility

**Implementation:**
```typescript
const upload = new tus.Upload(file, {
  chunkSize: 6 * 1024 * 1024, // MUST be exactly 6MB
  // ...
});
```

### 4. JWT Token Refresh Strategy

**Decision:** Implement onBeforeRequest callback to refresh access tokens before each chunk upload.

**Rationale:**
- Supabase JWT access tokens expire after 1 hour
- Large file uploads on slow connections can take multiple hours
- Each chunk upload requires valid authorization header
- tus-js-client doesn't auto-refresh tokens

**Implementation:**
```typescript
const upload = new tus.Upload(file, {
  onBeforeRequest: async (req) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No valid session');
    }
    req.setHeader('Authorization', `Bearer ${session.access_token}`);
  },
  // ...
});
```

### 5. Storage Path Compatibility

**Decision:** Use TUS metadata to specify storage path, ensuring identical format to XHR uploads.

**Rationale:**
- RLM service downloads files using storage path from trigger API
- Path format must remain `imports/{user_id}/{timestamp}-{filename}`
- TUS supports path specification via metadata.objectName

**Implementation:**
```typescript
const upload = new tus.Upload(file, {
  endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
  metadata: {
    bucketName: 'imports',
    objectName: `${userId}/${timestamp}-${filename}`,
    contentType: 'application/json',
    cacheControl: '3600'
  },
  // ...
});
```

### 6. Gradual Rollout via Feature Flag

**Decision:** Deploy with environment variable feature flag, enable progressively (10% → 50% → 100%).

**Rationale:**
- Low risk: Easy rollback if issues discovered
- Metrics comparison: Upload success rate, time, error types
- User segmentation: Test mobile vs desktop separately
- Validation: Verify RLM integration works before full cutover

**Implementation:**
```typescript
const USE_TUS = process.env.NEXT_PUBLIC_USE_TUS_UPLOAD === 'true';
const uploadResult = USE_TUS
  ? await tusUploadWithProgress(blob, userId, filename, onProgress)
  : await uploadWithProgress(blob, url, token, contentType, onProgress);
```

## Critical Risks

### Risk 1: Client-Side ZIP Extraction Memory Exhaustion (CRITICAL)

**Problem:** Loading entire ZIP file into browser memory to extract conversations.json causes Out-of-Memory crashes on mobile devices, especially for files >500MB.

**Impact:**
- Silent failures on mobile (iOS Safari kills tab without error)
- Android Chrome shows "Out of Memory" error
- Affects 1GB+ files severely (requires 2GB+ RAM due to UTF-16 encoding)

**Prevention:**
- **REMOVE client-side ZIP extraction entirely**
- Upload ZIP directly via TUS (no JSZip processing before upload)
- Move extraction to server-side (Vercel API route or background job)
- Server has predictable memory, can stream extraction

**Implementation:**
```javascript
// OLD: Extract before upload (causes memory issues)
const zip = await JSZip.loadAsync(file);
const conversations = await zip.file('conversations.json').async('text');
// then upload conversations

// NEW: Upload ZIP directly via TUS
const upload = new tus.Upload(zipFile, { /* config */ });
upload.start();
// Extract server-side in /api/import/extract
```

**Detection:**
- Monitor upload failures by device type (mobile vs desktop)
- Track browser crashes via window.addEventListener('error')
- Log device memory at upload start (navigator.deviceMemory)

**Phase:** Must address in Phase 1 (TUS Client Implementation)

### Risk 2: JWT Token Expiry During Long Uploads (CRITICAL)

**Problem:** Supabase JWT access tokens expire after 1 hour. Multi-hour uploads (large files on slow connections) fail with 401 Unauthorized mid-upload.

**Impact:**
- Upload proceeds for 1 hour, then fails with authentication error
- User loses progress if fingerprint not stored
- No clear error message to user

**Prevention:**
- Implement onBeforeRequest callback to refresh token before each chunk
- Add retry logic for 401 errors
- Alternative: Use createSignedUploadUrl() for 24-hour validity (no refresh needed)

**Implementation:** See "JWT Token Refresh Strategy" in Key Technical Decisions above.

**Detection:**
- Monitor 401 errors in upload callbacks
- Track upload duration vs file size (flag uploads >50 minutes)
- Log token expiry timestamps vs upload start time

**Phase:** Must address in Phase 1 (TUS Client Implementation)

### Risk 3: localStorage Fingerprint Collisions (HIGH)

**Problem:** tus-js-client caches upload fingerprints in localStorage. Uploading same file twice reuses cached upload URL, causing silent failures if URL expired.

**Impact:**
- User re-uploads same file → instant "success" but no actual transfer
- 404 errors when trying to access uploaded file
- 5-10% of uploads affected in production (per Supabase GitHub issues)

**Prevention:**
```typescript
const upload = new tus.Upload(file, {
  removeFingerprintOnSuccess: true, // Critical: clean up after success
  metadata: {
    uploadId: crypto.randomUUID(), // Force unique fingerprint per upload
    // ...
  },
});
```

**Detection:**
- Check localStorage for tus:: keys between uploads
- Monitor "instant" upload completions (<100ms for large files)
- Verify file exists in storage after upload success callback

**Phase:** Must address in Phase 1 (TUS Client Implementation)

### Risk 4: iOS Safari Memory Limits (HIGH)

**Problem:** iOS Safari has severe memory constraints (~100MB practical limit). Large file uploads (>500MB) exhaust memory and crash the browser tab.

**Impact:**
- Tab crashes during upload with no error message
- Particularly bad on older devices (iPhone 8, iPad Air 2)
- Upload progress lost on tab reload

**Prevention:**
- Warn users before mobile uploads >100MB
- Implement upload recovery UI (detect interrupted uploads on page load)
- Use TUS resume capability to survive crashes
- Consider suggesting desktop browser for 1GB+ files

**Implementation:**
```typescript
// Detect device capability
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const memory = navigator.deviceMemory;

if (isIOS && file.size > 500 * 1024 * 1024) {
  showWarning('Large uploads on iOS may fail. Consider using a desktop browser.');
}

// On page load, check for interrupted uploads
const previousUploads = await tus.Upload.getResumeableUploads();
if (previousUploads.length > 0) {
  showResumeDialog(); // Let user resume
}
```

**Detection:**
- Track mobile vs desktop upload success rates
- Monitor iOS-specific crashes via analytics
- Log device memory at upload start

**Phase:** Should address in Phase 2 (Mobile Browser Support) or Phase 3 (UX Polish)

### Risk 5: Using Anon Key Instead of Session Token (CRITICAL)

**Problem:** Developer uses NEXT_PUBLIC_SUPABASE_ANON_KEY for authorization instead of user's session token, causing RLS policy violations.

**Impact:**
- All TUS uploads fail with 403 Forbidden
- RLS policy violations logged in Supabase
- Security vulnerability if bucket RLS bypassed to "fix" issue

**Prevention:**
```typescript
// WRONG: Using anon key
const upload = new tus.Upload(file, {
  headers: {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` // ❌
  }
});

// RIGHT: Using session token
const { data: { session } } = await supabase.auth.getSession();
const upload = new tus.Upload(file, {
  headers: {
    'Authorization': `Bearer ${session.access_token}` // ✅
  }
});
```

**Detection:**
- Monitor 403 errors during upload
- Check Supabase logs for RLS violations
- Validate authorization header contains JWT pattern (eyJ...), not static key

**Phase:** Must address in Phase 1 (TUS Client Implementation)

## Recommended Architecture

### Component Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (Client-Side)                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  app/import/page.tsx (Upload Orchestration)                    │
│    ↓                                                            │
│  lib/tus-upload.ts (NEW - TUS Wrapper)                         │
│    ↓                                                            │
│  tus-js-client (NPM Package)                                   │
│    ↓                                                            │
│  Direct upload to Supabase Storage (bypasses Next.js)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Storage (External Service)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TUS Endpoint: /storage/v1/upload/resumable                    │
│    ↓                                                            │
│  Stores to: imports/{user_id}/{timestamp}-{filename}           │
│    ↓                                                            │
│  RLS policies enforced via bearer token                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ Next.js API Routes (UNCHANGED)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/import/trigger (receives storagePath)                    │
│    ↓                                                            │
│  Calls RLM service with storage path                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ RLM Service (UNCHANGED)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Downloads file from Supabase using storagePath               │
│  Processes conversations                                       │
│  Generates soulprint                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. File Selection**
```
User selects ZIP → File object in browser
```

**2. Upload Initiation**
```typescript
// app/import/page.tsx
const uploadResult = await tusUploadWithProgress(
  uploadBlob,
  user.id,
  uploadFilename,
  (percent) => setProgress(15 + percent * 0.35) // Map to 15-50% range
);
```

**3. TUS Upload**
```typescript
// lib/tus-upload.ts
const upload = new tus.Upload(blob, {
  endpoint: 'https://{project}.storage.supabase.co/storage/v1/upload/resumable',
  metadata: {
    bucketName: 'imports',
    objectName: `${userId}/${timestamp}-${filename}`,
    contentType: 'application/json',
    cacheControl: '3600'
  },
  headers: {
    authorization: `Bearer ${session.access_token}`
  },
  chunkSize: 6 * 1024 * 1024,
  onProgress: (uploaded, total) => onProgress((uploaded / total) * 100)
});

upload.start();
```

**4. Upload Completion**
```typescript
onSuccess: () => {
  // Extract storagePath from upload.url
  const storagePath = new URL(upload.url).pathname
    .replace('/storage/v1/object/', '');
  // → 'imports/{user_id}/{timestamp}-{filename}'

  return { success: true, storagePath };
}
```

**5. Trigger Processing** (UNCHANGED)
```typescript
// app/import/page.tsx
await fetch('/api/import/trigger', {
  method: 'POST',
  body: JSON.stringify({ storagePath })
});
```

**6. RLM Download and Processing** (UNCHANGED)
```
RLM service receives storage_path
Downloads from Supabase Storage
Processes conversations
Saves soulprint to database
```

### Error Handling Flow

```typescript
// lib/tus-upload.ts
const upload = new tus.Upload(file, {
  // ...

  onError: (error) => {
    // Map TUS errors to user-friendly messages
    const userMessage = classifyTusError(error);
    return { success: false, error: userMessage };
  },

  onShouldRetry: (err, retryAttempt, options) => {
    const status = err?.originalResponse?.getStatus();

    // Retry on 401 (token expired) and 5xx errors
    if (status === 401 || (status >= 500 && status < 600)) {
      return retryAttempt < 3;
    }
    return false;
  },

  retryDelays: [0, 3000, 5000, 10000, 20000]
});

function classifyTusError(error) {
  const status = error?.originalResponse?.getStatus();
  const message = error.message?.toLowerCase() || '';

  if (status === 401 || message.includes('unauthorized')) {
    return 'Session expired. Please refresh the page and try again.';
  }

  if (status === 409 || message.includes('conflict')) {
    return 'Upload already in progress. Please wait or cancel the previous upload.';
  }

  if (status === 410 || message.includes('gone') || message.includes('expired')) {
    return 'Upload session expired. Starting fresh...';
  }

  if (status === 413 || message.includes('too large')) {
    return 'File too large for current plan. Contact support.';
  }

  if (status >= 500) {
    return 'Server issue. Retrying...';
  }

  return 'Upload failed. Please try again.';
}
```

## Implementation Scope

### In Scope (MVP)

**Must-have features:**
- TUS upload for all files (replace XHR entirely)
- Automatic resume after network disconnect
- Real-time progress tracking (onProgress → UI)
- Retry on network failure (built-in exponential backoff)
- Upload cancellation (abort() button)
- 6MB chunk size (Supabase requirement)
- JWT token refresh (onBeforeRequest callback)
- Fingerprint cleanup on success (removeFingerprintOnSuccess: true)
- Storage path compatibility (identical format to XHR)
- RLS policy enforcement (via bearer token)
- Error classification (map TUS errors to user messages)

**Files to create:**
- `lib/tus-upload.ts` (TUS wrapper module)

**Files to modify:**
- `app/import/page.tsx` (upload orchestration, lines 510-598)
- `package.json` (add tus-js-client dependency)
- `.env.local` (add NEXT_PUBLIC_USE_TUS_UPLOAD feature flag)

**Testing checklist:**
- Small file upload (<10MB)
- Large file upload (>100MB)
- Network interruption → auto-resume
- Mobile devices (iOS Safari, Chrome Mobile)
- RLM integration (verify downloads work)
- RLS enforcement (user can't upload to other folders)

### Out of Scope (Defer to Future)

**Nice-to-have features (post-MVP):**
- Resume after browser close detection (findPreviousUploads() on page load)
- Upload speed estimation ("X minutes remaining")
- Pause/resume control (manual pause button)
- Presigned URLs (for guest uploads)
- Parallel chunk upload (Concatenation extension)
- Multi-file batch upload (not needed for SoulPrint)

**Explicitly excluded:**
- Server-side TUS implementation (Supabase handles this)
- Custom chunk sizes (must use 6MB per Supabase)
- Checksum verification (not in tus-js-client)
- Upload queue management (single file at a time)

### Phase Breakdown

**Phase 1: TUS Upload Module (4-6 hours)**
- Install tus-js-client
- Create lib/tus-upload.ts
- Implement tusUploadWithProgress() function
- Configure endpoint, metadata, auth, retries
- Extract storagePath from upload.url
- Write unit tests

**Phase 2: Frontend Integration (2-3 hours)**
- Add feature flag to .env
- Modify app/import/page.tsx upload logic
- Map progress callbacks to existing UI
- Add TUS error classification
- Test locally with small/large files

**Phase 3: Testing & Validation (2-3 hours)**
- Deploy to staging with feature flag
- Test network interruption/resume
- Test on mobile devices (iOS/Android)
- Verify RLM integration
- Check RLS policy enforcement

**Phase 4: Gradual Rollout (1-2 days)**
- Deploy to production (flag disabled)
- Enable for 10% of users → monitor 24hr
- Enable for 50% of users → monitor 24hr
- Enable for 100% of users → monitor 48hr
- Remove feature flag + XHR code path
- Delete lib/chunked-upload.ts

**Total effort:** 1-2 days implementation + testing, 2-3 days monitoring during rollout

## Dependencies & Prerequisites

### Technical Dependencies

**New NPM packages:**
```json
{
  "dependencies": {
    "tus-js-client": "^4.3.1"
  }
}
```

**Why tus-js-client 4.3.1:**
- Latest stable release (January 2025)
- Built-in TypeScript types (no @types package needed)
- Requires Node.js v18+ (Vercel supports this)
- No breaking changes from v3.x → v4.x

**Existing dependencies (unchanged):**
- `@supabase/supabase-js` (auth and storage client)
- `jszip` (ZIP extraction, move to server-side)
- Next.js, React (no version changes)

### Environment Variables

**New variables:**
```env
NEXT_PUBLIC_USE_TUS_UPLOAD=false  # Feature flag (enable gradually)
```

**Existing variables (unchanged):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://swvljsixpvvcirjmflze.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Supabase Configuration

**Storage bucket settings:**
- Bucket: `imports` (existing)
- Pro plan (active) ✓
- Global file size limit: 5GB minimum (verify in dashboard)
- RLS policies: Already configured ✓

**Verification checklist:**
- [ ] Supabase Dashboard → Storage → Settings → Global file size limit ≥ 5GB
- [ ] Storage → imports bucket → File size limit setting
- [ ] Auth → Users → Confirm JWT expiry = 3600s (1 hour)

### Browser Compatibility

**Supported browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari iOS 14+
- Chrome Mobile Android 90+

**Not supported:**
- IE11 (File API limitations)

**Verification:**
```typescript
if (!window.File || !window.FileReader || !window.Blob) {
  showError('Browser does not support file uploads');
}
```

### Infrastructure Requirements

**Vercel deployment:**
- No changes needed (TUS upload bypasses Vercel, goes direct to Supabase)
- No body size limit applies (not going through Next.js API routes)
- Works with existing Vercel configuration

**Local development:**
- Works with `npm run dev` (tus-js-client is browser-only)
- Note: Supabase CLI local development has known issues with TUS uploads >6MB
  - Workaround: Test against production/staging Supabase instance
  - GitHub Issue #2729 tracks this (still open as of 2025)

### Monitoring Setup

**Metrics to track:**
- Upload success rate (TUS vs XHR baseline)
- Average upload time by file size
- Resume frequency (how often users benefit from resume)
- Error types and frequencies
- Mobile vs desktop performance differences

**Alert conditions:**
- TUS success rate <90% (below XHR baseline)
- Upload time >2x XHR baseline
- Error rate spike for specific browser/device

**Implementation:**
```typescript
// Track upload metrics
analytics.track('upload_started', {
  fileSize: file.size,
  uploadMethod: 'tus',
  browser: navigator.userAgent,
  deviceMemory: navigator.deviceMemory
});

analytics.track('upload_completed', {
  fileSize: file.size,
  uploadMethod: 'tus',
  duration: Date.now() - startTime,
  resumeCount: resumeCount
});

analytics.track('upload_failed', {
  fileSize: file.size,
  uploadMethod: 'tus',
  error: error.message,
  errorStatus: error?.originalResponse?.getStatus()
});
```

## Success Criteria

### Must-Have (Phase 1)
- [ ] TUS uploads create files at `imports/{user_id}/{timestamp}-{filename}` (RLM compatibility)
- [ ] RLM service downloads TUS-uploaded files successfully
- [ ] Progress tracking works on desktop and mobile
- [ ] RLS policies enforce user folder restrictions
- [ ] Error messages are user-friendly (classified via existing system)
- [ ] JWT token refresh works (no auth failures on long uploads)
- [ ] Fingerprint cleanup prevents collision issues
- [ ] 6MB chunks configured correctly (Supabase requirement)

### Should-Have (Phase 2-3)
- [ ] Upload resumes automatically after network interruption
- [ ] Mobile uploads succeed for large files (>100MB)
- [ ] Upload time comparable to or better than XHR
- [ ] Feature flag allows gradual rollout
- [ ] Monitoring dashboard tracks success rate, errors, duration

### Nice-to-Have (Post-MVP)
- [ ] Resume after browser close detection
- [ ] Pause/resume UI controls
- [ ] Upload speed metrics in progress display

### Rollout Metrics

| Metric | XHR Baseline | TUS Target | How to Measure |
|--------|--------------|------------|----------------|
| Upload success rate | ~95% | >97% | Log completion vs failures |
| Avg upload time (100MB) | ~60s | <90s | Track start to completion |
| Resume usage | N/A | 5-10% | Count resume events |
| Mobile success rate | ~80% | >90% | Filter by user-agent |
| Network error recovery | 0% | >80% | Count successful resumes |

## Sources

**High confidence (official documentation):**
- [Supabase Storage Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase Storage v3 Blog Post](https://supabase.com/blog/storage-v3-resumable-uploads)
- [tus-js-client GitHub](https://github.com/tus/tus-js-client)
- [tus-js-client NPM](https://www.npmjs.com/package/tus-js-client)
- [TUS Protocol Specification](https://tus.io/)

**Medium confidence (community discussions):**
- [Supabase Storage 6MB Issue #563](https://github.com/supabase/storage/issues/563)
- [5-10% Upload Failures #419](https://github.com/supabase/storage/issues/419)
- [RLS Policy Issue #22039](https://github.com/orgs/supabase/discussions/22039)
- [Secure Upload Auth #26424](https://github.com/orgs/supabase/discussions/26424)
- [Transloadit Case Study](https://transloadit.com/casestudies/2023/08/supabase/)

**Low confidence (community reports, unverified):**
- [Brave Browser Upload Issues](https://community.brave.app/t/file-upload-impossible/558641)
- [Android Chrome Memory Errors](https://dir-blogs.hashnode.dev/android-phone-cant-upload-files-in-browser-due-to-low-memory)
- [Mobile Safari Memory Limits](https://lapcatsoftware.com/articles/2026/1/7.html)

---

**Research complete. Ready for implementation planning.**

*Synthesized by: gsd-researcher-synthesizer*
*Date: 2026-02-09*
