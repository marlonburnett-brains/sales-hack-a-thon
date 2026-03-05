# Phase 7: RAG Retrieval and Slide Block Assembly - Research

**Researched:** 2026-03-04
**Domain:** RAG retrieval, structured JSON assembly, LLM-constrained copy generation
**Confidence:** HIGH

## Summary

Phase 7 bridges the approved brief (Phase 6 output) to the Google Slides deck (Phase 8 input) by producing a SlideJSON intermediate representation. The work has three distinct sub-problems: (1) retrieval of relevant slide blocks from AtlusAI using hybrid search (structured filters + semantic ranking), (2) assembly of those blocks into an ordered SlideJSON with section-based structure, and (3) generation of bespoke copy per slide block that is grounded in the approved brief and AtlusAI source content.

The existing codebase provides strong foundations. The `searchSlides()` and `searchByCapability()` functions in `atlusai-search.ts` handle Drive API-based retrieval. The `selectSlidesForDeck()` function in `slide-selection.ts` demonstrates the established Gemini-powered "over-retrieve then AI-select" pattern used by Touch 2/3. The `SlideAssemblyLlmSchema` already defines the core output structure. Phase 7 extends this pattern with: multi-query retrieval (primary pillar, secondary pillars, case studies), weighted slide budgeting, synthesized context slides, and per-slide copy generation with brand constraints.

**Primary recommendation:** Build Phase 7 as new workflow steps appended to the existing touch-4-workflow.ts (after `finalizeApproval`), reusing the established Gemini structured output + Zod round-trip pattern, and extending `atlusai-search.ts` with a new `searchForProposal()` function that handles the multi-pass retrieval strategy.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Retrieval strategy:** Hybrid approach: structured filter first (industry + solution pillar + funnel stage = "Solution Proposal") to narrow candidates, then semantic search within results using brief context (customer context, business outcomes, use cases). Over-retrieve 20-30 candidate slides, then use Gemini to select the best 8-12 for the final deck based on brief alignment. Weighted multi-pillar retrieval: primary pillar gets ~70% of slide budget (6-8 slides), each secondary pillar gets ~15% (1-2 slides). Dedicated case study retrieval pass: separate query for case studies matching customer's industry/subsector (content_type="case_study"), include 1-2 case study slides as social proof.
- **Deck structure & slide ordering:** Fixed section template: Title/Context -> Problem Restatement -> Primary Pillar Capabilities -> Secondary Pillar Capabilities -> Case Studies -> ROI/Outcomes -> Next Steps. AI fills sections with retrieved slides but does NOT rearrange the section order. Use case-driven sections: each use case from the brief maps to a mini-section of 1-2 slides. Auto-generated title/context slides (first 1-2 slides) synthesized from approved brief data -- NOT retrieved from AtlusAI. Synthesized slides explicitly marked (no sourceBlockRef required, flagged as source="synthesized").
- **Copy generation scope:** Slide titles preserved from source template (brand-consistent). Bullet text rewritten to connect source capabilities to the customer's specific needs using approved brief data. Speaker notes generated fresh with talking points for each slide. Directly personalized: copy uses the customer's actual business outcomes, stakeholders, and constraints from the brief.
- **Quality verification:** Scripted test briefs: 3 mock approved briefs (Financial Services, Healthcare, Technology) with realistic pillars and use cases. Automated verification: run RAG pipeline against each, check (1) slides match industry, (2) sourceBlockRefs are valid AtlusAI IDs, (3) no hallucinated content. Relevance criteria: industry tag includes brief's industry OR cross-industry, pillar tag includes primary/secondary pillar, content_type matches deck section. At least 80% of slides must pass all three. sourceBlockRef validation: every slide in SlideJSON must have a non-empty sourceBlockRef pointing to a real AtlusAI document. Synthesized slides exempt but explicitly marked. Quality report: JSON/markdown report per test run.

