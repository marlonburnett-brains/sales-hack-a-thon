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
- [ ] **Phase 3: Zod Schema Layer and Gemini Validation** - Define and validate all Zod v4 schemas (including Touch 1-3 content selection schemas, interaction tracking schemas, and Touch 4 pipeline schemas) against the live Gemini API in isolation so that schema rejection errors are caught before any agent logic is built on top of them
- [ ] **Phase 4: Touch 1-3 Asset Generation & Interaction Tracking** - Build the three simpler GTM asset flows (Touch 1 with approve/override feedback loop, Touch 2 intro deck, Touch 3 capability deck), the interaction tracking infrastructure that captures all inputs/decisions/outputs across every touch point, and the knowledge base growth pipeline that ingests overrides and approved outputs back into AtlusAI
- [ ] **Phase 5: Transcript Processing and Brief Generation** - Build the transcript ingestion form, structured extraction pipeline, missing-field validation, solution pillar mapping, and the Multi-Pillar Sales Brief with ROI framing
- [ ] **Phase 6: HITL Checkpoint 1 — Brief Approval** - Wire the Mastra workflow suspend/resume at the brief approval checkpoint, build the brief review UI, and verify that durable state survives a server restart before any asset generation is wired up
- [ ] **Phase 7: RAG Retrieval and Slide Block Assembly** - Build the RAG retrieval step against AtlusAI, assemble the structured SlideJSON intermediate representation, and generate bespoke copy for each block within brand compliance constraints
- [ ] **Phase 8: Google Workspace Output Generation** - Create the Google Slides deck, talk track Google Doc, and buyer FAQ Google Doc in shared Lumenalta Drive via the Google Slides and Docs APIs, reusing the slide assembly infrastructure established in Phase 4
- [ ] **Phase 9: HITL Checkpoint 2 and Review Delivery UI** - Wire the second HITL checkpoint for final asset review, build the review panel with Drive artifact links, and enforce brand compliance verification before final delivery
- [ ] **Phase 10: Pre-Call Briefing Flow** - Build the independent pre-call input form, company research pipeline, role-specific hypothesis and discovery question generation, and Drive output
- [ ] **Phase 11: End-to-End Integration and Demo Polish** - Connect all pipeline steps across all four touch points, validate full runs for each touch type, add step-by-step progress indicators, harden error handling, and produce a demo-ready scenario

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
**Plans**: TBD

Plans:
- [ ] 02-01: Content inventory manifest and slide-block chunking schema definition (validate with 2-3 sample decks before bulk ingestion)
- [ ] 02-02: AtlusAI ingestion script for deck templates at slide-block level with metadata tagging (including touch-type tags for intro deck, capability decks, and pager templates)
- [ ] 02-03: AtlusAI ingestion for case studies, brand guidelines, and image/icon library with GCS public URL configuration

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
**Plans**: TBD

Plans:
- [ ] 03-01: Core schema definitions in packages/schemas (TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, ROIFramingSchema)
- [ ] 03-02: Touch 1-3 selection schemas (PagerContentSchema, IntroDeckSelectionSchema, CapabilityDeckSelectionSchema), interaction tracking schemas (InteractionRecordSchema, FeedbackSignalSchema), pre-call schemas (CompanyResearchSchema, HypothesesSchema, DiscoveryQuestionsSchema), and Gemini validation suite for all schemas

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
**Plans**: TBD

Plans:
- [ ] 04-01: Interaction tracking Prisma models (InteractionRecord, FeedbackSignal, CompanyDealContext), flow selector landing page in Next.js, and Touch 1 pager generation with approve/override mechanism (template copy, AI content fill, override upload, feedback signal recording, Drive output)
- [ ] 04-02: Shared slide selection and assembly engine — AI-driven content retrieval from AtlusAI, slide ordering, deck assembly pipeline, salesperson/customer customization injection (name, photo, logo), and AtlusAI re-ingestion pipeline for override content
- [ ] 04-03: Touch 2 intro deck flow and Touch 3 capability deck flow using shared assembly engine, with industry/capability-specific slide selection, interaction capture for each flow, and Drive output

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
**Plans**: TBD

Plans:
- [ ] 05-01: Transcript ingestion form (Next.js) with industry/subsector selector, transcript persistence and indexing, and Mastra post-call workflow entry point
- [ ] 05-02: ParseTranscript step (Gemini Flash + TranscriptFieldsSchema) and ValidateTranscript step with missing-field notification surfaced to UI
- [ ] 05-03: TranscriptAgent solution pillar mapping, GenerateBrief step (SalesBriefSchema), and ROI framing module (ROIFramingSchema)

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
**Plans**: TBD

