---
phase: 56-hitl-integration
plan: 01
subsystem: generation
tags: [mastra, workflow, hitl, suspend-resume, multi-source, slides]

# Dependency graph
requires:
  - phase: 51-blueprint-resolver
    provides: resolveBlueprint() for DeckStructure -> GenerationBlueprint
  - phase: 52-multi-source-slide-assembler
    provides: buildMultiSourcePlan() + assembleMultiSourceDeck() for deck assembly
  - phase: 53-modification-planner
    provides: planSlideModifications() for element-level content planning
  - phase: 54-section-matcher
    provides: selectSlidesForBlueprint() with metadata scoring
  - phase: 55-modification-executor
    provides: executeModifications() for text replacement via Slides API
provides:
  - 7-step structure-driven HITL workflow with 3 suspend points
  - structureDrivenWorkflow export registered in Mastra instance
  - Skeleton/Lowfi/Highfi stage suspend payloads matching frontend expectations
affects: [57-touch-routing-and-fallback]

# Tech tracking
tech-stack:
  added: []
  patterns: [structure-driven-hitl-workflow, thin-orchestration-wrappers]

key-files:
  created:
    - apps/agent/src/generation/structure-driven-workflow.ts
    - apps/agent/src/generation/__tests__/structure-driven-workflow.test.ts
  modified:
    - apps/agent/src/mastra/index.ts

key-decisions:
  - "Cast touchType/artifactType to DeckStructureKey types at workflow boundary to maintain type safety with string-based Mastra input schemas"
  - "buildMultiSourcePlan requires allSlidesByPresentation Map from Google Slides API read, not a flat array -- workflow fetches this per-presentation before planning"
  - "Low-fi request_changes throws RESTART_REQUIRED error for Phase 57 routing to catch and re-invoke, since Mastra workflows do not natively support loopback"
  - "Highfi rejection path skips modification execution and returns deck as-is with hitlStage set to ready"

patterns-established:
  - "Structure-driven workflow steps export individual step objects for direct unit testing"
  - "Candidates Map serialized to plain object between steps since Mastra serializes step output as JSON"

requirements-completed: [FR-7.1, FR-7.2, FR-7.3, FR-7.4, FR-7.5, FR-7.6, FR-7.7]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 56 Plan 01: HITL Integration Summary

**3-stage HITL workflow (skeleton/lowfi/highfi) orchestrating Phase 51-55 modules with Mastra suspend/resume and per-slide modification previews**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T11:37:47Z
- **Completed:** 2026-03-09T11:43:10Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- 7-step structure-driven workflow with 3 suspend points for seller review at each fidelity stage
- Skeleton suspend payload includes sections with thumbnailUrl and matchRationale per section (FR-7.1)
- Skeleton resume threads refined/swapped slide selections downstream (FR-7.2)
- Low-fi suspend includes presentationId and driveUrl after multi-source assembly (FR-7.3)
- Low-fi resume handles request_changes with restart signal (FR-7.4)
- High-fi suspend includes per-slide modification summary with element change previews (FR-7.5)
- High-fi resume executes approved modifications via Phase 55 executor (FR-7.6)
- 11 unit tests covering all step behaviors, suspend payloads, and resume contracts

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for structure-driven workflow steps** - `2ac2017` (test)
2. **Task 2: Implement structure-driven workflow and register in Mastra** - `c7dc6ba` (feat)

## Files Created/Modified
- `apps/agent/src/generation/structure-driven-workflow.ts` - 7-step HITL workflow with thin orchestration wrappers
- `apps/agent/src/generation/__tests__/structure-driven-workflow.test.ts` - 11 unit tests covering all steps
- `apps/agent/src/mastra/index.ts` - Workflow registration as "structure-driven-workflow"

## Decisions Made
- Cast touchType/artifactType to DeckStructureKey types at workflow boundary for type safety
- Low-fi request_changes throws RESTART_REQUIRED error (Phase 57 catches and re-invokes)
- Highfi rejection skips modifications, returns deck as-is
- Candidates Map serialized to plain object between steps (Mastra JSON serialization)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed buildMultiSourcePlan signature mismatch**
- **Found during:** Task 2 (Implementation)
- **Issue:** Plan interfaces suggested `allPrimarySlideIds: string[]` but actual signature is `allSlidesByPresentation: Map<string, string[]>`
- **Fix:** Added per-presentation slide ID fetch via Google Slides API read before calling buildMultiSourcePlan
- **Files modified:** apps/agent/src/generation/structure-driven-workflow.ts
- **Verification:** Tests pass, TypeScript compiles
- **Committed in:** c7dc6ba (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type narrowing for DeckStructureKey**
- **Found during:** Task 2 (Implementation)
- **Issue:** Mastra input schema uses z.string() for touchType/artifactType, but resolveBlueprint expects literal union types
- **Fix:** Added explicit cast to DeckStructureKey types at workflow boundary
- **Files modified:** apps/agent/src/generation/structure-driven-workflow.ts
- **Verification:** npx tsc --noEmit passes for workflow file
- **Committed in:** c7dc6ba (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct type safety and API contract alignment. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Structure-driven workflow fully functional and registered in Mastra
- Ready for Phase 57 touch routing to dispatch to this workflow when DeckStructure exists
- Phase 57 routing should catch RESTART_REQUIRED errors from low-fi request_changes and re-invoke

---
*Phase: 56-hitl-integration*
*Completed: 2026-03-09*