### Claude's Discretion
- Final deck length (8-18 slides) based on brief complexity (number of use cases, pillars)
- Per-slide vs batch copy generation approach
- Brand voice enforcement approach (retrieve from AtlusAI vs hardcoded guidelines in prompt)
- Gemini prompt engineering for slide selection and copy generation
- ContentAgent and CopywritingAgent architecture decisions
- How to handle slides with minimal text content in copy generation
- Error handling for sparse AtlusAI results (what if an industry has few slides?)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONT-05 | System retrieves relevant slide blocks from AtlusAI using industry + solution pillar + funnel stage as filter parameters | Multi-pass retrieval strategy using extended `searchSlides()` with structured filters, existing Drive API search, and metadata-based filtering via `SlideMetadataSchema` fields |
| CONT-06 | System enforces brand compliance by restricting asset generation to pre-approved AtlusAI building blocks -- no AI-generated layouts or hallucinated capabilities | sourceBlockRef validation on every slide, synthesized slides explicitly marked, Gemini constrained to only reference retrieved content blocks, brand voice hardcoded in prompt |
| ASSET-01 | System assembles a custom slide order as structured JSON (slide title, bullets, speaker notes, source block reference) using the approved brief and retrieved content blocks | Extended `SlideAssemblyLlmSchema` with sectionType and sourceType fields, fixed section template ordering, Gemini structured output assembly |
| ASSET-02 | System generates bespoke copy for each slide block, grounded in the approved brief and constrained to Lumenalta's voice and positioning | Per-slide copy generation via Gemini with brief context injection, title preservation, bullet rewriting, fresh speaker notes generation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @google/genai | ^1.43.0 | Gemini 2.5 Flash structured output | Already used in all workflow steps (parseTranscript, mapPillars, ROI framing, slide selection) |
| @mastra/core | ^1.8.0 | Workflow steps, suspend/resume | Touch 4 workflow already has 8 steps; Phase 7 adds 3 more |
| googleapis | ^144.0.0 | Drive API for AtlusAI search fallback | searchSlides() uses Drive API fullText search as primary mechanism |
| zod | ^4.3.6 | Schema definition and validation | All LLM schemas use Zod v4 with `.meta()` for Gemini descriptions |
| @lumenalta/schemas | workspace:* | Shared schema package | SlideAssemblyLlmSchema, SalesBriefLlmSchema, constants already defined here |
| @prisma/client | ^6.3.1 | Database access (Brief model) | Brief model has all fields needed as RAG query inputs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.21.0 | Script runner for verification scripts | Running the 3-industry quality verification test suite |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Drive API search | AtlusAI MCP tools | MCP tools require Claude Code internal auth (401 from standalone). Drive API is the established fallback used in all Touch workflows |
| Gemini 2.5 Flash | Gemini 2.5 Pro | Pro has better reasoning but higher latency/cost. Flash is already proven for structured output in this codebase |
| Per-slide copy gen | Batch copy gen (all slides at once) | Per-slide gives higher quality but more API calls. Batch is faster but risks lower quality on individual slides. Recommend per-slide for quality |

**Installation:**
No new dependencies required. All libraries are already installed in apps/agent.

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
  lib/
    atlusai-search.ts          # EXTEND: add searchForProposal() multi-pass retrieval
    slide-selection.ts          # Reference only (Touch 2/3 pattern)
    proposal-assembly.ts       # NEW: SlideJSON assembly + copy generation logic
  mastra/
    workflows/
      touch-4-workflow.ts      # EXTEND: add 3 new steps after finalizeApproval
  scripts/
    verify-rag-quality.ts      # NEW: 3-industry quality verification script
packages/schemas/
  llm/
    slide-assembly.ts          # EXTEND: add sectionType, sourceType fields
    proposal-copy.ts           # NEW: per-slide copy generation schema
  constants.ts                 # Already has INDUSTRIES, SOLUTION_PILLARS, etc.
