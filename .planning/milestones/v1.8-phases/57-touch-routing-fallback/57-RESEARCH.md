# Phase 57: Touch Routing & Fallback - Research

**Researched:** 2026-03-09
**Domain:** Workflow routing, feature-flag-style pipeline switching, graceful degradation
**Confidence:** HIGH

## Summary

Phase 57 is the integration phase that connects all prior pipeline components (Phases 51-55) into the existing touch workflows (Touch 1-4). The core pattern is a routing decision at the start of each workflow's generation step: check whether a DeckStructure exists for the given touch type, evaluate its confidence level, and either route through the new structure-driven pipeline or fall back to the existing legacy path. No new libraries, no new models, no new npm dependencies, no schema changes.

The existing codebase has clean separation between new pipeline modules (`apps/agent/src/generation/`) and legacy generation paths (`apps/agent/src/lib/slide-assembly.ts`, `apps/agent/src/lib/deck-customizer.ts`, `apps/agent/src/lib/deck-assembly.ts`). Each touch workflow is a linear Mastra workflow with `.then()` chaining. The routing logic must be injected INSIDE existing step `execute` functions (Mastra has no built-in branching), with conditional delegation to either the new pipeline or the legacy path.

Critical insight from code analysis: The four touch workflows have significantly different structures. Touch 1 has 7 steps (LLM content generation -> template merge). Touch 2 and 3 have 6 steps each (AI slide selection -> copy-and-prune from single source). Touch 4 has 17 steps with 3 suspend points and produces 3 separate artifacts. The routing decision point is different for each touch type and must not disrupt the existing HITL suspend/resume flow.

**Primary recommendation:** Create a shared `resolveGenerationStrategy` function in `apps/agent/src/generation/route-strategy.ts` that checks DeckStructure existence + confidence, then modify each touch workflow's generation step to call this function and branch accordingly. Preserve all legacy code paths untouched -- only add new conditional routing. Create a shared `executeStructureDrivenPipeline` helper to avoid duplicating the 6-step pipeline composition across 4 workflows.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-8.1 | Touch 1 routes through blueprint -> single-source assembly -> modifications when DeckStructure exists | Blueprint resolver returns null when no structure exists; `assembleMultiSourceDeck` delegates to `assembleDeckFromSlides` for single-source case (line 107-114 of multi-source-assembler.ts). Touch 1's `assembleDeck` step (line 332-429 of touch-1-workflow.ts) currently calls `assembleFromTemplate` -- routing replaces this with blueprint pipeline. |
| FR-8.2 | Touch 2 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Touch 2's `selectSlides` step (line 74-129) calls `selectSlidesForDeck` and `assembleDeck` step (line 313-420) calls `assembleDeckFromSlides`. Routing replaces both with: `resolveBlueprint` -> `selectSlidesForBlueprint` -> `buildMultiSourcePlan` -> `assembleMultiSourceDeck` -> modification pipeline. |
| FR-8.3 | Touch 3 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Touch 3 mirrors Touch 2's structure exactly (same step pattern, different touchType). Same routing pattern applies with DeckStructureKey `{ touchType: "touch_3", artifactType: null }`. |
| FR-8.4 | Touch 4 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Touch 4's `createSlidesDeck` step (line 1099-1193) calls `createSlidesDeckFromJSON`. Only the deck assembly portion routes through the new pipeline -- talk track and FAQ doc steps remain unchanged. DeckStructureKey requires `artifactType: "proposal"` for the slides deck. |
| FR-8.5 | Fall back to legacy paths when no DeckStructure exists | `resolveBlueprint` already returns null when no DeckStructure found (blueprint-resolver.ts line 9-10 docstring). Three-way fallback mapping: T1 -> `assembleFromTemplate`, T2/T3 -> `selectSlidesForDeck` + `assembleDeckFromSlides`, T4 -> `createSlidesDeckFromJSON`. |
| FR-8.6 | Gate auto-generation on DeckStructure confidence (green >= 6 examples auto-generates; yellow/red warns) | `calculateConfidence()` in deck-structure-schema.ts (line 114-137) implements exact thresholds. DeckStructure model has `exampleCount` (int) and `confidence` (float) fields. Three-way routing: no structure = legacy, green = auto-generate, yellow/red = structure-driven BUT with warning at skeleton HITL stage. |
| FR-9.1 | Fall back to branded-template content injection when no good candidate slide exists | Section matcher already keeps zero-candidate sections in blueprint. For sections where `selectedSlideId` remains null after matching, downstream can use placeholder content injection. |
| FR-9.2 | Fall back to placeholder injection when element maps missing | `planSlideModifications` (modification-planner.ts) already returns `{ usedFallback: true }` when no SlideElement records exist for a slide. |
| FR-9.3 | When source presentation is inaccessible, skip that slide and log warning | `assembleMultiSourceDeck` (multi-source-assembler.ts line 210-214) already has warning-only error handling for failed secondary copies. |
| FR-9.4 | Preserve all existing generation paths as fallbacks -- no code deleted | All legacy imports remain: `assembleFromTemplate` from slide-assembly.ts, `selectSlidesForDeck` from slide-selection.ts, `assembleDeckFromSlides` from deck-customizer.ts, `createSlidesDeckFromJSON` from deck-assembly.ts. Only conditional branches added. |
| NFR-1 | No new npm dependencies | All components use existing googleapis, Prisma, Mastra, Gemini, Zod. |
| NFR-2 | No new Prisma models | Uses existing DeckStructure, SlideEmbedding, SlideElement, Template. |
| NFR-4 | All schema changes via prisma migrate dev | No schema changes needed for this phase. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | existing | Workflow engine with `createWorkflow`, `createStep`, suspend/resume | Already used by all 4 touch workflows |
| prisma | 6.19.x | Database queries for DeckStructure lookup | Existing ORM, no new models |
| zod | existing | Schema validation for workflow step I/O | Already used in all workflows |

