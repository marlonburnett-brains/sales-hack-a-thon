# Roadmap: Lumenalta Agentic Sales Orchestration

## Overview

This roadmap builds from the ground up — foundations first, then the critical-path content library, then the intelligence pipeline, then HITL gating, then output generation, and finally the independent pre-call flow. The architecture enforces two hard invariants: AtlusAI must be populated with slide-block-level content before any RAG step can be tested, and HITL Checkpoint 1 must be functional before a single custom proposal slide can be generated. The roadmap follows the 2026 GTM strategy's four sales touch points — from simple template-based first-contact pagers (Touch 1) through AI-assembled intro and capability decks (Touches 2-3) to fully custom solution proposals (Touch 4+). The eleven phases reflect dependency constraints and complexity ordering rather than arbitrary structure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Monorepo Foundation** - Scaffold the monorepo, configure Mastra + Prisma + SQLite, validate Google service account auth, and spike the Google Slides API to de-risk placeholder ID and batchUpdate ordering pitfalls before any production code depends on them
- [ ] **Phase 2: Content Library Ingestion** - Populate AtlusAI with all Lumenalta deck templates (including Meet Lumenalta intro deck, L2 capability decks, and 1-2 pager templates), case studies, brand guidelines, and the image/icon library at slide-block granularity across all 11 industries
- [x] **Phase 3: Zod Schema Layer and Gemini Validation** - Define and validate all Zod v4 schemas (including Touch 1-3 content selection schemas, interaction tracking schemas, and Touch 4 pipeline schemas) against the live Gemini API in isolation so that schema rejection errors are caught before any agent logic is built on top of them
- [x] **Phase 4: Touch 1-3 Asset Generation & Interaction Tracking** - Build the three simpler GTM asset flows (Touch 1 with approve/override feedback loop, Touch 2 intro deck, Touch 3 capability deck), the interaction tracking infrastructure that captures all inputs/decisions/outputs across every touch point, and the knowledge base growth pipeline that ingests overrides and approved outputs back into AtlusAI
- [ ] **Phase 5: Transcript Processing and Brief Generation** - Build the transcript ingestion form, structured extraction pipeline, missing-field validation, solution pillar mapping, and the Multi-Pillar Sales Brief with ROI framing
- [x] **Phase 6: HITL Checkpoint 1 — Brief Approval** - Wire the Mastra workflow suspend/resume at the brief approval checkpoint, build the brief review UI, and verify that durable state survives a server restart before any asset generation is wired up
- [ ] **Phase 7: RAG Retrieval and Slide Block Assembly** - Build the RAG retrieval step against AtlusAI, assemble the structured SlideJSON intermediate representation, and generate bespoke copy for each block within brand compliance constraints
- [ ] **Phase 8: Google Workspace Output Generation** - Create the Google Slides deck, talk track Google Doc, and buyer FAQ Google Doc in shared Lumenalta Drive via the Google Slides and Docs APIs, reusing the slide assembly infrastructure established in Phase 4
- [x] **Phase 9: HITL Checkpoint 2 and Review Delivery UI** - Wire the second HITL checkpoint for final asset review, build the review panel with Drive artifact links, and enforce brand compliance verification before final delivery (completed 2026-03-04)
- [x] **Phase 10: Pre-Call Briefing Flow** - Build the independent pre-call input form, company research pipeline, role-specific hypothesis and discovery question generation, and Drive output (completed 2026-03-04)
- [x] **Phase 11: End-to-End Integration and Demo Polish** - Connect all pipeline steps across all four touch points, validate full runs for each touch type, add step-by-step progress indicators, harden error handling, and produce a demo-ready scenario (completed 2026-03-04)
- [ ] **Phase 12: Content Library Re-ingestion** - Grant Drive service account access to shortcut targets, enable Google Docs API, re-run ingestion pipeline for all deck templates, case studies, brand guidelines, and image library, and verify coverage across all 11 industries (gap closure)
- [ ] **Phase 13: Touch 4 Poll Loop & Integration Fixes** - Wire the asset generation poll loop in touch-4-form.tsx after brief approval, fix pre-call form primary data extraction path, add pre_call label/color to timeline entry, and verify Touch 4 inline E2E flow (gap closure)

## Phase Details

