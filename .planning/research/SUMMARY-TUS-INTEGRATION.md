# Research Summary: TUS Resumable Uploads Integration

**Project:** SoulPrint Landing
**Domain:** Replacing XHR uploads with TUS resumable uploads
**Researched:** 2026-02-09
**Overall confidence:** HIGH

## Executive Summary

TUS (The Upload Server) protocol integration with Supabase Storage is **low-risk and high-value**. The existing architecture is well-suited for this upgrade — only the client-side upload mechanism needs replacement, while backend processing, RLM integration, and storage paths remain unchanged.

**Critical finding:** TUS uploads produce **identical storage paths** to current XHR uploads (`imports/{user_id}/{timestamp}-{filename}`), ensuring zero changes required to RLM service or backend API endpoints.

**Primary value:** Automatic resume on network interruption, better mobile reliability, and built-in retry logic — all with minimal code changes (1 new file + 1 modified component).

## Key Findings

**Integration approach:** Client-side only
- New library wrapper: `lib/tus-upload.ts` (tus-js-client)
- Modified upload orchestration: `app/import/page.tsx` (lines 510-598)
- **No backend changes:** API routes, RLM service, database schema unchanged

**Storage path compatibility:** Perfect
- TUS metadata configures path: `{ bucketName: 'imports', objectName: '{user_id}/{timestamp}-{filename}' }`
- Result: Same format as XHR uploads
- RLM service downloads files using existing storage path logic

**Authentication:** Drop-in replacement
- Current: `Authorization: Bearer {token}` header in XHR
- TUS: Same bearer token in headers object
- RLS policies apply automatically via authenticated user context

**Performance trade-offs:**
- Chunk size: 50MB (XHR) → 6MB (TUS, Supabase requirement)
- More HTTP requests, but better resume granularity
- Built-in retry with exponential backoff (TUS advantage)
- Automatic resume on network interruption (major mobile win)

## Implications for Roadmap

### Suggested Phase Structure

**Single-phase implementation recommended:**

**Phase 1: TUS Upload Integration (3 tasks, 1-2 days)**

1. **Task 1: Create TUS upload module**
   - Install `tus-js-client` package
   - Create `lib/tus-upload.ts` wrapper
   - Implement `tusUploadWithProgress()` matching XHR interface
   - Configure endpoint, metadata, auth, progress callbacks
   - Extract storagePath from upload.url on success

2. **Task 2: Integrate TUS into import flow**
   - Add feature flag `NEXT_PUBLIC_USE_TUS_UPLOAD`
   - Modify `app/import/page.tsx` upload orchestration (lines 510-598)
   - Replace `uploadWithProgress()` call with `tusUploadWithProgress()`
   - Map TUS errors to existing classification system
   - Keep existing progress UI mapping (15-50% range)

3. **Task 3: Test and rollout**
   - Test with small files (<10MB)
   - Test with large files (>100MB)
   - Test network interruption/resume
   - Test on mobile devices (iOS/Android)
   - Verify RLM downloads TUS-uploaded files
   - Enable for 10% → 50% → 100% of users

**Why single-phase:**
- Changes are tightly coupled (upload module + frontend integration)
- No intermediate testing possible without both pieces
- Small scope (1 new file, 1 modified section)
- No backend or database changes to coordinate

**Estimated effort:**
- Implementation: 4-6 hours
- Testing: 2-3 hours
- Rollout monitoring: 1-2 days

### Phase Ordering Rationale

This is a **standalone improvement** that can be done at any point in the roadmap:
- **No dependencies:** Works with existing architecture as-is
- **No blockers:** Doesn't block other features
- **Low risk:** Feature flag allows gradual rollout and easy rollback

**Recommended timing:**
- **Early:** If mobile upload reliability is causing user friction
- **Mid-roadmap:** As a polish/reliability improvement
- **Late:** As technical debt cleanup (not urgent if XHR working)

### Research Flags for Phases

**Phase 1 (TUS integration):** No deeper research needed
- Official Supabase docs are comprehensive
- tus-js-client API is well-documented
- Storage path compatibility verified via metadata configuration
- All integration points identified

