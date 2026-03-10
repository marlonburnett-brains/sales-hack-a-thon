---
phase: quick-25
plan: 01
subsystem: ui, api
tags: [alertdialog, regenerate, hitl, prisma, wipe]

requires:
  - phase: quick-18
    provides: Re-generate button with optional feedback
provides:
  - AlertDialog confirmation before regeneration with wipe option
  - Backend wipe logic clearing FeedbackSignals and resetting to skeleton
affects: [touch-workflow, hitl-stages]

tech-stack:
  added: []
  patterns: [confirmation-before-destructive-action]

key-files:
  created: []
  modified:
    - apps/web/src/components/touch/stage-approval-bar.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
    - apps/web/src/lib/actions/touch-actions.ts
    - apps/web/src/lib/api-client.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/lib/regenerate-stage.ts

key-decisions:
  - "Wipe dialog appears before feedback popover to separate the wipe/no-wipe choice from the feedback step"
  - "wipeData=true forces stage to skeleton regardless of prior hitlStage, ensuring clean restart"

patterns-established:
  - "Confirmation dialog before destructive regeneration actions"

requirements-completed: [QUICK-25]

duration: 3min
completed: 2026-03-10
---

# Quick Task 25: Add Regenerate Dialog with Wipe Option Summary

**AlertDialog with wipe/no-wipe choice before feedback popover, full-stack wipeData threading through to backend deleteMany + reset**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T03:04:21Z
- **Completed:** 2026-03-10T03:07:51Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- AlertDialog prompts user to choose between wiping all prior data or just regenerating current stage
- wipeData boolean threaded through stage-approval-bar -> touch-page-client -> touch-actions -> api-client -> route -> regenerateStage
- Backend wipe logic deletes all FeedbackSignals, nulls stageContent/generatedContent/driveFileId/outputRefs, resets hitlStage to skeleton
- Backward compatible: wipeData=false/undefined preserves existing behavior exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add wipe confirmation AlertDialog and thread wipeData through frontend** - `a62a55e` (feat)
2. **Task 2: Implement backend wipe logic and thread wipeData through route and regenerateStage** - `f98e0e3` (feat)

## Files Created/Modified
- `apps/web/src/components/touch/stage-approval-bar.tsx` - AlertDialog with Wipe & Re-generate / Just Re-generate / Cancel options, wipeData state management
- `apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx` - handleRegenerate now accepts and passes wipeData
- `apps/web/src/lib/actions/touch-actions.ts` - regenerateStageAction passes wipeData to api-client
- `apps/web/src/lib/api-client.ts` - regenerateInteractionStage includes wipeData in POST body
- `apps/agent/src/mastra/index.ts` - Route zod schema extended with wipeData boolean
- `apps/agent/src/lib/regenerate-stage.ts` - Wipe block deletes FeedbackSignals and resets interaction before regeneration

## Decisions Made
- Wipe dialog appears before feedback popover to separate the destructive choice from the optional feedback step
- wipeData=true forces stage to "skeleton" regardless of prior hitlStage, ensuring regeneration starts from the beginning
- Used buttonVariants className for AlertDialogAction styling since the component does not accept a variant prop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AlertDialogAction variant prop does not exist**
- **Found during:** Task 1
- **Issue:** Plan specified `variant="destructive"` and `variant="outline"` on AlertDialogAction, but the shadcn component does not accept a variant prop
- **Fix:** Used `buttonVariants({ variant: "destructive" })` and `buttonVariants({ variant: "outline" })` via className instead
- **Files modified:** apps/web/src/components/touch/stage-approval-bar.tsx
- **Verification:** TypeScript compiles without errors

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor styling approach change, no functional impact.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wipe & Re-generate flow is fully functional end-to-end
- No blockers

---
*Quick Task: 25*
*Completed: 2026-03-10*
