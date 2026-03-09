---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/lib/deck-structure-loader.ts
  - apps/agent/src/mastra/workflows/touch-1-workflow.ts
  - apps/agent/src/lib/regenerate-stage.ts
autonomous: true
requirements: [QUICK-20]
must_haves:
  truths:
    - "Draft generation prompts include representative element text samples from example slides"
    - "Existing formatSectionsForPrompt callers (Touch 2/3 slide notes) are unaffected"
    - "Element samples are capped to avoid prompt bloat (max ~5 elements per section, truncated to 150 chars each)"
  artifacts:
    - path: "apps/agent/src/lib/deck-structure-loader.ts"
      provides: "loadDeckSectionsWithElements() and formatSectionsWithElementsForPrompt() functions"
      exports: ["loadDeckSectionsWithElements", "formatSectionsWithElementsForPrompt"]
    - path: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      provides: "Touch 1 draft step uses enriched element content in prompt"
    - path: "apps/agent/src/lib/regenerate-stage.ts"
      provides: "Lowfi regeneration uses enriched element content in prompt"
  key_links:
    - from: "apps/agent/src/lib/deck-structure-loader.ts"
      to: "prisma.slideEmbedding + prisma.slideElement"
      via: "Prisma query with elements include"
      pattern: "prisma\\.slideEmbedding\\.findMany.*include.*elements"
    - from: "apps/agent/src/mastra/workflows/touch-1-workflow.ts"
      to: "apps/agent/src/lib/deck-structure-loader.ts"
      via: "import formatSectionsWithElementsForPrompt"
      pattern: "formatSectionsWithElementsForPrompt"
---

<objective>
Enrich the deck-structure-loader to load and format slide element content samples alongside section metadata, so that draft generation prompts include concrete examples of content patterns, tone, and structure from real example slides.

Purpose: Currently the LLM drafting content only sees "Section 1: Title Slide / Purpose: To introduce..." but has zero visibility into what actual slide text looks like. Adding representative element samples (e.g., "80-90% Reduction in QA effort", case study paragraphs) gives the LLM concrete reference material to match tone and structure.

Output: New `loadDeckSectionsWithElements()` and `formatSectionsWithElementsForPrompt()` functions; Touch 1 workflow and regenerate-stage updated to use them.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/agent/src/lib/deck-structure-loader.ts
@apps/agent/src/deck-intelligence/deck-structure-schema.ts
@apps/agent/src/mastra/workflows/touch-1-workflow.ts
@apps/agent/src/lib/regenerate-stage.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add loadDeckSectionsWithElements and formatSectionsWithElementsForPrompt to deck-structure-loader</name>
  <files>apps/agent/src/lib/deck-structure-loader.ts</files>
  <action>
Add two new exported functions to `deck-structure-loader.ts`, keeping existing `loadDeckSections` and `formatSectionsForPrompt` completely untouched for backward compat:

1. **`loadDeckSectionsWithElements(touchType, artifactType?)`** — Same as `loadDeckSections` but after loading sections, collects all `slideIds` across all sections into a flat array, then queries `prisma.slideEmbedding.findMany({ where: { id: { in: allSlideIds } }, include: { elements: { where: { contentText: { not: "" } }, orderBy: { fontSize: "desc" }, take: 5 } }, select: { id: true, elements: { select: { contentText: true, elementType: true, isBold: true } } } })`. Returns `{ sections: DeckSection[], elementsBySlideId: Map<string, Array<{ contentText: string; elementType: string; isBold: boolean }>> }` or `null`.

2. **`formatSectionsWithElementsForPrompt(sections, elementsBySlideId)`** — Maps over sections same as `formatSectionsForPrompt` but appends an "Example content from this section:" block. For each section, collect elements from all its `slideIds` via the Map, deduplicate by contentText, take top 5, truncate each to 150 chars, and format as bullet points. If no elements found for a section, omit the example block for that section.

Export the new type `SectionElementData` for the Map value type.

