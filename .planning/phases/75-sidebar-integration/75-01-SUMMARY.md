---
phase: 75-sidebar-integration
plan: 01
subsystem: ui
tags: [sidebar, navigation, lucide-react, next-js, vitest]

# Dependency graph
requires:
  - phase: 73-video-playback
    provides: TutorialView model with watched field used for unwatched count calculation
provides:
  - Tutorials nav item in global sidebar with reactive blue New badge
  - GET /tutorials/unwatched-count agent endpoint (total minus watched by user)
  - fetchTutorialUnwatchedCount helper in api-client.ts
  - /api/tutorials/unwatched-count Next.js authenticated route
affects: [sidebar, tutorials browsing, navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL-dispatch fetch mock pattern in sidebar tests (route-specific responses for multiple fetch calls)
    - total-minus-watched unwatched count pattern (avoids undercounting never-started tutorials)
    - Blue informational badge vs red urgency badge color convention

key-files:
  created:
    - apps/web/src/app/(authenticated)/api/tutorials/unwatched-count/route.ts
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/components/sidebar.tsx
    - apps/web/src/components/__tests__/sidebar.test.tsx

key-decisions:
  - "Blue badge (bg-blue-500) for Tutorials New pill/dot vs red for Action Required urgency — informational vs urgent color convention"
  - "total Tutorial.count() minus TutorialView.count(watched:true) ensures never-started tutorials are counted as unwatched"
  - "Sidebar fetches /api/tutorials/unwatched-count on every pathname change alongside existing /api/actions/count"

patterns-established:
  - "URL-dispatch fetch mock: vi.spyOn with String(url).includes() to dispatch per-URL responses when sidebar makes multiple fetch calls"
  - "Badge color convention: bg-red-500 for urgency (Action Required), bg-blue-500 for informational (Tutorials New)"

requirements-completed: [BROWSE-01]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 75 Plan 01: Sidebar Integration Summary

**Tutorials nav item with GraduationCap icon and reactive blue New badge added to global sidebar, backed by agent /tutorials/unwatched-count endpoint using total-minus-watched approach**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-20T22:28:25Z
- **Completed:** 2026-03-20T22:36:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added GET /tutorials/unwatched-count agent endpoint (total Tutorial count minus TutorialView watched:true count)
- Added fetchTutorialUnwatchedCount helper in api-client.ts mirroring fetchActionCount pattern
- Created /api/tutorials/unwatched-count authenticated Next.js route
- Updated sidebar.tsx with GraduationCap Tutorials nav item, unwatchedCount state, and dual-mode blue badge
- Added BROWSE-01 test describe block (5 tests) and updated existing fetch mocks to URL-dispatch pattern (29 sidebar tests all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent endpoint + api-client helper for unwatched count** - `014c4c6` (feat)
2. **Task 2: Web API route, sidebar integration, and updated tests** - `3640f93` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/index.ts` - Added GET /tutorials/unwatched-count route after /tutorials/:id/watched
- `apps/web/src/lib/api-client.ts` - Added fetchTutorialUnwatchedCount export after fetchActionCount
- `apps/web/src/app/(authenticated)/api/tutorials/unwatched-count/route.ts` - New authenticated Next.js route returning { count: number }
- `apps/web/src/components/sidebar.tsx` - Added GraduationCap import, Tutorials navItem, unwatchedCount state/effect, and blue badge JSX
- `apps/web/src/components/__tests__/sidebar.test.tsx` - Added BROWSE-01 describe block (5 tests) and updated existing fetch mocks to URL-dispatch pattern

## Decisions Made
- Used blue (bg-blue-500) for Tutorials badge vs red (bg-red-500) for Action Required — informational vs urgency distinction as established in plan
- Used total - watchedCount approach (not counting watched:false rows directly) to avoid undercounting tutorials with no TutorialView row

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tutorials nav item is live and discoverable from the global sidebar
- Badge signals new content to users on every page navigation
- Ready for any additional sidebar or tutorial-related phases

---
*Phase: 75-sidebar-integration*
*Completed: 2026-03-20*
