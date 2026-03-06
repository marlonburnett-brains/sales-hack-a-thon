---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/mastra/index.ts
  - apps/web/src/components/template-form.tsx
  - apps/web/src/lib/actions/template-actions.ts
  - apps/web/src/lib/api-client.ts
  - apps/web/src/components/__tests__/template-form.test.tsx
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "Template name is auto-populated from the Google Slides document title"
    - "User no longer sees or fills a Display Name field in the Add Template form"
    - "Template creation still works end-to-end with the name fetched from Drive"
  artifacts:
    - path: "apps/agent/src/mastra/index.ts"
      provides: "POST /templates fetches doc title from Drive and uses it as template name"
      contains: "fields: \"id,name,modifiedTime\""
    - path: "apps/web/src/components/template-form.tsx"
      provides: "Form without Display Name field"
    - path: "apps/web/src/lib/api-client.ts"
      provides: "createTemplate without name parameter"
  key_links:
    - from: "apps/agent/src/mastra/index.ts"
      to: "drive.files.get"
      via: "adds 'name' to fields parameter, uses fileRes.data.name as template name"
      pattern: "name:.*fileRes\\.data\\.name"
    - from: "apps/web/src/components/template-form.tsx"
      to: "apps/web/src/lib/actions/template-actions.ts"
      via: "no longer passes name in createTemplateAction call"
      pattern: "createTemplateAction.*googleSlidesUrl"
---

<objective>
Auto-populate template name from Google Slides document title instead of requiring user input.

Purpose: Simplify the Add Template form by removing the Display Name field -- the agent already calls the Drive API during template creation, so we can fetch the document title there and use it as the template name automatically.

Output: A streamlined 2-field form (URL + touch types) with the agent backend fetching the Slides document title as the template name.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/agent/src/mastra/index.ts (lines 877-948 — POST /templates handler)
@apps/web/src/components/template-form.tsx
@apps/web/src/lib/actions/template-actions.ts
@apps/web/src/lib/api-client.ts
@apps/web/src/components/__tests__/template-form.test.tsx

<interfaces>
<!-- Current contract chain to modify -->

From apps/web/src/lib/api-client.ts:
```typescript
export async function createTemplate(data: {
  name: string;           // REMOVE this field
  googleSlidesUrl: string;
  presentationId: string;
  touchTypes: string[];
}): Promise<CreateTemplateResult>
```

From apps/web/src/lib/actions/template-actions.ts:
```typescript
export async function createTemplateAction(data: {
  name: string;           // REMOVE this field
  googleSlidesUrl: string;
  presentationId: string;
  touchTypes: string[];
}): Promise<CreateTemplateResult>
```

From apps/agent/src/mastra/index.ts (POST /templates zod schema):
```typescript
const data = z.object({
  name: z.string().min(1),           // Make optional or remove
  googleSlidesUrl: z.string().url(),
  presentationId: z.string().min(1),
  touchTypes: z.array(z.string()).min(1),
}).parse(body);
```

