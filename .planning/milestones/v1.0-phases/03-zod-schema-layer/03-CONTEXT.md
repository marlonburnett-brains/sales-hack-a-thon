# Phase 3: Zod Schema Layer and Gemini Validation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Define and validate all Zod v4 schemas (including Touch 1-3 content selection schemas, interaction tracking schemas, and Touch 4 pipeline schemas) against the live Gemini API in isolation so that schema rejection errors are caught before any agent logic is built on top of them. Consolidate existing domain constants from Phase 2 into the shared schemas package.

Building agent logic, workflow steps, UI forms, or RAG retrieval is out of scope — this phase delivers validated schemas and the Gemini bridge utility only.

</domain>

<decisions>
## Implementation Decisions

### Schema organization
- Subdirectory separation: `packages/schemas/llm/` for flat Gemini-safe schemas, `packages/schemas/app/` for application schemas with transforms
- Barrel exports from `packages/schemas/index.ts` — consuming apps import via `import { SalesBriefLlmSchema, INDUSTRIES } from '@lumenalta/schemas'`
- Consolidate shared domain constants (INDUSTRIES, FUNNEL_STAGES, BUYER_PERSONAS, CONTENT_TYPES, SLIDE_CATEGORIES, TOUCH_TYPES) from `apps/agent/src/ingestion/classify-metadata.ts` into `packages/schemas/constants.ts` as single source of truth
- Move existing `SlideMetadataSchema` from `classify-metadata.ts` into `packages/schemas` — it's a core domain schema referenced by Touch 1-3 (Phase 4) and RAG retrieval (Phase 7)
- Update `classify-metadata.ts` to import from `@lumenalta/schemas` after consolidation

### Gemini schema bridge
- Build a `zodToGeminiSchema()` helper utility in `packages/schemas`
- Helper converts flat Zod v4 schemas to Gemini's `Type` format (objects, arrays, enums, strings, numbers)
- Throw at build time if helper encounters unsupported Zod features (unions, optionals, transforms, defaults) — fail fast, don't silently drop
- Returns the raw Gemini-compatible JSON Schema object only — no coupling to `@google/genai` library
- This replaces the hand-crafted Gemini schema pattern from Phase 2 and establishes the standard for all future schemas

### Validation test approach
- Standalone validation scripts in `apps/agent/src/validation/` (agent app has Gemini credentials)
- Round-trip validation: send realistic domain prompt with schema to Gemini, parse response with Zod schema — both must succeed
- Realistic domain prompts that mirror actual usage (sample transcripts for TranscriptFields, sample extracted fields for SalesBrief, etc.)
- Run via pnpm script in apps/agent (e.g., `pnpm validate-schemas`)
- Exit non-zero on any schema failure

### Schema content scope
- All ~12 schemas defined and validated upfront in Phase 3:
  - **LLM schemas** (Gemini-validated): TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, ROIFramingSchema, PagerContentSchema, IntroDeckSelectionSchema, CapabilityDeckSelectionSchema, CompanyResearchSchema, HypothesesSchema, DiscoveryQuestionsSchema
  - **App schemas** (Zod-only, no Gemini validation): InteractionRecordSchema, FeedbackSignalSchema
  - **Consolidated from Phase 2**: SlideMetadataSchema (moves to shared package)
- TranscriptFieldsSchema: all 6 fields (CustomerContext, BusinessOutcomes, Constraints, Stakeholders, Timeline, Budget) are required strings — empty string if not found in transcript; Phase 5 flags empty strings as missing fields
- SalesBriefSchema: solution pillars as open `string[]` — not constrained to an enum; downstream validation against AtlusAI-known pillar list happens in later phases
- Interaction tracking schemas are app-only (database records, not LLM outputs) — validated by Prisma + Zod, not Gemini

### Claude's Discretion
- Exact field definitions for each schema (field names, nesting structure, description strings)
- zodToGeminiSchema helper implementation details (how to introspect Zod 4.x internals)
- Realistic test prompt content (sample transcript text, sample brief inputs)
- Whether to split validation scripts per schema group or run all in one script
- How to handle the `@google/genai` Type import in the helper (return plain objects that match the Type format vs. use the Type enum directly)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/index.ts`: Empty placeholder with `zod ^4.3.6` dependency — ready to populate
- `apps/agent/src/ingestion/classify-metadata.ts`: Working Gemini structured output integration with Zod validation, domain constants (INDUSTRIES, FUNNEL_STAGES, etc.), and hand-crafted Gemini JSON Schema — reference implementation for the zodToGeminiSchema helper
- `apps/agent/src/lib/google-auth.ts`: Google auth factory — validation scripts can reuse for Gemini API access
- `apps/agent/src/env.ts`: T3 Env validation with existing `GEMINI_API_KEY` — validation scripts use this

### Established Patterns
- Dual schema pattern: Zod schema for TypeScript types + separate Gemini JSON Schema for structured output (Phase 2 established this; Phase 3 systematizes it with the helper)
- `zod-to-json-schema` does NOT support Zod 4.x — confirmed in Phase 2, hence the helper approach
- T3 Env (`@t3-oss/env-core`) for environment variable validation
- pnpm workspace with Turborepo task orchestration
- `@google/genai` SDK with `responseMimeType: "application/json"` + `responseSchema` config pattern

### Integration Points
- `packages/schemas` → imported by both `apps/web` and `apps/agent` via `@lumenalta/schemas`
- `apps/agent/src/ingestion/classify-metadata.ts` → must be updated to import from `@lumenalta/schemas` after constants/schema consolidation
- Validation scripts in `apps/agent/src/validation/` → use Gemini API key from env, schemas from `@lumenalta/schemas`

</code_context>

<specifics>
## Specific Ideas

- The zodToGeminiSchema helper should handle the 80% case (flat objects, arrays, enums, strings, numbers) and throw on anything else — keep it simple
- Phase 2's `classify-metadata.ts` is the reference implementation for how Gemini structured output works in this codebase — the helper essentially automates what was done manually there
- Gemini model for validation: use the same model the pipeline will use (gemini-2.5-flash) to ensure schema compatibility

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-zod-schema-layer*
*Context gathered: 2026-03-03*
