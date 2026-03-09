---
phase: 21-redesign-draft-generation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/schemas/llm/section-aware-draft.ts
  - packages/schemas/index.ts
  - apps/agent/src/lib/deck-structure-loader.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/lib/regenerate-stage.ts
  - apps/web/src/components/touch/touch-stage-content.tsx
autonomous: true
requirements: [SLOT-SCHEMA, SLOT-DERIVATION, TOUCH1-INTEGRATION, REGEN-INTEGRATION, UI-STRUCTURED]

must_haves:
  truths:
    - "Touch 1 lowfi draft produces structured content with headlines, bodyParagraphs, metrics, bulletPoints per section"
    - "Regeneration of lowfi stage uses the new ContentSlotDraftSchema"
    - "UI displays structured slots per section (headlines, metrics as value+label, body, bullets) instead of a single contentText blob"
    - "Legacy fallback path still works when no DeckStructure exists"
    - "Touch 2 and Touch 3 workflows are NOT broken (they do not use draft schema)"
  artifacts:
    - path: "packages/schemas/llm/section-aware-draft.ts"
      provides: "ContentSlotDraftSchema + SectionContentSlotSchema replacing old SectionDraftLlmSchema"
      exports: ["ContentSlotDraftSchema", "SectionContentSlotSchema", "ContentSlotDraft", "SectionContentSlot"]
    - path: "apps/agent/src/lib/deck-structure-loader.ts"
      provides: "deriveSectionSlotCounts() and formatSectionsWithSlotsForPrompt()"
      exports: ["deriveSectionSlotCounts", "formatSectionsWithSlotsForPrompt"]
  key_links:
    - from: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      to: "packages/schemas/llm/section-aware-draft.ts"
      via: "ContentSlotDraftSchema import for structured output"
      pattern: "ContentSlotDraftSchema"
    - from: "apps/agent/src/lib/regenerate-stage.ts"
      to: "packages/schemas/llm/section-aware-draft.ts"
      via: "ContentSlotDraftSchema import for regeneration"
      pattern: "ContentSlotDraftSchema"
    - from: "apps/web/src/components/touch/touch-stage-content.tsx"
      to: "stageContent JSON"
      via: "Parses sections[].headlines, metrics, bodyParagraphs, bulletPoints from stageContent"
      pattern: "metrics|headlines|bodyParagraphs|bulletPoints"
---

<objective>
Replace the single-blob `contentText` draft schema with content-type-aware structured slots (headlines, bodyParagraphs, metrics, bulletPoints, speakerNotes) per section. Add slot derivation from SlideElement data so the LLM knows exactly how many of each content type to generate per section. Update Touch 1 workflow, regeneration, and the lowfi UI to use the new schema.

Purpose: Current drafts produce one text blob per section that cannot meaningfully map to the 27+ distinct text elements in a real template section. Structured slots bridge the gap between draft content and element-level modification.

Output: New ContentSlotDraftSchema, slot derivation logic, updated Touch 1 + regen + UI.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/schemas/llm/section-aware-draft.ts
@packages/schemas/index.ts
@apps/agent/src/lib/deck-structure-loader.ts
@apps/agent/src/deck-intelligence/deck-structure-schema.ts
@apps/agent/src/mastra/workflows/touch-1-workflow.ts
@apps/agent/src/lib/regenerate-stage.ts
@apps/web/src/components/touch/touch-stage-content.tsx

<interfaces>
<!-- SlideElement DB model (from prisma schema) -->
SlideElement fields: id, slideId, elementId, elementType, positionX, positionY, width, height, contentText, fontSize, fontColor, isBold, createdAt, updatedAt

<!-- DeckSection interface (from deck-structure-schema.ts) -->
```typescript
export interface DeckSection {
  order: number;
  name: string;
  purpose: string;
  isOptional: boolean;
  variationCount: number;
  slideIds: string[];
}
```

