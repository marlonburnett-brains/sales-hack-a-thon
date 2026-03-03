# Roadmap: Lumenalta Agentic Sales Orchestration

## Overview

This roadmap builds from the ground up — foundations first, then the critical-path content library, then the intelligence pipeline, then HITL gating, then output generation, and finally the independent pre-call flow. Every downstream phase depends on the one before it. The architecture enforces two hard invariants: AtlusAI must be populated with slide-block-level content before any RAG step can be tested, and HITL Checkpoint 1 must be functional before a single slide can be generated. The ten phases reflect those constraints rather than arbitrary structure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Monorepo Foundation** - Scaffold the monorepo, configure Mastra + Prisma + SQLite, validate Google service account auth, and spike the Google Slides API to de-risk placeholder ID and batchUpdate ordering pitfalls before any production code depends on them
- [ ] **Phase 2: Content Library Ingestion** - Populate AtlusAI with all Lumenalta deck templates, case studies, brand guidelines, and the image/icon library at slide-block granularity across all 11 industries
- [ ] **Phase 3: Zod Schema Layer and Gemini Validation** - Define and validate all Zod v4 schemas against the live Gemini API in isolation so that schema rejection errors are caught before any agent logic is built on top of them
- [ ] **Phase 4: Transcript Processing and Brief Generation** - Build the transcript ingestion form, structured extraction pipeline, missing-field validation, solution pillar mapping, and the Multi-Pillar Sales Brief with ROI framing
- [ ] **Phase 5: HITL Checkpoint 1 — Brief Approval** - Wire the Mastra workflow suspend/resume at the brief approval checkpoint, build the brief review UI, and verify that durable state survives a server restart before any asset generation is wired up
- [ ] **Phase 6: RAG Retrieval and Slide Block Assembly** - Build the RAG retrieval step against AtlusAI, assemble the structured SlideJSON intermediate representation, and generate bespoke copy for each block within brand compliance constraints
- [ ] **Phase 7: Google Workspace Output Generation** - Create the Google Slides deck, talk track Google Doc, and buyer FAQ Google Doc in shared Lumenalta Drive via the Google Slides and Docs APIs
- [ ] **Phase 8: HITL Checkpoint 2 and Review Delivery UI** - Wire the second HITL checkpoint for final asset review, build the review panel with Drive artifact links, and enforce brand compliance verification before final delivery
- [ ] **Phase 9: Pre-Call Briefing Flow** - Build the independent pre-call input form, company research pipeline, role-specific hypothesis and discovery question generation, and Drive output
- [ ] **Phase 10: End-to-End Integration and Demo Polish** - Connect all pipeline steps, validate the full transcript-to-deck run, add step-by-step progress indicators, harden error handling, and produce a demo-ready scenario

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
- [ ] 01-01-PLAN.md — pnpm + Turborepo monorepo root scaffold with shared tsconfig, ESLint, schemas packages and both app skeletons
- [ ] 01-02-PLAN.md — Mastra instance (LibSQL storage), Prisma schema + migration, T3 Env validation, Google auth factory
- [ ] 01-03-PLAN.md — Google service account credential setup (checkpoint) + Slides API spike (copy template, read live objectIds, batchUpdate)

### Phase 2: Content Library Ingestion
**Goal**: AtlusAI is populated with all Lumenalta content at slide-block granularity across all 11 industries so that RAG retrieval is functional for every downstream pipeline test
**Depends on**: Phase 1
**Requirements**: CONT-01, CONT-02, CONT-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. A semantic search query against AtlusAI for any of the 11 industries returns at least one relevant slide block with correct metadata tags (industry, solution pillar, funnel stage, slide category)
  2. A structured filter query (industry + solution pillar + funnel stage) returns only slide blocks matching all three filter parameters
  3. All case studies are retrievable by industry, subsector, solution pillar, and buyer persona
  4. Brand guideline assets (approved image URLs hosted on public GCS) are retrievable from AtlusAI for use during slide assembly
  5. An idempotent ingestion script can re-run without creating duplicate entries
**Plans**: TBD

Plans:
- [ ] 02-01: Content inventory manifest and slide-block chunking schema definition (validate with 2-3 sample decks before bulk ingestion)
- [ ] 02-02: AtlusAI ingestion script for deck templates at slide-block level with metadata tagging
- [ ] 02-03: AtlusAI ingestion for case studies, brand guidelines, and image/icon library with GCS public URL configuration

### Phase 3: Zod Schema Layer and Gemini Validation
**Goal**: Every Zod v4 schema used in the pipeline is defined, tested against the live Gemini API, and available as a shared package so that schema rejection cannot surface as a runtime surprise during agent development
**Depends on**: Phase 1
**Requirements**: None (schema layer — directly enables Phase 4 and Phase 9 agent work)
**Success Criteria** (what must be TRUE):
  1. Each core schema (TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, CompanyResearchSchema) produces a valid JSON Schema when converted and Gemini returns a conforming structured response in an isolated test
  2. LLM schemas (flat, no transforms, no unions) are clearly separated from application schemas (post-processing transforms) in the packages/schemas directory
  3. Any schema that fails Gemini structured output mode is fixed in isolation before being used in any workflow step