From apps/agent/src/mastra/index.ts (Drive call, line 899):
```typescript
const fileRes = await drive.files.get({
  fileId: data.presentationId,
  fields: "id,modifiedTime",        // ADD "name" here
  supportsAllDrives: true,
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Agent backend -- fetch doc title from Drive, make name optional</name>
  <files>apps/agent/src/mastra/index.ts</files>
  <action>
In the POST /templates handler (line 877-948):

1. Change the zod schema to make `name` optional with a default fallback:
   ```typescript
   name: z.string().optional(),
   ```

2. Update the Drive `fields` parameter from `"id,modifiedTime"` to `"id,name,modifiedTime"` (line 901).

3. After the Drive files.get call succeeds, extract the document title:
   ```typescript
   const docTitle = fileRes.data.name || "Untitled Presentation";
   ```

4. Use the fetched title as the template name, falling back to any client-provided name, then to "Untitled Presentation":
   ```typescript
   const templateName = docTitle || data.name || "Untitled Presentation";
   ```

5. In the `prisma.template.create` call (line 928-936), change `name: data.name` to `name: templateName`.

6. For the Drive error catch block (when access fails), use the client-provided name or fallback:
   Set `templateName` before the try/catch and update it inside the success path:
   ```typescript
   let templateName = data.name || "Untitled Presentation";
   // ... inside try after Drive call:
   templateName = fileRes.data.name || templateName;
   ```

This ensures: if Drive is accessible, use doc title; if not accessible, use fallback.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsx -e "console.log('agent compiles')" && grep -q '"id,name,modifiedTime"' apps/agent/src/mastra/index.ts && echo "PASS: fields updated"</automated>
  </verify>
  <done>POST /templates fetches document title from Drive API and uses it as the template name. The `name` field is optional in the request body. Fallback to "Untitled Presentation" when Drive access fails.</done>
</task>

<task type="auto">
  <name>Task 2: Frontend -- remove Display Name field, update API client and server action</name>
  <files>apps/web/src/components/template-form.tsx, apps/web/src/lib/actions/template-actions.ts, apps/web/src/lib/api-client.ts, apps/web/src/components/__tests__/template-form.test.tsx</files>
  <action>
**api-client.ts** (line 572-582):
- Remove `name` from the `createTemplate` function parameter type:
  ```typescript
  export async function createTemplate(data: {
    googleSlidesUrl: string;
    presentationId: string;
    touchTypes: string[];
  }): Promise<CreateTemplateResult>
  ```

**template-actions.ts** (line 25-34):
- Remove `name` from the `createTemplateAction` parameter type:
  ```typescript
  export async function createTemplateAction(data: {
    googleSlidesUrl: string;
    presentationId: string;
    touchTypes: string[];
  }): Promise<CreateTemplateResult>
  ```

**template-form.tsx**:
1. Remove `name` from the zod schema (`templateFormSchema`). Schema becomes:
   ```typescript
   const templateFormSchema = z.object({
     googleSlidesUrl: z.string().min(1, "Google Slides URL is required")
       .regex(SLIDES_URL_REGEX, "Must be a valid Google Slides URL"),
     touchTypes: z.array(z.string()).min(1, "Select at least one touch type"),
   });
   ```

2. Remove `name: ""` from `defaultValues`.

3. Remove the entire `<FormField control={form.control} name="name" ...>` block (lines 139-151).

4. In the `onSubmit` function, remove `name: values.name` from the `createTemplateAction` call:
   ```typescript
   const result = await createTemplateAction({
     googleSlidesUrl: values.googleSlidesUrl,
     presentationId,
     touchTypes: values.touchTypes,
   });
   ```

**template-form.test.tsx**:
1. Update `openDialog()`: Change the `waitFor` assertion from checking for "Display Name" to checking for "Google Slides URL" (since Display Name no longer exists).

2. In test "renders trigger button and opens dialog on click": Remove assertion for "Display Name".

3. In test "shows form fields: name, URL, and touch type chips": Remove the `getByPlaceholderText("e.g. Q1 Proposal Deck")` assertion. Update test name to "shows form fields: URL and touch type chips".

4. In test "shows validation error when URL is invalid": Remove the line that types into the name field.

5. In test "calls createTemplateAction on valid submission": Remove the line that types into the name field. Update the `toHaveBeenCalledWith` assertion to NOT include `name`:
   ```typescript
   expect(mockCreateTemplateAction).toHaveBeenCalledWith({
     googleSlidesUrl: "https://docs.google.com/presentation/d/abc123xyz/edit",
     presentationId: "abc123xyz",
     touchTypes: ["touch_1"],
   });
   ```

6. In test "shows service account email alert": Remove the line that types into the name field.

7. In test "requires at least one touch type": Remove the line that types into the name field.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx vitest run apps/web/src/components/__tests__/template-form.test.tsx --reporter=verbose 2>&1 | tail -20</automated>
  </verify>
  <done>Display Name field removed from form UI. Server action and API client no longer send `name`. All template-form tests pass with updated assertions (no references to Display Name or name placeholder).</done>
</task>

</tasks>

<verification>
1. All template-form tests pass: `npx vitest run apps/web/src/components/__tests__/template-form.test.tsx`
2. Agent compiles without errors: `cd apps/agent && npx tsc --noEmit 2>&1 | head -20`
3. Web app compiles without errors: `cd apps/web && npx next build 2>&1 | tail -10` (or `npx tsc --noEmit`)
4. Grep confirms no remaining references to Display Name in template-form: `grep -n "Display Name\|name.*required\|e\.g\. Q1" apps/web/src/components/template-form.tsx` should return nothing
5. Grep confirms Drive fields include name: `grep -n "fields.*name.*modifiedTime" apps/agent/src/mastra/index.ts`
</verification>

<success_criteria>
- Add Template form shows only 2 fields: Google Slides URL and Touch Types
- POST /templates agent endpoint fetches the document title from Google Drive API
- Template is created with the Slides document title as its name
- If Drive access check fails, template name falls back to "Untitled Presentation"
- All existing template-form tests pass (updated to reflect no name field)
</success_criteria>

<output>
After completion, create `.planning/quick/3-auto-populate-template-name-from-google-/3-SUMMARY.md`
</output>
