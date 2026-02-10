# Feature Landscape: TUS Resumable Uploads

**Domain:** Browser-based resumable file uploads (ChatGPT export ZIPs, 1MB-2GB+)
**Researched:** 2026-02-09
**Context:** SoulPrint import flow - users upload ChatGPT exports on mobile and desktop

## Table Stakes

Features users expect from resumable uploads. Missing = broken experience.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| **Automatic resume after disconnect** | Core value proposition of TUS | Medium | Uses fingerprint storage + HEAD request to get offset. tus-js-client handles automatically via `storeFingerprintForResuming: true` (default). |
| **Real-time progress tracking** | Users need to know upload isn't stuck | Low | `onProgress(bytesSent, bytesTotal)` callback. Update UI every chunk, not every byte. |
| **Chunked upload (6MB chunks)** | Supabase requirement, reduces memory pressure on mobile | Low | Supabase hardcodes 6MB chunks. `chunkSize: 6 * 1024 * 1024` (DO NOT CHANGE per Supabase docs). |
| **Retry on network failure** | Mobile networks are unreliable | Medium | Built-in with `retryDelays: [0, 1000, 3000, 5000]` (default). Auto-retries on 409/423/5xx errors. |
| **Mobile browser support** | 50%+ of users are on mobile (iOS Safari, Android Chrome) | High | **CRITICAL:** iOS Safari has issues with >500MB uploads (see Pitfalls). Need workarounds. |
| **Upload cancellation** | User needs to abort if wrong file selected | Low | `upload.abort(shouldTerminate)`. If `shouldTerminate=true`, sends DELETE to server. |
| **File validation before upload** | Don't waste time uploading wrong file | Low | Check `.zip` extension + JSZip validation BEFORE creating TUS upload. Already implemented in existing flow. |
| **Error classification** | Network errors vs server errors vs validation errors | Medium | Already implemented in existing `classifyImportError()`. Extend for TUS-specific errors (e.g., 413 entity too large, 409 conflict). |

## Differentiators

Features that set a good TUS implementation apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Implementation Notes |
|---------|-------------------|------------|---------------------|
| **Resume after browser close** | User closes tab mid-upload, can resume hours later | Medium | Fingerprint stored in localStorage (or IndexedDB for >30K uploads). Use `findPreviousUploads()` to detect on page load. Show "Resume previous upload?" UI. |
| **Parallel chunk upload** | Faster uploads for large files on fast connections | High | `parallelUploads: N` enables Concatenation extension. Supabase supports this, but adds complexity (merging chunks server-side). **DEFER** to v2 - sequential is simpler and works on slow mobile networks. |
| **Upload speed estimation** | "5 minutes remaining" instead of just percent | Low | Calculate from `onProgress` deltas. `(bytesTotal - bytesSent) / bytesPerSecond`. Update every 3-5 seconds to avoid jitter. |
| **Background upload continuation** | Upload continues when tab backgrounded | Medium | **iOS Safari limitation:** Background tabs throttle network. Can't fully solve, but show warning "Keep this tab active" for large uploads. |
| **Pause/resume control** | User manually pauses to preserve bandwidth | Low | `upload.abort(false)` pauses without terminating. Resume with `upload.start()`. Fingerprint enables cross-session resume. |
| **Checksum verification** | Detect corruption during upload | High | TUS Checksum extension available, but **NOT implemented in tus-js-client** (too CPU-intensive for browsers per FAQ). Rely on TCP checksums + Supabase validation. |
| **Presigned URL upload** | Secure upload without exposing credentials | Medium | Supabase supports via `createSignedUploadUrl()` + `x-signature` header. Use for guest/anonymous uploads or shared upload links. **Not needed for MVP** (logged-in users only). |
| **Multi-file batch upload** | Upload multiple exports at once | Medium | **Anti-feature for SoulPrint** - we only process one export per user. Skip. |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Parallel uploads for mobile** | Mobile browsers (especially iOS Safari) crash or fail with parallel uploads >500MB. Memory pressure is real. | Use sequential uploads (`parallelUploads: 1`). Parallel is only for desktop + fast connection + small files. |
| **Custom fingerprinting algorithm** | tus-js-client default fingerprint is battle-tested. Custom fingerprints break cross-session resume. | Use default `fingerprint` function. Only customize if storing in custom backend (e.g., IndexedDB instead of localStorage). |
| **Uploading unvalidated files** | Uploading 2GB ZIP only to fail validation wastes user time and bandwidth. | Validate BEFORE upload: check file extension, size, and (for desktop) extract `conversations.json` with JSZip. Mobile skips extraction to avoid crashes. |
| **Showing raw TUS errors to users** | "PATCH request failed with 409 Conflict" is not user-friendly. | Map TUS errors to user-facing messages: 409 → "Upload already in progress", 413 → "File too large", 5xx → "Server issue, retrying...". |
| **Storing fingerprints forever** | localStorage fills up, breaks on private browsing. | Use `removeFingerprintOnSuccess: true` (clean up after completion). For failures, let user manually retry or show "Clear failed uploads" button. |
| **Ignoring Supabase 6MB chunk requirement** | Supabase docs say "must be 6MB, do not change". Different chunk sizes break server-side processing. | Hardcode `chunkSize: 6 * 1024 * 1024`. Add comment referencing Supabase requirement. |
| **Relying on `onProgress` for "upload complete"** | `onProgress` reports bytes SENT, not bytes RECEIVED. Network buffering means 100% progress ≠ server has all data. | Use `onChunkComplete` for per-chunk confirmation, `onSuccess` for final completion. Only then trigger next step. |
| **Using TUS for small files (<5MB)** | TUS adds overhead (HEAD request, fingerprint storage). For small files, direct POST is faster. | Keep existing direct upload path for <5MB. Use TUS only for files where resume matters (>50MB realistic threshold). |

