# Architecture Research: Structure-Driven Deck Generation

**Domain:** Multi-source slide assembly with element-map-guided modifications for agentic sales platform
**Researched:** 2026-03-09
**Confidence:** HIGH (existing codebase fully analyzed, Google Slides API constraints verified)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HITL Layer (web)                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐               │
│  │  Skeleton   │  │  Low-fi    │  │    High-fi     │               │
│  │ Blueprint + │  │ Assembled  │  │  Surgical      │               │
│  │ Selections  │  │ Multi-Src  │  │  Modifications │               │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘               │
├────────┴──────────────┴────────────────┴──────────────────────────┤
│                     Orchestration Layer (agent)                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │          Structure-Driven Generation Pipeline             │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │     │
│  │  │  Blueprint   │  │ Multi-Source │  │  Modification  │   │     │
│  │  │  Resolver    │  │  Assembler   │  │  Planner       │   │     │
│  │  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘   │     │
│  │         │                │                   │           │     │
│  │  ┌──────┴──────┐  ┌──────┴───────┐  ┌───────┴───────┐   │     │
│  │  │  Section    │  │  Slide       │  │  Element-Map  │   │     │
│  │  │  Matcher    │  │  Copier      │  │  Executor     │   │     │
│  │  └─────────────┘  └──────────────┘  └───────────────┘   │     │
│  └──────────────────────────────────────────────────────────┘     │
├───────────────────────────────────────────────────────────────────┤
│                     Intelligence Layer (existing)                  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐          │
│  │ DeckStructure│  │ SlideEmbedding│  │  SlideElement  │          │
│  │ (blueprint)  │  │ (vectors +    │  │  (element maps)│          │
│  │              │  │  classification│  │                │          │
│  └──────────────┘  └───────────────┘  └────────────────┘          │
├───────────────────────────────────────────────────────────────────┤
│                     Storage Layer                                  │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐          │
│  │  Supabase    │  │  Google       │  │  pgvector      │          │
│  │  PostgreSQL  │  │  Drive/Slides │  │  HNSW Index    │          │
│  └──────────────┘  └───────────────┘  └────────────────┘          │
└───────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### New Components (6 total)

| Component | Responsibility | Location |
|-----------|---------------|----------|
| **Blueprint Resolver** | Reads DeckStructure for a touch type, resolves sections into generation plan with slot assignments | `apps/agent/src/generation/blueprint-resolver.ts` |
| **Section Matcher** | For each DeckStructure section, selects the best candidate slideId based on deal context (industry, pillar, persona, funnel stage) using vector similarity + classification metadata | `apps/agent/src/generation/section-matcher.ts` |
| **Multi-Source Assembler** | Creates a new presentation by copying slides from multiple source presentations using the Drive-copy-and-merge strategy | `apps/agent/src/generation/multi-source-assembler.ts` |
| **Slide Copier** | Handles the atomic operation of copying a single slide from a source presentation into a target presentation (Drive copy + delete unwanted + merge) | `apps/agent/src/generation/slide-copier.ts` |
| **Modification Planner** | Given a copied slide's element map, plans which elements need content changes based on deal context; produces a ModificationPlan per slide | `apps/agent/src/generation/modification-planner.ts` |
| **Element-Map Executor** | Executes ModificationPlans via Google Slides batchUpdate: replaceAllText scoped to specific pageObjectIds, insertText for empty elements, deleteText + insertText for content swaps | `apps/agent/src/generation/element-map-executor.ts` |

### Existing Components to Modify (4 total)

| Component | Current State | Modification |
|-----------|--------------|-------------|
| **Touch workflows (1-4)** | Each workflow has its own generation step calling different assemblers | Refactor generation steps to use Blueprint Resolver as entry point; existing assemblers become fallback paths |
| **proposal-assembly.ts** | Builds SlideAssembly JSON with hardcoded 7-section template | Replace section template with DeckStructure sections; toAssemblySlide() enriched with element map data |
| **slide-selection.ts** | Searches AtlusAI/pgvector for candidates, LLM picks best | Section Matcher replaces this for structure-driven flows; slide-selection.ts becomes fallback for non-structure flows |
| **deck-assembly.ts** | Single-source template duplication with placeholder injection | Multi-Source Assembler replaces this for structure-driven flows; deck-assembly.ts remains for simple template-merge Touch 1 |

### Existing Components Unchanged

| Component | Why Unchanged |
|-----------|--------------|
| `infer-deck-structure.ts` | Already produces the DeckStructure with slideIds -- the upstream data source |
| `extract-elements.ts` | Already captures element maps during ingestion -- no changes needed |
| `atlusai-search.ts` | Still needed for RAG search; Section Matcher adds a structure-aware layer on top |
| `deck-customizer.ts` | `applyDeckCustomizations()` still useful for branding injection post-assembly |
| `slide-assembly.ts` | Touch 1 template merge remains simple enough to not need structure-driven generation |

## Recommended Project Structure

```
apps/agent/src/
├── generation/                    # NEW: Structure-driven generation pipeline
│   ├── blueprint-resolver.ts      # DeckStructure -> GenerationBlueprint
│   ├── section-matcher.ts         # Section + DealContext -> best slideId
│   ├── multi-source-assembler.ts  # Multiple sources -> single presentation
│   ├── slide-copier.ts            # Atomic cross-presentation slide copy
│   ├── modification-planner.ts    # Element map + context -> ModificationPlan
│   ├── element-map-executor.ts    # ModificationPlan -> Slides API batchUpdate
│   └── types.ts                   # Shared types for the generation pipeline
├── deck-intelligence/             # EXISTING: Unchanged
│   ├── infer-deck-structure.ts
│   ├── deck-structure-schema.ts
│   └── deck-structure-key.ts
├── lib/                           # EXISTING: Some modifications
│   ├── deck-assembly.ts           # Kept as fallback, not primary path
│   ├── deck-customizer.ts         # Kept for branding injection
│   ├── slide-assembly.ts          # Kept for Touch 1 template merge
│   ├── proposal-assembly.ts       # Modified to use DeckStructure sections
│   ├── slide-selection.ts         # Kept as fallback for non-structure flows
│   └── atlusai-search.ts          # Unchanged
└── mastra/workflows/
    ├── touch-1-workflow.ts        # Minor: add blueprint path with fallback
    ├── touch-2-workflow.ts        # Refactor: blueprint-driven selection
    ├── touch-3-workflow.ts        # Refactor: blueprint-driven selection
    └── touch-4-workflow.ts        # Refactor: blueprint-driven assembly
```

### Structure Rationale

- **`generation/` as new directory:** Separates the new pipeline from existing `lib/` code. The existing assemblers in `lib/` remain as fallbacks, and the new pipeline can be adopted touch-by-touch without breaking existing flows.
- **`types.ts` in generation/:** Shared interfaces (GenerationBlueprint, SectionSlot, ModificationPlan, CopyResult) avoid circular imports between the 6 new modules.

## Architectural Patterns

### Pattern 1: Blueprint-First Generation

**What:** Every deck generation starts by resolving a DeckStructure into a GenerationBlueprint -- an ordered list of SectionSlots, each with candidate slideIds, deal context filters, and optional/required flags.

**When to use:** All touches that have a DeckStructure available (which should be all touches once examples are classified).

**Trade-offs:** Adds a resolution step before generation, but eliminates hardcoded section templates and enables the same pipeline for all touches.

**Example:**
```typescript
interface SectionSlot {
  sectionName: string;
  purpose: string;
  isOptional: boolean;
  candidateSlideIds: string[];  // From DeckStructure.sections[].slideIds
  selectedSlideId?: string;     // Filled by Section Matcher
  sourcePresentationId?: string; // Resolved from SlideEmbedding.templateId -> Template.presentationId
  modificationPlan?: ModificationPlan; // Filled by Modification Planner
}

interface GenerationBlueprint {
  touchType: string;
  artifactType?: string;
  sections: SectionSlot[];
  dealContext: DealContext;
  sequenceRationale: string;
}
```

### Pattern 2: Drive-Copy-Merge for Multi-Source Assembly

**What:** The Google Slides REST API has NO native cross-presentation slide copy. The `duplicateObject` request only works within a single presentation. This is a confirmed API limitation (Google Issue Tracker #167977584). The workaround strategy:

1. Group selected slides by their source presentation ID
2. Identify the primary source (most slides selected from it)
3. Copy the primary source via `drive.files.copy()` -- this preserves all objectIds
4. Delete unwanted slides from the copy (existing copy-and-prune pattern in `deck-customizer.ts`)
5. For secondary sources, copy each via `drive.files.copy()`, extract wanted slides, and merge into the target

**When to use:** Whenever the final deck needs slides from 2+ different source presentations.

**Trade-offs:**
- Google Apps Script `appendSlide()` provides perfect cross-presentation copy (preserves master, layout, all elements) but requires deploying an Apps Script project as an API executable -- adding infrastructure complexity
- Manual element reconstruction via Slides API batchUpdate is lossy (images, complex layouts, animations, linked objects are lost or degraded)
- Drive-copy-per-source creates temporary files that must be cleaned up

**Recommended approach for v1.8:** Use the Drive-copy-and-prune strategy as the primary path. For the most common case where all or most selected slides come from one source presentation, this works perfectly with zero new infrastructure. For true multi-source cases, use a two-phase approach:

Phase A (v1.8): Copy primary source, prune. For secondary source slides, copy that source too, prune to just the wanted slides, then use Slides API to read each slide's pageElements and recreate text/shape elements in the target. Accept partial fidelity for images (use placeholder or thumbnail URL). This handles 80% of cases.

Phase B (future): Migrate to Apps Script `appendSlide()` via Apps Script API for perfect multi-source fidelity when visual precision becomes critical.

**Example:**
```typescript
interface MultiSourcePlan {
  /** Source with the most selected slides becomes the base */
  primarySource: {
    presentationId: string;
    keepSlideIds: string[];
    deleteSlideIds: string[];  // All slides NOT in keepSlideIds
  };
  /** Additional sources contribute individual slides */
  secondarySources: Array<{
    presentationId: string;
    slideIds: string[];  // Slides to copy from this source
  }>;
  /** Final slide order after all sources merged */
  finalSlideOrder: string[];
}
```

### Pattern 3: Element-Map-Guided Surgical Modification

**What:** Instead of blowing away slide content and injecting from scratch (current `replaceAllText` with `{{placeholder}}`), read the element map for a copied slide, identify which text elements need modification based on deal context, and plan targeted modifications that touch only specific elements.

**When to use:** After slides are copied into the target presentation (Low-fi to High-fi transition in HITL).

**Trade-offs:**
- Preserves all visual design, positioning, images, and styling
- Requires element maps to be populated (backfill mechanism already handles this)
- More API calls per slide (one modification operation per changed element vs. one replaceAllText per placeholder)
- Element objectIds are preserved during `drive.files.copy()` but may change if slides are reconstructed via batchUpdate

**Example:**
```typescript
interface ElementModification {
  elementId: string;          // From SlideElement.elementId
  elementType: string;        // "text" | "shape" (only text-bearing elements)
  currentContent: string;     // From SlideElement.contentText
  newContent: string;         // LLM-generated replacement grounded in deal context
  reason: string;             // Why this element needs modification
}

interface ModificationPlan {
  slideId: string;            // SlideEmbedding.id
  slideObjectId: string;      // Google Slides page objectId
  modifications: ElementModification[];
  unmodifiedElements: string[]; // Element IDs deliberately left unchanged
}
```

### Pattern 4: Graceful Degradation Chain

**What:** Each new capability has a fallback to the existing working pattern:

```
Structure-driven + multi-source + element-map mods
  |-- fallback --> Structure-driven + single-source + placeholder injection
      |-- fallback --> RAG-driven + single-source + placeholder injection (current)
          |-- fallback --> Template merge (Touch 1 current)
```

**When to use:** Always. Fallbacks activate when:
- No DeckStructure exists for the touch type (fall to RAG-driven)
- All selected slides come from one source (skip multi-source, use copy-and-prune)
- Element maps missing for a slide (fall to placeholder injection)
- Secondary source slide copy fails (use branded template with content injection as fallback)

**Trade-offs:** More conditional logic in the pipeline, but zero risk of breaking existing flows during incremental rollout.

## Data Flow

### Generation Pipeline Flow

```
[DealContext + TouchType]
    |
    v
[Blueprint Resolver]
    |-- reads DeckStructure from DB (touchType + artifactType)
    |-- produces GenerationBlueprint with SectionSlots
    |
    v
[Section Matcher]  (per section)
    |-- loads SlideEmbeddings for candidateSlideIds
    |-- scores candidates by deal context (vector similarity + metadata match)
    |-- selects best slideId per section
    |-- resolves sourcePresentationId via SlideEmbedding -> Template join
    |
    v
[HITL Skeleton Stage]
    |-- presents: blueprint sections, selected slides, rationale
    |-- user can: swap slide selections, reorder sections, toggle optional sections
    |
    v
[Multi-Source Assembler]
    |-- groups selected slides by sourcePresentationId
    |-- determines primary source (most slides)
    |-- executes copy-and-prune for primary source
    |-- copies secondary source slides (element reconstruction or fallback)
    |-- reorders slides to match blueprint sequence
    |-- produces target presentationId with all slides in order
    |
    v
[HITL Low-fi Stage]
    |-- presents: assembled Google Slides deck (slides from multiple sources, original designs)
    |-- user can: approve, request reordering, flag slides for modification
    |
    v
[Modification Planner]  (per flagged slide or all slides)
    |-- loads SlideElement[] for each slide from DB
    |-- sends element map + deal context to LLM (named agent: "modification-planner")
    |-- LLM produces ModificationPlan: which elements to change, new content
    |
    v
[Element-Map Executor]
    |-- for each modification: scoped replaceAllText or deleteText+insertText
    |-- re-reads presentation after each batchUpdate (objectId drift prevention)
    |
    v
[HITL High-fi Stage]
    |-- presents: final deck with surgical modifications applied
    |-- user can: approve, request further modifications, revert to Low-fi
    |
    v
[Drive Integration]
    |-- save to deal folder, share with org, record interaction
```

### Key Data Joins

```
DeckStructure.sections[].slideIds
    --> SlideEmbedding.id
        --> SlideEmbedding.templateId
            --> Template.presentationId  (Google Slides source ID)
        --> SlideElement[]  (element map for modification planning)
        --> SlideEmbedding.classificationJson  (for context-aware matching)
        --> SlideEmbedding.embedding  (for vector similarity scoring)
        --> SlideEmbedding.slideObjectId  (Google Slides page objectId)
```

## HITL Stage Mapping (Existing 3-Stage Model)

The existing 3-stage HITL workflow maps cleanly to the new pipeline:

| Stage | Current Behavior | New Behavior |
|-------|-----------------|-------------|
| **Skeleton** | Slide selection rationale (Touch 2/3) or sales brief (Touch 4) | GenerationBlueprint: sections from DeckStructure, selected slides per section with thumbnails, matching rationale. User approves/modifies section composition. |
| **Low-fi** | Draft slide order + notes (Touch 2/3) or SlideAssembly JSON (Touch 4) | Assembled multi-source deck in Google Slides. User sees actual slides from different sources with original designs. Approves or flags slides for modification. |
| **High-fi** | Assembled Google Slides deck | Surgically modified deck. Element-map-guided content changes applied. User sees final polished output with deal-specific content. |

## Critical Integration Points

### 1. SlideEmbedding to Template to presentationId Resolution

The Section Matcher needs to resolve a SlideEmbedding ID to its source Google Slides presentation ID. The join path is:

```
SlideEmbedding.templateId -> Template.id -> Template.presentationId
```

This is a simple Prisma include/join. No schema changes needed -- both models and the FK exist.

### 2. Element Map Availability Check

Before planning modifications, check that the slide has element maps populated:

```typescript
const elements = await prisma.slideElement.findMany({
  where: { slideId: slideEmbeddingId }
});
if (elements.length === 0) {
  // Fallback: use placeholder injection pattern from deck-assembly.ts
}
```

Element maps may be missing for slides ingested before v1.5. The existing backfill detection mechanism already handles re-ingestion for slides missing element maps.

### 3. Cross-Presentation Slide Copy (THE HARD PART)

**Google Slides REST API limitation (verified):** `duplicateObject` only works within a single presentation. There is NO native REST API method to copy a slide from presentation A into presentation B. This is a confirmed limitation per Google Issue Tracker #167977584.

**Three viable strategies, in order of fidelity:**

| Strategy | Fidelity | Complexity | Dependency |
|----------|----------|------------|------------|
| Apps Script `appendSlide()` via Apps Script API | Perfect -- copies master, layout, all elements | Medium -- requires Apps Script project deployed as API executable | Google Apps Script project + `script.run` API |
| Drive copy + delete unwanted (copy-and-prune) | Perfect for primary source, N/A for adding slides from other sources | Low for single-source, needs workaround for multi-source | None beyond existing Drive + Slides API access |
| Element reconstruction via batchUpdate | Low -- loses images, complex layouts, animations, linked objects | Very High -- must reconstruct every pageElement | None |

**Recommended approach for v1.8:** Use Drive copy-and-prune as the primary path, grouping selected slides by source presentation.

For the most common case where all or most selected slides come from one source, this works perfectly (it is what `deck-customizer.ts` already does).

For true multi-source cases:
1. Use the source with the most selected slides as the base (copy-and-prune)
2. For each additional source slide: copy the source presentation, read the target slide's pageElements, create a new blank slide in the target presentation, and recreate text/shape elements via batchUpdate `createShape` + `insertText`. Accept partial fidelity for images (link to thumbnail URL from SlideEmbedding.thumbnailUrl)
3. Plan migration to Apps Script `appendSlide()` as a fast follow if visual fidelity of secondary-source slides becomes a blocking issue

**Why not Apps Script first:** Adding an Apps Script project deployment adds infrastructure complexity (deploy script, manage execution permissions, handle quotas). The Drive copy-and-prune approach handles the majority case with zero new infrastructure.

### 4. ObjectId Stability During Copy

When `drive.files.copy()` copies a presentation, all page objectIds and element objectIds are preserved. This means:
- SlideEmbedding.slideObjectId matches the copied slide's objectId
- SlideElement.elementId matches the copied slide's element objectIds
- Modification plans built from element maps will target the correct elements

**Critical constraint:** After ANY `presentations.batchUpdate()` call, re-read the presentation via `presentations.get()` because objectIds can drift. This pattern is already established in `deck-assembly.ts`.

### 5. Workflow Step Integration

Each touch workflow needs a new generation step that replaces the current assembly step. The pattern:

```typescript
const structureDrivenGeneration = createStep({
  id: "structure-driven-generation",
  inputSchema: z.object({
    dealId: z.string(),
    touchType: z.string(),
    approvedBlueprint: generationBlueprintSchema,
  }),
  outputSchema: z.object({
    presentationId: z.string(),
    deckUrl: z.string(),
    slideCount: z.number(),
    modificationPlans: z.array(modificationPlanSchema),
  }),
  execute: async ({ inputData }) => {
    // 1. Multi-Source Assembly (or single-source copy-and-prune)
    // 2. Return assembled deck for Low-fi review
    // 3. On High-fi trigger, execute modification plans
  },
});
```

## New Database Requirements

**No new Prisma models required.** The existing schema (DeckStructure, SlideEmbedding, SlideElement, Template) contains all data needed for the generation pipeline.

The existing InteractionRecord model already tracks artifact stages and can store generation metadata in its existing JSON fields.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ~20 sellers (current) | Sequential slide copying is fine. Single Google API client. Drive copy cleanup via fire-and-forget delete. |
| ~100 sellers | Batch slide copying with parallel Drive API calls per source. Rate limit awareness (Slides API: 60 requests/minute per user). Consider Apps Script migration for better multi-source support. |
| ~500+ sellers | Apps Script API required for multi-source fidelity. Queue-based generation with retry. Dedicated service account pool for Google API rate limits. |

### First Bottleneck: Google Slides API Rate Limits

At current scale (~20 sellers), each deck generation makes 5-20 API calls (copy, read, batchUpdate, delete, share). At 100+ concurrent generations, the 60 req/min user-level rate limit becomes the bottleneck. Mitigation: queue generation requests, use exponential backoff, consider multiple service accounts.

### Second Bottleneck: LLM Calls for Modification Planning

Each slide's modification plan requires an LLM call. A 15-slide deck = 15 LLM calls for modification planning alone. At scale, parallelize these calls and consider batching multiple slides into a single LLM call with structured output.

## Anti-Patterns

### Anti-Pattern 1: Reconstructing Slides Element-by-Element from Scratch

**What people do:** Parse source slide's pageElements via `presentations.get()` and recreate them via `createShape`, `createImage`, `insertText` in the target presentation.
**Why it's wrong:** Images require publicly accessible URLs (service account cannot re-serve them), linked objects break, animations are lost, text styling is partially preserved at best, tables are extremely complex to reconstruct. The Slides API GET response schema is NOT the same as the batchUpdate request schema -- they require manual conversion.
**Do this instead:** Copy the entire source presentation via Drive API and prune unwanted slides. This preserves 100% of design fidelity for all slides from that source.

### Anti-Pattern 2: Modifying Slides via Global replaceAllText

**What people do:** Use `replaceAllText` without `pageObjectIds` scoping, or use it with generic placeholders that might match content in multiple elements across multiple slides.
**Why it's wrong:** Replaces text across ALL slides or ALL matching elements, causing cross-slide contamination. The risk increases significantly with multi-source assembly where content patterns from different sources may collide.
**Do this instead:** Always scope `replaceAllText` with `pageObjectIds: [targetSlideObjectId]`. For element-level precision, use `deleteText` targeting the specific text range within an element's objectId, then `insertText` at the same location.

### Anti-Pattern 3: Assuming Element ObjectIds Are Stable Across batchUpdate

**What people do:** Build a batch of modifications referencing element objectIds, send as a single batchUpdate, assume all IDs remain valid throughout.
**Why it's wrong:** Some operations (deleteObject, duplicateObject) can cause objectId reassignment. After any structural change, the presentation must be re-read.
**Do this instead:** For modification plans, execute modifications slide-by-slide. Text-only modifications on existing elements within a single slide can be batched safely. Re-read the presentation between slides if structural changes are involved.

### Anti-Pattern 4: Using DeckStructure slideIds Directly as Google Slides objectIds

**What people do:** Assume `DeckStructure.sections[].slideIds` are Google Slides page objectIds that can be used directly in batchUpdate requests.
**Why it's wrong:** These are SlideEmbedding.id values (cuid strings), not Google Slides objectIds. They must be resolved through Prisma: `SlideEmbedding.id -> SlideEmbedding.slideObjectId` for the Google Slides objectId, and `SlideEmbedding.templateId -> Template.presentationId` for the source presentation.
**Do this instead:** Always resolve through the Prisma join chain before making any Google API calls.

### Anti-Pattern 5: Building Multi-Source Assembly Before Single-Source Works

**What people do:** Jump straight to implementing cross-presentation slide merging for all cases.
**Why it's wrong:** Multi-source assembly is the hardest part due to Google API limitations. Most real decks draw heavily from 1-2 source presentations. Building the full pipeline with fallbacks first (blueprint -> section matching -> single-source assembly -> modifications) delivers value faster and exercises the entire flow before tackling the API-limited edge case.
**Do this instead:** Build the pipeline with single-source copy-and-prune first. Add multi-source support as an enhancement once the core pipeline is working.

## Suggested Build Order

Based on dependency analysis:

### Phase 1: Foundation Types + Blueprint Resolver
**Dependencies:** DeckStructure schema (exists), Prisma models (exist)
**Builds:** `generation/types.ts`, `generation/blueprint-resolver.ts`
**Why first:** Every downstream component depends on GenerationBlueprint and SectionSlot types. Blueprint Resolver is a pure data transform (DeckStructure -> GenerationBlueprint) with no external service calls.

### Phase 2: Section Matcher
**Dependencies:** Blueprint Resolver (Phase 1), SlideEmbedding + classification data (exist), pgvector (exists)
**Builds:** `generation/section-matcher.ts`
**Why second:** Section Matcher fills the `selectedSlideId` and `sourcePresentationId` fields in SectionSlots. This is the intelligence that replaces the existing RAG-driven slide selection for structure-driven flows.

### Phase 3: Multi-Source Assembler + Slide Copier
**Dependencies:** Section Matcher (Phase 2), Google Drive/Slides APIs (exist), deck-customizer.ts patterns (exist)
**Builds:** `generation/multi-source-assembler.ts`, `generation/slide-copier.ts`
**Why third:** The assembler is the most complex new component and the most constrained by Google API limitations. Build this before modification planning because the Low-fi HITL stage (assembled deck review) is useful even without surgical modifications.

### Phase 4: Modification Planner
**Dependencies:** SlideElement model (exists), LLM agent executor (exists)
**Builds:** `generation/modification-planner.ts`, new named agent "modification-planner"
**Why fourth:** Can be developed independently from the assembler once types are defined. Requires a new named agent with versioned system prompt.

### Phase 5: Element-Map Executor
**Dependencies:** Modification Planner (Phase 4), Google Slides batchUpdate (exists)
**Builds:** `generation/element-map-executor.ts`
**Why fifth:** Pure execution of planned modifications. Depends on ModificationPlan schema from Phase 4.

### Phase 6: Workflow Integration + HITL Wiring
**Dependencies:** All previous phases
**Modifies:** Touch 1-4 workflows, proposal-assembly.ts
**Why last:** Integrates the full pipeline into existing HITL flows. Each touch can be migrated independently with fallback to existing behavior.

### Parallel Opportunities

- Phases 1-2 are sequential (Matcher depends on Blueprint types)
- Phase 3 (Assembler) and Phase 4 (Planner) can run in parallel after Phase 2
- Phase 5 depends on Phase 4 only
- Phase 6 depends on Phases 3 and 5

```
Phase 1 -> Phase 2 -> Phase 3 (Assembler) ─┐
                    -> Phase 4 (Planner) -> Phase 5 ─┤-> Phase 6
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Slides API | REST via googleapis client, batchUpdate for modifications | 60 req/min user rate limit; always re-read after batchUpdate |
| Google Drive API | files.copy for cross-presentation assembly, files.delete for temp cleanup | supportsAllDrives: true required; temp copies must be cleaned up in finally blocks |
| LLM (GPT-OSS 120b) | executeNamedAgent() for modification planning, section matching | Structured output via Zod schemas; flat objects only (Gemini compat constraint) |
| Gemini 2.5 Flash | executeRuntimeProviderNamedAgent() for element classification | Used for structured output requiring Google GenAI schema format |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Blueprint Resolver <-> DeckStructure DB | Direct Prisma query | Read-only; DeckStructure is pre-computed by inference engine |
| Section Matcher <-> SlideEmbedding DB | Prisma query + raw SQL for vector similarity | Uses existing pgvector HNSW index for candidate scoring |
| Section Matcher <-> Template DB | Prisma join to resolve presentationId | SlideEmbedding.templateId -> Template.presentationId |
| Multi-Source Assembler <-> Slide Copier | Direct function call | Copier is a pure utility; Assembler orchestrates the sequence |
| Modification Planner <-> LLM | executeNamedAgent() with ModificationPlan structured output schema | New named agent: "modification-planner" to be registered in AgentConfig |
| Element-Map Executor <-> Google Slides API | REST batchUpdate | Scoped to single slide per batch; re-read between structural changes |
| Touch Workflows <-> Generation Pipeline | Workflow step calling pipeline functions | Blueprint passed through suspend/resume for HITL approval |

## Sources

- [Google Slides API: Slide Operations](https://developers.google.com/workspace/slides/api/samples/slides) -- verified duplicateObject is single-presentation only
- [Google Issue Tracker #167977584: AppendSlide to different presentation via REST API](https://issuetracker.google.com/issues/167977584) -- confirmed no REST API for cross-presentation slide copy
- [Google Apps Script: Presentation.appendSlide()](https://developers.google.com/apps-script/reference/slides/presentation) -- verified appendSlide() copies slides between presentations with master/layout preservation
- [Google Slides API: Element Operations](https://developers.google.com/workspace/slides/api/samples/elements) -- batchUpdate request format differs from GET response format
- [Experiments with Google Slides API to recreate slides](https://www.bentumbleson.com/experiments-with-the-google-slides-api-to-recreate-slides/) -- confirms element reconstruction is lossy and complex
- [Google Slides API: Create and manage presentations](https://developers.google.com/workspace/slides/api/guides/presentations) -- Drive files.copy preserves objectIds
- Existing codebase analysis: `deck-assembly.ts`, `deck-customizer.ts`, `slide-assembly.ts`, `proposal-assembly.ts`, `slide-selection.ts`, `infer-deck-structure.ts`, `extract-elements.ts`, `deck-structure-schema.ts`, Prisma schema, Touch 2 workflow

---
*Architecture research for: Structure-Driven Deck Generation (v1.8)*
*Researched: 2026-03-09*
