# SoulPrint Error Handling Audit

**Date:** 2026-02-05
**Status:** IN PROGRESS

---

## Error Handling by Feature

### 1. AUTH (Signup/Login)

| Scenario | Current Handling | User Sees | Fix Needed? |
|----------|------------------|-----------|-------------|
| Invalid email | Supabase error | Generic error | ✅ OK |
| Wrong password | Supabase error | "Invalid credentials" | ✅ OK |
| Google OAuth fails | Redirect to login | May be confusing | ⚠️ Add message |
| Network error | Uncaught | Nothing | ❌ Add handler |

### 2. IMPORT (/import page)

| Scenario | Current Handling | User Sees | Fix Needed? |
|----------|------------------|-----------|-------------|
| No file selected | Blocked by UI | Can't proceed | ✅ OK |
| Wrong file type | Some validation | May not be clear | ⚠️ Improve |
| File too large | Server error | "File too large..." | ✅ OK |
| Invalid ZIP | Server error | "conversations.json not found" | ✅ OK |
| Not ChatGPT format | Server error | "Invalid file format" | ✅ OK |
| Upload fails | Try/catch | Alert box | ⚠️ Show in UI |
| Processing stuck | 15min timeout | "Still processing..." | ✅ OK |
| Network drops | Uncaught | Stuck spinner | ❌ Add handler |
| Storage full | Server error | Generic 500 | ❌ Add message |

### 3. CHAT (/chat page)

| Scenario | Current Handling | User Sees | Fix Needed? |
|----------|------------------|-----------|-------------|
| Not logged in | Redirect | Goes to login | ✅ OK |
| No soulprint yet | Check status | Redirect to import | ✅ OK |
| RLM service down | Circuit breaker | May timeout | ⚠️ Show message |
| Bedrock timeout | 30s timeout | Spinner forever | ❌ Add timeout UI |
| Empty response | Returns empty | Blank message | ❌ Handle gracefully |
| Rate limited | No handling | Error in console | ❌ Add UI feedback |

### 4. RESET (/api/user/reset)

| Scenario | Current Handling | User Sees | Fix Needed? |
|----------|------------------|-----------|-------------|
| Not logged in | 401 response | Alert "Not logged in" | ✅ OK |
| DB error | 500 response | Alert "Reset failed" | ⚠️ More detail |
| Success | 200 + reload | Page refreshes | ✅ OK |

---

## Priority Fixes

### 🔴 Critical (Users get stuck)
1. Network drop during upload → add retry
2. Chat Bedrock timeout → show "Taking longer than usual..."
3. Empty chat response → show fallback message

### 🟡 High (Bad UX but workaround exists)
1. Google OAuth fail → show message on redirect
2. Upload fail → show in banner not alert
3. RLM down → show "Memory unavailable, basic chat only"

### 🟢 Medium (Nice to have)
1. Storage full → specific message
2. Rate limit → "Slow down" message
3. Reset error detail → show what failed

---

## Implementation Plan

### Phase 1: Import Flow (30 min)
- [ ] Add network error detection
- [ ] Show all errors in banner (not alert)
- [ ] Add retry button for failed uploads

### Phase 2: Chat Flow (45 min)
- [ ] Add timeout indicator ("Taking longer...")
- [ ] Handle empty responses gracefully
- [ ] Show RLM status to user

### Phase 3: Global (20 min)
- [ ] Add error boundary component
- [ ] Log errors to console with context
- [ ] Add "Report Issue" link

---

*Audit by Asset 💰*
