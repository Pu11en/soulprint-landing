# Codebase Concerns

**Analysis Date:** 2026-01-13

## Tech Debt

**Hardcoded Access Codes:**
- Issue: Access code (`7423`) hardcoded in multiple files
- Files: `app/actions/gate.ts`, `app/enter/page.tsx`
- Why: Quick beta access control
- Impact: Can't change access without code deployment
- Fix approach: Move to environment variable or database-driven access control

**Supabase Admin Client Duplicated:**
- Issue: Admin client created identically in multiple API routes
- Files: `app/api/gemini/chat/route.ts`, `app/api/v1/chat/completions/route.ts`
- Fix approach: Extract to `lib/supabase/admin.ts`

**Multiple Voice Recorder Versions:**
- Issue: Three versions of voice recorder component exist
- Files: `components/voice-recorder/VoiceRecorder.tsx`, `VoiceRecorderV2.tsx`, `VoiceRecorderV3.tsx`
- Impact: Maintenance burden, unclear which to use
- Fix approach: Consolidate to single component, remove deprecated versions

**Unsafe JSON.parse Operations:**
- Issue: `JSON.parse()` without try/catch in client code
- Files:
  - `app/questionnaire/new/page.tsx`
  - `app/dashboard/chat/chat-client.tsx`
- Risk: Malformed localStorage data could crash the app
- Fix approach: Wrap all JSON.parse in try/catch with fallback

---

## Security Considerations

**Environment Variable Validation:**
- Issue: `lib/env.ts` may not enforce all required vars at startup
- Risk: Missing env vars cause runtime errors rather than startup failure
- Files: `lib/env.ts`, `lib/gemini/client.ts`
- Current mitigation: Gemini client has warning but uses dummy key
- Recommendations: Add strict validation or use zod for env parsing

**Sensitive Data in localStorage:**
- Risk: Questionnaire answers stored in browser localStorage
- File: `app/questionnaire/new/page.tsx`
- Current mitigation: Cleared after submission
- Recommendations: Consider session storage or server-side storage

**Missing Rate Limiting:**
- Risk: API endpoints vulnerable to abuse
- Files: `app/api/soulprint/generate/route.ts`, `app/api/voice/analyze/route.ts`
- Current mitigation: Usage limits per user (trial system)
- Recommendations: Add rate limiting middleware

---

## Performance Bottlenecks

**SoulPrint Generation Latency:**
- Problem: LLM API calls can take 5-15 seconds
- Files: `lib/soulprint/service.ts`, `app/api/soulprint/generate/route.ts`
- Improvement path: Add streaming response, show progress indicators

**Large Client Components:**
- Problem: Large files without code splitting
- Files: `app/dashboard/chat/chat-client.tsx`, `app/questionnaire/new/page.tsx`
- Improvement path: Dynamic imports with `React.lazy()`, component splitting

**Voice Analysis Processing:**
- Problem: AssemblyAI processing adds latency
- File: `app/api/voice/analyze/route.ts`
- Current: 60-second max duration configured
- Improvement path: Background processing with status polling

---

## Fragile Areas

**Questionnaire Answer Storage:**
- File: `app/questionnaire/new/page.tsx`
- Why fragile: localStorage + complex state management
- Common failures: Lost answers on browser refresh
- Test coverage: None

**LLM Fallback Chain:**
- File: `lib/soulprint/service.ts`
- Why fragile: Multiple LLM providers with different APIs
- Common failures: API changes, rate limits, timeout handling
- Test coverage: None

**Voice Processing Pipeline:**
- Files: `lib/soulprint/assemblyai-analyzer.ts`, `components/voice-recorder/`
- Why fragile: Depends on external API (AssemblyAI), browser APIs
- Common failures: API failures, browser compatibility, network issues

---

## Missing Critical Features

**No Structured Logging:**
- Problem: Only console.log for debugging
- Impact: Can't debug production issues effectively
- Fix: Add pino or winston

**No Error Tracking:**
- Problem: No Sentry or similar error tracking
- Impact: Don't know when production breaks
- Fix: Add Sentry Next.js SDK

**No CI/CD Pipeline:**
- Problem: No automated testing or deployment checks
- Impact: Manual testing only, potential regressions
- Fix: Add GitHub Actions workflow

---

## Test Coverage Gaps

**No Test Suite:**
- What's not tested: All application code
- Risk: Regressions on any code change
- Priority: High
- Recommended: Vitest + React Testing Library

**Critical Untested Paths:**
1. Authentication flow (`app/actions/auth.ts`)
2. SoulPrint generation (`lib/soulprint/service.ts`)
3. API key validation (`app/api/**/*.ts`)
4. Voice analysis pipeline (`lib/soulprint/assemblyai-analyzer.ts`)

---

## Dependencies at Risk

**React 19 + Next.js 16:**
- Risk: Very recent versions, ecosystem catching up
- Impact: Some third-party packages may not be compatible
- Mitigation: Monitor for issues, test updates carefully

**@google/genai:**
- Risk: Newer package, API may evolve
- Impact: Breaking changes possible
- Mitigation: Pin version, review changelogs before updates

---

## Scaling Limits

**Supabase Free/Pro Tier:**
- Current: Using Supabase for all data
- Limit: Connection limits, storage limits per tier
- Scaling path: Monitor usage, upgrade tier as needed

**Vercel Serverless:**
- Current: API routes as serverless functions
- Limit: 10s default timeout (can extend)
- Note: Voice analysis has 60s timeout configured

---

*Concerns audit: 2026-01-13*
*Update as issues are fixed or new ones discovered*
