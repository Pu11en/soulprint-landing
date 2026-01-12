# Codebase Concerns

**Analysis Date:** 2026-01-12

## Tech Debt

**Hardcoded Access Codes:**
- Issue: PIN (`7423`) and access code hardcoded in multiple files
- Files: `components/auth/login-form.tsx`, `app/actions/gate.ts`
- Why: Quick beta access control
- Impact: Can't change access without code deployment
- Fix approach: Move to environment variables or database-driven access control

**Streak API Key Hardcoded:**
- Issue: Streak API key directly in source code
- File: `lib/streak.ts`
- Why: Oversight during rapid development
- Impact: Security risk if repo is public, can't rotate key easily
- Fix approach: Move to `STREAK_API_KEY` environment variable

**Waitlist/Gate System Complexity:**
- Issue: Multiple overlapping access control systems (PIN gate, access code, waitlist)
- Files: `app/enter/page.tsx`, `app/login/page.tsx`, `app/actions/gate.ts`, `components/auth/login-form.tsx`
- Why: Evolved during beta testing
- Impact: Confusing user experience, maintenance burden
- Fix approach: Simplify to standard auth flow (remove PIN, access code, waitlist for public launch)

**Demo User Hardcoded:**
- Issue: Demo credentials hardcoded in multiple places
- Files: `app/actions/auth.ts`, `app/dashboard/page.tsx`
- Why: Quick demo access for testing
- Impact: Security risk, bypasses normal auth
- Fix approach: Remove demo mode or use proper feature flag

## Known Bugs

**Race Condition in SoulPrint Status:**
- Symptoms: User may see stale SoulPrint count after generation
- Trigger: Fast navigation after SoulPrint generation
- File: `app/dashboard/page.tsx` (redirect logic checks SoulPrint count)
- Workaround: Page refresh shows correct state
- Root cause: Server component cache not invalidated immediately

## Security Considerations

**No Input Sanitization on Questionnaire:**
- Risk: XSS or injection via questionnaire answers stored and displayed
- Files: `app/questionnaire/new/page.tsx`, stored in Supabase `soulprints.soulprint_data`
- Current mitigation: React escapes output by default
- Recommendations: Add explicit input validation before storage

**Sensitive Data in localStorage:**
- Risk: Questionnaire answers (potentially personal) stored in browser localStorage
- File: `app/questionnaire/new/page.tsx`
- Current mitigation: Cleared after submission
- Recommendations: Consider session storage or server-side storage

**Missing Rate Limiting:**
- Risk: API endpoints vulnerable to abuse
- Files: `app/api/soulprint/generate/route.ts`, `app/api/waitlist/route.ts`
- Current mitigation: None
- Recommendations: Add rate limiting middleware or use Vercel edge config

**No CSRF Protection on Forms:**
- Risk: Cross-site request forgery on forms
- Files: All form submissions
- Current mitigation: Supabase session cookies are SameSite
- Recommendations: Add CSRF tokens for extra security

## Performance Bottlenecks

**SoulPrint Generation Latency:**
- Problem: OpenAI API calls can take 5-15 seconds
- File: `lib/soulprint/service.ts`, `app/api/soulprint/generate/route.ts`
- Measurement: User-visible loading time during generation
- Cause: Synchronous API call to OpenAI
- Improvement path: Add streaming response, show progress indicators

**No Database Indexing Strategy:**
- Problem: Queries may be slow as data grows
- File: Supabase table definitions (not in codebase)
- Cause: No explicit index definitions
- Improvement path: Add indexes on `user_id`, `created_at` for soulprints table

## Fragile Areas

**Questionnaire Answer Storage:**
- File: `app/questionnaire/new/page.tsx`
- Why fragile: localStorage + complex state management for multi-step form
- Common failures: Lost answers on browser refresh, localStorage quota issues
- Safe modification: Test all question types after changes
- Test coverage: None

**LLM Fallback Chain:**
- File: `lib/soulprint/service.ts`
- Why fragile: Multiple LLM providers with different APIs
- Common failures: API changes, rate limits, timeout handling
- Safe modification: Test each provider individually
- Test coverage: None

## Missing Critical Features

**No Email Verification:**
- Problem: Users can register with any email without verification
- Current workaround: Trust user input
- Blocks: Can't verify user identity
- Implementation complexity: Low (Supabase has built-in email verification)

**No Password Reset:**
- Problem: Users can't recover accounts
- Files: Not implemented
- Current workaround: Manual intervention
- Blocks: Self-service account recovery
- Implementation complexity: Low (Supabase has built-in reset flow)

**No SoulPrint Export:**
- Problem: Users can't export their SoulPrint data
- Current workaround: Copy from UI
- Blocks: Data portability, GDPR compliance
- Implementation complexity: Low (JSON export endpoint)

## Test Coverage Gaps

**No Test Suite:**
- What's not tested: Everything
- Risk: Regressions on any code change, especially auth and SoulPrint generation
- Priority: High
- Difficulty to test: Need to set up Vitest, mock Supabase and OpenAI

**Critical Untested Paths:**
- Authentication flow (`app/actions/auth.ts`)
- SoulPrint generation (`lib/soulprint/service.ts`)
- Gate registration (`app/actions/gate.ts`)
- API endpoints (`app/api/**/*.ts`)

## Dependencies at Risk

**React 19.2.0:**
- Risk: Very recent version, ecosystem catching up
- Impact: Some third-party components may not be compatible
- Migration plan: Monitor for issues, have React 18 fallback ready

## Documentation Gaps

**Missing .env.example:**
- Problem: No template for required environment variables
- File: Should exist at root
- Impact: New developers don't know required vars
- Fix: Create `.env.example` with all required vars (no values)

**No API Documentation:**
- Problem: Internal API endpoints undocumented
- Files: `app/api/**/*.ts`
- Impact: Hard to understand expected request/response format
- Fix: Add JSDoc comments or OpenAPI spec

---

*Concerns audit: 2026-01-12*
*Update as issues are fixed or new ones discovered*