### Phase 1: Monorepo Foundation
**Goal**: The project infrastructure is fully operational and the Google Slides API integration is de-risked before any production code is written
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure phase — unblocks all others)
**Success Criteria** (what must be TRUE):
  1. Developer can run a single command from repo root to start both the Next.js web app and the Mastra agent service
  2. Google service account credentials authenticate successfully and can create a file in the shared Lumenalta Drive folder
  3. A Slides API integration spike successfully duplicates a template slide and inserts text using live placeholder IDs read from the API response (not hardcoded)
  4. Prisma migrations run cleanly and the SQLite database is accessible from the Mastra service
  5. Environment variable validation rejects startup with a clear error message if any required variable is missing
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — pnpm + Turborepo monorepo root scaffold with shared tsconfig, ESLint, schemas packages and both app skeletons
- [x] 01-02-PLAN.md — Mastra instance (LibSQL storage), Prisma schema + migration, T3 Env validation, Google auth factory
- [x] 01-03-PLAN.md — Google service account credential setup (checkpoint) + Slides API spike (copy template, read live objectIds, batchUpdate)

### Phase 2: Content Library Ingestion
**Goal**: AtlusAI is populated with all Lumenalta content at slide-block granularity across all 11 industries — including Meet Lumenalta intro deck slides, L2 capability deck slides, and 1-2 pager templates — so that RAG retrieval is functional for every downstream pipeline and touch point
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. A semantic search query against AtlusAI for any of the 11 industries returns at least one relevant slide block with correct metadata tags (industry, solution pillar, funnel stage, slide category)
  2. A structured filter query (industry + solution pillar + funnel stage) returns only slide blocks matching all three filter parameters
  3. All case studies are retrievable by industry, subsector, solution pillar, and buyer persona
  4. Brand guideline assets (approved image URLs hosted on public GCS) are retrievable from AtlusAI for use during slide assembly
  5. An idempotent ingestion script can re-run without creating duplicate entries
  6. Meet Lumenalta intro deck slides, L2 capability deck slides, and 1-2 pager templates are ingested and retrievable with appropriate touch-type metadata tags
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — AtlusAI MCP tool discovery, Drive content discovery, slide extraction library, Gemini classification, pilot ingestion of 2-3 decks with pillar taxonomy extraction (checkpoint: manifest + pillar list approval)
- [ ] 02-02-PLAN.md — Full bulk ingestion of all deck templates, example proposals, and case studies with content manifest and industry coverage report (checkpoint: manifest review before ingestion)
- [ ] 02-03-PLAN.md — ImageAsset Prisma model, curated image registry build from Drive, and Branded Basics brand guidelines ingestion into AtlusAI

### Phase 3: Zod Schema Layer and Gemini Validation
**Goal**: Every Zod v4 schema used in the pipeline is defined, tested against the live Gemini API, and available as a shared package so that schema rejection cannot surface as a runtime surprise during agent development
**Depends on**: Phase 1
**Requirements**: None (schema layer — directly enables Phase 4 Touch 1-3 flows and Phase 5 agent work)
**Success Criteria** (what must be TRUE):
  1. Each core schema (TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, CompanyResearchSchema) produces a valid JSON Schema when converted and Gemini returns a conforming structured response in an isolated test
  2. Touch 1-3 selection schemas (PagerContentSchema, IntroDeckSelectionSchema, CapabilityDeckSelectionSchema) are defined and validated against Gemini
  3. Interaction tracking schemas (InteractionRecordSchema, FeedbackSignalSchema) are defined for the data capture layer
  4. LLM schemas (flat, no transforms, no unions) are clearly separated from application schemas (post-processing transforms) in the packages/schemas directory
  5. Any schema that fails Gemini structured output mode is fixed in isolation before being used in any workflow step
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Domain constants consolidation, zodToGeminiSchema() helper, all 13 Zod schema definitions (10 LLM + 2 app + 1 consolidated from Phase 2), barrel exports, and classify-metadata.ts import migration
- [x] 03-02-PLAN.md — Gemini round-trip validation script for all 10 LLM schemas with realistic domain prompts, runnable via pnpm validate-schemas

