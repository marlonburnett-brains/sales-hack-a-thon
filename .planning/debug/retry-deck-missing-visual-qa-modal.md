---
status: awaiting_human_verify
trigger: "retry-deck-missing-visual-qa-modal"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: The retry deck generation button bypasses the visual QA modal that exists for initial generation
test: Find the modal component and trace how it's triggered for initial vs retry flows
expecting: Modal exists but retry flow doesn't invoke it
next_action: Search for visual QA modal and retry deck generation button in codebase

## Symptoms

expected: Clicking "Retry Deck Generation" shows a modal asking about enabling visual QA before proceeding
actual: Clicking "Retry Deck Generation" proceeds without showing any visual QA modal
errors: None - missing UX flow
reproduction: Go to a touch page where deck generation failed, click "Retry Deck Generation"
started: Likely never worked for retry flow

## Eliminated

## Evidence

## Resolution

root_cause: handleRetryGeneration in touch-page-client.tsx calls retryGenerationAction directly without showing the VisualQADialog. The backend retryGeneration already reads inputs.enableVisualQA but the retry API path doesn't accept the parameter from the frontend.
fix: Added VisualQADialog to the retry flow in touch-page-client.tsx. Button now opens dialog first, user chooses visual QA, then enableVisualQA is passed through the full chain: retryGenerationAction -> retryInteractionGeneration (API client) -> agent POST handler -> retryGeneration function -> executeStructureDrivenPipeline.
verification: Type-checked both apps/web and apps/agent -- no new errors introduced. All pre-existing errors are unrelated.
files_changed:
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/web/src/lib/actions/touch-actions.ts
  - apps/web/src/lib/api-client.ts
  - apps/agent/src/mastra/index.ts
  - apps/agent/src/lib/regenerate-stage.ts
