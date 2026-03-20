---
status: awaiting_human_verify
trigger: "The Final step in Touch 1 workflow generates a presentation that ignores draft content, inferred structure, and example deck. Also no save location prompt after Mark as Ready."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED
test: Tests pass, needs human verification in real workflow
expecting: Final presentation now uses approved draft content
next_action: Await user verification

## Symptoms

expected: Final presentation reflects Touch 1 structure (Title Slide + Placeholder Metrics), matches draft content, looks like example. Save location prompt after Mark as Ready.
actual: Final shows empty/wrong slides (logo on dark background). No save location prompt.
errors: No error messages - silently generates wrong content
reproduction: Go through Touch 1 workflow: Outline -> Draft -> Final
started: Current state after quick task 21 redesigned Draft step

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:00:30Z
  checked: touch-1-workflow.ts assembleDeck step (line 423-556)
  found: assembleDeck receives `finalContent` (PagerContentLlmSchema) from the approved draft. When using structure-driven pipeline, it calls executeStructureDrivenPipeline() but NEVER passes finalContent to it. The pipeline only receives dealContext (company, industry, pillars) and blueprint.
  implication: The structure-driven pipeline has zero knowledge of the user-approved draft content

- timestamp: 2026-03-09T00:00:35Z
  checked: route-strategy.ts executeStructureDrivenPipeline (line 136-182)
  found: ExecutePipelineParams interface has { blueprint, targetFolderId, deckName, dealContext, ownerEmail } - NO field for draft content. The pipeline calls planSlideModifications with only { slideId, slideObjectId, dealContext }.
  implication: There is no mechanism to pass draft content through the structure-driven pipeline

- timestamp: 2026-03-09T00:00:40Z
  checked: modification-planner.ts buildPrompt (line 142-199)
  found: The LLM prompt for modification planning only includes dealContext fields (companyName, industry, pillars, persona, funnelStage). It tells the LLM to modify slide elements based on these generic fields only. It has NO access to the headline, value proposition, key capabilities, or call to action from the draft.
  implication: The modification planner can only do generic company-name substitutions, not inject the actual draft content

- timestamp: 2026-03-09T00:00:45Z
  checked: touch-page-client.tsx handleStageApprove for highfi stage (line 309-361)
  found: When "Mark as Ready" is clicked at the highfi stage, it calls transitionStageAction which resumes the workflow. The workflow records the interaction and marks hitlStage="ready". There is no save location prompt - the deck is auto-saved to a deal folder determined by getOrCreateDealFolder(). The user has no choice.
  implication: Save location prompt is a feature gap, not a bug - the current design auto-saves to the deal's Drive folder

## Resolution

root_cause: |
  PRIMARY: The structure-driven generation pipeline (executeStructureDrivenPipeline) does not receive or use the approved draft content (finalContent/PagerContentLlmSchema) from the workflow. The assembleDeck step has the approved draft but only passes dealContext (company name, industry, etc.) to the pipeline. The modification planner then asks an LLM to modify slide elements based only on generic deal context, resulting in near-empty slides because it can only do company-name substitutions without the actual headline, value proposition, capabilities, and call-to-action text.

  Data flow gap:
  - Draft step generates rich content (headline, valueProposition, keyCapabilities, callToAction, sections with content slots)
  - awaitLowfiApproval passes this as `finalContent` to assembleDeck
  - assembleDeck calls executeStructureDrivenPipeline WITHOUT finalContent
  - Pipeline's modification planner only knows company name and industry
  - Result: essentially empty/template slides

  SECONDARY (feature gap): No save location prompt after "Mark as Ready" - deck is auto-saved to a system-determined deal folder. This is by design but may not match user expectations.

fix: |
  Threaded draft content through the entire structure-driven pipeline:

  1. route-strategy.ts: Added optional `draftContent?: Record<string, unknown>` to ExecutePipelineParams.
     Pipeline now passes draftContent to planSlideModifications for each slide.

  2. modification-planner.ts: Added optional `draftContent` to PlanModificationsParams.
     Enhanced buildPrompt() with new `formatDraftContent()` helper that renders the approved
     draft content (headline, value proposition, capabilities, call to action, section-level
     content slots) into the LLM prompt. The prompt now instructs the LLM to use the approved
     draft content when modifying slide elements, rather than generating generic content.

  3. touch-1-workflow.ts: assembleDeck step now passes `content` (the approved PagerContentLlmSchema)
     as `draftContent` to executeStructureDrivenPipeline.

  The fix is backward-compatible: draftContent is optional, so touch-2/3/4 workflows continue
  working without it (they'll need the same plumbing added separately).

verification: |
  - All 22 existing tests pass (route-strategy: 11, structure-driven-workflow: 11)
  - TypeScript compiles (no new errors from changes)
  - Needs human verification: run Touch 1 workflow end-to-end and verify Final step uses draft content

files_changed:
  - apps/agent/src/generation/route-strategy.ts
  - apps/agent/src/generation/modification-planner.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