### Phase 4: Touch 1-3 Asset Generation & Interaction Tracking
**Goal**: Sellers can generate the three simpler GTM asset types through dedicated web flows — a first-contact 1-2 pager with approve/override feedback (Touch 1), a Meet Lumenalta intro deck (Touch 2), and a capability alignment deck (Touch 3). Every interaction is tracked, and the knowledge base grows with each use: approved outputs become positive examples, overrides are ingested into AtlusAI for future retrieval, and company interaction history carries forward across touch points.
**Depends on**: Phase 1 (Google Slides API), Phase 2 (content library populated), Phase 3 (selection + interaction schemas)
**Requirements**: TOUCH1-01, TOUCH1-02, TOUCH1-03, TOUCH1-04, TOUCH1-05, TOUCH2-01, TOUCH2-02, TOUCH2-03, TOUCH2-04, TOUCH3-01, TOUCH3-02, TOUCH3-03, TOUCH3-04, DATA-01, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Seller can select a Touch 1 flow, input company name and industry, and receive a suggested branded 1-2 slide Google Slides pager — with the option to approve it or override it with their own custom version
  2. When a seller approves a Touch 1 pager, it is recorded as a successful output; when a seller overrides it, the override is recorded as a learning signal and the seller's custom pager is ingested into AtlusAI for future retrieval
  3. Seller can select a Touch 2 flow, input company details and salesperson info, and receive a Meet Lumenalta intro deck where the system AI-selected relevant slides based on industry and context, with salesperson name/photo and customer name/logo applied
  4. Seller can select a Touch 3 flow, input company details, industry, and 1-2 capability areas, and receive a capability alignment deck with AI-selected slides from AtlusAI and L2 capability decks
  5. All three asset types are saved to per-deal folders in shared Lumenalta Drive with direct links surfaced in the UI
  6. Every interaction across all three flows persists a complete interaction record (inputs, decisions, output references, timestamps) in the database
  7. Interaction history for a company/deal is retrievable so later touch points can reference earlier context
  8. The slide assembly and customization pipeline is built as a reusable module that Phase 8 can extend for Touch 4+ output
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md -- Prisma models (Company, Deal, InteractionRecord, FeedbackSignal), shadcn/ui init, deals dashboard, unified deal page, Touch 1 pager generation with approve/edit/override, slide assembly engine, Drive folder management, interaction tracking timeline
- [x] 04-02-PLAN.md -- Shared slide selection and assembly engine (AtlusAI search, Gemini slide selection, deck assembly pipeline, salesperson/customer customization injection, AtlusAI re-ingestion pipeline)
- [x] 04-03-PLAN.md -- Touch 2 intro deck flow and Touch 3 capability deck flow using shared assembly engine, with interaction capture and Drive output

### Phase 5: Transcript Processing and Brief Generation
**Goal**: A seller can paste a raw transcript, select industry and subsector, receive structured field extraction with specific missing-field warnings, and see a complete Multi-Pillar Sales Brief with ROI outcome statements — all before any HITL checkpoint is encountered. All submitted transcripts and conversation context are stored and indexed for future retrieval.
**Depends on**: Phase 3, Phase 4 (interaction tracking infrastructure)
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, GEN-01, GEN-02, DATA-02
**Success Criteria** (what must be TRUE):
  1. Seller can paste a raw transcript into the web form, select an industry from the 11-item list and a subsector from the 62-item list, and submit for processing
  2. The system returns a structured breakdown with all six fields (Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget) populated where present in the transcript
  3. When a critical field is missing from the transcript, the seller sees a specific warning message (e.g., "Budget not mentioned") and must acknowledge it before the pipeline continues
  4. The generated Sales Brief identifies a primary solution pillar and at least one secondary pillar with evidence drawn from the transcript
  5. The brief includes 2-3 ROI outcome statements and 1 value hypothesis per identified use case
  6. All submitted transcripts and conversation context are persisted and indexed in the interaction tracking system for future retrieval
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md -- SUBSECTORS constant, Prisma Transcript/Brief models, Touch 4 transcript form with cascading dropdowns, API client + server actions, deal page integration
- [ ] 05-02-PLAN.md -- Mastra touch-4-workflow (parseTranscript + validateFields + awaitFieldReview steps), field review UI with tiered severity indicators and editable fields
- [ ] 05-03-PLAN.md -- mapPillarsAndGenerateBrief + generateROIFraming + recordInteraction workflow steps, brief display component with pillar badges and use case cards

