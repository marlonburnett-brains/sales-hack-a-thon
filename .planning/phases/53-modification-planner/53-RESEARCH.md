# Phase 53: Modification Planner - Research

**Researched:** 2026-03-09
**Domain:** LLM-driven slide modification planning, named agent registration, element map filtering
**Confidence:** HIGH

## Summary

Phase 53 builds the "modification-planner" agent that examines a slide's element map (SlideElement records from Prisma) and deal context (DealContext type from Phase 50) to produce a ModificationPlan specifying which text elements to change and what the new content should be. The ModificationPlan Zod schema and GenAI schema already exist from Phase 50 (`apps/agent/src/generation/modification-plan-schema.ts`). This phase creates the orchestration function, the agent catalog entry, and the fallback logic.

The codebase has a well-established pattern for named agents: add an entry to `AGENT_CATALOG` in `packages/schemas/agent-catalog.ts`, which auto-generates Mastra agents via `buildNamedMastraAgent()` and seeds prompts via `seedPublishedAgentCatalog()`. The agent executor pattern (`executeRuntimeProviderNamedAgent` for Gemini direct, `executeRuntimeNamedAgent` for Mastra-wrapped) handles prompt resolution, structured output, and version tracking. The modification planner should use `executeRuntimeProviderNamedAgent` with the existing `MODIFICATION_PLAN_SCHEMA` GenAI schema for structured output, matching the pattern used by `chat-refinement.ts` and `infer-deck-structure.ts`.

The key intelligence challenge is distinguishing deal-specific content (company names, industry references, summary bullets) from structural content (methodology descriptions, capability definitions). This is a prompt engineering problem, not a code architecture problem. The system prompt must explicitly instruct the LLM on this distinction with examples.

**Primary recommendation:** Follow the exact named-agent pattern (catalog entry + executeRuntimeProviderNamedAgent + GenAI schema). The modification planner function takes a slide's SlideElement records + DealContext, filters to text-bearing elements, formats them as an element map prompt, and returns a parsed ModificationPlan. Fallback to placeholder injection when no SlideElement records exist.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-5.1 | Load SlideElement records for each assembled slide | Query `prisma.slideElement.findMany({ where: { slideId } })` using the SlideEmbedding ID. Elements have `elementId`, `elementType`, `contentText`, position/size, and styling. |
| FR-5.2 | Send element map + deal context to LLM ("modification-planner") to produce ModificationPlan | Use `executeRuntimeProviderNamedAgent` with `MODIFICATION_PLAN_SCHEMA` GenAI schema. Prompt includes filtered element list + DealContext fields. |
| FR-5.3 | Only plan modifications for text-bearing elements (text, shape with text); preserve images, tables, groups | Filter SlideElement records: include `elementType === "text"` or `elementType === "shape"` with non-empty `contentText`. Exclude `image`, `table`, `group`. |
| FR-5.4 | Distinguish deal-specific vs structural content | Prompt engineering: system prompt includes classification rules and examples. Deal-specific = company names, industry terms, persona references, summary bullets. Structural = methodology, capabilities, case studies, process steps. |
| FR-5.5 | Register "modification-planner" as named agent with versioned system prompt | Add entry to `AGENT_CATALOG` array in `packages/schemas/agent-catalog.ts`. Update `AgentId` type union. Add to `AgentFamily` if needed (use existing "deck-intelligence" family). Seed runs automatically. |
| FR-5.6 | Fall back to placeholder injection when element maps are missing | When `slideElement.findMany()` returns empty array, return a placeholder-based ModificationPlan using `replaceAllText` patterns from `deck-customizer.ts` (company name, industry, etc.). |
| NFR-5 | LLM schemas flat, no optionals/unions (Gemini compatibility) | Already satisfied -- `MODIFICATION_PLAN_SCHEMA` and `ModificationPlanLlmSchema` from Phase 50 are flat. No changes needed. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | (project default) | Gemini structured output via `executeRuntimeProviderNamedAgent` | Already used by chat-refinement.ts, infer-deck-structure.ts |
| Prisma | 6.19.x | Query SlideElement records | Existing ORM, stay on 6.19.x per blocker |
| Zod | ^4.3.6 | ModificationPlan schema validation (already exists) | Already in @lumenalta/schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | AgentId type, AGENT_CATALOG, DealContext, zodToLlmJsonSchema | Agent registration and type imports |

### Alternatives Considered
None -- all libraries already in the project. No new dependencies (NFR-1).

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/generation/
  modification-planner.ts        # NEW: Core planner function
  modification-plan-schema.ts    # EXISTS: Zod + GenAI schemas (Phase 50)
  types.ts                       # EXISTS: MultiSourcePlan, SecondarySource
