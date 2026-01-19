# PRD: Profile & Insights Enhancements

## Overview
Add side-by-side SoulPrint comparison, track personality insights over time, and enable shareable insight cards for social. These features deepen user engagement with their identity data.

## Goals
- Help users understand differences between their SoulPrints
- Show how personality evolves over time
- Enable users to share their identity insights socially
- Increase engagement with the Profile and Insights pages

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build (includes TypeScript checking)
- `npm run lint` - Linting

For UI stories, also include:
- Verify functionality in browser

## User Stories

### US-001: SoulPrint comparison UI
**Description:** As a user with multiple SoulPrints, I want to compare them side-by-side so I can see how they differ.

**Acceptance Criteria:**
- [ ] Navigate to `/dashboard/compare` shows comparison interface
- [ ] Two dropdown selectors to choose which SoulPrints to compare
- [ ] Side-by-side display of 6 cognitive pillars as bar charts
- [ ] Bars show both SoulPrints overlaid or adjacent with different colors
- [ ] Highlight pillars with >20% difference
- [ ] Show delta value between each pillar (e.g., "+15%")
- [ ] Empty state if user has only 1 SoulPrint: "Create another SoulPrint to compare"
- [ ] Link to create new SoulPrint from empty state

### US-002: Insights over time tracking
**Description:** As a user, I want to see how my SoulPrint changes over time so I can track personal growth.

**Acceptance Criteria:**
- [ ] Add `soulprint_history` table: id, soulprint_id, pillar_data (JSON), recorded_at
- [ ] Record snapshot when SoulPrint is created or updated
- [ ] On Insights page, add "Over Time" section
- [ ] Line chart showing each pillar's value over time
- [ ] X-axis: dates, Y-axis: pillar scores (0-100)
- [ ] Toggle to show/hide individual pillars
- [ ] Minimum 2 data points to show chart (otherwise: "Check back after your next update")
- [ ] Show most recent change: "Your [pillar] increased by X% since [date]"

### US-003: Shareable insight cards
**Description:** As a user, I want to share my SoulPrint insights as images so I can post on social media.

**Acceptance Criteria:**
- [ ] On Profile page, add "Share" button next to each pillar card
- [ ] Clicking generates a styled image card with:
  - SoulPrint branding (logo, colors)
  - Pillar name and score
  - Brief description of what that pillar means
  - User's archetype name
  - Subtle "soulprint.ai" watermark
- [ ] Image is 1080x1080 (Instagram-friendly square)
- [ ] "Download" button saves PNG to device
- [ ] "Copy" button copies image to clipboard (if supported)
- [ ] Alternative: generate shareable link to public profile (if sharing enabled)
- [ ] Card design is visually appealing (dark theme, gradient accents)

## Functional Requirements
- FR-1: Comparison must work with 2+ SoulPrints (user can have max 2 currently)
- FR-2: History snapshots must not bloat database (store only pillar scores, not full data)
- FR-3: Image generation must happen client-side (use html2canvas or similar)
- FR-4: Shareable cards must not include sensitive data (just pillar + archetype)
- FR-5: Charts must be responsive and readable on mobile

## Non-Goals
- Comparing with other users' SoulPrints
- Detailed history editing or deletion
- Video/animated shareable content
- Direct posting to social platforms (just download/copy)

## Technical Considerations
- Use `html2canvas` or `dom-to-image` for image generation
- Line charts: consider `recharts` (already common in React) or simple CSS/SVG
- History table needs migration; consider index on soulprint_id + recorded_at
- Image generation can be slow; show loading state

## Success Metrics
- Users with 2 SoulPrints visit comparison page
- Insights page engagement increases (time on page)
- Shareable cards are downloaded (track button clicks)

## Open Questions
- Should we limit history to last 12 months? (Yes, for storage)
- Should shareable cards include QR code to profile? (Maybe v2)