### Supporting (Phase 51-55 modules -- all existing)
| Module | Path | Purpose | Entry Function |
|--------|------|---------|----------------|
| blueprint-resolver | `apps/agent/src/generation/blueprint-resolver.ts` | DeckStructure -> GenerationBlueprint | `resolveBlueprint(key, dealContext)` -> `BlueprintWithCandidates \| null` |
| section-matcher | `apps/agent/src/generation/section-matcher.ts` | Context-aware slide selection | `selectSlidesForBlueprint(bwc)` -> `SectionMatchResult` |
| multi-source-assembler | `apps/agent/src/generation/multi-source-assembler.ts` | Multi-source plan + assembly | `buildMultiSourcePlan(plan, slidesByPres)` + `assembleMultiSourceDeck(params)` |
| modification-planner | `apps/agent/src/generation/modification-planner.ts` | Element-level mod planning | `planSlideModifications(params)` -> `PlanModificationsResult` |
| modification-executor | `apps/agent/src/generation/modification-executor.ts` | Execute text mods via Slides API | `executeModifications(params)` -> `ExecuteModificationsResult` |

### Legacy Paths (preserved as fallbacks -- existing)
| Module | Path | Used By | Function |
|--------|------|---------|----------|
| slide-assembly | `apps/agent/src/lib/slide-assembly.ts` | Touch 1 | `assembleFromTemplate(params)` |
| slide-selection | `apps/agent/src/lib/slide-selection.ts` | Touch 2, Touch 3 | `selectSlidesForDeck(params)` |
| deck-customizer | `apps/agent/src/lib/deck-customizer.ts` | Touch 2, Touch 3 | `assembleDeckFromSlides(params)` |
| deck-assembly | `apps/agent/src/lib/deck-assembly.ts` | Touch 4 | `createSlidesDeckFromJSON(params)` |
| proposal-assembly | `apps/agent/src/lib/proposal-assembly.ts` | Touch 4 | `filterByMetadata`, `buildSlideJSON`, `generateSlideCopy` |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  generation/
    route-strategy.ts          # NEW: shared routing + pipeline orchestration
    blueprint-resolver.ts      # Phase 51 (existing)
    section-matcher.ts         # Phase 54 (existing)
    multi-source-assembler.ts  # Phase 52 (existing)
    modification-planner.ts    # Phase 53 (existing)
    modification-executor.ts   # Phase 55 (existing)
    __tests__/
      route-strategy.test.ts   # NEW: unit tests for routing + pipeline
  mastra/workflows/
    touch-1-workflow.ts        # MODIFIED: add routing branch in assembleDeck step
    touch-2-workflow.ts        # MODIFIED: add routing branch in selectSlides + assembleDeck steps
    touch-3-workflow.ts        # MODIFIED: add routing branch in selectSlides + assembleDeck steps
    touch-4-workflow.ts        # MODIFIED: add routing branch in createSlidesDeck step
