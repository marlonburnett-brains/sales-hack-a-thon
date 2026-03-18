# Phase 51: Blueprint Resolver - Research

**Researched:** 2026-03-09
**Domain:** DeckStructure consumption, Prisma query patterns, TypeScript data transformation
**Confidence:** HIGH

## Summary

Phase 51 is a pure data-transformation layer: read a `DeckStructure` row from Prisma, parse its `structureJson`, resolve each section's `slideIds` to full `SlideEmbedding` records (with `Template.presentationId` join), and produce a `GenerationBlueprint`. No LLM calls, no external APIs, no new dependencies. The existing codebase already has all the building blocks -- the `DeckStructure` model, the `SlideEmbedding` model with `templateId` FK, the `Template` model with `presentationId`, and the `resolveDeckStructureKey()` utility that validates touch/artifact combinations.

The resolver must handle 7 logical keys (touch_1, touch_2, touch_3, pre_call, touch_4 x proposal, touch_4 x talk_track, touch_4 x faq) and return `null` when no DeckStructure exists or its sections array is empty. This null return is critical -- it enables Phase 57's fallback routing to legacy generation paths.

**Primary recommendation:** Create a single `resolveBlueprint()` function in `apps/agent/src/generation/blueprint-resolver.ts` that takes a `DeckStructureKey` + `DealContext`, queries the DB, and returns `GenerationBlueprint | null`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-2.1 | Read `DeckStructure.structureJson` for a given touchType + artifactType key | Use existing `resolveDeckStructureKey()` from `deck-structure-key.ts` to validate key, then `prisma.deckStructure.findFirst()` with `touchType` + `artifactType` where clause |
| FR-2.2 | Iterate sections in order, resolve each section's `slideIds` to full `SlideEmbedding` records with classification metadata | Parse `structureJson` as `DeckStructureOutput`, iterate `sections` sorted by `order`, batch-query `prisma.slideEmbedding.findMany({ where: { id: { in: allSlideIds } } })` to avoid N+1 |
| FR-2.3 | Include `SlideEmbedding.templateId -> Template.presentationId` resolution for source presentation mapping | Either use Prisma `include` (no relation defined) or batch-query `prisma.template.findMany({ where: { id: { in: templateIds } } })` for the join |
| FR-2.4 | Produce a `GenerationBlueprint` with populated `SectionSlot.candidateSlideIds` | Map `DeckSection` -> `SectionSlot` preserving order, name, purpose, isOptional; populate `candidateSlideIds` from resolved slide IDs |
| FR-2.5 | Handle missing/empty DeckStructure gracefully by returning null | Return `null` when `findFirst()` returns null, or when parsed `sections` array is empty |
| FR-2.6 | Support all 7 logical DeckStructure keys | Use existing `getDeckStructureListKeys()` from `deck-structure-key.ts` which already produces all 7 keys; the resolver validates via `resolveDeckStructureKey()` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 6.19.x | Database queries for DeckStructure, SlideEmbedding, Template | Already used everywhere in apps/agent |
| @lumenalta/schemas | workspace | GenerationBlueprint, SectionSlot, DealContext types | Phase 50 output, shared contract |
| TypeScript | 5.9.x | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| deck-structure-key.ts | internal | `resolveDeckStructureKey()`, `DeckStructureKey` type | Key validation and normalization |
| deck-structure-schema.ts | internal | `DeckStructureOutput`, `DeckSection` interfaces | Parsing structureJson |

### Alternatives Considered
None -- this phase uses only existing project infrastructure. No new dependencies needed (NFR-1).

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/generation/
  blueprint-resolver.ts        # resolveBlueprint() function (NEW)
  types.ts                     # MultiSourcePlan, SecondarySource (Phase 50)
  modification-plan-schema.ts  # ModificationPlan LLM schema (Phase 50)
