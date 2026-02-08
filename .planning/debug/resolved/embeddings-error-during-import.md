---
status: resolved
trigger: "embeddings-error-during-import"
created: 2026-02-08T00:00:00Z
updated: 2026-02-08T00:09:30Z
---

## Current Focus

hypothesis: Fix applied successfully
test: Verify that background RLM failures no longer overwrite import success
expecting: import_status remains 'complete', errors logged to full_pass_error instead
next_action: Verify fix logic and document verification

## Symptoms

expected: Import should complete smoothly with no error messages visible to the user. If RLM has issues in the background, the user should never know — they should just get into chat.
actual: Users briefly see an "embeddings 10 error" or similar error message during import before being allowed to proceed. This happens when the RLM backend (Render) is cold-starting or has a transient failure.
errors: "embeddings 10 error" or similar — exact wording unknown, user reported it briefly during import
reproduction: Upload a ChatGPT export when the RLM Render instance is cold or under load. The error appears briefly during/after processing.
started: Ongoing issue. Has been seen multiple times by the project owner during testing.

## Eliminated

## Evidence

- timestamp: 2026-02-08T00:01:00Z
  checked: process-server/route.ts lines 433-488
  found: RLM call is wrapped in try-catch, errors are logged but NOT thrown. Fire-and-forget pattern used. Response returns success even if RLM fails.
  implication: RLM errors should NOT reach the frontend response from process-server

- timestamp: 2026-02-08T00:02:00Z
  checked: queue-processing/route.ts lines 144-176
  found: Calls process-server and awaits the response. Returns errorData.error if response is not ok.
  implication: If process-server returns error, it would surface to frontend. But process-server doesn't return errors from RLM.

- timestamp: 2026-02-08T00:03:00Z
  checked: app/import/page.tsx lines 434-441
  found: Frontend checks queueRes.ok, displays err.error as errorMessage. Line 471: userMessage = err.message for passthrough.
  implication: Any error in queueRes would be displayed to user

- timestamp: 2026-02-08T00:04:00Z
  checked: process-server RLM call (lines 452-488)
  found: Even if RLM call fails, code continues to line 498 and returns success: true. Only logs warnings.
  implication: Process-server NEVER returns RLM errors to queue-processing

- timestamp: 2026-02-08T00:05:00Z
  checked: RLM service main.py ../soulprint-rlm/main.py line 3303
  found: When process_full_background() catches ANY exception, sets import_error = error_msg[:500] AND import_status = 'failed'
  implication: RLM background processing errors DO get written to import_error field

- timestamp: 2026-02-08T00:06:00Z
  checked: Import page useEffect (lines 138-207)
  found: On mount, calls /api/memory/status. If data.status === 'failed' OR data.import_error exists, displays error to user.
  implication: If RLM fails AFTER user navigates away, the error will show when they return to /import page

- timestamp: 2026-02-08T00:07:00Z
  checked: Chat page status polling (lines 220-250)
  found: Polls /api/memory/status every 3s while building. If data.status === 'failed', sets importError state and displays it.
  implication: User redirected to /chat after upload. Chat polls status. RLM fails in background, chat sees failed status and shows error.

- timestamp: 2026-02-08T00:08:00Z
  checked: Full flow timing
  found: 1) Upload completes → process-server returns success (line 498) → user sees /chat. 2) RLM runs background processing. 3) RLM hits embedding error (cold start, Bedrock timeout, etc.). 4) RLM catches exception, sets import_status='failed' + import_error. 5) Chat polling picks up failed status, displays "embeddings 10 error" to user.
  implication: Race condition - quick pass succeeds, user gets into chat, then background RLM failure overwrites the success status.

## Resolution

root_cause: The RLM background processor (process_full_background in ../soulprint-rlm/main.py line 2757-3310) has a try-catch that sets import_status='failed' and import_error=error_msg when ANY exception occurs during background processing (chunking, embedding, soulprint generation). This includes transient embedding errors like Bedrock Titan cold starts or network timeouts. Since the frontend returns success BEFORE RLM completes, users see their import succeed, navigate to /chat, and then seconds later the chat page's status polling detects the failed status from RLM's background failure, displaying the error message to the user. The error is "brief" because the user has already seen success and is in chat — they shouldn't see backend errors at all.

fix: Modified RLM error handler (line 3303 in ../soulprint-rlm/main.py) to use full_pass_status='failed' and full_pass_error instead of import_status='failed' and import_error. This keeps import_status='complete' (which was set after quick pass succeeded) and prevents errors from surfacing to users. The chat page already handles full_pass failures gracefully (lines 236-242 in app/chat/page.tsx) as non-fatal console warnings.

verification:
- Fix applied successfully: line 3303 now sets full_pass_status/full_pass_error instead of import_status/import_error
- Verified no other locations in RLM set import_error (grep found 0 matches)
- Chat page handles full_pass failures as non-fatal (line 238-241): sets memoryStatus='ready', logs console.warn, user can chat normally
- Import page error display (lines 145-150) only triggers on import_status='failed' which will no longer be set by background RLM failures
- Users will never see "embeddings 10 error" or similar RLM background failures
- Background errors are still logged to full_pass_error for debugging/monitoring

files_changed: ['/home/drewpullen/clawd/soulprint-rlm/main.py']
