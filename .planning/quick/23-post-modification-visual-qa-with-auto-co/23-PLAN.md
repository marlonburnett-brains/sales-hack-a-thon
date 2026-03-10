---
phase: quick-23
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/generation/visual-qa.ts
  - apps/agent/src/generation/modification-executor.ts
  - apps/agent/src/generation/route-strategy.ts
autonomous: true
requirements: [VISUAL-QA-01]
must_haves:
  truths:
    - "After text modifications, autofit is applied to all modified shapes so text shrinks to fit bounding boxes"
    - "Slide thumbnails are rendered and sent to a vision model to detect text overlap or visual issues"
    - "If vision model detects issues, a correction loop shortens/removes text and re-checks (max 2 iterations)"
    - "The QA step is called automatically after executeModifications in the structure-driven pipeline"
  artifacts:
    - path: "apps/agent/src/generation/visual-qa.ts"
      provides: "Post-modification visual QA module with autofit, thumbnail fetch, vision check, and correction loop"
    - path: "apps/agent/src/generation/modification-executor.ts"
      provides: "Updated executor that appends autofit updateShapeProperties requests after text modifications"
    - path: "apps/agent/src/generation/route-strategy.ts"
      provides: "Pipeline integration calling visual QA after modification execution"
  key_links:
    - from: "apps/agent/src/generation/route-strategy.ts"
      to: "apps/agent/src/generation/visual-qa.ts"
      via: "import and call performVisualQA after executeModifications"
      pattern: "performVisualQA"
    - from: "apps/agent/src/generation/visual-qa.ts"
      to: "Google Slides API"
      via: "presentations.pages.getThumbnail for slide rendering"
      pattern: "getThumbnail"
    - from: "apps/agent/src/generation/visual-qa.ts"
      to: "Gemini vision model"
      via: "GoogleGenAI generateContent with inline image data"
      pattern: "generateContent.*inlineData"
---

<objective>
Add a post-modification visual QA loop that (1) applies TEXT_AUTOFIT to modified shapes, (2) renders slide thumbnails and sends them to Gemini 3 Flash for vision-based overlap detection, and (3) runs up to 2 correction iterations if issues are found.

Purpose: After text modifications are applied to Google Slides, replacement text can overflow bounding boxes or overlap adjacent elements. This QA loop auto-detects and auto-corrects these visual issues.

Output: New `visual-qa.ts` module + integration into the structure-driven pipeline.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/generation/modification-executor.ts
@apps/agent/src/generation/route-strategy.ts
@apps/agent/src/generation/modification-plan-schema.ts
@apps/agent/src/lib/google-auth.ts
@apps/agent/src/lib/agent-executor.ts
@apps/agent/src/lib/gcs-thumbnails.ts
@apps/agent/src/env.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From apps/agent/src/generation/modification-executor.ts:
```typescript
export interface ExecuteModificationsParams {
  presentationId: string;
  plans: ModificationPlan[];
  authOptions?: GoogleAuthOptions;
}
export interface ExecuteModificationsResult {
  results: SlideModificationResult[];
  totalApplied: number;
  totalSkipped: number;
}
```

From apps/agent/src/generation/modification-plan-schema.ts:
```typescript
export type ModificationPlan = {
  slideId: string;
  slideObjectId: string;
  modifications: Array<{
    elementId: string;
    currentContent: string;
    newContent: string;
    reason: string;
  }>;
  unmodifiedElements: string[];
}
```

From apps/agent/src/lib/google-auth.ts:
```typescript
export interface GoogleAuthOptions { accessToken?: string; userId?: string; }
export function getSlidesClient(options?: GoogleAuthOptions): slides_v1.Slides;
```

From apps/agent/src/lib/agent-executor.ts:
```typescript
// GoogleGenAI client pattern (used for vision call):
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: env.GOOGLE_AI_STUDIO_API_KEY });
await ai.models.generateContent({ model, contents, config });
```

