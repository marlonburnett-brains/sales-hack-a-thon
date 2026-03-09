---
phase: quick-19
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/schemas/llm/section-aware-draft.ts
  - packages/schemas/index.ts
  - apps/agent/src/lib/deck-structure-loader.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/mastra/workflows/touch-2-workflow.ts
  - apps/agent/src/mastra/workflows/touch-3-workflow.ts
  - apps/agent/src/lib/regenerate-stage.ts
  - apps/web/src/components/touch/touch-stage-content.tsx
autonomous: true
requirements: [QT-19]

must_haves:
  truths:
    - "Touch 1 draft generation prompt includes DeckStructure section names, purposes, and example content from the template"
    - "Touch 2 low-fi draft notes reference DeckStructure sections instead of generic placeholder text"
    - "Touch 3 low-fi draft notes reference DeckStructure sections instead of generic placeholder text"
    - "Touch 1 lowfi stage content includes per-section fields that map to template slots"
    - "UI displays section-aware draft content with section names and purposes visible to the user"
    - "Regenerate-stage uses section-aware prompts when DeckStructure is available"
  artifacts:
    - path: "packages/schemas/llm/section-aware-draft.ts"
      provides: "Section-aware draft schema with per-section content slots"
      exports: ["SectionDraftLlmSchema", "SectionDraft", "SectionDraftEntrySchema"]
    - path: "apps/agent/src/lib/deck-structure-loader.ts"
      provides: "Shared helper to load DeckStructure sections for a touch type"
      exports: ["loadDeckSections", "formatSectionsForPrompt"]
  key_links:
    - from: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      to: "apps/agent/src/lib/deck-structure-loader.ts"
      via: "import loadDeckSections + formatSectionsForPrompt"
      pattern: "loadDeckSections|formatSectionsForPrompt"
    - from: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      to: "packages/schemas/llm/section-aware-draft.ts"
      via: "import SectionDraftLlmSchema"
      pattern: "SectionDraftLlmSchema"
    - from: "apps/web/src/components/touch/touch-stage-content.tsx"
      to: "section-aware draft content"
      via: "renders sections array from stageContent"
      pattern: "sections.*map"
---

<objective>
Make all touch workflow draft generation template-aware by connecting draft schemas and prompts to DeckStructure sections, example files, and agent system prompts.

Purpose: Currently draft generation produces 5 flat fields (headline, valueProposition, keyCapabilities, callToAction) with ZERO awareness of what the actual template looks like. The DeckStructure has rich sections (hero, case studies, metrics bars, etc.) but drafts don't reference them. This creates a mismatch where assembly tries to map flat content to 10+ template slots via naive {{tag}} replacement.

Output: Section-aware draft schema, shared deck-structure loader, updated workflow prompts for Touch 1/2/3, updated regeneration, and UI that displays per-section drafts.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@packages/schemas/llm/pager-content.ts
@apps/agent/src/deck-intelligence/deck-structure-schema.ts
@apps/agent/src/deck-intelligence/infer-deck-structure.ts
@apps/agent/src/generation/route-strategy.ts
@apps/agent/src/mastra/workflows/touch-1-workflow.ts
@apps/agent/src/mastra/workflows/touch-2-workflow.ts
@apps/agent/src/mastra/workflows/touch-3-workflow.ts
@apps/agent/src/lib/regenerate-stage.ts
@apps/agent/src/lib/slide-assembly.ts
@apps/web/src/components/touch/touch-stage-content.tsx

<interfaces>
<!-- Key types the executor needs -->

From apps/agent/src/deck-intelligence/deck-structure-schema.ts:
```typescript
export interface DeckSection {
  order: number;
  name: string;        // e.g., "Company Overview", "Case Studies"
  purpose: string;     // Why this section exists
  isOptional: boolean;
  variationCount: number;
  slideIds: string[];
}

export interface DeckStructureOutput {
  sections: DeckSection[];
  sequenceRationale: string;
}
```

From packages/schemas/llm/pager-content.ts (CURRENT - to be supplemented):
```typescript
export const PagerContentLlmSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  headline: z.string(),
  valueProposition: z.string(),
  keyCapabilities: z.array(z.string()),
  callToAction: z.string(),
});
```

From apps/agent/src/generation/route-strategy.ts:
```typescript
export async function resolveGenerationStrategy(
  touchType: string,
  artifactType: ArtifactType | null,
  dealContext: DealContext,
): Promise<GenerationStrategy>;
```