## Feature Dependencies

```
File Selection (existing)
  ↓
File Validation (existing: .zip check, size check)
  ↓
DECISION POINT: <50MB → Direct XHR Upload (existing) | >50MB → TUS Resumable Upload (new)
  ↓
TUS Upload Creation (POST to /api/import/tus-upload)
  ↓
Fingerprint Storage (automatic via tus-js-client)
  ↓
Chunked Upload (6MB chunks via PATCH requests)
  │
  ├→ Progress Tracking (onProgress callback → UI update)
  ├→ Auto-retry (retryDelays on network failure)
  ├→ Manual cancellation (abort button → upload.abort(true))
  │
  ↓
Upload Complete (onSuccess callback)
  ↓
Trigger RLM Processing (existing: /api/import/trigger)
  ↓
Progress Polling (existing: user_profiles.progress_percent)
```

**Dependencies on existing features:**
- **File selection** - Already built
- **ZIP extraction (desktop)** - Already built, extracts conversations.json
- **Mobile detection** - Already built, skips extraction on mobile
- **Error classification** - Already built, needs TUS error codes added
- **Progress polling for RLM** - Already built, reuse for TUS upload progress
- **CSRF tokens** - Already built, add to TUS request headers

## MVP Recommendation

For MVP (minimum viable TUS implementation), prioritize:

### Must-Have (MVP Phase)
1. **TUS upload for files >50MB** (table stakes) - Bypass Supabase REST 50MB limit
2. **Automatic resume after disconnect** (table stakes) - Core TUS value
3. **Real-time progress tracking** (table stakes) - `onProgress` → UI
4. **Retry on network failure** (table stakes) - Default `retryDelays`
5. **Upload cancellation** (table stakes) - `abort()` button
6. **6MB chunk size** (Supabase requirement) - Hardcoded
7. **Fingerprint cleanup on success** (prevent localStorage bloat) - `removeFingerprintOnSuccess: true`
8. **Mobile Safari compatibility** (table stakes) - Sequential uploads only

### Nice-to-Have (Post-MVP)
- **Resume after browser close** - Detect previous uploads with `findPreviousUploads()`
- **Upload speed estimation** - "X minutes remaining"
- **Pause/resume control** - Manual pause button
- **Presigned URLs** - For future guest uploads

### Explicitly Defer
- **Parallel chunk upload** - Complexity not worth it, mobile compatibility issues
- **Checksum verification** - Not implemented in tus-js-client anyway
- **Multi-file batch** - Not applicable to SoulPrint (one export per user)

## Implementation Phases

### Phase 1: Basic TUS Upload (MVP)
**Goal:** Replace chunked upload with TUS for >50MB files

**Features:**
- TUS upload endpoint (`/api/import/tus-upload`)
- tus-js-client integration with Supabase Storage
- Progress tracking UI (reuse existing RingProgress component)
- Auto-retry on network failure (default config)
- Cancellation button
- 6MB chunk size (Supabase requirement)

**Testing:**
- 50MB file upload (direct path)
- 51MB file upload (TUS path)
- 500MB file upload (mobile Safari compatibility)
- 2GB file upload (stress test)
- Network disconnect mid-upload → auto-resume

### Phase 2: Enhanced Resume (Post-MVP)
**Goal:** Resume after browser close

**Features:**
- Detect previous uploads on page load
- "Resume previous upload?" modal
- Clear failed uploads button
- Upload history in localStorage (limit to 5 most recent)

**Testing:**
- Upload 500MB file, close browser at 50%, reopen → resume
- Upload fails, reopen → show error, allow retry
- Upload completes, reopen → no resume prompt (fingerprint cleaned up)

