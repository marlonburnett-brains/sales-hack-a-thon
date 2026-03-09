# Phase 57: Touch Routing & Fallback - Research

**Researched:** 2026-03-09
**Domain:** Workflow routing, feature-flag-style pipeline switching, graceful degradation
**Confidence:** HIGH

## Summary

Phase 57 is an integration phase that connects all prior pipeline components (Phases 51-55) into the existing touch workflows (Touch 1-4). The core pattern is a routing decision at the start of each workflow: check whether a DeckStructure exists for the given touch type, evaluate its confidence level, and either route through the new structure-driven pipeline or fall back to the existing legacy path. No new libraries, no new models, no new npm dependencies.

The existing codebase has clean separation between the new pipeline modules (`apps/agent/src/generation/`) and the legacy generation paths (`apps/agent/src/lib/slide-assembly.ts`, `apps/agent/src/lib/deck-customizer.ts`, `apps/agent/src/lib/deck-assembly.ts`). Each touch workflow is a linear Mastra workflow with `.then()` chaining. The routing logic will need to be injected at the first step of each workflow (or as a new routing step), with conditional branching to either the new pipeline or the legacy path.

**Primary recommendation:** Create a shared `resolveGenerationStrategy` function that checks DeckStructure existence + confidence, then modify each touch workflow to call this function early and branch accordingly. Preserve all legacy code paths untouched -- only add new conditional routing.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-8.1 | Touch 1 routes through blueprint -> single-source assembly -> modifications when DeckStructure exists | Blueprint resolver returns null when no structure exists; single-source path delegates to `assembleDeckFromSlides` via `assembleMultiSourceDeck` |
| FR-8.2 | Touch 2 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Full pipeline: `resolveBlueprint` -> `selectSlidesForBlueprint` -> `buildMultiSourcePlan` -> `assembleMultiSourceDeck` -> `planSlideModifications` -> `executeModifications` |
| FR-8.3 | Touch 3 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Same pipeline as FR-8.2, same code paths, different DeckStructureKey |
| FR-8.4 | Touch 4 routes through blueprint -> multi-source assembly -> modifications when DeckStructure exists | Touch 4 has 3 artifact types (proposal, talk_track, faq); each needs its own DeckStructureKey lookup |
| FR-8.5 | Fall back to legacy paths when no DeckStructure exists | `resolveBlueprint` already returns null; routing function wraps this with confidence check |
| FR-8.6 | Gate auto-generation on DeckStructure confidence (green >= 6 examples auto-generates; yellow/red warns) | `calculateConfidence` in `deck-structure-schema.ts` already implements thresholds; DeckStructure model has `exampleCount` and `confidence` fields |
| FR-9.1 | Fall back to branded-template content injection when no good candidate slide exists | Section matcher already handles zero-candidate sections; routing layer passes through sections with `selectedSlideId: null` |
| FR-9.2 | Fall back to placeholder injection when element maps missing | `planSlideModifications` already returns `usedFallback: true` when no elements exist |
| FR-9.3 | When source presentation is inaccessible, skip that slide and log warning | `assembleMultiSourceDeck` already has warning-only paths for missing secondary slides |
| FR-9.4 | Preserve all existing generation paths as fallbacks -- no code deleted | Legacy imports (`assembleFromTemplate`, `assembleDeckFromSlides`, `createSlidesDeckFromJSON`) remain untouched |
| NFR-1 | No new npm dependencies | All components use existing googleapis, Prisma, Mastra, Gemini |
| NFR-2 | No new Prisma models | Uses existing DeckStructure, SlideEmbedding, SlideElement, Template |
| NFR-4 | All schema changes via prisma migrate dev | No schema changes needed for this phase |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | existing | Workflow engine with `createWorkflow`, `createStep`, suspend/resume | Already used by all 4 touch workflows |
| prisma | 6.19.x | Database queries for DeckStructure lookup | Existing ORM, no new models |
| zod | existing | Schema validation for workflow step I/O | Already used in all workflows |

