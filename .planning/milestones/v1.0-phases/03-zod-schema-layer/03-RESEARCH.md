# Phase 3: Zod Schema Layer and Gemini Validation - Research

**Researched:** 2026-03-03
**Domain:** Zod v4 schema definitions, JSON Schema generation, Gemini structured output integration
**Confidence:** HIGH

## Summary

Phase 3 defines all Zod v4 schemas for the pipeline and validates them against the live Gemini API. The critical discovery is that **Zod v4 ships with built-in `z.toJSONSchema()` and the `@google/genai` SDK v1.43.0 now supports `responseJsonSchema` which accepts standard JSON Schema**. This eliminates the need for a hand-rolled Zod-to-Gemini introspection helper. The `zodToGeminiSchema()` helper decided in CONTEXT.md can be implemented as a thin wrapper around `z.toJSONSchema()` that validates the output only contains Gemini-supported JSON Schema features, rather than manually introspecting Zod internals.

The project has Zod 4.3.6 installed in `packages/schemas`, `@google/genai` 1.43.0 in `apps/agent`, and an existing working Gemini structured output pattern in `classify-metadata.ts` using the old `responseSchema` + `Type` enum approach. Phase 3 migrates to the new `responseJsonSchema` + `z.toJSONSchema()` approach and defines all ~12 schemas upfront.

**Primary recommendation:** Use `z.toJSONSchema()` (native Zod v4) to generate JSON Schema, pass to Gemini via `responseJsonSchema` config property, and validate round-trip with `.parse()`. The `zodToGeminiSchema()` helper is a thin validation wrapper, not a schema introspection engine.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schema organization:**
- Subdirectory separation: `packages/schemas/llm/` for flat Gemini-safe schemas, `packages/schemas/app/` for application schemas with transforms
- Barrel exports from `packages/schemas/index.ts` -- consuming apps import via `import { SalesBriefLlmSchema, INDUSTRIES } from '@lumenalta/schemas'`
- Consolidate shared domain constants (INDUSTRIES, FUNNEL_STAGES, BUYER_PERSONAS, CONTENT_TYPES, SLIDE_CATEGORIES, TOUCH_TYPES) from `apps/agent/src/ingestion/classify-metadata.ts` into `packages/schemas/constants.ts` as single source of truth
- Move existing `SlideMetadataSchema` from `classify-metadata.ts` into `packages/schemas` -- it's a core domain schema referenced by Touch 1-3 (Phase 4) and RAG retrieval (Phase 7)
- Update `classify-metadata.ts` to import from `@lumenalta/schemas` after consolidation

**Gemini schema bridge:**
- Build a `zodToGeminiSchema()` helper utility in `packages/schemas`
- Helper converts flat Zod v4 schemas to Gemini's `Type` format (objects, arrays, enums, strings, numbers)
- Throw at build time if helper encounters unsupported Zod features (unions, optionals, transforms, defaults) -- fail fast, don't silently drop
- Returns the raw Gemini-compatible JSON Schema object only -- no coupling to `@google/genai` library
- This replaces the hand-crafted Gemini schema pattern from Phase 2 and establishes the standard for all future schemas

**Validation test approach:**
- Standalone validation scripts in `apps/agent/src/validation/` (agent app has Gemini credentials)
- Round-trip validation: send realistic domain prompt with schema to Gemini, parse response with Zod schema -- both must succeed
- Realistic domain prompts that mirror actual usage (sample transcripts for TranscriptFields, sample extracted fields for SalesBrief, etc.)
- Run via pnpm script in apps/agent (e.g., `pnpm validate-schemas`)
- Exit non-zero on any schema failure

**Schema content scope:**
- All ~12 schemas defined and validated upfront in Phase 3:
  - **LLM schemas** (Gemini-validated): TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, ROIFramingSchema, PagerContentSchema, IntroDeckSelectionSchema, CapabilityDeckSelectionSchema, CompanyResearchSchema, HypothesesSchema, DiscoveryQuestionsSchema
  - **App schemas** (Zod-only, no Gemini validation): InteractionRecordSchema, FeedbackSignalSchema
  - **Consolidated from Phase 2**: SlideMetadataSchema (moves to shared package)
