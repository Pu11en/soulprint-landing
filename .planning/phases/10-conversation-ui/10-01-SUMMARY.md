---
phase: 10
plan: 01
title: "Conversation Management API Backend"
subsystem: backend-api
tags: [api, conversations, crud, auto-title, bedrock-haiku, zod-validation]

requires:
  - "08-01: Multi-conversation schema with conversations table and chat_messages FK"
  - "04-01: Rate limiting infrastructure"
  - "04-02: Zod schema validation patterns"

provides:
  - "Full CRUD API for conversation management"
  - "Auto-title generation endpoint using Bedrock Haiku 3.5"
  - "conversation_id filtering and insertion in messages API"
  - "Conversation recency tracking via updated_at refresh"

affects:
  - "10-02: Conversation UI will consume these endpoints for sidebar and chat"

tech-stack:
  added: []
  patterns:
    - "Auto-title generation via Bedrock ConverseCommand (non-streaming)"
    - "Graceful fallback for title generation (first 5 words + '...')"
    - "Conversation updated_at refresh on message save for sidebar ordering"

key-files:
  created:
    - app/api/conversations/route.ts
    - app/api/conversations/[id]/route.ts
    - app/api/conversations/[id]/title/route.ts
  modified:
    - lib/api/schemas.ts
    - app/api/chat/messages/route.ts

decisions:
  - id: use-haiku-for-titles
    choice: "Use Haiku 3.5 for title generation (not Sonnet 4.5)"
    rationale: "Title generation should be fast and cheap. Haiku is sufficient for 3-8 word summaries."
    alternatives:
      - "Sonnet 4.5: Higher quality but slower and more expensive for simple task"
  - id: fallback-title-strategy
    choice: "Fallback to first 5 words + '...' on Bedrock failure"
    rationale: "Auto-title endpoint must never fail loudly. User gets reasonable title even if AI unavailable."
  - id: conversation-id-required
    choice: "conversation_id is REQUIRED in saveMessageSchema"
    rationale: "Every message must belong to a conversation. Frontend enforces this at send time."
  - id: updated-at-refresh
    choice: "Update conversation.updated_at on every new message"
    rationale: "Sidebar lists conversations by recency. Keeps active conversations at the top."

metrics:
  duration: "~3 minutes"
  completed: "2026-02-08"

alignment:
  with_project: "Enables multi-conversation UI (PROJECT.md Phase 10 goal)"
  with_milestone: "v1.5 Full Chat Experience - conversation management foundation"
---

# Phase 10 Plan 01: Conversation Management API Backend Summary

**One-liner:** Complete CRUD API for conversations with auto-title generation via Haiku 3.5 and conversation_id support in messages.

## What Was Built

This plan delivered the backend API layer required for multi-conversation UI:

### 1. Conversation CRUD Endpoints

**GET /api/conversations**
- Lists user's conversations ordered by `updated_at DESC` (most recent first)
- Returns: `{ conversations: [{ id, title, created_at, updated_at }] }`
- Auth, rate limiting (standard tier)

**POST /api/conversations**
- Creates new conversation with optional title (default: "New Chat")
- Returns: `{ conversation }` with 201 status
- Auth, rate limiting, Zod validation

**PATCH /api/conversations/[id]**
- Renames conversation (user ownership check via double `.eq()`)
- Returns: `{ conversation }`
- Auth, rate limiting, validation

**DELETE /api/conversations/[id]**
- Deletes conversation (CASCADE to messages handled by DB FK)
- Returns: `{ success: true }`
- Auth, rate limiting

All routes follow the existing project patterns:
- Use `getSupabaseAdmin()` for data access (service role)
- Use `handleAPIError()` for consistent error handling
- Use `checkRateLimit()` for rate limiting
- Use `parseRequestBody()` with Zod schemas for validation

### 2. Auto-Title Generation

**POST /api/conversations/[id]/title**
- Generates 3-8 word conversation title from first user/AI exchange
- Uses Bedrock Haiku 3.5 (us.anthropic.claude-3-5-haiku-20241022-v1:0)
- ConverseCommand (non-streaming) with 30 token limit, temperature 0.3
- Cleans response: removes quotes, trailing punctuation, limits to 100 chars
- **Graceful fallback:** On Bedrock failure, uses first 5 words + "..." from user message
- Updates conversation.title in database

**Why Haiku?**
- Fast (low latency for immediate sidebar update)
- Cheap (title generation is frequent)
- Sufficient quality for 3-8 word summaries

### 3. Messages API Updates

**GET /api/chat/messages**
- Added `conversation_id` query parameter for filtering
- Backward-compatible: if no `conversation_id`, returns all messages (legacy behavior)
- `if (conversationId) { query = query.eq('conversation_id', conversationId); }`

**POST /api/chat/messages**
- Now requires `conversation_id` in request body (Zod enforces UUID validation)
- Inserts message with conversation_id FK
- **Updates conversation.updated_at after message save:**
  ```typescript
  await adminSupabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversation_id);
  ```
- This keeps sidebar sorted by recency (active conversations float to top)

### 4. Zod Schemas

**lib/api/schemas.ts additions:**

1. **createConversationSchema**
   - `title`: optional string (1-200 chars, default "New Chat")

2. **updateConversationSchema**
   - `title`: required string (1-200 chars, trimmed)

3. **generateTitleSchema**
   - `userMessage`: required string (1-1000 chars)
   - `aiMessage`: required string (1-1000 chars)

4. **Updated saveMessageSchema**
   - Added `conversation_id`: required UUID
   - **Breaking change:** Frontend must now always provide conversation_id when saving messages

## Task Commits

| Task | Description | Commit | Files Changed |
|------|-------------|--------|---------------|
| 1 | Add conversation Zod schemas | 6dc8b8f | lib/api/schemas.ts |
| 2 | Create conversation CRUD routes | fe06d7f | app/api/conversations/route.ts, app/api/conversations/[id]/route.ts |
| 3 | Add auto-title endpoint and update messages API | 6c57e25 | app/api/conversations/[id]/title/route.ts, app/api/chat/messages/route.ts |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification checks passed:

1. ✅ `npx tsc --noEmit` - TypeScript compiles (only pre-existing test errors)
2. ✅ `npm run build` - Next.js build successful
3. ✅ All five route files exist and export correct HTTP methods
4. ✅ Schemas exported from lib/api/schemas.ts
5. ✅ Routes registered in Next.js build output:
   - `/api/conversations`
   - `/api/conversations/[id]`
   - `/api/conversations/[id]/title`

## Next Phase Readiness

**Blocks:**
- None

**Enables:**
- Phase 10 Plan 02: Frontend can now build conversation sidebar with create/rename/delete/switch
- Frontend can call `/api/conversations/[id]/title` after first exchange to auto-name conversations
- Messages API ready for conversation_id filtering (load single conversation's messages)

**Notes for Next Plan:**
- Frontend must create a default conversation on first chat if none exists
- Frontend must pass conversation_id when calling POST /api/chat/messages
- Auto-title should be called after first assistant response completes
- Sidebar should re-fetch conversation list or update locally after title generation

## Self-Check: PASSED

All created files exist:
- ✅ app/api/conversations/route.ts
- ✅ app/api/conversations/[id]/route.ts
- ✅ app/api/conversations/[id]/title/route.ts

All commits exist:
- ✅ 6dc8b8f (schemas)
- ✅ fe06d7f (CRUD routes)
- ✅ 6c57e25 (auto-title + messages update)