<!-- Existing enriched loader types -->
```typescript
export interface SectionElementData {
  contentText: string;
  elementType: string;
  isBold: boolean;
}

export interface EnrichedDeckSections {
  sections: DeckSection[];
  elementsBySlideId: Map<string, SectionElementData[]>;
}
```

<!-- Current barrel exports to replace -->
```typescript
export { SectionDraftLlmSchema, SectionDraftEntrySchema, type SectionDraft, type SectionDraftEntry } from "./llm/section-aware-draft.ts";
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace schema + add slot derivation to deck-structure-loader</name>
  <files>
    packages/schemas/llm/section-aware-draft.ts
    packages/schemas/index.ts
    apps/agent/src/lib/deck-structure-loader.ts
  </files>
  <action>
**1. Replace `packages/schemas/llm/section-aware-draft.ts` entirely:**

Remove SectionDraftEntrySchema/SectionDraftLlmSchema. Create new schemas:

```typescript
export const SectionContentSlotSchema = z.object({
  sectionName: z.string().meta({ description: "Name of the template section (maps to DeckSection.name)." }),
  sectionPurpose: z.string().meta({ description: "Why this section exists in the deck." }),
  headlines: z.array(z.string()).meta({ description: "Large/bold text items: titles, section headers, callout phrases." }),
  bodyParagraphs: z.array(z.string()).meta({ description: "Narrative text blocks: case study descriptions, value propositions, company overviews." }),
  metrics: z.array(z.object({
    value: z.string().meta({ description: "The metric number, e.g. '80%', '$1.5B', '3-5x'." }),
    label: z.string().meta({ description: "What the metric measures, e.g. 'Reduction in QA effort'." }),
  })).meta({ description: "Quantitative proof points as value+label pairs." }),
  bulletPoints: z.array(z.string()).meta({ description: "Capability items, feature bullets, list entries." }),
  speakerNotes: z.string().meta({ description: "Brief talking points for the presenter." }),
});

export const ContentSlotDraftSchema = z.object({
  companyName: z.string().meta({ description: "Name of the target company." }),
  industry: z.string().meta({ description: "Primary industry of the target company." }),
  headline: z.string().meta({ description: "Overall deck headline tailored to the company." }),
  sections: z.array(SectionContentSlotSchema).meta({ description: "One entry per template section with structured content slots." }),
  callToAction: z.string().meta({ description: "Specific call to action for the next step." }),
  contactName: z.string().optional().meta({ description: "Contact person name if available." }),
  contactRole: z.string().optional().meta({ description: "Contact person role if available." }),
});
```

Export types: `SectionContentSlot`, `ContentSlotDraft`.

IMPORTANT: Do NOT use `.optional()` on contactName/contactRole -- Zod `.meta()` is fine but optionals can cause issues with LLM structured output. Instead make them `z.string()` with `.meta()` description saying "Leave empty string if not available".

**2. Update `packages/schemas/index.ts` barrel:**

Replace old exports:
```
export { SectionDraftLlmSchema, SectionDraftEntrySchema, type SectionDraft, type SectionDraftEntry }
```
With new exports:
```
export { ContentSlotDraftSchema, SectionContentSlotSchema, type ContentSlotDraft, type SectionContentSlot }
```

**3. Add slot derivation to `apps/agent/src/lib/deck-structure-loader.ts`:**

Add a new interface and function. The loader query already fetches elements with `contentText, elementType, isBold` and orders by `fontSize desc`. BUT it only takes top 5 -- we need ALL text elements for accurate counting. Add a new function `loadDeckSectionsWithAllElements()` that fetches without `take: 5` limit, OR reuse the existing enriched data and augment with a second query.

Simpler approach: add `deriveSectionSlotCounts()` that takes sections + elementsBySlideId (from the existing enriched loader, but we need to expand the query). Actually, the existing `loadDeckSectionsWithElements` only takes 5 elements per slide. For slot counting we need all elements. So:

a) Add a new function `loadDeckSectionsForSlotAnalysis()` that queries ALL text elements per slide (not just top 5), including `fontSize` and `positionY` in the select:

```typescript
export interface SlotAnalysisElement {
  contentText: string;
  elementType: string;
  isBold: boolean;
  fontSize: number | null;
  positionY: number;
}

