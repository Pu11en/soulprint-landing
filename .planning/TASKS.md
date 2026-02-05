# SoulPrint — All Tasks Map

**Generated:** 2026-02-04 22:30 CST
**For:** Drew (kidquick360)

---

## 🚨 CRITICAL (Blocking Users)

| # | Task | File | Status |
|---|------|------|--------|
| 1 | **Reset button doesn't work for non-admins** | `app/api/admin/reset-user/route.ts` | ❌ BROKEN |
| | → Only `drew@archeforge.com` and `drewspatterson@gmail.com` can reset | | |
| | → FIX: Add user self-reset OR add kidquick360 email to admin list | | |
| 2 | **Stuck imports can't be retried** | `app/import/page.tsx` | ❌ BROKEN |
| | → No way to resume from failed step | | |
| 3 | **Error messages not shown to users** | Multiple files | ⚠️ PARTIAL |
| | → Some errors silent, some logged but not displayed | | |

---

## 🔧 HIGH PRIORITY (UX Issues)

| # | Task | File | Notes |
|---|------|------|-------|
| 4 | Progress indicator during import | `app/import/page.tsx` | Not built |
| 5 | Progress indicator during embedding | `app/chat/page.tsx` | Shows "processing" but no % |
| 6 | "Analyzing..." placeholder soulprint | `process-server/route.ts:239` | Users see incomplete text |
| 7 | Memory status poll race condition | `app/chat/page.tsx:113-162` | UI jumps states |
| 8 | Large file handling (>500MB) | `process-server/route.ts` | Vercel memory limits |

---

## 🧹 TECH DEBT (Clean Up)

| # | Task | File | Notes |
|---|------|------|-------|
| 9 | Remove dead code: old Titan embeddings | `lib/import/embedder.ts` | Unused |
| 10 | Remove dead code: old import route | `app/api/import/process/route.ts` | Unused |
| 11 | Remove dead code: generate-embeddings script | `scripts/generate-embeddings.ts` | Unused |
| 12 | Push notifications disabled | `complete/route.ts:163-176` | Needs `push_subscription` column |
| 13 | Failed notification re-trigger | - | No admin way to resend |

---

## 🔒 SECURITY

| # | Task | File | Risk |
|---|------|------|------|
| 14 | Internal header accepts any user_id | `process-server/route.ts:46-48` | Medium |
| 15 | Error messages may expose env vars | `chat/route.ts:225` | Low |

---

## ⚡ PERFORMANCE

| # | Task | File | Impact |
|---|------|------|--------|
| 16 | Smart search adds 2-5s latency | `chat/route.ts:207-227` | Slow chat |
| 17 | Unbounded chat history in context | `chat/route.ts:350` | Memory grows |
| 18 | Chat history loads 100 messages | `chat/page.tsx:76` | Slow load |

---

## 📋 TODO IN CODE

| # | Location | Note |
|---|----------|------|
| 19 | `complete/route.ts:164` | `TODO: Add push_subscription column` |
| 20 | `transcribe/route.ts:27` | Placeholder fingerprint comparison |
| 21 | `voice/verify/route.ts:55` | Placeholder voice embedding |
| 22 | `voice/enroll/route.ts:38` | Placeholder voice fingerprint |

---

## 🎯 QUICK WINS (30 min or less)

1. **Add kidquick360 email to ADMIN_EMAILS** (1 line fix)
2. **Add user self-reset button** (new route + UI button)
3. **Show error messages in UI** (surface existing errors)
4. **Add loading spinner during import** (simple UI)

---

## 📊 VISUAL PRIORITY MAP

```
                    URGENT
                      ↑
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    │  [1] Reset      │  [4] Progress   │
    │  [2] Retry      │  [5] Embed UI   │
    │  [3] Errors     │  [6] Soulprint  │
    │                 │                 │
HARD ←────────────────┼────────────────→ EASY
    │                 │                 │
    │  [8] Large      │  [9-11] Dead    │
    │      files      │        code     │
    │  [16-18] Perf   │  [12] Push      │
    │                 │                 │
    └─────────────────┼─────────────────┘
                      ↓
                  LATER
```

---

## 🎬 RECOMMENDED FIX ORDER

### TODAY (30 min)
1. Add your email to ADMIN_EMAILS
2. Test reset button works
3. Document what's actually broken when you try the flow

### THIS WEEK
4. User-facing error messages
5. Progress indicators
6. Self-reset for users (not just admins)

### NEXT WEEK
7. Large file handling
8. Clean up dead code
9. Performance fixes

---

*Run through the app and tell me what breaks — I'll add to this list!*
