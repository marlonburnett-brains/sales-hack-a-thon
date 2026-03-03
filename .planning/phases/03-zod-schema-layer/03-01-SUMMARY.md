---
phase: 03-zod-schema-layer
plan: "01"
subsystem: schemas
tags: [zod, json-schema, gemini, typescript, domain-constants]

# Dependency graph
requires:
  - phase: 01-monorepo-foundation
    provides: "packages/schemas workspace package with zod ^4.3.6"
  - phase: 02-content-library-ingestion
    provides: "classify-metadata.ts with domain constants and SlideMetadataSchema"
provides:
  - "13 Zod v4 schemas (10 LLM + 2 app + 1 consolidated) in @lumenalta/schemas"
  - "6 domain constant arrays (INDUSTRIES, FUNNEL_STAGES, CONTENT_TYPES, SLIDE_CATEGORIES, BUYER_PERSONAS, TOUCH_TYPES)"
  - "zodToGeminiSchema() helper for Zod-to-Gemini JSON Schema bridge"
  - "Barrel exports from @lumenalta/schemas for all schemas, types, constants, and helper"
affects: [04-post-call-pipeline, 05-hitl-checkpoint, 07-slides-generation, 09-pre-call-briefing, 03-02-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LLM schema pattern: flat z.object with .meta({ description }) on every field, no transforms/optionals/unions"
    - "zodToGeminiSchema(): z.toJSONSchema() wrapper with $schema stripping for Gemini responseJsonSchema"
    - "Domain constants as readonly tuples (as const) in single source of truth file"
    - "Barrel re-exports from packages/schemas/index.ts with type keyword for TypeScript types"

key-files:
  created:
    - packages/schemas/constants.ts
    - packages/schemas/gemini-schema.ts
    - packages/schemas/llm/transcript-fields.ts
    - packages/schemas/llm/sales-brief.ts
    - packages/schemas/llm/slide-assembly.ts
    - packages/schemas/llm/roi-framing.ts
    - packages/schemas/llm/pager-content.ts
    - packages/schemas/llm/intro-deck-selection.ts
    - packages/schemas/llm/capability-deck-selection.ts
    - packages/schemas/llm/company-research.ts
    - packages/schemas/llm/hypotheses.ts
    - packages/schemas/llm/discovery-questions.ts
    - packages/schemas/llm/slide-metadata.ts
    - packages/schemas/app/interaction-record.ts
    - packages/schemas/app/feedback-signal.ts
  modified:
    - packages/schemas/index.ts
    - apps/agent/src/ingestion/classify-metadata.ts
    - apps/agent/package.json
    - pnpm-lock.yaml

key-decisions:
  - "zodToGeminiSchema is a thin z.toJSONSchema() wrapper, not a schema introspection engine"
  - "All LLM schema fields use .meta({ description }) for Gemini extraction quality"
  - "classify-metadata.ts keeps hand-crafted GEMINI_RESPONSE_SCHEMA with Type enum (Phase 2 pattern preserved)"
  - "priority field in DiscoveryQuestionsLlmSchema uses string type (not enum) for Gemini safety"

patterns-established:
  - "LLM schema: z.object with required fields only, .meta({ description }), max 2 levels of nesting"
  - "App schema: z.object with z.record(z.unknown()) for JSON blobs, z.enum for constrained values"
  - "Schema organization: packages/schemas/llm/ for Gemini-safe, packages/schemas/app/ for internal"
  - "Import pattern: import { SchemaName, type TypeName, CONSTANT } from '@lumenalta/schemas'"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 3 Plan 01: Zod Schema Layer Summary

**13 Zod v4 schemas with zodToGeminiSchema bridge, domain constants consolidated from Phase 2, barrel-exported from @lumenalta/schemas**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T23:10:38Z
- **Completed:** 2026-03-03T23:14:56Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Defined all 13 Zod v4 schemas: 10 LLM schemas (Gemini-safe, flat, with field descriptions), 2 app schemas (interaction tracking, feedback signals), and 1 consolidated from Phase 2 (SlideMetadataSchema)
- Created zodToGeminiSchema() helper as a thin z.toJSONSchema() wrapper that strips $schema and inherits fail-fast behavior on transforms/optionals/unions
- Consolidated 6 domain constant arrays from classify-metadata.ts into packages/schemas/constants.ts as the single source of truth
- Updated classify-metadata.ts to import from @lumenalta/schemas, removed zod-to-json-schema dependency, added validate-schemas script entry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create domain constants, zodToGeminiSchema helper, and all 13 schema files** - `4cee07d` (feat)
2. **Task 2: Wire barrel exports and update classify-metadata.ts imports** - `35a31b6` (refactor)

## Files Created/Modified

- `packages/schemas/constants.ts` - Single source of truth for 6 domain constant arrays (INDUSTRIES, FUNNEL_STAGES, etc.)
- `packages/schemas/gemini-schema.ts` - zodToGeminiSchema() helper wrapping z.toJSONSchema() with $schema stripping
- `packages/schemas/llm/transcript-fields.ts` - TranscriptFieldsLlmSchema: 6 required string fields for call transcript extraction
- `packages/schemas/llm/sales-brief.ts` - SalesBriefLlmSchema: comprehensive sales brief with use cases array
- `packages/schemas/llm/slide-assembly.ts` - SlideAssemblyLlmSchema: ordered slides with bullets, notes, and source refs
- `packages/schemas/llm/roi-framing.ts` - ROIFramingLlmSchema: ROI outcomes and value hypotheses per use case
- `packages/schemas/llm/pager-content.ts` - PagerContentLlmSchema: Touch 1 one-pager content structure
- `packages/schemas/llm/intro-deck-selection.ts` - IntroDeckSelectionLlmSchema: Touch 2 slide selection and ordering
- `packages/schemas/llm/capability-deck-selection.ts` - CapabilityDeckSelectionLlmSchema: Touch 3 capability deck selection
- `packages/schemas/llm/company-research.ts` - CompanyResearchLlmSchema: pre-call company research structure
- `packages/schemas/llm/hypotheses.ts` - HypothesesLlmSchema: pre-call value hypotheses per buyer role
- `packages/schemas/llm/discovery-questions.ts` - DiscoveryQuestionsLlmSchema: prioritized discovery questions
- `packages/schemas/llm/slide-metadata.ts` - SlideMetadataSchema: consolidated from Phase 2 classify-metadata.ts
- `packages/schemas/app/interaction-record.ts` - InteractionRecordSchema: HITL interaction tracking
- `packages/schemas/app/feedback-signal.ts` - FeedbackSignalSchema: feedback loop signal tracking
- `packages/schemas/index.ts` - Barrel exports for all 13 schemas, 6 constants, and helper
- `apps/agent/src/ingestion/classify-metadata.ts` - Updated imports from @lumenalta/schemas, removed local constant/schema declarations
- `apps/agent/package.json` - Removed zod-to-json-schema, added validate-schemas script
- `pnpm-lock.yaml` - Updated after dependency removal

## Decisions Made

- **zodToGeminiSchema as thin wrapper:** Implemented as a minimal z.toJSONSchema() wrapper that strips $schema, rather than a full schema introspection engine. Zod v4's native JSON Schema support and @google/genai's responseJsonSchema make deep introspection unnecessary.
- **Preserved Phase 2 Gemini call pattern:** classify-metadata.ts keeps the hand-crafted GEMINI_RESPONSE_SCHEMA with Type enum. Only the constants and Zod schema were consolidated. The Gemini call pattern migration is optional and not required in this plan.
- **priority as string, not enum:** DiscoveryQuestionsLlmSchema uses `z.string()` for priority field with description guidance ("high", "medium", "low") rather than `z.enum()` for maximum Gemini compatibility.
- **20 runtime exports:** Barrel exports include 6 constants + 1 helper + 13 schemas = 20 runtime values. The 13 TypeScript types are compile-time only (erased at runtime).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 13 schemas are defined and barrel-exported from @lumenalta/schemas, ready for Plan 03-02 (Gemini round-trip validation)
- zodToGeminiSchema() helper ready for use with Gemini's responseJsonSchema config property
- validate-schemas script entry in apps/agent/package.json ready for Plan 03-02 implementation
- classify-metadata.ts imports from shared package, no local constant duplicates

## Self-Check: PASSED

- All 16 created files verified on disk
- Commit 4cee07d (Task 1) verified in git log
- Commit 35a31b6 (Task 2) verified in git log

---
*Phase: 03-zod-schema-layer*
*Completed: 2026-03-03*