export interface SlotAnalysisData {
  sections: DeckSection[];
  elementsBySlideId: Map<string, SlotAnalysisElement[]>;
}
```

Query should select: `contentText, elementType, isBold, fontSize, positionY` from SlideElement, where `contentText` is not empty, ordered by `positionY asc` (for metric label detection).

b) Add `deriveSectionSlotCounts()`:

```typescript
export interface SectionSlotCounts {
  sectionName: string;
  sectionPurpose: string;
  headlineCount: number;
  bodyParagraphCount: number;
  metricCount: number;
  bulletPointCount: number;
}

export function deriveSectionSlotCounts(
  sections: DeckSection[],
  elementsBySlideId: Map<string, SlotAnalysisElement[]>,
): SectionSlotCounts[]
```

Classification logic per element (process section by section, collecting elements from ALL slideIds in each section, deduplicating by contentText):

1. **metric value**: `contentText` matches `/^[\d.,]+[%xXkKmMbB$+\-~]*$/` OR matches `/^\$[\d.,]+[kKmMbB]*$/` (dollar amounts)
2. **headline**: `(fontSize != null && fontSize >= 18) || (isBold && contentText.length < 80)`
3. **body paragraph**: `contentText.length > 100`
4. **bullet point**: everything else (non-empty text not classified above)

For metrics, count pairs (value+label), so `metricCount = number of metric values found`. The LLM will generate that many `{value, label}` pairs.

Average counts across slides in the section (since variations exist): `Math.ceil(sum / slideCount)` for each type.

c) Add `formatSectionsWithSlotsForPrompt()`:

```typescript
export function formatSectionsWithSlotsForPrompt(
  slotCounts: SectionSlotCounts[],
  sections: DeckSection[],
  elementsBySlideId: Map<string, SlotAnalysisElement[]>,
): string
```

Output format per section:
```
## Section {order}: {name}
Purpose: {purpose}
Required: {yes/no}
Content slots needed:
- Headlines: {N} (large/bold text items)
- Body paragraphs: {N} (narrative text blocks)
- Metrics: {N} (value + label pairs, e.g., "80%" / "Reduction in QA effort")
- Bullet points: {N} (capability/feature items)
Example content from this section:
- {truncated example elements, same as existing formatSectionsWithElementsForPrompt}
```

Keep existing functions (`loadDeckSections`, `loadDeckSectionsWithElements`, `formatSectionsForPrompt`, `formatSectionsWithElementsForPrompt`) intact -- they are used by Touch 2/3 and other code.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30 && npx tsc --noEmit -p packages/schemas/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>ContentSlotDraftSchema + SectionContentSlotSchema exported from packages/schemas. deriveSectionSlotCounts() and formatSectionsWithSlotsForPrompt() exported from deck-structure-loader. All existing functions preserved. TypeScript compiles.</done>
</task>

<task type="auto">
  <name>Task 2: Update Touch 1 workflow + regeneration to use ContentSlotDraftSchema</name>
  <files>
    apps/agent/src/mastra/workflows/touch-1-workflow.ts
    apps/agent/src/lib/regenerate-stage.ts
  </files>
  <action>
**1. Update `touch-1-workflow.ts` `generateDraftText` step (lines ~220-344):**

Replace the section-aware path in the `if (enriched && enriched.sections.length > 0)` block:

a) Import `ContentSlotDraftSchema` instead of `SectionDraftLlmSchema`. Remove `SectionDraftLlmSchema` from imports.
b) Import `loadDeckSectionsForSlotAnalysis`, `deriveSectionSlotCounts`, `formatSectionsWithSlotsForPrompt` from deck-structure-loader.
c) Instead of calling `loadDeckSectionsWithElements`, call `loadDeckSectionsForSlotAnalysis`.
d) Derive slot counts: `const slotCounts = deriveSectionSlotCounts(sections, slotData.elementsBySlideId)`.
e) Update the prompt to use `formatSectionsWithSlotsForPrompt(slotCounts, sections, slotData.elementsBySlideId)` instead of `formatSectionsWithElementsForPrompt`.
f) Update prompt instructions to say:

```
For each section, generate structured content matching the slot counts:
- headlines: Array of {N} headline strings (large/bold text)
- bodyParagraphs: Array of {N} narrative text blocks
- metrics: Array of {N} objects with {value, label} (quantitative proof points)
- bulletPoints: Array of {N} capability/feature items
- speakerNotes: Brief talking points for the presenter

