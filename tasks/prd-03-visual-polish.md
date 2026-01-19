# PRD: Visual Polish & Consistency

## Overview
Fix visual inconsistencies across the SoulPrint dashboard, replace spinners with skeleton loaders, standardize button styles, and add an animated SoulPrint visualization. These changes make the app feel more cohesive and professionally polished.

## Goals
- Eliminate jarring color mismatches between dashboard sections
- Create a consistent, predictable button system
- Make loading states feel faster with skeleton UI
- Add visual delight with animated SoulPrint display
- Establish design tokens for future consistency

## Quality Gates

These commands must pass for every user story:
- `npm run build` - Build (includes TypeScript checking)
- `npm run lint` - Linting

For UI stories, also include:
- Verify visual appearance in browser across all affected pages

## User Stories

### US-001: Fix dashboard background color mismatch
**Description:** As a user, I want a consistent dark theme so the dashboard doesn't feel broken or unfinished.

**Acceptance Criteria:**
- [ ] Audit current backgrounds: layout uses #A1A1AA (gray), sidebar uses #111111 (near-black)
- [ ] Define single dark theme palette in `tailwind.config.js` or CSS variables
- [ ] Primary background: #0A0A0A (rich black)
- [ ] Secondary/card background: #141414
- [ ] Sidebar background: #0F0F0F
- [ ] Update `app/dashboard/layout.tsx` to use new background
- [ ] Update sidebar component to match
- [ ] Verify all dashboard pages (chat, profile, insights, settings, bot) render correctly
- [ ] No visible color seams between sections

### US-002: Create unified button component system
**Description:** As a user, I want buttons to look consistent so the app feels cohesive.

**Acceptance Criteria:**
- [ ] Audit existing button variants across codebase (orange filled, white filled, outline, ghost)
- [ ] Define standard button variants in `components/ui/button.tsx`:
  - `primary`: Orange fill (#EA580C), white text
  - `secondary`: Dark gray fill, white text
  - `outline`: Transparent, orange border, orange text
  - `ghost`: Transparent, subtle hover state
  - `destructive`: Red fill for delete actions
- [ ] Define standard sizes: `sm`, `md` (default), `lg`
- [ ] Update all dashboard buttons to use the component
- [ ] Update all auth page buttons (login, signup, enter) to use the component
- [ ] Update landing page CTAs to use the component
- [ ] No raw `<button>` elements with inline styles remaining

### US-003: Replace spinners with skeleton loaders
**Description:** As a user, I want loading states that show me what's coming so the app feels faster.

**Acceptance Criteria:**
- [ ] Create `components/ui/skeleton.tsx` component with pulse animation
- [ ] Create skeleton variants:
  - `SkeletonText`: Single line of varying width
  - `SkeletonCard`: Rounded rectangle
  - `SkeletonAvatar`: Circle
  - `SkeletonButton`: Pill shape
- [ ] Replace chat message loading spinner with message-shaped skeletons
- [ ] Replace session list loading with session-item-shaped skeletons
- [ ] Replace profile page loading with profile-card-shaped skeletons
- [ ] Replace insights charts loading with chart-shaped skeletons
- [ ] Skeleton color should match dark theme (subtle gray pulse)

### US-004: Add animated SoulPrint visualization on profile
**Description:** As a user, I want to see my SoulPrint as a living, animated visualization so it feels personal and dynamic.

**Acceptance Criteria:**
- [ ] Create `components/dashboard/soulprint-viz.tsx` animated component
- [ ] Display 6 cognitive pillars as horizontal animated bars
- [ ] Bars animate in on mount (stagger effect)
- [ ] Subtle idle animation (gentle pulse or glow)
- [ ] Hover on bar shows pillar name and score
- [ ] Use existing pillar data from SoulPrint profile
- [ ] Works on mobile (touch to reveal pillar info)
- [ ] Respects `prefers-reduced-motion` (static fallback)
- [ ] Integrate into `/dashboard/profile` page above the pillar cards
- [ ] Flat design (no gradients or 3D effects)

## Functional Requirements
- FR-1: All color values must use CSS variables or Tailwind theme tokens (no hardcoded hex in components)
- FR-2: Button component must support `disabled` state with appropriate styling
- FR-3: Button component must support `loading` state (shows spinner, disables click)
- FR-4: Skeleton animations must be smooth (60fps) and not cause layout shift
- FR-5: SoulPrint visualization must gracefully handle missing pillar data

## Non-Goals
- Full light mode theme (dark only for now)
- Custom color themes or user preferences
- Complex 3D visualization (keep it 2D/CSS-based)
- Animation of landing page (focus on dashboard only)

## Technical Considerations
- Leverage existing Framer Motion for animations
- Use CSS variables in `:root` for easy future theming
- Consider using `tailwindcss-animate` plugin for skeleton pulse
- SoulPrint viz uses horizontal bars, not radial chart
- Test skeleton performance on low-end devices

## Success Metrics
- Zero visible color mismatches in dashboard
- All buttons use the unified component (grep finds no stray styled buttons)
- Loading states show content-shaped skeletons instead of spinners
- Profile page shows animated visualization

## Open Questions
- None remaining