Key implementation details:
- Use a single batched Prisma query for all slideIds (NOT N+1 per section)
- Filter out empty contentText at the DB level (`where: { contentText: { not: "" } }`)
- Order by fontSize desc to prioritize headings/titles over small text
- Deduplicate by exact contentText match across slides in the same section
- Truncate with `text.slice(0, 150) + (text.length > 150 ? "..." : "")`
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Both new functions exported, existing functions unchanged, TypeScript compiles cleanly</done>
</task>

<task type="auto">
  <name>Task 2: Wire enriched element content into Touch 1 draft generation and regenerate-stage</name>
  <files>apps/agent/src/mastra/workflows/touch-1-workflow.ts, apps/agent/src/lib/regenerate-stage.ts</files>
  <action>
**In touch-1-workflow.ts (`generateDraftText` step):**

1. Change import to also import `loadDeckSectionsWithElements` and `formatSectionsWithElementsForPrompt` from `../../lib/deck-structure-loader`
2. In the section-aware path (line ~224-283), replace:
   - `const deckSections = await loadDeckSections("touch_1");` with `const enriched = await loadDeckSectionsWithElements("touch_1");`
   - `if (deckSections && deckSections.length > 0)` with `if (enriched && enriched.sections.length > 0)`
   - Extract: `const deckSections = enriched.sections;`
   - Replace `formatSectionsForPrompt(deckSections)` in the sectionAwarePrompt with `formatSectionsWithElementsForPrompt(deckSections, enriched.elementsBySlideId)`
3. The legacy path (else branch) remains unchanged since it uses flat PagerContent without sections

**In regenerate-stage.ts (`buildSectionAwareDraftPrompt` function):**

1. Change the import to also import `loadDeckSectionsWithElements` and `formatSectionsWithElementsForPrompt`
2. In the lowfi regeneration block (line ~72), replace:
   - `const deckSections = await loadDeckSections("touch_1");` with `const enriched = await loadDeckSectionsWithElements("touch_1");`
   - `if (deckSections && deckSections.length > 0)` with `if (enriched && enriched.sections.length > 0)`
   - Extract `const deckSections = enriched.sections;`
   - Pass `enriched.elementsBySlideId` to `buildSectionAwareDraftPrompt` as a new parameter
3. Update `buildSectionAwareDraftPrompt` signature to accept `elementsBySlideId: Map<string, ...>` parameter
4. In `buildSectionAwareDraftPrompt`, replace `formatSectionsForPrompt(deckSections)` with `formatSectionsWithElementsForPrompt(deckSections, elementsBySlideId)`

Do NOT modify Touch 2 or Touch 3 workflows — they use `loadDeckSections` for slide notes enrichment only (section name/purpose), not for draft content generation.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit --project apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Touch 1 workflow and regenerate-stage use enriched element content in their section-aware draft prompts. Touch 2/3 imports unchanged. TypeScript compiles.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit --project apps/agent/tsconfig.json` passes with no errors
- `grep -n "formatSectionsForPrompt" apps/agent/src/mastra/workflows/touch-2-workflow.ts apps/agent/src/mastra/workflows/touch-3-workflow.ts` shows NO usage (confirming Touch 2/3 are unaffected — they never used it)
- `grep -n "loadDeckSections\b" apps/agent/src/mastra/workflows/touch-2-workflow.ts apps/agent/src/mastra/workflows/touch-3-workflow.ts` still shows original `loadDeckSections` import (unchanged)
- `grep -n "formatSectionsWithElementsForPrompt" apps/agent/src/mastra/workflows/touch-1-workflow.ts apps/agent/src/lib/regenerate-stage.ts` shows usage in both files
</verification>

<success_criteria>
- New `loadDeckSectionsWithElements` loads sections + batched element data in one query
- New `formatSectionsWithElementsForPrompt` includes truncated element text samples per section
- Touch 1 draft generation prompt includes example content from real slides
- Lowfi regeneration prompt includes example content from real slides
- Original `formatSectionsForPrompt` and `loadDeckSections` unchanged
- Touch 2/3 workflows completely unmodified
</success_criteria>

<output>
After completion, create `.planning/quick/20-enrich-deck-structure-loader-to-include-/20-SUMMARY.md`
</output>
