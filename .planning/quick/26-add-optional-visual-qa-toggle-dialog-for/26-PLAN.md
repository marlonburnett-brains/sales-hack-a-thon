---
phase: quick-26
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/generation/route-strategy.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts
  - apps/agent/src/mastra/workflows/touch-4-workflow.ts
  - apps/agent/src/lib/regenerate-stage.ts
  - apps/web/src/lib/api-client.ts
  - apps/web/src/lib/actions/touch-actions.ts
  - apps/web/src/components/touch/visual-qa-dialog.tsx
  - apps/web/src/components/touch/touch-1-form.tsx
  - apps/web/src/components/touch/touch-2-form.tsx
  - apps/web/src/components/touch/touch-3-form.tsx
  - apps/web/src/components/touch/touch-4-form.tsx
autonomous: true
requirements: [VISUAL-QA-TOGGLE-01]

must_haves:
  truths:
    - "When user clicks Generate on any touch form, a dialog appears asking whether to enable Visual QA"
    - "Dialog explains that Visual QA leads to better results but takes longer"
    - "Choosing Yes passes enableVisualQA=true through the entire chain to the pipeline"
    - "Choosing No passes enableVisualQA=false and the pipeline skips the visual QA step"
    - "Generation still works correctly regardless of choice"
  artifacts:
    - path: "apps/web/src/components/touch/visual-qa-dialog.tsx"
      provides: "Shared AlertDialog component for Visual QA opt-in"
    - path: "apps/agent/src/generation/route-strategy.ts"
      provides: "enableVisualQA param on ExecutePipelineParams, conditional performVisualQA call"
  key_links:
    - from: "apps/web/src/components/touch/visual-qa-dialog.tsx"
      to: "apps/web/src/components/touch/touch-*-form.tsx"
      via: "onConfirm callback passing enableVisualQA boolean"
    - from: "apps/web/src/lib/actions/touch-actions.ts"
      to: "apps/web/src/lib/api-client.ts"
      via: "enableVisualQA in formData"
    - from: "apps/agent/src/mastra/workflows/touch-*-workflow.ts"
      to: "apps/agent/src/generation/route-strategy.ts"
      via: "enableVisualQA passed to executeStructureDrivenPipeline params"
---

<objective>
Add an optional Visual QA toggle dialog that appears before slide deck generation starts on all touch workflows. The dialog explains that Visual QA produces better results but takes longer, with Yes/No options. The user's choice is threaded through the entire stack (frontend form -> server action -> API client -> workflow -> pipeline) to conditionally execute the visual QA step.

Purpose: Give users control over the quality/speed tradeoff in deck generation.
Output: A shared dialog component, and the enableVisualQA boolean threaded through all touch workflows.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/generation/route-strategy.ts
@apps/agent/src/generation/visual-qa.ts
@apps/web/src/components/touch/touch-1-form.tsx
@apps/web/src/components/ui/alert-dialog.tsx
@apps/web/src/lib/actions/touch-actions.ts
@apps/web/src/lib/api-client.ts

<interfaces>
From apps/agent/src/generation/route-strategy.ts:
```typescript
export interface ExecutePipelineParams {
  blueprint: BlueprintWithCandidates;
  targetFolderId: string;
  deckName: string;
  dealContext: DealContext;
  draftContent?: DraftContent;
  ownerEmail?: string;
}
```

