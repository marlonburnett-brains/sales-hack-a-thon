# Phase 50: Foundation Types & Interfaces - Research

**Researched:** 2026-03-09
**Domain:** TypeScript type definitions, Zod LLM schemas, monorepo shared types
**Confidence:** HIGH

## Summary

Phase 50 defines 6 TypeScript types (GenerationBlueprint, SectionSlot, SlideSelectionPlan, MultiSourcePlan, ModificationPlan, DealContext) and one Zod LLM schema (ModificationPlan). The codebase already has well-established patterns for all of these: plain TypeScript interfaces in feature files, Zod schemas with `.meta()` descriptions in `packages/schemas/llm/`, Google GenAI `Type.OBJECT` constants in agent-side files, and `as const` arrays in `packages/schemas/constants.ts` for domain enumerations.

The primary risk is breaking the "flat, no optionals, no unions" constraint for LLM-facing schemas (NFR-5). The secondary risk is creating circular dependencies between shared types in `packages/schemas/generation/` and agent-only types in `apps/agent/src/generation/`. Both are straightforward to avoid by following existing patterns.

**Primary recommendation:** Follow the exact split decided in CONTEXT.md -- shared types in `packages/schemas/generation/types.ts`, agent-only types in `apps/agent/src/generation/types.ts`, ModificationPlan Zod schema alongside its TypeScript interface. Use `as const` arrays from `constants.ts` for all union-like fields. No runtime logic in this phase.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Hybrid split: shared types in `packages/schemas/generation/`, agent-only types in `apps/agent/src/generation/`
- Shared types (needed by both web HITL UI and agent): GenerationBlueprint, SectionSlot, DealContext, SlideSelectionPlan
- Agent-only types (execution details): MultiSourcePlan, ModificationPlan
- `apps/agent/src/generation/` holds types only for Phase 50 -- implementation files land in later phases wherever makes sense
- Shared types exported via existing `packages/schemas/index.ts` barrel file (import as `@repo/schemas`)
- Only LLM-facing types get Zod schemas (ModificationPlan for the modification-planner agent)
- All other types (GenerationBlueprint, SectionSlot, SlideSelectionPlan, MultiSourcePlan, DealContext) are plain TypeScript interfaces
- Google GenAI schema constant (Type.OBJECT) defined alongside the Zod schema, not derived at runtime -- matches existing `DECK_STRUCTURE_SCHEMA` pattern
- DealContext is lean: dealId, companyName, industry, pillars, persona, funnelStage, priorTouchSlideIds[]
- SectionSlot holds candidateSlideIds as string[] -- downstream phases resolve to full SlideEmbedding records
- MultiSourcePlan includes both templateId and presentationId
- No Prisma-generated types imported directly into pipeline types

### Claude's Discretion
- LLM schema flattening strategy for ModificationPlan (must be flat per NFR-5 Gemini compatibility)
- Whether DealContext includes salesperson info or keeps it separate
- Whether GenerationBlueprint includes deckStructureId for traceability
- String literal union types vs Prisma enums for TypeScript interfaces (follow existing constants.ts pattern)
- Whether to define helper/utility sub-types beyond the 6 required FR-1 types
- Where LLM-facing Zod schemas live (packages/schemas/llm/ vs agent generation/ dir) based on cross-package usage

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-1.1 | `GenerationBlueprint` type: ordered list of SectionSlots with touchType, artifactType, dealContext, sequenceRationale | Shared type in `packages/schemas/generation/types.ts`. Uses TouchType/ArtifactType from constants.ts. Include deckStructureId for traceability (recommended). |
| FR-1.2 | `SectionSlot` type: sectionName, purpose, isOptional, candidateSlideIds[], selectedSlideId?, sourcePresentationId?, modificationPlan? | Shared type. Optional fields allowed here (not LLM-facing). modificationPlan typed as `ModificationPlan \| null` to avoid optionals in downstream usage. |
| FR-1.3 | `SlideSelectionPlan` type: mapping of section -> chosen slideId + source presentationId + match rationale | Shared type. Array of selection entries, not a Map/Record (serializable for HITL transport). |
| FR-1.4 | `MultiSourcePlan` type: primarySource (presentationId, keepSlideIds, deleteSlideIds), secondarySources[], finalSlideOrder | Agent-only type in `apps/agent/src/generation/types.ts`. Include templateId alongside presentationId per locked decision. |
| FR-1.5 | `ModificationPlan` type: slideId, slideObjectId, modifications[] (elementId, currentContent, newContent, reason), unmodifiedElements[] | Agent-only type + Zod schema + GenAI schema constant. Must be flat for Gemini (NFR-5). Flatten modifications array to single-level objects. |
| FR-1.6 | `DealContext` type: dealId, companyName, industry, pillars, persona, funnelStage, priorTouchSlideIds[] | Shared type. Lean per locked decision. No salesperson info (keep separate like existing DeckCustomizations). |
| NFR-5 | LLM schemas must be flat objects with no optionals/unions (Gemini structured output compatibility) | ModificationPlan Zod schema uses only z.string(), z.number(), z.boolean(), z.array() of flat objects. No z.optional(), no z.union(). Verified pattern in existing schemas. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project default) | Interface definitions | Already configured across monorepo |
| Zod | ^4.3.6 | LLM-facing schema validation | Already in `@lumenalta/schemas` package.json |
| @google/genai | (project default) | `Type.OBJECT` GenAI schema constants | Already used in deck-structure-schema.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | Barrel exports, constants | Import via `@repo/schemas` or `@lumenalta/schemas` |