Plans:
- [ ] 06-01: Mastra workflow suspend at HITL-1, Prisma workflow state table (created -> notified -> viewed -> approved/rejected/expired), resume API endpoint
- [ ] 06-02: Brief approval UI (shadcn/ui card components rendering SalesBrief fields), workflow status polling (3s interval), and server-restart resume verification

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
**Plans**: TBD

Plans:
- [ ] 07-01: ContentAgent with AtlusAI MCP tool, RAGRetrieval workflow step (semantic + structured filter search), and retrieval quality verification across 3 industries
- [ ] 07-02: AssembleSlideJSON step (SlideAssemblySchema), CopywritingAgent with brand-constrained copy generation, and CONT-06 brand compliance enforcement

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
**Plans**: TBD

Plans:
- [ ] 08-01: Google Slides creation step (Drive template copy -> sequential batchUpdate, getPlaceholderIdByType utility, per-deal folder creation) — extending Phase 4 slide assembly pipeline
- [ ] 08-02: Talk track Google Doc generation step and buyer FAQ Google Doc generation step with objection handling

### Phase 9: HITL Checkpoint 2 and Review Delivery UI
**Goal**: Seller, SME, Marketing, and Solutions can review all generated assets in the web app before final delivery, with direct links to the Drive artifacts and verified brand compliance on all output
**Depends on**: Phase 8
**Requirements**: REVW-01, REVW-02, REVW-03
**Success Criteria** (what must be TRUE):
  1. After asset generation, the seller sees a review panel in the web app listing all three generated artifacts (deck, talk track, FAQ) with direct Google Drive links
  2. The workflow pauses at HITL-2 and no "delivery complete" state is reached until at least one reviewer explicitly approves
  3. Every slide in the delivered deck uses only Lumenalta-approved layouts, colors, and typography from the building block library — a brand compliance check runs before HITL-2 is triggered
  4. The web app status page correctly reflects the full workflow lifecycle from transcript submission through final delivery
**Plans**: TBD

Plans:
- [ ] 09-01: Mastra workflow suspend at HITL-2, asset review panel UI with Drive artifact links (shadcn/ui), brand compliance check step before HITL-2 trigger
- [ ] 09-02: Final delivery state transition, workflow lifecycle status display, and end-to-end post-call flow smoke test

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
**Plans**: TBD

Plans:
- [ ] 10-01: Pre-call input form (Next.js), ResearchAgent (AtlusAI + public source research), ResearchCompany and GenerateHypotheses workflow steps
- [ ] 10-02: Discovery question generation step (mapped to Lumenalta solutions), BuildBriefingDoc step, SaveToDrive step, and pre-call results UI

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
**Plans**: TBD

Plans:
- [ ] 11-01: End-to-end pipeline wiring for all four touch types, step-by-step progress indicator UI, and error handling hardening across all workflow steps
- [ ] 11-02: Demo scenario preparation (Financial Services transcript, full run validation across all touch types) and final smoke test across all 11 industries

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

Note: Phases 2 and 3 have no dependency on each other and can proceed in parallel after Phase 1. Phase 4 depends on Phases 1, 2, and 3. Phase 5 depends only on Phase 3 and can proceed in parallel with Phase 4 once Phase 3 is complete. Phase 10 depends only on Phases 2 and 3 and can be built in parallel with Phases 5-9 once those foundations are in place.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Foundation | 3/3 | Complete | 2026-03-03 |
| 2. Content Library Ingestion | 0/3 | Not started | - |
| 3. Zod Schema Layer and Gemini Validation | 0/2 | Not started | - |
| 4. Touch 1-3 Asset Generation | 0/3 | Not started | - |
| 5. Transcript Processing and Brief Generation | 0/3 | Not started | - |
| 6. HITL Checkpoint 1 — Brief Approval | 0/2 | Not started | - |
| 7. RAG Retrieval and Slide Block Assembly | 0/2 | Not started | - |
| 8. Google Workspace Output Generation | 0/2 | Not started | - |
| 9. HITL Checkpoint 2 and Review Delivery UI | 0/2 | Not started | - |
| 10. Pre-Call Briefing Flow | 0/2 | Not started | - |
| 11. End-to-End Integration and Demo Polish | 0/2 | Not started | - |
