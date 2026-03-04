# Phase 13: Touch 4 Poll Loop & Integration Fixes - Research

**Researched:** 2026-03-04
**Domain:** React client-side polling, form state machine extension, UI display fixes
**Confidence:** HIGH

## Summary

This phase wires existing but unused code paths in the Touch 4 inline form to show real-time asset generation progress after brief approval, and fixes three integration display issues. All the building blocks already exist: `TOUCH_4_ASSET_PIPELINE_STEPS` (7 steps), `PipelineStepper` component, `assetGenerating`/`awaitingAssetReview` form states, `checkTouch4StatusAction` server action, and the Monotonic Set pattern for flicker-free step tracking. The work is purely client-side wiring and display fix changes.

The core change is in `touch-4-form.tsx`: after `handleApprove` calls `approveBriefAction` (which resumes the workflow server-side), the form must transition to `assetGenerating` state and start polling `checkTouch4StatusAction` to track steps 9-15 (rag-retrieval through check-brand-compliance) via the same `pollStatus` callback used for extracting/generating phases. When the workflow reaches `await-asset-review` (SUSPEND 3), the form transitions to `awaitingAssetReview` with a direct link to the asset review page.

Three additional fixes are small, isolated changes: (1) add `pre_call` to `TOUCH_LABELS`/`TOUCH_COLORS` in `timeline-entry.tsx`, (2) fix the primary data extraction path in `pre-call-form.tsx` line 159 where `output.generatedContent` should read from a field that actually exists in the step output, and (3) add pre-call expanded content to the timeline entry.

**Primary recommendation:** Extend `handleApprove` to transition to `assetGenerating` and invoke a new `pollAssetPipeline` function that reuses the existing `pollStatus` with `TOUCH_4_ASSET_PIPELINE_STEPS` visible steps. All other fixes are 1-5 line changes in existing files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- After brief approval, replace the approval UI inline with the asset generation stepper (same pattern as extracting/generating states)
- Show a small "Brief Approved" header with green checkmark above the PipelineStepper
- Use TOUCH_4_ASSET_PIPELINE_STEPS (7 steps already defined in pipeline-steps.ts)
- Poll interval: 3 seconds (matches brief approval polling from Phase 6)
- Use Monotonic Set pattern for completed steps (prevents stepper flicker, established in Phase 11)
- On pipeline failure: show error on the failed step + retry button (matches extracting/generating error handling)
- When pipeline completes, show all-green stepper for 1-2 seconds, then transition to inline "Assets ready for review" banner with link to asset review page
- "Review Assets" button links directly to /deals/[dealId]/asset-review/[interactionId] (standalone review page)
- Call router.refresh() when transitioning to awaitingAssetReview so deal page card and timeline update in the background
- Pre-call timeline color: teal -- bg-teal-100 text-teal-800
- Pre-call timeline label: "Pre-Call"
- No lifecycle status badge for pre-call (single-step flow)
- Expanded content: Drive doc link prominently displayed + buyer role and number of discovery questions generated
- Fix primary path to read the correct field from record-interaction step output
- Fallback paths (lines 183-231) already work correctly -- no changes needed there

### Claude's Discretion
- Exact retry mechanism for asset pipeline failures (re-approve vs re-trigger)
- How to source interactionId for the asset review page link
- Pre-call timeline expanded content layout details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component state, hooks (useState, useCallback) | Already in use across all form components |
| Next.js 15 | 15.x | App Router, router.refresh(), server actions | Project standard |
| lucide-react | latest | Icons (CheckCircle, Loader2, RotateCcw, ExternalLink) | Already used in touch-4-form.tsx |
| sonner | latest | Toast notifications for errors | Already used in touch-4-form.tsx |
| Tailwind v3.4 | 3.4.x | Utility classes for all UI | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui | N/A | Button, Badge, Alert, Separator components | Already imported in all target files |

### Alternatives Considered
None -- this phase uses only existing project dependencies. No new libraries needed.

## Architecture Patterns

