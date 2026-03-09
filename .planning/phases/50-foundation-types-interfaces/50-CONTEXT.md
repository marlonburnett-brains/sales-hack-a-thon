# Phase 50: Foundation Types & Interfaces - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Define shared TypeScript types and Zod schemas for the structure-driven generation pipeline. Every generation pipeline component (Phases 51-57) imports these types. No implementation logic — types and schemas only.

</domain>

<decisions>
## Implementation Decisions

### Module placement
- Hybrid split: shared types in `packages/schemas/generation/`, agent-only types in `apps/agent/src/generation/`
- Shared types (needed by both web HITL UI and agent): GenerationBlueprint, SectionSlot, DealContext, SlideSelectionPlan
- Agent-only types (execution details): MultiSourcePlan, ModificationPlan
- `apps/agent/src/generation/` holds types only for Phase 50 — implementation files land in later phases wherever makes sense
- Shared types exported via existing `packages/schemas/index.ts` barrel file (import as `@repo/schemas`)

### Zod vs TypeScript scope
- Only LLM-facing types get Zod schemas (ModificationPlan for the modification-planner agent)
- All other types (GenerationBlueprint, SectionSlot, SlideSelectionPlan, MultiSourcePlan, DealContext) are plain TypeScript interfaces
- Google GenAI schema constant (Type.OBJECT) defined alongside the Zod schema, not derived at runtime — matches existing `DECK_STRUCTURE_SCHEMA` pattern in `deck-structure-schema.ts`

### DealContext richness
- Lean context: dealId, companyName, industry, pillars, persona, funnelStage, priorTouchSlideIds[]
- priorTouchSlideIds is a simple string[] (IDs only, no touch-type tagging)
- No transcript extraction fields, no interaction history — downstream phases resolve additional data on demand

### Type integration with existing models
- SectionSlot holds candidateSlideIds as string[] — downstream phases resolve to full SlideEmbedding records when needed
- MultiSourcePlan includes both templateId and presentationId for source presentations — enables internal traceability and direct Google API usage
- No Prisma-generated types imported directly into pipeline types — keeps generation pipeline decoupled from DB layer

### Claude's Discretion
- LLM schema flattening strategy for ModificationPlan (must be flat per NFR-5 Gemini compatibility)
- Whether DealContext includes salesperson info or keeps it separate (existing DeckCustomizations pattern)
- Whether GenerationBlueprint includes deckStructureId for traceability
- String literal union types vs Prisma enums for TypeScript interfaces (follow existing constants.ts pattern)
- Whether to define helper/utility sub-types beyond the 6 required FR-1 types
- Where LLM-facing Zod schemas live (packages/schemas/llm/ vs agent generation/ dir) based on cross-package usage

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The FR-1 requirements are well-specified with exact type names and fields.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/constants.ts`: TOUCH_TYPES, ARTIFACT_TYPES, INDUSTRIES, FUNNEL_STAGES, BUYER_PERSONAS — source of truth for union type values
- `packages/schemas/llm/slide-assembly.ts`: Existing LLM schema pattern (Zod + z.infer) to follow
- `apps/agent/src/deck-intelligence/deck-structure-schema.ts`: GenAI structured output schema pattern (Type.OBJECT definition alongside TypeScript types)
- `apps/agent/src/deck-intelligence/deck-structure-key.ts`: DeckStructureKey type + resolution utilities — relevant for blueprint resolver input

### Established Patterns
- LLM schemas: Zod in `packages/schemas/llm/`, flat objects, `.meta()` descriptions for GenAI schema generation
- Feature types: Defined alongside implementations (e.g., DeckCustomizations in `deck-customizer.ts`, AssemblyParams in `slide-assembly.ts`)
- Constants: Readonly const arrays in `packages/schemas/constants.ts`, consumed by schemas and app code
- Barrel exports: Single `packages/schemas/index.ts` re-exports all public types

### Integration Points
- `DeckStructure.structureJson` (Prisma model): Source data for blueprint resolver — structureJson contains sections with slideIds that map to SlideEmbedding records
- `SlideEmbedding` (Prisma model): ~20 fields including vector, classificationJson, confidence, templateId — SectionSlot references by ID only
- `SlideElement` (Prisma model): Per-element structural data — used by ModificationPlan to reference specific elements
- `Template.presentationId` (Prisma model): Maps templateId to Google Slides presentationId — MultiSourcePlan uses both IDs
- Existing assembly types in `deck-assembly.ts`, `slide-assembly.ts`, `deck-customizer.ts` — new types complement but don't replace these

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 50-foundation-types-interfaces*
*Context gathered: 2026-03-09*