```

### Pattern 1: Multi-Pass Retrieval (extends existing searchSlides)
**What:** A new `searchForProposal()` function that executes multiple targeted queries against AtlusAI content and merges results with deduplication.
**When to use:** Phase 7 RAG retrieval step (replaces the single-query approach used by Touch 2/3).
**Example:**
```typescript
// Source: Derived from existing atlusai-search.ts searchSlides() pattern
export async function searchForProposal(params: {
  industry: string;
  subsector: string;
  primaryPillar: string;
  secondaryPillars: string[];
  useCases: { name: string; description: string }[];
  limit?: number;
}): Promise<ProposalSearchResult> {
  const allCandidates = new Map<string, SlideSearchResult>();

  // Pass 1: Primary pillar slides (industry + pillar + "Solution Proposal")
  const primaryResults = await searchSlides({
    query: `${params.primaryPillar} ${params.industry} solution proposal`,
    industry: params.industry,
    limit: params.limit ?? 20,
  });
  for (const r of primaryResults) allCandidates.set(r.slideId, r);

  // Pass 2: Secondary pillar slides (smaller limit per pillar)
  for (const pillar of params.secondaryPillars) {
    const secondaryResults = await searchSlides({
      query: `${pillar} ${params.industry}`,
      industry: params.industry,
      limit: 5,
    });
    for (const r of secondaryResults) allCandidates.set(r.slideId, r);
  }

  // Pass 3: Case study slides (dedicated content_type filter)
  const caseStudyResults = await searchSlides({
    query: `case study ${params.industry} ${params.subsector}`,
    industry: params.industry,
    limit: 5,
  });
  for (const r of caseStudyResults) allCandidates.set(r.slideId, r);

  return {
    candidates: Array.from(allCandidates.values()),
    primaryCount: primaryResults.length,
    secondaryCount: /* sum of secondary results */,
    caseStudyCount: caseStudyResults.length,
  };
}
```

### Pattern 2: Gemini Structured Output + Zod Round-Trip (established)
**What:** Send prompt to Gemini 2.5 Flash with `responseMimeType: "application/json"` and `responseSchema` from `zodToGeminiSchema()`, then parse response with `Zod.parse()`.
**When to use:** Every LLM call in this phase (slide selection, copy generation).
**Example:**
```typescript
// Source: Established pattern from touch-4-workflow.ts
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: zodToGeminiSchema(ExtendedSlideAssemblyLlmSchema) as Record<string, unknown>,
  },
});

const text = response.text ?? "";
const parsed = ExtendedSlideAssemblyLlmSchema.parse(JSON.parse(text));
```

### Pattern 3: Workflow Step Extension (append to existing workflow)
**What:** Add new `createStep()` steps to the touch-4-workflow chain after `finalizeApproval`.
**When to use:** Phase 7 plugs into the existing 8-step workflow as steps 9, 10, 11.
**Example:**
```typescript
// Source: touch-4-workflow.ts pattern
const ragRetrieval = createStep({
  id: "rag-retrieval",
  inputSchema: z.object({
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    // ... other fields from finalizeApproval output
  }),
  outputSchema: z.object({
    // ... retrieval results + brief passthrough
    candidates: z.array(candidateSlideSchema),
    retrievalMetrics: retrievalMetricsSchema,
  }),
  execute: async ({ inputData }) => {
    // Call searchForProposal with brief data
    // Return candidates for next step
  },
});

