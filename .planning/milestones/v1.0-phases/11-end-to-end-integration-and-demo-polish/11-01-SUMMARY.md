---
phase: 11-end-to-end-integration-and-demo-polish
plan: 01
subsystem: ui
tags: [sonner, toast, stepper, progress-indicator, error-handling, lucide-react, pipeline-visualization]

# Dependency graph
requires:
  - phase: 04-touch-1-3
    provides: Touch 1-3 form components with three-state pattern
  - phase: 05-transcript-processing
    provides: Touch 4 form with extracting/fieldReview/generating states
  - phase: 10-pre-call-briefing
    provides: Pre-call form with idle/generating/complete/error states
provides:
  - PipelineStepper reusable component for step-by-step progress visualization
  - Pipeline step definitions for all 5 flows mapped to Mastra workflow step IDs
  - Centralized friendly error mapper (mapToFriendlyError)
  - Sonner toast integration with Toaster in root layout
  - All 5 form components updated with stepper + toast error handling
affects: [11-02, demo-readiness]

# Tech tracking
tech-stack:
  added: [sonner]
  patterns: [monotonic-step-tracking, friendly-error-mapping, pipeline-stepper-pattern]

key-files:
  created:
    - apps/web/src/components/touch/pipeline-stepper.tsx
    - apps/web/src/components/touch/pipeline-steps.ts
    - apps/web/src/lib/error-messages.ts
    - apps/web/src/components/ui/sonner.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/components/touch/touch-1-form.tsx
    - apps/web/src/components/touch/touch-2-form.tsx
    - apps/web/src/components/touch/touch-3-form.tsx
    - apps/web/src/components/touch/touch-4-form.tsx
    - apps/web/src/components/pre-call/pre-call-form.tsx

key-decisions:
  - "Simplified sonner Toaster to use theme='light' instead of useTheme hook (no ThemeProvider in app)"
  - "Touch 4 assetGenerating state keeps GenerationProgress (asset gen is async, not observed from form)"
  - "Monotonic Set pattern for completed steps prevents stepper flicker during polling"

patterns-established:
  - "PipelineStepper pattern: pass steps array + completedStepIds Set + activeStepId + errorStepId + errorMessage"
  - "Error UX pattern: toast.error(mapToFriendlyError(raw)) + stepper error state + Try Again button"
  - "Retry pattern: reset all stepper state + return to input state for fresh flow restart"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 11 Plan 01: Pipeline Stepper and Error Handling Summary

**Step-by-step pipeline progress indicators with sonner toasts and friendly error mapping across all 5 flows (Touch 1-4, Pre-call)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-04T17:17:21Z
- **Completed:** 2026-03-04T17:25:34Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- PipelineStepper component with 4 visual states: completed (green check), active (blue spinner), error (red X), pending (gray dot)
- Step definitions for all 5 flows mapping real Mastra workflow step IDs to human-readable labels (Touch 1 has separate generating/assembling steps, Touch 4 has extract/brief/asset step sets)
- Centralized friendly error mapper that pattern-matches raw errors to actionable user messages
- Sonner toast integration with Toaster in root layout for immediate error attention
- All 5 form components updated: polling loops derive step progress from status.steps, catch blocks use toast + stepper error state, error state includes Try Again button

## Task Commits

Each task was committed atomically:

1. **Task 1: Install sonner, create PipelineStepper component, step definitions, and error mapper** - `ef4bce5` (feat)
2. **Task 2: Integrate PipelineStepper and error toasts into all 5 form components** - `b8cd82c` (feat)

## Files Created/Modified
- `apps/web/src/components/touch/pipeline-stepper.tsx` - Reusable step-by-step progress component with completed/active/error/pending states
- `apps/web/src/components/touch/pipeline-steps.ts` - Step definitions for all 5 flows mapping Mastra step IDs to human labels
- `apps/web/src/lib/error-messages.ts` - Centralized friendly error mapper (mapToFriendlyError)
- `apps/web/src/components/ui/sonner.tsx` - shadcn/ui sonner wrapper (simplified for light theme)
- `apps/web/src/app/layout.tsx` - Added Toaster provider to root layout
- `apps/web/src/components/touch/touch-1-form.tsx` - PipelineStepper for generating and assembling phases
- `apps/web/src/components/touch/touch-2-form.tsx` - PipelineStepper with error state and retry
- `apps/web/src/components/touch/touch-3-form.tsx` - PipelineStepper with error state and retry
- `apps/web/src/components/touch/touch-4-form.tsx` - PipelineStepper for extracting and brief generation phases
- `apps/web/src/components/pre-call/pre-call-form.tsx` - PipelineStepper replaces Loader2 spinner in Card wrapper

## Decisions Made
- Simplified sonner Toaster to use `theme="light"` instead of `useTheme()` hook from next-themes, since the app does not use a ThemeProvider
- Touch 4 `assetGenerating` state retains GenerationProgress (asset generation is async after brief approval, not observed from form)
- Used monotonic Set pattern for completed steps (only grows, never shrinks) to prevent stepper flicker during polling
- Error state keeps stepper visible with red error marker and Try Again button (retry restarts whole flow per user decision)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored GenerationProgress import in Touch 4 form**
- **Found during:** Task 2 (Touch 4 integration)
- **Issue:** Replacing the import block removed GenerationProgress, but Touch 4's assetGenerating state still uses it
- **Fix:** Re-added GenerationProgress import alongside new PipelineStepper imports
- **Files modified:** apps/web/src/components/touch/touch-4-form.tsx
- **Verification:** TypeScript compiles without errors
- **Committed in:** b8cd82c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor import restoration. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 flows now have step-by-step progress indicators and friendly error handling
- Ready for Plan 11-02 (end-to-end integration validation and demo polish)

---
*Phase: 11-end-to-end-integration-and-demo-polish*
*Completed: 2026-03-04*