### Alternatives Considered
None -- all libraries are already in the project. No new dependencies needed (NFR-1).

## Architecture Patterns

### Recommended Project Structure
```
packages/schemas/
  generation/
    types.ts          # GenerationBlueprint, SectionSlot, SlideSelectionPlan, DealContext
  index.ts            # Add re-exports for generation types

apps/agent/src/
  generation/
    types.ts          # MultiSourcePlan, ModificationPlan (interface)
    modification-plan-schema.ts  # Zod schema + GenAI schema constant
```

### Pattern 1: Plain TypeScript Interfaces (Non-LLM Types)
**What:** Define interfaces with JSDoc comments, reference `as const` arrays from constants.ts for union types.
**When to use:** All 5 non-LLM types (GenerationBlueprint, SectionSlot, SlideSelectionPlan, MultiSourcePlan, DealContext).
**Example:**
```typescript
// Source: existing pattern in deck-structure-schema.ts, deck-structure-key.ts
import { TOUCH_TYPES, ARTIFACT_TYPES, type ArtifactType } from "@lumenalta/schemas";

type TouchType = (typeof TOUCH_TYPES)[number];

export interface DealContext {
  /** Supabase deal ID */
  dealId: string;
  /** Target company name */
  companyName: string;
  /** Industry vertical from constants.ts INDUSTRIES */
  industry: string;
  /** Solution pillars from constants.ts SOLUTION_PILLARS */
  pillars: string[];
  /** Buyer persona from constants.ts BUYER_PERSONAS */
  persona: string;
  /** Funnel stage from constants.ts FUNNEL_STAGES */
  funnelStage: string;
  /** SlideEmbedding IDs used in prior touches for cross-touch exclusion */
  priorTouchSlideIds: string[];
}
```

### Pattern 2: Zod LLM Schema with GenAI Constant (LLM-Facing Types)
**What:** Zod schema with `.meta()` descriptions for JSON Schema generation, plus a parallel `Type.OBJECT` constant for Google GenAI direct usage.
**When to use:** ModificationPlan only (the single LLM-facing type in this phase).
**Example:**
```typescript
// Source: existing patterns in packages/schemas/llm/proposal-copy.ts + deck-structure-schema.ts
import { z } from "zod";
import { Type } from "@google/genai";

// Zod schema (flat, no optionals, no unions per NFR-5)
export const ModificationPlanLlmSchema = z.object({
  slideId: z.string().meta({
    description: "SlideEmbedding ID for the slide being modified.",
  }),
  slideObjectId: z.string().meta({
    description: "Google Slides page objectId for API calls.",
  }),
  modifications: z.array(
    z.object({
      elementId: z.string().meta({
        description: "SlideElement pageObjectId to modify.",
      }),
      currentContent: z.string().meta({
        description: "Current text content of the element.",
      }),
      newContent: z.string().meta({
        description: "Replacement text content for the element.",
      }),
      reason: z.string().meta({
        description: "Why this modification serves the deal context.",
      }),
    })
  ).meta({
    description: "Ordered list of element modifications to execute.",
  }),
  unmodifiedElements: z.array(z.string()).meta({
    description: "ElementIds deliberately left unchanged with structural content.",
  }),
});

export type ModificationPlan = z.infer<typeof ModificationPlanLlmSchema>;

// Google GenAI response schema (parallel definition, not derived)
export const MODIFICATION_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    slideId: { type: Type.STRING, description: "SlideEmbedding ID for the slide being modified." },
    slideObjectId: { type: Type.STRING, description: "Google Slides page objectId for API calls." },
    modifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          elementId: { type: Type.STRING, description: "SlideElement pageObjectId to modify." },
          currentContent: { type: Type.STRING, description: "Current text content of the element." },
          newContent: { type: Type.STRING, description: "Replacement text content for the element." },
          reason: { type: Type.STRING, description: "Why this modification serves the deal context." },
        },
        required: ["elementId", "currentContent", "newContent", "reason"],
      },
      description: "Ordered list of element modifications to execute.",
    },
    unmodifiedElements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "ElementIds deliberately left unchanged with structural content.",
    },
  },
  required: ["slideId", "slideObjectId", "modifications", "unmodifiedElements"],
};
```

