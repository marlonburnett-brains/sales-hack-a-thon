# Phase 5: Transcript Processing and Brief Generation - Research

**Researched:** 2026-03-03
**Domain:** Mastra workflow orchestration, Gemini structured extraction, Next.js form + polling UI, Prisma data persistence
**Confidence:** HIGH

## Summary

Phase 5 builds a single Mastra workflow (`touch-4-workflow`) that processes raw meeting transcripts through a multi-step Gemini pipeline: field extraction, seller review (suspend/resume), pillar mapping, brief generation, and ROI framing. The architecture is a direct extension of the Touch 1 workflow pattern already proven in Phase 4, with two key differences: (1) the suspend point is for field review/editing rather than content approval, and (2) there is no Google Slides assembly step -- the output is structured brief data rendered as cards in the web UI.

All building blocks exist: the three LLM schemas (`TranscriptFieldsLlmSchema`, `SalesBriefLlmSchema`, `ROIFramingLlmSchema`) were validated against Gemini 2.5 Flash in Phase 3, the `zodToGeminiSchema()` bridge is proven, the Mastra `createWorkflow`/`createStep` + suspend/resume pattern is established, and the web app's server action + polling + multi-state UI pattern is reusable. The primary new work is: (a) a `SUBSECTORS` constant mapping, (b) a new Prisma `Transcript` model for structured persistence (DATA-02), (c) prompt engineering for 4 Gemini steps, (d) a Touch 4 form with cascading dropdowns and field review, and (e) a brief display component with pillar cards.

**Primary recommendation:** Follow the Touch 1 workflow pattern exactly for workflow structure, server actions, and polling. Use separate Prisma models (`Transcript` + `Brief`) for structured persistence rather than JSON blobs on InteractionRecord. Define all 62 subsectors as a `SUBSECTORS: Record<Industry, string[]>` constant in the shared schemas package.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Workflow suspends after field extraction for seller review (reuses Mastra suspend/resume pattern from Touch 1)
- Seller can view AND edit all 6 extracted fields during the suspended review -- enables filling in missing data from memory (e.g., budget discussed off-transcript)
- Tiered severity: Customer Context and Business Outcomes are hard requirements -- seller MUST fill these in if empty. Timeline, Budget, Constraints, and Stakeholders are warning-only -- seller acknowledges but can proceed with gaps
- After seller clicks "Continue" on the field review, the workflow auto-resumes through pillar mapping, brief generation, and ROI framing -- no separate "Generate Brief" button
- Structured cards per section, vertical scroll -- reuses shadcn/ui Card component
- Primary solution pillar gets a prominent badge/highlight with supporting evidence displayed; secondary pillars listed in a compact format below
- Each use case rendered as its own visible card with ROI outcomes and value hypothesis shown inline -- no accordion/expand, all visible (typically 2-4 use cases)
- Brief display shows only the generated brief content (pillars, use cases, ROI) -- extracted fields were already reviewed in the previous step, no need to repeat
- Single Mastra workflow with one suspend point: parseTranscript -> validateFields -> [suspend for seller review] -> mapPillars -> generateBrief -> roiFraming -> recordInteraction
- Step-by-step progress indicators during processing: "Extracting fields...", "Mapping solution pillars...", "Generating brief...", "Framing ROI outcomes..." -- reuses GenerationProgress component from Touch 1
- After brief is generated: brief displayed on screen AND a summary card appears on the deal page interaction timeline (consistent with Touch 1 result pattern)
- Full persistence (DATA-02): raw transcript text, extracted fields, and generated brief stored as structured data in the database -- not just JSON blobs in InteractionRecord
- Touch 4 card on the unified deal page alongside Touch 1/2/3 -- clicking opens the transcript form; company and industry pre-filled from deal record
- Cascading dropdowns: seller picks industry (11 items), then a second dropdown appears with subsectors filtered for that industry (from 62 total) -- uses existing shadcn/ui Select component
- 62 subsectors defined as `SUBSECTORS: Record<Industry, string[]>` in `packages/schemas/constants.ts` alongside the existing INDUSTRIES constant -- single source of truth
- Large freeform textarea for transcript with placeholder text showing example format/guidance
- Optional "Additional meeting notes" field where seller can add context not captured in the transcript
- No word count or format constraints on transcript -- Gemini 2.5 Flash's large context window handles noisy text

