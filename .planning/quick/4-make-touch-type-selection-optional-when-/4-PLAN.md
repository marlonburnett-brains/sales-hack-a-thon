---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/template-form.tsx
  - apps/agent/src/mastra/index.ts
  - apps/web/src/components/__tests__/template-form.test.tsx
autonomous: true
requirements: [QUICK-4]
must_haves:
  truths:
    - "User can add a template without selecting any touch type"
    - "User can still optionally select touch types during template creation"
    - "Template with no touch types stores empty JSON array in database"
  artifacts:
    - path: "apps/web/src/components/template-form.tsx"
      provides: "Form with optional touch type selection"
      contains: "touchTypes: z.array(z.string())"
    - path: "apps/agent/src/mastra/index.ts"
      provides: "API accepting empty touchTypes array"
      contains: "touchTypes: z.array(z.string())"
  key_links:
    - from: "apps/web/src/components/template-form.tsx"
      to: "apps/agent/src/mastra/index.ts"
      via: "createTemplateAction -> POST /templates"
      pattern: "touchTypes.*z\\.array"
---

<objective>
Make touch type selection optional when adding a template. Currently both the frontend
form and backend API enforce `.min(1)` on the touchTypes array, requiring at least one
touch type. Remove this constraint so users can add templates without selecting touch
types and assign them later.

Purpose: Reduce friction when adding templates -- users may not know the touch type yet.
Output: Updated form validation, updated API validation, updated tests.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/components/template-form.tsx
@apps/agent/src/mastra/index.ts
@apps/web/src/components/__tests__/template-form.test.tsx

<interfaces>
From apps/web/src/components/template-form.tsx (line 33-40):
```typescript
const templateFormSchema = z.object({
  name: z.string().min(1, "Display name is required"),
  googleSlidesUrl: z.string().min(1, "Google Slides URL is required")
    .regex(SLIDES_URL_REGEX, "Must be a valid Google Slides URL"),
  touchTypes: z.array(z.string()).min(1, "Select at least one touch type"), // <-- remove .min(1)
});
```

From apps/agent/src/mastra/index.ts (line 883-890):
```typescript
const data = z.object({
  name: z.string().min(1),
  googleSlidesUrl: z.string().url(),
  presentationId: z.string().min(1),
  touchTypes: z.array(z.string()).min(1), // <-- remove .min(1)
}).parse(body);
```

Database: Template.touchTypes is a non-nullable String column storing JSON array.
Empty array "[]" is valid -- no schema migration needed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove touch type min(1) validation from frontend and backend</name>
  <files>apps/web/src/components/template-form.tsx, apps/agent/src/mastra/index.ts</files>
  <action>
  1. In `apps/web/src/components/template-form.tsx` line 39:
     - Change `touchTypes: z.array(z.string()).min(1, "Select at least one touch type")`
     - To `touchTypes: z.array(z.string())`

  2. In `apps/web/src/components/template-form.tsx`, update the Touch Types FormLabel (around line 187):
     - Change `<FormLabel>Touch Types</FormLabel>`
     - To `<FormLabel>Touch Types <span className="text-sm font-normal text-slate-400">(optional)</span></FormLabel>`

  3. In `apps/agent/src/mastra/index.ts` line 888:
     - Change `touchTypes: z.array(z.string()).min(1)`
     - To `touchTypes: z.array(z.string()).default([])`
     - The `.default([])` ensures backward compat if touchTypes is omitted entirely from request body.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -n "min(1" apps/web/src/components/template-form.tsx apps/agent/src/mastra/index.ts | grep -i touch; echo "Exit: $? (expect 1 = no matches)"</automated>
  </verify>
  <done>Neither frontend nor backend enforces minimum touch type selection. Form label shows "(optional)" hint.</done>
</task>

<task type="auto">
  <name>Task 2: Update tests for optional touch types</name>
  <files>apps/web/src/components/__tests__/template-form.test.tsx</files>
  <action>
  1. In the "TMPL-04: Touch type chip assignment" describe block, update the test
     "requires at least one touch type for submission" (line 224-249):
     - Rename to "submits successfully without selecting any touch type"
     - Instead of asserting the error message "Select at least one touch type" appears,
       mock `createTemplateAction` to resolve successfully, fill in name + valid URL,
       do NOT click any touch type chip, click submit, and assert `createTemplateAction`
       was called with `touchTypes: []`.

  2. In the "calls createTemplateAction on valid submission" test (line 118-153):
     - This test already selects Touch 1 -- keep it as-is to confirm touch types still
       work when selected.

  3. Add a new test in the TMPL-04 describe block:
     "submits with multiple touch types selected" -- select Touch 2 and Touch 3,
     submit, assert `createTemplateAction` called with `touchTypes: ["touch_2", "touch_3"]`.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx vitest run apps/web/src/components/__tests__/template-form.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>All template-form tests pass. No test asserts that touch types are required. New test confirms submission works with empty touch types array.</done>
</task>

</tasks>

<verification>
1. `grep -rn "min(1" apps/web/src/components/template-form.tsx` returns no touchTypes matches
2. `grep -rn "min(1" apps/agent/src/mastra/index.ts` returns no touchTypes matches
3. `npx vitest run apps/web/src/components/__tests__/template-form.test.tsx` -- all pass
4. No "Select at least one touch type" error message exists in codebase
</verification>

<success_criteria>
- Templates can be created without selecting any touch type (no validation error)
- Templates can still be created with touch types selected (existing behavior preserved)
- Backend accepts empty touchTypes array and stores "[]" in database
- All existing and new tests pass
- Form shows "(optional)" hint on Touch Types label
</success_criteria>

<output>
After completion, create `.planning/quick/4-make-touch-type-selection-optional-when-/4-SUMMARY.md`
</output>