**Future phases:** No impact on other features
- TUS integration is isolated to upload mechanism
- No changes needed to parsing, processing, or chat features

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Storage path compatibility | HIGH | Verified via Supabase docs + metadata configuration |
| Authentication | HIGH | Bearer token auth identical to XHR |
| RLS policy compatibility | HIGH | Policies apply via user context (no special handling) |
| Backend compatibility | HIGH | No backend changes needed (verified trigger endpoint unchanged) |
| Library stability | HIGH | tus-js-client maintained by protocol authors, active development |
| Performance impact | MEDIUM | 6MB chunks vs 50MB may affect upload speed (needs testing) |
| Browser compatibility | MEDIUM | Docs claim IE10+, but should test modern mobile browsers |
| Resume reliability | MEDIUM | Assumes browser storage works (needs mobile testing) |

## Gaps to Address

**During implementation:**
1. **Chunk size performance:** Verify 6MB chunks don't significantly slow uploads vs 50MB
2. **Mobile browser testing:** Confirm resume works on iOS Safari, Chrome Mobile, Samsung Internet
3. **Storage quota:** Verify TUS doesn't use excessive browser storage for upload state
4. **Upload expiry:** Confirm 24-hour URL validity is sufficient (or handle renewal)

**Not critical for MVP:**
- Pause/resume UI controls (TUS supports, but requires UI additions)
- Upload speed metrics in progress display
- Multi-file upload support (not needed for single ZIP import)

## Decision Points

### Library Choice: tus-js-client vs Uppy

**Recommendation:** Use tus-js-client directly

| Criterion | tus-js-client | Uppy |
|-----------|---------------|------|
| Bundle size | ~15KB | ~60KB+ |
| Complexity | Low (simple API) | High (full upload UI framework) |
| Customization | Full control | Opinionated UI |
| TUS support | Native | Via plugin |
| Maintenance | Active (protocol authors) | Active (Transloadit) |

**Rationale:** SoulPrint only needs TUS protocol, not a full upload UI. Lighter bundle, simpler integration.

### Rollout Strategy: Feature Flag vs Direct Replacement

**Recommendation:** Use feature flag for initial rollout

```typescript
const USE_TUS = process.env.NEXT_PUBLIC_USE_TUS_UPLOAD === 'true';
const uploadResult = USE_TUS
  ? await tusUploadWithProgress(blob, userId, filename, onProgress)
  : await uploadWithProgress(blob, url, token, contentType, onProgress);
```

**Benefits:**
- Test in production with small user percentage
- Easy rollback if issues discovered
- Compare metrics (success rate, upload time, error types)
- Gradual migration reduces risk

**After validation:** Remove flag and XHR code path

## Technical Debt Considerations

**What stays (technical debt to address later):**
- Old `lib/chunked-upload.ts` after TUS cutover (remove in cleanup phase)
- XHR-based upload logic in import page (remove after TUS proven)

**What improves:**
- Upload reliability on mobile (smaller chunks, automatic resume)
- Network interruption handling (resume vs re-upload)
- Error retry logic (built-in vs manual)

**New debt introduced:**
- TUS upload state in browser storage (may need cleanup logic)
- Two upload mechanisms during rollout period (temporary)

## Monitoring & Success Metrics

**Track during rollout:**

| Metric | XHR Baseline | TUS Target | How to Measure |
|--------|--------------|------------|----------------|
| Upload success rate | ~95% | >97% | Log upload completion vs failures |
| Average upload time (100MB) | ~60s | <90s | Track time from start to completion |
| Resume usage | N/A (not possible) | 5-10% of uploads | Count resume events |
| Mobile success rate | ~80% | >90% | Filter by user-agent |
| Network error recovery | 0% (fails) | >80% | Count successful resumes after disconnect |

**Alert conditions:**
- TUS success rate <90% (below XHR baseline)
- Upload time >2x XHR baseline
- Error rate spike for specific browser/device

## Implementation Checklist

### Iteration 1: TUS Upload Module (4-6 hours)
- [ ] Install tus-js-client: `npm install tus-js-client`
- [ ] Create `lib/tus-upload.ts`
- [ ] Implement `tusUploadWithProgress()` function
  - [ ] Configure TUS endpoint (storage hostname optimization)
  - [ ] Set metadata (bucketName, objectName, contentType)
  - [ ] Add bearer token auth headers
  - [ ] Map onProgress callback
  - [ ] Extract storagePath from upload.url on success
  - [ ] Configure retry delays [0, 3000, 5000, 10000, 20000]
  - [ ] Set chunk size to 6MB
  - [ ] Add error handling and classification