// Chain: .then(finalizeApproval).then(ragRetrieval).then(assembleSlideJSON).then(generateCopy)
```

### Pattern 4: Synthesized Slides (new pattern for Phase 7)
**What:** Title/context slides are generated from brief data, not retrieved from AtlusAI. They are explicitly marked with `sourceType: "synthesized"` and have no `sourceBlockRef`.
**When to use:** First 1-2 slides of every deck (Title, Problem Restatement).
**Example:**
```typescript
// Synthesized slide has empty sourceBlockRef, sourceType="synthesized"
{
  slideTitle: `${brief.companyName} - Solution Proposal`,
  bullets: [
    `Industry: ${brief.industry}`,
    `Primary Focus: ${brief.primaryPillar}`,
    brief.customerContext.substring(0, 200),
  ],
  speakerNotes: `Opening context slide. Restate the customer's situation...`,
  sourceBlockRef: "",
  sectionType: "title_context",
  sourceType: "synthesized",
}
```

### Anti-Patterns to Avoid
- **Inventing slide IDs:** Gemini must ONLY select from the provided candidate list. The prompt must explicitly constrain this (already proven in Touch 2/3 prompts with "ONLY return slide IDs from the provided candidate list").
- **Single monolithic LLM call:** Do not try to retrieve, select, assemble, AND generate copy in one Gemini call. Split into 3 separate steps for reliability and debuggability.
- **Treating Drive API search as semantic search:** Drive fullText search is keyword-based, not semantic. Construct queries with explicit terms from the brief (industry name, pillar name, subsector), not abstract descriptions.
- **Skipping sourceBlockRef validation:** Every non-synthesized slide MUST have a valid sourceBlockRef that maps to a real AtlusAI document ID. The quality verification script must check this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide metadata filtering | Custom metadata parser | Parse `SlideSearchResult.metadata` JSON (already contains `SlideMetadata` fields from classify-metadata.ts) | Metadata is already stored as JSON in Google Doc descriptions during ingestion |
| Gemini structured output | Custom JSON extraction | `zodToGeminiSchema()` + `responseMimeType: "application/json"` | Established project pattern, proven with 10 LLM schemas |
| Workflow step management | Custom step orchestration | Mastra `createStep()` + `.then()` chaining | 8 steps already work in touch-4-workflow.ts |
| Brief data access | Custom brief fetching | Prisma `brief.findUniqueOrThrow()` with relations | Brief model has all needed fields (primaryPillar, secondaryPillars, useCases, industry via InteractionRecord) |
| ID deduplication | Custom dedup logic | JavaScript `Map<string, SlideSearchResult>` keyed by slideId | Simple, already the standard pattern for merging search results |

**Key insight:** Phase 7's complexity is in prompt engineering and pipeline orchestration, not in infrastructure. Every infrastructure building block already exists. The new code is: (1) multi-pass search queries, (2) assembly/selection prompts, (3) copy generation prompts, and (4) verification scripts.

## Common Pitfalls

### Pitfall 1: Drive API Search Returns Irrelevant Results
**What goes wrong:** Drive fullText search is keyword-based and returns documents that contain the search terms anywhere, not necessarily relevant slides.
**Why it happens:** The existing `searchSlides()` function concatenates query + industry + touchType into a single fullText search string. For Phase 7's more nuanced retrieval (pillar-specific, use-case-driven), this produces noisy results.
**How to avoid:** Use specific, narrow search queries per retrieval pass. Primary pillar query should include the exact pillar name + industry. Case study query should include "case study" + industry + subsector. Post-filter results by parsing the metadata JSON from document descriptions to verify industry/pillar/contentType match.
**Warning signs:** Retrieval quality verification shows less than 80% metadata match rate.

### Pitfall 2: SlideAssemblyLlmSchema Extension Breaking Gemini
**What goes wrong:** Adding new fields (sectionType, sourceType) to the existing schema could break Gemini's structured output if the schema becomes too complex or uses unsupported Zod features.
**Why it happens:** Gemini has limits on JSON schema complexity. Zod v4 optionals and unions are explicitly forbidden in this project's LLM schemas.
**How to avoid:** Keep new fields as required strings (not optional, not enum). Test the extended schema with `zodToGeminiSchema()` before using it in LLM calls. Follow the established "Gemini-safe: no transforms, no optionals, no unions" convention.
**Warning signs:** Gemini returns empty or malformed JSON for the new schema.

### Pitfall 3: Over-Long Prompts From Candidate Slide Content
**What goes wrong:** Over-retrieving 20-30 slides with full text content creates prompts that exceed Gemini's context window or reduce output quality.
**Why it happens:** Each slide's textContent can be 500+ characters, and 30 slides * 500 chars = 15,000 chars just for candidates.
**How to avoid:** Truncate candidate slide content in prompts (already done in slide-selection.ts: `textContent.substring(0, 500)` and `speakerNotes.substring(0, 300)`). Consider more aggressive truncation for Phase 7 since we pass more context (brief data, use cases).
**Warning signs:** Gemini produces lower-quality selections or starts ignoring slides late in the candidate list.

### Pitfall 4: Copy Generation Hallucinating Capabilities
**What goes wrong:** Gemini invents capabilities, statistics, or claims not present in either the source slide content or the approved brief.
**Why it happens:** LLMs naturally "fill in" when given insufficient context or when the prompt doesn't explicitly constrain output.
**How to avoid:** The copy generation prompt must explicitly include: (1) the source slide's original text content, (2) the approved brief fields, and (3) a constraint: "ONLY use information from the provided source content and brief. Do NOT introduce new capabilities, statistics, or claims." CONT-06 requires this.
**Warning signs:** Quality verification finds slides with content not traceable to either source block or brief.

### Pitfall 5: Empty/Sparse AtlusAI Results for Specific Industries
**What goes wrong:** Some industries may have few or no slides in AtlusAI, causing the retrieval step to return insufficient candidates.
**Why it happens:** CONT-04 requires all 11 industries represented, but this is Phase 2 scope and may not be complete.
**How to avoid:** Implement graceful degradation: if fewer than 3 slides are retrieved for a pillar, broaden the search to cross-industry slides. Include a fallback query without industry filter. The quality report should flag industries with sparse results.
**Warning signs:** Quality verification script reports an industry with <3 slides retrieved.

### Pitfall 6: Workflow Output Schema Growing Too Large
**What goes wrong:** Each workflow step must pass all data forward via output schema. Adding retrieval results + SlideJSON + copy to the chain creates very large intermediate objects.
**Why it happens:** Mastra workflow steps use input/output schemas that must declare all passed-through data.
**How to avoid:** Store retrieval results and SlideJSON in the database (new fields on Brief or new model) rather than passing the full content through workflow step outputs. Pass only IDs/references through the workflow chain.
**Warning signs:** Workflow steps fail with serialization errors or Mastra storage issues.

## Code Examples

Verified patterns from existing codebase:

### Multi-Pass Retrieval Query Construction
```typescript
// Source: apps/agent/src/lib/atlusai-search.ts (searchSlides pattern)
// Extended for Phase 7 multi-pass approach