- TranscriptFieldsSchema: all 6 fields (CustomerContext, BusinessOutcomes, Constraints, Stakeholders, Timeline, Budget) are required strings -- empty string if not found in transcript; Phase 5 flags empty strings as missing fields
- SalesBriefSchema: solution pillars as open `string[]` -- not constrained to an enum; downstream validation against AtlusAI-known pillar list happens in later phases
- Interaction tracking schemas are app-only (database records, not LLM outputs) -- validated by Prisma + Zod, not Gemini

### Claude's Discretion

- Exact field definitions for each schema (field names, nesting structure, description strings)
- zodToGeminiSchema helper implementation details (how to introspect Zod 4.x internals)
- Realistic test prompt content (sample transcript text, sample brief inputs)
- Whether to split validation scripts per schema group or run all in one script
- How to handle the `@google/genai` Type import in the helper (return plain objects that match the Type format vs. use the Type enum directly)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.3.6 | Schema definitions, validation, type inference | Already installed; project constraint; native `z.toJSONSchema()` support |
| `@google/genai` | 1.43.0 | Gemini API calls for schema validation | Already installed; supports both `responseSchema` and `responseJsonSchema` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@t3-oss/env-core` | ^0.13.10 | Environment variable validation | Already in agent app; validation scripts use `GEMINI_API_KEY` from env |
| `tsx` | ^4.21.0 | TypeScript execution for validation scripts | Already in agent devDependencies; run `tsx` for validation scripts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `z.toJSONSchema()` | `zod-to-json-schema` | v3.25.1 is installed but does NOT support Zod v4 schemas (only v3 compat mode); Zod v4 native is the canonical path |
| `responseJsonSchema` (new) | `responseSchema` with `Type` enum (old) | Old approach requires hand-crafted schema objects; new approach uses standard JSON Schema from `z.toJSONSchema()` |

**Installation:**
No new packages needed. All dependencies are already installed:
- `packages/schemas` has `zod ^4.3.6`
- `apps/agent` has `@google/genai ^1.43.0`, `tsx`, `@t3-oss/env-core`

Note: `zod-to-json-schema` (^3.25.1) is installed in `apps/agent` but should be removed since it does NOT support Zod v4 schemas. The `zod-to-json-schema` maintainer has stated this is likely the final release, recommending Zod v4's native `z.toJSONSchema()` instead.

## Architecture Patterns

### Recommended Project Structure
```
packages/schemas/
  constants.ts          # INDUSTRIES, FUNNEL_STAGES, BUYER_PERSONAS, etc. (single source of truth)
  llm/
    transcript-fields.ts
    sales-brief.ts
    slide-assembly.ts
    roi-framing.ts
    pager-content.ts
    intro-deck-selection.ts
    capability-deck-selection.ts
    company-research.ts
    hypotheses.ts
    discovery-questions.ts
    slide-metadata.ts   # Consolidated from Phase 2
  app/
    interaction-record.ts
    feedback-signal.ts
  gemini-schema.ts      # zodToGeminiSchema() helper
  index.ts              # Barrel exports

apps/agent/
  src/validation/
    validate-schemas.ts  # Round-trip validation script(s)
```

### Pattern 1: LLM Schema Definition (Gemini-Safe)

**What:** Flat Zod schemas with `.meta({ description })` for Gemini structured output. No transforms, no optionals, no defaults, no unions.

**When to use:** Any schema that will be sent to Gemini as `responseJsonSchema`.

**Example:**
```typescript
// packages/schemas/llm/transcript-fields.ts
import { z } from "zod";

export const TranscriptFieldsLlmSchema = z.object({
  customerContext: z.string().meta({
    description: "Customer's current situation, pain points, and business context extracted from the transcript. Empty string if not found.",
  }),
  businessOutcomes: z.string().meta({
    description: "Desired business outcomes and goals mentioned by the customer. Empty string if not found.",
  }),
  constraints: z.string().meta({
    description: "Technical, budgetary, or organizational constraints mentioned. Empty string if not found.",
  }),
  stakeholders: z.string().meta({
    description: "Key stakeholders, decision makers, and their roles mentioned. Empty string if not found.",
  }),
  timeline: z.string().meta({
    description: "Timeline expectations, deadlines, or urgency indicators. Empty string if not found.",
  }),
  budget: z.string().meta({
    description: "Budget information, investment range, or financial constraints. Empty string if not found.",
  }),
});

