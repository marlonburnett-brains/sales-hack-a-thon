---
phase: 06-hitl-checkpoint-1-brief-approval
plan: 01
subsystem: workflow, api
tags: [mastra, prisma, suspend-resume, hitl, brief-approval, api-routes, server-actions, touch-4]

# Dependency graph
requires:
  - phase: 05-transcript-processing-and-brief-generation
    provides: 6-step touch-4-workflow, Brief model, BriefDisplay component, SalesBriefLlmSchema, ROIFramingLlmSchema
  - phase: 03-zod-schema-layer
    provides: SalesBriefLlmSchema, ROIFramingLlmSchema, TranscriptFieldsLlmSchema
provides:
  - 8-step Touch 4 workflow with two suspend points (field review + brief approval)
  - Second HITL checkpoint (awaitBriefApproval) that blocks all downstream steps until explicit human approval
  - Brief record persisted with approval status tracking BEFORE the approval checkpoint fires
  - Five custom API endpoints for brief approval/rejection/edit/fetch operations
  - Typed api-client functions and server actions for end-to-end brief approval flow
  - FeedbackSignal tracking for approval, rejection, and edit operations
affects: [phase-06-plan-02, phase-07, phase-08, phase-09]

# Tech tracking
tech-stack:
  added: []
  patterns: [second-suspend-point, approval-status-on-model, reject-without-resume, edit-with-diff-signal]

key-files:
  created: []
  modified:
    - apps/agent/prisma/schema.prisma
    - apps/agent/src/mastra/workflows/touch-4-workflow.ts
    - apps/agent/src/mastra/index.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/lib/actions/touch-actions.ts

key-decisions:
  - "Approval tracking fields added directly to Brief model (not a separate ApprovalState model) -- Brief is 1:1 with approval state"
  - "recordInteraction reordered BEFORE awaitBriefApproval so Brief exists in DB before approval checkpoint fires"
  - "Rejection and edit use custom API endpoints (not workflow resume) to support unlimited rejection/resubmit cycles"
  - "workflowRunId left null at Brief creation -- set by approve endpoint since Mastra steps cannot access runId"
  - "FeedbackSignal creation moved from recordInteraction to finalizeApproval -- only created after explicit approval"

patterns-established:
  - "Second suspend point: awaitBriefApproval uses same suspendSchema/resumeSchema/suspend() pattern as awaitFieldReview"
  - "Custom endpoints for non-resume operations: reject and edit modify Brief/FeedbackSignal without resuming workflow"
  - "Edit diff tracking: FeedbackSignal with signalType 'edited' captures before/after snapshot of Brief fields"
  - "Approval resumes workflow; rejection updates status -- workflow stays suspended until approved"

requirements-completed: [GEN-03, GEN-04]

# Metrics
duration: 2min
completed: 2026-03-04
---

# Phase 6 Plan 01: HITL-1 Brief Approval Backend Foundation Summary

**8-step Touch 4 workflow with second suspend point for brief approval, 5 custom API endpoints for approve/reject/edit/fetch, and typed api-client + server action layer**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T02:54:17Z
- **Completed:** 2026-03-04T02:56:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extended Brief model with 5 approval tracking fields (approvalStatus, reviewerName, approvedAt, rejectionFeedback, workflowRunId)
- Restructured Touch 4 workflow to 8 steps: recordInteraction now runs BEFORE awaitBriefApproval, creating Brief with "pending_approval" status before the hard stop
- Added awaitBriefApproval step (SUSPEND 2) and finalizeApproval step that updates status to "approved" and creates FeedbackSignal
- Five custom API endpoints: GET /briefs/:briefId, GET /briefs/:briefId/review, POST /briefs/:briefId/approve, POST /briefs/:briefId/reject, POST /briefs/:briefId/edit
- Typed end-to-end: Prisma -> API route -> api-client -> server action for all brief approval operations
- Approve endpoint resumes workflow via Mastra SDK; reject/edit modify Brief without resuming (unlimited rejection cycles)

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma schema + workflow restructure (awaitBriefApproval suspend, finalizeApproval step, recordInteraction reordering)** - `d780079` (feat)
2. **Task 2: API endpoints for brief approval/rejection/edit/fetch + api-client + server actions** - `cf4d38d` (feat)

## Files Created/Modified
- `apps/agent/prisma/schema.prisma` - Added 5 approval tracking fields to Brief model (approvalStatus, reviewerName, approvedAt, rejectionFeedback, workflowRunId)
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` - Extended from 6 to 8 steps: reordered recordInteraction before approval, added awaitBriefApproval (SUSPEND 2) and finalizeApproval steps (726 lines)
- `apps/agent/src/mastra/index.ts` - Added 5 API routes for brief approval flow using registerApiRoute pattern
- `apps/web/src/lib/api-client.ts` - Added BriefRecord, BriefReviewData interfaces and 5 typed functions (getBrief, getBriefReview, approveBrief, rejectBrief, editBrief)
- `apps/web/src/lib/actions/touch-actions.ts` - Added 5 server actions wrapping api-client functions with revalidatePath("/deals")

## Decisions Made
- Approval tracking fields on Brief model (not separate model) -- Brief is 1:1 with approval state, avoids extra join for display
- recordInteraction runs before awaitBriefApproval so Brief exists in DB when workflow suspends (standalone review page can query it)
- workflowRunId left null at Brief creation, set by approve endpoint -- Mastra steps cannot access runId internally
- Rejection does NOT resume workflow -- creates FeedbackSignal and updates status; workflow stays suspended for unlimited rejection/resubmit cycles
- FeedbackSignal creation moved from recordInteraction to finalizeApproval -- completion signal only fires after explicit approval
- Edit endpoint creates FeedbackSignal with before/after diff and resets approvalStatus to "pending_approval"

## Deviations from Plan

None -- plan executed exactly as written. Task 1 was already committed as `d780079`; Task 2 changes were staged and committed as `cf4d38d`.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend foundation for HITL-1 brief approval is complete
- Ready for Plan 06-02 (approval UI): BriefApprovalBar component, BriefEditMode component, standalone review page, deal page status indicators
- All API contracts are typed end-to-end; UI can call server actions directly
- Workflow suspend payload includes briefId and interactionId for UI rendering

## Self-Check: PASSED

All 5 files verified (schema.prisma, touch-4-workflow.ts, index.ts, api-client.ts, touch-actions.ts). Both task commits (d780079, cf4d38d) confirmed in git log. Artifact line count verified: touch-4-workflow.ts (726 lines, min 600). Key patterns confirmed: approvalStatus in schema, 5 API routes, 5 api-client functions, 5 server actions.

---
*Phase: 06-hitl-checkpoint-1-brief-approval*
*Completed: 2026-03-04*