```

### Pattern 1: Strategy Resolution Function
**What:** A shared function that checks DeckStructure availability and confidence, returning a discriminated union.
**When to use:** Inside the first generation step of every touch workflow, before any generation logic.
**Example:**
```typescript
// Source: project-specific pattern derived from codebase analysis
import { resolveBlueprint, type BlueprintWithCandidates } from "./blueprint-resolver";
import { calculateConfidence, type ConfidenceResult } from "../deck-intelligence/deck-structure-schema";
import type { DealContext } from "@lumenalta/schemas";
import type { ArtifactType } from "@lumenalta/schemas";
import { prisma } from "../lib/db";

export type GenerationStrategy =
  | { type: "structure-driven"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult }
  | { type: "legacy" }
  | { type: "low-confidence"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult };

export async function resolveGenerationStrategy(
  touchType: string,
  artifactType: ArtifactType | null,
  dealContext: DealContext,
): Promise<GenerationStrategy> {
  const result = await resolveBlueprint(
    { touchType, artifactType },
    dealContext,
  );

  if (!result) return { type: "legacy" };

  // DeckStructure must exist if resolveBlueprint returned non-null
  const deckStructure = await prisma.deckStructure.findFirst({
    where: { touchType, artifactType },
    select: { exampleCount: true },
  });

  const confidence = calculateConfidence(deckStructure?.exampleCount ?? 0);

  if (confidence.color === "green") {
    return { type: "structure-driven", blueprint: result, confidence };
  }

  return { type: "low-confidence", blueprint: result, confidence };
}
```

### Pattern 2: Pipeline Orchestration Helper
**What:** Shared function that runs the full structure-driven pipeline (select -> plan -> assemble -> modify), avoiding copy-paste across 4 workflows.
**When to use:** After routing determines `type: "structure-driven"` or `type: "low-confidence"` (and user confirms).
**Example:**
```typescript
// Source: composition of Phase 51-55 module APIs
import { selectSlidesForBlueprint } from "./section-matcher";
import { buildMultiSourcePlan, assembleMultiSourceDeck } from "./multi-source-assembler";
import { planSlideModifications } from "./modification-planner";
import { executeModifications } from "./modification-executor";

export async function executeStructureDrivenPipeline(params: {
  blueprint: BlueprintWithCandidates;
  targetFolderId: string;
  deckName: string;
  dealContext: DealContext;
  ownerEmail?: string;
}): Promise<{ presentationId: string; driveUrl: string }> {
  // 1. Select slides for blueprint (Phase 54)
  const { plan } = await selectSlidesForBlueprint(params.blueprint);

  // 2. Get all slides per source presentation for deleteSlideIds computation
  const allSlidesByPresentation = await getAllSlidesByPresentation(
    [...new Set(plan.selections.map(s => s.sourcePresentationId))]
  );

  // 3. Build multi-source plan (Phase 52)
  const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);

  // 4. Assemble multi-source deck (Phase 52) -- handles single-source as degenerate case
  const assemblyResult = await assembleMultiSourceDeck({
    plan: multiSourcePlan,
    targetFolderId: params.targetFolderId,
    deckName: params.deckName,
    ownerEmail: params.ownerEmail,
  });

  // 5. Plan modifications per slide (Phase 53)
  const modPlans = await Promise.all(
    plan.selections.map(selection =>
      planSlideModifications({
        slideId: selection.slideId,
        slideObjectId: selection.slideId, // Mapped via assembler's slideIdMap
        dealContext: params.dealContext,
      })
    )
  );

  // 6. Execute modifications (Phase 55) -- skip fallback/empty plans
  const activePlans = modPlans
    .filter(r => !r.usedFallback && r.plan.modifications.length > 0)
    .map(r => r.plan);

  if (activePlans.length > 0) {
    await executeModifications({
      presentationId: assemblyResult.presentationId,
      plans: activePlans,
    });
  }

  return {
    presentationId: assemblyResult.presentationId,
    driveUrl: assemblyResult.driveUrl,
  };
}
```

### Pattern 3: Conditional Branching Inside Mastra Steps
**What:** Each workflow's generation step checks the strategy and internally calls either new pipeline or legacy.
**When to use:** Inside `execute` functions of existing workflow steps. Mastra has NO built-in branching.
**Why:** Mastra workflows are linear `.then()` chains. There is no `.branch()` or conditional step skipping. The routing MUST happen inside step execute functions.
**Example:**
```typescript
// Inside Touch 2's selectSlides step execute function:
const strategy = await resolveGenerationStrategy("touch_2", null, dealContext);

