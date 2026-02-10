# Domain Pitfalls: Adding TUS Resumable Uploads to Supabase

**Domain:** TUS resumable uploads in Next.js + Supabase Storage
**Researched:** 2026-02-09
**Confidence:** MEDIUM (verified with official docs + community issues)

## Executive Summary

Adding TUS resumable uploads to an existing Supabase app involves critical pitfalls around authentication token management, mobile browser memory limits, client-side file processing, and Supabase-specific TUS configuration. The most dangerous pitfalls involve JWT token expiry during long uploads and memory exhaustion from processing large files client-side before upload.

**For SoulPrint:** Current XHR implementation fails at 50MB. Moving to TUS addresses network interruptions but introduces new failure modes: mobile Safari memory limits, Brave browser file handling issues, JSZip client-side extraction exhausting memory, and JWT token expiry during multi-hour uploads.

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or complete upload failures.

### Pitfall 1: Client-Side ZIP Extraction Memory Exhaustion

**What goes wrong:** Loading entire ZIP file into browser memory to extract conversations.json causes Out-of-Memory crashes on mobile devices and with large files (>500MB).

**Why it happens:**
- JSZip's `async()` and `generateAsync()` methods hold full file content in memory
- Browser memory is severely limited on mobile (iOS Safari: ~100MB practical limit, Android Chrome varies by device)
- Current SoulPrint code uses JSZip client-side before upload
- A 1GB ZIP file can require 2GB+ RAM due to UTF-16 encoding and decompression buffers

**Consequences:**
- Silent failures on mobile devices (browser tab crashes)
- User sees "Out of Memory" error on Android Chrome
- iOS Safari kills tab without error message
- File appears to upload but processing never starts

**Prevention:**
- **Never extract ZIP client-side** — Upload ZIP directly via TUS
- Extract ZIP server-side (Vercel API route or background job) where memory is predictable
- If client-side extraction required: use streaming with `StreamHelper` and `pause()/resume()` for backpressure
- Use `ArrayBuffer` instead of strings in JSZip to reduce memory 50%
- Consider File System Access API for large files on desktop (Chrome/Edge only)

**Detection:**
- Monitor client-side memory usage in browser DevTools
- Track upload failures by device type (mobile vs desktop)
- Log browser crashes via `window.addEventListener('error')` and `window.addEventListener('unhandledrejection')`

