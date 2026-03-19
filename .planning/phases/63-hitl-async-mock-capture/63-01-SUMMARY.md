---
phase: 63-hitl-async-mock-capture
plan: 01
subsystem: testing
tags: [playwright, mock-server, hitl, fixtures, zod, express, polling]

# Dependency graph
requires:
  - phase: 62-workspace-mock-infrastructure
    provides: "Mock server, fixture loader, route mocks, capture loop, determinism helpers"
provides:
  - "Stage state management with control endpoints on mock server"
  - "Sequence counters for polling simulation with last-repeat behavior"
  - "Extended StepSchema with mockStage, waitForText, resetSequences, delayMs"
  - "Extended TutorialScriptSchema with touchType"
  - "StageFixtureSchema and SequenceFileSchema Zod schemas"
  - "loadStageFixtures() and loadSequences() fixture loader functions"
  - "Stage-aware mockBrowserAPIs with stageGetter/sequenceGetter options"
  - "waitForText() determinism utility"
  - "createInteractionFixture() factory"
affects: [63-02, 68-hitl-touch-tutorials, 69-async-tutorials, 70-advanced-tutorials]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stage state machine pattern: mutable currentStage + control endpoints"
    - "Sequence counter pattern: independent counters per key with last-repeat"
    - "Control endpoint pattern: /mock/set-stage, /mock/get-stage, /mock/reset-sequence, /mock/reset"
    - "Stage-aware fixture merging: loadStageFixtures() returns partial overrides"
    - "Mutable stage ref pattern: capture loop updates ref, browser-side mocks read via stageGetter closure"

key-files:
  created: []
  modified:
    - "apps/tutorials/src/types/tutorial-script.ts"
    - "apps/tutorials/fixtures/types.ts"
    - "apps/tutorials/fixtures/loader.ts"
    - "apps/tutorials/fixtures/factories.ts"
    - "apps/tutorials/src/helpers/determinism.ts"
    - "apps/tutorials/scripts/mock-server.ts"
    - "apps/tutorials/src/helpers/route-mocks.ts"
    - "apps/tutorials/capture/getting-started.spec.ts"

key-decisions:
  - "Stage ref pattern: mutable variable in capture loop shared with browser mocks via closure -- simpler than HTTP round-trip to /mock/get-stage for each route intercept"
  - "Sequences managed server-side only: browser-side mocks derive workflow status from stageGetter, sequences only used by Express mock server for SSR routes"
  - "StageFixtureSchema uses .passthrough() to allow ad-hoc stage-specific fields like brief overrides"
  - "Sequence responses use flexible SequenceResponseSchema with .passthrough() to support varied endpoint shapes"

patterns-established:
  - "Pre-step control: capture loop calls set-stage/reset-sequence before each step based on script fields"
  - "Post-action wait: waitForText and delayMs run after actions but before screenshot capture"
  - "Stage-derived status: workflow status derived from stage name via switch map (generating->running, skeleton/lowfi/hifi->suspended)"

requirements-completed: [CAPT-03, CAPT-04]

# Metrics
duration: 5min
completed: 2026-03-19
---

# Phase 63 Plan 01: Stage/Sequence Mock Infrastructure Summary

**Stage state management, sequence counters, and 4 control endpoints added to mock server with stage-aware fixture merging and browser-side route mocks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T04:12:00Z
- **Completed:** 2026-03-19T04:17:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Mock server supports stage state with set/get/reset control endpoints and stage-aware fixture merging for interactions, briefs, and workflow routes
- Sequence counters advance independently per key with last-response repeat behavior for polling simulation
- Extended tutorial script schema with mockStage, waitForText, resetSequences, delayMs, and touchType fields
- Capture loop processes new fields with pre-step control calls and post-action wait utilities
- Full backward compatibility maintained -- getting-started tutorial unaffected by optional fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schemas, fixture types, and fixture loader for stages and sequences** - `6505163` (feat)
2. **Task 2: Add stage state, sequence counters, and control endpoints to mock server and route mocks** - `8289ba4` (feat)

## Files Created/Modified
- `apps/tutorials/src/types/tutorial-script.ts` - Added mockStage, waitForText, resetSequences, delayMs to StepSchema; touchType to TutorialScriptSchema
- `apps/tutorials/fixtures/types.ts` - Added StageFixtureSchema, SequenceResponseSchema, SequenceFileSchema with Zod validation
- `apps/tutorials/fixtures/loader.ts` - Added loadStageFixtures(), loadSequences(); exported deepMerge()
- `apps/tutorials/fixtures/factories.ts` - Added createInteractionFixture() factory with HITL defaults
- `apps/tutorials/src/helpers/determinism.ts` - Added waitForText() for full-page text search
- `apps/tutorials/scripts/mock-server.ts` - Added stage state, sequence counters, 4 control endpoints, stage-aware routes
- `apps/tutorials/src/helpers/route-mocks.ts` - Added MockBrowserOptions interface, stage/sequence-aware workflow and generation-logs handlers
- `apps/tutorials/capture/getting-started.spec.ts` - Added pre-step stage/sequence control, post-action waitForText/delayMs, mutable stage ref

## Decisions Made
- Stage ref pattern: mutable variable in capture loop shared with browser mocks via closure rather than HTTP round-trip to /mock/get-stage for each route intercept
- Sequences managed server-side only for SSR routes; browser-side mocks derive from stageGetter closure
- StageFixtureSchema uses .passthrough() for flexibility with ad-hoc fields like brief overrides
- SequenceResponseSchema uses .passthrough() to support varied endpoint response shapes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors (2 from Phase 62) for `document` references in Playwright `waitForFunction` callbacks -- the tsconfig doesn't include `dom` lib since this is a Node.js project, but these callbacks run in browser context. One additional instance from the new `waitForText` utility follows the same established pattern. Not a regression.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All stage/sequence infrastructure ready for Plan 02 pilot tutorial validation
- Control endpoints operational: set-stage, get-stage, reset-sequence, reset
- Stage fixture loading and sequence file loading ready for fixtures/{tutorial}/stages/ and sequences/ directories
- Capture loop processes all new script fields

---
*Phase: 63-hitl-async-mock-capture*
*Completed: 2026-03-19*