From apps/agent/src/deck-intelligence/deck-structure-key.ts:
```typescript
export function resolveDeckStructureKey(touchType: string, artifactType?: ArtifactType | null): DeckStructureKey;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create section-aware draft schema and deck-structure loader</name>
  <files>
    packages/schemas/llm/section-aware-draft.ts
    packages/schemas/index.ts
    apps/agent/src/lib/deck-structure-loader.ts
  </files>
  <action>
1. Create `packages/schemas/llm/section-aware-draft.ts`:
   - Define `SectionDraftEntrySchema` as a z.object with:
     - `sectionName: z.string()` (maps to DeckSection.name)
     - `sectionPurpose: z.string()` (maps to DeckSection.purpose)
     - `contentText: z.string()` (the LLM-generated content for this section)
     - `speakerNotes: z.string()` (talking points for this section)
   - Define `SectionDraftLlmSchema` as a z.object with:
     - `companyName: z.string()`
     - `industry: z.string()`
     - `headline: z.string()` (overall deck headline)
     - `sections: z.array(SectionDraftEntrySchema)` (one entry per DeckSection)
     - `callToAction: z.string()`
   - Export both schemas and their inferred types (`SectionDraft`, `SectionDraftEntry`)

2. Update `packages/schemas/index.ts`:
   - Add exports for `SectionDraftLlmSchema`, `SectionDraftEntrySchema`, and their types
   - Keep all existing PagerContentLlmSchema exports (backward compat for legacy path)

3. Create `apps/agent/src/lib/deck-structure-loader.ts`:
   - Export `loadDeckSections(touchType: string, artifactType?: ArtifactType | null): Promise<DeckSection[] | null>`
     - Query `prisma.deckStructure.findFirst({ where: { touchType, artifactType } })`
     - Parse `structureJson` as `DeckStructureOutput`, return `sections` or `null` if not found/empty
   - Export `formatSectionsForPrompt(sections: DeckSection[]): string`
     - Format each section as:
       ```
       ## Section {order}: {name}
       Purpose: {purpose}
       Required: {yes/no based on isOptional}
       Variations available: {variationCount}
       ```
     - This string gets injected into LLM prompts so the model knows the template structure
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p packages/schemas/tsconfig.json 2>&1 | head -20 && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>SectionDraftLlmSchema exported from packages/schemas, deck-structure-loader compiles and exports loadDeckSections + formatSectionsForPrompt</done>
</task>

<task type="auto">
  <name>Task 2: Update Touch 1/2/3 draft generation and regeneration to use DeckStructure sections</name>
  <files>
    apps/agent/src/mastra/workflows/touch-1-workflow.ts
    apps/agent/src/mastra/workflows/touch-2-workflow.ts
    apps/agent/src/mastra/workflows/touch-3-workflow.ts
    apps/agent/src/lib/regenerate-stage.ts
  </files>
  <action>
**Touch 1 workflow** (`touch-1-workflow.ts`):
1. In `generateDraftText` step (Step 3, the lowfi generation):
   - Import `loadDeckSections`, `formatSectionsForPrompt` from `../../lib/deck-structure-loader`
   - Import `SectionDraftLlmSchema`, `zodToLlmJsonSchema` from `@lumenalta/schemas`
   - At the start of execute, call `const deckSections = await loadDeckSections("touch_1")`
   - If `deckSections` is non-null and has sections:
     - Build a section-aware prompt that includes `formatSectionsForPrompt(deckSections)` and instructs the LLM:
       ```
       You are creating a first-contact one-pager for Lumenalta. Based on the approved outline and the TEMPLATE STRUCTURE below, generate section-specific content that maps to each template section.

       Company: {companyName}
       Industry: {industry}
       Additional Context: {context}

       APPROVED OUTLINE:
       - Headline: {skeleton.headline}
       - Value Proposition: {skeleton.valueProposition}
       - Key Capabilities: {skeleton.keyCapabilities.join(", ")}

       TEMPLATE STRUCTURE (generate content for EACH section):
       {formatSectionsForPrompt(deckSections)}

       For each section, generate:
       - contentText: The actual text content tailored to this section's purpose, personalized for the target company
       - speakerNotes: Brief talking points for the presenter

       Also provide an overall headline and call to action.
       Keep tone professional but engaging. Content must fit the section's purpose.
       ```
     - Use `SectionDraftLlmSchema` as the structuredOutput schema
     - Parse response with `SectionDraftLlmSchema.parse()`
     - Store the section-aware content in `stageContent` (the UI will read `sections` array)
   - If `deckSections` is null (no DeckStructure available, legacy fallback):
     - Keep the existing PagerContentLlmSchema prompt and parsing unchanged
   - The outputSchema for this step needs to accommodate both shapes. Use a discriminated approach:
     - Add `draftType: z.enum(["section-aware", "legacy"])` to output
     - Use `z.union([SectionDraftLlmSchema, PagerContentLlmSchema])` for the draftContent field, OR simpler: store as `z.unknown()` since it's JSON serialized to stageContent anyway and the next step just passes it through
     - SIMPLEST approach: keep `draftContent: PagerContentLlmSchema` for backward compat in the workflow schema pipeline, but ALSO store the section-aware content in `stageContent` (which is what the UI reads). The workflow output schema doesn't need to change — the rich content lives in the DB `stageContent` column. Just add a `sectionDraft` optional field alongside `draftContent` so both paths work:
       - Legacy: `draftContent` is populated, `sectionDraft` is undefined
       - Section-aware: `draftContent` is populated with a backward-compat flat version (extract headline, capabilities, callToAction from sections), AND `sectionDraft` has the full section array
     - In `stageContent` DB update: store the section-aware content if available, otherwise store PagerContent

2. In the `assembleDeck` step (Step 5):
   - When using legacy path with `assembleFromTemplate`, if sectionDraft is available, build textReplacements from the section content instead of flat fields. Map section names to template tags where possible (e.g., section named "Hero" -> `{{headline}}` from that section's contentText). Fall back to existing flat field mapping if no sectionDraft.
   - The structure-driven pipeline path already handles modifications via `modification-planner` which reads element maps, so no changes needed there.

**Touch 2 workflow** (`touch-2-workflow.ts`):
3. In `generateDraftOrder` step (Step 3):
   - Import `loadDeckSections`, `formatSectionsForPrompt`
   - Call `loadDeckSections("touch_2")` at start of execute
   - If sections available, enhance the `slideNotes` generation:
     - For each slideId in `skeleton.slideOrder`, try to match it against DeckStructure section slideIds
     - If a match is found, use the section's `name` and `purpose` in the notes:
       `notes: "Section: {sectionName} — {purpose}. Personalized for {companyName} in {industry}."`
     - If no match, fall back to existing generic notes
   - Store enhanced lowfi content in stageContent

**Touch 3 workflow** (`touch-3-workflow.ts`):
4. Apply the same enhancement as Touch 2 in `generateDraftOrder`:
   - Import and call `loadDeckSections("touch_3")`
   - Match slide IDs to section names/purposes for richer notes
   - Fall back to existing generic notes if no DeckStructure

**Regenerate stage** (`regenerate-stage.ts`):
5. In the `lowfi` regeneration branch:
   - Import `loadDeckSections`, `formatSectionsForPrompt`, `SectionDraftLlmSchema`
   - Call `loadDeckSections("touch_1")` (currently regenerateStage only handles touch_1)
   - If sections available, use the section-aware prompt (same as Touch 1 step 3) with `SectionDraftLlmSchema`
   - If no sections, keep existing `PagerContentLlmSchema` path
   - Store whichever result in stageContent

IMPORTANT: Do NOT change Touch 4 workflow — it already has its own rich proposal-assembly pipeline with `buildSlideJSON` and `generateSlideCopy` that is section-aware via its own mechanism.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | tail -5</automated>
  </verify>
  <done>Touch 1 draft generation uses SectionDraftLlmSchema when DeckStructure exists, Touch 2/3 draft notes reference section names and purposes, regenerateStage supports section-aware lowfi regeneration, all fall back gracefully to legacy when no DeckStructure is available</done>
</task>

<task type="auto">
  <name>Task 3: Update UI to display section-aware draft content</name>
  <files>
    apps/web/src/components/touch/touch-stage-content.tsx
  </files>
  <action>
Update `Touch1Content` in `touch-stage-content.tsx` to handle section-aware drafts:

1. In the `lowfi` stage branch, detect whether content has a `sections` array (section-aware) or flat fields (legacy):
   ```
   const sections = data?.sections as Array<{ sectionName: string; sectionPurpose: string; contentText: string; speakerNotes: string }> | undefined;
   const isSectionAware = Array.isArray(sections) && sections.length > 0;
   ```

2. If `isSectionAware`, render a card per section:
   - Show section name as a subheading with a `Badge` showing the section purpose
   - Show `contentText` as the main body
   - Show `speakerNotes` in a collapsible or muted style below
   - Still show the overall headline at the top and callToAction at the bottom
   - Use a vertical stack of section cards within the main Card

3. If NOT section-aware (legacy), keep the existing rendering unchanged (headline, valueProposition, keyCapabilities, callToAction flat display)

4. For Touch 2/3 `lowfi` stage in `Touch23Content`:
   - The enhanced slideNotes now contain section names. Update the rendering to show section info more prominently if present.
   - Check if `slide.notes` starts with "Section:" and if so, split it to show section name in a badge and the rest as description text. If not, render as before.
   - This is a display-only enhancement — no structural change to the data shape.

Keep all existing `skeleton` and `highfi` rendering unchanged. The section-aware changes ONLY affect `lowfi` stage display.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -5</automated>
  </verify>
  <done>UI detects section-aware vs legacy draft content and renders per-section cards with section names and purposes for Touch 1, and enhanced section-tagged notes for Touch 2/3</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `npx tsc --noEmit` passes for both `packages/schemas` and `apps/agent` and `apps/web`
2. The section-aware path is gated behind `loadDeckSections()` returning non-null — if no DeckStructure exists, all workflows fall back to their existing behavior with zero changes
3. Touch 4 workflow is untouched (it already has its own rich section-aware pipeline)
</verification>

<success_criteria>
- SectionDraftLlmSchema exists and exports from packages/schemas
- deck-structure-loader.ts provides loadDeckSections and formatSectionsForPrompt
- Touch 1 generateDraftText uses section-aware prompt when DeckStructure available
- Touch 2/3 generateDraftOrder enriches slide notes with DeckStructure section info
- regenerateStage supports section-aware lowfi regeneration
- UI displays per-section draft cards for section-aware content
- All existing legacy paths are preserved as fallbacks
- TypeScript compiles cleanly across all three projects
</success_criteria>

<output>
After completion, create `.planning/quick/19-make-all-touch-workflow-draft-generation/19-SUMMARY.md`
</output>
