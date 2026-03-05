# Phase 4: Touch 1-3 Asset Generation & Interaction Tracking - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Build three seller-facing GTM asset generation flows (Touch 1 first-contact pager, Touch 2 Meet Lumenalta intro deck, Touch 3 capability alignment deck), the interaction tracking infrastructure that captures all inputs/decisions/outputs across every touch point, and the knowledge base growth pipeline that ingests overrides and approved outputs back into AtlusAI. The slide assembly pipeline is built as a reusable module that Phase 8 extends for Touch 4+ output.

Building the Touch 4+ pipeline (transcript processing, brief generation, HITL checkpoints, RAG retrieval, bespoke copy), pre-call briefing flow, or end-to-end integration polish are out of scope — this phase delivers the three simpler asset flows, interaction tracking, and the reusable assembly module only.

</domain>

<decisions>
## Implementation Decisions

### Flow navigation & seller UX
- Unified deal page: seller enters company name, industry, salesperson name/photo, and customer logo once — shared across all touch types
- Deal page shows three touch flow cards (Touch 1, 2, 3) with availability status
- After generation, results shown with embedded Google Slides iframe preview + direct Drive link
- Deal page includes a full asset timeline showing all prior generated assets for that company across all touch types
- Top-level deals dashboard page listing all companies/deals with industry, touch progress indicators, and last activity — clicking opens the unified deal page

### Touch 1 approve/override loop
- Two-step flow: AI generates pager content (headline, value proposition, key capabilities), seller reviews as a summary card FIRST, approves text, THEN Google Slides deck is assembled from approved content
- Two override paths available: (1) edit AI-generated text fields directly in the web app, then generate deck from revised content; (2) upload a completely custom Google Slides file to replace the AI version entirely
- Both text edit diffs and the final generated/uploaded deck are captured: edited fields stored as feedback signals (what the seller changed), final deck ingested into AtlusAI
- Approved (unmodified) AI pagers are ALSO ingested into AtlusAI as positive examples — knowledge base grows from both approvals and overrides

### Slide selection & deck preview (Touch 2/3)
- AI generates directly end-to-end: AI selects slides and assembles the final deck without an intermediate slide review step
- Seller reviews the final generated deck via embedded iframe preview on the deal page
- Revision paths: seller can regenerate with tweaked inputs (different capability areas, additional context) creating a new version, OR click the Drive link to edit directly in Google Slides — both paths available
- Each regeneration creates a new version; old versions remain in Drive
- Shared slide assembly pipeline: one reusable module handles Touch 2, Touch 3, and later Phase 8 — touch types differ only in slide selection criteria and customization params

### Salesperson/customer customization
- Claude's Discretion: how salesperson photo and customer logo are applied to Touch 2/3 decks — inspect the actual Meet Lumenalta template structure to determine whether template placeholders or a dedicated title slide is the right approach

### Interaction history & continuity
- Company + Deal as separate entities: a Company has many Deals, each deal has a name/context and tracks its own interactions
- Cross-touch context: form pre-fills from deal record (company, industry, salesperson, logo) AND the AI slide selection receives prior touch outputs as context — e.g., if Touch 1 emphasized fintech, Touch 2 weights fintech-related slides higher
- Full detail timeline on deal page: each entry shows touch type, timestamp, status (approved/overridden/edited), what was generated, what was changed, Drive link — expandable for feedback signals

### Claude's Discretion
- Salesperson photo/logo application approach (template placeholders vs dedicated title slide)
- Per-deal Drive folder naming convention and structure
- Mastra workflow design for each touch flow (step composition, error handling)
- Prisma model exact field definitions for Company, Deal, InteractionRecord, FeedbackSignal
- Loading states and progress indicators during generation
- shadcn/ui component selection for forms, cards, timeline

</decisions>

<specifics>
## Specific Ideas

- Deal page as the central hub — seller never re-enters company info across touch types
- Embedded Google Slides iframe preview keeps the seller in the app while reviewing output
- Two-step Touch 1 flow (text review → deck generation) lets the seller catch content issues before the Slides API round-trip
- Asset timeline on the deal page doubles as a demo showpiece — visually demonstrates the knowledge base growing with each interaction
- "Both paths" philosophy: wherever possible, give sellers the choice between AI-assisted and manual approaches (approve vs override, regenerate vs edit in Slides)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/schemas/llm/pager-content.ts`: PagerContentLlmSchema — Touch 1 content generation (companyName, industry, headline, valueProposition, keyCapabilities, callToAction)
- `packages/schemas/llm/intro-deck-selection.ts`: IntroDeckSelectionLlmSchema — Touch 2 slide selection (selectedSlideIds, slideOrder, personalizationNotes)
- `packages/schemas/llm/capability-deck-selection.ts`: CapabilityDeckSelectionLlmSchema — Touch 3 slide selection (capabilityAreas, selectedSlideIds, slideOrder, personalizationNotes)
- `packages/schemas/llm/slide-assembly.ts`: SlideAssemblyLlmSchema — generic deck structure (reusable for Phase 8)
- `packages/schemas/app/interaction-record.ts`: InteractionRecordSchema — interaction tracking (touchType, companyName, industry, inputs, decision, outputRefs)
- `packages/schemas/app/feedback-signal.ts`: FeedbackSignalSchema — feedback loop signals (signalType, source, content)
- `packages/schemas/constants.ts`: Domain constants (INDUSTRIES, FUNNEL_STAGES, TOUCH_TYPES, etc.)
- `packages/schemas/gemini-schema.ts`: zodToGeminiSchema() helper for Gemini structured output
- `apps/agent/src/lib/google-auth.ts`: getSlidesClient(), getDriveClient(), getDocsClient() factories
- `apps/agent/src/lib/slide-extractor.ts`: extractSlidesFromPresentation() — text + speaker notes extraction
- `apps/agent/src/lib/atlusai-client.ts`: ingestDocument() — AtlusAI ingestion via Google Docs in Drive
- `apps/agent/src/ingestion/build-image-registry.ts`: ImageAsset registry (headshots, logos, icons) in Prisma
- `apps/agent/src/spike/slides-spike.ts`: Reference for Slides API batchUpdate, template copy, objectId resolution

### Established Patterns
- T3 Env (`@t3-oss/env-core`) for env var validation with Zod schemas
- Google API client factories in `apps/agent/src/lib/`
- Dual-database: mastra.db (Mastra internal state) + dev.db (Prisma app records)
- Gemini 2.5 Flash structured output with zodToGeminiSchema + Zod .parse() round-trip
- AtlusAI ingestion via Google Docs in monitored Drive folder (not direct API)
- objectIds are Google-generated — read from presentations.get, never hardcode
- supportsAllDrives: true on all Drive API calls targeting Shared Drive

### Integration Points
- `apps/web/src/app/` — currently placeholder; needs deal pages, flow forms, timeline components
- `apps/web/src/env.ts` — AGENT_SERVICE_URL for web → agent communication
- `apps/agent/src/mastra/index.ts` — Mastra instance with LibSQLStore, ready for workflow definitions
- `apps/agent/prisma/schema.prisma` — WorkflowJob + ImageAsset models; needs Company, Deal, InteractionRecord, FeedbackSignal
- AtlusAI MCP tools: knowledge_base_search_semantic, knowledge_base_search_structured — for AI slide selection in Touch 2/3
- Google Drive shared folder — per-deal subfolders for generated assets

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-touch-1-3-asset-generation-interaction-tracking*
*Context gathered: 2026-03-03*
