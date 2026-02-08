---
phase: 11
plan: 01
subsystem: frontend-infrastructure
tags: [dark-mode, next-themes, markdown, tailwind, typography]

requires:
  - Phase 10 (Achievement System) - Uses ThemeProvider in UI components

provides:
  - ThemeProvider wrapping entire app via root layout
  - System preference detection (defaultTheme="system")
  - Tailwind typography plugin for markdown prose classes
  - React-markdown ecosystem (remark-gfm, rehype-sanitize, react-syntax-highlighter)

affects:
  - Phase 11 Plan 02 (Theme Toggle Implementation) - Will use ThemeProvider context
  - Phase 11 Plan 03 (Markdown Rendering) - Will use installed packages and prose classes

tech-stack:
  added:
    - next-themes@0.4.6: Theme provider with SSR support
    - react-markdown@10.1.0: Markdown rendering
    - remark-gfm@4.0.1: GitHub Flavored Markdown support
    - rehype-sanitize@6.0.0: XSS protection for markdown
    - react-syntax-highlighter@16.1.0: Code syntax highlighting
    - "@tailwindcss/typography@0.5.19": Prose classes for rich text
    - "@types/react-syntax-highlighter@15.5.13": TypeScript types
  patterns:
    - Class-based dark mode (Tailwind darkMode: "class")
    - System preference detection with localStorage persistence
    - SSR-safe theme provider with suppressHydrationWarning

key-files:
  created:
    - components/theme/theme-provider.tsx: Next-themes wrapper for root layout
  modified:
    - app/layout.tsx: ThemeProvider integration, removed hardcoded dark class
    - tailwind.config.ts: Added typography plugin to plugins array
    - package.json: Added 7 new dependencies
    - components/chat/code-block.tsx: Fixed react-syntax-highlighter imports (ESM paths)
    - components/chat/message-content.tsx: Fixed ReactMarkdown v9+ component prop destructuring
    - components/chat/telegram-chat-v2.tsx: Fixed MessageContent props (removed invalid textColor)

decisions:
  - id: DARK-01
    what: Use next-themes for theme management
    why: Industry standard, SSR-safe, localStorage persistence, system preference detection
    alternatives: Manual theme context (more boilerplate, no SSR optimization)

  - id: DARK-02
    what: Default to system preference (defaultTheme="system")
    why: Respects user's OS/browser preference on first visit
    alternatives: Default to light or dark (less user-friendly)

  - id: DARK-03
    what: Use class-based dark mode (attribute="class")
    why: Tailwind uses class-based dark mode, next-themes supports it natively
    alternatives: data-theme attribute (would require Tailwind config change)

  - id: DARK-04
    what: Use @tailwindcss/typography plugin
    why: Industry standard for styling markdown prose content
    alternatives: Custom markdown styles (more maintenance, less comprehensive)

metrics:
  duration: 5 minutes
  completed: 2026-02-08
---

# Phase 11 Plan 01: Dark Mode Infrastructure & Markdown Dependencies Summary

**One-liner:** Set up next-themes ThemeProvider with system preference detection and installed react-markdown ecosystem with Tailwind typography plugin.

## What Was Built

### ThemeProvider Infrastructure

1. **Created ThemeProvider component** (`components/theme/theme-provider.tsx`)
   - Client component wrapper around next-themes
   - Passes through all ThemeProviderProps
   - Enables `useTheme()` hook usage across app

2. **Integrated into root layout** (`app/layout.tsx`)
   - Wraps entire app (AchievementToastProvider + children)
   - Props: `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`
   - Removed hardcoded `className="dark"` from html element
   - Added `suppressHydrationWarning` to html element (prevents React warnings from next-themes script injection)

3. **Dark mode behavior**
   - On first visit: Matches OS/browser preference (system theme)
   - User can toggle via ThemeToggle component (already exists in codebase)
   - Theme persists across page refreshes via localStorage
   - No FOUC (flash of unstyled content) due to next-themes blocking script + disableTransitionOnChange

### Markdown Rendering Dependencies

1. **Installed core packages**
   - `react-markdown@10.1.0`: Core markdown renderer
   - `remark-gfm@4.0.1`: GitHub Flavored Markdown (tables, task lists, strikethrough)
   - `rehype-sanitize@6.0.0`: XSS protection for user-generated markdown
   - `react-syntax-highlighter@16.1.0`: Code block syntax highlighting
   - `@types/react-syntax-highlighter@15.5.13`: TypeScript types

2. **Installed Tailwind plugin**
   - `@tailwindcss/typography@0.5.19`: Provides `prose` and `prose-invert` classes
   - Configured in `tailwind.config.ts` plugins array (alongside tailwindcss-animate)
   - Enables rich typography styling for markdown content

## Deviations from Plan

### Auto-fixed Issues (Rule 1: Bugs, Rule 2: Missing Critical Functionality)

**1. [Rule 1 - Bug] Fixed react-syntax-highlighter import paths**
- **Found during:** Task 1 (npm run build)
- **Issue:** TypeScript error: `Module '"react-syntax-highlighter/dist/cjs/prism"' has no exported member 'Prism'`
- **Root cause:** Incorrect import paths using CJS dist instead of ESM
- **Fix:** Changed imports in `components/chat/code-block.tsx`:
  ```diff
  - import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/cjs/prism';
  - import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism/vsc-dark-plus';
  - import { vs } from 'react-syntax-highlighter/dist/cjs/styles/prism/vs';
  + import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
  + import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
  + import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
  ```
- **Files modified:** `components/chat/code-block.tsx`
- **Commit:** 1fdb01f