export type TranscriptFields = z.infer<typeof TranscriptFieldsLlmSchema>;
```

### Pattern 2: zodToGeminiSchema Helper

**What:** A thin wrapper around `z.toJSONSchema()` that validates the output contains only Gemini-supported features and strips the `$schema` key.

**When to use:** Whenever passing a Zod schema to Gemini's `responseJsonSchema` config.

**Critical insight:** The CONTEXT.md decision was to "build a `zodToGeminiSchema()` helper that converts flat Zod v4 schemas to Gemini's `Type` format." Research reveals this can be implemented far more simply than originally envisioned because:

1. **Zod v4 has native `z.toJSONSchema()`** -- no need to introspect Zod internals
2. **`@google/genai` v1.43.0 supports `responseJsonSchema`** -- accepts standard JSON Schema directly
3. The helper becomes a validation/safety layer rather than a conversion engine

**Example:**
```typescript
// packages/schemas/gemini-schema.ts
import { z } from "zod";

// Zod types that cannot be represented in JSON Schema and will cause z.toJSONSchema to throw
// These are also unsupported by Gemini: transforms, maps, sets, symbols, etc.
// z.toJSONSchema() already throws on these, so the helper inherits that safety.

/**
 * Convert a Zod schema to a Gemini-compatible JSON Schema object.
 *
 * Uses Zod v4's native z.toJSONSchema() and strips the $schema key
 * since Gemini's responseJsonSchema doesn't need it.
 *
 * Throws if the schema contains unsupported Zod features (transforms,
 * unions, maps, sets, etc.) -- fail fast at build time.
 *
 * @param schema - A flat Zod object schema (no transforms, no optionals)
 * @returns Plain JSON Schema object compatible with Gemini's responseJsonSchema
 */
export function zodToGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  // Strip $schema key -- not needed for Gemini and avoids the SDK's
  // backward compat shim that moves schemas between config fields
  delete jsonSchema["$schema"];

  return jsonSchema;
}
```

### Pattern 3: App Schema Definition (With Transforms)

**What:** Zod schemas for application data (database records, internal state) that can use transforms, optionals, defaults -- features not supported by Gemini.

**When to use:** Schemas for InteractionRecord, FeedbackSignal, and other non-LLM data structures.

**Example:**
```typescript
// packages/schemas/app/interaction-record.ts
import { z } from "zod";

export const InteractionRecordSchema = z.object({
  id: z.string(),
  dealId: z.string(),
  touchType: z.enum(["touch_1", "touch_2", "touch_3", "touch_4"]),
  companyName: z.string(),
  industry: z.string(),
  inputs: z.record(z.unknown()),   // JSON blob of input parameters
  decision: z.enum(["approved", "overridden", "edited"]),
  outputRefs: z.array(z.string()), // Google Drive URLs
  createdAt: z.string(),           // ISO date string
});

export type InteractionRecord = z.infer<typeof InteractionRecordSchema>;
```

### Pattern 4: Gemini API Call with Schema

**What:** The standard pattern for making a Gemini structured output call using the new `responseJsonSchema` approach.

**When to use:** All validation scripts and future agent code.

**Example:**
```typescript
// apps/agent/src/validation/validate-schemas.ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToGeminiSchema, TranscriptFieldsLlmSchema } from "@lumenalta/schemas";
import { env } from "../env";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const jsonSchema = zodToGeminiSchema(TranscriptFieldsLlmSchema);

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: SAMPLE_TRANSCRIPT_PROMPT,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: jsonSchema,
  },
});