### Phase 3: UX Polish (Post-MVP)
**Goal:** Better user experience

**Features:**
- Upload speed estimation ("5 minutes remaining")
- Pause/resume control (manual pause button)
- Better error messages (map TUS errors to user-friendly text)
- Upload progress persists across tab switches

**Testing:**
- Pause upload, wait 1 minute, resume
- Slow network (3G) → accurate time estimate
- Server 5xx error → shows "Server issue, retrying..."

## Mobile Browser Compatibility Matrix

| Browser | Version | File Size Limit | Known Issues | Workarounds |
|---------|---------|-----------------|--------------|-------------|
| **iOS Safari** | 15+ | ~500MB reliable, >500MB fails | Large files fail after 1-3 chunks (memory pressure) | Warn users >500MB uploads may fail. Suggest desktop. Show "Keep this tab active" warning. |
| **Android Chrome** | 90+ | 2GB+ works | Background tab throttling (slower upload) | Show warning for background tabs. Resume works well. |
| **iOS Chrome** | Any | Same as Safari | Uses WKWebView (same engine as Safari) | Same workarounds as Safari. |
| **Android Firefox** | 90+ | 2GB+ works | None reported | Works well. |
| **Desktop Safari** | 15+ | 2GB+ works | None reported | Works well. |
| **Desktop Chrome** | 90+ | 2GB+ works | None reported | Works well. |

**Key takeaway:** iOS Safari is the primary constraint. For files >500MB on iOS, consider:
1. Warning users before upload starts
2. Suggesting they use desktop
3. Implementing parallel uploads ONLY on desktop (detect via user agent)

## TUS Protocol Extensions Used

| Extension | Status | Purpose | Supabase Support |
|-----------|--------|---------|------------------|
| **Creation** | ✓ REQUIRED | Create upload via POST | ✓ Supported |
| **Creation With Upload** | ✗ SKIP | Upload data in creation request | ✓ Supported (but skip for simplicity) |
| **Expiration** | ✓ REQUIRED | 24-hour URL expiration | ✓ Supported (URLs valid 24hrs) |
| **Checksum** | ✗ SKIP | SHA1 verification of chunks | ✗ Not in tus-js-client |
| **Termination** | ✓ REQUIRED | DELETE to cancel upload | ✓ Supported |
| **Concatenation** | ✗ DEFER | Parallel chunk uploads | ✓ Supported (but defer to v2) |

## Error Handling Strategy

### TUS-Specific Error Codes

| Status | Meaning | User-Facing Message | Action |
|--------|---------|-------------------|--------|
| **409 Conflict** | Upload already in progress for this URL | "Upload in progress. Please wait or cancel the previous upload." | Show cancel button. |
| **410 Gone** | Upload expired (>24hrs old) | "Upload session expired. Starting fresh..." | Delete fingerprint, start new upload. |
| **413 Payload Too Large** | File exceeds Supabase storage limit | "File too large for current plan. Contact support." | Show upgrade CTA or support link. |
| **423 Locked** | Another client is uploading to this URL | "Upload in progress from another tab. Please wait." | Auto-retry after 5 seconds. |
| **460 Checksum Mismatch** | Data corruption detected | "Upload corrupted. Retrying from last valid chunk..." | Auto-retry from last valid offset. |
| **5xx Server Error** | Supabase Storage issue | "Server issue. Retrying in 3 seconds..." | Auto-retry with exponential backoff. |

### Network Error Handling

| Error Type | Detection | User Message | Recovery |
|------------|-----------|--------------|----------|
| **Connection lost** | `fetch` rejects with network error | "Connection lost. Retrying..." | Auto-retry with `retryDelays` |
| **Timeout** | AbortController timeout | "Upload timed out. Retrying..." | Increase timeout for next retry |
| **Slow upload** | `onProgress` shows <10KB/s for 30s | "Slow connection detected. This may take a while..." | Continue upload, show time estimate |
| **Browser crash** | Page unload during upload | (On reload) "Resume previous upload?" | Use fingerprint to resume |

### Error Classification Integration

Extend existing `classifyImportError()` with TUS errors:

```typescript
// Add to existing error classification
if (lower.includes('409') || lower.includes('conflict'))
  return {
    title: 'Upload already in progress',
    message: rawError,
    action: 'Wait for the current upload to finish, or cancel and restart.',
    canRetry: true,
    severity: 'warning',
  };

if (lower.includes('410') || lower.includes('gone') || lower.includes('expired'))
  return {
    title: 'Upload session expired',
    message: 'Your upload URL expired after 24 hours.',
    action: 'Starting a fresh upload...',
    canRetry: true,
    severity: 'warning',
  };

// ... etc for other TUS errors
```