### Pattern 3: Barrel Re-export in packages/schemas/index.ts
**What:** Add generation type exports to the existing barrel file.
**When to use:** After creating `packages/schemas/generation/types.ts`.
**Example:**
```typescript
// Add to packages/schemas/index.ts
export {
  type GenerationBlueprint,
  type SectionSlot,
  type SlideSelectionPlan,
  type DealContext,
} from "./generation/types.ts";
```

### Anti-Patterns to Avoid
- **Importing Prisma-generated types into pipeline types:** Couples generation pipeline to DB layer. Use string IDs and resolve to Prisma records at call sites.
- **Using z.optional() or z.union() in LLM schemas:** Gemini structured output rejects these. All fields required, all values concrete.
- **Agent-only types in packages/schemas:** MultiSourcePlan and ModificationPlan are execution details the web HITL UI never needs. Keep in `apps/agent/src/generation/`.
- **Circular imports between shared and agent types:** Agent types can import from `@lumenalta/schemas` (one-way). Shared types must NEVER import from `apps/agent/`.
- **Using Record<string, T> for LLM schemas:** Not supported by Gemini structured output. Use arrays of keyed objects instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Domain constants (industries, personas, etc.) | String literal unions | `constants.ts` as const arrays + `(typeof X)[number]` | Single source of truth already exists |
| Zod-to-JSON-Schema conversion | Custom serializer | `zodToLlmJsonSchema()` from `@lumenalta/schemas` | Already handles $schema stripping and fail-fast on unsupported types |
| Touch type + artifact type keys | Custom key builders | `DeckStructureKey` type + `resolveDeckStructureKey()` from `deck-structure-key.ts` | Already handles touch_4 artifact validation |

## Common Pitfalls

### Pitfall 1: Gemini Structured Output Compatibility
**What goes wrong:** Schema uses optional fields, unions, or deeply nested objects. Gemini rejects the schema at runtime with unhelpful errors.
**Why it happens:** TypeScript interfaces naturally use `?` for optional fields, but LLM schemas must be fully specified.
**How to avoid:** All Zod schema fields use required `.string()`, `.number()`, `.boolean()`, `.array()`. No `.optional()`, no `.union()`, no `.nullable()`. Max 2 levels of nesting (object with array of objects).
**Warning signs:** Any `?` in a Zod schema field, any `z.union()` or `z.nullable()` call.

### Pitfall 2: Circular Dependencies Between Shared and Agent Types
**What goes wrong:** Agent-only types import shared types (fine), then shared types import agent types (circular). Build fails or types become `any`.
**Why it happens:** SectionSlot references ModificationPlan. If SectionSlot is shared and ModificationPlan is agent-only, the import direction creates a cycle.
**How to avoid:** In the shared `SectionSlot` type, type `modificationPlan` as a generic or use a forward reference comment. Recommended approach: define `SectionSlot.modificationPlan` as `unknown | null` in the shared type, and narrow it to `ModificationPlan` in agent-side code. Alternative: make ModificationPlan a shared type too (simpler, but slightly breaks the "agent-only" decision). Best approach: since SectionSlot needs ModificationPlan, define a minimal `ModificationPlanSummary` in shared types (just slideId + modification count for HITL display), and keep the full `ModificationPlan` agent-only.
**Warning signs:** Import paths from `apps/agent/` appearing in `packages/schemas/`.