if (strategy.type === "legacy") {
  // Existing legacy path -- unchanged
  const result = await selectSlidesForDeck({ touchType: "touch_2", ... });
  return { ...inputData, skeletonContent, usedLegacyPath: true };
}

if (strategy.type === "low-confidence") {
  // Structure exists but low confidence -- still generate but flag for HITL warning
  // The skeleton HITL stage will show a confidence warning to the seller
}

// Structure-driven path
const pipelineResult = await executeStructureDrivenPipeline({
  blueprint: strategy.blueprint,
  targetFolderId: folderId,
  deckName,
  dealContext,
});
```

### Pattern 4: DealContext Construction Per Touch Type
**What:** Each touch has different input fields. DealContext must be built from what's available.
**When to use:** Before calling `resolveGenerationStrategy`.
**Critical detail from code analysis:**
- Touch 1 inputs: `dealId`, `companyName`, `industry`, `context`, `salespersonName`
- Touch 2 inputs: `dealId`, `companyName`, `industry`, `context`, `priorTouchOutputs`, `salespersonName`, `customerName`
- Touch 3 inputs: `dealId`, `companyName`, `industry`, `capabilityAreas`, `context`, `priorTouchOutputs`
- Touch 4 inputs: `dealId`, `companyName`, `industry`, `subsector`, `transcript` (but has Brief with `primaryPillar`, `useCases`, etc.)

```typescript
function buildDealContext(
  touchType: string,
  input: { dealId: string; companyName: string; industry: string; [key: string]: unknown },
): DealContext {
  const funnelStageMap: Record<string, string> = {
    touch_1: "First Contact",
    touch_2: "Intro Conversation",
    touch_3: "Capability Alignment",
    touch_4: "Solution Proposal",
  };

  return {
    dealId: input.dealId,
    companyName: input.companyName,
    industry: input.industry,
    pillars: (input.capabilityAreas as string[] | undefined) ?? [],
    persona: "General",
    funnelStage: funnelStageMap[touchType] ?? "First Contact",
    priorTouchSlideIds: (input.priorTouchOutputs as string[] | undefined) ?? [],
  };
}
```

### Pattern 5: Touch 4 Selective Routing
**What:** Touch 4 produces 3 artifacts. Only the deck assembly routes through the new pipeline.
**When to use:** Touch 4's `createSlidesDeck` step specifically.
**Critical detail:** Touch 4's workflow chain is: `ragRetrieval -> assembleSlideJSON -> generateCustomCopy -> createSlidesDeck -> createTalkTrack -> createBuyerFAQ`. The routing decision goes inside `createSlidesDeck`. If structure-driven, skip the upstream `ragRetrieval/assembleSlideJSON/generateCustomCopy` chain for the deck portion. The talk track and FAQ doc steps ALWAYS use the existing brief-driven generation since they produce Google Docs, not Slides.

### Anti-Patterns to Avoid
- **Deleting legacy code:** FR-9.4 explicitly requires ALL legacy paths preserved. Add branches, never remove.
- **Duplicating pipeline orchestration:** The 6-step pipeline (resolve -> match -> plan -> assemble -> plan mods -> execute mods) MUST be in `executeStructureDrivenPipeline`, not copy-pasted into each workflow.
- **Blocking on low confidence:** Yellow/red confidence should NOT prevent generation. It should warn the user and offer manual section selection (FR-8.6). The workflow should still proceed if the user confirms.
- **Routing the entire Touch 4 workflow:** Only `createSlidesDeck` routes through the new pipeline. Talk track and FAQ doc remain brief-driven.
- **Creating separate workflows:** Do NOT create parallel workflow definitions. Add conditional logic INSIDE existing step execute functions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confidence calculation | Custom threshold logic | `calculateConfidence()` from `deck-structure-schema.ts` | Implements the 0/1-2/3-5/6+ tier system with green/yellow/red colors |
| Blueprint resolution | Custom DeckStructure query + parsing | `resolveBlueprint()` from `blueprint-resolver.ts` | Handles null checks, JSON parsing, batch SlideEmbedding+Template queries |
| DeckStructure key resolution | Manual touchType/artifactType validation | `resolveDeckStructureKey()` from `deck-structure-key.ts` | Validates touch types, enforces artifactType requirement for touch_4 |
| Slide selection scoring | Custom scoring logic | `selectSlidesForBlueprint()` from `section-matcher.ts` | Weighted metadata scoring (industry=3, pillar=3, persona=2, funnel=2) + vector tiebreaking |
| Multi-source plan | Custom slide grouping | `buildMultiSourcePlan()` from `multi-source-assembler.ts` | Primary/secondary identification, deleteSlideIds computation, finalSlideOrder |
| Multi-source assembly | Custom Drive/Slides API orchestration | `assembleMultiSourceDeck()` from `multi-source-assembler.ts` | Copy-and-prune, secondary injection, cleanup, single-source delegation |
| Modification planning | Custom element analysis | `planSlideModifications()` from `modification-planner.ts` | LLM-powered, fallback handling, element filtering, hallucination guard |
| Modification execution | Custom Slides API calls | `executeModifications()` from `modification-executor.ts` | objectId drift handling, per-slide error isolation, element-scoped updates |

**Key insight:** Phase 57 creates NO new pipeline logic. It orchestrates existing modules behind a routing decision. Every piece of generation logic already exists.

## Common Pitfalls

### Pitfall 1: DealContext Construction Mismatch
**What goes wrong:** Type errors when building DealContext from touch workflow inputs because each touch has different available fields.
**Why it happens:** DealContext requires `pillars`, `persona`, `funnelStage`, `priorTouchSlideIds` -- Touch 1 has none of these explicitly.
**How to avoid:** Use sensible defaults. Empty `pillars` array, "General" persona, funnel stage inferred from touch type. Touch 3 has `capabilityAreas` which maps to `pillars`.
**Warning signs:** TypeScript compile errors on DealContext construction, or runtime `undefined` values in DealContext fields.

### Pitfall 2: allSlidesByPresentation Map Not Available
**What goes wrong:** `buildMultiSourcePlan` (line 65-102 of multi-source-assembler.ts) requires `Map<string, string[]>` of ALL slides per presentation to compute `deleteSlideIds`. This data is not in the blueprint.
**Why it happens:** The blueprint resolver returns candidates per section, but the multi-source plan needs ALL slides in each presentation to know which to delete.
**How to avoid:** Query all slide IDs per involved presentation from SlideEmbedding table (grouped by `templateId -> Template.presentationId`) before calling `buildMultiSourcePlan`. This query should be in `executeStructureDrivenPipeline`.
**Warning signs:** Empty `deleteSlideIds` arrays causing entire source presentations to be kept (no pruning).

### Pitfall 3: Mastra Workflow Branching Limitations
**What goes wrong:** Attempting to create conditional step chains or parallel workflows in Mastra.
**Why it happens:** Mastra's `.then()` chaining is strictly linear. There is no `.branch()`, `.if()`, or conditional step skipping API.
**How to avoid:** All routing logic goes INSIDE step `execute` functions. A single step can internally call either the new pipeline or the legacy path and produce the same output schema shape. Add a `usedStructureDriven: boolean` field to output schemas to track which path was taken.
**Warning signs:** Trying to define two separate Mastra workflows and dynamically choosing which to run.

### Pitfall 4: Touch 4 Has Fundamentally Different HITL Pattern
**What goes wrong:** Trying to route the entire Touch 4 workflow through the new pipeline, or disrupting the 3 suspend points.
**Why it happens:** Touch 4 is a 17-step pipeline with 3 suspend points (field review, brief approval, asset review). It produces 3 artifacts (slides deck, talk track doc, buyer FAQ doc).
**How to avoid:** Only route the `createSlidesDeck` step (step 12 of 17). Steps 1-11 (transcript -> brief -> RAG -> SlideJSON -> copy) and steps 13-17 (talk track, FAQ, compliance, review, delivery) remain unchanged.
**Warning signs:** Trying to bypass ragRetrieval/assembleSlideJSON/generateCustomCopy for the entire workflow.

### Pitfall 5: Confidence Gating vs Blueprint Availability
**What goes wrong:** Confusing "no DeckStructure exists" (legacy fallback) with "DeckStructure exists but low confidence" (warn + offer manual selection).
**Why it happens:** Both result in non-green-path behavior, but they require different handling.
**How to avoid:** Three-way routing: (1) no structure = legacy, (2) green confidence = auto-generate, (3) yellow/red = structure-driven BUT with HITL warning at skeleton stage indicating low confidence and offering manual section selection.
**Warning signs:** Low-confidence structures silently falling through to legacy path instead of offering the structure-driven option with a warning.

### Pitfall 6: slideObjectId Mapping After Assembly
**What goes wrong:** The modification planner needs `slideObjectId` (Google Slides page object ID in the assembled presentation), but the blueprint works with `slideId` (database SlideEmbedding ID).
**Why it happens:** For primary source slides, objectIds are preserved from the source presentation. For secondary source slides, `assembleMultiSourceDeck` creates new slides with `generated-${slideId}` objectIds (line 194 of multi-source-assembler.ts).
**How to avoid:** After `assembleMultiSourceDeck`, use the `slideIdMap` (which tracks original -> generated ID mapping). The `assembleMultiSourceDeck` result should provide the mapping, or read the assembled presentation to discover page object IDs.
**Warning signs:** Modification plans targeting wrong slides or failing to find elements.

### Pitfall 7: Touch 2/3 Step Coordination
**What goes wrong:** Touch 2/3 have TWO steps that need routing: `selectSlides` (slide selection) AND `assembleDeck` (deck assembly). If only one is routed, the data flow breaks.
**Why it happens:** In legacy mode, `selectSlides` produces `selectedSlideIds` and `slideOrder` that `assembleDeck` consumes. In structure-driven mode, slide selection is done differently.
**How to avoid:** Add a `usedStructureDriven: boolean` flag to the output of `selectSlides`. If true, `assembleDeck` uses the structure-driven assembly. If false, `assembleDeck` uses legacy `assembleDeckFromSlides`. Pass the blueprint/strategy through the step chain via output fields.
**Warning signs:** Structure-driven slide selection followed by legacy assembly, or vice versa.

## Code Examples

### Querying allSlidesByPresentation (Required for buildMultiSourcePlan)
```typescript
// Source: project-specific database query, needed before buildMultiSourcePlan
async function getAllSlidesByPresentation(
  presentationIds: string[],
): Promise<Map<string, string[]>> {
  const uniqueIds = [...new Set(presentationIds)];

  const templates = await prisma.template.findMany({
    where: { presentationId: { in: uniqueIds } },
    select: { id: true, presentationId: true },
  });

  const templateIdToPresentationId = new Map(
    templates.map(t => [t.id, t.presentationId])
  );

  const slides = await prisma.slideEmbedding.findMany({
    where: {
      templateId: { in: templates.map(t => t.id) },
      archived: false,
    },
    select: { id: true, templateId: true },
  });

  const result = new Map<string, string[]>();
  for (const slide of slides) {
    const presentationId = templateIdToPresentationId.get(slide.templateId);
    if (!presentationId) continue;
    const existing = result.get(presentationId) ?? [];
    existing.push(slide.id);
    result.set(presentationId, existing);
  }

  return result;
}
```

### Touch 1 Routing (Inside assembleDeck Step)
```typescript
// Source: derived from touch-1-workflow.ts lines 332-429
// Touch 1 currently calls assembleFromTemplate. Structure-driven replaces this.
const dealContext = buildDealContext("touch_1", inputData);
const strategy = await resolveGenerationStrategy("touch_1", null, dealContext);