### Supporting (Phase 51-55 modules)
| Module | Path | Purpose |
|--------|------|---------|
| blueprint-resolver | `apps/agent/src/generation/blueprint-resolver.ts` | `resolveBlueprint(key, dealContext)` -> `BlueprintWithCandidates \| null` |
| section-matcher | `apps/agent/src/generation/section-matcher.ts` | `selectSlidesForBlueprint(bwc)` -> `SectionMatchResult` |
| multi-source-assembler | `apps/agent/src/generation/multi-source-assembler.ts` | `buildMultiSourcePlan(plan, allSlides)` + `assembleMultiSourceDeck(params)` |
| modification-planner | `apps/agent/src/generation/modification-planner.ts` | `planSlideModifications(params)` -> `PlanModificationsResult` |
| modification-executor | `apps/agent/src/generation/modification-executor.ts` | `executeModifications(params)` -> `ExecuteModificationsResult` |

### Legacy Paths (preserved as fallbacks)
| Module | Path | Used By |
|--------|------|---------|
| slide-assembly | `apps/agent/src/lib/slide-assembly.ts` | Touch 1 (`assembleFromTemplate`) |
| deck-customizer | `apps/agent/src/lib/deck-customizer.ts` | Touch 2, Touch 3 (`assembleDeckFromSlides`) |
| deck-assembly | `apps/agent/src/lib/deck-assembly.ts` | Touch 4 (`createSlidesDeckFromJSON`) |
| proposal-assembly | `apps/agent/src/lib/proposal-assembly.ts` | Touch 4 (slide JSON building) |

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  generation/
    route-strategy.ts          # NEW: shared routing logic
    blueprint-resolver.ts      # Phase 51 (existing)
    section-matcher.ts         # Phase 54 (existing)
    multi-source-assembler.ts  # Phase 52 (existing)
    modification-planner.ts    # Phase 53 (existing)
    modification-executor.ts   # Phase 55 (existing)
  mastra/workflows/
    touch-1-workflow.ts        # MODIFIED: add routing branch
    touch-2-workflow.ts        # MODIFIED: add routing branch
    touch-3-workflow.ts        # MODIFIED: add routing branch
    touch-4-workflow.ts        # MODIFIED: add routing branch
```

### Pattern 1: Strategy Resolution Function
**What:** A shared function that checks DeckStructure availability and confidence, returning a strategy enum/object.
**When to use:** First step of every touch workflow, before any generation logic.
**Example:**
```typescript
// Source: project-specific pattern
import { resolveBlueprint, type BlueprintWithCandidates } from "./blueprint-resolver";
import { calculateConfidence, type ConfidenceResult } from "../deck-intelligence/deck-structure-schema";
import { prisma } from "../lib/db";

export type GenerationStrategy =
  | { type: "structure-driven"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult }
  | { type: "legacy" }
  | { type: "low-confidence"; blueprint: BlueprintWithCandidates; confidence: ConfidenceResult };

