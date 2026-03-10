---
status: verifying
trigger: "Touch 2 workflow shows status=failed, nothing generates, and clicking Approve & Continue shows error toast No suspended step found to approve"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two issues: (1) transient DB connection error killed the workflow, (2) no recovery path for failed workflows
test: Applied fix to detect failed workflows and auto-mark interactions as failed for recovery
expecting: User sees recovery screen and can start a new generation
next_action: Verify fix compiles and await human verification

## Symptoms

expected: Touch 2 should generate content (outline/draft/slides). "Approve & Continue" should advance the workflow to the next stage.
actual: The workflow status polling shows status=failed repeatedly. Nothing appears to generate. Clicking "Approve & Continue" shows error toast "No suspended step found to approve".
errors:
- Toast: "No suspended step found to approve"
- Logs show: `[workflows/status] runId=7a1d3316-f4d8-4561-8969-368b6cf533f1 status=failed`
reproduction:
1. Go to deal cmmij6r6e0016vd0jwlqxqiwz touch 2 page
2. Observe nothing is generating
3. Click "Approve & Continue"
4. See error toast "No suspended step found to approve"
started: Current state - workflow run already failed

## Eliminated

## Evidence

- timestamp: 2026-03-10T00:00:30Z
  checked: InteractionRecord in DB for deal cmmij6r6e0016vd0jwlqxqiwz touch_2
  found: hitlStage="lowfi", status="in_progress", has stageContent with 8 slides. runId=7a1d3316-f4d8-4561-8969-368b6cf533f1 stored in inputs.
  implication: The workflow progressed past skeleton approval to lowfi, then the workflow engine died but the DB record was never updated.

- timestamp: 2026-03-10T00:00:45Z
  checked: Mastra workflow snapshot for runId=7a1d3316-f4d8-4561-8969-368b6cf533f1
  found: |
    status=failed. Error: PrismaClientKnownRequestError P1001 - "Can't reach database server at aws-1-us-east-1.pooler.supabase.com:6543".
    The error occurred in the "assemble-deck" step calling prisma.slideElement.findMany().
    The workflow reached lowfi approval (the second HITL suspend), was resumed, then the assemble-deck step failed due to transient DB connectivity.
  implication: Root cause is a transient Supabase connection pool failure. The workflow died but the InteractionRecord was left as in_progress/lowfi because no cleanup ran.

- timestamp: 2026-03-10T00:01:00Z
  checked: Client-side recovery behavior in touch-page-client.tsx
  found: |
    1. Mount effect checks workflow status for in_progress interactions. For "failed" status, it says "server data should already reflect final state" but the interaction record is NOT updated.
    2. handleStageApprove checks for a suspended step. When workflow is failed, there's no suspended step, showing the generic "No suspended step found" error.
    3. The stale/failed recovery screen (lines 618-641) only triggers when !currentStage && !stageContent, but this interaction HAS both (lowfi + stageContent).
  implication: No recovery path exists for workflows that fail after the first HITL stage. The UI shows the approval screen but can't advance.

## Resolution

root_cause: |
  Two-part issue:
  1. TRIGGER: Transient Supabase connection pool failure (P1001) killed the workflow at the "assemble-deck" step after lowfi approval.
  2. BUG: No recovery path for failed workflows that have progressed past the first HITL stage. The InteractionRecord is left as status="in_progress" with hitlStage="lowfi", and the UI has no mechanism to detect the dead workflow and show the recovery screen.

fix: |
  1. Added POST /interactions/:id/mark-failed agent API route to transition in_progress interactions to failed status.
  2. Added markInteractionFailed() in web api-client.ts and markInteractionFailedAction() server action.
  3. Updated mount effect in touch-page-client.tsx: when workflow status is "failed" but interaction is in_progress, auto-marks it failed and refreshes.
  4. Updated handleStageApprove: when no suspended step found and workflow is failed, marks interaction failed and shows helpful error message.
  5. Updated recovery screen condition: now also triggers when interaction.status === "failed" (not just when !currentStage && !stageContent).

verification: TypeScript compiles with no new errors. Awaiting human verification.

files_changed:
  - apps/agent/src/mastra/index.ts (added mark-failed API route)
  - apps/web/src/lib/api-client.ts (added markInteractionFailed function)
  - apps/web/src/lib/actions/touch-actions.ts (added markInteractionFailedAction server action)
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx (auto-detect failed workflows, better error messages, recovery screen for failed interactions)
