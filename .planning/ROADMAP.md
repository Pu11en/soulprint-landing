# Roadmap: SoulPrint

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1 (shipped 2026-02-01)
- SHIPPED **v1.1 Stabilization** -- Phases 1-7, 22 plans (shipped 2026-02-06)
- SHIPPED **v1.2 Import UX Streamline** -- Phases 1-3, 9 plans (shipped 2026-02-07)
- SHIPPED **v1.3 RLM Production Sync** -- Phases 1-5 (shipped 2026-02-07)
- SHIPPED **v1.4 Chat Personalization Quality** -- Phases 6-7 (shipped 2026-02-08)
- 🚧 **v1.5 Full Chat Experience** -- Phases 8-13 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phase 1) -- SHIPPED 2026-02-01</summary>

- [x] Phase 1: Mobile MVP (4 UAT tests passed)

See: `.planning/milestones/v1.0-MVP-ROADMAP.md`

</details>

<details>
<summary>v1.1 Stabilization (Phases 1-7) -- SHIPPED 2026-02-06</summary>

- [x] Phase 1: Testing Foundation (2/2 plans) -- completed 2026-02-06
- [x] Phase 2: Memory & Resource Cleanup (3/3 plans) -- completed 2026-02-06
- [x] Phase 3: Race Condition Fixes (3/3 plans) -- completed 2026-02-06
- [x] Phase 4: Security Hardening (6/6 plans) -- completed 2026-02-06
- [x] Phase 5: Observability (2/2 plans) -- completed 2026-02-06
- [x] Phase 6: Comprehensive Testing (3/3 plans) -- completed 2026-02-06
- [x] Phase 7: Type Safety Refinement (3/3 plans) -- completed 2026-02-06

See: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>v1.2 Import UX Streamline (Phases 1-3) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Schema + Quick Pass Pipeline (3/3 plans) -- completed 2026-02-07
- [x] Phase 2: Full Pass Pipeline (3/3 plans) -- completed 2026-02-07
- [x] Phase 3: Chat Integration + UX (3/3 plans) -- completed 2026-02-07

See: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>v1.3 RLM Production Sync (Phases 1-5) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Dependency Extraction (1/1 plans) -- completed 2026-02-06
- [x] Phase 2: Copy & Modify Processors (2/2 plans) -- completed 2026-02-07
- [x] Phase 3: Wire New Endpoint (2/2 plans) -- completed 2026-02-07
- [x] Phase 4: Pipeline Integration (2/2 plans) -- completed 2026-02-07
- [x] Phase 5: Gradual Cutover (5/5 plans) -- completed 2026-02-07

See: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>v1.4 Chat Personalization Quality (Phases 6-7) -- SHIPPED 2026-02-08</summary>

- [x] Phase 6: Prompt Foundation (5/5 plans) -- completed 2026-02-07
- [x] Phase 7: Production Deployment (2/2 plans) -- completed 2026-02-08

See: `.planning/milestones/v1.4-ROADMAP.md`

</details>

## 🚧 v1.5 Full Chat Experience (In Progress)

**Milestone Goal:** Transform the basic single-conversation chat into a full-featured AI assistant with conversation management, streaming responses, web search with citations, rich markdown rendering, voice input, and dark mode. After this milestone, SoulPrint's chat UX is on par with ChatGPT/Claude while retaining its unique personalization.

**Execution Order:**
Phases 8 → (9, 11, 12 in parallel) → 10 → 13

Phases 9, 11, and 12 have no dependencies on each other and can execute concurrently. Phase 10 depends on Phase 8 (DB schema). Phase 13 executes last after core features stabilize.

### Phase 8: DB Schema & Migration
**Goal**: Multi-conversation database foundation exists and all existing messages are preserved in a default conversation per user
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: CONV-07
**Success Criteria** (what must be TRUE):
  1. A `conversations` table exists with id, user_id, title, created_at, updated_at columns and RLS policies
  2. `chat_messages` table has a `conversation_id` column with foreign key to conversations
  3. Every existing chat message belongs to a backfilled default conversation (zero messages orphaned)
  4. User querying their conversations via the API sees exactly one conversation containing all their prior messages
**Plans**: 1 plan
Plans:
- [ ] 08-01-PLAN.md -- Conversations table, FK column, backfill migration

