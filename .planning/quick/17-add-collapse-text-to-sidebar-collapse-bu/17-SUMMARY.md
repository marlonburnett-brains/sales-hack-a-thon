---
phase: quick-17
plan: 01
subsystem: web-ui
tags: [sidebar, ux, collapse, user-nav]
dependency_graph:
  requires: []
  provides: [sidebar-collapse-text, inline-user-info]
  affects: [sidebar, user-nav]
tech_stack:
  added: []
  patterns: [conditional-prop-rendering, truncated-inline-text]
key_files:
  created: []
  modified:
    - apps/web/src/components/sidebar.tsx
    - apps/web/src/components/user-nav.tsx
    - apps/web/src/components/__tests__/sidebar.test.tsx
decisions:
  - Removed DropdownMenuLabel from user-nav dropdown since name/email now show inline
  - Added AtlusDeckLogo mock to sidebar tests (was missing, blocking test execution)
metrics:
  duration: 2min
  completed: 2026-03-09
  tasks_completed: 3
  tasks_total: 3
---

# Quick Task 17: Add Collapse Text to Sidebar and Inline User Info

Collapse button shows "Collapse" text label next to icon when expanded; user name and email display inline next to avatar in sidebar bottom section.

## What Changed

### Sidebar (sidebar.tsx)
- Collapse/expand button now shows "Collapse" text + PanelLeftClose icon when expanded
- When collapsed: icon-only with title="Expand" tooltip
- Button styled to match nav item pattern (items-center gap-3 px-3 py-2 text-sm)
- Passes `collapsed` prop to UserNav component

### UserNav (user-nav.tsx)
- Accepts optional `collapsed` prop
- When expanded: shows user name (truncated, text-sm font-medium) and email (truncated, text-xs) inline next to avatar
- When collapsed: avatar-only display
- Removed DropdownMenuLabel block (name/email no longer needed in dropdown)
- Dropdown retains Connect Google and Sign out items
- Button uses w-full with hover:bg-slate-50 when expanded

### Tests (sidebar.test.tsx)
- Added AtlusDeckLogo mock (was missing, caused test suite failure)
- Updated UserNav mock to accept collapsed prop and render user-info conditionally
- 4 new tests: Collapse text visible/hidden, user info visible/hidden based on collapsed state
- All 24 tests passing (20 existing + 4 new)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing AtlusDeckLogo mock to test file**
- Found during: Task 1 verification
- Issue: sidebar.tsx imports AtlusDeckLogo but test file had no mock, causing ERR_MODULE_NOT_FOUND
- Fix: Added vi.mock for @/components/atlusdeck-logo returning a simple SVG element
- Files modified: apps/web/src/components/__tests__/sidebar.test.tsx
- Commit: 3b75acd

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3b75acd | feat(quick-17): add Collapse text label to sidebar toggle button |
| 2 | f408d1b | feat(quick-17): show user name and email inline next to avatar when expanded |
| 3 | 6d71df7 | test(quick-17): add tests for collapse text label and inline user info |

## Self-Check: PASSED