packages/schemas/
  agent-catalog.ts               # MODIFY: Add "modification-planner" entry
  index.ts                       # MODIFY: Export new AgentId (auto from catalog)
```

### Pattern 1: Named Agent Registration
**What:** Adding a new named agent to the governed catalog
**When to use:** Any new LLM-driven task that needs versioned prompts
**Steps:**
1. Add `"modification-planner"` to `AgentId` type union in `packages/schemas/agent-catalog.ts`
2. Add `AgentCatalogEntry` to `AGENT_CATALOG` array with family, responsibility, touchTypes, sourceSites
3. The entry auto-flows through:
   - `buildNamedMastraAgent()` creates Mastra Agent instance
   - `namedMastraAgents` record registers it in Mastra
   - `seedPublishedAgentCatalog()` creates DB records with compiled prompt
4. No manual wiring needed -- just add the catalog entry

**Example:**
```typescript
// packages/schemas/agent-catalog.ts
{
  agentId: "modification-planner",
  name: "Modification Planner",
  responsibility:
    "Plan surgical text modifications for assembled slides based on element maps and deal context.",
  family: "deck-intelligence",
  isShared: true,
  touchTypes: ["touch_1", "touch_2", "touch_3", "touch_4"],
  sourceSites: ["apps/agent/src/generation/modification-planner.ts"],
  sourceNotes:
    "Owns the element-map analysis prompt that produces ModificationPlan structured output.",
}
```

### Pattern 2: Structured Output via Provider Named Agent
**What:** Call Gemini directly with GenAI response schema (not Mastra-wrapped)
**When to use:** When you need structured JSON output with a GenAI `Type.OBJECT` schema
**Example:**
```typescript
// Source: apps/agent/src/deck-intelligence/chat-refinement.ts (existing pattern)
import { executeRuntimeProviderNamedAgent } from "../lib/agent-executor";
import { MODIFICATION_PLAN_SCHEMA } from "./modification-plan-schema";

const result = await executeRuntimeProviderNamedAgent({
  agentId: "modification-planner",
  messages: [{ role: "user", content: prompt }],
  options: {
    responseFormat: {
      type: "json",
      schema: MODIFICATION_PLAN_SCHEMA,
    },
  },
});