### Pitfall 3: Type Mismatch with Existing Prisma Models
**What goes wrong:** Pipeline types assume field names or shapes that don't match actual Prisma model fields. Downstream phases hit type errors when resolving.
**Why it happens:** Defining types in isolation without checking the actual DB schema.
**How to avoid:** Verified Prisma model fields during research (see below). Key mappings:
- `SlideEmbedding.id` (cuid) -- used as `candidateSlideIds` entries
- `SlideEmbedding.templateId` -- maps to `Template.id` (not presentationId)
- `Template.presentationId` -- the Google Slides ID used for API calls
- `SlideElement.elementId` -- the Google Slides pageObjectId
- `SlideEmbedding.slideObjectId` -- nullable, the page objectId from Google Slides
- `DeckStructure.structureJson` -- JSON string, must be parsed to `DeckStructureOutput`

### Pitfall 4: Forgetting to Export from Barrel File
**What goes wrong:** Types exist but aren't importable via `@lumenalta/schemas` or `@repo/schemas`.
**Why it happens:** Creating the types file but not adding re-exports to `packages/schemas/index.ts`.
**How to avoid:** Always update the barrel file as part of the same task.

## Code Examples

### GenerationBlueprint (Shared)
```typescript
// packages/schemas/generation/types.ts
import type { ArtifactType } from "../constants.ts";
import { TOUCH_TYPES } from "../constants.ts";

type TouchType = (typeof TOUCH_TYPES)[number];

export interface SectionSlot {
  /** Section name from DeckStructure (e.g., "Company Overview") */
  sectionName: string;
  /** Why this section exists in the deck */
  purpose: string;
  /** Whether this section can be omitted */
  isOptional: boolean;
  /** SlideEmbedding IDs that are candidates for this section */
  candidateSlideIds: string[];
  /** Chosen SlideEmbedding ID after selection (null before selection) */
  selectedSlideId: string | null;
  /** Google Slides presentationId of the source deck (null before selection) */
  sourcePresentationId: string | null;
  /** Whether a modification plan exists for this slot */
  hasModificationPlan: boolean;
}

export interface DealContext {
  dealId: string;
  companyName: string;
  industry: string;
  pillars: string[];
  persona: string;
  funnelStage: string;
  priorTouchSlideIds: string[];
}

export interface GenerationBlueprint {
  /** DeckStructure record ID for traceability */
  deckStructureId: string;
  /** Touch type for this generation */
  touchType: TouchType;
  /** Artifact type (only for touch_4) */
  artifactType: ArtifactType | null;
  /** Ordered list of section slots */
  sections: SectionSlot[];
  /** Deal-specific context for slide selection and modification */
  dealContext: DealContext;
  /** Explanation of section ordering from DeckStructure */
  sequenceRationale: string;
}

export interface SlideSelectionEntry {
  /** Section name this selection is for */
  sectionName: string;
  /** Chosen SlideEmbedding ID */
  slideId: string;
  /** Google Slides presentationId of the source */
  sourcePresentationId: string;
  /** Template record ID for internal traceability */
  templateId: string;
  /** Why this slide was chosen for this section */
  matchRationale: string;
}

export interface SlideSelectionPlan {
  /** One entry per section in the blueprint */
  selections: SlideSelectionEntry[];
}
```

### Agent-Only Types
```typescript
// apps/agent/src/generation/types.ts
export interface SecondarySource {
  /** Template record ID */
  templateId: string;
  /** Google Slides presentation ID for API calls */
  presentationId: string;
  /** SlideEmbedding IDs to extract from this source */
  slideIds: string[];
}

export interface MultiSourcePlan {
  /** Primary source (most slides come from here) */
  primarySource: {
    templateId: string;
    presentationId: string;
    keepSlideIds: string[];
    deleteSlideIds: string[];
  };
  /** Secondary sources to cherry-pick slides from */
  secondarySources: SecondarySource[];
  /** Final slide order by SlideEmbedding ID */
  finalSlideOrder: string[];
}
```

## Discretion Recommendations

Based on research of existing patterns:

### 1. LLM Schema Flattening for ModificationPlan
**Recommendation:** Use the same "object with array of flat objects" pattern as `SlideAssemblyLlmSchema`. The `modifications` array contains flat objects (elementId, currentContent, newContent, reason). This is max 2 levels of nesting, which Gemini supports. No further flattening needed.

### 2. DealContext Salesperson Info
**Recommendation:** Keep salesperson info SEPARATE from DealContext. The existing `DeckCustomizations` interface already handles salesperson name/photo. DealContext is about deal/prospect attributes for slide selection. Salesperson info is presentation customization. Different concerns, different lifecycle.