Generate EXACTLY the number of items specified for each content type. Content must be tailored to the target company and fit the section's purpose.
```

g) Use `ContentSlotDraftSchema` for structuredOutput and parsing.
h) Update the backward-compatible `draftContent` (PagerContentLlmSchema) construction:
   - `valueProposition`: join first section's bodyParagraphs, slice to 500
   - `keyCapabilities`: collect bulletPoints from sections whose name includes "capabilit" (case-insensitive). If none, use first 3 bulletPoints from any section.
   - Keep `companyName`, `industry`, `headline`, `callToAction` as direct mappings.

i) Store `stageContent` as the full ContentSlotDraft (sections with structured slots) so the UI can render it.

**2. Update `regenerate-stage.ts` lowfi path (lines ~66-124):**

a) Import `ContentSlotDraftSchema` instead of `SectionDraftLlmSchema`. Remove `SectionDraftLlmSchema` from imports.
b) Import `loadDeckSectionsForSlotAnalysis`, `deriveSectionSlotCounts`, `formatSectionsWithSlotsForPrompt`.
c) In the `stage === "lowfi"` block, replace `loadDeckSectionsWithElements("touch_1")` with `loadDeckSectionsForSlotAnalysis("touch_1")`.
d) Update `buildSectionAwareDraftPrompt` to accept `SectionSlotCounts[]` and use `formatSectionsWithSlotsForPrompt`. Update its prompt text to match the new structured slot instructions (same as Touch 1 above).
e) Use `ContentSlotDraftSchema` for structuredOutput and parsing (replacing `SectionDraftLlmSchema`).
f) The function signature of `buildSectionAwareDraftPrompt` changes -- update parameters to include `slotCounts: SectionSlotCounts[]` and use it in the prompt.

**Important:** Leave the legacy paths (PagerContentLlmSchema) completely untouched. Only the section-aware paths change.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Touch 1 generateDraftText uses ContentSlotDraftSchema with slot-count-aware prompts. Regeneration lowfi path uses ContentSlotDraftSchema. Legacy PagerContent fallback paths unchanged. TypeScript compiles.</done>
</task>

<task type="auto">
  <name>Task 3: Redesign lowfi UI to display structured content slots per section</name>
  <files>
    apps/web/src/components/touch/touch-stage-content.tsx
  </files>
  <action>
Update the Touch1Content `stage === "lowfi"` section (lines ~92-209) to detect and render the new structured slot format.

**Detection:** Check for `data?.sections` being an array where items have `headlines` array (new format) vs `contentText` string (old format -- keep as legacy fallback).

```typescript
const sections = data?.sections as Array<{
  sectionName: string;
  sectionPurpose: string;
  headlines?: string[];
  bodyParagraphs?: string[];
  metrics?: Array<{ value: string; label: string }>;
  bulletPoints?: string[];
  speakerNotes?: string;
  contentText?: string; // legacy
}> | undefined;

const isStructuredSlots = Array.isArray(sections) && sections.length > 0
  && Array.isArray(sections[0]?.headlines);