const plan = JSON.parse(result.text) as ModificationPlan;
```

### Pattern 3: Element Map Filtering
**What:** Filter SlideElement records to only text-bearing elements before sending to LLM
**When to use:** Building the element map portion of the modification planner prompt
**Logic:**
```typescript
function filterTextBearingElements(elements: SlideElement[]): SlideElement[] {
  return elements.filter(
    (el) =>
      (el.elementType === "text" || el.elementType === "shape") &&
      el.contentText.trim().length > 0
  );
}
```

### Pattern 4: Placeholder Injection Fallback
**What:** When element maps are missing, fall back to global replaceAllText
**When to use:** `slideElement.findMany()` returns empty array for a slide
**Logic:** Return a synthetic ModificationPlan with empty modifications array and flag for downstream placeholder injection. The existing `applyDeckCustomizations()` in `deck-customizer.ts` handles `replaceAllText` for `{{customer-name}}`, `{{salesperson-name}}`, etc.

### Anti-Patterns to Avoid
- **Global replaceAllText for element-mapped slides:** Never use `replaceAllText` when element maps exist. It causes cross-slide contamination (NFR-7, FR-6.2).
- **Sending ALL elements to LLM:** Images, tables, and groups add noise. Filter to text-bearing elements only (FR-5.3).
- **Modifying structural content:** The LLM must preserve methodology descriptions, capability definitions, and case study specifics. Only deal-specific references (company names, industry terms) should change (FR-5.4).
- **Optional fields in LLM schema:** Gemini rejects schemas with optionals/unions (NFR-5). The schema is already correct from Phase 50.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent registration | Manual DB insert + prompt compilation | `AGENT_CATALOG` entry + `seedPublishedAgentCatalog()` | Auto-wires Mastra agent, DB records, prompt versioning |
| LLM invocation | Raw `GoogleGenAI` client calls | `executeRuntimeProviderNamedAgent()` | Handles prompt resolution, version tracking, config |
| JSON schema for Gemini | Manual Type.OBJECT construction | Existing `MODIFICATION_PLAN_SCHEMA` from Phase 50 | Already built, tested, NFR-5 compliant |
| Element type detection | Custom type inference | Prisma `elementType` column | Already classified during ingestion by `extract-elements.ts` |

## Common Pitfalls

### Pitfall 1: LLM Returns Invalid Element IDs
**What goes wrong:** LLM fabricates elementId values that don't exist on the slide
**Why it happens:** LLM sees element IDs in the prompt and may hallucinate similar-looking ones
**How to avoid:** Post-validate every `elementId` in the returned ModificationPlan against the input element list. Strip any modifications targeting unknown IDs.
**Warning signs:** Element-map executor (Phase 55) gets 404s on batchUpdate

### Pitfall 2: LLM Modifies Structural Content
**What goes wrong:** Company methodology descriptions or case study specifics get rewritten
**Why it happens:** LLM over-eagerly replaces content that mentions industries or company types
**How to avoid:** System prompt must include explicit examples of structural content to preserve. Include a "DO NOT MODIFY" category with examples. Consider including element position/size hints -- large body text blocks are more likely structural.
**Warning signs:** Output decks lose their source presentation value proposition

### Pitfall 3: Empty ContentText Elements
**What goes wrong:** Elements with empty or whitespace-only `contentText` are sent to LLM, confusing it
**Why it happens:** Some shapes have no text but `elementType === "shape"`
**How to avoid:** Filter on `contentText.trim().length > 0` in addition to type filtering
**Warning signs:** LLM returns modifications for blank elements

### Pitfall 4: Prompt Token Overflow
**What goes wrong:** Slides with 20+ text elements produce very long prompts
**Why it happens:** Each element includes its full text content in the prompt
**How to avoid:** Truncate very long element text (e.g., >500 chars) with an indicator. Gemini 2.0 Flash handles 1M tokens, but concise prompts produce better structured output.
**Warning signs:** Slow response times, degraded output quality

### Pitfall 5: Forgetting to Update AgentId Type
**What goes wrong:** TypeScript compilation fails or runtime errors on agent lookup
**Why it happens:** Adding catalog entry but not updating the `AgentId` type union
**How to avoid:** Both the type union AND the catalog entry must be updated together in `agent-catalog.ts`
**Warning signs:** TypeScript errors on `agentId: "modification-planner"`

### Pitfall 6: slideObjectId vs slideId Confusion
**What goes wrong:** ModificationPlan uses the wrong ID type for Google Slides API calls
**Why it happens:** `slideId` is the SlideEmbedding database ID, `slideObjectId` is the Google Slides page object ID
**How to avoid:** Both are required in ModificationPlan. `slideId` for traceability, `slideObjectId` (from `SlideEmbedding.slideObjectId`) for API calls. Ensure the prompt clearly labels which ID is which.
**Warning signs:** Phase 55 executor can't find slides in the presentation

## Code Examples

### Core Planner Function Signature
```typescript
// apps/agent/src/generation/modification-planner.ts
import type { DealContext } from "@lumenalta/schemas";
import type { ModificationPlan } from "./modification-plan-schema";

interface PlanModificationsParams {
  slideId: string;           // SlideEmbedding ID
  slideObjectId: string;     // Google Slides page object ID
  dealContext: DealContext;
}

interface PlanModificationsResult {
  plan: ModificationPlan;
  usedFallback: boolean;     // true if no element maps found
  promptVersion: {
    agentId: string;
    id: string;
    version: number;
  };
}

