---
phase: quick-18
plan: 01
subsystem: web-frontend
tags: [hitl, regeneration, feedback, ui]
dependency_graph:
  requires: [touch-actions, api-client]
  provides: [regenerate-button, feedback-dialog]
  affects: [stage-approval-bar, touch-page-shell, touch-page-client]
tech_stack:
  patterns: [popover-feedback-dialog, revert-and-regenerate]
key_files:
  created: []
  modified:
    - apps/web/src/components/touch/stage-approval-bar.tsx
    - apps/web/src/components/touch/touch-page-shell.tsx
    - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
decisions:
  - Re-generate button placed left of Approve with outline variant for visual hierarchy
  - Popover with optional textarea chosen over modal for lighter interaction weight
  - Revert to current stage (or highfi for ready state) before regeneration to clear downstream content
metrics:
  duration: 2 min
  completed: "2026-03-09T19:43:49Z"
---

# Quick Task 18: Add Re-generate Button with Optional Feedback

Re-generate button with popover feedback dialog at every HITL stage, wired to revert current stage and re-trigger generation with user feedback as additional context.

## Changes Made

### Task 1: StageApprovalBar Re-generate Button (d139589)

- Added `onRegenerate` callback and `isRegenerating` boolean props to `StageApprovalBarProps`
- Rendered Re-generate button (outline variant, RefreshCw icon) to the left of the Approve button
- Implemented Popover with optional Textarea for feedback, Skip (no feedback) and Re-generate (with feedback) actions
- Both buttons disabled during regeneration; spinner shown on Re-generate button when active

### Task 2: TouchPageClient Regeneration Wiring (9e3fb7f)

- Added `onRegenerate` and `isRegenerating` props passthrough in `TouchPageShell`
- Created `handleRegenerate` callback in `TouchPageClient` that:
  - Reverts the interaction to the current stage (or "highfi" in ready state) via `revertStageAction`
  - Calls `startGeneration` with optional feedback parameter
  - Transitions to polling state with appropriate generation message
- Updated `startGeneration` to accept optional 5th `feedback` parameter:
  - Touch 1: appends to context field
  - Touch 2/3: passes as context field
  - Touch 4: passes as additionalNotes field
- Passed `onRegenerate` and `isRegenerating` to both active-stage and ready-state `TouchPageShell` renders

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation passes with no errors in modified files
- Pre-existing test type errors are unrelated to these changes

## Self-Check: PASSED