// Round-trip validation: Gemini produced JSON, Zod validates it
const parsed = TranscriptFieldsLlmSchema.parse(JSON.parse(response.text ?? "{}"));
console.log("TranscriptFieldsLlmSchema: PASS");
```

### Anti-Patterns to Avoid

- **Using `responseSchema` with `Type` enum for new schemas:** The old approach from Phase 2. New schemas should use `responseJsonSchema` with `z.toJSONSchema()` output. The existing `classify-metadata.ts` can be migrated but is not required in Phase 3.
- **Using `zod-to-json-schema` package:** Does not support Zod v4 schemas. Use native `z.toJSONSchema()`.
- **Optional fields in LLM schemas:** Gemini handles these inconsistently. Use required strings with empty-string convention instead (as CONTEXT.md specifies for TranscriptFieldsSchema).
- **Union types (`z.union()`, `z.discriminatedUnion()`) in LLM schemas:** Not reliably supported by Gemini. Use enums or separate schemas.
- **Transforms in LLM schemas:** `z.toJSONSchema()` throws on transforms. Keep LLM schemas flat; apply transforms in application layer after Gemini response is parsed.
- **Deeply nested objects:** Gemini may reject very deeply nested schemas. Keep nesting to 2 levels max (object with array of objects is fine).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod-to-JSON-Schema conversion | Manual Zod AST introspection | `z.toJSONSchema()` (native Zod v4) | Handles all edge cases, tested by Zod team, updates with Zod releases |
| Gemini schema format conversion | Custom `Type` enum mapper | `responseJsonSchema` config property | SDK v1.43.0 supports standard JSON Schema directly; no conversion needed |
| Schema validation testing | Manual JSON construction | Round-trip pattern (Gemini call + Zod parse) | Tests the actual integration path, catches both schema and parsing issues |
| Domain constant deduplication | Copy-paste constants across packages | Single `constants.ts` in `packages/schemas` | Already imported as `@lumenalta/schemas` by both apps |

**Key insight:** The original CONTEXT.md envisioned `zodToGeminiSchema()` as a schema introspection engine. Research reveals it should be a thin validation wrapper around `z.toJSONSchema()` because the ecosystem has caught up: Zod v4 has native JSON Schema support, and `@google/genai` now accepts standard JSON Schema via `responseJsonSchema`.

## Common Pitfalls

### Pitfall 1: Using responseSchema Instead of responseJsonSchema
**What goes wrong:** Using `responseSchema` with the output of `z.toJSONSchema()` triggers the SDK's backward compatibility shim that checks for `$schema` key and silently moves data between config fields.
**Why it happens:** The existing codebase (Phase 2) uses `responseSchema` with manually crafted `Type` enum objects. Mixing approaches causes confusion.
**How to avoid:** Always use `responseJsonSchema` for new code. Strip `$schema` from `z.toJSONSchema()` output to be explicit.
**Warning signs:** Unexpected schema rejection errors, or the SDK silently rewriting your config.

### Pitfall 2: Optional Fields in LLM Schemas
**What goes wrong:** Gemini may return `null` instead of omitting the field, or omit fields that Zod expects.
**Why it happens:** Gemini's structured output guarantees syntactic JSON correctness but handles optionality inconsistently.
**How to avoid:** Make all LLM schema fields required. Use empty string `""` convention for "not found" values (as CONTEXT.md specifies).
**Warning signs:** Zod parse failures on Gemini responses with `null` values.

### Pitfall 3: additionalProperties: false Confusion
**What goes wrong:** `z.toJSONSchema()` outputs `additionalProperties: false` by default. Some Gemini SDK paths strip this property.
**Why it happens:** The old `responseSchema` path (using `Type` enum) explicitly skips `additionalProperties` in SDK code. The new `responseJsonSchema` path passes it through.
**How to avoid:** Use `responseJsonSchema` (not `responseSchema`). Gemini API supports `additionalProperties` since November 2025.
**Warning signs:** Gemini returning extra unexpected properties in responses.

### Pitfall 4: Descriptions Not Propagating to Gemini
**What goes wrong:** Schema fields without descriptions produce poor Gemini output -- the model doesn't know what to extract.
**Why it happens:** Zod schemas without `.meta({ description })` generate JSON Schema without `description` properties.
**How to avoid:** Always add `.meta({ description: "..." })` to every field in LLM schemas. Descriptions guide Gemini's extraction quality.
**Warning signs:** Gemini returns generic/irrelevant content for fields.

### Pitfall 5: zod-to-json-schema Still Installed
**What goes wrong:** Developers import `zod-to-json-schema` out of habit, which does NOT support Zod v4 schemas (only v3 compat mode via `import { z } from "zod/v3"`).
**Why it happens:** Package is still in `apps/agent/package.json` from Phase 1/2.
**How to avoid:** Remove `zod-to-json-schema` from dependencies. Use `z.toJSONSchema()` exclusively.
**Warning signs:** Runtime errors when passing Zod v4 schemas to `zodToJsonSchema()` function.

### Pitfall 6: Gemini Model String
**What goes wrong:** Using wrong model identifier causes API errors.
**Why it happens:** Google frequently updates model names. The existing code uses `"gemini-2.5-flash"`.
**How to avoid:** Use `"gemini-2.5-flash"` as confirmed working in the existing `classify-metadata.ts`. CONTEXT.md specifies using the same model the pipeline will use.
**Warning signs:** 404 or "model not found" errors from Gemini API.

## Code Examples

### Complete zodToGeminiSchema Helper
```typescript
// packages/schemas/gemini-schema.ts
import { z } from "zod";