// Structured filter: industry + pillar + funnel stage
const primaryQuery = `${brief.primaryPillar} ${brief.industry} solution proposal capabilities`;
const primaryResults = await searchSlides({
  query: primaryQuery,
  industry: brief.industry,
  limit: 20,
});

// Case study pass: content_type filter via query terms
const caseStudyQuery = `case study ${brief.industry} ${brief.subsector} results outcomes`;
const caseStudyResults = await searchSlides({
  query: caseStudyQuery,
  industry: brief.industry,
  limit: 5,
});
```

### Post-Retrieval Metadata Filtering
```typescript
// Source: atlusai-search.ts parseDocumentDescription() + SlideMetadataSchema
// Filter candidates by parsed metadata to enforce structured constraints

import { SlideMetadataSchema } from "@lumenalta/schemas";

function filterByMetadata(
  candidates: SlideSearchResult[],
  industry: string,
  pillar: string,
): SlideSearchResult[] {
  return candidates.filter((slide) => {
    const meta = slide.metadata;
    // Check if metadata was parsed successfully
    try {
      const parsed = SlideMetadataSchema.parse(meta);
      const industryMatch = parsed.industries.includes(industry as any)
        || parsed.industries.length === 0; // cross-industry
      const pillarMatch = parsed.solutionPillars.some(
        (p) => p.toLowerCase().includes(pillar.toLowerCase())
      );
      return industryMatch && pillarMatch;
    } catch {
      // If metadata doesn't parse, include slide but flag it
      return true;
    }
  });
}
```

### Extended SlideAssembly Schema
```typescript
// Source: packages/schemas/llm/slide-assembly.ts (extended)
// New fields: sectionType, sourceType

