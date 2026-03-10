---
phase: quick-25
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/touch/stage-approval-bar.tsx
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
  - apps/web/src/lib/actions/touch-actions.ts
  - apps/web/src/lib/api-client.ts
  - apps/agent/src/mastra/index.ts
  - apps/agent/src/lib/regenerate-stage.ts
autonomous: true
requirements: [QUICK-25]

must_haves:
  truths:
    - "Clicking Re-generate shows an AlertDialog asking whether to wipe all previous data"
    - "Choosing 'Wipe & Regenerate' clears all prior stage data then regenerates from skeleton"
    - "Choosing 'Just Regenerate' performs the existing regeneration behavior unchanged"
    - "After wipe, FeedbackSignals are deleted and stageContent/generatedContent/driveFileId/outputRefs are null"
  artifacts:
    - path: "apps/web/src/components/touch/stage-approval-bar.tsx"
      provides: "AlertDialog with wipe option before feedback popover"
    - path: "apps/agent/src/lib/regenerate-stage.ts"
      provides: "Wipe logic that resets interaction data before regeneration"
  key_links:
    - from: "apps/web/src/components/touch/stage-approval-bar.tsx"
      to: "touch-page-client.tsx handleRegenerate"
      via: "onRegenerate callback now passes (feedback?, wipeData?)"
      pattern: "onRegenerate\\("
    - from: "apps/web/src/lib/api-client.ts"
      to: "/interactions/:id/regenerate-stage"
      via: "POST body with wipeData boolean"
      pattern: "wipeData"
    - from: "apps/agent/src/lib/regenerate-stage.ts"
      to: "prisma.feedbackSignal.deleteMany"
      via: "wipe logic before regeneration"
      pattern: "deleteMany"
---

<objective>
Add a confirmation dialog to the regenerate flow that gives users the option to wipe all previous step data (FeedbackSignals, stageContent, generatedContent, driveFileId, outputRefs) and restart from skeleton, or just regenerate the current stage as before.

Purpose: Users sometimes want a clean slate when regenerating, not just a re-run of the current stage. This avoids stale artifacts from prior stages influencing the new generation.
Output: Updated regenerate UI with AlertDialog, threaded wipeData parameter through the full stack, and backend wipe logic.
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
@apps/agent/src/mastra/index.ts
@apps/agent/src/lib/regenerate-stage.ts

<interfaces>
<!-- Existing UI component used for the dialog -->
From apps/web/src/components/ui/alert-dialog.tsx:
AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
AlertDialogTitle, AlertDialogTrigger

<!-- Current regenerate callback signature (will be extended) -->
From stage-approval-bar.tsx:
```typescript
interface StageApprovalBarProps {
  onRegenerate?: (feedback?: string) => void;
  isRegenerating?: boolean;
  // ... other props
}
```

<!-- Current API function signature (will be extended) -->
From api-client.ts:
```typescript
export async function regenerateInteractionStage(
  interactionId: string,
  feedback?: string
): Promise<{ success: boolean; stage: string }>
```

