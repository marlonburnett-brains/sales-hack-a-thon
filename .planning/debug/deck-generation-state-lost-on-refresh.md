---
status: investigating
trigger: "deck-generation-state-lost-on-refresh - When a deck is being generated, refresh loses the generating state and reverts to previous step"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - isGenerating is useState(false) in touch-page-client.tsx:190, lost on refresh. The interaction has status="in_progress" and a runId, but the client never checks for running workflows on mount.
test: N/A - root cause confirmed
expecting: N/A
next_action: Implement fix - on mount, detect in-progress interaction with runId, check workflow status, resume polling if still running

## Symptoms

expected: When refreshing or navigating away and back during deck generation (Draft step), the UI should show the "generating" or "in-progress" state for the current step (Draft), not revert to showing the previous step (Outline).
actual: After refresh or navigation away and back, the UI lands on the previous completed step instead of the step currently being generated.
errors: No explicit errors - state persistence/restoration bug.
reproduction: 1) Start generating a deck for any touch. 2) While generation is in progress (Draft step), refresh. 3) UI shows previous step instead of generating state.
started: Likely always been this way since step-based generation was implemented.

## Eliminated

## Evidence

- timestamp: 2026-03-10T00:01:00Z
  checked: touch-page-client.tsx line 190
  found: isGenerating = useState(false) -- pure client state, resets to false on refresh
  implication: Generating state is never persisted or restored

- timestamp: 2026-03-10T00:02:00Z
  checked: touch-2-workflow.ts line 91-106
  found: InteractionRecord created with status="in_progress" and runId stored in inputs JSON
  implication: DB has enough info to detect running workflows

- timestamp: 2026-03-10T00:03:00Z
  checked: touch-page-client.tsx lines 207-211, 530-553
  found: currentStage derived from hitlStage field. If hitlStage is null (workflow still on first step), shows "previous generation did not complete" fallback. If hitlStage is set (e.g. "skeleton"), shows that stage content -- which is the "previous step" the user described.
  implication: Between stages (after approve, while next step runs), hitlStage shows last completed stage but no generating indicator

- timestamp: 2026-03-10T00:04:00Z
  checked: extractRunId function (lines 655-687)
  found: runId can be extracted from interaction inputs/generatedContent/outputRefs
  implication: We have what we need to check workflow status on mount

## Resolution

root_cause: isGenerating is useState(false) -- ephemeral React state lost on refresh. When page loads after refresh, there is no check for whether the workflow associated with the active interaction is still running. The interaction record in the DB has status="in_progress" and a runId, but the client never uses these to restore generating state.
fix: Add a useEffect that runs on mount to detect an in-progress interaction with a runId, check the workflow status via the existing /api/workflows/status endpoint, and if still running, set isGenerating=true and resume polling.
verification:
files_changed: [apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx]
