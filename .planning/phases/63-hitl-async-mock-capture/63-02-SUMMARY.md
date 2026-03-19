---
phase: 63-hitl-async-mock-capture
plan: 02
subsystem: testing
tags: [playwright, hitl, fixtures, capture, mock-server, screenshots, touch-4]

# Dependency graph
requires:
  - phase: 63-hitl-async-mock-capture-01
    provides: "Stage state management, sequence counters, control endpoints, stage-aware fixture merging"
provides:
  - "Touch 4 HITL pilot fixtures: script, overrides, 6 stage files, 1 sequence file"
  - "Touch 4 HITL capture spec producing 6 deterministic screenshots"
  - "End-to-end validation of Phase 63 stage/sequence infrastructure"
affects: [68-hitl-touch-tutorials, 69-async-tutorials, 70-advanced-tutorials]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage fixture content progression: skeleton (bullet outlines) -> lowfi (rough prose) -> hifi (polished final)"
    - "Catch-all API route registered first in mockBrowserAPIs for correct Playwright route priority"
    - "Empty interactions array for idle stage to avoid false fallback UI"

key-files:
  created:
    - "apps/tutorials/fixtures/touch-4-hitl/script.json"
    - "apps/tutorials/fixtures/touch-4-hitl/overrides.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/idle.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/generating.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/skeleton.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/lowfi.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/hifi.json"
    - "apps/tutorials/fixtures/touch-4-hitl/stages/completed.json"
    - "apps/tutorials/fixtures/touch-4-hitl/sequences/workflow-status.json"
    - "apps/tutorials/capture/touch-4-hitl.spec.ts"
  modified:
    - "apps/tutorials/playwright.config.ts"
    - "apps/tutorials/src/helpers/determinism.ts"
    - "apps/tutorials/src/helpers/route-mocks.ts"

key-decisions:
  - "Playwright outputDir changed to ./test-results to prevent Playwright from cleaning shared screenshot output directory"
  - "Catch-all API route registered first in mockBrowserAPIs since Playwright checks routes in reverse registration order"
  - "Idle stage returns empty interactions array instead of null-field interaction to avoid false 'previous generation' fallback"
  - "Next.js dev indicator hidden via CSS injection in determinism helper"

patterns-established:
  - "Touch 4 tutorial as reference implementation for multi-stage HITL capture"
  - "Stage content quality progression pattern: skeleton/lowfi/hifi with realistic AI output"

requirements-completed: [CAPT-03, CAPT-04]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 63 Plan 02: Touch 4 HITL Pilot Fixtures and Capture Summary

**Touch 4 HITL pilot tutorial with 6 stage fixtures, workflow polling sequences, and Playwright capture spec producing 6 deterministic screenshots validating the full Phase 63 infrastructure**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-19T04:50:00Z
- **Completed:** 2026-03-19T05:12:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created complete Touch 4 HITL tutorial fixtures with realistic quality-progression content across 6 stages (idle, generating, skeleton, lowfi, hifi, completed)
- Playwright capture spec produces 6 deterministic screenshots, one per HITL stage, with correct stage-specific content visible
- Getting Started tutorial regression-free: still produces 8 screenshots
- End-to-end validation confirmed: stage control endpoints, sequence counters, waitForText, and stage-aware fixture loading all work together

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Touch 4 HITL pilot fixtures and capture spec** - `531c2d6` (feat)
2. **Task 2: Verify end-to-end HITL capture** - `b7250ea` (fix)