**Plans**: TBD

Plans:
- [ ] 03-01: Core schema definitions in packages/schemas (TranscriptFieldsSchema, SalesBriefSchema, SlideAssemblySchema, ROIFramingSchema)
- [ ] 03-02: Pre-call schema definitions (CompanyResearchSchema, HypothesesSchema, DiscoveryQuestionsSchema) and Gemini validation suite for all schemas

### Phase 4: Transcript Processing and Brief Generation
**Goal**: A seller can paste a raw transcript, select industry and subsector, receive structured field extraction with specific missing-field warnings, and see a complete Multi-Pillar Sales Brief with ROI outcome statements — all before any HITL checkpoint is encountered
**Depends on**: Phase 3
**Requirements**: TRANS-01, TRANS-02, TRANS-03, TRANS-04, TRANS-05, GEN-01, GEN-02
**Success Criteria** (what must be TRUE):
  1. Seller can paste a raw transcript into the web form, select an industry from the 11-item list and a subsector from the 62-item list, and submit for processing
  2. The system returns a structured breakdown with all six fields (Customer Context, Business Outcomes, Constraints, Stakeholders, Timeline, Budget) populated where present in the transcript
  3. When a critical field is missing from the transcript, the seller sees a specific warning message (e.g., "Budget not mentioned") and must acknowledge it before the pipeline continues
  4. The generated Sales Brief identifies a primary solution pillar and at least one secondary pillar with evidence drawn from the transcript
  5. The brief includes 2-3 ROI outcome statements and 1 value hypothesis per identified use case
**Plans**: TBD

Plans:
- [ ] 04-01: Transcript ingestion form (Next.js) with industry/subsector selector and Mastra post-call workflow entry point
- [ ] 04-02: ParseTranscript step (Gemini Flash + TranscriptFieldsSchema) and ValidateTranscript step with missing-field notification surfaced to UI
- [ ] 04-03: TranscriptAgent solution pillar mapping, GenerateBrief step (SalesBriefSchema), and ROI framing module (ROIFramingSchema)

### Phase 5: HITL Checkpoint 1 — Brief Approval
**Goal**: A seller and SME can review the complete structured brief in the web app and the workflow hard-stops until explicit approval is given — and that approval state survives a server restart
**Depends on**: Phase 4
**Requirements**: GEN-03, GEN-04
**Success Criteria** (what must be TRUE):
  1. After brief generation, the seller sees the complete Multi-Pillar Sales Brief rendered as formatted cards (not raw JSON) in the web app
  2. The workflow status polling updates the UI in real time (3-second interval) while the brief awaits review
  3. No asset generation step begins until an SME explicitly clicks the approve button in the web app
  4. If the server is restarted after the brief is generated but before it is approved, the workflow resumes correctly when the approve action is submitted
  5. If the brief is rejected, the seller receives feedback and can resubmit a corrected version without starting a new workflow
**Plans**: TBD

Plans:
- [ ] 05-01: Mastra workflow suspend at HITL-1, Prisma workflow state table (created → notified → viewed → approved/rejected/expired), resume API endpoint
- [ ] 05-02: Brief approval UI (shadcn/ui card components rendering SalesBrief fields), workflow status polling (3s interval), and server-restart resume verification

### Phase 6: RAG Retrieval and Slide Block Assembly
**Goal**: Given an approved brief, the system retrieves relevant slide blocks from AtlusAI, assembles them into an ordered structured JSON representation, and generates bespoke copy for each block — all constrained to pre-approved building blocks
**Depends on**: Phase 5 (approved brief), Phase 2 (AtlusAI populated)
**Requirements**: CONT-05, CONT-06, ASSET-01, ASSET-02
**Success Criteria** (what must be TRUE):
  1. A RAG retrieval query using industry + solution pillar + funnel stage returns relevant slide blocks from AtlusAI with verifiable metadata match
  2. The assembled SlideJSON contains an ordered array of slide block specs (slide title, bullets, speaker notes, source block reference) before any Google API call is made
  3. Every slide block in the SlideJSON references a specific AtlusAI content block — no AI-generated layouts appear
  4. Bespoke copy generated for each block is grounded in the approved brief language and does not introduce capabilities or claims not in the retrieved content
  5. RAG retrieval quality is verified for at least 3 different industries before Phase 7 begins
**Plans**: TBD

Plans:
- [ ] 06-01: ContentAgent with AtlusAI MCP tool, RAGRetrieval workflow step (semantic + structured filter search), and retrieval quality verification across 3 industries
- [ ] 06-02: AssembleSlideJSON step (SlideAssemblySchema), CopywritingAgent with brand-constrained copy generation, and CONT-06 brand compliance enforcement

