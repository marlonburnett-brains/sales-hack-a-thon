---
status: awaiting_human_verify
trigger: "Touch 4 shows empty outline state instead of auto-generating outlines for Proposal, Talk Track, FAQ"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Touch 4 uses transcript-based workflow but guided-start sends empty transcript; the 3-stage HITL UI misinterprets workflow suspend points
test: Traced full code path from guided-start through workflow to UI rendering
expecting: stageContent shape mismatch between workflow output and UI expectations
next_action: Implement fix - either restore Touch4Form or adapt the generic flow for Touch 4

## Symptoms

expected: When a deal reaches Touch 4, outline content should be automatically generated for each artifact (Proposal, Talk Track, FAQ). If generation fails, show error message with only a re-generate button.
actual: Touch 4 shows empty state "No proposal content available yet" with both Re-generate and a greyed-out "Processing..." button visible. The outline content is not being generated or displayed.
errors: No visible error messages - empty state appears as if content simply hasn't been generated yet
reproduction: Navigate to a deal's Touch 4 (Sales Proposal) page
started: Current behavior, recent commits removed Touch 4 transcript form

## Eliminated

## Evidence

- timestamp: 2026-03-12T00:01:00Z
  checked: git diff 445a535..3f4ad0d (commit 3f4ad0d "remove Touch 4 special-case form")
  found: Touch4Form was replaced with generic TouchGuidedStart for all touches including Touch 4
  implication: Touch 4 lost its special multi-step workflow UI (field review, brief approval, etc.)

- timestamp: 2026-03-12T00:02:00Z
  checked: startGeneration() in touch-page-client.tsx lines 899-906
  found: For touch_4, sends generateTouch4BriefAction with transcript="" and subsector=industry
  implication: Touch 4 workflow receives an empty transcript to parse

- timestamp: 2026-03-12T00:03:00Z
  checked: touch-4-workflow.ts steps 1-3 (parseTranscript -> validateFields -> awaitFieldReview)
  found: Workflow parses empty transcript, validates (all empty = errors), suspends at awaitFieldReview with hitlStage="skeleton" and stageContent={extractedFields, fieldSeverity, hasErrors}
  implication: Workflow correctly suspends but the stageContent shape is transcript fields, not proposal/talkTrack/faq artifacts

- timestamp: 2026-03-12T00:04:00Z
  checked: Touch4ArtifactContent in touch-stage-content.tsx lines 557-575
  found: Extracts data.proposal, data.talkTrack, data.faq from stageContent - all undefined because stageContent has extractedFields/fieldSeverity/hasErrors instead
  implication: This is why "No proposal content available yet" shows for all 3 tabs

- timestamp: 2026-03-12T00:05:00Z
  checked: StageApprovalBar rendering in touch-page-shell.tsx lines 68-77
  found: Shows Re-generate and Approve buttons when currentStage is set (skeleton)
  implication: "Re-generate" and "Processing..." buttons visible because generic HITL UI doesn't know about Touch 4's different workflow stages

- timestamp: 2026-03-12T00:06:00Z
  checked: regenerateStage() in regenerate-stage.ts lines 70-125
  found: For skeleton stage, only handles touch_2/touch_3 (slide selection) and falls through to touch_1 pager regeneration. No Touch 4 handling.
  implication: Re-generate button for Touch 4 skeleton stage would generate a Touch 1 pager outline, not Touch 4 proposal outlines

## Resolution

root_cause: Commit 3f4ad0d removed Touch4Form (which handled the multi-step transcript workflow with field review and brief approval) and replaced it with the generic TouchGuidedStart flow. The generic flow sends an empty transcript to the touch-4-workflow, which suspends at awaitFieldReview with stageContent containing extractedFields/fieldSeverity/hasErrors (transcript extraction data). The Touch4ArtifactTabs component expects stageContent to have proposal/talkTrack/faq artifacts, finds them all undefined, and renders "No content available yet." The StageApprovalBar then incorrectly shows both Re-generate and Approve buttons for a workflow state (field review suspend) that the generic HITL UI doesn't understand.
fix: Two-part fix. (1) Restored Touch4Form for the no-interaction and failed-interaction states in touch-page-client.tsx so Touch 4 uses its dedicated multi-step transcript workflow UI (field review, brief approval, asset generation) instead of the generic guided-start flow which doesn't understand Touch 4's workflow. (2) Updated Touch4ArtifactContent in touch-stage-content.tsx to handle the actual stageContent shapes produced by the Touch 4 workflow at each HITL stage: skeleton shows extracted transcript fields, lowfi shows the sales brief, highfi maps deckUrl/talkTrackUrl/faqUrl to artifact tabs.
verification: TypeScript compilation passes (0 new errors). Pending manual verification.
files_changed:
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/web/src/components/touch/touch-stage-content.tsx