if (strategy.type === "legacy") {
  // Existing code: assembleFromTemplate(...)
  const result = await assembleFromTemplate({ templateId: env.GOOGLE_TEMPLATE_PRESENTATION_ID, ... });
  return { ...output, presentationId: result.presentationId, driveUrl: result.driveUrl };
}

// Structure-driven path (green confidence or user-confirmed low-confidence)
const result = await executeStructureDrivenPipeline({
  blueprint: strategy.blueprint,
  targetFolderId: folderId,
  deckName,
  dealContext,
  ownerEmail: deal.ownerEmail,
});
return { ...output, presentationId: result.presentationId, driveUrl: result.driveUrl };
```

### Touch 4 Routing (Inside createSlidesDeck Step)
```typescript
// Source: derived from touch-4-workflow.ts lines 1099-1193
// Touch 4 currently calls createSlidesDeckFromJSON. Only the deck step routes.
const dealContext = buildDealContext("touch_4", {
  dealId: deal.id,
  companyName: company.name,
  industry: deal.company.industry ?? "Technology",
  // Touch 4 has Brief with primaryPillar
});
dealContext.pillars = [brief.primaryPillar];

const strategy = await resolveGenerationStrategy("touch_4", "proposal", dealContext);

if (strategy.type === "legacy") {
  // Existing code: createSlidesDeckFromJSON(...)
  const result = await createSlidesDeckFromJSON({ slideJSON: slideAssembly, ... });
  return { ...output, deckUrl: result.deckUrl };
}

