# Phase 7: RAG Retrieval and Slide Block Assembly - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Given an approved brief (Phase 6 output), retrieve relevant slide blocks from AtlusAI, assemble them into an ordered structured JSON representation (SlideJSON), and generate bespoke copy for each block — all constrained to pre-approved building blocks. Building the Google Slides deck (Phase 8), the HITL-2 review UI (Phase 9), or any new UI components is out of scope — this phase delivers the SlideJSON intermediate representation with quality-verified RAG retrieval.

</domain>

<decisions>
## Implementation Decisions

### Retrieval strategy
- Hybrid approach: structured filter first (industry + solution pillar + funnel stage = "Solution Proposal") to narrow candidates, then semantic search within results using brief context (customer context, business outcomes, use cases)
- Over-retrieve 20-30 candidate slides, then use Gemini to select the best 8-12 for the final deck based on brief alignment (mirrors Touch 2/3 AI selection pattern)
- Weighted multi-pillar retrieval: primary pillar gets ~70% of slide budget (6-8 slides), each secondary pillar gets ~15% (1-2 slides)
- Dedicated case study retrieval pass: separate query for case studies matching customer's industry/subsector (content_type="case_study"), include 1-2 case study slides as social proof

### Deck structure & slide ordering
- Fixed section template: Title/Context → Problem Restatement → Primary Pillar Capabilities → Secondary Pillar Capabilities → Case Studies → ROI/Outcomes → Next Steps
- AI fills sections with retrieved slides but does NOT rearrange the section order
- Use case-driven sections: each use case from the brief maps to a mini-section of 1-2 slides (one capability slide + one case study or ROI slide)
- Auto-generated title/context slides (first 1-2 slides) synthesized from approved brief data — customer name, industry context, problem restatement — NOT retrieved from AtlusAI
- Synthesized slides explicitly marked (no sourceBlockRef required, flagged as source="synthesized")

### Copy generation scope
- Slide titles preserved from source template (brand-consistent)
- Bullet text rewritten to connect source capabilities to the customer's specific needs using approved brief data
- Speaker notes generated fresh with talking points for each slide
- Directly personalized: copy uses the customer's actual business outcomes, stakeholders, and constraints from the brief (e.g., "Reduce claims processing time from 5 days to same-day" not generic "Improve processing efficiency")

### Quality verification
- Scripted test briefs: 3 mock approved briefs (Financial Services, Healthcare, Technology) with realistic pillars and use cases
- Automated verification: run RAG pipeline against each, check (1) slides match industry, (2) sourceBlockRefs are valid AtlusAI IDs, (3) no hallucinated content
- Relevance criteria: industry tag includes brief's industry OR cross-industry, pillar tag includes primary/secondary pillar, content_type matches deck section. At least 80% of slides must pass all three
- sourceBlockRef validation: every slide in SlideJSON must have a non-empty sourceBlockRef pointing to a real AtlusAI document. Synthesized slides exempt but explicitly marked
- Quality report: JSON/markdown report per test run showing slides retrieved, metadata match scores, sourceBlockRef validation results, industry coverage gaps, unmapped use cases

### Claude's Discretion
- Final deck length (8-18 slides) based on brief complexity (number of use cases, pillars)
- Per-slide vs batch copy generation approach
- Brand voice enforcement approach (retrieve from AtlusAI vs hardcoded guidelines in prompt)
- Gemini prompt engineering for slide selection and copy generation
- ContentAgent and CopywritingAgent architecture decisions
- How to handle slides with minimal text content in copy generation
- Error handling for sparse AtlusAI results (what if an industry has few slides?)

</decisions>

<specifics>
## Specific Ideas

- The SlideJSON is a pure data structure — no Google API calls in this phase. Phase 8 consumes SlideJSON to create the actual deck
- Over-retrieve-then-select mirrors the Touch 2/3 pattern but at a deeper level — Touch 2/3 select whole slides, Phase 7 selects blocks and generates custom copy
- Use case-driven sections make the deck feel bespoke: "We heard you need X, here's how we solve it" — not a generic capabilities pitch
- Auto-generated context slides that restate the customer's problem show "we listened" before jumping into solutions
- Quality report doubles as a demo artifact — shows the system is verifiably grounded in real content

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/atlusai-search.ts`: searchSlides() and searchByCapability() — existing AtlusAI retrieval patterns with Drive API fallback
- `apps/agent/src/lib/atlusai-client.ts`: ingestDocument() — AtlusAI ingestion via Google Docs (for knowledge base growth)
- `apps/agent/src/lib/slide-assembly.ts`: assembleFromTemplate() — generic template merge (Phase 8 will use this with SlideJSON)
- `apps/agent/src/lib/deck-customizer.ts`: applyDeckCustomizations() — salesperson/customer branding patterns
- `packages/schemas/llm/slide-assembly.ts`: SlideAssemblyLlmSchema — SlideJSON output structure (slideTitle, bullets, speakerNotes, sourceBlockRef)
- `packages/schemas/llm/sales-brief.ts`: SalesBriefLlmSchema — approved brief structure (pillars, useCases, evidence)
- `packages/schemas/llm/roi-framing.ts`: ROIFramingLlmSchema — ROI outcomes per use case
- `packages/schemas/constants.ts`: INDUSTRIES, SOLUTION_PILLARS, FUNNEL_STAGES domain constants
- `packages/schemas/gemini-schema.ts`: zodToGeminiSchema() helper for Gemini structured output
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts`: 8-step workflow — Phase 7 steps plug in after step 8 (finalizeApproval)

### Established Patterns
- Gemini 2.5 Flash structured output: zodToGeminiSchema + JSON parse + Zod .parse() round-trip
- GoogleGenAI SDK: `ai.models.generateContent()` with responseMimeType + responseSchema config
- Mastra workflow steps: createStep with input/output schemas, suspend/resume for HITL
- AtlusAI MCP tools: knowledge_base_search_semantic, knowledge_base_search_structured (available but require Claude Code MCP context)
- Drive API fallback for AtlusAI search when MCP unavailable from standalone scripts

### Integration Points
- `apps/agent/src/mastra/workflows/touch-4-workflow.ts` — add RAGRetrieval, AssembleSlideJSON, GenerateCustomCopy steps after finalizeApproval
- `apps/agent/src/mastra/index.ts` — register updated workflow, may need new API routes for retrieval quality testing
- `apps/agent/prisma/schema.prisma` — Brief model has all fields needed as RAG query inputs (primaryPillar, secondaryPillars, useCases, industry via InteractionRecord)
- AtlusAI MCP tools — primary retrieval mechanism for slide blocks
- `packages/schemas/llm/slide-assembly.ts` — may need extending if additional fields are needed (e.g., sectionType, sourceType)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-rag-retrieval-and-slide-block-assembly*
*Context gathered: 2026-03-04*
