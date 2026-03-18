---
phase: 53-modification-planner
plan: 01
subsystem: generation
tags: [llm, gemini, structured-output, google-slides, prisma]

# Dependency graph
requires:
  - phase: 50-foundation-types-interfaces
    provides: ModificationPlan schema, DealContext type, MODIFICATION_PLAN_SCHEMA
provides:
  - "modification-planner AgentId and AGENT_CATALOG entry"
  - "planSlideModifications() function with element filtering, LLM invocation, validation, and fallback"
  - "PlanModificationsParams and PlanModificationsResult interfaces"
affects: [55-modification-executor]

# Tech tracking
tech-stack:
  added: []
  patterns: [element-map-analysis, hallucination-guard-post-validation, graceful-llm-fallback]

key-files:
  created:
    - apps/agent/src/generation/modification-planner.ts
  modified:
    - packages/schemas/agent-catalog.ts

key-decisions:
  - "Override slideId/slideObjectId in post-validation to prevent LLM from returning wrong IDs"
  - "On LLM error, return all elements as unmodified rather than empty arrays for better downstream handling"

patterns-established:
  - "Element filtering pattern: only text/shape with non-empty contentText are modification candidates"
  - "Post-validation hallucination guard: build known-ID set, strip unknown entries, log warnings"

requirements-completed: [FR-5.1, FR-5.2, FR-5.3, FR-5.4, FR-5.5, FR-5.6, NFR-5]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 53 Plan 01: Modification Planner Summary

**LLM-driven modification planner that analyzes slide element maps and deal context to produce surgical per-element ModificationPlans via executeRuntimeProviderNamedAgent**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T04:31:53Z
- **Completed:** 2026-03-09T04:34:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Registered "modification-planner" as a named agent in the catalog with deck-intelligence family
- Implemented planSlideModifications() with full pipeline: element loading, text filtering, prompt building, LLM invocation, post-validation, and fallback
- Built hallucination guard that strips unknown element IDs from LLM responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Register modification-planner named agent in catalog** - `f3eb702` (feat)
2. **Task 2: Create planSlideModifications function** - `cad7300` (feat)

## Files Created/Modified
- `packages/schemas/agent-catalog.ts` - Added "modification-planner" to AgentId union and AGENT_CATALOG array
- `apps/agent/src/generation/modification-planner.ts` - Core planner module (243 lines) with element filtering, prompt building, LLM call, post-validation, and fallback

## Decisions Made
- Override slideId/slideObjectId in post-validation with known-good values rather than trusting LLM output
- On LLM error fallback, populate unmodifiedElements with all known element IDs (rather than empty) so downstream knows which elements exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors exist in agent-executor.ts and other files (type compatibility issues with Mastra agent overloads). These are unrelated to the modification-planner implementation and were not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- planSlideModifications() is ready for Phase 55 (Modification Executor) to call per-slide
- The modification-planner agent needs a published system prompt version in the database before runtime use
- Element maps (SlideElement records) must be populated by Phase 52 (Multi-Source Slide Assembler) before this planner produces meaningful results

---
*Phase: 53-modification-planner*
*Completed: 2026-03-09*

## Self-Check: PASSED