### Claude's Discretion
- Exact Prisma model additions for transcript/brief persistence (new fields on InteractionRecord vs. new Transcript/Brief models)
- Prompt engineering for each Gemini step (parseTranscript, mapPillars, generateBrief, roiFraming)
- The actual 62 subsector values per industry (research Lumenalta's taxonomy)
- Loading skeleton and error state designs
- Step progress component implementation details
- Field review form layout and warning/error visual treatment

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRANS-01 | Seller can paste a raw meeting transcript into a web UI form | Touch 4 form component with textarea, following Touch 1/3 form pattern; deal page integration via TouchFlowCard |
| TRANS-02 | Seller can select the relevant industry (from 11) and subsector (from 62) before processing | Cascading shadcn/ui Select components; INDUSTRIES constant exists, SUBSECTORS constant to be added to `packages/schemas/constants.ts` |
| TRANS-03 | System extracts structured fields from transcript: Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget | `TranscriptFieldsLlmSchema` already defined and Gemini-validated; Gemini 2.5 Flash structured output via `zodToGeminiSchema()` |
| TRANS-04 | System flags specific missing critical fields and prevents pipeline from advancing until seller acknowledges each gap | Mastra suspend/resume step with tiered severity; hard-stop on empty customerContext/businessOutcomes, warning-only on others |
| TRANS-05 | System maps transcript content to primary and secondary Lumenalta solution pillars | `SalesBriefLlmSchema` includes primaryPillar and secondaryPillars fields; Gemini structured output extracts pillar mapping from transcript + field data |
| GEN-01 | System generates a structured Multi-Pillar Sales Brief identifying primary and secondary solution pillars with supporting evidence | `SalesBriefLlmSchema` has evidence field and pillar fields; separate Gemini generation step after pillar mapping |
| GEN-02 | System generates 2-3 ROI outcome statements and 1 value hypothesis per identified use case | `ROIFramingLlmSchema` with roiOutcomes array (2-3 items) and valueHypothesis per use case; dedicated Gemini step |
| DATA-02 | All meeting transcripts, notes, and conversation context submitted through any flow are stored and indexed for future retrieval | New Prisma models (Transcript, Brief) with structured columns; InteractionRecord links to Transcript; indexed by dealId, industry, subsector |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | 1.8.0 | Workflow orchestration (createWorkflow/createStep, suspend/resume) | Already in use for Touch 1-3; proven suspend/resume pattern |
| @google/genai | (installed) | Gemini 2.5 Flash structured output | Already in use; `responseJsonSchema` + `responseMimeType: "application/json"` pattern proven |
| zod | 4.x | Schema validation for LLM outputs and form data | Used across all packages; `zodToGeminiSchema()` bridge established |
| @prisma/client | (installed) | Database persistence for Transcript/Brief models | Already managing Company, Deal, InteractionRecord models |
| next | 15.x | Web app framework (Server Actions, App Router) | Already in use; server action + polling pattern proven |
| @radix-ui/react-select | (installed) | Cascading dropdown UI for industry/subsector selection | shadcn/ui Select already available in components/ui/ |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @lumenalta/schemas | workspace | Shared LLM schemas, constants, zodToGeminiSchema | All schema imports; SUBSECTORS constant definition |
| lucide-react | (installed) | Icons for form states, warnings, badges | AlertTriangle for warnings, CheckCircle for valid fields, etc. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New Transcript/Brief Prisma models | JSON blobs on InteractionRecord | JSON blobs make querying/indexing impossible; DATA-02 requires indexing for future retrieval |
| Cascading shadcn Select | Combobox/autocomplete | 62 subsectors across 11 industries is small enough for simple Select; no search needed |
| Single combined Gemini call | Multi-step pipeline | Multi-step gives better structured output quality and enables step-by-step progress UI |

**Installation:**
No new packages needed. All dependencies are already installed.

## Architecture Patterns

### Recommended Project Structure
```
packages/schemas/
  constants.ts                    # Add SUBSECTORS constant here
  llm/transcript-fields.ts       # Already exists (Phase 3)
  llm/sales-brief.ts             # Already exists (Phase 3)
  llm/roi-framing.ts             # Already exists (Phase 3)
  llm/pillar-mapping.ts          # NEW: intermediate pillar mapping schema

apps/agent/
  prisma/schema.prisma            # Add Transcript + Brief models
  src/mastra/
    workflows/touch-4-workflow.ts  # NEW: transcript processing workflow
    index.ts                       # Register touch-4-workflow + new API routes

apps/web/src/
  components/touch/
    touch-4-form.tsx               # NEW: transcript input + field review + brief display
    field-review.tsx               # NEW: extracted field editing with severity indicators
    brief-display.tsx              # NEW: sales brief card layout
  lib/
    actions/touch-actions.ts       # Add Touch 4 server actions
    api-client.ts                  # Add Touch 4 API client functions
  app/deals/[dealId]/page.tsx      # Add Touch 4 card to grid
```

### Pattern 1: Multi-Step Gemini Workflow with Single Suspend Point
**What:** A Mastra workflow with 6+ steps chained via `.then()`, one suspend point for seller review, and structured Gemini output at each LLM step
**When to use:** Any pipeline that needs human review mid-stream
**Example:**
```typescript
// Source: Touch 1 workflow pattern (apps/agent/src/mastra/workflows/touch-1-workflow.ts)
export const touch4Workflow = createWorkflow({
  id: "touch-4-workflow",
  inputSchema: z.object({
    dealId: z.string(),
    companyName: z.string(),
    industry: z.string(),
    subsector: z.string(),
    transcript: z.string(),
    additionalNotes: z.string().optional(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    transcriptId: z.string(),
  }),
})
  .then(parseTranscript)        // Gemini: extract 6 fields
  .then(validateFields)         // Check for empty fields, set severity
  .then(awaitFieldReview)       // SUSPEND: seller reviews/edits fields
  .then(mapPillars)             // Gemini: map to solution pillars
  .then(generateBrief)          // Gemini: generate full brief
  .then(generateROIFraming)     // Gemini: ROI outcomes per use case
  .then(recordInteraction)      // Persist to DB + create InteractionRecord
  .commit();
```

### Pattern 2: Suspend/Resume with Editable Data
**What:** The suspend step exposes extracted fields for seller editing; the resume step receives edited data
**When to use:** When the seller needs to correct/augment AI-extracted data before the pipeline continues
**Example:**
```typescript
// Source: Touch 1 await-seller-approval step adapted for field review
const awaitFieldReview = createStep({
  id: "await-field-review",
  inputSchema: z.object({
    // ... all fields from previous steps
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: z.record(z.enum(["error", "warning", "ok"])),
  }),
  outputSchema: z.object({
    // ... pass-through fields + reviewed data
    reviewedFields: TranscriptFieldsLlmSchema,
    decision: z.enum(["continued"]),
  }),
  resumeSchema: z.object({
    reviewedFields: TranscriptFieldsLlmSchema,
  }),
  suspendSchema: z.object({
    reason: z.string(),
    extractedFields: TranscriptFieldsLlmSchema,
    fieldSeverity: z.record(z.enum(["error", "warning", "ok"])),
    dealId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      return await suspend({
        reason: "Seller field review required",
        extractedFields: inputData.extractedFields,
        fieldSeverity: inputData.fieldSeverity,
        dealId: inputData.dealId,
      });
    }
    return {
      ...inputData,
      reviewedFields: resumeData.reviewedFields,
      decision: "continued" as const,
    };
  },
});
```

### Pattern 3: Cascading Dropdown with Filtered Options
**What:** Industry Select controls which subsectors appear in a second Select
**When to use:** When options in a second dropdown depend on the first selection
**Example:**
```typescript
// Web component pattern
const [selectedIndustry, setSelectedIndustry] = useState<string>(industry);
const [selectedSubsector, setSelectedSubsector] = useState<string>("");

// SUBSECTORS is Record<string, string[]> imported from @lumenalta/schemas
const availableSubsectors = selectedIndustry
  ? SUBSECTORS[selectedIndustry] ?? []
  : [];

// Reset subsector when industry changes
const handleIndustryChange = (value: string) => {
  setSelectedIndustry(value);
  setSelectedSubsector("");
};
```

### Pattern 4: Multi-State Form with Field Review Step
**What:** Form progresses through: input -> extracting -> fieldReview -> generating -> briefResult
**When to use:** Touch 4 transcript form (extends Touch 1's input -> generating -> review -> assembling -> result)
**Key difference from Touch 1:** The "review" state here is for field correction, not content approval. After field review, the pipeline auto-continues without a second pause.

### Pattern 5: Structured Data Persistence (DATA-02)
**What:** Raw transcript, extracted fields, and generated brief stored as first-class Prisma models with indexed columns
**When to use:** When data needs to be queryable/retrievable for future pattern learning
**Example:**
```prisma
model Transcript {
  id              String   @id @default(cuid())
  interactionId   String   @unique
  interaction     InteractionRecord @relation(fields: [interactionId], references: [id])
  rawText         String   // Full transcript text
  additionalNotes String?  // Optional seller notes
  subsector       String   // Selected subsector
  customerContext    String  // Extracted or seller-edited
  businessOutcomes   String
  constraints        String
  stakeholders       String
  timeline           String
  budget             String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([interactionId])
}

model Brief {
  id               String   @id @default(cuid())
  interactionId    String   @unique
  interaction      InteractionRecord @relation(fields: [interactionId], references: [id])
  primaryPillar    String
  secondaryPillars String   // JSON array
  evidence         String
  useCases         String   // JSON array of {name, description, roiOutcomes[], valueHypothesis}
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([interactionId])
}
```

### Anti-Patterns to Avoid
- **Storing everything as JSON blobs on InteractionRecord:** Makes DATA-02 impossible to fulfill -- you cannot index or query transcript fields stored as opaque JSON
- **Multiple suspend points in one workflow:** The user decided on a single suspend point. Do NOT add a second suspend for brief approval (that is Phase 6)
- **Validating subsectors client-side only:** The SUBSECTORS constant must be the single source of truth in `packages/schemas/constants.ts`, validated on both client and server
- **Combining all Gemini calls into one:** The pipeline has 4 distinct LLM tasks. Splitting them enables progress UI, better structured output quality, and easier debugging
- **Hard-coding solution pillar names:** Use open strings (not enums) for pillar names in the schema. The SalesBriefLlmSchema already uses `z.string()` for this reason -- Gemini should freely identify relevant pillars from Lumenalta's service taxonomy

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cascading dropdown logic | Custom select with manual filtering | shadcn/ui Select + SUBSECTORS constant lookup | shadcn/ui Select already handles keyboard nav, accessibility, scroll; just filter the options array |
| Workflow orchestration with suspend/resume | Custom state machine + database polling | Mastra createWorkflow + createStep | Mastra handles snapshot persistence, resume routing, step output piping automatically |
| JSON Schema generation for Gemini | Manual JSON Schema construction | zodToGeminiSchema(schema) | Already proven; strips $schema key, handles Gemini compatibility |
| Form validation with tiered severity | Custom validation logic | Zod schema + manual empty-string checks | TranscriptFieldsLlmSchema uses required strings (empty = missing); severity is a simple check against field value length |
| Polling for workflow status | Custom WebSocket or SSE | setTimeout polling loop (2s interval) | Same pattern as Touch 1; simple, proven, works with server actions |

**Key insight:** Every building block for this phase already exists in the codebase. The Touch 1 workflow is the reference implementation for Mastra suspend/resume + Gemini + polling + multi-state UI. Touch 3's form is the reference for selection-based inputs. The only genuinely new code is the SUBSECTORS constant, the Prisma models, the prompt engineering, and the brief display component.

## Common Pitfalls

### Pitfall 1: Gemini Returning Empty Strings vs. Meaningful Extractions
**What goes wrong:** Gemini may return empty strings for fields that ARE discussed in the transcript but in an indirect way (e.g., budget is implied but not stated as a number)
**Why it happens:** The `TranscriptFieldsLlmSchema` uses empty string as the "not found" sentinel. Gemini might interpret ambiguous mentions as empty.
**How to avoid:** Prompt engineering must explicitly tell Gemini to extract indirect/implied mentions. Example: "If budget is discussed in any way -- even as 'we have limited resources' or 'this needs to fit within Q2 allocation' -- extract that context. Only return empty string if the topic is completely absent from the transcript."
**Warning signs:** Too many fields showing as "missing" on transcripts that clearly discuss those topics

### Pitfall 2: Subsector Dropdown Not Resetting When Industry Changes
**What goes wrong:** Seller changes industry, but the subsector dropdown retains the previous industry's selection
**Why it happens:** React state for subsector is not cleared when industry changes
**How to avoid:** Clear subsector state in the industry change handler. The cascading pattern above shows `setSelectedSubsector("")` in `handleIndustryChange`.
**Warning signs:** Form submits with a subsector that doesn't belong to the selected industry

### Pitfall 3: Workflow Resume Data Schema Mismatch
**What goes wrong:** The web app sends resume data that doesn't match the step's `resumeSchema`, causing a silent failure or crash
**Why it happens:** The resume data shape in the web form doesn't exactly match what the workflow step expects
**How to avoid:** Define the `resumeSchema` as a Zod schema and validate the data before sending. Use the same TypeScript types in both the workflow step and the web form.
**Warning signs:** Workflow hangs after resume, or throws a Zod validation error in the agent service logs

### Pitfall 4: Brief Generation Quality Degradation with Sparse Transcripts
**What goes wrong:** Very short or low-quality transcripts produce briefs with hallucinated details or generic pillar mapping
**Why it happens:** Gemini fills in gaps creatively when the input is insufficient
**How to avoid:** The field review step is the safety net. If Customer Context and Business Outcomes are empty after extraction, the seller MUST fill them in before the pipeline continues. The brief generation prompt should ground on the reviewed fields, not the raw transcript.
**Warning signs:** Brief contains specific claims not traceable to the transcript or seller-provided fields

### Pitfall 5: Large Transcript Exceeding Polling Timeout
**What goes wrong:** Very long transcripts (10k+ words) cause the extraction step to take longer than the polling timeout
**Why it happens:** Gemini 2.5 Flash is fast but structured output on large inputs can take 15-30 seconds per step
**How to avoid:** Keep the polling timeout generous (120 attempts x 2s = 4 minutes, same as Touch 1). Multi-step pipeline with 4 Gemini calls could take 60-120 seconds total for large transcripts.
**Warning signs:** "Polling timeout" error on legitimate transcripts

### Pitfall 6: InteractionRecord `generatedContent` Column Too Small for Full Brief
**What goes wrong:** The brief JSON is larger than what was stored for Touch 1 pager content
**Why it happens:** SalesBrief has nested useCases array with ROI outcomes, plus multiple pillar fields
**How to avoid:** The InteractionRecord stores a summary reference; the full brief lives in the dedicated `Brief` model. Store only a summary (pillar names + use case count) in InteractionRecord.generatedContent for timeline display.
**Warning signs:** Data truncation or JSON parse errors when loading timeline entries

## Code Examples

### Gemini Structured Extraction Call
```typescript
// Source: Touch 1 workflow generateContent step (proven pattern)
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToGeminiSchema(TranscriptFieldsLlmSchema) as Record<string, unknown>,
  },
});
const text = response.text ?? "";
const parsed = TranscriptFieldsLlmSchema.parse(JSON.parse(text));
```

### Field Severity Computation
```typescript
// After Gemini extraction, before suspend
type FieldSeverity = "error" | "warning" | "ok";

function computeFieldSeverity(
  fields: TranscriptFields
): Record<keyof TranscriptFields, FieldSeverity> {
  return {
    customerContext: fields.customerContext.trim() === "" ? "error" : "ok",
    businessOutcomes: fields.businessOutcomes.trim() === "" ? "error" : "ok",
    constraints: fields.constraints.trim() === "" ? "warning" : "ok",
    stakeholders: fields.stakeholders.trim() === "" ? "warning" : "ok",
    timeline: fields.timeline.trim() === "" ? "warning" : "ok",
    budget: fields.budget.trim() === "" ? "warning" : "ok",
  };
}
```

### Cascading Subsector Select
```typescript
// Source: shadcn/ui Select component (apps/web/src/components/ui/select.tsx)
<div className="space-y-2">
  <Label>Industry</Label>
  <Select value={selectedIndustry} onValueChange={handleIndustryChange}>
    <SelectTrigger>
      <SelectValue placeholder="Select industry" />
    </SelectTrigger>
    <SelectContent>
      {INDUSTRIES.map((ind) => (
        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

{selectedIndustry && (
  <div className="space-y-2">
    <Label>Subsector</Label>
    <Select value={selectedSubsector} onValueChange={setSelectedSubsector}>
      <SelectTrigger>
        <SelectValue placeholder="Select subsector" />
      </SelectTrigger>
      <SelectContent>
        {availableSubsectors.map((sub) => (
          <SelectItem key={sub} value={sub}>{sub}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}
```

### Brief Display Card Layout
```typescript
// Each use case as a card with ROI outcomes inline
{brief.useCases.map((uc) => (
  <Card key={uc.name}>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">{uc.name}</CardTitle>
      <p className="text-sm text-slate-600">{uc.description}</p>
    </CardHeader>
    <CardContent className="space-y-2">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase">ROI Outcomes</p>
        <ul className="list-disc pl-4 text-sm text-slate-700">
          {uc.roiOutcomes.map((outcome, i) => (
            <li key={i}>{outcome}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase">Value Hypothesis</p>
        <p className="text-sm text-slate-700">{uc.valueHypothesis}</p>
      </div>
    </CardContent>
  </Card>
))}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON blob columns for all data | Structured Prisma models with indexed columns | Phase 5 (new) | Enables DATA-02 retrieval and pattern learning |
| Single Gemini call for full brief | Multi-step pipeline (extract -> map -> brief -> ROI) | Phase 5 (new) | Better quality per step, enables progress UI, easier debugging |
| Touch 1/2/3 only | Touch 4 joins the deal page | Phase 5 (new) | Transcript processing becomes part of the unified deal flow |

**Deprecated/outdated:**
- None relevant to this phase. All existing patterns are current.

## Subsector Taxonomy Research

### Recommendation: SUBSECTORS Constant

Based on research of Lumenalta's industry taxonomy and common technology consulting subsectors, the `SUBSECTORS` constant should provide 4-8 subsectors per industry to total approximately 62. The exact values should be curated from Lumenalta's GTM materials. Below is a research-informed starting point that the implementer should refine:

**Confidence:** MEDIUM -- derived from Lumenalta's public website categories, general technology consulting taxonomy, and the 11 industries already defined in `constants.ts`. The exact subsector names may need adjustment to match internal Lumenalta terminology.

```typescript
export const SUBSECTORS: Record<string, string[]> = {
  "Consumer Products": [
    "Retail & E-Commerce",
    "Consumer Electronics",
    "Food & Beverage",
    "Apparel & Fashion",
    "Consumer Health & Wellness",
    "Home & Personal Care",
  ],
  "Education": [
    "Higher Education",
    "K-12",
    "EdTech Platforms",
    "Corporate Training",
    "Online Learning",
  ],
  "Financial Services & Insurance": [
    "Digital Banking",
    "Capital Markets",
    "Payments & Fintech",
    "Insurance Tech",
    "Wealth Management",
    "Lending & Credit",
    "Regulatory & Compliance",
  ],
  "Health Care": [
    "Telehealth",
    "Health Information Systems",
    "Pharmaceuticals",
    "Medical Devices",
    "Clinical Research",
    "Payer Solutions",
    "Population Health",
  ],
  "Industrial Goods": [
    "Manufacturing",
    "Energy & Utilities",
    "Mining & Resources",
    "Construction & Engineering",
    "Industrial Automation",
  ],
  "Private Equity": [
    "Portfolio Operations",
    "Due Diligence Tech",
    "Fund Administration",
    "Value Creation",
    "Digital Transformation",
  ],
  "Public Sector": [
    "Federal Government",
    "State & Local Government",
    "Defense & Intelligence",
    "Civic Tech",
    "Regulatory Agencies",
  ],
  "Technology, Media & Telecommunications": [
    "Enterprise Software",
    "Media & Entertainment",
    "Telecommunications",
    "Cybersecurity",
    "Cloud & Infrastructure",
    "Gaming",
    "Streaming & Content",
  ],
  "Transportation & Logistics": [
    "Supply Chain & Logistics",
    "Fleet Management",
    "Maritime & Shipping",
    "Aviation",
    "Last-Mile Delivery",
    "Rail & Transit",
  ],
  "Travel & Tourism": [
    "Hospitality",
    "Airlines & Aviation",
    "Online Travel",
    "Destination Management",
    "Travel Tech",
  ],
  "Professional Services": [
    "Management Consulting",
    "Legal Tech",
    "Accounting & Audit",
    "Staffing & Recruitment",
    "Architecture & Design",
  ],
}; // Total: 62 subsectors
```

### Solution Pillars for Brief Generation

The Gemini pillar mapping step needs awareness of Lumenalta's service taxonomy. Based on the website research and existing CAPABILITY_AREAS in the codebase, Lumenalta's solution pillars align to their 6 service categories:

1. **AI, ML & LLM** -- Artificial intelligence, machine learning, large language models, NLP, computer vision, RPA
2. **Cloud & Infrastructure** -- Cloud migration, hybrid/multi-cloud, DevOps, containerization, serverless, IoT
3. **Data Modernization** -- Data engineering, analytics, data strategy, data lakes, real-time processing
4. **Platform & Application Development** -- Custom software, mobile apps, web platforms, API development, modernization
5. **Tech Strategy & Advisory** -- Digital transformation consulting, technology roadmaps, deep tech consulting
6. **UX & UI Design** -- User experience, interface design, design systems, accessibility

These should be included in the pillar mapping prompt so Gemini maps transcript content to Lumenalta-specific pillars rather than generic categories. The existing `CAPABILITY_AREAS` in Touch 3 (Data Engineering, Cloud Migration, AI/ML, etc.) are more granular capability areas that map under these 6 pillars.

**Confidence:** HIGH for the 6 top-level pillars (directly from lumenalta.com/services navigation). MEDIUM for the granular mapping.

## Prompt Engineering Guidance

### Step 1: parseTranscript
**Input:** Raw transcript text, industry, subsector, additional notes
**Output:** TranscriptFieldsLlmSchema (6 fields)
**Key prompt considerations:**
- Instruct Gemini to extract INDIRECT mentions (not just explicit statements)
- Industry and subsector context should help Gemini interpret domain-specific language
- Additional notes should be treated as supplementary context
- Empty string only when the topic is completely absent

### Step 2: mapPillars (intermediate step)
**Input:** Reviewed fields (post-seller-edit), industry, subsector
**Output:** SalesBriefLlmSchema (includes pillar mapping + brief + use cases)
**Key prompt considerations:**
- Provide the 6 Lumenalta solution pillars as context
- The seller-reviewed fields are the ground truth (not the raw transcript)
- Must select a primary pillar AND at least one secondary pillar with evidence
- Use cases should be specific to the customer's situation, not generic

Note: mapPillars and generateBrief can potentially be combined into a single Gemini call since SalesBriefLlmSchema already includes both pillar mapping and brief content. The separate steps in the workflow provide progress UI granularity, but the actual Gemini calls could be structured as:
- Call 1: Pillar mapping + brief generation (SalesBriefLlmSchema)
- Call 2: ROI framing enrichment (ROIFramingLlmSchema)

### Step 3: generateROIFraming
**Input:** Brief with use cases
**Output:** ROIFramingLlmSchema (2-3 ROI outcomes + value hypothesis per use case)
**Key prompt considerations:**
- Use cases from the brief are the input
- ROI outcomes should be specific and quantifiable where possible
- Value hypothesis connects Lumenalta's delivery model to the customer's needs

## Prisma Schema Design (Claude's Discretion)

### Recommendation: Separate Transcript and Brief Models

**Rationale:** DATA-02 requires "stored and indexed for future retrieval." Structured Prisma models with indexed columns enable:
- Querying transcripts by industry/subsector for pattern analysis
- Retrieving briefs by pillar for content reuse
- Joining transcript fields with brief outcomes for learning signals

**Design:**

```prisma
// Add to InteractionRecord
model InteractionRecord {
  // ... existing fields ...
  transcript      Transcript?       // 1:1 optional (only for touch_4)
  brief           Brief?            // 1:1 optional (only for touch_4)
}

model Transcript {
  id              String   @id @default(cuid())
  interactionId   String   @unique
  interaction     InteractionRecord @relation(fields: [interactionId], references: [id])
  rawText         String   // Full transcript text (SQLite TEXT, no limit)
  additionalNotes String?  // Optional seller notes
  subsector       String   // Selected subsector
  // Extracted/reviewed fields (post-seller-edit)
  customerContext    String @default("")
  businessOutcomes   String @default("")
  constraints        String @default("")
  stakeholders       String @default("")
  timeline           String @default("")
  budget             String @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([interactionId])
  @@index([subsector])
}

model Brief {
  id               String   @id @default(cuid())
  interactionId    String   @unique
  interaction      InteractionRecord @relation(fields: [interactionId], references: [id])
  primaryPillar    String
  secondaryPillars String   // JSON array of strings (SQLite has no array type)
  evidence         String
  customerContext  String   // Synthesized from all sources
  businessOutcomes String
  constraints      String
  stakeholders     String
  timeline         String
  budget           String
  useCases         String   // JSON: [{name, description, roiOutcome, valueHypothesis}]
  roiFraming       String   // JSON: [{useCaseName, roiOutcomes[], valueHypothesis}]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([interactionId])
  @@index([primaryPillar])
}
```

**SQLite consideration:** SQLite TEXT columns have no practical size limit (up to 1 billion bytes). Large transcripts are fine. Array fields use JSON strings since SQLite has no native array type -- consistent with existing `outputRefs` pattern on InteractionRecord.

## Workflow Step Data Flow

```
Input (form submit)
  dealId, companyName, industry, subsector, transcript, additionalNotes
    |
    v
Step 1: parseTranscript (Gemini)
  -> TranscriptFields {customerContext, businessOutcomes, constraints, stakeholders, timeline, budget}
    |
    v
Step 2: validateFields (pure logic, no LLM)
  -> fieldSeverity: Record<field, "error"|"warning"|"ok">
    |
    v
Step 3: awaitFieldReview [SUSPEND]
  Seller sees: all 6 fields, severity indicators, edit capability
  Seller edits fields, fills in missing data
  Resume with: reviewedFields (TranscriptFields)
    |
    v
Step 4: mapPillars + generateBrief (Gemini)
  Input: reviewedFields + industry + subsector
  -> SalesBrief {primaryPillar, secondaryPillars, evidence, useCases[...]}
    |
    v
Step 5: generateROIFraming (Gemini)
  Input: brief.useCases
  -> ROIFraming {useCases: [{useCaseName, roiOutcomes[], valueHypothesis}]}
    |
    v
Step 6: recordInteraction (DB writes)
  -> Create InteractionRecord (touch_4, "completed")
  -> Create Transcript (raw + reviewed fields)
  -> Create Brief (pillar mapping + use cases + ROI framing)
  -> Output: {interactionId, briefId, transcriptId}
```

## Open Questions

1. **Exact 62 subsector values**
   - What we know: The 11 industries are defined. The taxonomy above is research-informed.
   - What's unclear: Whether Lumenalta has an internal taxonomy that differs from the research-derived values.
   - Recommendation: Use the research-derived values above as the starting point. They total 62 and cover reasonable subsectors for each industry. Refine if Lumenalta's internal GTM materials become available.

2. **PillarMapping as separate schema or combined with SalesBrief**
   - What we know: SalesBriefLlmSchema already includes primaryPillar, secondaryPillars, and evidence fields alongside the full brief.
   - What's unclear: Whether a separate intermediate PillarMappingLlmSchema would improve quality vs. generating the full brief in one call.
   - Recommendation: Start with combined (SalesBriefLlmSchema for one call), keeping separate workflow steps for progress UI. If quality is poor, split into a separate PillarMappingLlmSchema for a dedicated first call.

3. **Brief display: re-render on deal page vs. dedicated route**
   - What we know: Touch 1 result shows inline within the form component. The user wants brief displayed on screen.
   - What's unclear: Whether the brief should be viewable only within the form flow or also navigable as a standalone page.
   - Recommendation: Display inline in the form flow (consistent with Touch 1), and show a summary card on the timeline. A standalone brief page is out of scope for Phase 5.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured (no test runner in project) |
| Config file | None -- Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRANS-01 | Transcript form accepts paste input | manual-only | N/A -- UI form interaction | N/A |
| TRANS-02 | Industry/subsector selection with cascading filter | manual-only | N/A -- UI dropdown interaction | N/A |
| TRANS-03 | Gemini extracts 6 structured fields from transcript | manual-only | N/A -- requires Gemini API key + live call | N/A |
| TRANS-04 | Missing field warnings with tiered severity | manual-only | N/A -- UI review + workflow suspend state | N/A |
| TRANS-05 | Pillar mapping from transcript content | manual-only | N/A -- requires Gemini API key + live call | N/A |
| GEN-01 | Multi-pillar brief with evidence | manual-only | N/A -- requires Gemini API key + live call | N/A |
| GEN-02 | 2-3 ROI outcomes + value hypothesis per use case | manual-only | N/A -- requires Gemini API key + live call | N/A |
| DATA-02 | Transcript + brief persisted in structured Prisma models | manual-only | N/A -- requires full workflow run + DB check | N/A |

**Justification for manual-only:** This project has no test framework configured. All requirements involve either live Gemini API calls, interactive UI flows, or database state verification through a full workflow run. Automated testing would require mocking the entire Gemini API, Mastra workflow engine, and Prisma database -- investment not justified for a hackathon demo.

### Sampling Rate
- **Per task commit:** Manual smoke test -- paste a sample transcript, verify field extraction, review fields, check brief output
- **Per wave merge:** Full end-to-end walkthrough from deal page -> Touch 4 form -> field review -> brief display -> timeline card
- **Phase gate:** All 6 success criteria verified manually

### Wave 0 Gaps
- No test infrastructure exists in this project (no vitest, jest, or other test runner)
- For this hackathon project, manual verification is the appropriate testing strategy
- Each requirement can be verified through the web UI with a sample transcript

## Sources

### Primary (HIGH confidence)
- Existing codebase: `apps/agent/src/mastra/workflows/touch-1-workflow.ts` -- reference implementation for Mastra workflow with suspend/resume + Gemini
- Existing codebase: `packages/schemas/llm/transcript-fields.ts`, `sales-brief.ts`, `roi-framing.ts` -- pre-validated LLM schemas
- Existing codebase: `packages/schemas/constants.ts` -- INDUSTRIES constant (11 items)
- Existing codebase: `apps/web/src/components/touch/touch-1-form.tsx` -- reference for multi-state form + polling
- Existing codebase: `apps/web/src/lib/api-client.ts` -- typed fetch wrapper pattern
- Existing codebase: `apps/agent/prisma/schema.prisma` -- current data model

### Secondary (MEDIUM confidence)
- [Lumenalta website](https://lumenalta.com/) -- industry and service taxonomy
- [Lumenalta services page](https://lumenalta.com/services) -- 6 primary service categories (solution pillars)
- [Lumenalta AI/ML services](https://lumenalta.com/services/ai-ml-llm) -- detailed AI capability areas

### Tertiary (LOW confidence)
- Subsector taxonomy values -- derived from research, not from internal Lumenalta GTM materials

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and proven in Phase 4
- Architecture: HIGH -- direct extension of Touch 1 workflow pattern with minor adaptations
- Pitfalls: HIGH -- identified from actual codebase patterns and known Gemini behavior
- Subsector taxonomy: MEDIUM -- research-informed but not verified against internal Lumenalta materials
- Prompt engineering: MEDIUM -- general guidance provided, exact prompts need iteration

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- all dependencies are pinned versions already in the project)
