---
status: awaiting_human_verify
trigger: "Touch 1 draft generation fails with file not found, Re-generate button throws 400 error"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two bugs: (1) no fallback from structure-driven to legacy when pipeline fails, (2) revert targets current stage instead of previous
test: Code reading confirmed both
expecting: N/A - root causes found
next_action: Apply fixes to both issues

## Symptoms

expected: Draft content should be generated and displayed after outline is approved. Re-generate button should allow re-running the draft stage.
actual: Draft shows "No draft content available yet". Re-generate throws 400 error.
errors:
  1. Error executing step workflow.touch-1-workflow.step.assemble-deck - File not found: 10eJy2hzAHF5bVkIQm5cZr63KGY3pOv8mQ9Zr5dHN2vg
  2. Agent API error (400): Can only revert to an earlier stage
reproduction: Approve outline -> draft fails; click Re-generate on draft -> 400 error
started: Current development

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: touch-1-workflow.ts assembleDeck step (lines 396-420)
  found: When strategy.type is "low-confidence", executeStructureDrivenPipeline runs with no try/catch. If any slide/template file ID is invalid in Google Drive, the whole step crashes with no fallback to legacy path.
  implication: Root cause of Issue 1 - no resilience when structure-driven pipeline fails

- timestamp: 2026-03-09T00:02:00Z
  checked: touch-page-client.tsx handleRegenerate (lines 393-449)
  found: Line 400 sets revertTarget = currentStage (e.g. "lowfi"). Calls revertStageAction(id, "lowfi") while hitlStage IS "lowfi". Server revert endpoint checks targetIndex >= currentIndex and returns 400.
  implication: Root cause of Issue 2 - revert target should be the stage BEFORE current, not the current stage itself

- timestamp: 2026-03-09T00:03:00Z
  checked: Agent revert-stage endpoint (mastra/index.ts lines 1539-1590)
  found: Confirms validation logic: STAGE_ORDER = {skeleton:0, lowfi:1, highfi:2, ready:3}. targetIndex >= currentIndex returns 400 "Can only revert to an earlier stage"
  implication: Server logic is correct - client is sending wrong target stage

## Resolution

root_cause: |
  Issue 1: assembleDeck step in touch-1-workflow.ts (and touch-2/3/4) calls executeStructureDrivenPipeline without try/catch fallback to legacy path. When the pipeline encounters an invalid/inaccessible Google file ID from the slide database, the entire step crashes.
  Issue 2: handleRegenerate in touch-page-client.tsx sets revertTarget to currentStage instead of the previous stage. When on "lowfi" stage and clicking Re-generate, it calls revertStageAction(id, "lowfi") but the API requires reverting to an EARLIER stage (would need "skeleton").
fix: |
  Issue 1: Added try/catch around executeStructureDrivenPipeline in all 4 touch workflows (touch-1 through touch-4). On failure, falls back to legacy assembly path with console.warn logging.
  Issue 2: Changed handleRegenerate in touch-page-client.tsx to compute the PREVIOUS stage (stageIndex - 1) as the revert target instead of using currentStage directly. At skeleton (index 0), skips revert entirely.
verification: TypeScript compilation passes with no new errors in modified files. Logic verified by code review.
files_changed:
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts
  - apps/agent/src/mastra/workflows/touch-4-workflow.ts