export async function resolveGenerationStrategy(
  touchType: string,
  artifactType: string | null,
  dealContext: DealContext,
): Promise<GenerationStrategy> {
  const key = { touchType, artifactType };
  const result = await resolveBlueprint(key, dealContext);

  if (!result) return { type: "legacy" };

  // Lookup exampleCount from DeckStructure for confidence calculation
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

### Pattern 2: Conditional Workflow Branching in Mastra Steps
**What:** Each workflow's first generation step checks the strategy and either runs the new pipeline or delegates to legacy.
**When to use:** Inside `execute` functions of existing workflow steps.
**Example:**
```typescript
// Inside Touch 2's selectSlides step execute function:
const strategy = await resolveGenerationStrategy("touch_2", null, dealContext);

if (strategy.type === "legacy") {
  // Existing legacy path -- selectSlidesForDeck + assembleDeckFromSlides
  const result = await selectSlidesForDeck({ touchType: "touch_2", ... });
  return { ...inputData, skeletonContent, usedLegacyPath: true };
}

// Structure-driven path
const { plan, blueprint } = await selectSlidesForBlueprint(strategy.blueprint);
const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);
// ... continue with multi-source assembly and modifications
```

### Pattern 3: Touch 1 Single-Source vs Multi-Source
**What:** Touch 1 uses `assembleFromTemplate` (copy template + text replacement) in legacy mode, but the structure-driven path uses blueprint -> single-source assembly -> modifications. The `assembleMultiSourceDeck` function already handles single-source as a degenerate case (delegates to `assembleDeckFromSlides`).
**When to use:** Touch 1 routing specifically.

### Pattern 4: Touch 4 Multi-Artifact Routing
**What:** Touch 4 produces 3 artifacts (proposal, talk_track, faq). Each needs its own DeckStructureKey lookup. The routing decision may differ per artifact -- one could be structure-driven while another falls back to legacy.
**When to use:** Touch 4 workflow steps that handle individual artifacts.

### Anti-Patterns to Avoid
- **Deleting legacy code:** FR-9.4 explicitly requires all legacy paths be preserved. Add branches, never remove.
- **Duplicating pipeline orchestration:** The full pipeline (resolve -> match -> assemble -> plan mods -> execute mods) should be in a shared helper, not copy-pasted into each touch workflow.
- **Blocking on low confidence:** Yellow/red confidence should NOT prevent generation entirely -- it should warn the user and offer manual section selection (FR-8.6). The workflow should still be able to proceed if the user confirms.
- **Making DealContext construction inconsistent:** Each touch workflow has slightly different input schemas. The DealContext construction must handle each touch's available fields consistently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confidence calculation | Custom threshold logic | `calculateConfidence()` from `deck-structure-schema.ts` | Already implements the 0/1-2/3-5/6+ tier system |
| Blueprint resolution | Custom DeckStructure query | `resolveBlueprint()` from `blueprint-resolver.ts` | Handles null checks, parsing, batch queries, Template resolution |
| Slide selection | Custom scoring logic | `selectSlidesForBlueprint()` from `section-matcher.ts` | Implements weighted metadata scoring + vector tiebreaking |
| Multi-source plan building | Custom grouping logic | `buildMultiSourcePlan()` from `multi-source-assembler.ts` | Handles primary/secondary source identification, deduplication |
| Multi-source assembly | Custom Drive/Slides API calls | `assembleMultiSourceDeck()` from `multi-source-assembler.ts` | Handles copy-and-prune, secondary injection, cleanup |
| Modification planning | Custom element analysis | `planSlideModifications()` from `modification-planner.ts` | LLM-powered, handles fallback, element filtering |
| Modification execution | Custom Slides API calls | `executeModifications()` from `modification-executor.ts` | Handles objectId drift, per-slide error isolation |

## Common Pitfalls

### Pitfall 1: DealContext Construction Mismatch
**What goes wrong:** Each touch workflow has different input fields (Touch 1 has `context`, Touch 2 has `priorTouchOutputs`, Touch 3 has `capabilityAreas`, Touch 4 has `transcript`). The DealContext type requires `dealId`, `companyName`, `industry`, `pillars`, `persona`, `funnelStage`, `priorTouchSlideIds`.
**Why it happens:** Early touches (1, 2) don't have all DealContext fields available. Fields like `pillars`, `persona`, `funnelStage` may not be known until Touch 4.
**How to avoid:** Build DealContext from what's available, using sensible defaults: empty `pillars` array, "General" persona, stage inferred from touch type (touch_1 = "First Contact", touch_2 = "Intro Conversation", etc.).
**Warning signs:** Type errors when constructing DealContext from touch workflow inputs.

### Pitfall 2: allSlidesByPresentation Map Not Available
**What goes wrong:** `buildMultiSourcePlan` requires a `Map<string, string[]>` of all slides per presentation (to compute deleteSlideIds). This data isn't readily available from the blueprint alone.
**Why it happens:** The blueprint resolver returns candidates per section, but the multi-source plan needs ALL slides in each presentation to know which to delete.
**How to avoid:** Query all slide IDs per involved presentation from SlideEmbedding table before calling `buildMultiSourcePlan`. Group by `templateId -> Template.presentationId`.
**Warning signs:** Empty deleteSlideIds arrays causing entire source presentations to be kept.

### Pitfall 3: Mastra Workflow Branching Limitations
**What goes wrong:** Mastra's `.then()` chaining is linear. There's no built-in `.branch()` or conditional step skipping.
**Why it happens:** Mastra workflows are designed as sequential pipelines.
**How to avoid:** Use conditional logic INSIDE step `execute` functions rather than trying to conditionally chain steps. A step can internally call either the new pipeline or the legacy path and produce the same output schema shape.
**Warning signs:** Trying to create two separate workflows and dynamically choosing which to run.

### Pitfall 4: Touch 4 Has Different HITL Pattern
**What goes wrong:** Touch 4's workflow has 17 steps with 3 suspend points and produces 3 separate artifacts (slides deck, talk track doc, buyer FAQ doc). The structure-driven pipeline replaces only the deck assembly portion, not the talk track or FAQ doc generation.
**Why it happens:** Touch 4 is fundamentally more complex than Touches 1-3.
**How to avoid:** Only route the deck creation step (`createSlidesDeck`) through the structure-driven pipeline. The talk track and FAQ doc steps should continue using the existing brief-driven generation regardless of routing strategy.
**Warning signs:** Trying to route the entire Touch 4 workflow through the new pipeline.

### Pitfall 5: Confidence Gating vs Blueprint Availability
**What goes wrong:** Confusing "no DeckStructure exists" (legacy fallback) with "DeckStructure exists but low confidence" (warn + offer manual selection).
**Why it happens:** Both result in non-green-path behavior, but they require different handling.
**How to avoid:** Three-way routing: (1) no structure = legacy, (2) green confidence = auto-generate, (3) yellow/red = structure-driven BUT with HITL warning at skeleton stage.
**Warning signs:** Low-confidence structures silently falling through to legacy path instead of offering the structure-driven option.

## Code Examples

### Constructing DealContext for Each Touch Type
```typescript
// Source: project-specific derivation from touch workflow inputs

function buildDealContextForTouch(
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

### Full Pipeline Orchestration Helper
```typescript
// Source: project-specific composition of Phase 51-55 modules

async function executeStructureDrivenPipeline(params: {
  blueprint: BlueprintWithCandidates;
  targetFolderId: string;
  deckName: string;
  ownerEmail?: string;
  dealContext: DealContext;
}): Promise<{ presentationId: string; driveUrl: string }> {
  // 1. Select slides for blueprint (Phase 54)
  const { plan, blueprint } = await selectSlidesForBlueprint(params.blueprint);

  // 2. Get all slides per presentation for multi-source plan
  const allSlidesByPresentation = await getAllSlidesByPresentation(
    plan.selections.map(s => s.sourcePresentationId)
  );

  // 3. Build multi-source plan (Phase 52)
  const multiSourcePlan = buildMultiSourcePlan(plan, allSlidesByPresentation);

  // 4. Assemble multi-source deck (Phase 52)
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
        slideObjectId: selection.slideId, // Will be mapped to actual objectId
        dealContext: params.dealContext,
      })
    )
  );

  // 6. Execute modifications (Phase 55)
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