```

**If `isStructuredSlots` (new format):** Render each section as a card with organized content types:

```tsx
<Card>
  <CardHeader className="pb-2">
    <div className="flex items-center gap-2">
      <FileText className="h-4 w-4 text-slate-500" />
      <Badge variant="secondary" className="text-xs">Structured Draft</Badge>
    </div>
    <CardTitle className="text-lg">{headline || "Draft Content"}</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4 text-sm">
    {sections.map((section, i) => (
      <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-800">{section.sectionName}</p>
          <Badge variant="outline" className="text-[10px] font-normal">{section.sectionPurpose}</Badge>
        </div>

        {/* Headlines */}
        {section.headlines && section.headlines.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-slate-500">Headlines</p>
            <div className="space-y-1">
              {section.headlines.map((h, j) => (
                <p key={j} className="text-base font-semibold text-slate-800">{h}</p>
              ))}
            </div>
          </div>
        )}

        {/* Body Paragraphs */}
        {section.bodyParagraphs && section.bodyParagraphs.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-slate-500">Content</p>
            {section.bodyParagraphs.map((bp, j) => (
              <p key={j} className="whitespace-pre-wrap leading-relaxed text-slate-700 mb-2">{bp}</p>
            ))}
          </div>
        )}

        {/* Metrics as value+label cards */}
        {section.metrics && section.metrics.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-slate-500">Metrics</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {section.metrics.map((m, j) => (
                <div key={j} className="rounded-md bg-slate-50 px-3 py-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{m.value}</p>
                  <p className="text-[11px] text-slate-500">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bullet Points */}
        {section.bulletPoints && section.bulletPoints.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-slate-500">Key Points</p>
            <ul className="list-disc space-y-1 pl-4 text-slate-700">
              {section.bulletPoints.map((bp, j) => (
                <li key={j}>{bp}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Speaker Notes */}
        {section.speakerNotes && (
          <div className="flex items-start gap-1.5 rounded bg-slate-50 px-2 py-1.5">
            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-500">{section.speakerNotes}</p>
          </div>
        )}
      </div>
    ))}
    {/* Call to action */}
    {callToAction && (
      <div>
        <p className="mb-1 text-xs font-medium uppercase text-slate-500">Call to Action</p>
        <p className="leading-relaxed text-slate-700">{callToAction}</p>
      </div>
    )}
  </CardContent>
</Card>
```

**If NOT structured slots but has `sections` with `contentText` (old section-aware format):** Keep existing rendering code as-is (the current `isSectionAware` block).

**If no sections at all (legacy PagerContent):** Keep existing rendering code as-is.

The detection order should be: structured slots first -> old section-aware -> legacy flat. This ensures backward compatibility with any in-progress interactions that used the old schema.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Lowfi UI renders structured slots: headlines as bold text, metrics as value+label cards in a grid, body paragraphs as narrative blocks, bullet points as lists. Backward-compatible with old section-aware and legacy formats. TypeScript compiles.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit -p apps/agent/tsconfig.json` -- agent compiles with new schema + loader + workflow changes
2. `npx tsc --noEmit -p apps/web/tsconfig.json` -- web compiles with new UI rendering
3. `npx tsc --noEmit -p packages/schemas/tsconfig.json` -- schemas package compiles
4. Grep for old schema names to confirm removal: `grep -r "SectionDraftLlmSchema\|SectionDraftEntrySchema" apps/ packages/ --include="*.ts" --include="*.tsx"` should return zero results
5. Grep for new schema names to confirm adoption: `grep -r "ContentSlotDraftSchema" apps/ packages/ --include="*.ts"` should show touch-1-workflow.ts, regenerate-stage.ts, section-aware-draft.ts, index.ts
</verification>

<success_criteria>
- ContentSlotDraftSchema replaces SectionDraftLlmSchema everywhere it was used (touch-1-workflow, regenerate-stage)
- deriveSectionSlotCounts correctly classifies elements into headlines/body/metrics/bullets
- LLM prompt includes per-section slot counts so it generates the right amount of structured content
- UI displays structured content types per section with metrics as value+label cards
- Legacy PagerContent fallback path in Touch 1 and regen is completely untouched
- Touch 2 and Touch 3 workflows are completely untouched (they use loadDeckSections, not the draft schema)
- All three tsconfig targets compile without errors
</success_criteria>

<output>
After completion, create `.planning/quick/21-redesign-draft-generation-to-be-content-/21-SUMMARY.md`
</output>