### Phase 6: HITL Checkpoint 1 — Brief Approval
**Goal**: A seller and SME can review the complete structured brief in the web app and the workflow hard-stops until explicit approval is given — and that approval state survives a server restart
**Depends on**: Phase 5
**Requirements**: GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. After brief generation, the seller sees the complete Multi-Pillar Sales Brief rendered as formatted cards (not raw JSON) in the web app
  2. The workflow status polling updates the UI in real time (3-second interval) while the brief awaits review
  3. No asset generation step begins until an SME explicitly clicks the approve button in the web app
  4. If the server is restarted after the brief is generated but before it is approved, the workflow resumes correctly when the approve action is submitted
  5. If the brief is rejected, the seller receives feedback and can resubmit a corrected version without starting a new workflow
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md -- Prisma Brief approval fields, Touch 4 workflow restructure (awaitBriefApproval suspend + finalizeApproval), API endpoints for approve/reject/edit/fetch, api-client + server actions
- [x] 06-02-PLAN.md -- BriefApprovalBar + BriefEditMode components, Touch4Form approval state machine, standalone review page, deal page alert banner, dashboard indicator, timeline lifecycle

### Phase 7: RAG Retrieval and Slide Block Assembly
**Goal**: Given an approved brief, the system retrieves relevant slide blocks from AtlusAI, assembles them into an ordered structured JSON representation, and generates bespoke copy for each block — all constrained to pre-approved building blocks
**Depends on**: Phase 6 (approved brief), Phase 2 (AtlusAI populated)
**Requirements**: CONT-05, CONT-06, ASSET-01, ASSET-02
**Success Criteria** (what must be TRUE):
  1. A RAG retrieval query using industry + solution pillar + funnel stage returns relevant slide blocks from AtlusAI with verifiable metadata match
  2. The assembled SlideJSON contains an ordered array of slide block specs (slide title, bullets, speaker notes, source block reference) before any Google API call is made
  3. Every slide block in the SlideJSON references a specific AtlusAI content block — no AI-generated layouts appear
  4. Bespoke copy generated for each block is grounded in the approved brief language and does not introduce capabilities or claims not in the retrieved content
  5. RAG retrieval quality is verified for at least 3 different industries before Phase 8 begins
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md -- Extended SlideAssemblyLlmSchema (sectionType/sourceType), searchForProposal multi-pass retrieval, proposal-assembly.ts (filterByMetadata, buildSlideJSON, generateSlideCopy), test brief fixtures, RAG quality verification script
- [ ] 07-02-PLAN.md -- ragRetrieval + assembleSlideJSON + generateCustomCopy workflow steps appended to touch-4-workflow (steps 9-11), Gemini weighted slide selection, per-slide brand-constrained copy generation

### Phase 8: Google Workspace Output Generation
**Goal**: Given a validated SlideJSON, the system creates a fully formatted Google Slides deck, a slide-by-slide talk track Google Doc, and a buyer FAQ Google Doc in a named per-deal folder in shared Lumenalta Drive — reusing the slide assembly infrastructure from Phase 4
**Depends on**: Phase 7, Phase 4 (reuses slide assembly pipeline)
**Requirements**: ASSET-03, ASSET-04, ASSET-05
**Success Criteria** (what must be TRUE):
  1. The system creates a Google Slides deck in shared Lumenalta Drive using the service account, named "[CompanyName] - [PrimaryPillar] - [Date]", with slides assembled from the SlideJSON
  2. Each slide in the generated deck uses only Lumenalta-approved layouts and typography — no off-brand styles appear
  3. A talk track Google Doc is created in the same per-deal Drive folder with speaker notes for each slide
  4. A buyer FAQ Google Doc is created with anticipated objections and recommended responses derived from the stakeholder roles and business context in the approved brief
  5. All three artifacts are accessible from the shared Lumenalta Drive folder without requiring per-seller OAuth
**Plans**: 3 plans