export const ExtendedSlideAssemblyLlmSchema = z.object({
  slides: z.array(
    z.object({
      slideTitle: z.string().meta({
        description: "Title text for this slide.",
      }),
      bullets: z.array(z.string()).meta({
        description: "Bullet point content for the slide body.",
      }),
      speakerNotes: z.string().meta({
        description: "Speaker notes with talking points for the presenter.",
      }),
      sourceBlockRef: z.string().meta({
        description:
          "AtlusAI content block ID that sourced this slide. Empty string for synthesized slides.",
      }),
      sectionType: z.string().meta({
        description:
          "Deck section: title_context, problem_restatement, primary_capability, secondary_capability, case_study, roi_outcomes, next_steps.",
      }),
      sourceType: z.string().meta({
        description:
          "Source origin: retrieved (from AtlusAI) or synthesized (generated from brief data).",
      }),
    })
  ).meta({
    description: "Ordered list of slides for the proposal deck.",
  }),
});
```

### Workflow Step Integration
```typescript
// Source: touch-4-workflow.ts createStep pattern
// Phase 7 step added after finalizeApproval

const ragRetrieval = createStep({
  id: "rag-retrieval",
  inputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    decision: z.enum(["approved"]),
    reviewerName: z.string(),
  }),
  outputSchema: z.object({
    interactionId: z.string(),
    briefId: z.string(),
    briefData: SalesBriefLlmSchema,
    roiFramingData: ROIFramingLlmSchema,
    candidateCount: z.number(),
    retrievalSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Fetch full brief from DB for industry context
    const brief = await prisma.brief.findUniqueOrThrow({
      where: { id: inputData.briefId },
      include: {
        interaction: {
          include: { deal: { include: { company: true } } },
        },
      },
    });

    const industry = brief.interaction.deal.company.industry;
    const subsector = brief.interaction.transcript
      ? /* get subsector */ ""
      : "";

    // Multi-pass retrieval
    const result = await searchForProposal({
      industry,
      subsector,
      primaryPillar: inputData.briefData.primaryPillar,
      secondaryPillars: inputData.briefData.secondaryPillars,
      useCases: inputData.briefData.useCases,
    });

    // Store candidates (via DB or pass through)
    // ...

    return {
      interactionId: inputData.interactionId,
      briefId: inputData.briefId,
      briefData: inputData.briefData,
      roiFramingData: inputData.roiFramingData,
      candidateCount: result.candidates.length,
      retrievalSummary: `Retrieved ${result.candidates.length} candidates (${result.primaryCount} primary, ${result.secondaryCount} secondary, ${result.caseStudyCount} case studies)`,
    };
  },
});
```

### Quality Verification Script Pattern
```typescript
// Source: apps/agent/src/validation/validate-schemas.ts pattern
// New: apps/agent/src/scripts/verify-rag-quality.ts

const TEST_BRIEFS = [
  {
    name: "Financial Services - Digital Banking",
    industry: "Financial Services & Insurance",
    subsector: "Digital Banking",
    primaryPillar: "Platform & Application Development",
    secondaryPillars: ["Data Modernization"],
    useCases: [
      { name: "Mobile Banking Modernization", description: "..." },
      { name: "Data Analytics Platform", description: "..." },
    ],
  },
  {
    name: "Healthcare - Telehealth",
    industry: "Health Care",
    subsector: "Telehealth",
    primaryPillar: "AI, ML & LLM",
    secondaryPillars: ["Cloud & Infrastructure"],
    useCases: [
      { name: "AI-Powered Triage", description: "..." },
      { name: "Cloud Infrastructure Migration", description: "..." },
    ],
  },
  {
    name: "Technology - Enterprise Software",
    industry: "Technology, Media & Telecommunications",
    subsector: "Enterprise Software",
    primaryPillar: "Cloud & Infrastructure",
    secondaryPillars: ["Platform & Application Development"],
    useCases: [
      { name: "Cloud-Native Architecture", description: "..." },
      { name: "Developer Platform", description: "..." },
    ],
  },
];

