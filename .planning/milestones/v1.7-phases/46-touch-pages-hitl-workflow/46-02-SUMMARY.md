---
phase: 46-touch-pages-hitl-workflow
plan: "02"
subsystem: api
tags: [mastra, workflows, hitl, suspend-resume, prisma, server-actions]

# Dependency graph
requires:
  - phase: 46-touch-pages-hitl-workflow
    provides: hitlStage and stageContent fields on InteractionRecord (46-01)
provides:
  - 3-stage HITL suspend points for Touch 1 workflow (skeleton, lowfi, highfi)
  - 2 new suspend points for Touch 2 and Touch 3 workflows (skeleton, lowfi)
  - hitlStage tracking on Touch 4's existing 3 suspend points
  - transitionStageAction and revertStageAction server actions
  - resumeTouch2Workflow and resumeTouch3Workflow API client functions
  - generic resumeWorkflowStep and revertInteractionStage API helpers
affects: [46-touch-pages-hitl-workflow, 45-persistent-ai-chat-bar]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-suspend-workflow, early-interaction-creation, stage-aware-resume]

key-files:
  created: []
  modified:
    - apps/agent/src/mastra/workflows/touch-1-workflow.ts
    - apps/agent/src/mastra/workflows/touch-2-workflow.ts
    - apps/agent/src/mastra/workflows/touch-3-workflow.ts
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/web/src/lib/actions/touch-actions.ts
    - apps/web/src/lib/api-client.ts

key-decisions:
  - "InteractionRecord created at workflow start (not mid-flow) so hitlStage can be tracked from first suspend"
  - "Touch 2/3 get skeleton+lowfi suspends but no separate highfi suspend -- deck assembly marks ready directly"
  - "Touch 4 recordInteraction step changed from create to update since InteractionRecord now created in parseTranscript"
  - "Generic resumeWorkflowStep helper added alongside per-touch resume functions for flexibility"

patterns-established:
  - "Multi-suspend workflow: create InteractionRecord first, update hitlStage/stageContent before each suspend"
  - "Stage-aware suspend schema: includes stage literal, content, dealId, interactionId"
  - "transitionStageAction dispatches to per-touch resume functions by touchType"

requirements-completed: [TOUCH-02, TOUCH-03, TOUCH-04, TOUCH-05]

# Metrics
duration: 13min
completed: 2026-03-08
---

# Phase 46 Plan 02: Multi-Stage HITL Workflows Summary

**3-stage suspend points added to all 4 touch workflows with hitlStage tracking, plus server actions for stage transitions and reversions**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-08T21:56:37Z
- **Completed:** 2026-03-08T22:09:56Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Touch 1 workflow now has 3 suspend points: skeleton (content outline), lowfi (draft text), highfi (Google Slides)
- Touch 2/3 workflows now have 2 new suspend points: skeleton (slide selection rationale), lowfi (draft slide order + notes)
- Touch 4 workflow's existing 3 suspend points now update InteractionRecord.hitlStage and stageContent
- Server actions enable approving/resuming and reverting stages for all 4 touches
- API client has resume functions for all 4 touches plus a generic resume helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 3-stage suspend points to Touch 1-3 workflows** - `64a42cf` (feat)
2. **Task 2: Map Touch 4 suspends to stage model and add stage transition actions** - `24e3342` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts` - Added awaitSkeletonApproval, generateDraftText, awaitLowfiApproval steps; restructured workflow chain
- `apps/agent/src/mastra/workflows/touch-2-workflow.ts` - Added awaitSkeletonApproval, generateDraftOrder, awaitLowfiApproval steps with InteractionRecord creation at start
- `apps/agent/src/mastra/workflows/touch-3-workflow.ts` - Mirrors Touch 2 with capability-focused selection rationale
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Added hitlStage/stageContent updates to awaitFieldReview, awaitBriefApproval, awaitAssetReview; moved InteractionRecord creation to parseTranscript
- `apps/web/src/lib/actions/touch-actions.ts` - Added transitionStageAction, revertStageAction, HitlStage type export
- `apps/web/src/lib/api-client.ts` - Added resumeTouch2Workflow, resumeTouch3Workflow, resumeWorkflowStep, revertInteractionStage, HitlStage type, hitlStage/stageContent on InteractionRecord interface

## Decisions Made
- InteractionRecord created at workflow start (not mid-flow) so hitlStage can be tracked from the first suspend point
- Touch 2/3 skip a separate highfi suspend -- deck assembly marks the interaction as "ready" directly since the assembled deck is the final output
- Touch 4 recordInteraction step changed from prisma.create to prisma.update since the InteractionRecord now exists from parseTranscript
- Generic resumeWorkflowStep helper provided alongside per-touch functions for future extensibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Early InteractionRecord creation for Touch 4**
- **Found during:** Task 2 (Touch 4 hitlStage mapping)
- **Issue:** Touch 4's InteractionRecord was created at step 6 (recordInteraction), but hitlStage updates needed at step 3 (awaitFieldReview). No interactionId available for early suspend points.
- **Fix:** Moved InteractionRecord creation to parseTranscript (step 1) and changed recordInteraction to update instead of create. Threaded interactionId through all intermediate steps.
- **Files modified:** touch-4-workflow.ts (parseTranscript, validateFields, awaitFieldReview, mapPillarsAndGenerateBrief, generateROIFraming, recordInteraction)
- **Verification:** TypeScript compiles with no new errors
- **Committed in:** 24e3342

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** InteractionRecord creation moved earlier to enable hitlStage tracking. Same data persisted, just created sooner. No scope creep.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 touch workflows now support multi-stage HITL with stage tracking
- Server actions ready for touch page UI integration
- stageContent stored as JSON in InteractionRecord for UI display at each stage
- Foundation ready for touch page layout and stepper component integration

---
*Phase: 46-touch-pages-hitl-workflow*
*Completed: 2026-03-08*
