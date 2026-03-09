# Stack Research

**Domain:** Structure-driven deck generation -- multi-source slide assembly, element-map-guided modifications, DeckStructure as blueprint
**Researched:** 2026-03-09
**Confidence:** HIGH

## Scope

This covers only NEW additions/changes for v1.8 (Structure-Driven Deck Generation). The existing stack is validated and unchanged. See v1.7 STACK.md for prior research.

**Focus areas:**
1. DeckStructure consumed as generation blueprint for all touches
2. Multi-source slide assembly (cherry-pick slides from different source presentations)
3. Design-preserved output (each slide retains its original layout)
4. Per-slide modification planning using element maps
5. Context-aware section-to-slide matching
6. 3-stage HITL integration (Skeleton=blueprint+selections, Low-fi=assembled deck, High-fi=surgical modifications)

---

## Executive Summary

v1.8 requires **zero new npm dependencies**. Every capability needed for multi-source assembly, element-map-guided modification, and structure-driven generation is achievable with the existing `googleapis`, `@google/genai`, `openai`, Prisma, and Mastra packages. The work is entirely new TypeScript modules, Prisma schema evolution, and workflow step additions.

The defining technical constraint: the Google Slides REST API has **no cross-presentation slide copy** method. Apps Script has `appendSlide()` but the REST API does not (confirmed via Google Issue Tracker #167977584). Multi-source assembly must use a "sequential copy-and-prune" strategy where each source presentation is copied independently and unwanted slides are deleted, then the results are combined.

---

## Recommended Stack (No Changes to Dependencies)

### Core Technologies (Already In Place)

| Technology | Current Version | Purpose for v1.8 | Status |
|------------|----------------|-------------------|--------|
| `googleapis` | ^144.0.0 | Drive `files.copy`, Slides `batchUpdate` (`replaceAllText`, `deleteObject`, `updateSlidesPosition`, `insertText`) | Sufficient. Latest is 171.x but upgrade adds no new Slides API methods relevant to v1.8. No cross-presentation copy exists in ANY version. |
| `@google/genai` | ^1.43.0 | Gemini 2.5 Flash for modification planning (structured output), section-to-slide scoring | Sufficient. New structured output schemas needed but library handles them. |
| `openai` | ^6.27.0 | GPT-OSS 120b on Vertex AI for per-slide custom copy generation | Sufficient. Same generate-text pattern as current `proposal-assembly.ts`. |
| `@prisma/client` + `prisma` | ^6.3.1 | Schema additions for assembly manifest storage | Stay on 6.x per constraint (Prisma 7.x has vector regression #28867). Forward-only migrations only. |
| `@mastra/core` | ^1.8.0 | New workflow steps for structure-driven generation pipeline | Sufficient. Existing suspend/resume pattern handles HITL stages. |
| `pgvector` | 0.2.0 | Cosine similarity for initial slide candidate filtering | Sufficient. Same raw SQL pattern as existing slide search. |
| `zod` | ^4.3.6 | New schemas for assembly params, modification plans, resolved blueprints | Sufficient. Same workflow I/O validation pattern. |

### Supporting Libraries (Already In Place)

| Library | Version | v1.8 Usage |
|---------|---------|------------|
| `google-auth-library` | ^9.15.1 | Same auth chain. Multi-source assembly uses same Drive/Slides clients. |
| `@mastra/pg` | ^1.7.1 | Workflow state persistence for new generation steps. |
| `@t3-oss/env-core` | ^0.13.10 | No new env vars needed. |

---

## What's Actually New (Code, Not Dependencies)

### New Agent Modules

| Module | Purpose | Existing Deps Used |
|--------|---------|-------------------|
| `structure-blueprint-resolver.ts` | Consume DeckStructure as generation blueprint: load sections, resolve slideIds to SlideEmbedding records with element maps, produce ordered assembly plan | Prisma (DeckStructure, SlideEmbedding, SlideElement) |
| `section-slide-matcher.ts` | For each DeckStructure section, score candidate slides against deal context (industry, pillar, persona, funnel stage) and select the best match | `@google/genai` (Gemini Flash structured scoring), `pgvector` (cosine similarity pre-filter), Prisma |
| `multi-source-assembler.ts` | Given a resolved blueprint with slides from N source presentations, assemble a single output deck using sequential copy-and-prune | `googleapis` (Drive `files.copy`, Slides `batchUpdate`) |
| `modification-planner.ts` | Given a copied slide's SlideElement records and deal context, generate a modification plan: which elements to change, what new content to inject | `@google/genai` (Gemini Flash structured output) |
| `surgical-modifier.ts` | Execute planned modifications on assembled slides via scoped Slides API calls | `googleapis` (Slides `replaceAllText` with `pageObjectIds`, `deleteText`, `insertText`) |
| `structure-driven-workflow-steps.ts` | Mastra workflow steps that wire the above modules into the touch generation pipelines | `@mastra/core` (createStep with Zod I/O schemas) |

### Prisma Schema Evolution

No new models required. Small field additions to existing models:

| Model | Field | Type | Purpose |
|-------|-------|------|---------|
| `InteractionRecord` | `blueprintJson` | `String?` | Store resolved blueprint (sections + selected slides + source presentations) for Skeleton HITL review |
| `InteractionRecord` | `assemblyManifest` | `String?` | Store multi-source assembly plan (which slides from which sources, in what order) for audit trail |

These are nullable String columns added via forward-only migration. No existing data is affected.

### New Zod Schemas (in `packages/schemas`)

| Schema | Purpose | Fields |
|--------|---------|--------|
| `ResolvedBlueprint` | Output of blueprint resolution + slide matching | `sections: [{name, purpose, selectedSlide: {slideId, templateId, presentationId, slideObjectId}, alternatives: [...]}]` |
| `AssemblyManifest` | Input to multi-source assembler | `basePresentationId, slideGroups: [{sourcePresentationId, slideObjectIds: [...]}], outputOrder: [...]` |
| `ModificationPlan` | Output of modification planner (per-slide) | `slideObjectId, modifications: [{elementId, action, currentText, newText, reason}]` |
| `ModificationAction` | Flat schema for Gemini structured output | `elementId: string, action: string, newText: string, reason: string` |

---

## Critical Technical Constraints

### 1. No Cross-Presentation Slide Copy in Google Slides REST API

**Confidence:** HIGH
**Sources:** [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584), [Slides API Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides), [Slides API REST Reference](https://developers.google.com/workspace/slides/api/reference/rest)

`duplicateObject` works within a single presentation only. Apps Script has `appendSlide()` but the REST API has no equivalent. This is a long-standing feature request (filed 2020, still open).

**Required strategy: Sequential Copy-and-Prune**

For a deck needing slides from sources A (3 slides), B (2 slides), C (1 slide):

```
1. Pick source A as "base" (most slides selected)
2. Drive files.copy(A) -> outputDeck
3. Slides batchUpdate: deleteObject for all slides NOT in A's selection
4. Slides batchUpdate: updateSlidesPosition to reorder A's slides
5. Drive files.copy(B) -> tempB
6. Slides batchUpdate: deleteObject for all slides NOT in B's selection
7. Read tempB's remaining slides via presentations.get
8. For each slide in tempB: read full element data, create equivalent in outputDeck
   via createSlide + shape/text insertion (design approximation)
   OR: accept single-source-per-section constraint (simpler)
9. Delete tempB
10. Repeat for C
```

**Pragmatic recommendation for v1.8:** Use a hybrid approach:
- **Primary slides** (majority from one source): copy-and-prune preserves 100% design
- **Secondary slides** (from other sources): use the branded template with content injected from the source slide's element map data (already captured in SlideElement). This trades pixel-perfect layout for API simplicity.
- **Future enhancement:** If design preservation across ALL sources becomes critical, add an Apps Script bridge via `googleapis` Apps Script API (`script.projects.run`). Defer this complexity.

### 2. ObjectId Drift After batchUpdate

**Confidence:** HIGH (documented in codebase, already handled in `deck-assembly.ts`)

After any `batchUpdate`, re-read the presentation via `presentations.get()` before referencing any objectIds. Multi-source assembly involves many mutations -- budget for re-reads after each batch.

### 3. replaceAllText Scoping is Mandatory

**Confidence:** HIGH (documented in codebase)

Every `replaceAllText` call must include `pageObjectIds: [targetSlideId]`. Without scoping, text replacement bleeds across all slides. When assembling from multiple sources with potentially overlapping text patterns, scoping prevents cross-contamination.

### 4. Gemini Structured Output: Flat Schemas Only

**Confidence:** HIGH (gap analysis constraint, verified in codebase pattern)

Modification plan schemas for Gemini must be flat objects with no optionals or unions:

```typescript
// Correct: flat, all required
{ elementId: string, action: string, newText: string, reason: string }

// Wrong: nested optionals
{ elementId: string, modifications?: { text?: string } }
```

The `ModificationAction` schema must be an array of flat objects. The wrapping `ModificationPlan` with its nested structure is for internal use (Zod), not sent to Gemini.

### 5. Element Maps Use EMU Positioning

**Confidence:** HIGH (documented in `extract-elements.ts`)

SlideElement positions are in EMU (English Metric Units, 1 EMU = 1/914400 inch). When planning modifications, element identification should use `elementId` (the Google Slides objectId), not position. Position data is informational for the LLM to understand layout context, not for addressing elements in API calls.

### 6. Forward-Only Prisma Migrations

**Confidence:** HIGH (CLAUDE.md constraint)

All schema changes use `prisma migrate dev --name <name>`. No `db push`, no `migrate reset`. The two new nullable columns (`blueprintJson`, `assemblyManifest`) are safe additive migrations.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Sequential copy-and-prune (REST API only) | Apps Script `appendSlide()` via Apps Script API | Adds deployment complexity (must create/maintain Apps Script project), introduces server-to-server latency, and Apps Script has documented performance issues for batch operations. Copy-and-prune works entirely within the REST API already used. |
| Sequential copy-and-prune (REST API only) | Element-by-element reconstruction (`createSlide` + shape/text insertion) | Loses visual design (fonts, colors, images, gradients, shapes, positioning). Reconstruction cannot replicate complex layouts. Defeats the "design-preserved" goal. |
| Gemini Flash for modification planning | Heuristic rules for element matching | LLM understands semantic intent ("this text says 'Acme Corp', replace with deal company"). Rules would miss context and require exhaustive pattern matching. Flash is fast and cheap for structured classification. |
| Gemini Flash for modification planning | GPT-OSS 120b for modification planning | Flash is faster (sub-second) and cheaper for structured classification tasks. GPT-OSS reserved for creative generation (per-slide custom copy). Division of labor: Flash classifies/plans, GPT-OSS generates. |
| GPT-OSS 120b for per-slide copy generation | Gemini for copy generation | GPT-OSS produces higher quality long-form marketing copy. Current proposal-assembly already uses GPT-OSS for this exact task. Keep the proven pattern. |
| Keep `googleapis` at ^144.0.0 | Upgrade to ^171.x | No new Slides API methods for cross-presentation copy. The upgrade would be risk (breaking changes in types) without benefit. If a future Slides API version adds `importSlides`, upgrade then. |
| Store assembly manifest as JSON String column | New `AssemblySlide` junction model | JSON column is simpler for audit trail storage. The manifest is write-once, read-for-debugging -- not queried relationally. Avoids migration complexity. |
| Hybrid approach (primary source copy-and-prune + template merge for secondary) | Full design preservation across all sources | Full preservation requires either Apps Script or element-by-element reconstruction, both adding significant complexity. Hybrid gives 80% of the visual diversity benefit with 20% of the implementation complexity. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `pptxgenjs` or any PPTX library | We generate Google Slides natively via API. PPTX would create a parallel format, break Drive integration, and lose real-time collaboration. | `googleapis` Slides API |
| Apps Script API (`script.projects.run`) | Adds deployment/maintenance of separate Apps Script project, latency, and auth complexity for marginal benefit over copy-and-prune. | Sequential copy-and-prune via REST API |
| `puppeteer` / `playwright` for slide rendering | Thumbnails already cached via GCS. No need for browser-based rendering. | Existing `gcs-thumbnails.ts` |
| Any new LLM SDK or provider | GPT-OSS (creative generation) + Gemini Flash (structured classification) cover all v1.8 needs. No gap in capability. | `openai` + `@google/genai` already installed |
| `diff` / `json-diff` libraries for modification planning | Element maps are flat structures. LLM structured output directly produces modification plans. No need for programmatic diffing. | Gemini Flash structured output |
| `googleapis` upgrade to 171.x | No new Slides API features relevant to v1.8. Risk of type breakage without benefit. | Stay on ^144.0.0 |
| Prisma 7.x | Known vector migration regression (#28867). pgvector is critical for slide matching. | Stay on ^6.3.1 |
| New state management (Redis, message queues) | Assembly is a synchronous pipeline within Mastra workflow steps. No need for external state coordination at ~20 user scale. | Mastra workflow state + Prisma |

---

## Stack Patterns by HITL Stage

### Skeleton Stage: Blueprint Resolution + Slide Selection

**Pattern:** DeckStructure query -> slide candidate filtering -> LLM scoring -> resolved blueprint

```
1. Load DeckStructure for touch type (+ artifact type for Touch 4)
2. For each section: query SlideEmbedding candidates using section.slideIds
3. Enrich candidates with classification metadata + element map summary
4. Score candidates against deal context via Gemini Flash structured output:
   - Industry match (deal.company.industry vs slide.industry)
   - Pillar alignment (brief.primaryPillar vs slide.solutionPillar)
   - Persona fit (deal context vs slide.persona)
   - Funnel stage (touch type mapping vs slide.funnelStage)
5. Select top candidate per section, store as ResolvedBlueprint
6. Suspend workflow for HITL review (seller sees blueprint + selections)
```

**Libraries used:** Prisma, `pgvector` (raw SQL cosine similarity), `@google/genai` (Gemini Flash), `@mastra/core` (suspend)

### Low-fi Stage: Multi-Source Assembly

**Pattern:** Group slides by source -> sequential copy-and-prune -> merge -> reorder

```
1. Resume workflow with approved/modified blueprint
2. Group selected slides by source presentation ID
3. Pick source with most slides as "base" -> Drive files.copy to deal folder
4. Delete unwanted slides from base copy (batchUpdate deleteObject)
5. For secondary sources: copy-and-prune each, then either:
   a. Use branded template slide + inject content from element map (pragmatic)
   b. OR read elements and approximate in base deck (complex, deferred)
6. Reorder all slides via updateSlidesPosition to match blueprint order
7. Apply deal-level customizations (company name, salesperson) via replaceAllText
8. Suspend for HITL review (seller sees assembled deck in Google Slides)
```

**Libraries used:** `googleapis` (Drive + Slides APIs), Prisma, `@mastra/core` (suspend)

### High-fi Stage: Element-Map-Guided Surgical Modifications

**Pattern:** Load element map per slide -> LLM modification planning -> scoped API execution

```
1. Resume workflow with approved/modified assembled deck
2. For each slide in the deck:
   a. Load SlideElement records (elementId, type, position, content, styling)
   b. Send to Gemini Flash: "Given this element map and deal context, which elements
      need modification? Return flat array of {elementId, action, newText, reason}"
   c. For elements needing new creative copy: send to GPT-OSS for generation
   d. Execute modifications via scoped replaceAllText (pageObjectIds per slide)
3. Re-read presentation after each batch of modifications (objectId drift)
4. Share final deck with org
5. Complete workflow (HITL approved state)
```

**Libraries used:** Prisma (SlideElement), `@google/genai` (Gemini Flash), `openai` (GPT-OSS), `googleapis` (Slides API), `@mastra/core` (resume/complete)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `prisma@^6.3.1` | `pgvector@0.2.0` | Prisma 7.x breaks vector migrations. Stay on 6.x. |
| `@mastra/core@^1.8.0` | `zod@^4.3.6` | Mastra 1.8 requires Zod v4 for workflow step schemas. New steps follow same pattern. |
| `googleapis@^144.0.0` | `google-auth-library@^9.15.1` | Stable pairing. Drive v3 + Slides v1 APIs unchanged. |
| `@google/genai@^1.43.0` | Gemini 2.5 Flash | Structured output with `responseSchema` works for flat schemas. |
| `openai@^6.27.0` | GPT-OSS 120b on Vertex AI | Same API pattern as existing proposal generation. |

---

## Integration Points with Existing Code

### Extend (Not Replace)

| Existing Module | Extension for v1.8 | Notes |
|----------------|---------------------|-------|
| `deck-assembly.ts` | Refactor to support multi-source input instead of single-template duplication | Currently duplicates one template slide N times. New: copies actual source slides. |
| `deck-customizer.ts` | Extend `assembleDeckFromSlides` to handle multiple source presentations | Currently single-source copy-and-prune. New: sequential multi-source. |
| `slide-selection.ts` | Add DeckStructure-aware candidate filtering (section.slideIds as pre-filter) | Currently uses RAG retrieval independently. New: structure-guided selection. |
| `proposal-assembly.ts` | Consume ResolvedBlueprint instead of building SlideAssembly from scratch | Currently generates flat JSON. New: uses blueprint sections as scaffold. |
| `touch-4-workflow.ts` | Add new workflow steps for blueprint resolution, assembly, and modification | Currently goes straight from RAG to SlideAssembly JSON. New: 3 explicit stages. |
| Touch 2/3 workflows | Wire in structure-driven pipeline (same steps, different DeckStructure key) | Currently manual slide selection from single source. New: automated via blueprint. |
| `extract-elements.ts` | No changes needed | Element extraction already captures everything modification planning needs. |
| `deck-structure-schema.ts` | No changes needed | DeckSection already has `slideIds` array for candidate mapping. |

### New Files to Create

| File | Purpose |
|------|---------|
| `apps/agent/src/generation/structure-blueprint-resolver.ts` | Resolve DeckStructure to concrete slide selections |
| `apps/agent/src/generation/section-slide-matcher.ts` | Score/rank slide candidates per section |
| `apps/agent/src/generation/multi-source-assembler.ts` | Assemble slides from N source presentations |
| `apps/agent/src/generation/modification-planner.ts` | Generate per-slide modification plans from element maps |
| `apps/agent/src/generation/surgical-modifier.ts` | Execute planned modifications via Slides API |
| `packages/schemas/generation/resolved-blueprint.ts` | ResolvedBlueprint Zod schema |
| `packages/schemas/generation/assembly-manifest.ts` | AssemblyManifest Zod schema |
| `packages/schemas/generation/modification-plan.ts` | ModificationPlan + ModificationAction Zod schemas |

---

## Installation

```bash
# No new packages to install.
# All capabilities come from existing dependencies.

# Only Prisma migration needed:
cd apps/agent
pnpm exec prisma migrate dev --create-only --name add-blueprint-assembly-fields
# Inspect SQL (adds blueprintJson and assemblyManifest to InteractionRecord)
pnpm exec prisma migrate dev --name add-blueprint-assembly-fields
```

---

## Sources

### HIGH Confidence (Official docs + codebase verified)
- [Google Issue Tracker #167977584](https://issuetracker.google.com/issues/167977584) -- confirmed no REST API cross-presentation slide copy
- [Google Slides API - Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides) -- `duplicateObject` is intra-presentation only
- [Google Slides API REST Reference](https://developers.google.com/workspace/slides/api/reference/rest) -- verified available batchUpdate request types
- [Google Slides Merge Guide](https://developers.google.com/workspace/slides/api/guides/merge) -- template merge patterns via replaceAllText
- [googleapis npm](https://www.npmjs.com/package/googleapis) -- latest 171.x, no new Slides methods relevant to v1.8
- Codebase: `deck-assembly.ts`, `deck-customizer.ts`, `extract-elements.ts`, `schema.prisma`, `deck-structure-schema.ts` -- verified existing patterns and capabilities

### MEDIUM Confidence (Multiple sources agree)
- Apps Script `appendSlide()` exists but REST API equivalent does not -- confirmed across Google docs, Issue Tracker, and developer forums
- Sequential copy-and-prune as standard workaround -- multiple developer blog posts and Stack Overflow answers describe this pattern

---
*Stack research for: v1.8 Structure-Driven Deck Generation*
*Researched: 2026-03-09*