// For each test brief:
// 1. Run searchForProposal()
// 2. Run assembleSlideJSON() with retrieved candidates
// 3. Validate: industry match, pillar match, sourceBlockRef exists, no hallucination
// 4. Generate quality report
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-query Drive search (Touch 2/3) | Multi-pass retrieval with metadata filtering (Phase 7) | Phase 7 | More precise retrieval for complex proposal decks |
| Whole-slide selection (Touch 2/3 select entire existing slides) | Block-level retrieval + custom copy generation (Phase 7) | Phase 7 | Bespoke decks rather than slide-swapping |
| Direct deck assembly (Touch 2/3 build Google Slides immediately) | SlideJSON intermediate representation (Phase 7) | Phase 7 | Decouples content from rendering, enables HITL-2 review |

**Key architectural difference from Touch 2/3:** Touch 2/3 select whole slides by objectId from a single source presentation and assemble via copy-and-prune. Phase 7 retrieves content blocks from across the entire AtlusAI knowledge base, generates custom copy for each, and produces a JSON representation that Phase 8 will render into Google Slides. The SlideJSON is the new intermediate artifact -- it did not exist before.

## Discretion Recommendations

### Deck Length: Dynamic Based on Brief Complexity
Recommend: `slideCount = 2 (synthesized) + min(3, useCases.length) * 2 + 2 (case study) + 1 (ROI) + 1 (next steps)`. For a typical 3-use-case brief with 1 primary + 1 secondary pillar, this produces ~12 slides. Floor of 8, ceiling of 18. Encode the formula in the assembly step, not hardcoded.

