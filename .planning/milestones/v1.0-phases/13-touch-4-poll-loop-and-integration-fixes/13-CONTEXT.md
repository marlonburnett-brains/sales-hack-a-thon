# Phase 13: Touch 4 Poll Loop & Integration Fixes - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the asset generation poll loop in touch-4-form.tsx after brief approval so the user sees real-time progress through TOUCH_4_ASSET_PIPELINE_STEPS, fix pre-call form primary data extraction path, add pre_call label/color to timeline entry, and verify Touch 4 inline E2E flow. This is a gap closure phase — no new capabilities, only wiring existing dead code and fixing display issues.

</domain>

<decisions>
## Implementation Decisions

### Asset generation progress display
- After brief approval, replace the approval UI inline with the asset generation stepper (same pattern as extracting/generating states)
- Show a small "Brief Approved" header with green checkmark above the PipelineStepper
- Use TOUCH_4_ASSET_PIPELINE_STEPS (7 steps already defined in pipeline-steps.ts)
- Poll interval: 3 seconds (matches brief approval polling from Phase 6)
- Use Monotonic Set pattern for completed steps (prevents stepper flicker, established in Phase 11)
- On pipeline failure: show error on the failed step + retry button (matches extracting/generating error handling)

### Asset completion transition
- When pipeline completes, show all-green stepper for 1-2 seconds, then transition to inline "Assets ready for review" banner with link to asset review page
- "Review Assets" button links directly to /deals/[dealId]/asset-review/[interactionId] (standalone review page)
- Call router.refresh() when transitioning to awaitingAssetReview so deal page card and timeline update in the background

### Pre-call timeline appearance
- Color: teal — bg-teal-100 text-teal-800 (distinct from Touch 1 blue, Touch 2 green, Touch 3 purple, Touch 4 orange)
- Label: "Pre-Call" (short, consistent with "Touch 1", "Touch 2" etc.)
- No lifecycle status badge (pre-call is a single-step flow, no suspend/resume — matches Touch 1-3 pattern)
- Expanded content: Drive doc link prominently displayed + buyer role and number of discovery questions generated (matches how Touch 1-3 show Drive links)

### Pre-call form data extraction
- Fix primary path to read the correct field from record-interaction step output
- Fallback paths (lines 183-231) already work correctly — no changes needed there

### Claude's Discretion
- Exact retry mechanism for asset pipeline failures (re-approve vs re-trigger)
- How to source interactionId for the asset review page link
- Pre-call timeline expanded content layout details

</decisions>

<specifics>
## Specific Ideas

No specific requirements — decisions are clear and implementation-focused.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PipelineStepper` component: Already proven across all touch types, supports errorStepId display
- `TOUCH_4_ASSET_PIPELINE_STEPS`: 7-step definition already exists in pipeline-steps.ts (rag-retrieval through check-brand-compliance)
- `assetGenerating` and `awaitingAssetReview` FormStates: Already defined in touch-4-form.tsx type union, just unused
- `GenerationProgress` component: Exists but may not be needed if PipelineStepper is used instead
- `checkTouch4StatusAction`: Already polls workflow status with step-level progress

### Established Patterns
- Monotonic Set for completed steps: `new Set([...prev, ...newCompleted])` prevents flicker (Phase 11)
- Poll loop pattern: `pollStatus()` callback in touch-4-form.tsx already handles extracting/generating phases — extend for asset phase
- Three-state client form pattern: input/review/result (Phase 4) — touch-4-form uses 9+ states
- Server Actions proxy all API calls via typed api-client (Phase 4)

### Integration Points
- `handleApprove` in touch-4-form.tsx: Currently transitions to "approved" state — needs to transition to "assetGenerating" and start polling
- `checkTouch4StatusAction`: Needs to return step progress for steps 8-16 (asset pipeline steps)
- `TOUCH_LABELS` / `TOUCH_COLORS` in timeline-entry.tsx: Add `pre_call` key
- `pre-call-form.tsx` line 157-159: Fix `output.generatedContent` to correct field name

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-touch-4-poll-loop-and-integration-fixes*
*Context gathered: 2026-03-04*
