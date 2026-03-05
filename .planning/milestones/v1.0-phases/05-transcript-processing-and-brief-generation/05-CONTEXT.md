# Phase 5: Transcript Processing and Brief Generation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Seller pastes a raw transcript, selects industry and subsector, receives structured field extraction with missing-field warnings via a workflow suspend/resume review step, and sees a complete Multi-Pillar Sales Brief with ROI outcome statements. All transcripts, extracted fields, and generated briefs are persisted and indexed for future retrieval. Building the HITL brief approval checkpoint (Phase 6), slide generation (Phase 7+), or pre-call briefing (Phase 10) is out of scope.

</domain>

<decisions>
## Implementation Decisions

### Missing field handling
- Workflow suspends after field extraction for seller review (reuses Mastra suspend/resume pattern from Touch 1)
- Seller can view AND edit all 6 extracted fields during the suspended review — enables filling in missing data from memory (e.g., budget discussed off-transcript)
- Tiered severity: Customer Context and Business Outcomes are hard requirements — seller MUST fill these in if empty. Timeline, Budget, Constraints, and Stakeholders are warning-only — seller acknowledges but can proceed with gaps
- After seller clicks "Continue" on the field review, the workflow auto-resumes through pillar mapping, brief generation, and ROI framing — no separate "Generate Brief" button

### Brief presentation & layout
- Structured cards per section, vertical scroll — reuses shadcn/ui Card component
- Primary solution pillar gets a prominent badge/highlight with supporting evidence displayed; secondary pillars listed in a compact format below
- Each use case rendered as its own visible card with ROI outcomes and value hypothesis shown inline — no accordion/expand, all visible (typically 2-4 use cases)
- Brief display shows only the generated brief content (pillars, use cases, ROI) — extracted fields were already reviewed in the previous step, no need to repeat

### Pipeline experience
- Single Mastra workflow with one suspend point: parseTranscript → validateFields → [suspend for seller review] → mapPillars → generateBrief → roiFraming → recordInteraction
- Step-by-step progress indicators during processing: "Extracting fields...", "Mapping solution pillars...", "Generating brief...", "Framing ROI outcomes..." — reuses GenerationProgress component from Touch 1
- After brief is generated: brief displayed on screen AND a summary card appears on the deal page interaction timeline (consistent with Touch 1 result pattern)
- Full persistence (DATA-02): raw transcript text, extracted fields, and generated brief stored as structured data in the database — not just JSON blobs in InteractionRecord

### Transcript form & subsectors
- Touch 4 card on the unified deal page alongside Touch 1/2/3 — clicking opens the transcript form; company and industry pre-filled from deal record
- Cascading dropdowns: seller picks industry (11 items), then a second dropdown appears with subsectors filtered for that industry (from 62 total) — uses existing shadcn/ui Select component
- 62 subsectors defined as `SUBSECTORS: Record<Industry, string[]>` in `packages/schemas/constants.ts` alongside the existing INDUSTRIES constant — single source of truth
- Large freeform textarea for transcript with placeholder text showing example format/guidance
- Optional "Additional meeting notes" field where seller can add context not captured in the transcript
- No word count or format constraints on transcript — Gemini 2.5 Flash's large context window handles noisy text

### Claude's Discretion
- Exact Prisma model additions for transcript/brief persistence (new fields on InteractionRecord vs. new Transcript/Brief models)
- Prompt engineering for each Gemini step (parseTranscript, mapPillars, generateBrief, roiFraming)
- The actual 62 subsector values per industry (research Lumenalta's taxonomy)
- Loading skeleton and error state designs
- Step progress component implementation details
- Field review form layout and warning/error visual treatment

</decisions>

<specifics>
## Specific Ideas

- The field review step should feel like a "data quality checkpoint" — seller sees what the AI extracted, fills in gaps, corrects errors, then the pipeline continues with clean data
- Step-by-step progress should make the pipeline feel transparent, not opaque — seller knows what's happening at each stage
- The deal page timeline growing with each touch point is a demo showpiece — Touch 4's brief card joins Touch 1's pager card in the history
- Tiered severity mirrors real-world: you can write a brief without knowing the budget, but you cannot write one without understanding the customer's problems

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/llm/transcript-fields.ts`: TranscriptFieldsLlmSchema — all 6 fields defined, Gemini-validated
- `packages/schemas/llm/sales-brief.ts`: SalesBriefLlmSchema — includes useCases array with roiOutcome and valueHypothesis per case
- `packages/schemas/llm/roi-framing.ts`: ROIFramingLlmSchema — 2-3 ROI outcomes + value hypothesis per use case
- `packages/schemas/constants.ts`: INDUSTRIES (11 items), TOUCH_TYPES — subsectors to be added here
- `packages/schemas/gemini-schema.ts`: zodToGeminiSchema() helper for Gemini structured output
- `apps/agent/src/mastra/workflows/touch-1-workflow.ts`: Reference implementation for Mastra workflow with suspend/resume, Gemini content generation, interaction recording, AtlusAI ingestion
- `apps/web/src/components/touch/touch-1-form.tsx`: Reference for form + polling + multi-state UI pattern (input → generating → review → assembling → result)
- `apps/web/src/components/touch/generation-progress.tsx`: Reusable progress indicator component
- `apps/web/src/components/touch/deck-preview.tsx`: Result display component
- `apps/web/src/components/touch/touch-flow-card.tsx`: Touch flow card on deal page — Touch 4 card will match this pattern
- `apps/web/src/lib/actions/touch-actions.ts`: Server actions pattern for web → agent communication
- `apps/web/src/components/timeline/interaction-timeline.tsx`: Deal page timeline — brief results will appear here
- `apps/web/src/components/ui/card.tsx`, `select.tsx`, `textarea.tsx`, `badge.tsx`, `form.tsx`: shadcn/ui components for the form and brief display

### Established Patterns
- Mastra workflow with createWorkflow/createStep + suspend/resume for HITL review
- Gemini 2.5 Flash structured output with zodToGeminiSchema + Zod .parse() round-trip
- Server actions → API client → Mastra workflow trigger + polling for status
- InteractionRecord + FeedbackSignal capture on every touch flow
- Unified deal page with touch flow cards, each following input → progress → result state machine

### Integration Points
- `apps/agent/src/mastra/index.ts` — register new workflow + API routes for transcript processing
- `apps/web/src/app/deals/[dealId]/page.tsx` — add Touch 4 flow card
- `apps/agent/prisma/schema.prisma` — may need new models or fields for transcript/brief persistence
- `packages/schemas/constants.ts` — add SUBSECTORS constant
- `apps/web/src/lib/actions/` — new server actions for transcript workflow
- `apps/web/src/lib/api-client.ts` — new API client functions for transcript workflow

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-transcript-processing-and-brief-generation*
*Context gathered: 2026-03-03*