### Pattern 1: Form State Machine Extension
**What:** The `touch-4-form.tsx` uses a TypeScript union type `FormState` with 11 states. The `assetGenerating` and `awaitingAssetReview` states are already defined but their render branches are placeholder/dead code.
**When to use:** Now -- wire the existing states with proper polling logic.
**Current dead code (lines 865-898):**
```typescript
// Currently: assetGenerating shows only GenerationProgress (no stepper, no polling)
if (state === "assetGenerating") {
  return (
    <div className="pt-2">
      <Separator className="mb-4" />
      <GenerationProgress message="Generating proposal assets..." />
    </div>
  );
}

// Currently: awaitingAssetReview shows generic info alert with no link
if (state === "awaitingAssetReview") {
  return (
    <div className="space-y-4 pt-2">
      <Separator />
      <Alert className="border-blue-200 bg-blue-50">
        {/* No link to asset review page */}
      </Alert>
    </div>
  );
}
```

### Pattern 2: handleApprove -> Start Asset Pipeline Polling
**What:** After `approveBriefAction` succeeds, transition to `assetGenerating` state and start a new poll loop. The workflow is already running server-side (the approval endpoint resumes the workflow). The client just needs to poll for step progress.
**Key insight:** The existing `pollStatus` callback tracks steps from `TOUCH_4_EXTRACT_STEPS` and `TOUCH_4_BRIEF_STEPS` (line 151). For the asset phase, it needs to also track `TOUCH_4_ASSET_PIPELINE_STEPS`. The simplest approach: pass the visible steps as a parameter to the poll logic, or inline a dedicated asset-polling function.

**Approval flow (server side, already working):**
1. `approveBriefAction` -> POST `/briefs/:briefId/approve`
2. Server resumes workflow at `await-brief-approval` step
3. Workflow continues: `finalize-approval` -> `rag-retrieval` -> ... -> `check-brand-compliance` -> `await-asset-review` (SUSPEND 3)
4. Client polls `checkTouch4StatusAction(runId)` which calls `getTouch4WorkflowStatus(runId)`
5. Step status objects in `status.steps` include step IDs matching `TOUCH_4_ASSET_PIPELINE_STEPS`

### Pattern 3: Monotonic Set for Stepper Steps (Established Phase 11)
**What:** `new Set([...prev, ...newCompleted])` -- once a step is marked complete, it stays complete even if a poll response temporarily omits it.
**Current implementation (touch-4-form.tsx line 143-147):**
```typescript
const newCompleted = new Set(completedSteps);
Object.entries(steps).forEach(([id, step]) => {
  if ((step as Record<string, unknown>).status === "completed")
    newCompleted.add(id);
});
setCompletedSteps(newCompleted);
```
**Important:** The current `pollStatus` closes over `completedSteps` from its creation scope (empty dependency array at line 253). For the asset polling phase, the poll function must either be newly created or must properly reference the latest completedSteps. The current implementation creates a new Set from `completedSteps` on each iteration, but since `pollStatus` is memoized with `[]` deps, it captures the initial empty set. This works for extract/brief phases because they start from empty. For asset polling, a NEW poll invocation will also start from the current `completedSteps` state, which is fine -- the important thing is to reset `completedSteps` before starting asset polling so only asset step IDs accumulate.

### Pattern 4: InteractionId Sourcing for Asset Review Link
**What:** The asset review page URL is `/deals/[dealId]/asset-review/[interactionId]`. The `interactionId` is already available in the form's state:
- Set at line 361: `setInteractionId(pollResult.interactionId)` during brief approval polling
- Also available from `handleContinueFromReview` at line 376
- Also extractable from workflow status: `steps["record-interaction"]?.output?.interactionId`

**Recommendation:** Use the `interactionId` already stored in component state. It is set before the form reaches `awaitingApproval`, which is before `handleApprove` fires. No additional sourcing needed.

### Pattern 5: Detecting Pipeline Completion
**What:** The workflow suspends at step `await-asset-review` (SUSPEND 3) after all 7 asset pipeline steps complete. When polling, check for:
1. `status.status === "suspended"` AND `steps["await-asset-review"]?.payload` exists
2. This signals all asset steps are done and the workflow is waiting for asset review

