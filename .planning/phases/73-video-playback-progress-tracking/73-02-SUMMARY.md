---
phase: 73-video-playback-progress-tracking
plan: "02"
subsystem: ui
tags: [react, nextjs, html5-video, progress-tracking, server-actions, vitest]

# Dependency graph
requires:
  - phase: 73-01
    provides: PATCH /tutorials/:id/progress and /watched routes, lastPosition on TutorialBrowseCard
  - phase: 72-03
    provides: slug page scaffold, listTutorialsAction, TutorialBrowseCard type
provides:
  - TutorialVideoPlayer client component with HTML5 video, 90% watched tracking, 10s interval saves
  - updateTutorialProgressAction and markTutorialWatchedAction server actions
  - Functional /tutorials/[slug] page with dynamic(ssr:false) player import
  - gcsUrl added to TutorialBrowseCard interface and agent GET /tutorials response
affects:
  - future tutorial phases (feedback, resume indicators)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "agentFetch helper for server actions (same pattern as settings-actions.ts)"
    - "dynamic(ssr:false) for client video component loaded in server page"
    - "hasMarkedWatched ref gate prevents duplicate markWatched calls at 90% threshold"
    - "setInterval(10_000) for position saves, cleared on unmount and pause"

key-files:
  created:
    - apps/web/src/components/tutorials/tutorial-video-player.tsx
  modified:
    - apps/web/src/lib/actions/tutorial-actions.ts
    - apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx
    - apps/web/src/lib/api-client.ts
    - apps/agent/src/mastra/index.ts
    - apps/web/src/components/tutorials/__tests__/tutorials-browse-view.test.tsx

key-decisions:
  - "Used dynamicImport alias to avoid name collision with Next.js export const dynamic"
  - "TutorialVideoPlayer props use initialLastPosition (matching test fixture) not lastPosition"
  - "Default export added alongside named export for dynamic import .then(m => m.TutorialVideoPlayer) compatibility"
  - "role=region + aria-label=tutorial video on video container wrapper to satisfy test selector"
  - "gcsUrl added as required field to TutorialBrowseCard (non-breaking additive to API)"

patterns-established:
  - "Component: refs for mutable playback state (interval, hasMarkedWatched) to avoid stale closure"
  - "Server action: void operator for fire-and-forget calls inside client event handlers"
  - "Page: flatMap categories to derive prevTutorial/nextTutorial by index"

