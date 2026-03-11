---
type: quick
task: 28
name: Decouple visual QA from slide generation
completed: "2026-03-11T13:67:44Z"
duration: ~12 min
tasks_completed: 2
tasks_total: 2
key-files:
  created:
    - apps/web/src/components/touch/visual-qa-overlay.tsx
    - apps/web/src/app/api/visual-qa/route.ts
  modified:
    - apps/agent/src/generation/route-strategy.ts
    - apps/agent/src/generation/visual-qa.ts
    - apps/agent/src/mastra/index.ts
    - apps/agent/src/lib/regenerate-stage.ts
    - apps/agent/src/generation/structure-driven-workflow.ts
    - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
    - apps/web/src/components/touch/touch-1-form.tsx
    - apps/web/src/components/touch/touch-2-form.tsx
    - apps/web/src/components/touch/touch-3-form.tsx
    - apps/web/src/components/touch/touch-4-form.tsx
    - apps/web/src/lib/actions/touch-actions.ts
    - apps/web/src/lib/api-client.ts
decisions:
  - Visual QA removed from pipeline entirely (not just made optional) -- now exclusively on-demand
  - SSE streaming via ReadableStream for real-time QA progress to client
  - modificationPlans persisted in stageContent JSON for post-generation QA retrieval
  - VisualQADialog removed from all 4 touch forms (no longer needed pre-generation)
---

# Quick Task 28: Decouple Visual QA from Slide Generation

Pipeline returns immediately after text modifications; visual QA runs as on-demand overlay via SSE streaming against the already-generated deck.

## Task 1: Remove visual QA from pipeline, add standalone API endpoint and SSE streaming

**Commit:** 98611f5

### Changes

- **route-strategy.ts**: Removed Step 7 (performVisualQA call) from `executeStructureDrivenPipeline`. Pipeline now returns `assemblyResult` spread with `modificationPlans: activePlans`. Removed `enableVisualQA` from `ExecutePipelineParams`.
- **visual-qa.ts**: Wired `onLog` callback in `performVisualQA` at each step (autofit, checking, issue_found, correcting, complete) for real-time SSE streaming.
- **mastra/index.ts**: Added `POST /visual-qa/run` SSE endpoint that loads modificationPlans from interaction stageContent, runs performVisualQA with SSE streaming via ReadableStream, and streams log/complete/error events.
- **regenerate-stage.ts**: Removed `enableVisualQA` parameter from `retryGeneration`. Persists `modificationPlans` in stageContent JSON for both highfi regeneration and retry paths.
- **structure-driven-workflow.ts**: `executeAndRecordFinalStep` now persists modificationPlans in stageContent alongside presentationId and driveUrl.

## Task 2: Add visual QA overlay to the ready-state UI with on-demand trigger

**Commit:** 754a640

### Changes

- **visual-qa-overlay.tsx** (NEW): Floating overlay component with states: idle (Run Visual QA button), running (pulsing indicator + expandable log feed), complete (green/blue/amber badge), error (retry button). Connects to agent via SSE POST through Next.js API proxy. Auto-scrolls log feed, auto-dismisses clean results after 5 seconds.
- **api/visual-qa/route.ts** (NEW): Next.js API route proxy forwarding POST to agent's `/visual-qa/run` with Supabase JWT auth. Pipes SSE stream through to client.
- **touch-page-client.tsx**: Replaced VisualQADialog import with VisualQAOverlay. Removed `showRetryQADialog` state. Simplified retry handler to call `retryGenerationAction` directly. Added VisualQAOverlay to ready-state render block with presentationId from stageContent.
- **touch-1/2/3/4-form.tsx**: Removed VisualQADialog import, `showQADialog` state, and `enableVisualQA` handling. Generate buttons now call generation directly without QA pre-prompt.
- **touch-actions.ts**: Removed `enableVisualQA` from retryGenerationAction and all form data types.
- **api-client.ts**: Removed `enableVisualQA` from retryInteractionGeneration and all workflow start function signatures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed enableVisualQA references in touch form components**
- **Found during:** Task 2
- **Issue:** Removing `enableVisualQA` from api-client types caused TypeScript errors in all 4 touch form components that were still passing the parameter.
- **Fix:** Removed VisualQADialog integration, showQADialog state, and enableVisualQA passing from all 4 form components. Changed generate buttons to call handler directly.
- **Files modified:** touch-1-form.tsx, touch-2-form.tsx, touch-3-form.tsx, touch-4-form.tsx

## Self-Check: PASSED