```

### Pattern 1: Single-Function Resolver with Batch Queries
**What:** A single exported `resolveBlueprint()` function that:
1. Validates the key via `resolveDeckStructureKey()`
2. Queries DeckStructure with `findFirst`
3. Parses `structureJson` as `DeckStructureOutput`
4. Batch-queries all referenced `SlideEmbedding` records (single query with `id: { in: [...] }`)
5. Batch-queries all referenced `Template` records (single query with `id: { in: [...] }`)
6. Maps to `SectionSlot[]` preserving section order
7. Returns `GenerationBlueprint` or `null`

**When to use:** Always -- this is the only pattern for this phase.

**Example:**
```typescript
import { prisma } from "../lib/db";
import type { GenerationBlueprint, SectionSlot, DealContext } from "@lumenalta/schemas";
import { resolveDeckStructureKey, type DeckStructureKey } from "../deck-intelligence/deck-structure-key";
import type { DeckStructureOutput, DeckSection } from "../deck-intelligence/deck-structure-schema";

export async function resolveBlueprint(
  key: DeckStructureKey,
  dealContext: DealContext,
): Promise<GenerationBlueprint | null> {
  // 1. Validate key (throws on invalid)
  const validatedKey = resolveDeckStructureKey(key.touchType, key.artifactType);

  // 2. Query DeckStructure
  const deckStructure = await prisma.deckStructure.findFirst({
    where: {
      touchType: validatedKey.touchType,
      artifactType: validatedKey.artifactType,
    },
  });

  if (!deckStructure) return null;

  // 3. Parse structureJson
  let parsed: DeckStructureOutput;
  try {
    parsed = JSON.parse(deckStructure.structureJson) as DeckStructureOutput;
  } catch {
    return null;
  }

  if (!parsed.sections || parsed.sections.length === 0) return null;

  // 4. Collect all slideIds across all sections
  const allSlideIds = parsed.sections.flatMap((s) => s.slideIds);
  if (allSlideIds.length === 0) return null;

  // 5. Batch query SlideEmbeddings
  const slides = await prisma.slideEmbedding.findMany({
    where: { id: { in: allSlideIds }, archived: false },
    select: {
      id: true,
      templateId: true,
      classificationJson: true,
      // include fields downstream phases need
    },
  });
  const slideMap = new Map(slides.map((s) => [s.id, s]));

  // 6. Batch query Templates for presentationId resolution
  const templateIds = [...new Set(slides.map((s) => s.templateId))];
  const templates = await prisma.template.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, presentationId: true },
  });
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  // 7. Build SectionSlots
  const sections: SectionSlot[] = parsed.sections
    .sort((a, b) => a.order - b.order)
    .map((section): SectionSlot => {
      // Filter to only IDs that actually exist and aren't archived
      const validIds = section.slideIds.filter((id) => slideMap.has(id));
      return {
        sectionName: section.name,
        purpose: section.purpose,
        isOptional: section.isOptional,
        candidateSlideIds: validIds,
        selectedSlideId: null,
        sourcePresentationId: null,
        hasModificationPlan: false,
      };
    });

  return {
    deckStructureId: deckStructure.id,
    touchType: validatedKey.touchType,
    artifactType: validatedKey.artifactType,
    sections,
    dealContext,
    sequenceRationale: parsed.sequenceRationale,
  };
}
```

### Pattern 2: Enriched Slide Data for Downstream Consumers
**What:** The resolver should also expose a way to get the full SlideEmbedding + Template data for the candidate slides, since the Section Matcher (Phase 54) needs `classificationJson` and `Template.presentationId` to score and select slides.

**When to use:** Export a separate `resolveCandidateSlides()` function or return enriched data alongside the blueprint.

**Example:**
```typescript
export interface ResolvedCandidate {
  slideId: string;
  templateId: string;
  presentationId: string;
  classificationJson: string | null;
  thumbnailUrl: string | null;
}