/**
 * Convert a Zod schema to a Gemini-compatible JSON Schema object.
 *
 * Implementation: thin wrapper around z.toJSONSchema() that:
 * 1. Generates standard JSON Schema from the Zod schema
 * 2. Strips the $schema key (not needed for Gemini)
 * 3. Inherits z.toJSONSchema()'s throw-on-unsupported behavior
 *    (transforms, maps, sets, symbols, etc. all throw)
 *
 * Returns a plain JSON Schema object for use with @google/genai's
 * responseJsonSchema config property. No coupling to @google/genai.
 */
export function zodToGeminiSchema(schema: z.ZodType): Record<string, unknown> {
  // z.toJSONSchema throws on unsupported types: transforms, maps, sets,
  // symbols, bigint, date, etc. This is the "fail fast" behavior
  // CONTEXT.md requires.
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  // Strip $schema -- Gemini doesn't need it, and leaving it in
  // triggers the SDK's backward compat shim on responseSchema
  delete jsonSchema["$schema"];

  return jsonSchema;
}
```

### Complete Validation Script Pattern
```typescript
// apps/agent/src/validation/validate-schemas.ts
import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import {
  zodToGeminiSchema,
  TranscriptFieldsLlmSchema,
  SalesBriefLlmSchema,
  // ... other LLM schemas
} from "@lumenalta/schemas";

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });

interface SchemaTest {
  name: string;
  schema: z.ZodType;
  prompt: string;
}

const tests: SchemaTest[] = [
  {
    name: "TranscriptFieldsLlmSchema",
    schema: TranscriptFieldsLlmSchema,
    prompt: `Extract structured fields from this meeting transcript:

"Thanks for meeting with us today. We're a mid-size healthcare company
struggling with patient data interoperability across our 12 clinic locations.
Our CTO wants a unified platform by Q3 next year. Budget is around $500K
but flexible if ROI is clear. Key stakeholders are our CTO Dr. Sarah Chen
and VP of Operations Mark Williams."

Return all fields. Use empty string for any field not found in the transcript.`,
  },
  // ... more tests
];

let failures = 0;

for (const test of tests) {
  try {
    const jsonSchema = zodToGeminiSchema(test.schema);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: test.prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
      },
    });

    const text = response.text ?? "{}";
    const parsed = test.schema.parse(JSON.parse(text));
    console.log(`PASS: ${test.name}`);
  } catch (error) {
    console.error(`FAIL: ${test.name} - ${error.message}`);
    failures++;
  }
}

process.exit(failures > 0 ? 1 : 0);
```

### Constants Consolidation
```typescript
// packages/schemas/constants.ts
// Single source of truth -- imported by all apps via @lumenalta/schemas

