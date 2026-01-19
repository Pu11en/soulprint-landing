# PRD: Chat Experience Enhancements

## Overview
Upgrade the chat interface with power-user features: message editing and regeneration, feedback reactions, pinned messages, session search, prompt templates, and voice input. These features transform chat from basic to professional-grade.

## Goals
- Let users iterate on conversations without retyping
- Capture feedback to improve AI responses over time
- Help users find past conversations quickly
- Lower the barrier to starting meaningful conversations
- Enable hands-free input for accessibility and convenience

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build (includes TypeScript checking)
- `npm run lint` - Linting

For UI stories, also include:
- Verify functionality in browser

## User Stories

### US-001: Edit and regenerate messages
**Description:** As a user, I want to edit my sent messages and regenerate AI responses so I can iterate without starting over.

**Acceptance Criteria:**
- [ ] Hover on user message shows "Edit" icon button
- [ ] Clicking edit converts message to editable input field
- [ ] Save button submits edited message, regenerates AI response
- [ ] Cancel button reverts to original message
- [ ] Hover on AI message shows "Regenerate" icon button
- [ ] Clicking regenerate re-sends the preceding user message
- [ ] Show loading state during regeneration
- [ ] Original response is replaced (not kept as history)

### US-002: Message reactions/feedback
**Description:** As a user, I want to react to AI responses so I can signal what's helpful.

**Acceptance Criteria:**
- [ ] AI messages show thumbs-up and thumbs-down icons on hover
- [ ] Clicking a reaction highlights it (toggled state)
- [ ] Clicking again removes the reaction
- [ ] Store reactions in `chat_logs` table (add `feedback` column: 'positive' | 'negative' | null)
- [ ] Visual feedback: subtle color change on selected reaction
- [ ] Only one reaction per message (thumbs up OR down, not both)

### US-003: Pin important messages
**Description:** As a user, I want to pin key messages so I can find important insights quickly.

**Acceptance Criteria:**
- [ ] Messages show "Pin" icon on hover
- [ ] Pinned messages show persistent pin indicator
- [ ] Add "Pinned" section at top of chat (collapsible)
- [ ] Pinned section shows message preview + click to scroll to original
- [ ] Store pin state in `chat_logs` table (add `pinned` boolean column)
- [ ] Maximum 10 pins per session
- [ ] Unpin by clicking pin icon again

### US-004: Search across chat history
**Description:** As a user, I want to search my past conversations so I can find what we discussed.

**Acceptance Criteria:**
- [ ] Add search icon in chat sidebar header
- [ ] Clicking opens search input field
- [ ] Search queries all user's chat_logs (full-text on content)
- [ ] Results show: session name, message preview, date
- [ ] Clicking result opens that session and scrolls to message
- [ ] Highlight search term in results
- [ ] "No results" state with suggestion to try different terms
- [ ] Search debounced (300ms) to avoid excessive queries

### US-005: Prompt templates library
**Description:** As a user, I want pre-built prompts so I can start meaningful conversations quickly.

**Acceptance Criteria:**
- [ ] Add "Templates" button near chat input (or in empty state)
- [ ] Opens modal/drawer with categorized templates:
  - Self-Discovery: "What are my core values?", "Analyze my decision-making style"
  - Communication: "How do I come across to others?", "Improve my writing voice"
  - Career: "What careers match my personality?", "Help me prepare for interviews"
  - Relationships: "How do I handle conflict?", "What's my attachment style?"
- [ ] Clicking template inserts text into input field (doesn't auto-send)
- [ ] User can edit before sending
- [ ] Store templates in `lib/chat-templates.ts` (not database)
- [ ] 3-4 templates per category (12-16 total)

### US-006: Voice input
**Description:** As a user, I want to speak my messages so I can chat hands-free.

**Acceptance Criteria:**
- [ ] Replace "Coming soon" alert with working voice button
- [ ] Clicking starts browser speech recognition (Web Speech API)
- [ ] Show recording indicator (pulsing mic icon, red dot)
- [ ] Transcribed text appears in input field in real-time
- [ ] Clicking again (or silence timeout 2s) stops recording
- [ ] User can edit transcription before sending
- [ ] Show error toast if microphone access denied
- [ ] Fallback message for unsupported browsers

## Functional Requirements
- FR-1: Edit/regenerate must preserve message timestamps
- FR-2: Search must be case-insensitive
- FR-3: Voice input must request microphone permission only when clicked
- FR-4: Templates must be easy to update (single file, no database)
- FR-5: Reactions must not block the UI (optimistic update, background save)

## Non-Goals
- Voice output (AI speaking responses)
- Custom user-created templates
- Sharing pinned messages
- Advanced search filters (date range, etc.)
- Message threading or branches

## Technical Considerations
- Use Web Speech API for voice (no external service needed)
- Consider Supabase full-text search for chat search, or simple ILIKE query
- Reactions and pins require database migration (add columns)
- Templates are static data, not user-configurable

## Success Metrics
- Users can edit a message and get new response in < 3 seconds
- Search returns results in < 500ms
- Voice transcription accuracy matches browser capability
- At least 50% of new chats start from a template (measure later)

## Open Questions
- Should regenerate keep history of previous responses? (No for v1, simplicity)
- Should templates be user-customizable in future? (Yes, but not now)