## Performance Considerations

| Concern | At 10MB | At 100MB | At 1GB | At 2GB |
|---------|---------|----------|--------|--------|
| **Chunk count** | 2 chunks | 17 chunks | 171 chunks | 342 chunks |
| **Upload time (10Mbps)** | ~10s | ~80s | ~13min | ~27min |
| **Upload time (3G, 1Mbps)** | ~80s | ~13min | ~2.2hrs | ~4.4hrs |
| **Memory usage (mobile)** | <10MB | ~20MB | ~50MB | **100MB+ (iOS crash risk)** |
| **Resume overhead** | Negligible | ~500ms (HEAD req) | ~1s (HEAD req) | ~1s (HEAD req) |
| **localStorage fingerprint size** | ~100 bytes | ~100 bytes | ~100 bytes | ~100 bytes |

**Key insights:**
- 6MB chunks = ~171 chunks for 1GB file (manageable)
- HEAD request overhead is constant (~1s) regardless of file size
- Memory usage scales with chunk size (6MB) + browser overhead, not total file size
- For 2GB+ files on iOS, memory pressure causes crashes → warn users

## Complexity Assessment

| Feature | LOC Estimate | Risk Level | Dependencies |
|---------|--------------|------------|--------------|
| TUS upload endpoint | 150-200 | Medium | @tus/server, Supabase Storage |
| tus-js-client integration | 100-150 | Low | tus-js-client npm package |
| Progress tracking UI | 50 (reuse existing) | Low | Existing RingProgress component |
| Auto-retry config | 20 | Low | tus-js-client built-in |
| Cancellation button | 30 | Low | upload.abort() |
| Fingerprint cleanup | 10 | Low | tus-js-client config |
| Error mapping | 50 (extend existing) | Low | Existing classifyImportError() |
| Resume after close detection | 80-100 | Medium | localStorage, findPreviousUploads() |
| Pause/resume UI | 60-80 | Low | abort(false) + start() |
| Upload speed estimation | 40-60 | Low | Math + time tracking |

**Total MVP estimate:** ~450-550 LOC
**Total with post-MVP features:** ~700-900 LOC

## Sources

### TUS Protocol
- [TUS Resumable Upload Protocol 1.0.x](https://tus.io/protocols/resumable-upload) - Core protocol specification
- [TUS FAQ](https://tus.io/faq) - Common questions and gotchas
- [TUS Implementations](https://tus.io/implementations) - Official client/server implementations

### tus-js-client
- [tus-js-client API Documentation](https://github.com/tus/tus-js-client/blob/main/docs/api.md) - Complete API reference
- [tus-js-client FAQ](https://github.com/tus/tus-js-client/blob/main/docs/faq.md) - Implementation questions and issues
- [tus-js-client v3.0.0 Release](https://tus.io/blog/2022/08/03/tus-js-client-300) - Latest major version
- [tus-js-client GitHub Issues](https://github.com/tus/tus-js-client/issues) - Known issues and discussions

### Supabase TUS Implementation
- [Supabase Resumable Uploads Documentation](https://supabase.com/docs/guides/storage/uploads/resumable-uploads) - Official Supabase TUS guide
- [Supabase Standard Uploads Documentation](https://supabase.com/docs/guides/storage/uploads/standard-uploads) - Comparison with standard uploads
- [Supabase adds resumable uploads using TUS (Transloadit Case Study)](https://transloadit.com/blog/2023/08/casestudy-supabase/) - Implementation details

### Browser Compatibility
- [iOS Safari Large File Upload Issue #227](https://github.com/tus/tus-js-client/issues/227) - Known issue with >500MB files on iPhone
- [Mobile Safari iOS 18.3.2 Network Error Issue](https://github.com/axios/axios/issues/6898) - General Safari network issues in 2025

### UX Patterns
- [Progress Indicators and Resumable Uploads with Pinata](https://pinata.cloud/blog/how-to-implement-progress-indicators-and-resumable-uploads-with-pinata/) - UX implementation examples
- [Progress Tracker UI Best Practices (UserGuiding)](https://userguiding.com/blog/progress-trackers-and-indicators) - UI/UX design patterns

### Technical Deep Dives
- [Resumable Large File Uploads With TUS (Buildo)](https://www.buildo.com/blog-posts/resumable-large-file-uploads-with-tus) - Implementation walkthrough
- [TUS Upload Processing (Supabase Storage DeepWiki)](https://deepwiki.com/supabase/storage/3.3-upload-processing) - Server-side processing details
- [Uppy TUS Plugin Documentation](https://uppy.io/docs/tus/) - Production-ready TUS integration example