// Structure-driven path
const result = await executeStructureDrivenPipeline({
  blueprint: strategy.blueprint,
  targetFolderId: dealFolderId,
  deckName: `${company.name} - ${primaryPillar} - ${dateStr}`,
  dealContext,
});
return { ...output, deckUrl: result.driveUrl };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Touch 1: LLM content -> template merge (`assembleFromTemplate`) | Blueprint -> single-source assembly -> element-map modifications | Phase 57 (now) | More design-preserving, uses real slide content |
| Touch 2/3: LLM slide selection (`selectSlidesForDeck`) -> copy-and-prune from single source (`assembleDeckFromSlides`) | Blueprint -> multi-source assembly -> element-map modifications | Phase 57 (now) | Slides from multiple presentations, surgical text updates |
| Touch 4: RAG -> SlideJSON -> duplicate+inject (`createSlidesDeckFromJSON`) | Blueprint -> multi-source assembly -> element-map modifications | Phase 57 (now) | Structure-driven instead of RAG-driven slide selection |

**Important:** All old approaches remain as fallbacks. No code is deleted.

## Open Questions

1. **SlideObjectId mapping after assembly**
   - What we know: Primary source slides keep original objectIds. Secondary slides get `generated-${slideId}` objectIds (multi-source-assembler.ts line 194). The modification planner needs actual Google Slides page objectIds.
   - What's unclear: Whether `assembleMultiSourceDeck` returns the slideIdMap, or whether we need to read the assembled presentation to discover the mapping.
   - Recommendation: Inspect `assembleMultiSourceDeck`'s return type -- it returns `AssembleDeckResult` (`{ presentationId, driveUrl }`), not the slideIdMap. Either extend the return type to include the map, or read the assembled presentation post-assembly and match by position/content. Extending the return type is cleaner.

