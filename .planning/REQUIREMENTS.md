# Requirements: SoulPrint Stabilization

**Defined:** 2026-02-06
**Core Value:** The import-to-chat flow must work reliably every time on production

## v1 Requirements

### Bug Fixes

- [x] **BUG-01**: Chunked upload cleans up stale in-memory chunks after 30 minutes
- [x] **BUG-02**: Starting a new import cancels any existing processing job (no duplicates)
- [x] **BUG-03**: Failed chat message saves retry with exponential backoff and show error indicator
- [x] **BUG-04**: Memory status polling ignores out-of-order responses using sequence tracking

### Security

- [x] **SEC-01**: State-changing API endpoints validate CSRF tokens
- [x] **SEC-02**: API endpoints enforce per-user rate limits (429 with Retry-After)
- [x] **SEC-03**: All Supabase tables have RLS policies verified and documented
- [x] **SEC-04**: All API route request bodies validated with Zod schemas

### Reliability

- [x] **REL-01**: RLM timeout reduced to 15s with fast fallback to Bedrock
- [x] **REL-02**: All API routes return proper error responses (no unhandled exceptions)
- [ ] **REL-03**: Structured logging with correlation IDs on all API routes
- [ ] **REL-04**: Health check endpoint reports status of all external dependencies

### Type Safety

- [ ] **TYPE-01**: `any` types replaced with proper interfaces in import and chat code

### Testing

- [x] **TEST-01**: Vitest configured and running with at least one passing test
- [ ] **TEST-02**: Import flow has end-to-end test coverage (upload → process → complete)
- [ ] **TEST-03**: All API routes have integration tests with mocked dependencies
- [ ] **TEST-04**: Critical user flows have E2E tests via Playwright

## v2 Requirements

### Performance Optimization

- **PERF-01**: Concurrent chunk uploading (3-5 chunks in parallel)
- **PERF-02**: Chat history pagination (cursor-based)
- **PERF-03**: Server-Sent Events for real-time import progress (replace polling)

### Data Compliance

- **DATA-01**: User data export endpoint (GDPR/CCPA portability)
- **DATA-02**: Client-side encryption of raw exports before upload

### Features

- **FEAT-01**: Voice upload persisted to Cloudinary
- **FEAT-02**: Pillar questionnaire responses saved to backend
- **FEAT-03**: Push notifications on import completion

## Out of Scope

| Feature | Reason |
|---------|--------|
| A/B testing framework | Not needed for stabilization |
| Auth flow changes | Working, explicitly excluded per constraints |
| Supabase schema changes | Avoided per project constraints |
| Mobile app | Web-first, separate milestone |
| RLM service modifications | External service, just call it |
| Background job queue (BullMQ/Inngest) | Infrastructure change, evaluate after stabilization |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | Phase 1 | Complete |
| BUG-01 | Phase 2 | Complete |
| REL-01 | Phase 2 | Complete |
| REL-02 | Phase 2 | Complete |
| BUG-02 | Phase 3 | Complete |
| BUG-03 | Phase 3 | Complete |
| BUG-04 | Phase 3 | Complete |
| SEC-01 | Phase 4 | Complete |
| SEC-02 | Phase 4 | Complete |
| SEC-03 | Phase 4 | Complete |
| SEC-04 | Phase 4 | Complete |
| REL-03 | Phase 5 | Pending |
| REL-04 | Phase 5 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| TEST-04 | Phase 6 | Pending |
| TYPE-01 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-06*
*Last updated: 2026-02-06 after roadmap creation*