### Copy Generation: Per-Slide (Not Batch)
Recommend per-slide copy generation. Rationale: (1) each slide needs its source block content + brief context in the prompt for grounding, (2) per-slide gives better quality control, (3) failures are isolated (one bad copy doesn't ruin the batch), (4) easier to debug and test. The latency cost (8-12 sequential Gemini calls) is acceptable since this is an async workflow.

### Brand Voice: Hardcoded Guidelines in Prompt
Recommend hardcoding brand voice guidelines directly in the copy generation prompt rather than retrieving from AtlusAI. Rationale: (1) brand guidelines are static and known, (2) retrieving them adds a search step and parsing complexity, (3) the guidelines are short enough to include directly (Lumenalta's voice: professional, outcome-focused, concise, avoids jargon). Include 3-5 example bullet rewrites in the prompt for few-shot learning.

### ContentAgent vs CopywritingAgent Architecture
Recommend: do NOT create separate Mastra Agents. Instead, implement as plain workflow steps (createStep). Rationale: (1) Mastra Agents add complexity (tool registration, agent config) that is unnecessary here, (2) the existing codebase uses workflow steps for all LLM interactions, (3) "ContentAgent" and "CopywritingAgent" are logical concepts that map cleanly to steps `rag-retrieval`, `assemble-slide-json`, and `generate-copy`. Use function modules (`proposal-assembly.ts`) for the business logic, called from workflow steps.

### Handling Minimal Text Content Slides
Recommend: if a source slide has fewer than 20 words of text content, skip copy rewriting and use the original text as-is. These are typically divider slides, title slides, or icon-heavy slides where rewriting would produce awkward results. Flag them in SlideJSON with a `minimalContent: true` indicator.

### Error Handling for Sparse AtlusAI Results
Recommend three-tier fallback: (1) If primary pillar returns <3 slides, broaden search to remove industry filter. (2) If still <3, fall back to cross-industry general capability slides. (3) If total candidates after all passes <5, add a warning to the quality report but proceed with available slides. Never fail the workflow -- always produce a SlideJSON, even if thin.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | tsx script runner (no test framework -- follows existing validate-schemas.ts pattern) |
| Config file | none -- standalone scripts with process.exit codes |
| Quick run command | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts --industry "Financial Services & Insurance"` |
| Full suite command | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-05 | Retrieval returns slides matching industry + pillar + funnel stage | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | Wave 0 |
| CONT-06 | Every non-synthesized slide has valid sourceBlockRef, no hallucinated layouts | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | Wave 0 |
| ASSET-01 | SlideJSON contains ordered array with required fields | unit (schema) | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts --schema-only` | Wave 0 |
| ASSET-02 | Copy is grounded in brief language and source content | integration | `npx tsx --env-file=.env src/scripts/verify-rag-quality.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** Schema validation (Zod parse round-trip)
- **Per wave merge:** Full 3-industry quality verification
- **Phase gate:** Full suite green with >=80% metadata match rate before Phase 8

### Wave 0 Gaps
- [ ] `apps/agent/src/scripts/verify-rag-quality.ts` -- covers CONT-05, CONT-06, ASSET-01, ASSET-02
- [ ] `apps/agent/src/scripts/test-briefs.ts` -- 3 mock approved brief fixtures (Financial Services, Healthcare, Technology)

## Open Questions

1. **AtlusAI Content Coverage**
   - What we know: Phase 2 ran ingestion scripts. ~9,642 documents exist in AtlusAI. Slide-level documents were created in the `_slide-level-ingestion` folder.
   - What's unclear: How many slides per industry/pillar combination actually exist? Is there enough content for all 11 industries?
   - Recommendation: The quality verification script will surface gaps. If an industry has <3 slides, the three-tier fallback strategy handles it gracefully.

2. **Drive API Search Quality for Complex Queries**
   - What we know: Drive fullText search is keyword-based, not semantic. It works for simple queries (Touch 2/3).
   - What's unclear: Whether multi-term queries (e.g., "Platform & Application Development Financial Services solution proposal") return relevant results or produce too much noise.
   - Recommendation: Use narrow, specific queries per pass. Post-filter by metadata. The quality verification script will measure actual precision.

3. **Workflow Step Count Impact on Mastra**
   - What we know: touch-4-workflow currently has 8 steps. Phase 7 adds 3 more (11 total).
   - What's unclear: Whether Mastra handles 11+ step workflows without performance degradation.
   - Recommendation: Monitor workflow execution time. If problematic, the 3 Phase 7 steps could be extracted into a separate workflow triggered after touch-4 completes.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `apps/agent/src/lib/atlusai-search.ts`, `slide-selection.ts`, `proposal-assembly.ts` patterns
- Existing codebase analysis: `apps/agent/src/mastra/workflows/touch-4-workflow.ts` (8-step pipeline pattern)
- Existing codebase analysis: `packages/schemas/llm/slide-assembly.ts` (SlideAssemblyLlmSchema)
- Existing codebase analysis: `packages/schemas/llm/slide-metadata.ts` (SlideMetadataSchema for post-retrieval filtering)
- Existing codebase analysis: `apps/agent/src/ingestion/classify-metadata.ts` (metadata classification pipeline)

### Secondary (MEDIUM confidence)
- Phase 7 CONTEXT.md locked decisions (implementation direction from user discussion)

### Tertiary (LOW confidence)
- None -- all findings derived from existing codebase and locked decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Extends proven patterns (workflow steps, Gemini structured output, Drive API search)
- Pitfalls: HIGH - Derived from existing codebase behavior and Drive API known limitations
- Copy generation quality: MEDIUM - Prompt engineering quality depends on iteration

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- all core patterns are established in the codebase)
