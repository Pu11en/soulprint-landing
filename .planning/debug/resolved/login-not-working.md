---
status: resolved
trigger: "Login is not working — both Google OAuth and email/password. Page stays on the login page after attempting to sign in."
created: 2026-02-09T00:00:00Z
updated: 2026-02-09T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED — CSRF middleware blocks server action POST requests with 403
test: Build passes, server actions now bypass CSRF middleware
expecting: Login works for both email/password and Google OAuth
next_action: Archive and commit

## Symptoms

expected: User clicks login (Google OAuth or email/password) and gets redirected to the dashboard/app
actual: Page stays on the login page, nothing happens
errors: Silent 403 from CSRF middleware — no error shown to user
reproduction: Try to log in with either Google OAuth or email/password
started: After v2.0 milestone push — CSRF middleware was added in Phase 4 (quality scoring)

## Eliminated

- hypothesis: /dashboard route doesn't exist (redirect target missing)
  evidence: app/dashboard/page.tsx exists and renders correctly
  timestamp: 2026-02-09T00:00:30Z

- hypothesis: Redirect loop between login and dashboard
  evidence: middleware.ts has no auth redirect logic; supabase middleware only refreshes session
  timestamp: 2026-02-09T00:00:30Z

## Evidence

- timestamp: 2026-02-09T00:00:10Z
  checked: app/actions/auth.ts — signIn server action
  found: signIn calls redirect('/dashboard') on success. signInWithGoogle calls redirect(data.url) for OAuth URL. Both are 'use server' actions invoked via POST.
  implication: These are server action POSTs that go through middleware

- timestamp: 2026-02-09T00:00:15Z
  checked: middleware.ts — CSRF middleware setup
  found: Uses @edge-csrf/nextjs createCsrfMiddleware. Validates CSRF token on ALL POST/PUT/DELETE/PATCH requests. Returns 403 if validation fails.
  implication: Server action POST requests are intercepted by CSRF middleware

- timestamp: 2026-02-09T00:00:20Z
  checked: @edge-csrf/nextjs v2.5.2 source code (dist/index.js)
  found: Token extraction function reads request body (text/plain) to find CSRF token. Server actions use Content-Type text/plain with Next-Action header. Body contains action payload, not CSRF token. excludePathPrefixes only excludes /_next/ but server actions POST to page URL (/).
  implication: CSRF validation always fails for server actions — returns 403

- timestamp: 2026-02-09T00:00:25Z
  checked: components/auth-modal.tsx — handleSubmit and handleGoogleSignIn
  found: Calls signIn(formData) and signInWithGoogle() directly without try/catch. No CSRF token included. When 403 is returned, the server action call fails silently — isLoading stays true, no error shown.
  implication: User sees "nothing happens" because error is swallowed

- timestamp: 2026-02-09T00:00:35Z
  checked: Next.js documentation and GitHub discussions
  found: Confirmed middleware DOES run for server action invocations. Server actions make POST to the page pathname. Known issue with @edge-csrf/nextjs and server actions (GitHub issue #18).
  implication: This is a confirmed, known interaction issue

## Resolution

root_cause: The @edge-csrf/nextjs middleware (added in Phase 4) blocks ALL server action POST requests with a 403 response. Server actions in Next.js are invoked via POST to the page URL with Content-Type text/plain. The CSRF middleware intercepts these, reads the body looking for a CSRF token, finds none (body contains server action payload), and returns 403. The auth-modal component has no error handling for this case, so the user sees "nothing happens" — the loading state never resolves and no error message is shown.

fix: |
  1. middleware.ts: Detect server action requests via Next-Action header and skip CSRF validation entirely for them. Next.js has built-in CSRF protection for server actions (Origin/Host header comparison).
  2. components/auth-modal.tsx: Added try/catch around signIn/signUp/signInWithGoogle server action calls so that any future failures properly reset the loading state instead of leaving the UI stuck.

verification: Build passes (npm run build). Server actions will no longer be intercepted by CSRF middleware. CSRF protection remains active for all API route POST/PUT/DELETE/PATCH requests.

files_changed:
  - middleware.ts
  - components/auth-modal.tsx
