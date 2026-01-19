# PRD: Error Handling & Feedback System

## Overview
Add a global toast notification system, retry mechanisms for failed operations, and improve error message clarity across SoulPrint. This foundational work improves perceived quality and will be reused by all future features.

## Goals
- Provide non-intrusive feedback for all user actions (success, error, info)
- Give users clear recovery paths when things fail
- Replace vague error messages with actionable, human-readable text
- Establish a reusable notification pattern for future features

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build (includes TypeScript checking)
- `npm run lint` - Linting

For UI stories, also include:
- Verify toast appearance and behavior in browser

## User Stories

### US-001: Create toast notification component
**Description:** As a user, I want to see non-blocking notifications so that I know when actions succeed or fail without losing my place.

**Acceptance Criteria:**
- [ ] Create `components/ui/toast.tsx` using Radix UI Toast primitive
- [ ] Toast appears in top-right corner with slide-in animation
- [ ] Supports variants: success (green), error (red), info (blue), warning (yellow)
- [ ] Auto-dismisses after 5 seconds
- [ ] Hovering pauses the dismiss timer
- [ ] Close button (X) for manual dismissal
- [ ] Multiple toasts stack vertically with 8px gap
- [ ] Maximum 3 toasts visible at once (oldest dismissed first)

### US-002: Create toast context and hook
**Description:** As a developer, I want a simple API to trigger toasts from anywhere in the app.

**Acceptance Criteria:**
- [ ] Create `contexts/toast-context.tsx` with ToastProvider
- [ ] Create `hooks/use-toast.ts` that returns `{ toast, dismiss, dismissAll }`
- [ ] API: `toast({ title, description?, variant, duration? })`
- [ ] Wrap app in ToastProvider in root layout
- [ ] Export from `@/components/ui/toast` for easy imports

### US-003: Add retry button for chat failures
**Description:** As a user, when my message fails to send, I want a retry button so I can try again without retyping.

**Acceptance Criteria:**
- [ ] When chat API returns error, show error toast with "Retry" action button
- [ ] Failed message stays in input field (not cleared)
- [ ] Clicking retry re-submits the same message
- [ ] Show loading state on retry
- [ ] After 3 consecutive failures, show "Check your connection" message

### US-004: Improve error message clarity
**Description:** As a user, I want error messages that tell me what went wrong and what to do about it.

**Acceptance Criteria:**
- [ ] Replace "Error: Failed to reply" with "Couldn't get a response. Check your connection and try again."
- [ ] Replace "Something went wrong" with specific messages based on error type
- [ ] Network errors: "Connection lost. Please check your internet."
- [ ] Rate limit errors: "Too many requests. Please wait a moment."
- [ ] Auth errors: "Session expired. Please log in again." (with login link)
- [ ] Create `lib/error-messages.ts` mapping error codes to user-friendly messages

## Functional Requirements
- FR-1: ToastProvider must be mounted at app root level
- FR-2: Toasts must be accessible (proper ARIA attributes, keyboard dismissible)
- FR-3: Toast animations must respect `prefers-reduced-motion`
- FR-4: Error messages must never expose technical details (stack traces, API keys)
- FR-5: Retry mechanism must not allow infinite rapid retries (debounce 1 second)

## Non-Goals
- Custom toast positioning (always top-right for now)
- Toast history/log viewing
- Email notifications for errors
- Error reporting to external services (Sentry, etc.)

## Technical Considerations
- Use Radix UI Toast for accessibility compliance
- Leverage existing Framer Motion for animations
- Consider using `sonner` library as alternative (lighter weight)
- Toast state should not persist across page navigation

## Success Metrics
- All user-facing errors show toast instead of alert() or inline text
- Zero instances of "Something went wrong" without context
- Chat retry works on first click after failure

## Open Questions
- Should we add sound effects for error toasts? (probably not for v1)