**Step IDs to match (from workflow):**
| Step # | Step ID | Pipeline Steps Array ID |
|--------|---------|------------------------|
| 8 | finalize-approval | (not in stepper -- internal) |
| 9 | rag-retrieval | rag-retrieval |
| 10 | assemble-slide-json | assemble-slide-json |
| 11 | generate-custom-copy | generate-custom-copy |
| 12 | create-slides-deck | create-slides-deck |
| 13 | create-talk-track | create-talk-track |
| 14 | create-buyer-faq | create-buyer-faq |
| 15 | check-brand-compliance | check-brand-compliance |
| 16 | await-asset-review | (SUSPEND -- triggers transition) |

### Pattern 6: Pre-Call Data Extraction Fix
**What:** In `pre-call-form.tsx` line 157-159, the primary extraction path reads `output.generatedContent` from the `record-interaction` step output. But the `record-interaction` step's `outputSchema` only has `{interactionId, docUrl, documentId}` -- NOT `generatedContent`. The `generatedContent` is stored in the database but not returned in the step output.

**Root cause:** The step output schema does not include `generatedContent`. The primary path always fails silently, falling through to the step-by-step fallback (lines 183-231).

**Fix options:**
1. Change the primary path to read from the correct step output field names (e.g., `output.interactionId` exists, but `output.generatedContent` doesn't)
2. Since the individual step outputs (research-company, generate-hypotheses, generate-discovery-questions) already contain the data in their specific output fields, and the fallback already works, the simplest fix is to remove the dead primary path code or fix it to read from individual steps first

**Recommended fix:** The simplest and most correct fix: skip trying to read `generatedContent` from `record-interaction` output (it's not there), and instead read structured data from individual step outputs as the primary path. This means the fallback code (lines 183-231) becomes the primary path. The current code at lines 157-180 is dead code.

### Anti-Patterns to Avoid
- **Creating a separate pollAssetStatus function with duplicated logic:** Reuse the existing `pollStatus` callback's step-tracking logic. Only the target condition and visible steps differ.
- **Polling after workflow is already suspended:** Stop polling as soon as `status.status === "suspended"` with `await-asset-review` payload is detected.
- **Not resetting completedSteps before asset polling:** If extract/brief step IDs remain in completedSteps, the stepper won't render correctly. Reset to empty set before starting asset phase polling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pipeline progress display | Custom step list | PipelineStepper component | Already proven, handles all states (completed, active, error) |
| Polling with step tracking | New polling function | Extend existing pollStatus pattern | Same API (checkTouch4StatusAction), same step schema |
| Delay before transition | Custom timer logic | setTimeout with setState | 1-2 second delay for all-green stepper before transitioning |

## Common Pitfalls

### Pitfall 1: Stale Closure in pollStatus
**What goes wrong:** The `pollStatus` useCallback has `[]` dependency array, so `completedSteps` inside it is always the initial value (empty set).
**Why it happens:** React memoization captures the closure at creation time.
**How to avoid:** This is actually fine for the current pattern because `pollStatus` creates a `new Set(completedSteps)` on each poll iteration. As long as a NEW invocation of `pollStatus` starts after `setCompletedSteps` has been called with a fresh set, the initial capture doesn't matter. The asset polling will start a new `while` loop that captures the then-current `completedSteps` via the closure. However, to be safe, reset `completedSteps` to empty before starting asset polling.
**Warning signs:** Steps from previous phases showing up as completed in the asset stepper.

### Pitfall 2: Missing interactionId in awaitingAssetReview State
**What goes wrong:** The "Review Assets" link needs `interactionId` but it might not be set.
**Why it happens:** `interactionId` is set during the brief generation polling phase. If the user navigates away and returns, it could be lost.
**How to avoid:** Use the `interactionId` from component state (set during brief approval polling). Also consider extracting it from the `await-asset-review` step payload if available as a backup.
**Warning signs:** "Review Assets" button has broken/empty href.

### Pitfall 3: Not Calling router.refresh() After Asset Completion
**What goes wrong:** Deal page card and timeline don't update to show "Assets Ready" badge and asset review banner.
**Why it happens:** Next.js server components cache data on the client.
**How to avoid:** Call `router.refresh()` when transitioning to `awaitingAssetReview` state (locked decision from CONTEXT.md).
**Warning signs:** User sees stale deal card/timeline after asset generation completes.

### Pitfall 4: Pre-Call Timeline Entry Shows Raw "pre_call"
**What goes wrong:** Timeline shows "pre_call" instead of "Pre-Call" because `TOUCH_LABELS` doesn't have a `pre_call` key.
**Why it happens:** The fallback at line 77 returns `interaction.touchType` which is the raw DB value.
**How to avoid:** Add `pre_call: "Pre-Call"` to `TOUCH_LABELS` and `pre_call: "bg-teal-100 text-teal-800"` to `TOUCH_COLORS`.
**Warning signs:** Raw snake_case string visible in timeline badges.

## Code Examples

### Example 1: Extended handleApprove with Asset Pipeline Polling
```typescript
// Source: Derived from existing handleApprove (line 392) + pollStatus pattern (line 123)
const handleApprove = async (reviewerName: string) => {
  if (!briefId || !runId) return;
  try {
    await approveBriefAction(briefId, { reviewerName, runId });

    // Reset stepper for asset phase
    setCompletedSteps(new Set());
    setActiveStep(null);
    setErrorStep(null);
    setErrorMessage(null);
    setState("assetGenerating");

    // Start polling for asset pipeline progress
    await pollAssetPipeline(runId);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Approval failed");
  }
};
```

### Example 2: Asset Pipeline Polling Function
```typescript
// Source: Pattern from existing pollStatus (line 123) adapted for asset steps
const pollAssetPipeline = async (currentRunId: string) => {
  const maxAttempts = 120;
  let attempts = 0;
  const interval = 3000; // 3s per locked decision

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, interval));
    attempts++;

    try {
      const status = await checkTouch4StatusAction(currentRunId);
      const steps = status.steps ?? {};

      // Monotonic Set pattern for completed steps
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        Object.entries(steps).forEach(([id, step]) => {
          if ((step as Record<string, unknown>).status === "completed")
            next.add(id);
        });
        return next;
      });

      // Find active step from asset pipeline steps
      const active = TOUCH_4_ASSET_PIPELINE_STEPS.find(
        (s) => steps[s.id] &&
          ((steps[s.id] as Record<string, unknown>).status === "running" ||
           (steps[s.id] as Record<string, unknown>).status === "waiting")
      );
      setActiveStep(active?.id ?? null);

      // Check if workflow suspended at asset review (pipeline complete)
      if (status.status === "suspended" && steps["await-asset-review"]?.payload) {
        // All asset steps done -- show all-green for 1-2 seconds then transition
        setActiveStep(null);
        await new Promise((r) => setTimeout(r, 1500));
        setState("awaitingAssetReview");
        router.refresh();
        return;
      }

      // Check for completion (workflow ran past suspend -- shouldn't happen normally)
      if (status.status === "completed") {
        setState("awaitingAssetReview");
        router.refresh();
        return;
      }

      // Check for failure
      if (status.status === "failed") {
        throw new Error("Asset generation failed");
      }
    } catch (err) {
      if (attempts >= maxAttempts) {
        const msg = err instanceof Error ? err.message : "Asset generation failed";
        toast.error(mapToFriendlyError(msg));
        setErrorStep(activeStep);
        setErrorMessage(mapToFriendlyError(msg));
        return;
      }
    }
  }

  toast.error("Asset generation timed out");
};
```

### Example 3: Updated assetGenerating Render State
```typescript
// Source: Pattern from extracting state (line 567) with "Brief Approved" header
if (state === "assetGenerating") {
  return (
    <div className="space-y-4 pt-2">
      <Separator />
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Brief Approved</span>
      </div>
      <h3 className="text-sm font-medium text-slate-700">
        Generating Proposal Assets
      </h3>
      <PipelineStepper
        steps={TOUCH_4_ASSET_PIPELINE_STEPS}
        completedStepIds={completedSteps}
        activeStepId={activeStep}
        errorStepId={errorStep}
        errorMessage={errorMessage}
      />
      {errorStep && (
        <Button
          onClick={handleRetryAssetPipeline}
          variant="outline"
          className="w-full cursor-pointer gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
```

### Example 4: Updated awaitingAssetReview Render State
```typescript
// Source: Pattern from existing awaitingAssetReview (line 875) with direct link
if (state === "awaitingAssetReview") {
  return (
    <div className="space-y-4 pt-2">
      <Separator />
      <div className="flex items-center gap-1.5 text-green-600">
        <CheckCircle className="h-4 w-4" />
        <span className="text-xs font-medium">Brief Approved</span>
      </div>
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">
          Assets ready for review
        </AlertTitle>
        <AlertDescription className="text-green-700">
          All proposal assets have been generated. Review them before delivery.
        </AlertDescription>
      </Alert>
      <Button asChild className="w-full cursor-pointer gap-2">
        <Link href={`/deals/${dealId}/asset-review/${interactionId}`}>
          Review Assets
        </Link>
      </Button>
    </div>
  );
}
```

### Example 5: Timeline Entry pre_call Addition
```typescript
// Source: timeline-entry.tsx TOUCH_COLORS and TOUCH_LABELS maps
const TOUCH_COLORS: Record<string, string> = {
  touch_1: "bg-blue-100 text-blue-800",
  touch_2: "bg-green-100 text-green-800",
  touch_3: "bg-purple-100 text-purple-800",
  touch_4: "bg-orange-100 text-orange-800",
  pre_call: "bg-teal-100 text-teal-800",  // ADD
};

const TOUCH_LABELS: Record<string, string> = {
  touch_1: "Touch 1",
  touch_2: "Touch 2",
  touch_3: "Touch 3",
  touch_4: "Touch 4",
  pre_call: "Pre-Call",  // ADD
};
```

### Example 6: Pre-Call Timeline Expanded Content
```typescript
// Source: timeline-entry.tsx AccordionContent, add pre_call-specific content
const isPreCall = interaction.touchType === "pre_call";

// Inside AccordionContent:
{isPreCall && (
  <div className="space-y-2">
    {inputs?.buyerRole && (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-slate-500">Buyer Role</p>
        <p className="text-sm text-slate-700">{String(inputs.buyerRole)}</p>
      </div>
    )}
    {generatedContent?.discoveryQuestions && (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-slate-500">
          Discovery Questions Generated
        </p>
        <p className="text-sm text-slate-700">
          {(generatedContent.discoveryQuestions as { questions: unknown[] })?.questions?.length ?? 0} questions
        </p>
      </div>
    )}
    {driveUrl && (
      <a href={driveUrl} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline">
        <ExternalLink className="h-3.5 w-3.5" />
        View Briefing Document
      </a>
    )}
  </div>
)}
```

### Example 7: Pre-Call Form Data Extraction Fix
```typescript
// Source: pre-call-form.tsx line 157-159
// BEFORE (broken -- output.generatedContent doesn't exist in step output):
if (recordStep?.output) {
  const output = recordStep.output as Record<string, unknown>;
  const content = output.generatedContent as string | undefined; // ALWAYS undefined
  // ...
}

// AFTER (fix -- read structured data directly from individual step outputs first):
// The record-interaction step output only has: { interactionId, docUrl, documentId }
// Read docUrl from recordStep output, read structured data from individual steps
if (recordStep?.output) {
  const output = recordStep.output as Record<string, unknown>;
  docUrl = (output.docUrl as string) ?? "";
}
// Then proceed directly to step-by-step extraction (lines 183+)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GenerationProgress spinner for asset generation | PipelineStepper with real-time step progress | This phase | User sees 7-step progress instead of generic spinner |
| Static "approved" state with info banner | Inline stepper -> completion transition -> review link | This phase | No manual navigation needed to see asset progress |
| Pre-call shows raw "pre_call" in timeline | "Pre-Call" label with teal color | This phase | Consistent display with other touch types |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual testing (no automated test framework configured) |
| Config file | None |
| Quick run command | N/A |
| Full suite command | `npx next build` (type checking + build validation) |

### Phase Requirements -> Test Map
This phase has no formal requirement IDs (integration/UX fix phase). Validation is by success criteria:

| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|-------------|
| SC-1 | Poll loop starts after approval, TOUCH_4_ASSET_PIPELINE_STEPS progress displayed | manual | N/A (requires running workflow) | N/A |
| SC-2 | Asset-review banner appears automatically when pipeline completes | manual | N/A | N/A |
| SC-3 | Pre-call form reads correct field from record-interaction step | manual | N/A | N/A |
| SC-4 | Timeline shows "Pre-Call" label with teal color | manual | N/A | N/A |
| SC-5 | Touch 4 E2E: transcript to asset-review without manual intervention | manual | N/A | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/web && npx next build` (type + build check)
- **Per wave merge:** Full build + manual E2E flow test
- **Phase gate:** All 5 success criteria manually verified

### Wave 0 Gaps
None -- no automated test infrastructure needed. Build validation is sufficient for type safety. All criteria require manual E2E workflow execution.

## Open Questions

1. **Retry mechanism for asset pipeline failures**
   - What we know: Error handling pattern shows error on failed step + retry button (matching extracting/generating). The question is whether retry should re-approve (call `approveBriefAction` again) or just re-poll.
   - What's unclear: Whether the workflow can be re-triggered after a failure, or if a new workflow run is needed.
   - Recommendation: Try re-polling first (the workflow may have recovered). If the workflow is in a failed state, the retry should call `approveBriefAction` again to resume, OR show a message directing the user to re-approve. Given that workflow failures at the asset stage are rare in practice (all prior steps have completed), a simple re-poll with error display is sufficient. The user can close and re-open the deal page as a manual fallback.

2. **InteractionId availability in awaitingAssetReview**
   - What we know: `interactionId` is set during brief approval polling (line 361). It persists in component state.
   - What's unclear: If `handleApprove` is called without a prior polling cycle having set `interactionId` (edge case with standalone review page approval).
   - Recommendation: The inline form flow always goes through brief generation polling first, which sets `interactionId`. Use component state. As a defensive fallback, extract from `steps["record-interaction"]?.output?.interactionId` during asset polling.

## Sources

### Primary (HIGH confidence)
- `apps/web/src/components/touch/touch-4-form.tsx` -- Full form state machine, handleApprove, pollStatus, all render branches
- `apps/web/src/components/touch/pipeline-steps.ts` -- TOUCH_4_ASSET_PIPELINE_STEPS definition (7 steps, verified step IDs match workflow)
- `apps/web/src/components/touch/pipeline-stepper.tsx` -- PipelineStepper component API
- `apps/web/src/components/timeline/timeline-entry.tsx` -- TOUCH_LABELS, TOUCH_COLORS maps, accordion content structure
- `apps/web/src/components/pre-call/pre-call-form.tsx` -- Data extraction paths, line 157-159 bug
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` -- 17-step workflow, step IDs, suspend points
- `apps/agent/src/mastra/workflows/pre-call-workflow.ts` -- record-interaction outputSchema (confirms generatedContent is NOT in output)
- `apps/agent/src/mastra/index.ts` -- Brief approval endpoint resumes workflow at await-brief-approval

### Secondary (MEDIUM confidence)
- `apps/web/src/lib/api-client.ts` -- WorkflowRunResult type, getTouch4WorkflowStatus endpoint
- `apps/web/src/lib/actions/touch-actions.ts` -- checkTouch4StatusAction, approveBriefAction
- `apps/web/src/app/deals/[dealId]/page.tsx` -- Deal page layout, asset review banner, interaction timeline

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extending proven patterns (pollStatus, PipelineStepper, Monotonic Set)
- Pitfalls: HIGH -- identified from direct code inspection of actual closure behavior and data flow
- Code examples: HIGH -- derived from existing working code in the same component

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- internal codebase, no external dependency changes)