export async function planSlideModifications(
  params: PlanModificationsParams
): Promise<PlanModificationsResult> {
  // 1. Load SlideElement records from DB
  // 2. Filter to text-bearing elements
  // 3. If empty -> fallback to placeholder plan
  // 4. Build prompt with element map + deal context
  // 5. Call executeRuntimeProviderNamedAgent with MODIFICATION_PLAN_SCHEMA
  // 6. Parse and validate response
  // 7. Return plan + metadata
}
```

### Prompt Structure
```typescript
function buildModificationPrompt(
  textElements: Array<{ elementId: string; contentText: string; elementType: string }>,
  dealContext: DealContext,
  slideObjectId: string,
  slideId: string,
): string {
  const elementList = textElements
    .map((el) => `- Element ID: ${el.elementId}\n  Type: ${el.elementType}\n  Content: "${el.contentText}"`)
    .join("\n\n");

  return `You are planning surgical text modifications for a sales presentation slide.

DEAL CONTEXT:
- Company: ${dealContext.companyName}
- Industry: ${dealContext.industry}
- Solution pillars: ${dealContext.pillars.join(", ")}
- Buyer persona: ${dealContext.persona}
- Funnel stage: ${dealContext.funnelStage}

SLIDE IDENTIFICATION:
- Slide ID (database): ${slideId}
- Slide Object ID (Google Slides): ${slideObjectId}

TEXT ELEMENTS ON THIS SLIDE:
${elementList}

MODIFICATION RULES:
1. MODIFY deal-specific content: company names, industry references, persona mentions, generic summary bullets that should reference the target company
2. PRESERVE structural content: methodology descriptions, capability definitions, case study specifics, process step labels, section headers that define the slide's purpose
3. Keep modifications minimal and surgical -- change only what needs to change for deal relevance
4. New content must be the same length or shorter than current content to avoid text overflow
5. Every element must appear in either modifications[] (with new content) or unmodifiedElements[] (preserved as-is)

Return a ModificationPlan JSON with slideId, slideObjectId, modifications (array of changes), and unmodifiedElements (array of preserved element IDs).`;
}
```

### Fallback Placeholder Plan
```typescript
function buildPlaceholderFallbackPlan(
  slideId: string,
  slideObjectId: string,
  dealContext: DealContext,
): ModificationPlan {
  return {
    slideId,
    slideObjectId,
    modifications: [],
    unmodifiedElements: [],
    // Downstream executor sees empty modifications + usedFallback flag
    // and applies replaceAllText for {{customer-name}}, {{salesperson-name}} etc.
  };
}
```

### Post-Validation
```typescript
function validateModificationPlan(
  plan: ModificationPlan,
  knownElementIds: Set<string>,
): ModificationPlan {
  const validModifications = plan.modifications.filter((mod) => {
    if (!knownElementIds.has(mod.elementId)) {
      console.warn(
        `[modification-planner] Stripping modification for unknown element ${mod.elementId}`
      );
      return false;
    }
    return true;
  });

  const validUnmodified = plan.unmodifiedElements.filter((id) =>
    knownElementIds.has(id)
  );

  return {
    ...plan,
    modifications: validModifications,
    unmodifiedElements: validUnmodified,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global `replaceAllText` (deck-customizer.ts) | Element-scoped modifications via ModificationPlan | v1.8 (this milestone) | Prevents cross-slide contamination, enables surgical edits |
| Hardcoded placeholder tokens (`{{customer-name}}`) | LLM-planned content modifications based on element maps | v1.8 (this milestone) | Context-aware, deal-specific content without predefined templates |
| Manual agent prompt management | Named agent catalog with versioned prompts | v1.7 | Prompt versioning, A/B testing, governed prompt evolution |

## Open Questions

1. **Batch vs Per-Slide LLM Calls**
   - What we know: ModificationPlan is per-slide. A typical deck has 8-15 slides.
   - What's unclear: Whether to call the LLM once per slide or batch multiple slides into one prompt.
   - Recommendation: Start with per-slide calls for simplicity and debuggability. Batching is a future optimization if latency is a concern.

2. **SlideObjectId Resolution**
   - What we know: SlideEmbedding has a `slideObjectId` column (nullable). It's the Google Slides page ID.
   - What's unclear: Whether all assembled slides will have `slideObjectId` populated, especially after multi-source assembly reorders slides.
   - Recommendation: The planner should accept `slideObjectId` as a parameter (resolved by the caller who has the assembled presentation context). Don't rely on the DB value which may be stale after assembly.

3. **Content Length Constraints**
   - What we know: Replacement text that's longer than the original can cause text overflow in fixed-size shapes.
   - What's unclear: Whether to enforce character count limits in the schema or just in the prompt.
   - Recommendation: Prompt-level instruction ("same length or shorter") is sufficient for v1. Schema-level enforcement would over-complicate the LLM output.

## Sources

### Primary (HIGH confidence)
- `packages/schemas/agent-catalog.ts` -- AgentId type, AGENT_CATALOG pattern, catalog entry structure
- `apps/agent/src/lib/agent-executor.ts` -- executeRuntimeProviderNamedAgent pattern, GenAI schema usage
- `apps/agent/src/generation/modification-plan-schema.ts` -- Existing ModificationPlan Zod + GenAI schemas
- `apps/agent/src/ingestion/extract-elements.ts` -- SlideElementData types, element type classification logic
- `apps/agent/prisma/schema.prisma` -- SlideElement model (elementId, elementType, contentText, slideId)
- `apps/agent/src/lib/agent-catalog-defaults.ts` -- buildRolePrompt pattern, seed flow
- `apps/agent/src/lib/deck-customizer.ts` -- Existing placeholder injection (replaceAllText) pattern for fallback

### Secondary (MEDIUM confidence)
- `apps/agent/src/deck-intelligence/chat-refinement.ts` -- Reference implementation of executeRuntimeProviderNamedAgent with structured output
- `apps/agent/src/ingestion/describe-slide.ts` -- Reference implementation of executeRuntimeNamedAgent with Zod schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- follows exact established patterns for named agents, executor, schemas
- Pitfalls: HIGH -- identified from real codebase patterns and schema constraints

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- patterns well-established)
