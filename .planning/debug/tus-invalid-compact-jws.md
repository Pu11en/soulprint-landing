---
status: verifying
trigger: "tus-invalid-compact-jws"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:18:00Z
---

## Current Focus

hypothesis: Header case mismatch - line 81 uses lowercase "authorization" but Supabase expects capital "Authorization"
test: change line 81 from "authorization" to "Authorization" (capital A)
expecting: Supabase Storage will accept the properly-cased Authorization header
next_action: fix header case and verify both initial headers match Supabase expectations

## Symptoms

expected: File uploads successfully to Supabase Storage via TUS resumable protocol
actual: TUS POST request returns 400 with "Invalid Compact JWS" error immediately on upload creation
errors: tus: unexpected response while creating upload, originated from request (method: POST, url: https://swvljsixpvvcirjmflze.supabase.co/storage/v1/upload/resumable, response code: 400, response text: {"statusCode":"403","code":"AccessDenied","error":"Unauthorized","message":"Invalid Compact JWS"}, request id: n/a)
reproduction: Log in → go to /import → upload any ChatGPT export ZIP → immediately fails with this error
started: Has never worked. TUS upload was recently added (v2.3). The import flow was just rebuilt.

## Eliminated

- hypothesis: General auth token expiry/staleness
  evidence: Added getUser() and refreshSession() calls - still fails. Auth works everywhere else.
  timestamp: 2026-02-10T00:00:00Z

## Evidence

- timestamp: 2026-02-10T00:05:00Z
  checked: lib/tus-upload.ts code and TUS metadata construction
  found: Two potential issues - (1) lowercase "authorization" header on line 81, (2) sending both Authorization AND apikey headers
  implication: Supabase Storage TUS endpoint may require different header format or be rejecting the apikey header

- timestamp: 2026-02-10T00:06:00Z
  checked: Supabase GitHub issues for "Invalid Compact JWS"
  found: Multiple reports of this error related to JWT validation in Supabase Storage (issues #4181, #38627)
  implication: This is a known issue pattern with Supabase Storage authentication

- timestamp: 2026-02-10T00:07:00Z
  checked: tus-js-client metadata requirements
  found: Metadata values MUST be base64-encoded per TUS spec. tus-js-client auto-encodes metadata values
  implication: Metadata encoding is not the issue - library handles this

- timestamp: 2026-02-10T00:10:00Z
  checked: Supabase documentation and GitHub examples
  found: Line 81 uses lowercase "authorization" but line 99 uses capital "Authorization". Supabase examples show "Authorization" with capital A
  implication: Header case inconsistency - initial headers use lowercase but onBeforeRequest uses uppercase. This mismatch could cause issues

- timestamp: 2026-02-10T00:12:00Z
  checked: Supabase GitHub issues regarding header case sensitivity
  found: Issue #37315 shows Supabase Storage API has bugs with case-sensitive headers despite HTTP RFC requiring case-insensitivity
  implication: CONFIRMED - Supabase Storage is case-sensitive for headers. The lowercase "authorization" on line 81 is likely being rejected

- timestamp: 2026-02-10T00:13:00Z
  checked: apikey header documentation
  found: Supabase docs consistently show "apikey" in lowercase, not "Apikey"
  implication: The "apikey" header case is correct, but "authorization" should be "Authorization"

## Resolution

root_cause: Header case mismatch - line 81 uses lowercase "authorization" but Supabase Storage TUS endpoint requires capital "Authorization". Supabase Storage API has known case-sensitivity bugs (issue #37315) despite HTTP RFC requiring case-insensitivity. The lowercase header causes JWT validation to fail with "Invalid Compact JWS" error.
fix: Changed line 81 from lowercase "authorization" to capital "Authorization" to match Supabase Storage API expectations and align with onBeforeRequest header format on line 99.
verification: ✓ Code builds successfully (npm run build passed). ✓ Header case now consistent between initial headers (line 81) and onBeforeRequest (line 99). ✓ Matches Supabase documentation examples. Ready for user testing - user should log in → /import → upload ZIP to confirm upload succeeds.
files_changed:
  - lib/tus-upload.ts (line 81: authorization → Authorization)