Plans:
- [x] 08-01-PLAN.md — Google Slides deck assembly engine (createSlidesDeckFromJSON), doc-builder.ts, Step 12 wired into workflow
- [x] 08-02-PLAN.md — Talk track Google Doc (Step 13) and buyer FAQ Google Doc (Step 14) with objection handling, outputRefs persistence
- [ ] 08-03-PLAN.md — Gap closure: sourceType branching for retrieved slides (drive.files.copy attempt with branded template fallback)

### Phase 9: HITL Checkpoint 2 and Review Delivery UI
**Goal**: Seller, SME, Marketing, and Solutions can review all generated assets in the web app before final delivery, with direct links to the Drive artifacts and verified brand compliance on all output
**Depends on**: Phase 8
**Requirements**: REVW-01, REVW-02, REVW-03
**Success Criteria** (what must be TRUE):
  1. After asset generation, the seller sees a review panel in the web app listing all three generated artifacts (deck, talk track, FAQ) with direct Google Drive links
  2. The workflow pauses at HITL-2 and no "delivery complete" state is reached until at least one reviewer explicitly approves
  3. Every slide in the delivered deck uses only Lumenalta-approved layouts, colors, and typography from the building block library — a brand compliance check runs before HITL-2 is triggered
  4. The web app status page correctly reflects the full workflow lifecycle from transcript submission through final delivery
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md -- Brand compliance checker, workflow extension to 17 steps (checkBrandCompliance + awaitAssetReview + finalizeDelivery), asset review API endpoints, typed api-client + server actions
- [ ] 09-02-PLAN.md -- Standalone asset review page with iframe previews, brand compliance section, approval bar with role selection, 5-stage workflow stepper, deal page/dashboard lifecycle indicators

### Phase 10: Pre-Call Briefing Flow
**Goal**: A seller can enter a company name, buyer role, and meeting context and receive a formatted one-pager with a company snapshot, role-specific hypotheses, and prioritized discovery questions — saved to Google Drive
**Depends on**: Phase 3 (schemas), Phase 2 (AtlusAI)
**Requirements**: BRIEF-01, BRIEF-02, BRIEF-03, BRIEF-04, BRIEF-05
**Success Criteria** (what must be TRUE):
  1. Seller can fill out the pre-call form with company name, buyer role (from a defined set of personas), and meeting context and submit it for processing
  2. The system returns a company snapshot with key initiatives, recent news context, and financial highlights drawn from public sources and AtlusAI
  3. The generated briefing includes role-specific hypotheses framed for the buyer's persona (e.g., CIO framing vs CFO framing)
  4. The briefing includes 5-10 prioritized discovery questions mapped to specific Lumenalta solution areas
  5. The completed briefing is displayed in the web app and a formatted Google Doc is saved to the shared Lumenalta Drive with a link surfaced in the UI
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- Pre-call Mastra workflow (researchCompany, queryCaseStudies, generateHypotheses, generateDiscoveryQuestions, buildBriefingDoc, recordInteraction), TOUCH_TYPES constant update, workflow registration, API client + server actions
- [ ] 10-02-PLAN.md -- Pre-call form (buyer role dropdown, meeting context textarea), briefing results display (company snapshot, hypotheses, discovery questions, case studies), Prep section on deal page above touch flow cards

### Phase 11: End-to-End Integration and Demo Polish
**Goal**: All four touch-point flows run end-to-end without manual intervention, the UI communicates pipeline progress at every step, error handling is hardened, and a complete demo scenario validates the core value claim across all touch types
**Depends on**: Phase 10 (pre-call), Phase 9 (post-call), Phase 4 (touch 1-3)
**Requirements**: None (integration + polish phase covering all pipeline requirements)
**Success Criteria** (what must be TRUE):
  1. A complete Touch 4 run from transcript paste to final Drive artifact delivery completes successfully without developer intervention, including both HITL checkpoints
  2. Touch 1, Touch 2, and Touch 3 flows each complete successfully from form submission to Google Slides deck in Drive
  3. The seller UI displays step-by-step progress during generation pipelines (not a blank spinner)
  4. A pre-call briefing run completes successfully end-to-end from form submission to Google Doc in Drive
  5. Any pipeline error surfaces a clear, actionable error message in the UI — no silent failures or raw stack traces visible to the user
  6. Interaction records are captured for every flow execution and a company's interaction history is accessible for cross-touch-point context
  7. A rehearsed demo scenario (realistic transcript from a Financial Services deal) runs cleanly through all four touch types, produces polished assets, and demonstrates the knowledge base growing with each interaction
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — PipelineStepper component, sonner toast integration, friendly error mapper, step-by-step progress indicators wired into all 5 form components
- [x] 11-02-PLAN.md — Demo seed script (Meridian Capital Group), Financial Services transcript fixture, end-to-end validation checkpoint

