# Phase 54: Section Matcher - Research

**Researched:** 2026-03-09
**Domain:** Metadata scoring, pgvector cosine similarity, slide selection algorithms
**Confidence:** HIGH

## Summary

Phase 54 implements the Section Matcher -- a deterministic scoring algorithm that selects the best candidate slide for each section in a `GenerationBlueprint`. The input is a `BlueprintWithCandidates` (from Phase 51's `resolveBlueprint()`), which provides the blueprint with `SectionSlot.candidateSlideIds[]` and a `Map<string, ResolvedCandidate>` with pre-resolved `classificationJson`, `templateId`, and `presentationId` for each candidate. The output is a `SlideSelectionPlan` plus the mutated blueprint with `selectedSlideId` and `sourcePresentationId` filled.

The scoring algorithm is purely algorithmic -- no LLM calls. Each candidate's `classificationJson` (a `SlideMetadata` object with arrays of industries, solutionPillars, buyerPersonas, funnelStages) is scored against the `DealContext` fields (industry, pillars, persona, funnelStage). Vector similarity via pgvector `<=>` operator serves only as a tiebreaker when metadata scores are equal. Cross-touch exclusion filters out slides from `DealContext.priorTouchSlideIds`. The existing codebase already has the pgvector pattern (`1 - (embedding <=> vec::vector) AS similarity`) used in the `/slides/:id/similar` route.

This is a self-contained, testable module with no external API calls and no new dependencies (NFR-1, NFR-2). The function signature takes `BlueprintWithCandidates` + optional vector similarity scores and returns `SlideSelectionPlan` + mutated blueprint.

**Primary recommendation:** Create a single `selectSlidesForBlueprint()` function in `apps/agent/src/generation/section-matcher.ts` that implements a weighted metadata scoring algorithm with vector similarity tiebreaker, returning a `SlideSelectionPlan`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-3.1 | Score candidate slides against deal context using `SlideEmbedding.classificationJson` metadata (industry, pillar, persona, funnel stage) | Parse `classificationJson` as `SlideMetadata`, compute weighted match scores: industry match (weight 3), pillar overlap (weight 3), persona match (weight 2), funnel stage match (weight 2). Already available via `ResolvedCandidate.classificationJson` from Phase 51. |
| FR-3.2 | Use vector similarity (pgvector cosine distance) as a secondary scoring signal when metadata match is tied | Use `prisma.$queryRaw` with `1 - (embedding <=> query_vec::vector)` pattern (already proven in `/slides/:id/similar` route). Only query when tiebreaker needed, or batch-fetch similarity scores upfront for all candidates in a section. |
| FR-3.3 | Produce a `SlideSelectionPlan` mapping each section to its chosen slideId + source presentationId | Build `SlideSelectionEntry[]` from selections, using `ResolvedCandidate.presentationId` (already resolved by Phase 51). |
| FR-3.4 | Fall back to highest-confidence candidate when deal context is sparse or no strong match exists | When all metadata scores are 0 (no context fields populated), sort by `SlideEmbedding.confidence` field (already in DB, not in ResolvedCandidate -- add to select). If confidence is also null, pick first candidate. |
| FR-3.5 | Resolve `SlideEmbedding.templateId -> Template.presentationId` for each selected slide | Already resolved by Phase 51 in `ResolvedCandidate.presentationId`. No additional query needed. |
| FR-3.6 | Exclude slides already used in prior touches for the same deal (cross-touch exclusion) | Filter `candidateSlideIds` by removing any ID in `DealContext.priorTouchSlideIds` before scoring. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | 6.19.x | `$queryRaw` for pgvector cosine distance queries | Already used for vector similarity in the codebase |
| @lumenalta/schemas | workspace | `GenerationBlueprint`, `SectionSlot`, `DealContext`, `SlideSelectionPlan`, `SlideSelectionEntry` types | Phase 50 output, shared contracts |
| TypeScript | 5.9.x | Type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| blueprint-resolver.ts | internal | `BlueprintWithCandidates`, `ResolvedCandidate` types | Input to section matcher |
| slide-metadata schema | internal | `SlideMetadata` type for parsing `classificationJson` | Scoring metadata fields |
| constants.ts | internal | `INDUSTRIES`, `BUYER_PERSONAS`, `FUNNEL_STAGES`, `SOLUTION_PILLARS` | Validation of metadata values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic scoring | LLM-based selection (existing `slide-selection.ts`) | LLM adds latency, cost, non-determinism; metadata scoring is fast, testable, repeatable |
| Weighted metadata + vector tiebreaker | Pure vector similarity | Vector alone ignores structured metadata; hybrid gives best of both |

**Installation:**
No new packages needed (NFR-1).

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/generation/
  section-matcher.ts              # Main module
  __tests__/
    section-matcher.test.ts       # Unit tests with mocked Prisma
```

### Pattern 1: Weighted Metadata Scoring
**What:** Parse `classificationJson` into `SlideMetadata`, compute a numerical score against `DealContext` fields using weighted dimensions.
**When to use:** For every candidate slide in every section.
**Example:**
```typescript
// Scoring weights (higher = more important for match quality)
const WEIGHTS = {
  industry: 3,    // Industry match is critical
  pillar: 3,      // Solution pillar alignment is equally critical
  persona: 2,     // Buyer persona relevance
  funnelStage: 2, // Funnel stage appropriateness
} as const;

interface ScoredCandidate {
  slideId: string;
  metadataScore: number;
  confidence: number | null;
  vectorSimilarity: number | null;
}

function scoreCandidate(
  candidate: ResolvedCandidate,
  dealContext: DealContext,
): number {
  if (!candidate.classificationJson) return 0;

  let parsed: SlideMetadata;
  try {
    parsed = JSON.parse(candidate.classificationJson);
  } catch {
    return 0;
  }

  let score = 0;

  // Industry match: exact match in industries array
  if (parsed.industries?.includes(dealContext.industry as any)) {
    score += WEIGHTS.industry;
  }

  // Pillar overlap: count of matching pillars
  const pillarOverlap = dealContext.pillars.filter(
    p => parsed.solutionPillars?.includes(p)
  ).length;
  score += Math.min(pillarOverlap, 2) * WEIGHTS.pillar;

  // Persona match
  if (parsed.buyerPersonas?.includes(dealContext.persona as any)) {
    score += WEIGHTS.persona;
  }

  // Funnel stage match
  if (parsed.funnelStages?.includes(dealContext.funnelStage as any)) {
    score += WEIGHTS.funnelStage;
  }

  return score;
}
```

### Pattern 2: Vector Similarity Tiebreaker via Raw SQL
**What:** When two candidates have the same metadata score, use pgvector cosine distance as tiebreaker.
**When to use:** Only when metadata scoring produces ties within a section.
**Example:**
```typescript
// Existing pattern from /slides/:id/similar route in mastra/index.ts
// Adapted for batch similarity scoring
async function getVectorSimilarities(
  slideIds: string[],
  queryEmbedding: string, // vector string from a reference slide
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
    SELECT id, 1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
    FROM "SlideEmbedding"
    WHERE id = ANY(${slideIds})
      AND archived = false
  `;
  return new Map(rows.map(r => [r.id, r.similarity]));
}
```

### Pattern 3: Cross-Touch Exclusion Filter
**What:** Remove slides already used in prior touches from candidate lists.
**When to use:** Before scoring, for every section.
**Example:**
```typescript
function filterExcludedSlides(
  candidateIds: string[],
  priorTouchSlideIds: string[],
): string[] {
  const excluded = new Set(priorTouchSlideIds);
  return candidateIds.filter(id => !excluded.has(id));
}
```

### Pattern 4: Sparse Context Fallback
**What:** When deal context fields are empty/missing, fall back to slide confidence score.
**When to use:** When all metadata scores are 0 for all candidates in a section.
**Example:**
```typescript
// If all candidates score 0 on metadata, use confidence as fallback
// confidence is the LLM classification confidence from ingestion (0-100 float)
function selectBestFallback(candidates: ScoredCandidate[]): string {
  const sorted = [...candidates].sort(
    (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)
  );
  return sorted[0].slideId;
}
```

### Anti-Patterns to Avoid
- **LLM for selection:** Do NOT use LLM calls for slide selection in this phase. The existing `slide-selection.ts` uses LLM; this phase deliberately replaces that with deterministic scoring for structure-driven generation.
- **N+1 queries:** Do NOT query SlideEmbedding or Template per-candidate. Phase 51 already batch-resolves everything into `ResolvedCandidate` map.
- **Mutating candidates Map:** Do NOT modify the candidates Map from Phase 51. Create new scored structures.
- **Global vector search:** Do NOT do a global vector similarity search across all slides. Only compare within the pre-filtered candidate set per section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector similarity computation | Custom cosine distance in JS | pgvector `<=>` operator via `$queryRaw` | Database-level SIMD-optimized, already indexed |
| Classification parsing | Custom JSON parser | `JSON.parse()` + `SlideMetadata` type assertion | Schema is well-defined from ingestion pipeline |
| Template-to-presentation resolution | Additional DB query | `ResolvedCandidate.presentationId` from Phase 51 | Already resolved in `BlueprintWithCandidates.candidates` |

**Key insight:** Phase 51 front-loads all the expensive data resolution. Phase 54 is pure computation over pre-fetched data, with the only DB call being the optional vector similarity tiebreaker query.

## Common Pitfalls

### Pitfall 1: classificationJson is nullable
**What goes wrong:** Assuming every slide has valid classificationJson. Some slides have `null` (legacy slides before auto-classification was added) or malformed JSON.
**Why it happens:** The `classificationJson` column is `String?` in the Prisma schema.
**How to avoid:** Always wrap JSON.parse in try/catch, treat parse failures as score 0. Null classificationJson = score 0 (falls through to confidence fallback).
**Warning signs:** TypeError when accessing `.industries` on undefined.

### Pitfall 2: Empty candidate lists after exclusion
**What goes wrong:** Cross-touch exclusion removes ALL candidates for a section, leaving no slide to select.
**Why it happens:** Small content library + many prior touches = all candidates excluded.
**How to avoid:** After exclusion, if candidateIds is empty, fall back to the original unfiltered list. Better to reuse a slide than have a gap in the deck.
**Warning signs:** Section with `selectedSlideId: null` after matcher runs.

### Pitfall 3: Vector similarity requires embedding generation
**What goes wrong:** To use vector similarity as tiebreaker, you need a query vector. The deal context is text, not a vector.
**Why it happens:** The `<=>` operator requires two vectors.
**How to avoid:** Two approaches: (a) generate an embedding from deal context text using `generateEmbedding()` from `embed-slide.ts`, or (b) use the section purpose text as the query. Approach (a) is more accurate but adds an API call. Approach (b) is available but less deal-specific. Recommend approach (a) with caching -- generate one embedding per deal context, reuse across all sections.
**Warning signs:** Missing embedding generation call, or attempting to compare text to vector.

### Pitfall 4: Pillar overlap scoring can over-weight
**What goes wrong:** A deal with 5 pillars could give disproportionate scores to slides matching multiple pillars.
**Why it happens:** Uncapped pillar overlap count multiplied by weight.
**How to avoid:** Cap pillar overlap contribution (e.g., `Math.min(overlapCount, 2) * weight`). A slide matching 2+ pillars is good; matching 5 isn't 5x better.
**Warning signs:** Slides with broad classifications always winning over specialized ones.

### Pitfall 5: Sections with zero candidates from Phase 51
**What goes wrong:** Phase 51 keeps sections with zero valid candidates (decision [51-01]). The matcher must handle these gracefully.
**Why it happens:** Some DeckStructure sections reference archived or deleted slides.
**How to avoid:** Skip sections with empty `candidateSlideIds`, leave `selectedSlideId: null`. Downstream phases handle null selections.
**Warning signs:** Index-out-of-bounds on empty arrays.

## Code Examples

### Main Function Signature
```typescript
// Source: derived from Phase 50 types + Phase 51 output
import type { SlideSelectionPlan } from "@lumenalta/schemas";
import type { BlueprintWithCandidates } from "./blueprint-resolver";

export interface SectionMatchResult {
  /** The selection plan for downstream phases */
  plan: SlideSelectionPlan;
  /** The blueprint with selectedSlideId/sourcePresentationId filled */
  blueprint: GenerationBlueprint;
}

export async function selectSlidesForBlueprint(
  input: BlueprintWithCandidates,
): Promise<SectionMatchResult> {
  // 1. For each section, filter excluded slides
  // 2. Score remaining candidates against dealContext
  // 3. Break ties with vector similarity (if needed)
  // 4. Select best candidate per section
  // 5. Build SlideSelectionPlan
  // 6. Mutate blueprint sections with selections
}
```

### Vector Similarity Batch Query
```typescript
// Source: adapted from apps/agent/src/mastra/index.ts line 2108-2117
async function batchVectorSimilarity(
  slideIds: string[],
  queryVector: number[],
): Promise<Map<string, number>> {
  if (slideIds.length === 0) return new Map();

  const vecStr = `[${queryVector.join(",")}]`;
  const rows = await prisma.$queryRaw<Array<{ id: string; similarity: number }>>`
    SELECT id, 1 - (embedding <=> ${vecStr}::vector) AS similarity
    FROM "SlideEmbedding"
    WHERE id = ANY(${slideIds})
      AND archived = false
  `;
  return new Map(rows.map(r => [r.id, Number(r.similarity)]));
}
```

### Embedding Generation for Deal Context
```typescript
// Source: apps/agent/src/ingestion/embed-slide.ts
import { generateEmbedding } from "../ingestion/embed-slide";

function buildDealContextText(ctx: DealContext): string {
  const parts = [
    ctx.industry,
    ...ctx.pillars,
    ctx.persona,
    ctx.funnelStage,
    ctx.companyName,
  ].filter(Boolean);
  return parts.join(" | ");
}

// Generate once, reuse for all sections
const contextEmbedding = await generateEmbedding(buildDealContextText(dealContext));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM-based slide selection (`slide-selection.ts`) | Deterministic metadata scoring + vector tiebreaker | Phase 54 (this phase) | Faster, cheaper, deterministic, testable |
| Single-value classification fields (industry, solutionPillar, persona, funnelStage) | Multi-value `classificationJson` (arrays of each) | Phase 34 ingestion rework | Must check array membership, not string equality |
| Drive-based slide search (`atlusai-search.ts`) | DeckStructure-scoped candidate sets | Phase 51 blueprint resolver | Candidates pre-filtered to structure-relevant slides |

**Important note:** The single-value columns (`industry`, `solutionPillar`, `persona`, `funnelStage`) on `SlideEmbedding` are backward-compat only. The source of truth is `classificationJson`, which contains arrays (a slide can match multiple industries, pillars, etc.).

## Open Questions

1. **Vector similarity query strategy**
   - What we know: The `<=>` operator works with pgvector and is already used in the codebase. Generating an embedding requires a Vertex AI API call.
   - What's unclear: Whether to generate the embedding eagerly (always) or lazily (only on ties). Eager adds one API call per matcher invocation but simplifies logic. Lazy saves the call when no ties occur.
   - Recommendation: Use lazy generation -- only call `generateEmbedding()` when a tie is detected. Most sections will have clear metadata winners. Cache the embedding if generated, so subsequent tie sections reuse it.

2. **Confidence field availability in ResolvedCandidate**
   - What we know: `ResolvedCandidate` from Phase 51 does NOT include `confidence`. The `SlideEmbedding` table has it, and Phase 51's `findMany` select does not include it.
   - What's unclear: Whether to add `confidence` to `ResolvedCandidate` (modify Phase 51 output) or do a separate query.
   - Recommendation: Add `confidence` to `ResolvedCandidate` and Phase 51's select clause. It's a minor, backward-compatible change to the existing resolver. Include this as the first task in the plan.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `apps/agent/vitest.config.ts` |
| Quick run command | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FR-3.1 | Score candidates using classificationJson metadata against deal context | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "scores"` | Wave 0 |
| FR-3.2 | Vector similarity tiebreaker when metadata scores are equal | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "tiebreaker"` | Wave 0 |
| FR-3.3 | Produce SlideSelectionPlan with correct structure | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "plan"` | Wave 0 |
| FR-3.4 | Fallback to highest-confidence when context is sparse | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "fallback"` | Wave 0 |
| FR-3.5 | Resolve templateId -> presentationId for selected slides | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "presentationId"` | Wave 0 |
| FR-3.6 | Exclude prior touch slides from selection | unit | `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts -t "exclusion"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run src/generation/__tests__/section-matcher.test.ts`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/generation/__tests__/section-matcher.test.ts` -- covers FR-3.1 through FR-3.6
- Framework install: Not needed -- Vitest already configured

## Sources

### Primary (HIGH confidence)
- `apps/agent/prisma/schema.prisma` lines 251-285 -- SlideEmbedding model with classificationJson, confidence, embedding fields
- `apps/agent/prisma/schema.prisma` lines 320-338 -- Template model with presentationId
- `packages/schemas/generation/types.ts` -- DealContext, SectionSlot, GenerationBlueprint, SlideSelectionPlan, SlideSelectionEntry types
- `packages/schemas/llm/slide-metadata.ts` -- SlideMetadata schema (classificationJson structure)
- `packages/schemas/constants.ts` -- INDUSTRIES, BUYER_PERSONAS, FUNNEL_STAGES, SOLUTION_PILLARS enums
- `apps/agent/src/generation/blueprint-resolver.ts` -- BlueprintWithCandidates, ResolvedCandidate types, resolveBlueprint() function
- `apps/agent/src/mastra/index.ts` lines 2092-2120 -- existing pgvector cosine similarity pattern
- `apps/agent/src/ingestion/embed-slide.ts` -- generateEmbedding() function for Vertex AI embeddings

### Secondary (MEDIUM confidence)
- `apps/agent/src/lib/slide-selection.ts` -- existing LLM-based slide selection (legacy approach being replaced)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - scoring algorithm is straightforward, all data inputs are well-defined from Phase 51
- Pitfalls: HIGH - identified from direct codebase analysis (nullable fields, empty candidates, vector query patterns)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, no external API changes expected)