requirements-completed: [PLAY-01, PLAY-02, PLAY-03, TRACK-01, TRACK-02, TRACK-03, TRACK-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 73 Plan 02: Video Playback & Progress Tracking Summary

**HTML5 TutorialVideoPlayer with 90%-threshold watched marking, 10s interval position saves, end-screen overlay, and prev/next navigation wired into /tutorials/[slug] via dynamic(ssr:false)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T21:36:03Z
- **Completed:** 2026-03-20T21:41:03Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extended tutorial-actions.ts with updateTutorialProgressAction and markTutorialWatchedAction using the agentFetch pattern
- Built TutorialVideoPlayer client component with auto-seek, 10s interval saves, 90% watched threshold, end-screen overlay, and prev/next navigation links
- Replaced /tutorials/[slug] placeholder with functional dynamic(ssr:false) TutorialVideoPlayer; all 16 tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Add updateTutorialProgressAction and markTutorialWatchedAction** - `8ea1173` (feat)
2. **Task 2: Build TutorialVideoPlayer client component** - `0cf0399` (feat)
3. **Task 3: Replace slug page placeholder with functional dynamic player import** - `4c3b7e5` (feat)

## Files Created/Modified

- `apps/web/src/components/tutorials/tutorial-video-player.tsx` - New "use client" component with HTML5 video, progress tracking, end-screen overlay, prev/next navigation
- `apps/web/src/lib/actions/tutorial-actions.ts` - Extended with agentFetch helper and two new server actions
- `apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx` - Replaced placeholder with TutorialVideoPlayer dynamic import; derives prev/next from sorted tutorial list
- `apps/web/src/lib/api-client.ts` - Added gcsUrl to TutorialBrowseCard interface
- `apps/agent/src/mastra/index.ts` - Added gcsUrl to tutorialCards map in GET /tutorials handler
- `apps/web/src/components/tutorials/__tests__/tutorials-browse-view.test.tsx` - Added gcsUrl and lastPosition to makeTutorial fixture

## Decisions Made

- Used `dynamicImport` alias for `next/dynamic` import to avoid conflict with `export const dynamic = "force-dynamic"` in the same page file
- TutorialVideoPlayer props aligned to test expectations: `initialLastPosition` (not `lastPosition`), `slug` included, default export added
- Added `role="region" aria-label="tutorial video"` to video container wrapper to satisfy `screen.getByRole("region")` in tests
- `gcsUrl` added as required field on TutorialBrowseCard (additive, non-breaking)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prop name mismatch: test expected initialLastPosition not lastPosition**
- **Found during:** Task 2 (Build TutorialVideoPlayer)
- **Issue:** Pre-written test fixture used `initialLastPosition` and the plan spec used `lastPosition`
- **Fix:** Adopted `initialLastPosition` as the prop name throughout component
- **Files modified:** apps/web/src/components/tutorials/tutorial-video-player.tsx
- **Verification:** All 5 tutorial-video-player tests GREEN
- **Committed in:** 0cf0399 (Task 2 commit)

**2. [Rule 1 - Bug] Test uses default import but plan spec exported named export only**
- **Found during:** Task 2 (Build TutorialVideoPlayer)
- **Issue:** Test imports `import TutorialVideoPlayer from "..."` (default import); plan spec only described named export
- **Fix:** Added both named export and `export default TutorialVideoPlayer`
- **Files modified:** apps/web/src/components/tutorials/tutorial-video-player.tsx
- **Verification:** All 5 tutorial-video-player tests GREEN
- **Committed in:** 0cf0399 (Task 2 commit)

**3. [Rule 1 - Bug] Dynamic import name collision with Next.js page export**
- **Found during:** Task 3 (slug page update)
- **Issue:** `import dynamic from "next/dynamic"` conflicted with `export const dynamic = "force-dynamic"` — TypeScript TS2440 error
- **Fix:** Renamed import to `dynamicImport`, used `dynamicImport(...)` for component creation
- **Files modified:** apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx
- **Verification:** tsc reports no errors for slug page file
- **Committed in:** 4c3b7e5 (Task 3 commit)

**4. [Rule 2 - Missing Critical] Test fixture missing required gcsUrl and lastPosition fields**
- **Found during:** Task 3 (after adding gcsUrl to TutorialBrowseCard)
- **Issue:** makeTutorial() in tutorials-browse-view.test.tsx lacked gcsUrl and lastPosition, causing TS2322 errors on all fixture objects
- **Fix:** Added `gcsUrl` and `lastPosition: 0` defaults to makeTutorial() fixture
- **Files modified:** apps/web/src/components/tutorials/__tests__/tutorials-browse-view.test.tsx
- **Verification:** All 16 tutorial component tests GREEN
- **Committed in:** 4c3b7e5 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 prop/export bugs, 1 name collision bug, 1 missing fixture field)
**Impact on plan:** All auto-fixes necessary for TypeScript correctness and test compatibility. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /tutorials/[slug] now has full video playback with progress tracking
- Browse view checkmarks will update in real-time via revalidatePath after markTutorialWatchedAction
- gcsUrl flows from DB through agent to player; GCS CORS must allow Range header for byte-range requests (noted in research)
- FeedbackWidget integration (if planned) should use key={tutorialId} for state reset between tutorials

## Self-Check: PASSED

- FOUND: apps/web/src/components/tutorials/tutorial-video-player.tsx
- FOUND: apps/web/src/lib/actions/tutorial-actions.ts
- FOUND: apps/web/src/app/(authenticated)/tutorials/[slug]/page.tsx
- FOUND: .planning/phases/73-video-playback-progress-tracking/73-02-SUMMARY.md
- FOUND commit: 8ea1173 (tutorial-actions)
- FOUND commit: 0cf0399 (tutorial-video-player)
- FOUND commit: 4c3b7e5 (slug page + api-client + agent)

---
*Phase: 73-video-playback-progress-tracking*
*Completed: 2026-03-20*