### Phase 12: Content Library Re-ingestion
**Goal**: AtlusAI is populated with all Lumenalta content — including all deck templates, case studies, brand guidelines as whole-reference documents, and image/icon library — so that RAG retrieval has complete coverage across all 11 industries
**Depends on**: Phase 2 (ingestion infrastructure), Phase 1 (service account)
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04
**Gap Closure:** Closes requirement gaps from v1.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. Google Drive service account can access all shortcut target files (Meet Lumenalta, L2 capability decks, 1-2 pager templates, case study decks)
  2. Google Docs API is enabled on GCP project 749490525472
  3. Full ingestion pipeline re-run completes with all deck templates, case studies, and brand assets ingested
  4. All 11 industries have at least one complete deck template and at least one case study in AtlusAI
  5. Brand guidelines are ingested as whole-reference 'brand_guide' entries (not slide-level 'template')
  6. Image registry is populated with brand-approved assets from Drive
**Plans**: TBD

Plans:
- [ ] 12-01-PLAN.md — TBD (created by /gsd:plan-phase 12)

### Phase 13: Touch 4 Poll Loop & Integration Fixes
**Goal**: Touch 4 inline form shows real-time asset generation progress after brief approval, and minor integration display issues are resolved
**Depends on**: Phase 11 (E2E integration), Phase 9 (asset review UI)
**Requirements**: None (integration/UX fix phase — all affected requirements already satisfied at server level)
**Gap Closure:** Closes integration and flow gaps from v1.0 milestone audit
**Success Criteria** (what must be TRUE):
  1. After brief approval in touch-4-form.tsx, the poll loop starts and `TOUCH_4_ASSET_PIPELINE_STEPS` progress is displayed to the user in real time
  2. User does not need to navigate away and return to see asset-review banner — it appears automatically when pipeline completes
  3. Pre-call form primary data extraction reads the correct field from record-interaction step output (not relying on fallback)
  4. Timeline entry displays "Pre-Call Briefing" label with appropriate color for pre_call touch type (not raw DB value)
  5. Touch 4 inline E2E flow completes from transcript to asset-review without manual intervention
**Plans**: TBD

Plans:
- [ ] 13-01-PLAN.md — TBD (created by /gsd:plan-phase 13)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

Note: Phases 2 and 3 have no dependency on each other and can proceed in parallel after Phase 1. Phase 4 depends on Phases 1, 2, and 3. Phase 5 depends only on Phase 3 and can proceed in parallel with Phase 4 once Phase 3 is complete. Phase 10 depends only on Phases 2 and 3 and can be built in parallel with Phases 5-9 once those foundations are in place.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Foundation | 3/3 | Complete | 2026-03-03 |
| 2. Content Library Ingestion | 1/3 | In progress | - |
| 3. Zod Schema Layer and Gemini Validation | 2/2 | Complete | 2026-03-03 |
| 4. Touch 1-3 Asset Generation | 3/3 | Complete | 2026-03-04 |
| 5. Transcript Processing and Brief Generation | 0/3 | Not started | - |
| 6. HITL Checkpoint 1 — Brief Approval | 2/2 | Complete | 2026-03-04 |
| 7. RAG Retrieval and Slide Block Assembly | 0/2 | Not started | - |
| 8. Google Workspace Output Generation | 2/3 | Gap closure | - |
| 9. HITL Checkpoint 2 and Review Delivery UI | 2/2 | Complete   | 2026-03-04 |
| 10. Pre-Call Briefing Flow | 2/2 | Complete    | 2026-03-04 |
| 11. End-to-End Integration and Demo Polish | 2/2 | Complete    | 2026-03-04 |
| 12. Content Library Re-ingestion | 0/? | Not started | - |
| 13. Touch 4 Poll Loop & Integration Fixes | 0/? | Not started | - |