From apps/agent/src/lib/gcs-thumbnails.ts (thumbnail fetch pattern):
```typescript
// Existing pattern for fetching slide thumbnails:
const thumbResult = await slidesApi.presentations.pages.getThumbnail({
  presentationId,
  pageObjectId: slideObjectId,
  "thumbnailProperties.thumbnailSize": "LARGE",
});
const contentUrl = thumbResult.data.contentUrl;
const response = await fetch(contentUrl);
const imageBuffer = Buffer.from(await response.arrayBuffer());
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create visual QA module with autofit, vision check, and correction loop</name>
  <files>apps/agent/src/generation/visual-qa.ts</files>
  <action>
Create `apps/agent/src/generation/visual-qa.ts` with the following exports:

**1. `applyAutofitToModifiedShapes` function:**
- Accepts `presentationId`, `modifiedElementIds: string[]`, `authOptions?: GoogleAuthOptions`
- Builds `updateShapeProperties` requests for each modified element ID:
  ```typescript
  {
    updateShapeProperties: {
      objectId: elementId,
      shapeProperties: {
        autofit: { autofitType: "TEXT_AUTOFIT" }
      },
      fields: "autofit"
    }
  }
  ```
- Sends a single `presentations.batchUpdate` with all autofit requests
- Logs success/failure with `[visual-qa]` prefix
- Wraps in try/catch; logs warning and continues on failure (autofit is best-effort — some shapes like tables may not support it)

**2. `performVisualQA` function (main export):**
- Signature: `performVisualQA(params: VisualQAParams): Promise<VisualQAResult>`
- `VisualQAParams`: `{ presentationId: string; modifiedPlans: ModificationPlan[]; authOptions?: GoogleAuthOptions }`
- `VisualQAResult`: `{ status: "clean" | "corrected" | "warning"; iterations: number; issues?: string[] }`

Steps:
  a. Collect all modified element IDs from `modifiedPlans` (flatten `plan.modifications.map(m => m.elementId)`)
  b. Call `applyAutofitToModifiedShapes` with those element IDs
  c. Get unique slide object IDs from modifiedPlans
  d. For each slide, fetch thumbnail via `presentations.pages.getThumbnail` (use LARGE size, same pattern as gcs-thumbnails.ts)
  e. Send each thumbnail to Gemini 3 Flash vision model for overlap detection
  f. If all slides clean, return `{ status: "clean", iterations: 0 }`
  g. If issues detected, enter correction loop (max 2 iterations)

**3. `checkSlideForOverlap` helper:**
- Fetches slide thumbnail as PNG buffer using `getSlidesClient` and `presentations.pages.getThumbnail`
- Creates a `GoogleGenAI` client using `env.GOOGLE_AI_STUDIO_API_KEY` (same pattern as agent-executor.ts)
- Calls `ai.models.generateContent` with model `gemini-3-flash-preview`, passing:
  - `contents` as an array with a text part and an inline image part:
    ```typescript
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/png", data: imageBuffer.toString("base64") } },
          { text: "Analyze this presentation slide. Does any text overlap with other text elements? Does any text appear cut off or overflow its container? Are there any visual layout issues? Respond with JSON: { \"hasIssues\": boolean, \"issues\": string[] } where issues describes each problem found including which text elements are affected." }
        ]
      }
    ]
    ```
  - `config: { responseMimeType: "application/json" }`
- Parses JSON response, returns `{ hasIssues: boolean; issues: string[] }`
- On parse failure, returns `{ hasIssues: false, issues: [] }` (fail-open: don't block pipeline on vision errors)

**4. `applyCorrectionPass` helper (correction loop):**
- For each issue identified by the vision model, find the corresponding modification plan and shorten the `newContent`
- Uses `GoogleGenAI` with model `gemini-3-flash-preview` to generate shorter text:
  - Prompt: "The following text was placed in a presentation slide text box but overflows or overlaps other elements. Rewrite it to be 30% shorter while preserving the key message. Original text: {text}. Respond with only the shortened text, no explanation."
- Applies the shortened text via `deleteText` + `insertText` batchUpdate (same pattern as modification-executor.ts)
- Re-applies autofit after corrections
- Returns list of corrections applied

**Overall correction loop in `performVisualQA`:**
```
for iteration 1..2:
  issues = checkSlideForOverlap(each modified slide)
  if no issues: return { status: iteration == 1 ? "clean" : "corrected", iterations: iteration }
  applyCorrectionPass(issues, plans)
