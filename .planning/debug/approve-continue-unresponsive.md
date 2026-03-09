---
status: awaiting_human_verify
trigger: "User clicks Approve & Continue button on Touch 1 Outline page, but nothing happens. No console errors."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: runId is null because it is never stored in the InteractionRecord, so handleStageApprove silently returns at the guard clause
test: confirmed by reading code
expecting: extractRunId returns null -> guard exits early -> no action
next_action: fix by storing runId in interaction inputs during workflow start

## Symptoms

expected: Clicking "Approve & Continue" should advance the workflow from Outline to Draft stage
actual: Nothing happens -- button click has no visible effect
errors: None in browser console
reproduction: Go to a deal's Touch 1 page, view the Outline step, click "Approve & Continue"
started: Never worked

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: handleStageApprove guard clause in touch-page-client.tsx line 300
  found: Guard returns early if !activeInteraction || !runId || !currentStage
  implication: If runId is null, nothing happens -- no error, no toast, no action

- timestamp: 2026-03-09T00:02:00Z
  checked: extractRunId function in touch-page-client.tsx lines 611-643
  found: Tries inputs.runId, generatedContent.runId, outputRefs.runId -- all return null
  implication: runId is never stored in any of these fields

- timestamp: 2026-03-09T00:03:00Z
  checked: touch-1-workflow.ts generateContent step, lines 73-86
  found: InteractionRecord.inputs is set to {companyName, industry, context, salespersonName} -- no runId
  implication: The workflow creates the interaction without knowing its own runId

- timestamp: 2026-03-09T00:04:00Z
  checked: api-client.ts startTouch1Workflow function, lines 404-427
  found: runId is generated client-side via crypto.randomUUID() and passed as query param to workflow start endpoint, but never stored in the interaction record
  implication: The runId exists only in Mastra's workflow runtime; the InteractionRecord has no reference to it

## Resolution

root_cause: The workflow runId (generated in api-client.ts and used by Mastra to track the workflow run) is never persisted into the InteractionRecord. The extractRunId function in touch-page-client.tsx searches inputs/generatedContent/outputRefs for a runId field and finds nothing, returning null. The handleStageApprove callback has a guard `if (!activeInteraction || !runId || !currentStage) return;` that silently exits when runId is null. No error is shown to the user because there is no else-branch or error toast on the guard.

fix: Two-part fix: (1) Include runId in the inputData body sent to the workflow start endpoint in api-client.ts for all 4 touch types. (2) Add runId as an optional field to each workflow's input schema and store it in the InteractionRecord.inputs JSON. This allows extractRunId on the frontend to find the runId in inputs.runId and pass it to handleStageApprove.

verification: (awaiting human verification)
files_changed:
  - apps/web/src/lib/api-client.ts (added runId to inputData for all 4 startTouch*Workflow functions)
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts (added runId to input schema + stored in interaction inputs)
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts (added runId to input schema + stored in interaction inputs)
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts (added runId to input schema + stored in interaction inputs)
  - apps/agent/src/mastra/workflows/touch-4-workflow.ts (added runId to input schema + stored in interaction inputs)
