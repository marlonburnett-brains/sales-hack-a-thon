---
phase: 24-token-pool-refresh-lifecycle
plan: 02
subsystem: web-ui
tags: [action-required, sidebar, badge, next.js, server-actions]
requirements_completed: []

# Dependency graph
requires:
  - phase: 24-token-pool-refresh-lifecycle
    plan: 01
    provides: ActionRequired CRUD API routes
provides:
  - Action Required page at /actions with dismiss functionality
  - Sidebar nav item with badge count of unresolved actions
  - API client helpers (fetchActions, fetchActionCount, resolveAction)
  - Next.js API route proxy for action count
affects: [user-experience, action-resolution-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-actions-for-mutations, optimistic-ui-removal, client-server-component-split]

key-files:
  created:
    - apps/web/src/app/(authenticated)/actions/page.tsx
    - apps/web/src/app/(authenticated)/actions/actions-client.tsx
    - apps/web/src/lib/actions/action-required-actions.ts
    - apps/web/src/app/(authenticated)/api/actions/count/route.ts
  modified:
    - apps/web/src/lib/api-client.ts
    - apps/web/src/components/sidebar.tsx

key-decisions:
  - "Server Component page delegates to client ActionsClient for interactive dismiss"
  - "Sidebar fetches count on every navigation via pathname dependency in useEffect"
  - "Count API route proxies to agent fetchActionCount with silent fallback to 0"

patterns-established:
  - "Action Required UI pattern: server component fetch → client component interaction"
  - "Sidebar badge pattern: useEffect fetch on pathname change for dynamic counts"

requirements-completed: [POOL-03, POOL-05]

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 24 Plan 02: Action Required Web UI Summary

**Action Required page with sidebar badge and full-page listing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T17:37:00Z
- **Completed:** 2026-03-06T17:41:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Action Required page at /actions showing pending actions with type icons, descriptions, and dismiss buttons
- Client component with optimistic removal on dismiss
- Server actions wrapping API client calls for mutations
- Sidebar "Action Required" nav item with AlertTriangle icon
- Red badge with count in expanded sidebar, red dot in collapsed sidebar
- Count refreshes on navigation via pathname-dependent useEffect
- Next.js API route proxying to agent fetchActionCount
- Empty state with green check icon when no actions pending

## Task Commits

Each task was committed atomically:

1. **Task 1: API client helpers and Action Required page** - `d6fb145` (feat)
2. **Task 2: Sidebar Action Required nav item with badge** - `349625d` (feat)
3. **Task 3: Human verification checkpoint** - Auto-approved (all 8 artifact checks passed)

## Files Created/Modified
- `apps/web/src/lib/api-client.ts` - Added fetchActions, fetchActionCount, resolveAction, ActionRequiredItem interface
- `apps/web/src/app/(authenticated)/actions/page.tsx` - Server component fetching and rendering actions
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` - Client component with dismiss/optimistic removal
- `apps/web/src/lib/actions/action-required-actions.ts` - Server actions for listing and resolving
- `apps/web/src/app/(authenticated)/api/actions/count/route.ts` - API route proxying count to agent
- `apps/web/src/components/sidebar.tsx` - Added Action Required nav item with badge count

## Decisions Made
- Used server component + client component split following existing codebase patterns
- Badge count fetches on every navigation (pathname change) to catch resolves
- Silent fallback to count=0 on fetch errors to avoid breaking sidebar

## Deviations from Plan
None.

## Issues Encountered
- Pre-existing TypeScript errors in template-card.test.tsx and template-table.test.tsx (ingestionStatus type mismatch) -- not related to this plan's changes.

## User Setup Required
None.

## Next Phase Readiness
- Action Required UI complete and consuming Plan 01's CRUD API routes
- Ready for phase verification

---
*Phase: 24-token-pool-refresh-lifecycle*
*Completed: 2026-03-06*
