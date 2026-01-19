# PRD: Navigation & Onboarding

## Overview
Add keyboard shortcuts for power users, breadcrumb navigation for orientation, a first-time user tour, and a progress indicator for the questionnaire. These reduce friction and help users feel confident navigating SoulPrint.

## Goals
- Enable keyboard-driven navigation for efficiency
- Help users understand where they are in the app
- Guide first-time users through key features
- Show clear progress during questionnaire completion

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build (includes TypeScript checking)
- `npm run lint` - Linting

For UI stories, also include:
- Verify functionality in browser

## User Stories

### US-001: Keyboard shortcuts
**Description:** As a power user, I want keyboard shortcuts so I can navigate without my mouse.

**Acceptance Criteria:**
- [ ] Create `hooks/use-keyboard-shortcuts.ts` for global shortcut handling
- [ ] Implement shortcuts:
  - `Ctrl/Cmd + N`: New chat session
  - `Ctrl/Cmd + K`: Focus search (when search exists)
  - `Ctrl/Cmd + /`: Focus chat input
  - `Escape`: Close any open modal/drawer
  - `Ctrl/Cmd + ,`: Open settings
- [ ] Shortcuts only active on dashboard pages (not landing, auth)
- [ ] Add `?` shortcut to show shortcuts help modal
- [ ] Shortcuts help modal lists all available shortcuts
- [ ] Shortcuts don't trigger when typing in input fields (except Escape)

### US-002: Breadcrumb navigation
**Description:** As a user, I want to see where I am in the app so I don't feel lost.

**Acceptance Criteria:**
- [ ] Create `components/dashboard/breadcrumbs.tsx`
- [ ] Display in dashboard top bar: `Dashboard > [Current Page]`
- [ ] Pages: Chat, Profile, Insights, Settings, API Keys
- [ ] "Dashboard" is clickable, returns to `/dashboard`
- [ ] Current page name is not clickable (you're already there)
- [ ] On chat page with session: `Dashboard > Chat > [Session Name]`
- [ ] Truncate long session names with ellipsis (max 20 chars)
- [ ] Mobile: collapse to just current page name (space constraints)

### US-003: First-time user tour
**Description:** As a new user, I want a guided tour so I understand how to use SoulPrint.

**Acceptance Criteria:**
- [ ] Detect first visit to dashboard (check localStorage flag)
- [ ] Show tour overlay with spotlight on key elements:
  1. Sidebar: "Navigate between sections here"
  2. Chat input: "Talk to your AI companion"
  3. Sessions list: "Your conversations are saved here"
  4. Profile link: "View and manage your SoulPrint"
- [ ] "Next" button advances through steps
- [ ] "Skip tour" button dismisses immediately
- [ ] Set localStorage flag when tour completes or skipped
- [ ] Add "Restart tour" option in Settings page
- [ ] Tour highlights use semi-transparent overlay with spotlight cutout
- [ ] Tour tooltip positioned intelligently (not off-screen)

### US-004: Questionnaire progress indicator
**Description:** As a user completing the questionnaire, I want to see my progress so I know how much is left.

**Acceptance Criteria:**
- [ ] Add progress bar to questionnaire pages
- [ ] Show "Step X of Y" text (e.g., "Step 3 of 7")
- [ ] Visual progress bar fills proportionally
- [ ] Progress persists across page navigation within questionnaire
- [ ] Steps: Intro (1), Questions section 1-5 (2-6), Voice test (7), Complete (done)
- [ ] Bar color matches brand orange (#EA580C)
- [ ] Animate progress bar fill on step change
- [ ] Position: top of questionnaire content area

## Functional Requirements
- FR-1: Keyboard shortcuts must not conflict with browser defaults
- FR-2: Tour must be skippable at any point
- FR-3: Breadcrumbs must update on client-side navigation (no full reload needed)
- FR-4: Progress indicator must be accurate (reflect actual questionnaire structure)
- FR-5: All navigation aids must work on mobile (tour touch-friendly, breadcrumbs responsive)

## Non-Goals
- Customizable keyboard shortcuts
- Multi-level breadcrumb hierarchy beyond 3 levels
- Video tutorials or documentation links in tour
- Saving questionnaire progress to resume later

## Technical Considerations
- Use `useEffect` with `keydown` listener for shortcuts
- Consider `driver.js` or `react-joyride` for tour (or build simple custom)
- Breadcrumbs can read from Next.js router pathname
- Questionnaire progress may require context or URL-based detection

## Success Metrics
- Power users can navigate entirely by keyboard
- New users complete tour (>70% don't skip)
- Questionnaire abandonment rate decreases (progress visibility)
- Zero "where am I?" support questions

## Open Questions
- Should tour re-show after major updates? (No for v1)
- Should we add vim-style navigation (j/k)? (No, too niche)
