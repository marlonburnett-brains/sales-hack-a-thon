# Slide Deck Generation: Current State, Vision & Gap

## What's Built

### Intelligence Layer
- **Deck Structure Inference** (`apps/agent/src/deck-intelligence/`): Analyzes classified examples and templates per touch type + artifact type. Produces ordered sections with name, purpose, isOptional, variationCount, and **mapped slideIds** pointing to actual ingested slides.
- **7 logical keys**: touch_1, touch_2, touch_3, pre_call, touch_4×proposal, touch_4×talk_track, touch_4×faq
- **Chat refinement**: Users can conversationally refine inferred structures; constraints persist across re-inference
- **Auto-inference cron**: Re-triggers when example data changes (detected via SHA-256 hash of example IDs)
- **Confidence scoring**: 0-100 based on example count, with red/yellow/green thresholds

### Ingestion Layer
- **Full slide extraction** (`apps/agent/src/ingestion/`): Text, speaker notes, 768-dim embeddings, LLM classification (industry, pillar, funnel stage, slide category, buyer persona, touch type), AI-generated descriptions (purpose, visual composition, key content, use cases)
- **Element-level capture** (`SlideElement` model): Every page element's type, position (EMU), size (EMU), content text, font size, font color, bold flag. Supports recursive group extraction.
- **Smart merge**: Content-hash change detection, archive-on-removal, needsReReview flagging
- **Thumbnails**: Cached per slide for visual browsing

### Generation Layer (Current)
- **Touch 4** (`deck-assembly.ts`): Takes a `SlideAssembly` JSON (slideTitle, bullets, speakerNotes, sectionType per slide). Copies a **single branded template**, duplicates its slides N times, injects text via `{{placeholder}}` replacement. All slides look identical in layout.
- **Touch 2 & 3** (`deck-customizer.ts`): Copies an **entire single source presentation**, deletes unwanted slides, reorders remaining, applies text/image customizations. Single-source only.
- **Touch 1** (`slide-assembly.ts`): Template merge — copy template, replace placeholders with deal-specific text/images.
- **Google Workspace APIs**: Slides (batchUpdate, duplicateObject, replaceAllText, deleteObject, updateSlidesPosition), Docs (create, batchUpdate for talk tracks/FAQs), Drive (copy, move, share).

### RAG Retrieval
- **AtlusAI search** (`atlusai-search.ts`): Multi-pass semantic search — primary pillar + industry, secondary pillars, case studies. Three-tier fallback for sparse results.
- **Slide selection** (`slide-selection.ts`): LLM-powered weighting to pick best slides from search results.
- **Proposal assembly** (`proposal-assembly.ts`): Filters by metadata, builds SlideAssembly JSON, generates per-slide custom copy grounded in sales brief.

---

## The Vision

1. The inferred **DeckStructure** (with its ordered sections and mapped slideIds) serves as the blueprint for what the final deck should look like
2. For each section in the structure, the system **picks the best actual source slide** from the ingested library — considering deal context (industry, pillar, buyer persona, funnel stage)
3. Selected source slides are **copied from their respective source presentations into a new presentation** — preserving each slide's original visual design and layout
4. The system **plans per-slide modifications** using the element map — knowing exactly which text boxes exist, their positions, sizes, and current content — to determine what needs to change
5. Modifications are **executed surgically** on each copied slide, replacing only the content that needs to change while preserving the visual design
6. The result is a **visually diverse, professionally designed deck** where each slide retains its original layout rather than being flattened into a uniform template

---

## The Gap

### Gap 1: DeckStructure is not consumed by generation
The intelligence layer produces DeckStructure with ordered sections and mapped slideIds, but the generation layer ignores it entirely. Touch 4 uses RAG retrieval independently; Touches 2-3 use manual slide selection from a single source. **The bridge between structure intelligence and slide selection does not exist.**

### Gap 2: No multi-source slide assembly
The current system can only copy slides from **one** source presentation at a time. The vision requires cherry-picking slides from **multiple** source presentations (each section's best slide may come from a different deck) and assembling them into a single new presentation. Google Slides API supports cross-presentation copy via `duplicateObject` with `objectIdHeader` but this is not implemented.

### Gap 3: Slides are content-generated, not design-preserved
Touch 4 currently generates a `SlideAssembly` JSON (title + bullets + notes) and injects it into duplicated copies of a single template slide. Every slide in the output has the **same layout**. The vision is to copy actual source slides — each with its own unique design — and modify only the text content. The rich element maps captured during ingestion (position, size, type, content per element) exist in the database but are **never used during generation**.

### Gap 4: No per-slide modification planning
Currently, LLM rewrites are done at the content level (generate new bullets/titles grounded in the brief). There is no step that looks at a specific copied slide's element map and plans **which elements to modify and how** — e.g., "text box at position (X,Y) currently says 'Acme Corp case study', replace with '{DealCompany} case study'". This planning step would enable surgical modifications that preserve layout integrity.

### Gap 5: Section-to-slide matching logic
No logic exists to take a DeckStructure section (e.g., "Case Study - Problem Statement", with 4 candidate slideIds) and select the **best** candidate for a specific deal based on deal context (industry match, pillar alignment, buyer persona fit). The slideIds are mapped during inference but never resolved at generation time.

---

## Key Files for the Planner

| Component | Path |
|---|---|
| Deck structure inference | `apps/agent/src/deck-intelligence/infer-deck-structure.ts` |
| Deck structure schema | `apps/agent/src/deck-intelligence/deck-structure-schema.ts` |
| Deck structure key resolver | `apps/agent/src/deck-intelligence/deck-structure-key.ts` |
| Current Touch 4 workflow | `apps/agent/src/mastra/workflows/touch-4-workflow.ts` |
| Current deck assembly (JSON→Slides) | `apps/agent/src/lib/deck-assembly.ts` |
| Current deck customizer (copy & prune) | `apps/agent/src/lib/deck-customizer.ts` |
| Current slide assembly (template merge) | `apps/agent/src/lib/slide-assembly.ts` |
| Proposal assembly (RAG→JSON) | `apps/agent/src/lib/proposal-assembly.ts` |
| AtlusAI search | `apps/agent/src/lib/atlusai-search.ts` |
| Slide selection | `apps/agent/src/lib/slide-selection.ts` |
| SlideAssembly schema | `packages/schemas/llm/slide-assembly.ts` |
| Slide metadata schema | `packages/schemas/llm/slide-metadata.ts` |
| Element extraction | `apps/agent/src/ingestion/extract-elements.ts` |
| Prisma schema (SlideEmbedding, SlideElement, DeckStructure, Template) | `apps/agent/prisma/schema.prisma` |
| Constants (artifact types, touch types, industries, pillars) | `packages/schemas/constants.ts` |
| Brand compliance checks | `apps/agent/src/lib/brand-compliance.ts` |
| Google Docs builder | `apps/agent/src/lib/doc-builder.ts` |

---

## Constraints for the Planner

- All schema changes must use `prisma migrate dev --name <name>` (never `db push` or `migrate reset`)
- LLM schemas must be flat objects with no optionals/unions (Gemini structured output compatibility)
- Google Slides API: always re-read presentation after batchUpdate (objectId drift); scope replaceAllText with pageObjectIds
- Mastra workflows use `createStep()` with input/output schemas; async HITL via suspend/resume
- Named agents use `executeRuntimeNamedAgent()` or `executeRuntimeProviderNamedAgent()`
- The system currently uses Gemini 2.5 Flash for classification and structured output tasks