### Phase 9: Streaming Responses
**Goal**: Users see AI responses appear token-by-token in real time with the ability to stop generation
**Depends on**: Nothing (independent of Phase 8)
**Requirements**: STRM-01, STRM-02, STRM-03
**Success Criteria** (what must be TRUE):
  1. User sees AI response text appear incrementally as it generates (not all at once after completion)
  2. User can click a stop button during generation and the response halts with partial text preserved
  3. Streaming works on production Vercel deployment without buffering or timeout failures (tested in preview environment)
  4. Long responses (>30 seconds) complete gracefully without Vercel function timeout errors
**Plans**: TBD

### Phase 10: Conversation Management UI
**Goal**: Users can manage multiple conversations with full CRUD and auto-generated titles
**Depends on**: Phase 8 (conversations table and conversation_id must exist)
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. User sees a sidebar listing all their conversations, ordered by most recent activity
  2. User can create a new conversation and immediately start chatting in it
  3. User can click a conversation in the sidebar and its messages load in the chat area
  4. User can delete a conversation and it disappears from the sidebar (with confirmation)
  5. User can rename a conversation by editing its title in the sidebar
  6. New conversations auto-generate a title from the first user message and AI response
**Plans**: TBD

### Phase 11: Rich Rendering & Dark Mode
**Goal**: AI responses render with full markdown formatting, syntax-highlighted code blocks, and users can switch between light and dark themes
**Depends on**: Nothing (independent, visual enhancement)
**Requirements**: RNDR-01, RNDR-02, RNDR-03, RNDR-04, DARK-01, DARK-02, DARK-03
**Success Criteria** (what must be TRUE):
  1. AI responses render markdown headers, lists, bold, italic, links, and tables correctly
  2. Code blocks display with language-appropriate syntax highlighting and a visible copy button that copies code to clipboard
  3. User can toggle between dark and light themes via a visible control, and the theme persists across sessions
  4. On first visit, the theme matches the user's OS/browser preference (dark OS = dark SoulPrint)
  5. No UI element has invisible text, broken contrast, or unreadable content in either theme (hard-coded colors eliminated)
  6. Markdown rendering is XSS-safe: javascript: links are blocked, HTML is sanitized
**Plans**: TBD

### Phase 12: Web Search Hardening
**Goal**: Users can trigger web search for current-info queries and receive responses with validated, clickable source citations
**Depends on**: Nothing (enhances existing smartSearch feature)
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. User can trigger a web search / research mode (via toggle or automatic detection) for queries needing current information
  2. AI responses from web search include inline clickable citations that link to the actual source pages
  3. Every citation URL in a response exists in the actual search results returned by Tavily (no hallucinated or fabricated links)
  4. Citation links are sanitized (no javascript: protocol, no data: URIs)
**Plans**: TBD

### Phase 13: Voice Input
**Goal**: Users can speak their messages instead of typing, with graceful browser compatibility handling
**Depends on**: Nothing (independent, but executes last after core features are stable)
**Requirements**: VOIC-01, VOIC-02, VOIC-03
**Success Criteria** (what must be TRUE):
  1. User can tap/click a microphone button next to the text input to record a voice message that gets transcribed into text
  2. On browsers without speech recognition support, the microphone button is hidden (no broken UI)
  3. Voice recording automatically stops after 2 minutes and the accumulated transcription is placed in the input field
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute: 8 → (9 + 11 + 12 parallel) → 10 → 13

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dependency Extraction | v1.3 | 1/1 | Complete | 2026-02-06 |
| 2. Copy & Modify Processors | v1.3 | 2/2 | Complete | 2026-02-07 |
| 3. Wire New Endpoint | v1.3 | 2/2 | Complete | 2026-02-07 |
| 4. Pipeline Integration | v1.3 | 2/2 | Complete | 2026-02-07 |
| 5. Gradual Cutover | v1.3 | 5/5 | Complete | 2026-02-07 |
| 6. Prompt Foundation | v1.4 | 5/5 | Complete | 2026-02-07 |
| 7. Production Deployment | v1.4 | 2/2 | Complete | 2026-02-08 |
| 8. DB Schema & Migration | v1.5 | 0/1 | Planning complete | - |
| 9. Streaming Responses | v1.5 | 0/TBD | Not started | - |
| 10. Conversation Management UI | v1.5 | 0/TBD | Not started | - |
| 11. Rich Rendering & Dark Mode | v1.5 | 0/TBD | Not started | - |
| 12. Web Search Hardening | v1.5 | 0/TBD | Not started | - |
| 13. Voice Input | v1.5 | 0/TBD | Not started | - |

---
*Last updated: 2026-02-08 -- Phase 8 planned (1 plan, 1 wave)*