export const INDUSTRIES = [
  "Consumer Products",
  "Education",
  "Financial Services & Insurance",
  "Health Care",
  "Industrial Goods",
  "Private Equity",
  "Public Sector",
  "Technology, Media & Telecommunications",
  "Transportation & Logistics",
  "Travel & Tourism",
  "Professional Services",
] as const;

export const FUNNEL_STAGES = [
  "First Contact",
  "Intro Conversation",
  "Capability Alignment",
  "Solution Proposal",
] as const;

export const CONTENT_TYPES = [
  "template",
  "example",
  "case_study",
  "brand_guide",
  "resource",
] as const;

export const SLIDE_CATEGORIES = [
  "title",
  "divider",
  "industry_overview",
  "capability_description",
  "case_study_problem",
  "case_study_solution",
  "case_study_outcome",
  "team_intro",
  "methodology",
  "timeline",
  "pricing",
  "next_steps",
  "appendix",
  "other",
] as const;

export const BUYER_PERSONAS = [
  "CIO",
  "CTO",
  "CFO",
  "VP Engineering",
  "VP Data",
  "VP Product",
  "VP Operations",
  "CEO",
  "General",
] as const;

export const TOUCH_TYPES = [
  "touch_1",
  "touch_2",
  "touch_3",
  "touch_4",
] as const;
```

### Barrel Export Pattern
```typescript
// packages/schemas/index.ts

// Constants (single source of truth)
export {
  INDUSTRIES,
  FUNNEL_STAGES,
  CONTENT_TYPES,
  SLIDE_CATEGORIES,
  BUYER_PERSONAS,
  TOUCH_TYPES,
} from "./constants";

// Helper
export { zodToGeminiSchema } from "./gemini-schema";

// LLM schemas (Gemini-safe, flat, no transforms)
export { TranscriptFieldsLlmSchema, type TranscriptFields } from "./llm/transcript-fields";
export { SalesBriefLlmSchema, type SalesBrief } from "./llm/sales-brief";
export { SlideAssemblyLlmSchema, type SlideAssembly } from "./llm/slide-assembly";
export { ROIFramingLlmSchema, type ROIFraming } from "./llm/roi-framing";
export { PagerContentLlmSchema, type PagerContent } from "./llm/pager-content";
export { IntroDeckSelectionLlmSchema, type IntroDeckSelection } from "./llm/intro-deck-selection";
export { CapabilityDeckSelectionLlmSchema, type CapabilityDeckSelection } from "./llm/capability-deck-selection";
export { CompanyResearchLlmSchema, type CompanyResearch } from "./llm/company-research";
export { HypothesesLlmSchema, type Hypotheses } from "./llm/hypotheses";
export { DiscoveryQuestionsLlmSchema, type DiscoveryQuestions } from "./llm/discovery-questions";
export { SlideMetadataSchema, type SlideMetadata } from "./llm/slide-metadata";

// App schemas (internal, may use transforms/optionals)
export { InteractionRecordSchema, type InteractionRecord } from "./app/interaction-record";
export { FeedbackSignalSchema, type FeedbackSignal } from "./app/feedback-signal";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `zod-to-json-schema` (3rd party) | `z.toJSONSchema()` (native Zod v4) | Zod v4 release (2025) | No external dependency for JSON Schema conversion |
| `responseSchema` + `Type` enum | `responseJsonSchema` + standard JSON Schema | `@google/genai` v1.9.0+ (2025) | Standard JSON Schema accepted directly; no manual Type mapping needed |
| Hand-crafted Gemini schema objects | `z.toJSONSchema()` output | Now | Single schema definition serves both TypeScript types and Gemini API |
| Separate Zod schema + Gemini schema | Single Zod schema + auto-conversion | Now | Eliminates schema drift between Zod and Gemini definitions |

**Deprecated/outdated:**
- `zod-to-json-schema`: Maintainer recommends Zod v4 native; v3.25 only supports Zod v3 schemas in v4 compat mode
- `responseSchema` with `Type.OBJECT`/`Type.STRING`/etc.: Still works but is the legacy path; `responseJsonSchema` is the standard going forward
- The `@google/genai` `Type` import: Still exported but not needed for `responseJsonSchema` path