- [ ] Write unit tests (mock tus.Upload)
- [ ] Verify TypeScript compilation

### Iteration 2: Frontend Integration (2-3 hours)
- [ ] Add feature flag `NEXT_PUBLIC_USE_TUS_UPLOAD` to .env
- [ ] Modify `app/import/page.tsx` (lines 510-598)
  - [ ] Import `tusUploadWithProgress`
  - [ ] Add conditional: `USE_TUS ? tusUploadWithProgress : uploadWithProgress`
  - [ ] Map progress to 15-50% range (same as XHR)
  - [ ] Reuse existing error classification
- [ ] Test locally with small file
- [ ] Test locally with large file (>100MB)
- [ ] Verify storagePath format matches XHR

### Iteration 3: Testing & Validation (2-3 hours)
- [ ] Deploy to staging with feature flag disabled
- [ ] Enable flag, test small file upload
- [ ] Enable flag, test large file upload (>100MB)
- [ ] Test network interruption (disconnect Wi-Fi mid-upload)
  - [ ] Verify upload resumes automatically on reconnect
- [ ] Test on mobile devices
  - [ ] iOS Safari
  - [ ] Chrome Mobile (Android)
  - [ ] Samsung Internet
- [ ] Verify RLM downloads TUS-uploaded file successfully
- [ ] Check server logs for errors
- [ ] Verify RLS policies enforced (user can't upload to other folders)

### Iteration 4: Gradual Rollout (1-2 days)
- [ ] Deploy to production with flag disabled
- [ ] Enable flag for 10% of users (via environment variable or split testing)
- [ ] Monitor metrics for 24 hours
  - [ ] Upload success rate
  - [ ] Error types and frequencies
  - [ ] Average upload time
  - [ ] Mobile vs desktop success
- [ ] If stable: enable for 50% of users
- [ ] Monitor for another 24 hours
- [ ] If stable: enable for 100% of users
- [ ] Monitor for 48 hours
- [ ] Remove feature flag, delete XHR code path
- [ ] Remove old `lib/chunked-upload.ts`

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TUS slower than XHR (6MB chunks) | MEDIUM | MEDIUM | Monitor upload times, rollback if >2x baseline |
| Browser compatibility issues | LOW | MEDIUM | Test major browsers, use feature flag for gradual rollout |
| Resume state fills browser storage | LOW | LOW | TUS auto-cleans old uploads, test with storage limits |
| RLS policies don't apply to TUS | VERY LOW | HIGH | Verified via docs, but test user folder isolation |
| RLM can't download TUS-uploaded files | VERY LOW | HIGH | Storage path format identical, but test integration |

## Open Questions for Implementation

**Before starting:**
1. Should we add pause/resume UI controls? (TUS supports, but requires button + state management)
   - **Recommendation:** Defer to post-MVP (can add later without protocol changes)

2. Should we keep XHR code path long-term? (as fallback if TUS has issues)
   - **Recommendation:** Remove after TUS proven stable (30 days with >95% success rate)

3. Should we optimize chunk size? (6MB is Supabase requirement, but could test)
   - **Recommendation:** Use 6MB as specified, don't deviate from Supabase docs

**During testing:**
1. What's actual upload time difference for 100MB file? (6MB chunks vs 50MB)
2. How often do users benefit from resume? (measure resume event frequency)
3. Are there specific browsers/devices with issues? (monitor error logs by user-agent)

## Related Documentation

- **Architecture:** See `ARCHITECTURE-TUS-INTEGRATION.md` for detailed technical specs
- **Current flow:** See `FLOW.md` for existing import architecture
- **API endpoints:** See `app/api/import/trigger/route.ts` for trigger logic (unchanged)
- **RLM integration:** See `CLAUDE.md` for RLM service details (unchanged)

## Next Steps

1. **Review with stakeholders:** Confirm TUS integration is desired feature
2. **Prioritize in roadmap:** Decide when to implement (early/mid/late)
3. **Allocate time:** Reserve 1-2 days for implementation + testing
4. **Prepare monitoring:** Set up dashboards for upload metrics before rollout
5. **Execute:** Follow implementation checklist above

---

**Research complete. Ready for roadmap planning.**

*Researched by: Claude (GSD project researcher)*
*Date: 2026-02-09*
