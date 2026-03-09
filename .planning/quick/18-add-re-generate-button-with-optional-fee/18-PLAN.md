---
phase: quick-18
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/touch/stage-approval-bar.tsx
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
autonomous: true
requirements: [REGEN-01]
must_haves:
  truths:
    - "User sees a Re-generate button next to the Approve button at every HITL stage (skeleton, lowfi, highfi)"
    - "Clicking Re-generate opens a dialog/popover with an optional textarea for feedback"
    - "Submitting the dialog (with or without feedback) reverts to the current stage and starts a new generation run"
    - "The feedback text is passed as extra context to the generation workflow"
  artifacts:
    - path: "apps/web/src/components/touch/stage-approval-bar.tsx"
      provides: "Re-generate button with optional feedback dialog"
    - path: "apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx"
      provides: "handleRegenerate callback wiring feedback into generation flow"
  key_links:
    - from: "stage-approval-bar.tsx"
      to: "touch-page-client.tsx"
      via: "onRegenerate callback prop"
      pattern: "onRegenerate"
    - from: "touch-page-client.tsx"
      to: "revertStageAction + startGeneration"
      via: "handleRegenerate function"
      pattern: "handleRegenerate"
---

<objective>
Add a "Re-generate" button at every HITL stage of the touch flow. When clicked, it opens a small dialog with an optional feedback textarea. Submitting reverts the interaction to the current stage (clearing downstream content) and re-triggers the generation workflow, passing the user's feedback as additional context.

Purpose: Let users iterate on generated content without fully approving — they can say "make the headline more aggressive" and get a fresh generation at the current stage.
Output: Updated StageApprovalBar with re-generate button + dialog, updated TouchPageClient with regeneration handler.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/components/touch/stage-approval-bar.tsx
@apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
@apps/web/src/lib/actions/touch-actions.ts
@apps/web/src/lib/api-client.ts

<interfaces>
From apps/web/src/components/touch/stage-approval-bar.tsx:
```typescript
interface StageApprovalBarProps {
  stage: HitlStage;
  onApprove: () => void;
  isApproving?: boolean;
  isFinalStage?: boolean;
}
```

From apps/web/src/lib/actions/touch-actions.ts:
```typescript
export async function revertStageAction(interactionId: string, targetStage: HitlStage): Promise<{ success: boolean }>;
export async function transitionStageAction(interactionId: string, runId: string, stepId: string, touchType: string, decision: "approved" | "refined", refinedContent?: unknown): Promise<WorkflowRunResult>;
```

From touch-page-client.tsx:
```typescript
// startGeneration already accepts touchType, dealId, companyName, industry
// The 'context' field in touch_1 case is where feedback can be injected
async function startGeneration(touchType, dealId, companyName, industry)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Re-generate button with feedback dialog to StageApprovalBar</name>
  <files>apps/web/src/components/touch/stage-approval-bar.tsx</files>
  <action>
Update `StageApprovalBar` to include a "Re-generate" button to the LEFT of the existing Approve button.

1. Add a new prop `onRegenerate: (feedback?: string) => void` and `isRegenerating?: boolean` to `StageApprovalBarProps`.

2. Add a "Re-generate" button (variant="outline") to the left of the approve button. Use the `RefreshCw` icon from lucide-react.

3. When the Re-generate button is clicked, show a Popover (from `@/components/ui/popover`) anchored to the button containing:
   - A short label: "Add feedback (optional)"
   - A `Textarea` (from `@/components/ui/textarea`) with placeholder "e.g. Make the headline more aggressive, focus on cost savings..."
   - A row with "Skip" (variant="ghost", calls `onRegenerate()` with no feedback) and "Re-generate" (variant="default", calls `onRegenerate(feedbackText)` with the textarea value)
   - The popover should close after either button is clicked

4. Disable both the Re-generate button and Approve button when `isRegenerating` is true. Show a spinner on the Re-generate button when `isRegenerating` is true.

5. Keep the existing layout: left side has the hint text, right side has the buttons. Put the Re-generate button before the Approve button in the right-side flex container.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>StageApprovalBar renders a Re-generate button with popover feedback dialog. Props include onRegenerate callback and isRegenerating state. TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Wire handleRegenerate in TouchPageClient to revert + re-generate with feedback</name>
  <files>apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx</files>
  <action>
Wire the new `onRegenerate` prop through to `StageApprovalBar` via `TouchPageShell`, and implement the regeneration logic in `TouchPageClient`.

1. **Update TouchPageShell props** (`apps/web/src/components/touch/touch-page-shell.tsx`): Add `onRegenerate?: (feedback?: string) => void` and `isRegenerating?: boolean` to `TouchPageShellProps`. Pass these through to `StageApprovalBar`.

2. **Add `isRegenerating` state** in `TouchPageClient`:
   ```typescript
   const [isRegenerating, setIsRegenerating] = useState(false);
   ```

3. **Create `handleRegenerate` callback** in `TouchPageClient`:
   - Accept `feedback?: string` parameter
   - Set `isRegenerating(true)`
   - Call `revertStageAction(activeInteraction.id, currentStage)` to revert the interaction to the current stage (this clears downstream content so it regenerates fresh)
   - Then call `startGeneration(touchType, dealId, companyName, industry)` but modify it to include the feedback. To do this, update the `startGeneration` function signature to accept an optional 5th parameter `feedback?: string`, and when `feedback` is provided:
     - For `touch_1`: append feedback to the `context` field: `Generate a first-contact pager for ${companyName} in ${industry}. User feedback: ${feedback}`
     - For `touch_2`: pass feedback as the `context` field
     - For `touch_3`: pass feedback as the `context` field
     - For `touch_4`: pass feedback as the `additionalNotes` field
   - After getting the runId back, set `isRegenerating(false)`, set `isGenerating(true)`, set generation message to "Re-generating with your feedback...", and start polling with `startPolling(result.runId)`
   - On error: `setIsRegenerating(false)`, toast error

4. **Pass to TouchPageShell**: In both the "Active stage" render and the "isReady" render sections, pass `onRegenerate={handleRegenerate}` and `isRegenerating={isRegenerating}` to `TouchPageShell`. For the "isReady" section (all stages completed), the Re-generate button should also appear -- pass it through. Note: in the isReady case, `currentStage` is null, so before calling revertStageAction, revert to "highfi" (the last real stage) so the workflow re-runs the final stage.

5. **Disable approve while regenerating**: Pass `isRegenerating` to the approval bar so both buttons are disabled during regeneration.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
- Re-generate button visible at every HITL stage (skeleton, lowfi, highfi) and on the "ready" screen
- Clicking Re-generate opens feedback popover
- Submitting with or without feedback reverts the stage and starts a new generation
- Feedback text flows through to the workflow as additional context
- TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compilation passes: `cd apps/web && npx tsc --noEmit`
2. Visual check: navigate to any touch page with an active HITL stage. Verify the Re-generate button appears next to Approve.
3. Functional check: click Re-generate, enter feedback, submit. Verify the page shows generation progress and eventually returns to the stage with new content.
</verification>

<success_criteria>
- Re-generate button appears at skeleton, lowfi, and highfi stages
- Optional feedback dialog works (can skip or provide text)
- Regeneration reverts the current stage and starts a new workflow run
- Feedback text is included in the workflow input as additional context
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/18-add-re-generate-button-with-optional-fee/18-SUMMARY.md`
</output>