### Phase 7: Google Workspace Output Generation
**Goal**: Given a validated SlideJSON, the system creates a fully formatted Google Slides deck, a slide-by-slide talk track Google Doc, and a buyer FAQ Google Doc in a named per-deal folder in shared Lumenalta Drive
**Depends on**: Phase 6
**Requirements**: ASSET-03, ASSET-04, ASSET-05
**Success Criteria** (what must be TRUE):
  1. The system creates a Google Slides deck in shared Lumenalta Drive using the service account, named "[CompanyName] - [PrimaryPillar] - [Date]", with slides assembled from the SlideJSON
  2. Each slide in the generated deck uses only Lumenalta-approved layouts and typography — no off-brand styles appear
  3. A talk track Google Doc is created in the same per-deal Drive folder with speaker notes for each slide
  4. A buyer FAQ Google Doc is created with anticipated objections and recommended responses derived from the stakeholder roles and business context in the approved brief
  5. All three artifacts are accessible from the shared Lumenalta Drive folder without requiring per-seller OAuth
**Plans**: TBD

Plans:
- [ ] 07-01: Google Slides creation step (Drive template copy → sequential batchUpdate, getPlaceholderIdByType utility, per-deal folder creation)
- [ ] 07-02: Talk track Google Doc generation step and buyer FAQ Google Doc generation step with objection handling

### Phase 8: HITL Checkpoint 2 and Review Delivery UI
**Goal**: Seller, SME, Marketing, and Solutions can review all generated assets in the web app before final delivery, with direct links to the Drive artifacts and verified brand compliance on all output
**Depends on**: Phase 7
**Requirements**: REVW-01, REVW-02, REVW-03
**Success Criteria** (what must be TRUE):
  1. After asset generation, the seller sees a review panel in the web app listing all three generated artifacts (deck, talk track, FAQ) with direct Google Drive links
  2. The workflow pauses at HITL-2 and no "delivery complete" state is reached until at least one reviewer explicitly approves
  3. Every slide in the delivered deck uses only Lumenalta-approved layouts, colors, and typography from the building block library — a brand compliance check runs before HITL-2 is triggered
  4. The web app status page correctly reflects the full workflow lifecycle from transcript submission through final delivery
**Plans**: TBD

Plans:
- [ ] 08-01: Mastra workflow suspend at HITL-2, asset review panel UI with Drive artifact links (shadcn/ui), brand compliance check step before HITL-2 trigger
- [ ] 08-02: Final delivery state transition, workflow lifecycle status display, and end-to-end post-call flow smoke test

### Phase 9: Pre-Call Briefing Flow
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
- [ ] 09-01: Pre-call input form (Next.js), ResearchAgent (AtlusAI + public source research), ResearchCompany and GenerateHypotheses workflow steps
- [ ] 09-02: Discovery question generation step (mapped to Lumenalta solutions), BuildBriefingDoc step, SaveToDrive step, and pre-call results UI

### Phase 10: End-to-End Integration and Demo Polish
**Goal**: The full pipeline runs end-to-end without manual intervention, the UI communicates pipeline progress at every step, error handling is hardened, and a complete demo scenario validates the core value claim
**Depends on**: Phase 9 (pre-call), Phase 8 (post-call)
**Requirements**: None (integration + polish phase covering all pipeline requirements)
**Success Criteria** (what must be TRUE):
  1. A complete run from transcript paste to final Drive artifact delivery completes successfully without developer intervention, including both HITL checkpoints
  2. The seller UI displays step-by-step progress during the 2-3 minute generation pipeline (not a blank spinner)
  3. A pre-call briefing run completes successfully end-to-end from form submission to Google Doc in Drive
  4. Any pipeline error surfaces a clear, actionable error message in the UI — no silent failures or raw stack traces visible to the user
  5. A rehearsed demo scenario (realistic transcript from a Financial Services deal) runs cleanly and produces a polished deck that a Lumenalta seller would be willing to show a client
**Plans**: TBD

Plans:
- [ ] 10-01: End-to-end pipeline wiring, step-by-step progress indicator UI, and error handling hardening across all workflow steps
- [ ] 10-02: Demo scenario preparation (Financial Services transcript, full run validation) and final smoke test across all 11 industries

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Note: Phases 2 and 3 have no dependency on each other and can proceed in parallel after Phase 1. Phase 9 depends only on Phases 2 and 3 and can be built in parallel with Phases 4-8 once those foundations are in place.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monorepo Foundation | 0/3 | Not started | - |
| 2. Content Library Ingestion | 0/3 | Not started | - |
| 3. Zod Schema Layer and Gemini Validation | 0/2 | Not started | - |
| 4. Transcript Processing and Brief Generation | 0/3 | Not started | - |
| 5. HITL Checkpoint 1 — Brief Approval | 0/2 | Not started | - |
| 6. RAG Retrieval and Slide Block Assembly | 0/2 | Not started | - |
| 7. Google Workspace Output Generation | 0/2 | Not started | - |
| 8. HITL Checkpoint 2 and Review Delivery UI | 0/2 | Not started | - |
| 9. Pre-Call Briefing Flow | 0/2 | Not started | - |
| 10. End-to-End Integration and Demo Polish | 0/2 | Not started | - |
