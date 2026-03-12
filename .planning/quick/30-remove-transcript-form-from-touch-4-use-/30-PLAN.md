---
phase: quick-30
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
autonomous: true
requirements: [QUICK-30]
must_haves:
  truths:
    - "Touch 4 page shows the same guided-start card as Touches 1-3 when no interactions exist"
    - "Touch 4 page flows through the HITL stage stepper (skeleton -> lowfi -> highfi -> ready) like other touches"
    - "Touch 4 no longer renders a transcript processing form"
  artifacts:
    - path: "apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx"
      provides: "Touch 4 unified flow without special-case Touch4Form rendering"
  key_links:
    - from: "touch-page-client.tsx handleGenerate"
      to: "startGeneration touch_4 case"
      via: "generateTouch4BriefAction call"
      pattern: "case.*touch_4.*generateTouch4BriefAction"
---

<objective>
Remove the Touch 4 transcript form and make Touch 4 use the same guided-start -> HITL stage flow as Touches 1-3.

Purpose: Users should use the AI assistant chat to add transcripts to a deal. Touch 4 should go straight to outline/draft/generation like other touches, not show a separate transcript processing form.
Output: Touch 4 page renders TouchGuidedStart (same as other touches), not Touch4Form.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
@apps/web/src/components/touch/touch-guided-start.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove Touch 4 special-case rendering and clean up startGeneration</name>
  <files>apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx</files>
  <action>
1. Remove the `Touch4Form` import (line 11).

2. Remove the entire Touch 4 special-case block (lines 622-639) that currently short-circuits rendering to show `Touch4Form` instead of the normal flow:
```
// Touch 4 always renders its own form (manages its own workflow lifecycle)
if (touchType === "touch_4") {
  return (
    <TouchContextProvider value={touchContext}>
      ...
      <Touch4Form ... />
    </TouchContextProvider>
  );
}
```
By removing this block, Touch 4 will fall through to the normal flow: no interactions -> TouchGuidedStart, active interaction -> HITL workflow with TouchPageShell.

3. In the `startGeneration` function (line 919-925), the `touch_4` case currently passes empty transcript and industry as subsector. This is fine as-is because the agent workflow will pull transcript data from deal chat context (added in quick task 29). No changes needed to the function signature -- it already accepts the same params as other touches.

4. Do NOT delete the `touch-4-form.tsx` component file itself -- it may be referenced elsewhere or useful for future reference. Just remove the import and rendering from the page client.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Touch 4 page no longer imports or renders Touch4Form. Touch 4 shows TouchGuidedStart when no interactions exist and follows the standard HITL stage flow, identical to Touches 1-3.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- No references to Touch4Form remain in touch-page-client.tsx
- Touch 4 rendering path falls through to TouchGuidedStart (no interactions) or TouchPageShell (active interaction)
</verification>

<success_criteria>
- Touch 4 page shows "Ready to Generate" card (TouchGuidedStart) when no prior interactions exist
- Touch 4 page uses the HITL stage stepper flow after generation starts
- No transcript form is rendered on the Touch 4 page
</success_criteria>

<output>
After completion, create `.planning/quick/30-remove-transcript-form-from-touch-4-use-/30-SUMMARY.md`
</output>