**Sources:**
- [JSZip Limitations](https://stuk.github.io/jszip/documentation/limitations.html)
- [JSZip Memory Issues #135](https://github.com/Stuk/jszip/issues/135)
- [Mobile Safari Memory Limits](https://lapcatsoftware.com/articles/2026/1/7.html)

---

### Pitfall 2: JWT Token Expiry During Long Uploads

**What goes wrong:** Supabase JWT access tokens expire (default 1 hour) during multi-hour uploads of large files on slow connections, causing authentication failures mid-upload.

**Why it happens:**
- TUS uploads send multiple PATCH requests over time (one per chunk)
- Each chunk upload requires valid `Authorization: Bearer {token}` header
- Supabase access tokens expire after 1 hour by default
- Refresh token must be exchanged to get new access token
- tus-js-client doesn't automatically refresh tokens

**Consequences:**
- Upload proceeds for 1 hour then fails with 401 Unauthorized
- User loses progress if `removeFingerprintOnSuccess: false` (default behavior)
- Upload appears "stuck" at same percentage indefinitely
- No clear error message to user

**Prevention:**
```javascript
// Implement token refresh in onBeforeRequest callback
const upload = new tus.Upload(file, {
  endpoint: 'https://project.supabase.co/storage/v1/upload/resumable',

  // Refresh token before each chunk request
  onBeforeRequest: async function (req) {
    // Get fresh session (handles auto-refresh)
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('No valid session');
    }

    // Update authorization header with fresh token
    req.setHeader('Authorization', `Bearer ${session.access_token}`);
  },

  // Retry on 401 after token refresh
  onShouldRetry: function (err, retryAttempt, options) {
    const status = err?.originalResponse?.getStatus();

    // Retry on 401 (token expired) and 5xx errors
    if (status === 401 || (status >= 500 && status < 600)) {
      return retryAttempt < 3;
    }
    return false;
  },

  retryDelays: [0, 3000, 5000, 10000, 20000],
});
```

**Alternative approach (Signed Upload URLs):**
```javascript
// Server-side: Create 24-hour signed URL
const { data: { token, path }, error } = await supabase.storage
  .from('imports')
  .createSignedUploadUrl(`${userId}/${Date.now()}-conversations.zip`);

// Client-side: Use signed token in x-upsert header (lasts 24 hours)
const upload = new tus.Upload(file, {
  endpoint: 'https://project.supabase.co/storage/v1/upload/resumable',
  headers: {
    'x-upsert': 'true',
  },
  uploadUrl: `https://project.supabase.co/storage/v1/upload/resumable?token=${token}`,
  // Token valid for 24 hours, no refresh needed
});
```

**Detection:**
- Monitor 401 errors in upload callback
- Track upload duration vs file size (flag uploads >50 minutes)
- Log token expiry timestamps vs upload start time

**Sources:**
- [Supabase JWT Docs](https://supabase.com/docs/guides/auth/jwts)
- [TUS Authentication Discussion](https://github.com/tus/tus-node-server/issues/124)
- [Supabase Signed Upload URLs](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)

---

### Pitfall 3: 6MB Chunk Size Hard Requirement

**What goes wrong:** Supabase Storage requires exactly 6MB chunks for TUS uploads. Using any other chunk size causes "upload stalled at 6MB" failures.

**Why it happens:**
- Supabase Storage backend (Kong + custom TUS handler) expects 6MB chunks
- Non-6MB chunks get rejected or cause internal routing issues
- Related to backend TLS/load balancer configuration in some environments
- Local development with self-signed certs compounds the issue

**Consequences:**
- Uploads consistently fail at 6MB mark (if using smaller chunks)
- Uploads never start (if using larger chunks)
- Error: "tus: failed to resume upload, caused by [object ProgressEvent]"
- HEAD requests fail during resumption check

**Prevention:**
```javascript
const upload = new tus.Upload(file, {
  endpoint: 'https://project.supabase.co/storage/v1/upload/resumable',

  // MUST be exactly 6MB
  chunkSize: 6 * 1024 * 1024,  // 6MB exactly

  // DO NOT use dynamic chunk sizing
  // DO NOT use smaller chunks for mobile
});
```

**Local development gotcha:**
- If using Supabase local CLI with TLS enabled, TUS uploads fail due to self-signed cert issues
- Disable TLS in `config.toml` for local development:
```toml
[api]
tls_enabled = false
```

**Detection:**
- Monitor chunk upload progress percentage (stalls at ~6-12%)
- Check HEAD request failures in network tab
- Verify chunkSize in upload configuration

**Sources:**
- [Supabase Resumable Uploads Docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [6MB Upload Issue #563](https://github.com/supabase/storage/issues/563)
- [6MB Stalling Discussion #29676](https://github.com/orgs/supabase/discussions/29676)

---

### Pitfall 4: localStorage Fingerprint Collisions

**What goes wrong:** TUS client caches upload fingerprints in localStorage. When same file is uploaded twice, TUS thinks it's already uploaded and skips it, causing "upload complete" with no actual file transfer.

**Why it happens:**
- tus-js-client uses file fingerprint (based on name, size, type, lastModified) as localStorage key
- Default behavior: fingerprints persist after successful upload (`removeFingerprintOnSuccess: false`)
- Multiple uploads of same file reuse cached upload URL from localStorage
- If upload URL expired or file was deleted, upload silently fails

**Consequences:**
- User re-uploads same file → instant "success" but file not in storage
- Developer gets 404 errors when trying to access uploaded file
- Silent failures with no error message
- 5-10% of uploads affected in production (based on Supabase GitHub issues)

**Prevention:**
```javascript
const upload = new tus.Upload(file, {
  endpoint: 'https://project.supabase.co/storage/v1/upload/resumable',

  // Critical: Remove fingerprint after success
  removeFingerprintOnSuccess: true,

  // Optional: Generate unique ID per upload to force new localStorage entry
  metadata: {
    filename: file.name,
    filetype: file.type,
    uploadId: crypto.randomUUID(),  // Force unique fingerprint
  },
});
```

**Detection:**
- Check localStorage for `tus::` keys between uploads
- Monitor "instant" upload completions (< 100ms for large files)
- Verify file exists in storage after upload success

**Sources:**
- [5-10% Upload Failure Issue #419](https://github.com/supabase/storage/issues/419)
- [tus-js-client GitHub](https://github.com/tus/tus-js-client)

---

## Moderate Pitfalls

Mistakes that cause delays, poor UX, or technical debt.

### Pitfall 5: Mobile Browser Memory Limits (iOS Safari)

**What goes wrong:** iOS Safari has severe memory constraints (~100MB practical limit for web content). Large file uploads exhaust memory and kill the browser tab.

**Why it happens:**
- Mobile Safari uses RAM for file operations
- iOS 13+ aggressively kills memory-heavy apps/tabs
- File API operations load file into memory
- Background tabs get memory budget reduced
- iOS Chrome/Firefox also constrained (run in Apple's sandbox, 1MB download limit)

**Consequences:**
- Tab crashes during upload (no error to user)
- Upload progress lost on tab reload
- User receives generic "Page reloaded" message
- Particularly bad on older devices (iPhone 8, iPad Air 2)

**Prevention:**
- Use TUS resumable uploads (survives tab crashes)
- Store upload state in localStorage for recovery
- Warn users before mobile uploads >100MB
- Consider native app for large file uploads on iOS
- Use File System Access API on desktop browsers (not available on iOS)
- Implement upload recovery UI:
```javascript
// On page load, check for interrupted uploads
const uploads = await tus.Upload.getResumeableUploads();
if (uploads.length > 0) {
  // Show "Resume upload?" dialog
  const upload = uploads[0];
  upload.start();  // Resume from last chunk
}
```

**Detection:**
- Track mobile vs desktop upload success rates
- Monitor iOS-specific crashes via analytics
- Log device memory at upload start (`navigator.deviceMemory`)

**Sources:**
- [Mobile Safari Memory Limits](https://lapcatsoftware.com/articles/2026/1/7.html)
- [iOS Upload Issues](https://bipsync.com/blog/uploading-large-files-from-ios-applications/)
- [PWA iOS Limitations](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)

---

### Pitfall 6: Brave Browser File Upload Issues

**What goes wrong:** Brave browser users report frequent upload failures, file unreadable errors, and browser freezing when selecting files for upload.

**Why it happens:**
- Brave's aggressive privacy/security features interfere with file APIs
- Shield settings block localStorage/IndexedDB (breaks TUS fingerprinting)
- File access permissions more restrictive than Chrome
- Unclear if bug or intentional security feature

**Consequences:**
- User's 1146MB file upload fails (reported in SoulPrint)
- "File unreadable" errors
- Upload button becomes unresponsive
- Downloads also fail with "Failed - Network error" for files >25MB

**Prevention:**
- Detect Brave browser and show warning/troubleshooting
```javascript
const isBrave = navigator.brave && await navigator.brave.isBrave();
if (isBrave) {
  // Show shield configuration instructions
  showBraveWarning();
}
```
- Provide fallback upload method (direct Supabase upload without TUS)
- Document Brave-specific troubleshooting:
  - Disable Brave Shields for your domain
  - Allow localStorage in Shield settings
  - Try in private window
  - Use Chrome as alternative

**Detection:**
- Track browser user-agent in upload failures
- Correlate failures with `navigator.brave` detection
- Monitor support tickets mentioning "Brave"

**Sources:**
- [Brave Upload Issues Community](https://community.brave.app/t/file-upload-impossible/558641)
- [Brave Freezing on Upload](https://community.brave.app/t/uploading-any-file-causes-brave-to-freeze/467161)
- [Brave Large File Issues #32216](https://github.com/brave/brave-browser/issues/32216)

---

### Pitfall 7: Android Chrome "Low Memory" Upload Failures

**What goes wrong:** Android Chrome shows "Unable to complete previous operation due to low memory" when uploading files, even for moderately-sized files (100-500MB).

**Why it happens:**
- Android Chrome shares memory with entire OS
- Background apps reduce available memory
- File upload pre-processing (checksum, preview generation) uses memory
- 32-bit Android apps have 512MB-2GB memory limit per app
- Chrome pre-allocates buffers for upload

**Consequences:**
- Upload fails immediately with "Low memory" error
- Affects mid-range and budget Android devices most
- Error code 413 (Payload Too Large) or generic memory error
- Inconsistent failures (same file succeeds/fails based on device state)

**Prevention:**
- Don't pre-process files client-side (no checksums, previews, extraction)
- Use TUS streaming uploads (minimal memory footprint)
- Implement progressive upload with visual memory warning:
```javascript
if (file.size > 100 * 1024 * 1024 && /Android/i.test(navigator.userAgent)) {
  const memory = navigator.deviceMemory; // GB estimate
  if (!memory || memory < 4) {
    showWarning('Your device may not have enough memory. Close other apps and try again.');
  }
}
```
- Consider server-side upload via URL (user uploads to cloud, provides link)
- Provide "Upload from Google Drive" option for Android users

**Detection:**
- Parse error messages for "memory" or "413"
- Track `navigator.deviceMemory` in failure reports
- Correlate with Android version and device model

**Sources:**
- [Android Low Memory Upload Issues](https://dir-blogs.hashnode.dev/android-phone-cant-upload-files-in-browser-due-to-low-memory)
- [Chrome Android Memory Errors](https://support.google.com/chrome/thread/336682510/error-when-trying-to-upload-1-1gb-file-error-code-out-of-memory)
- [Android File Upload Failures](https://support.google.com/chrome/thread/216091895/chrome-on-android-wont-upload-files-says-low-memory)

---

### Pitfall 8: Using Anon Key Instead of Session Token

**What goes wrong:** Developer uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` for TUS upload authorization instead of user's session access token, causing "new row violates row-level security policy" errors.

**Why it happens:**
- Anon key is public, non-user-specific credential
- Storage RLS policies check for authenticated user ID
- Environment variables are convenient but wrong authentication source
- Examples/tutorials sometimes show anon key for simplicity

**Consequences:**
- All TUS uploads fail with 403 Forbidden
- RLS policy violations logged in Supabase
- Works in permissive buckets (no RLS) but fails in production
- Security vulnerability if bucket RLS bypassed to "fix" issue

**Prevention:**
```javascript
// WRONG: Using anon key
const upload = new tus.Upload(file, {
  endpoint: '...',
  headers: {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, // ❌
  },
});

// RIGHT: Using session token
const { data: { session } } = await supabase.auth.getSession();
const upload = new tus.Upload(file, {
  endpoint: '...',
  headers: {
    'Authorization': `Bearer ${session.access_token}`, // ✅
  },
});
```

**For Next.js App Router API routes:**
```javascript
// Server-side proxy approach
export async function POST(req: NextRequest) {
  const supabase = await createClient(); // Server-side client
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Now forward to Supabase Storage with user's token
  // This ensures RLS policies work correctly
}
```

**Detection:**
- Monitor 403 errors during upload
- Check Supabase logs for RLS violations
- Validate authorization header contains `eyJ...` JWT pattern (not static key)

**Sources:**
- [RLS Policy Issue Discussion #22039](https://github.com/orgs/supabase/discussions/22039)
- [Secure Upload Authentication #26424](https://github.com/orgs/supabase/discussions/26424)

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 9: Using Standard Project URL Instead of Storage Hostname

**What goes wrong:** Using `https://project-id.supabase.co` instead of `https://project-id.storage.supabase.co` for TUS uploads causes performance degradation.

**Why it happens:**
- Standard URL routes through additional proxy layers
- Storage hostname is optimized for large file transfers
- Documentation emphasizes this but easy to miss

**Consequences:**
- Slower upload speeds (30-50% slower)
- Higher latency per chunk
- More timeouts on slow connections
- No functional breakage, just poor UX

**Prevention:**
```javascript
// WRONG: Standard project URL
endpoint: 'https://abcdefgh.supabase.co/storage/v1/upload/resumable'

// RIGHT: Direct storage hostname
endpoint: 'https://abcdefgh.storage.supabase.co/storage/v1/upload/resumable'
```

**Detection:**
- Compare upload speeds across users
- Monitor average chunk upload time
- Check endpoint URL in network logs

**Sources:**
- [Supabase Resumable Uploads Docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

---

### Pitfall 10: Not Implementing Upload Recovery UI

**What goes wrong:** User's upload is interrupted (tab closed, network dropped, device locked) but app provides no way to resume, forcing full re-upload.

**Why it happens:**
- TUS supports resumability but requires UI/UX implementation
- Developer assumes TUS "just works" without recovery logic
- localStorage contains resume data but app doesn't check it

**Consequences:**
- Poor UX (users re-upload 2GB files from scratch)
- Increased server load from duplicate uploads
- User frustration and support tickets

**Prevention:**
```javascript
// On page load, check for interrupted uploads
useEffect(() => {
  const checkInterruptedUploads = async () => {
    const previousUploads = await tus.Upload.getResumeableUploads();

    if (previousUploads.length > 0) {
      setShowResumeDialog(true);
      setPendingUpload(previousUploads[0]);
    }
  };

  checkInterruptedUploads();
}, []);

// Show resume dialog
{showResumeDialog && (
  <Dialog>
    <p>You have an interrupted upload. Resume?</p>
    <button onClick={() => pendingUpload.start()}>Resume</button>
    <button onClick={() => {
      pendingUpload.abort();
      setShowResumeDialog(false);
    }}>Start Over</button>
  </Dialog>
)}
```

**Detection:**
- Track upload completion rate (started vs finished)
- Monitor localStorage for stale `tus::` entries
- Survey users about upload experience

---

### Pitfall 11: Concurrent Upload Conflicts

**What goes wrong:** Multiple browser tabs or devices upload same file simultaneously to same path, causing 409 Conflict errors.

**Why it happens:**
- TUS protocol allows only one client per upload URL
- User opens multiple tabs or uses multiple devices
- Each creates separate upload URL for same destination path
- Last to complete wins; others get 409 error

**Consequences:**
- Upload fails with "Conflict" error
- File partially uploaded (incomplete)
- User confused about which upload succeeded

**Prevention:**
```javascript
// Use x-upsert header to allow overwrites
const upload = new tus.Upload(file, {
  endpoint: '...',
  headers: {
    'x-upsert': 'true',  // Allow overwriting
  },
});

// Or implement upload locking
const lockKey = `upload-lock-${userId}`;
const hasLock = localStorage.getItem(lockKey);

if (hasLock) {
  showError('Upload already in progress in another tab');
  return;
}

localStorage.setItem(lockKey, Date.now().toString());

upload.on('success', () => {
  localStorage.removeItem(lockKey);
});
```

**Detection:**
- Monitor 409 errors in upload callbacks
- Track simultaneous uploads per user
- Check localStorage for duplicate lock keys

**Sources:**
- [Supabase Resumable Uploads Docs](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)

---

## Phase-Specific Warnings

Recommendations for which phase should address each pitfall.

| Phase Topic | Pitfall | Mitigation Strategy | Priority |
|-------------|---------|-------------------|----------|
| **TUS Client Implementation** | JWT Token Expiry (#2) | Implement `onBeforeRequest` token refresh or use signed URLs | CRITICAL |
| | 6MB Chunk Size (#3) | Hardcode `chunkSize: 6 * 1024 * 1024` | CRITICAL |
| | localStorage Fingerprints (#4) | Set `removeFingerprintOnSuccess: true` | HIGH |
| | Session Token Auth (#8) | Use `session.access_token` not anon key | CRITICAL |
| | Storage Hostname (#9) | Use `*.storage.supabase.co` endpoint | MEDIUM |
| **Client-Side Upload Flow** | JSZip Memory Exhaustion (#1) | Remove client-side ZIP extraction entirely | CRITICAL |
| | Upload Recovery UI (#10) | Implement resume dialog on page load | HIGH |
| | Concurrent Uploads (#11) | Add localStorage locking + `x-upsert` | LOW |
| **Mobile Browser Support** | iOS Safari Memory (#5) | Add device detection + warnings, resume support | HIGH |
| | Android Chrome Memory (#7) | Add memory detection + warnings | MEDIUM |
| | Brave Browser Issues (#6) | Detect Brave, show troubleshooting | LOW |
| **Server-Side Processing** | JSZip Memory Exhaustion (#1) | Move ZIP extraction to server (API route) | CRITICAL |
| | Vercel 50MB Limit | Use streaming upload to Supabase, stream extraction | HIGH |

---

## SoulPrint-Specific Recommendations

Based on current architecture analysis:

### Current Architecture Issues

**From `/app/api/import/chunked-upload/route.ts` analysis:**
- Correctly implements server-side chunking for >2GB files
- Avoids memory issues by streaming chunks to Supabase Storage
- BUT: Still requires XHR replacement for <2GB files
- Client-side likely still does JSZip extraction (need to verify)

### Critical Path Changes

**Phase 1: Remove Client-Side ZIP Extraction**
1. Upload ZIP directly via TUS (no client-side processing)
2. Server-side extraction in API route:
```javascript
// New: /app/api/import/extract/route.ts
export async function POST(req: NextRequest) {
  const { storagePath } = await req.json();

  // Download ZIP from Supabase Storage (streaming)
  const { data: zipData } = await supabase.storage
    .from('imports')
    .download(storagePath);

  // Stream-extract conversations.json
  const zip = await JSZip.loadAsync(zipData);
  const conversationsFile = zip.file('conversations.json');
  const conversationsText = await conversationsFile.async('text');

  // Return or process
  return NextResponse.json({ conversationsText });
}
```

**Phase 2: Implement TUS with Token Refresh**
```javascript
// In upload component
const uploadFile = async (file: File) => {
  const { data: { session } } = await supabase.auth.getSession();

  const upload = new tus.Upload(file, {
    endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
    chunkSize: 6 * 1024 * 1024,  // Exactly 6MB
    removeFingerprintOnSuccess: true,
    retryDelays: [0, 3000, 5000, 10000, 20000],

    metadata: {
      bucketName: 'imports',
      objectName: `${userId}/${Date.now()}-conversations.zip`,
      contentType: 'application/zip',
    },

    // Critical: Refresh token for each chunk
    onBeforeRequest: async (req) => {
      const { data: { session } } = await supabase.auth.getSession();
      req.setHeader('Authorization', `Bearer ${session.access_token}`);
    },

    onProgress: (bytesUploaded, bytesTotal) => {
      setProgress((bytesUploaded / bytesTotal) * 100);
    },

    onSuccess: () => {
      // Trigger server-side extraction
      fetch('/api/import/extract', {
        method: 'POST',
        body: JSON.stringify({ storagePath: upload.file.name }),
      });
    },

    onError: (error) => {
      console.error('Upload failed:', error);
    },
  });

  upload.start();
};
```

**Phase 3: Mobile Browser Safety**
```javascript
// Add device detection + warnings
const checkDeviceCapability = (file: File) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobile = isIOS || isAndroid;
  const memory = navigator.deviceMemory; // GB

  if (isMobile && file.size > 100 * 1024 * 1024) {
    // >100MB on mobile
    if (!memory || memory < 4) {
      return {
        warning: 'Your device may not have enough memory. Close other apps before uploading.',
        canProceed: true,
      };
    }
  }

  if (isIOS && file.size > 1024 * 1024 * 1024) {
    // >1GB on iOS
    return {
      warning: 'Large uploads on iOS may fail. Consider using a desktop browser.',
      canProceed: true,
    };
  }

  return { canProceed: true };
};
```

---

## Testing Strategy

How to validate pitfall mitigations:

### JWT Token Expiry Testing
```bash
# Simulate token expiry during upload
# 1. Start upload
# 2. In DevTools console, expire token:
supabase.auth.setSession({
  access_token: 'invalid',
  refresh_token: session.refresh_token
})
# 3. Verify upload continues after refresh
```

### Memory Exhaustion Testing
```javascript
// Test with memory-constrained devices
// Chrome DevTools > Performance > Memory
// Heap snapshots before/after upload
```

### Mobile Browser Testing
- Real device testing matrix:
  - iPhone 12 Pro (iOS 17) - Safari
  - iPhone SE (iOS 16) - Safari
  - Samsung Galaxy S21 (Android 13) - Chrome
  - OnePlus Nord (Android 12) - Chrome
  - Brave desktop (latest)

---

## Sources

### High Confidence (Official Documentation)
- [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
- [Supabase JWT Authentication](https://supabase.com/docs/guides/auth/jwts)
- [JSZip Limitations](https://stuk.github.io/jszip/documentation/limitations.html)
- [tus-js-client GitHub](https://github.com/tus/tus-js-client)

### Medium Confidence (Community Issues, Verified)
- [Supabase Storage 6MB Issue #563](https://github.com/supabase/storage/issues/563)
- [5-10% Upload Failures #419](https://github.com/supabase/storage/issues/419)
- [RLS Policy Issue #22039](https://github.com/orgs/supabase/discussions/22039)
- [Secure Upload Auth #26424](https://github.com/orgs/supabase/discussions/26424)
- [TUS Authentication Discussion](https://github.com/tus/tus-node-server/issues/124)

### Low Confidence (Community Reports, Unverified)
- [Brave Browser Upload Issues](https://community.brave.app/t/file-upload-impossible/558641)
- [Android Chrome Memory Errors](https://dir-blogs.hashnode.dev/android-phone-cant-upload-files-in-browser-due-to-low-memory)
- [Mobile Safari Memory Limits](https://lapcatsoftware.com/articles/2026/1/7.html)

---

## Open Questions

Areas requiring phase-specific research:

1. **Vercel Edge Runtime Compatibility:** Does TUS work in Edge runtime? (Research in deployment phase)
2. **Supabase Storage Timeouts:** Max upload duration before server-side timeout? (Test in load testing phase)
3. **Safari Private Mode:** Does TUS work without localStorage? (Research in browser compat phase)
4. **Web Worker Upload:** Can TUS run in Web Worker for background upload? (Research in UX enhancement phase)
5. **Service Worker Interception:** How does TUS interact with service worker caching? (Research if PWA planned)