From apps/web/src/components/ui/alert-dialog.tsx:
```typescript
// Radix-based AlertDialog components already available:
// AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
// AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
// AlertDialogAction, AlertDialogCancel
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add enableVisualQA param to pipeline and thread through all backend callers</name>
  <files>
    apps/agent/src/generation/route-strategy.ts,
    apps/agent/src/mastra/workflows/touch-1-workflow.ts,
    apps/agent/src/mastra/workflows/touch-2-workflow.ts,
    apps/agent/src/mastra/workflows/touch-3-workflow.ts,
    apps/agent/src/mastra/workflows/touch-4-workflow.ts,
    apps/agent/src/lib/regenerate-stage.ts
  </files>
  <action>
    **route-strategy.ts:**
    1. Add `enableVisualQA?: boolean` to `ExecutePipelineParams` interface
    2. In `executeStructureDrivenPipeline`, destructure `enableVisualQA` from params (default to `true` for backward compat)
    3. Wrap the existing Step 7 visual QA block (lines ~284-299) in `if (enableVisualQA !== false)` so it runs by default but can be skipped
    4. Add a log line when visual QA is skipped: `console.log('[structure-pipeline] Step 7: Visual QA skipped (user opted out)')`

    **touch-1-workflow.ts:**
    1. Add `enableVisualQA: z.boolean().optional()` to the top-level inputSchema (line ~70)
    2. Add `enableVisualQA: z.boolean().optional()` to `touch1BaseFields` (around line ~56-63, search for the pattern)
    3. In the `assemble-deck` step (the step calling `executeStructureDrivenPipeline` around line ~488), pass `enableVisualQA: inputData.enableVisualQA` in the params object
    4. Thread `enableVisualQA: inputData.enableVisualQA` in every step's return/output where `...touch1BaseFields` are spread (so it propagates through the chain). The field is in baseFields so it auto-propagates through Zod schemas, but ensure the execute functions return it.

    **touch-2-workflow.ts:**
    1. Add `enableVisualQA: z.boolean().optional()` to the top-level `inputSchema` (line ~38)
    2. Add `enableVisualQA: z.boolean().optional()` to `touch2BaseFields` (line ~65-76)
    3. In `assembleDeck` step (calls `executeStructureDrivenPipeline` around line ~453), pass `enableVisualQA: inputData.enableVisualQA`

    **touch-3-workflow.ts:**
    1. Add `enableVisualQA: z.boolean().optional()` to the top-level `inputSchema` (line ~35)
    2. Add `enableVisualQA: z.boolean().optional()` to `touch3BaseFields`
    3. In `assembleDeck` step (calls `executeStructureDrivenPipeline` around line ~439), pass `enableVisualQA: inputData.enableVisualQA`

    **touch-4-workflow.ts:**
    1. Add `enableVisualQA: z.boolean().optional()` to the top-level `inputSchema` (line ~82)
    2. The touch-4 workflow has many steps with inline schemas (not baseFields). Add `enableVisualQA: z.boolean().optional()` to every step's inputSchema and outputSchema that sits between the initial step and the `assembleDeck` step (the one calling `executeStructureDrivenPipeline` around line ~1205). Thread `enableVisualQA: inputData.enableVisualQA` in each step's execute return.
    3. In the step calling `executeStructureDrivenPipeline` (~line 1205), pass `enableVisualQA: inputData.enableVisualQA`

    **regenerate-stage.ts:**
    1. The `regenerateStage` function calls `executeStructureDrivenPipeline` (~line 206). For regeneration, visual QA should default to true (no dialog on regen). No change needed since the default is true. Just verify the call doesn't break.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>All 4 workflow inputSchemas accept enableVisualQA, all executeStructureDrivenPipeline calls pass it through, and the pipeline conditionally skips visual QA when enableVisualQA is false. TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Create Visual QA dialog and integrate into all touch forms with API threading</name>
  <files>
    apps/web/src/components/touch/visual-qa-dialog.tsx,
    apps/web/src/components/touch/touch-1-form.tsx,
    apps/web/src/components/touch/touch-2-form.tsx,
    apps/web/src/components/touch/touch-3-form.tsx,
    apps/web/src/components/touch/touch-4-form.tsx,
    apps/web/src/lib/actions/touch-actions.ts,
    apps/web/src/lib/api-client.ts
  </files>
  <action>
    **visual-qa-dialog.tsx (NEW FILE):**
    Create a shared `VisualQADialog` component using the existing AlertDialog primitives from `@/components/ui/alert-dialog`:
    ```
    interface VisualQADialogProps {
      open: boolean;
      onConfirm: (enableVisualQA: boolean) => void;
      onCancel: () => void;
    }
    ```
    - Title: "Enable Visual Quality Check?"
    - Description: "Visual QA automatically checks each slide for text overflow and layout issues after generation, and attempts to fix them. This produces better results but adds 30-60 seconds to generation time."
    - Two buttons in the footer:
      - AlertDialogCancel: "Skip" (calls `onConfirm(false)`)
      - AlertDialogAction: "Enable Visual QA" (calls `onConfirm(true)`)
    - The dialog should be controlled (open/close via `open` prop)
    - Use `onOpenChange` to handle escape/backdrop clicks -> call `onCancel()`

    **api-client.ts:**
    Add `enableVisualQA?: boolean` to the formData parameter of each `startTouch{1,2,3,4}Workflow` function. Thread it into the body sent to the API endpoint.

    **touch-actions.ts:**
    Add `enableVisualQA?: boolean` to the formData parameter of each `generateTouch{1,2,3,4}*Action` function. Pass it through to the corresponding api-client function.

    **touch-1-form.tsx:**
    1. Import `VisualQADialog` from `./visual-qa-dialog`
    2. Add state: `const [showQADialog, setShowQADialog] = useState(false)`
    3. Modify `handleGenerate`: rename the current logic to `startGeneration(enableVisualQA: boolean)`. The existing generate button onClick should set `setShowQADialog(true)` instead of calling handleGenerate directly.
    4. `VisualQADialog` onConfirm calls `startGeneration(enableVisualQA)` and closes dialog. onCancel calls `setShowQADialog(false)`.
    5. Pass `enableVisualQA` in the `generateTouch1PagerAction` call's formData.
    6. Render `<VisualQADialog open={showQADialog} onConfirm={...} onCancel={...} />` in the JSX.

    **touch-2-form.tsx:**
    Same pattern as touch-1-form: add dialog state, intercept generate button, pass enableVisualQA through `generateTouch2DeckAction`.

    **touch-3-form.tsx:**
    Same pattern as touch-1-form: add dialog state, intercept generate button, pass enableVisualQA through `generateTouch3DeckAction`.

    **touch-4-form.tsx:**
    Same pattern as touch-1-form: add dialog state, intercept generate button, pass enableVisualQA through `generateTouch4BriefAction`.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>All 4 touch forms show a Visual QA dialog before generation. User can choose to enable or skip visual QA. The choice threads through server actions -> API client -> workflow input -> pipeline. TypeScript compiles cleanly on both apps.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit -p apps/agent/tsconfig.json` — agent compiles
2. `npx tsc --noEmit -p apps/web/tsconfig.json` — web compiles
3. Grep check: `grep -r "enableVisualQA" apps/` shows the field in all expected files
4. Grep check: `grep -r "VisualQADialog" apps/web/src/components/touch/` shows import in all 4 touch forms
</verification>

<success_criteria>
- VisualQADialog component exists and is imported by all 4 touch forms
- Clicking Generate on any touch form shows the dialog before generation starts
- enableVisualQA boolean flows from frontend through server actions, API client, workflow input schemas, to executeStructureDrivenPipeline
- When enableVisualQA=false, visual QA step is skipped in route-strategy.ts
- When enableVisualQA=true (or undefined for backward compat), visual QA runs as before
- Both apps compile cleanly with no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/26-add-optional-visual-qa-toggle-dialog-for/26-SUMMARY.md`
</output>