### Querying allSlidesByPresentation
```typescript
// Source: project-specific database query pattern

async function getAllSlidesByPresentation(
  presentationIds: string[],
): Promise<Map<string, string[]>> {
  const uniqueIds = [...new Set(presentationIds)];

  // Get Template records to map presentationId -> templateId
  const templates = await prisma.template.findMany({
    where: { presentationId: { in: uniqueIds } },
    select: { id: true, presentationId: true },
  });

  const templateIdToPresentationId = new Map(
    templates.map(t => [t.id, t.presentationId])
  );

  // Get all slides for these templates
  const slides = await prisma.slideEmbedding.findMany({
    where: {
      templateId: { in: templates.map(t => t.id) },
      archived: false,
    },
    select: { id: true, templateId: true },
  });

  // Group by presentationId
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Touch 1: LLM content -> template merge | Blueprint -> single-source assembly -> element-map modifications | Phase 57 (now) | More design-preserving, uses real slide content |
| Touch 2/3: LLM slide selection -> copy-and-prune from single source | Blueprint -> multi-source assembly -> element-map modifications | Phase 57 (now) | Slides from multiple presentations, surgical text updates |
| Touch 4: RAG -> SlideJSON -> duplicate+inject | Blueprint -> multi-source assembly -> element-map modifications | Phase 57 (now) | Structure-driven instead of RAG-driven slide selection |

## Open Questions

1. **Touch 4 artifact-level routing granularity**
   - What we know: Touch 4 produces 3 artifacts (proposal deck, talk track doc, FAQ doc). The structure-driven pipeline replaces only the deck assembly.
   - What's unclear: Should the talk track and FAQ also be derived from the blueprint, or continue using the brief-driven generation?
   - Recommendation: Only route the deck creation through the new pipeline. Talk track and FAQ remain brief-driven since they're Google Docs, not Slides.

2. **SlideObjectId mapping after assembly**
   - What we know: The modification planner needs `slideObjectId` (the Google Slides page object ID in the assembled presentation). The blueprint resolver works with `slideId` (database SlideEmbedding ID).
   - What's unclear: How to map from SlideEmbedding IDs to actual page object IDs in the assembled presentation.
   - Recommendation: After `assembleMultiSourceDeck`, read the assembled presentation to discover page object IDs, then map them to slide IDs using slide content or position matching. The `assembleMultiSourceDeck` result or internal state should provide this mapping.

3. **HITL integration timing**
   - What we know: Phase 56 (HITL Integration) is a dependency and may still be pending.
   - What's unclear: Whether the new HITL stages (skeleton blueprint review, low-fi assembled deck review, high-fi modification plan review) from Phase 56 are implemented yet.
   - Recommendation: Phase 57 routing should work with both the old HITL pattern (used by legacy paths) and the new HITL pattern (if Phase 56 is complete). Design routing to be HITL-agnostic -- the HITL steps happen regardless of which generation path was used.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-8.1 | Touch 1 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.2 | Touch 2 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.3 | Touch 3 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.4 | Touch 4 routes through structure-driven when DeckStructure exists | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.5 | Falls back to legacy when no DeckStructure | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-8.6 | Confidence gating: green auto-generates, yellow/red warns | unit | `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x` | Wave 0 |
| FR-9.4 | Legacy paths preserved (no deletions) | manual-only | Verify via git diff that no legacy imports removed | N/A |
| NFR-1 | No new npm dependencies | manual-only | Check package.json diff | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/generation/__tests__/route-strategy.test.ts -x`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/__tests__/route-strategy.test.ts` -- covers FR-8.1 through FR-8.6
- [ ] No framework install needed -- vitest already configured

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all 4 touch workflows (`apps/agent/src/mastra/workflows/touch-*-workflow.ts`)
- Direct codebase analysis of all pipeline modules (`apps/agent/src/generation/*.ts`)
- Direct codebase analysis of legacy generation modules (`apps/agent/src/lib/slide-assembly.ts`, `deck-customizer.ts`, `deck-assembly.ts`)
- Prisma schema (`apps/agent/prisma/schema.prisma`) -- DeckStructure model with `exampleCount` and `confidence` fields
- Confidence calculation (`apps/agent/src/deck-intelligence/deck-structure-schema.ts`) -- green/yellow/red thresholds
- Shared types (`packages/schemas/generation/types.ts`) -- GenerationBlueprint, SlideSelectionPlan, DealContext

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md FR-8 and FR-9 specifications
- STATE.md decisions from Phases 51-55

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all modules already exist and are tested
- Architecture: HIGH - routing pattern is straightforward conditional branching inside existing workflow steps
- Pitfalls: HIGH - identified through direct code analysis of workflow structures and type mismatches

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- all components are internal to this codebase)