export interface BlueprintWithCandidates {
  blueprint: GenerationBlueprint;
  candidates: Map<string, ResolvedCandidate>; // keyed by slideId
}
```

### Anti-Patterns to Avoid
- **N+1 queries:** Do NOT query SlideEmbedding one-by-one per section. Collect all IDs, do one batch query, then distribute results.
- **Implicit Template join:** Prisma has no FK relation between SlideEmbedding and Template (the `templateId` field exists but no `@relation` directive). Do NOT try `include: { template: true }`. Use a separate batch query on `Template`.
- **Throwing on missing DeckStructure:** The contract is to return `null`, not throw. Downstream routing (Phase 57) depends on null to trigger fallback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Touch type / artifact type validation | Custom string matching | `resolveDeckStructureKey()` from deck-structure-key.ts | Already handles all 7 keys, throws on invalid combos |
| DeckStructure JSON shape | Custom interface | `DeckStructureOutput` / `DeckSection` from deck-structure-schema.ts | Already defined, used by inference engine |
| All 7 key enumeration | Hardcoded array of keys | `getDeckStructureListKeys()` from deck-structure-key.ts | Already generates all valid key combinations |
| Blueprint types | Custom interfaces | `GenerationBlueprint` / `SectionSlot` from @lumenalta/schemas | Phase 50 output, shared contract |

**Key insight:** Phase 34's deck-intelligence module already solved key validation, JSON parsing, and structure typing. The resolver is just a new consumer of those same interfaces.

## Common Pitfalls

### Pitfall 1: Missing Prisma Relation for SlideEmbedding -> Template
**What goes wrong:** Attempting `include: { template: true }` on a SlideEmbedding query will fail because there is no `@relation` directive between SlideEmbedding and Template in the Prisma schema. The `templateId` field is a plain string, not a relational FK.
**Why it happens:** The schema was designed in Phase 18 without the FK; adding it now would require a migration.
**How to avoid:** Use a separate `prisma.template.findMany({ where: { id: { in: templateIds } } })` query and join in application code.
**Warning signs:** Prisma compile error mentioning unknown field `template` on SlideEmbedding.

### Pitfall 2: Stale or Archived Slides in DeckStructure
**What goes wrong:** `DeckStructure.structureJson` may reference `SlideEmbedding` IDs that have since been archived or deleted during re-ingestion.
**Why it happens:** DeckStructure is inferred at a point in time; slides can be archived later during re-ingestion.
**How to avoid:** Filter `slideIds` through the batch query results -- only include IDs that exist in the returned `slideMap`. Sections with zero valid candidates should still be included (as empty candidates) so downstream phases can handle them.
**Warning signs:** candidateSlideIds containing IDs not found in the database.

### Pitfall 3: Empty Sections Array After Parse
**What goes wrong:** A DeckStructure may exist but have an empty `sections` array (e.g., inferred with 0 examples).
**Why it happens:** `inferDeckStructure()` stores empty structures when no examples/slides are found.
**How to avoid:** Check `parsed.sections.length === 0` and return `null`, same as missing DeckStructure.
**Warning signs:** GenerationBlueprint with empty `sections` array reaching downstream phases.

### Pitfall 4: touch_4 Without artifactType
**What goes wrong:** Querying DeckStructure with `touchType: "touch_4"` and `artifactType: null` will find nothing (all touch_4 rows have a non-null artifactType).
**Why it happens:** `resolveDeckStructureKey()` throws for this case, but callers might bypass validation.
**How to avoid:** Always validate through `resolveDeckStructureKey()` before querying. It throws `"artifactType is required for touch_4 deck structures"`.
**Warning signs:** Null returns for touch_4 when data exists.

## Code Examples

### DeckStructure.structureJson Shape (from deck-structure-schema.ts)
```typescript
// DeckStructureOutput is what gets JSON.parse'd from structureJson
interface DeckStructureOutput {
  sections: DeckSection[];
  sequenceRationale: string;
}