**2. [Rule 1 - Bug] Fixed ReactMarkdown v9+ component prop destructuring**
- **Found during:** Task 1 (npm run build after fixing code-block)
- **Issue:** TypeScript errors:
  - `Property 'className' does not exist on type 'IntrinsicAttributes & Readonly<Options>'`
  - `Property 'inline' does not exist on type 'ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps'`
- **Root cause:** ReactMarkdown v9+ changed API:
  - `<ReactMarkdown className="...">` no longer supported (use wrapper div)
  - Component functions receive single `props` object (not destructured params)
- **Fix:** In `components/chat/message-content.tsx`:
  1. Moved `className="prose prose-sm dark:prose-invert max-w-none"` from ReactMarkdown to wrapper div
  2. Changed all component functions from destructured params to single props object:
     ```diff
     - code({ node, inline, className, children, ...props }) {
     + code(props) {
     +   const { node, className, children, ...rest } = props;
     ```
  3. Applied same pattern to `a`, `p`, `table`, `th`, `td`, `pre` components
- **Files modified:** `components/chat/message-content.tsx`
- **Commit:** 1fdb01f

**3. [Rule 1 - Bug] Fixed MessageContent props in telegram-chat-v2**
- **Found during:** Task 1 (npm run build after fixing message-content)
- **Issue:** TypeScript error: `Property 'textColor' does not exist on type 'IntrinsicAttributes & MessageContentProps'`
- **Root cause:** `MessageContent` only accepts `content` and `isUser` props, not `textColor`
- **Fix:** In `components/chat/telegram-chat-v2.tsx`:
  ```diff
  - <div className="px-4 py-3">
  -   <MessageContent
  -     content={message.content}
  -     textColor={isUser && 'senderText' in theme ? theme.senderText : theme.textPrimary}
  -   />
  - </div>
  + <div className="px-4 py-3" style={{ color: isUser && 'senderText' in theme ? theme.senderText : theme.textPrimary }}>
  +   <MessageContent
  +     content={message.content}
  +     isUser={isUser}
  +   />
  + </div>
  ```
- **Files modified:** `components/chat/telegram-chat-v2.tsx`
- **Commit:** 1fdb01f

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Install packages and configure Tailwind typography plugin | 1fdb01f | package.json, package-lock.json, tailwind.config.ts, components/chat/code-block.tsx, components/chat/message-content.tsx, components/chat/telegram-chat-v2.tsx |
| 2 | Create ThemeProvider and wire into root layout | f17cfe9 | components/theme/theme-provider.tsx, app/layout.tsx |

## Verification Results

### Must-Haves Verification

**Truths:**
- ✅ Theme switches between light and dark when toggled (ThemeProvider with attribute="class" enables theme-toggle.tsx)
- ✅ On first visit, theme matches OS/browser preference (defaultTheme="system" + enableSystem)
- ✅ Theme persists across page refreshes via localStorage (next-themes built-in)
- ✅ No FOUC on page load (suppressHydrationWarning + disableTransitionOnChange + next-themes blocking script)

**Artifacts:**
- ✅ `components/theme/theme-provider.tsx` exists, provides ThemeProvider wrapper, contains "ThemeProvider" and "next-themes" imports
- ✅ `app/layout.tsx` wraps children with ThemeProvider, contains "ThemeProvider" import and usage
- ✅ `tailwind.config.ts` contains "typography" in plugins array

**Key Links:**
- ✅ `app/layout.tsx` imports from `components/theme/theme-provider.tsx` and wraps children
- ✅ `app/layout.tsx` uses next-themes via ThemeProvider with `attribute="class"` pattern

### Build Verification

```bash
$ npm run build
✓ Compiled successfully in 6.8s
✓ Running TypeScript ...
✓ Generating static pages using 7 workers (77/77) in 483.5ms
✓ Finalizing page optimization ...
```

All verifications passed.

## Next Phase Readiness

### Unblocks

- **Plan 11-02 (Theme Toggle Implementation):** ThemeProvider is in place, `useTheme()` hook is available
- **Plan 11-03 (Markdown Rendering):** All packages installed, typography plugin configured, prose classes available

### Blockers/Concerns

None. Infrastructure is ready for:
1. Theme toggle UI implementation
2. Markdown rendering in chat messages
3. Dark mode styles audit (hard-coded colors)

### Known Issues

None. All three pre-existing bugs were auto-fixed:
1. Code-block import paths (ESM instead of CJS)
2. ReactMarkdown v9+ API changes (className removal, component props destructuring)
3. MessageContent invalid textColor prop (moved to wrapper div style)

## Learnings

1. **ReactMarkdown v9+ breaking changes:** Major API changes require careful migration:
   - No className prop on ReactMarkdown itself (use wrapper)
   - Component functions receive single props object (not destructured)
   - Existing codebases using older patterns will break on upgrade

2. **react-syntax-highlighter imports:** Use ESM dist paths (`react-syntax-highlighter` and `react-syntax-highlighter/dist/esm/styles/prism`), not CJS paths

3. **next-themes best practices:**
   - Always use `suppressHydrationWarning` on html element
   - Use `disableTransitionOnChange` to prevent FOUC flicker
   - Use `defaultTheme="system"` for best UX (respects OS preference)

## Self-Check: PASSED

**Files created:**
```bash
✓ components/theme/theme-provider.tsx
```

**Commits exist:**
```bash
✓ 1fdb01f (chore(11-01): install markdown packages and configure Tailwind typography)
✓ f17cfe9 (feat(11-01): create ThemeProvider and wire into root layout)
```