## Files Created/Modified
- `apps/tutorials/fixtures/touch-4-hitl/script.json` - 6-step tutorial script with mockStage and waitForText at each step
- `apps/tutorials/fixtures/touch-4-hitl/overrides.json` - Base fixture overrides for Touch 4 tutorial context
- `apps/tutorials/fixtures/touch-4-hitl/stages/idle.json` - Idle stage: empty interactions array
- `apps/tutorials/fixtures/touch-4-hitl/stages/generating.json` - Generating stage: in-progress status
- `apps/tutorials/fixtures/touch-4-hitl/stages/skeleton.json` - Skeleton stage: bullet-outline content for proposal sections
- `apps/tutorials/fixtures/touch-4-hitl/stages/lowfi.json` - Low-fi stage: rough prose paragraphs with TODO markers
- `apps/tutorials/fixtures/touch-4-hitl/stages/hifi.json` - Hi-fi stage: polished professional content
- `apps/tutorials/fixtures/touch-4-hitl/stages/completed.json` - Completed stage: output refs to mock Google Docs/Slides URLs
- `apps/tutorials/fixtures/touch-4-hitl/sequences/workflow-status.json` - 3 ordered polling responses (running -> running -> suspended)
- `apps/tutorials/capture/touch-4-hitl.spec.ts` - Playwright capture spec with stage control and waitForText
- `apps/tutorials/playwright.config.ts` - Changed outputDir to ./test-results
- `apps/tutorials/src/helpers/determinism.ts` - Hide Next.js dev indicator portal
- `apps/tutorials/src/helpers/route-mocks.ts` - Fixed catch-all route registration order

## Decisions Made
- Changed Playwright outputDir from ./output to ./test-results because Playwright cleans its outputDir before each run, which was deleting screenshots from other tutorials
- Registered catch-all API route first in mockBrowserAPIs because Playwright checks routes in reverse registration order -- the catch-all registered last was intercepting all /api/* requests before specific handlers
- Idle stage returns empty interactions array (not an interaction with null fields) to avoid triggering the "previous generation did not complete" fallback in the UI
- Added CSS to hide Next.js dev indicator (nextjs-portal) from screenshots for deterministic capture

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Playwright outputDir cleaning shared output**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** Playwright was cleaning ./output before each capture run, deleting screenshots from other tutorials
- **Fix:** Changed outputDir to ./test-results so Playwright cleanup targets a non-screenshot directory
- **Files modified:** apps/tutorials/playwright.config.ts
- **Verification:** Both tutorials produce correct screenshot counts after fix

**2. [Rule 1 - Bug] Catch-all API route intercepting specific handlers**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** Playwright checks routes in reverse registration order; catch-all registered last was intercepting all /api/* requests before specific handlers like workflow status could run
- **Fix:** Moved catch-all route to be registered first so it has lowest priority
- **Files modified:** apps/tutorials/src/helpers/route-mocks.ts
- **Verification:** Workflow status and other specific API routes now respond correctly

**3. [Rule 1 - Bug] waitForText mismatch in script.json**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** step-002 waitForText was "Generating" but actual rendered text is "Generation in progress"
- **Fix:** Updated waitForText to match actual UI text
- **Files modified:** apps/tutorials/fixtures/touch-4-hitl/script.json
- **Verification:** Capture proceeds past step-002 without timeout

**4. [Rule 1 - Bug] Idle stage triggering false fallback UI**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** idle.json returned interaction with null hitlStage/stageContent which triggered "A previous generation did not complete" fallback
- **Fix:** Changed to return empty interactions array
- **Files modified:** apps/tutorials/fixtures/touch-4-hitl/stages/idle.json
- **Verification:** Idle stage shows clean initial state

**5. [Rule 1 - Bug] Next.js dev indicator in screenshots**
- **Found during:** Task 2 (end-to-end verification)
- **Issue:** Next.js dev indicator portal visible in screenshots, breaking determinism
- **Fix:** Added CSS rule to hide nextjs-portal element
- **Files modified:** apps/tutorials/src/helpers/determinism.ts
- **Verification:** Screenshots clean of dev indicators

---

**Total deviations:** 5 auto-fixed (5 bugs)
**Impact on plan:** All fixes necessary for correct end-to-end capture. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 63 fully validated: all stage/sequence infrastructure works end-to-end
- Touch 4 serves as reference implementation for all future HITL tutorial captures
- Patterns established for stage content progression (skeleton/lowfi/hifi) reusable in phases 68-70
- Route mock registration order pattern documented for future tutorials

## Self-Check: PASSED

All 10 created files verified present. Both task commits (531c2d6, b7250ea) verified in git log.

---
*Phase: 63-hitl-async-mock-capture*
*Completed: 2026-03-19*