<!-- Current backend function signature (will be extended) -->
From regenerate-stage.ts:
```typescript
export async function regenerateStage(
  interactionId: string,
  feedback?: string
): Promise<{ success: boolean; stage: string }>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add wipe confirmation AlertDialog to stage-approval-bar and thread wipeData through frontend</name>
  <files>
    apps/web/src/components/touch/stage-approval-bar.tsx,
    apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx,
    apps/web/src/lib/actions/touch-actions.ts,
    apps/web/src/lib/api-client.ts
  </files>
  <action>
  1. **stage-approval-bar.tsx** -- Modify the regenerate flow:
     - Add `useState<boolean>(false)` for `showWipeDialog`.
     - When the Re-generate button is clicked, instead of opening the Popover directly, open an AlertDialog first.
     - The AlertDialog asks: "Start fresh?" with description "Would you like to wipe all previous data for this step and start from scratch, or just re-generate the current stage?"
     - Two action buttons: "Wipe & Re-generate" (destructive variant) and "Just Re-generate" (outline variant). Plus a Cancel button.
     - Both action buttons close the dialog and then open the feedback Popover (existing behavior). Store the user's wipe choice in a `useState<boolean>` called `wipeData`.
     - Update the `onRegenerate` callback type from `(feedback?: string) => void` to `(feedback?: string, wipeData?: boolean) => void`.
     - In `handleSkip` and `handleSubmitFeedback`, pass `wipeData` state as the second argument to `onRegenerate`.
     - After calling onRegenerate, reset `wipeData` to false.
     - Import AlertDialog components from `@/components/ui/alert-dialog`.
     - Use `cursor-pointer` on all clickable elements per project UI conventions.

  2. **touch-page-client.tsx** -- Update `handleRegenerate` callback:
     - Change signature to `async (feedback?: string, wipeData?: boolean)`.
     - Pass `wipeData` to `regenerateStageAction`.

  3. **touch-actions.ts** -- Update `regenerateStageAction`:
     - Add `wipeData?: boolean` parameter.
     - Pass it to `regenerateInteractionStage`.

  4. **api-client.ts** -- Update `regenerateInteractionStage`:
     - Add `wipeData?: boolean` parameter.
     - Include `wipeData` in the JSON body: `JSON.stringify({ feedback: feedback || undefined, wipeData: wipeData || undefined })`.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>AlertDialog appears before feedback popover when clicking Re-generate. User choice (wipe or not) is threaded through touch-page-client -> touch-actions -> api-client as wipeData boolean in POST body. TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Implement backend wipe logic and thread wipeData through route and regenerateStage</name>
  <files>
    apps/agent/src/mastra/index.ts,
    apps/agent/src/lib/regenerate-stage.ts
  </files>
  <action>
  1. **apps/agent/src/mastra/index.ts** -- Update the `/interactions/:id/regenerate-stage` route handler:
     - Extend the zod parse schema to include `wipeData: z.boolean().optional()`.
     - Pass `data.wipeData` to `regenerateStage(id, data.feedback, data.wipeData)`.

  2. **apps/agent/src/lib/regenerate-stage.ts** -- Update `regenerateStage` function:
     - Add `wipeData?: boolean` as third parameter.
     - At the top of the function, AFTER fetching the interaction but BEFORE any stage-specific logic, add a wipe block:

     ```typescript
     if (wipeData) {
       // Delete all feedback signals for this interaction
       await prisma.feedbackSignal.deleteMany({
         where: { interactionId },
       });

       // Reset all generated artifacts
       await prisma.interactionRecord.update({
         where: { id: interactionId },
         data: {
           stageContent: null,
           generatedContent: null,
           driveFileId: null,
           outputRefs: null,
           hitlStage: "skeleton",
           status: "processing",
         },
       });

       // Re-fetch the interaction after wipe since hitlStage changed
       // (the stage variable was derived from the pre-wipe state)
       // Force stage to "skeleton" since we just reset it
     }
     ```

     - After the wipe block, override the `stage` variable: if `wipeData` is true, set `stage = "skeleton"` so regeneration starts from the beginning regardless of what stage the interaction was previously on.
     - The rest of the function continues as normal -- the skeleton regeneration logic already handles all touch types.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>When wipeData=true is sent in the POST body: all FeedbackSignals for the interaction are deleted, stageContent/generatedContent/driveFileId/outputRefs are set to null, hitlStage is reset to "skeleton", and regeneration proceeds from skeleton stage. When wipeData is false/undefined, behavior is identical to before.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles in both apps/web and apps/agent without errors
2. The AlertDialog renders with three options (Wipe & Re-generate, Just Re-generate, Cancel)
3. The wipeData boolean flows from UI through touch-actions -> api-client -> route -> regenerateStage
4. When wipeData=true, prisma deleteMany + update executes before regeneration
5. When wipeData=false/undefined, no wipe occurs (backward compatible)
</verification>

<success_criteria>
- Re-generate button opens AlertDialog with wipe/no-wipe choice before showing feedback popover
- "Wipe & Re-generate" deletes FeedbackSignals, nulls stageContent/generatedContent/driveFileId/outputRefs, resets hitlStage to skeleton, then regenerates from skeleton
- "Just Re-generate" behaves exactly as the existing regenerate flow
- Both apps compile without TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/25-add-regenerate-dialog-with-option-to-wip/25-SUMMARY.md`
</output>
