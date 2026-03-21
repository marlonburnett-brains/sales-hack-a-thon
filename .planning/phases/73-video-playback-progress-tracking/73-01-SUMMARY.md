---
phase: 73-video-playback-progress-tracking
plan: 01
subsystem: api
tags: [prisma, tutorialview, progress-tracking, tdd, vitest]

# Dependency graph
requires:
  - phase: 72-tutorial-browsing
    provides: TutorialView model, GET /tutorials route, TutorialBrowseCard type
provides:
  - PATCH /tutorials/:id/progress route (upserts lastPosition)
  - PATCH /tutorials/:id/watched route (upserts watched + watchedAt + lastPosition)
  - TutorialBrowseCard.lastPosition field in api-client.ts
  - Failing TDD stubs for TutorialVideoPlayer component (plan 02 will green these)
affects:
  - 73-02-video-player-component
  - Any consumer of TutorialBrowseCard type

# Tech tracking
tech-stack:
  added: []
  patterns:
    - viewsMap pattern: Map<tutorialId, {watched, lastPosition}> replaces watchedSet in GET /tutorials
    - tutorialView.upsert with compound unique key tutorialId_userId
    - TDD RED/GREEN cycle for route contracts

key-files:
  created:
    - apps/agent/src/mastra/__tests__/tutorial-progress-routes.test.ts
    - apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "viewsMap replaces watchedSet in GET /tutorials: single Map carries both watched and lastPosition, avoids double lookups"
  - "PATCH routes use z.object({ lastPosition: z.number() }) body validation with zod (already in scope)"
  - "TutorialVideoPlayer stubs written as RED tests that reference non-existent module — will turn GREEN when Plan 02 creates the component"

patterns-established:
  - "Progress upsert pattern: tutorialId_userId compound unique key for idempotent progress saves"
  - "Route auth guard: getVerifiedUserId returns null/undefined → 401, no DB calls"

requirements-completed: [PLAY-01, PLAY-03, TRACK-01, TRACK-02, TRACK-03, TRACK-04]

# Metrics
duration: 10min
completed: 2026-03-21
---

# Phase 73 Plan 01: Progress Route API and TDD Scaffolds Summary

**Two PATCH routes (progress + watched) added to agent with prisma.tutorialView.upsert, GET /tutorials extended with lastPosition per card via viewsMap, and RED TDD stubs written for the video player component**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-21T00:27:07Z
- **Completed:** 2026-03-21T00:37:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PATCH /tutorials/:id/progress and PATCH /tutorials/:id/watched routes registered in agent index.ts with auth guard, zod body validation, and tutorialView.upsert using the tutorialId_userId compound key
- GET /tutorials handler updated to use viewsMap (Map<tutorialId, {watched, lastPosition}>) so lastPosition is included in every TutorialBrowseCard
- TutorialBrowseCard.lastPosition: number added to api-client.ts interface
- 4 TDD test cases written and confirmed RED (routes not registered yet), then GREEN after implementation
- TutorialVideoPlayer stub tests written RED (component module doesn't exist yet), waiting for Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing test scaffolds** - `ec3160e` (test)
2. **Task 2: Add PATCH routes and extend GET /tutorials** - `78767bd` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/__tests__/tutorial-progress-routes.test.ts` - 4-test TDD suite for PATCH /progress and /watched routes (RED then GREEN)
- `apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx` - 5-test stub suite for TutorialVideoPlayer (RED, waiting for Plan 02)
- `apps/agent/src/mastra/index.ts` - Added PATCH /tutorials/:id/progress, PATCH /tutorials/:id/watched; replaced watchedSet with viewsMap in GET /tutorials
- `apps/web/src/lib/api-client.ts` - Added lastPosition: number to TutorialBrowseCard interface

## Decisions Made
- viewsMap replaces watchedSet: carrying both watched and lastPosition in one Map avoids scanning views twice and keeps the tutorialCards mapping clean
- PATCH routes use the already-imported z (zod) from the top of index.ts — no new dependency needed
- Video player stub tests reference the future component path `@/components/tutorials/tutorial-video-player` so Plan 02 just needs to create that file to turn them GREEN

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 73-02 can now build TutorialVideoPlayer using the PATCH routes and lastPosition field
- The RED video player tests in `apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx` define the component API (gcsUrl, initialWatched, initialLastPosition, prevTutorial, nextTutorial props)
- No blockers

## Self-Check: PASSED

- FOUND: apps/agent/src/mastra/__tests__/tutorial-progress-routes.test.ts
- FOUND: apps/web/src/components/tutorials/__tests__/tutorial-video-player.test.tsx
- FOUND: .planning/phases/73-video-playback-progress-tracking/73-01-SUMMARY.md
- FOUND commit ec3160e: test(73-01): add failing TDD scaffolds
- FOUND commit 78767bd: feat(73-01): add PATCH routes and extend GET /tutorials

---
*Phase: 73-video-playback-progress-tracking*
*Completed: 2026-03-21*