### 3. GenerationBlueprint deckStructureId
**Recommendation:** YES, include `deckStructureId: string`. Traceability is important for debugging and for the HITL UI to link back to the structure editor. No downside.

### 4. String Literal Unions vs Prisma Enums
**Recommendation:** Use `(typeof TOUCH_TYPES)[number]` pattern from existing `deck-structure-key.ts`. Constants.ts `as const` arrays are the established source of truth. Do NOT reference Prisma enums.

### 5. Helper Sub-Types
**Recommendation:** Define `SlideSelectionEntry` (used inside SlideSelectionPlan) and `SecondarySource` (used inside MultiSourcePlan) as named sub-types for clarity. Also define `ModificationEntry` as a named type within the Zod schema inference. Do NOT define utility types beyond what the 6 required types need.

### 6. Where LLM Zod Schemas Live
**Recommendation:** Place `ModificationPlanLlmSchema` in `apps/agent/src/generation/modification-plan-schema.ts`, NOT in `packages/schemas/llm/`. Reasoning: the web UI never needs the Zod schema or GenAI constant for ModificationPlan (it only needs the TypeScript type for display, which can be a simplified summary type in shared). The modification-planner agent is the sole consumer. This follows the established pattern where `DECK_STRUCTURE_SCHEMA` lives in `apps/agent/src/deck-intelligence/` because only the agent uses it.

### 7. SectionSlot.modificationPlan Cross-Package Issue
**Recommendation:** In the shared `SectionSlot`, use `hasModificationPlan: boolean` instead of referencing the full `ModificationPlan` type. The HITL UI only needs to know IF a plan exists (for status display). The agent-side code narrows via its own augmented type that includes the full plan. This avoids the circular dependency entirely.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `z.toJSONSchema()` for GenAI | Parallel `Type.OBJECT` constant | Current codebase pattern | GenAI schema defined manually alongside Zod, not derived. Both must stay in sync. |
| Feature types in feature files | Shared types in `packages/schemas/` | v1.6+ | Cross-package types live in schemas package; feature-only types stay local |
| Zod v3 `.describe()` | Zod v4 `.meta()` | Zod 4.x | Use `.meta({ description: "..." })` for schema descriptions |

## Open Questions

1. **SectionSlot optional fields in shared type**
   - What we know: FR-1.2 specifies `selectedSlideId?`, `sourcePresentationId?`, `modificationPlan?` with `?` notation
   - What's unclear: Whether these should be `T | null` or truly optional (`T | undefined`) in the TypeScript interface
   - Recommendation: Use `T | null` (explicit nullability) rather than `?` (optional). This makes serialization deterministic and aligns with Zod's approach. The SectionSlot starts with all nulls and gets populated through the pipeline stages.

2. **MultiSourcePlan.primarySource nested object**
   - What we know: MultiSourcePlan is agent-only (not LLM-facing), so nesting is fine for TypeScript
   - What's unclear: Whether to inline or extract `PrimarySource` as a named type
   - Recommendation: Inline is fine for a single-use 4-field object. Extract only if reused.

## Sources

### Primary (HIGH confidence)
- `packages/schemas/constants.ts` -- all domain constant arrays and union type patterns
- `packages/schemas/index.ts` -- barrel export pattern
- `packages/schemas/llm/slide-assembly.ts` -- Zod LLM schema pattern with `.meta()`
- `packages/schemas/llm/proposal-copy.ts` -- flat Zod schema example
- `packages/schemas/llm-json-schema.ts` -- zodToLlmJsonSchema utility
- `apps/agent/src/deck-intelligence/deck-structure-schema.ts` -- GenAI Type.OBJECT pattern, TypeScript interface pattern
- `apps/agent/src/deck-intelligence/deck-structure-key.ts` -- TouchType derivation pattern
- `apps/agent/prisma/schema.prisma` -- SlideEmbedding, SlideElement, Template, DeckStructure models

### Secondary (MEDIUM confidence)
- `apps/agent/src/lib/deck-customizer.ts` -- DeckCustomizations interface pattern (salesperson info separation)
- `apps/agent/src/lib/slide-assembly.ts` -- AssemblyParams interface pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all patterns already established in codebase
- Architecture: HIGH -- file placement decided by user, patterns verified against existing code
- Pitfalls: HIGH -- circular dependency risk and Gemini compatibility verified against actual code

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- types-only phase with no external dependencies)