return { status: "warning", iterations: 2, issues: remainingIssues }
```

**Important constraints:**
- Use `GOOGLE_AI_STUDIO_API_KEY` for the Gemini vision calls (not Vertex — this is a non-Vertex Gemini call via AI Studio, same as agent-executor.ts `createProviderClient`)
- Use `GOOGLE_SERVICE_ACCOUNT_KEY` auth (via `getSlidesClient(authOptions)`) for Slides API calls — these are document access calls
- Log extensively with `[visual-qa]` prefix for debugging
- Keep the entire module self-contained; do not modify modification-executor.ts internals
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>visual-qa.ts compiles without errors, exports performVisualQA and applyAutofitToModifiedShapes</done>
</task>

<task type="auto">
  <name>Task 2: Integrate visual QA into the structure-driven pipeline</name>
  <files>apps/agent/src/generation/route-strategy.ts</files>
  <action>
In `apps/agent/src/generation/route-strategy.ts`, add the visual QA step after modification execution:

1. Add import at top: `import { performVisualQA } from "./visual-qa";`

2. In `executeStructureDrivenPipeline`, after the `if (activePlans.length > 0)` block that calls `executeModifications` (around line 272-284), add a new step:

```typescript
  // Step 7: Post-modification visual QA — autofit + vision-based overlap detection
  if (activePlans.length > 0 && execResult.totalApplied > 0) {
    console.log(`[structure-pipeline] Step 7: Running visual QA on ${activePlans.length} modified slides`);
    const qaResult = await performVisualQA({
      presentationId: assemblyResult.presentationId,
      modifiedPlans: activePlans,
      authOptions,
    });
    console.log(`[structure-pipeline] Step 7 result: status=${qaResult.status}, iterations=${qaResult.iterations}${qaResult.issues ? `, issues=${qaResult.issues.length}` : ''}`);
    if (qaResult.status === "warning" && qaResult.issues) {
      console.warn(`[structure-pipeline] Visual QA warnings after ${qaResult.iterations} correction attempts:`);
      for (const issue of qaResult.issues) {
        console.warn(`[structure-pipeline]   - ${issue}`);
      }
    }
  }
```

Note: The `execResult` variable needs to be declared outside the `if (activePlans.length > 0)` block so it's accessible for the QA step. Move the `const execResult` declaration before the if block and initialize to null, then assign inside the block. Or scope the QA call inside the same if block by nesting it after the executeModifications call and its logging.

The simplest approach: nest the QA call inside the existing `if (activePlans.length > 0)` block, right after the execResult logging (after line 281). This way `execResult` is already in scope. Check `execResult.totalApplied > 0` before running QA.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Structure-driven pipeline calls performVisualQA after executeModifications; TypeScript compiles cleanly; visual QA logs appear in pipeline output</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit --project apps/agent/tsconfig.json` passes with no errors
- `visual-qa.ts` exports `performVisualQA` and `applyAutofitToModifiedShapes`
- `route-strategy.ts` imports and calls `performVisualQA` after modification execution
- No changes to modification-planner or assembler logic
</verification>

<success_criteria>
- Autofit requests are sent for all modified text elements after text replacement
- Slide thumbnails are fetched and sent to Gemini 3 Flash for visual overlap detection
- Correction loop runs up to 2 iterations, shortening text if issues are detected
- Pipeline logs QA status (clean/corrected/warning) with details
- No disruption to existing modification or assembly logic
</success_criteria>

<output>
After completion, create `.planning/quick/23-post-modification-visual-qa-with-auto-co/23-SUMMARY.md`
</output>