2. **Touch 4 upstream step skipping**
   - What we know: In structure-driven mode, Touch 4 would not need `ragRetrieval`, `assembleSlideJSON`, or `generateCustomCopy` steps for the deck portion.
   - What's unclear: Whether these steps should still run (producing unused output) or be conditionally skipped inside their execute functions.
   - Recommendation: The simplest approach is to let these steps run normally (they produce the SlideJSON that legacy `createSlidesDeck` consumes). The routing decision happens only inside `createSlidesDeck`. If structure-driven, ignore the SlideJSON input and use the pipeline instead. This avoids modifying 3 additional steps.

3. **HITL integration timing**
   - What we know: Phase 56 (HITL Integration) defines new HITL stages (skeleton blueprint review, low-fi assembled deck review, high-fi modification plan review).
   - What's unclear: Whether Phase 56 is complete. Phase 57 routing should work with both old and new HITL patterns.
   - Recommendation: Design routing to be HITL-agnostic. The routing decision produces a deck. The HITL stages happen regardless of which generation path was used. If Phase 56 is complete, the new HITL stages provide richer review data (blueprint details, modification plans). If not, the existing HITL stages still work.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-8.1 | Touch 1 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.2 | Touch 2 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.3 | Touch 3 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.4 | Touch 4 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.5 | Falls back to legacy when no DeckStructure | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.6 | Confidence gating: green auto-generates, yellow/red returns low-confidence strategy | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-9.1 | No-candidate section fallback | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-9.4 | Legacy paths preserved (no deletions) | manual-only | Verify via git diff that no legacy imports removed | N/A |