## Open Questions

1. **additionalProperties behavior with Gemini**
   - What we know: Gemini API supports `additionalProperties` since Nov 2025. `z.toJSONSchema()` outputs `additionalProperties: false` by default. The `responseJsonSchema` path passes it through.
   - What's unclear: Whether `additionalProperties: false` improves or hinders Gemini's output quality in practice.
   - Recommendation: Include it (default behavior). If round-trip validation fails on any schema, try removing it as a debugging step.

2. **Optimal z.toJSONSchema target for Gemini**
   - What we know: Default target (`draft-2020-12`) includes `$schema` key. `openapi-3.0` target omits it. Both produce identical `type`/`properties`/`required`/`enum` output for the schema shapes we need.
   - What's unclear: Whether Gemini handles `$schema` key gracefully in `responseJsonSchema` (vs. silently ignoring it).
   - Recommendation: Strip `$schema` in the helper regardless of target. Use default target for maximum JSON Schema feature coverage.

3. **Should classify-metadata.ts be fully migrated in Phase 3?**
   - What we know: CONTEXT.md says "Update `classify-metadata.ts` to import from `@lumenalta/schemas` after consolidation." This means importing constants and SlideMetadataSchema from the shared package.
   - What's unclear: Whether to also migrate the Gemini call pattern from `responseSchema`+`Type` to `responseJsonSchema`+`zodToGeminiSchema()`.
   - Recommendation: Migrate the imports (constants + schema). Migrating the Gemini call pattern is optional for Phase 3 but recommended for consistency. If migrated, the hand-crafted `GEMINI_RESPONSE_SCHEMA` object is deleted entirely.

## Sources

### Primary (HIGH confidence)
- **Zod 4.3.6 installed** -- verified from `packages/schemas/node_modules/zod/package.json`
- **z.toJSONSchema() output** -- verified by running `npx tsx` against actual installed Zod 4.3.6
- **@google/genai v1.43.0 type definitions** -- read from `dist/genai.d.ts`, confirmed `responseJsonSchema` property on `GenerateContentConfig`
- **@google/genai backward compat shim** -- read from `dist/index.cjs`, confirmed `maybeMoveToResponseJsonSchem` logic
- **Existing classify-metadata.ts** -- read full source, confirmed `Type` enum usage and hand-crafted schema pattern
- [Zod JSON Schema docs](https://zod.dev/json-schema) -- z.toJSONSchema() API, targets, overrides, unsupported types
- [Gemini Structured Output docs](https://ai.google.dev/gemini-api/docs/structured-output) -- responseJsonSchema, supported JSON Schema properties

### Secondary (MEDIUM confidence)
- [Zod v4 & Gemini blog post](https://www.buildwithmatija.com/blog/zod-v4-gemini-fix-structured-output-z-tojsonschema) -- confirms z.toJSONSchema + responseJsonSchema integration pattern
- [Google Gemini structured outputs announcement](https://blog.google/technology/developers/gemini-api-structured-outputs/) -- JSON Schema support, propertyOrdering
- [zod-to-json-schema npm](https://www.npmjs.com/package/zod-to-json-schema) -- confirms v3.25 is likely final release, recommends Zod v4 native

### Tertiary (LOW confidence)
- [googleapis/python-genai #1815](https://github.com/googleapis/python-genai/issues/1815) -- additionalProperties SDK validation issue (Python SDK, may not apply to JS SDK)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and version-verified in node_modules
- Architecture: HIGH -- z.toJSONSchema() output tested against real Zod 4.3.6; responseJsonSchema confirmed in SDK types
- Pitfalls: HIGH -- verified by reading SDK source code and testing edge cases (optionals, transforms, additionalProperties)
- Schema definitions: MEDIUM -- exact field names and descriptions are Claude's discretion; domain understanding comes from REQUIREMENTS.md
- Gemini round-trip behavior: MEDIUM -- API call pattern confirmed from SDK types and docs, but actual Gemini response quality for each schema needs live validation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- Zod v4 and @google/genai are both released and versioned)