interface DeckSection {
  order: number;        // 1-based position
  name: string;         // e.g., "Title Slide", "Case Studies"
  purpose: string;      // Why this section exists
  isOptional: boolean;  // true if only in some examples
  variationCount: number; // Count of distinct slide variations
  slideIds: string[];   // SlideEmbedding IDs mapped to this section
}
```

### DeckStructure DB Query Pattern
```typescript
// The DB has a unique constraint on [touchType, artifactType]
const deckStructure = await prisma.deckStructure.findFirst({
  where: {
    touchType: "touch_2",
    artifactType: null, // null for non-touch_4 types
  },
});
// deckStructure.structureJson is a JSON string
```

### Key Validation (existing utility)
```typescript
import { resolveDeckStructureKey } from "../deck-intelligence/deck-structure-key";

// Valid: returns { touchType: "touch_2", artifactType: null }
resolveDeckStructureKey("touch_2");

// Valid: returns { touchType: "touch_4", artifactType: "proposal" }
resolveDeckStructureKey("touch_4", "proposal");

// Throws: "artifactType is required for touch_4 deck structures"
resolveDeckStructureKey("touch_4");

// Throws: "Unsupported touchType: touch_5"
resolveDeckStructureKey("touch_5");
```

### All 7 Logical Keys
```typescript
import { getDeckStructureListKeys } from "../deck-intelligence/deck-structure-key";

const keys = getDeckStructureListKeys();
// Returns:
// [
//   { touchType: "touch_1", artifactType: null },
//   { touchType: "touch_2", artifactType: null },
//   { touchType: "touch_3", artifactType: null },
//   { touchType: "pre_call", artifactType: null },
//   { touchType: "touch_4", artifactType: "proposal" },
//   { touchType: "touch_4", artifactType: "talk_track" },
//   { touchType: "touch_4", artifactType: "faq" },
// ]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No deck structure | DeckStructure inferred per touch type (Phase 34) | 2026-03-07 | Enables structure-driven generation |
| Types undefined | GenerationBlueprint + SectionSlot types (Phase 50) | 2026-03-09 | Contracts for all pipeline phases |
| Direct slide lists | Section-based candidate slots | Phase 51 (this phase) | Enables per-section matching and HITL |

## Open Questions

1. **Should the resolver filter out sections with zero valid candidates?**
   - What we know: Archived slides can leave sections empty after filtering
   - What's unclear: Whether downstream phases (Section Matcher) handle empty candidateSlideIds gracefully
   - Recommendation: Keep sections with empty candidates in the blueprint -- let the Section Matcher (Phase 54) handle this case. Log a warning.

2. **Should the resolver include the full SlideEmbedding data or just IDs?**
   - What we know: Phase 54 (Section Matcher) needs classificationJson and templateId->presentationId for scoring
   - What's unclear: Whether to return enriched data from the resolver or let Phase 54 re-query
   - Recommendation: Return a `BlueprintWithCandidates` wrapper containing both the blueprint and a Map of resolved candidate data. This avoids re-querying the same data in Phase 54.

## Sources

### Primary (HIGH confidence)
- `apps/agent/prisma/schema.prisma` lines 251-338 (SlideEmbedding, SlideElement, Template models)
- `apps/agent/prisma/schema.prisma` lines 436-454 (DeckStructure model)
- `apps/agent/src/deck-intelligence/deck-structure-key.ts` (key validation utility)
- `apps/agent/src/deck-intelligence/deck-structure-schema.ts` (DeckSection, DeckStructureOutput interfaces)
- `apps/agent/src/deck-intelligence/infer-deck-structure.ts` (existing structureJson write patterns)
- `packages/schemas/generation/types.ts` (GenerationBlueprint, SectionSlot, DealContext)
- `packages/schemas/constants.ts` (TOUCH_TYPES, ARTIFACT_TYPES)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new deps
- Architecture: HIGH - Straightforward data transformation, all interfaces defined
- Pitfalls: HIGH - Verified by reading actual schema (no FK relation, archived slides, empty sections)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependencies, internal codebase only)