| NFR-1 | No new npm dependencies | manual-only | Check package.json diff | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/__tests__/route-strategy.test.ts` -- covers FR-8.1 through FR-8.6 and FR-9.1
- [ ] No framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 4 touch workflows:
  - `apps/agent/src/mastra/workflows/touch-1-workflow.ts` (614 lines, 7 steps, `assembleFromTemplate` at line 386)
  - `apps/agent/src/mastra/workflows/touch-2-workflow.ts` (515 lines, 6 steps, `selectSlidesForDeck` at line 99, `assembleDeckFromSlides` at line 371)
  - `apps/agent/src/mastra/workflows/touch-3-workflow.ts` (494 lines, 6 steps, mirrors Touch 2)
  - `apps/agent/src/mastra/workflows/touch-4-workflow.ts` (1738 lines, 17 steps, `createSlidesDeckFromJSON` at line 1167)
- Direct analysis of generation pipeline modules:
  - `blueprint-resolver.ts` -- `resolveBlueprint` returns `BlueprintWithCandidates | null`
  - `section-matcher.ts` -- `selectSlidesForBlueprint` returns `SectionMatchResult`
  - `multi-source-assembler.ts` -- `buildMultiSourcePlan` + `assembleMultiSourceDeck`, single-source delegation at line 107-114
  - `modification-planner.ts` -- `planSlideModifications` with fallback at `usedFallback: true`
  - `modification-executor.ts` -- `executeModifications` with per-slide error isolation
- Direct analysis of legacy modules:
  - `slide-assembly.ts` -- `assembleFromTemplate` (108 lines, template merge pattern)
  - `deck-customizer.ts` -- `assembleDeckFromSlides` (274 lines, copy-and-prune)
  - `deck-assembly.ts` -- `createSlidesDeckFromJSON` (420 lines, duplicate+inject from template)
- Prisma schema -- DeckStructure model with `exampleCount` (Int), `confidence` (Float), `@@unique([touchType, artifactType])`
- `deck-structure-schema.ts` -- `calculateConfidence` function (green >= 6, yellow 3-5, red 0-2)
- `deck-structure-key.ts` -- `resolveDeckStructureKey` validates touchType/artifactType combinations

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md FR-8 and FR-9 specifications
- STATE.md decisions from Phases 51-55

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all modules already exist, tested, and used in prior phases
- Architecture: HIGH - routing pattern is straightforward conditional branching inside existing workflow steps, verified by reading all 4 workflow source files
- Pitfalls: HIGH - identified through direct code analysis of workflow structures, type signatures, and data flow mismatches
- Code examples: HIGH - derived from actual function signatures and step schemas in the codebase

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- all components are internal to this codebase)
