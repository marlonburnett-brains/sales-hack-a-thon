# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (in progress)

## Phases

<details>
<summary>v1.0 Agentic Sales MVP (Phases 1-13) -- SHIPPED 2026-03-05</summary>

- [x] Phase 1: Monorepo Foundation (3/3 plans) -- completed 2026-03-03
- [x] Phase 2: Content Library Ingestion (3/3 plans) -- completed 2026-03-03
- [x] Phase 3: Zod Schema Layer and Gemini Validation (2/2 plans) -- completed 2026-03-03
- [x] Phase 4: Touch 1-3 Asset Generation & Interaction Tracking (3/3 plans) -- completed 2026-03-04
- [x] Phase 5: Transcript Processing and Brief Generation (3/3 plans) -- completed 2026-03-04
- [x] Phase 6: HITL Checkpoint 1 -- Brief Approval (2/2 plans) -- completed 2026-03-04
- [x] Phase 7: RAG Retrieval and Slide Block Assembly (2/2 plans) -- completed 2026-03-04
- [x] Phase 8: Google Workspace Output Generation (3/3 plans) -- completed 2026-03-04
- [x] Phase 9: HITL Checkpoint 2 and Review Delivery UI (2/2 plans) -- completed 2026-03-04
- [x] Phase 10: Pre-Call Briefing Flow (2/2 plans) -- completed 2026-03-04
- [x] Phase 11: End-to-End Integration and Demo Polish (2/2 plans) -- completed 2026-03-04
- [x] Phase 12: Content Library Re-ingestion (2/2 plans) -- completed 2026-03-04
- [x] Phase 13: Touch 4 Poll Loop & Integration Fixes (1/1 plan) -- completed 2026-03-04

</details>

<details>
<summary>v1.1 Infrastructure & Access Control (Phases 14-17) -- SHIPPED 2026-03-05</summary>

- [x] Phase 14: Database Migration (2/2 plans) -- completed 2026-03-05
- [x] Phase 15: Service-to-Service Auth (1/1 plan) -- completed 2026-03-05
- [x] Phase 16: Google OAuth Login Wall (2/2 plans) -- completed 2026-03-05
- [x] Phase 17: Deployment & Go-Live (1/1 plan) -- completed 2026-03-05

</details>

### v1.2 Templates & Slide Intelligence (In Progress)

**Milestone Goal:** Enable template-based deck assembly with AI slide classification, human-in-the-loop rating, and CI/CD automation.

- [x] **Phase 18: CI/CD Pipeline & pgvector Schema** - Automated deploy pipeline and vector database foundation
- [ ] **Phase 19: Navigation & Template Management** - Side panel navigation and templates CRUD with access awareness
- [ ] **Phase 20: Slide Ingestion Agent** - AI-powered slide extraction, embedding, and classification pipeline
- [ ] **Phase 21: Preview & Review Engine** - Slide preview with classification display, human rating, and similarity search

## Phase Details

### Phase 18: CI/CD Pipeline & pgvector Schema
**Goal**: Every push to main automatically lints, builds, migrates, and deploys -- and the database is ready for vector operations
**Depends on**: Phase 17 (deployed infrastructure)
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04, SLIDE-01
**Success Criteria** (what must be TRUE):
  1. Push to main triggers GitHub Actions that lint, type-check, and build both apps without manual intervention
  2. Web app deploys to Vercel automatically after checks pass
  3. Agent deploys to Railway automatically after checks pass
  4. Pending Prisma migrations run against the target database before either app deploys
  5. pgvector extension is enabled in Supabase and the slide_embeddings table with HNSW index exists and accepts vector inserts
**Plans:** 2/2 plans complete
Plans:
- [x] 18-01-PLAN.md -- pgvector schema migration (SlideEmbedding table + HNSW index)
- [x] 18-02-PLAN.md -- GitHub Actions CI/CD pipeline (lint, build, migrate, deploy)

### Phase 19: Navigation & Template Management
**Goal**: Users can navigate to a Templates section and register, view, and manage Google Slides templates with access awareness
**Depends on**: Phase 18 (database schema for Template model, CI/CD for deploys)
**Requirements**: NAV-01, NAV-02, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07
**Success Criteria** (what must be TRUE):
  1. User can switch between Deals and Templates via a persistent, collapsible side panel without breaking any existing routes
  2. User can add a template by pasting a Google Slides URL with a display name and one or more touch type assignments, and the system validates the URL and extracts the presentation ID
  3. User can view all registered templates in a list showing status badges (Ready, No Access, Not Ingested, Stale) and can delete templates
  4. System checks Google Drive access on template add and displays the service account email when a file is not shared
  5. System detects when a template source file has been modified since last ingestion and shows a staleness indicator
**Plans:** 2/3 plans executed
Plans:
- [ ] 19-01-PLAN.md -- Template Prisma model, agent API routes, and web api-client
- [ ] 19-02-PLAN.md -- Collapsible sidebar navigation replacing top nav
- [ ] 19-03-PLAN.md -- Templates management UI (page, cards, table, form, filters, delete)

### Phase 20: Slide Ingestion Agent
**Goal**: Users can trigger AI-powered ingestion that extracts, embeds, and classifies every slide from a Google Slides template into the vector store
**Depends on**: Phase 19 (template records to process), Phase 18 (pgvector schema)
**Requirements**: SLIDE-02, SLIDE-03, SLIDE-04, SLIDE-05, SLIDE-06, SLIDE-07, SLIDE-08
**Success Criteria** (what must be TRUE):
  1. User can trigger slide ingestion for any accessible template and see real-time progress (slide N of M) as slides are processed
  2. Agent extracts text content from each slide, generates a vector embedding via Vertex AI, and classifies each slide by industry, solution pillar, persona, funnel stage, and content type with a confidence score
  3. All embeddings, classifications, and confidence scores are stored in Supabase pgvector and associated with the correct template and slide index
  4. Ingestion is idempotent -- re-ingesting a template replaces previous slide data without duplicates
**Plans**: TBD

### Phase 21: Preview & Review Engine
**Goal**: Users can visually review AI classifications on ingested slides, provide thumbs-up/down ratings with tag corrections, and find similar slides across all templates
**Depends on**: Phase 20 (ingested slides with classifications and embeddings)
**Requirements**: PREV-01, PREV-02, PREV-03, PREV-04, PREV-05, SLIDE-09
**Success Criteria** (what must be TRUE):
  1. User can preview slides at presentation size in the viewport with navigation between slides, and AI-assigned classification tags (industry, pillar, persona, stage) displayed alongside each slide
  2. User can rate a slide classification as correct (thumbs up) or incorrect (thumbs down), and when rating incorrect, can correct individual tags via inline editing
  3. Corrections update pgvector metadata immediately so the next page load reflects the change
  4. User can find similar slides across all ingested presentations via vector similarity search
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 18 -> 19 -> 20 -> 21

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Monorepo Foundation | v1.0 | 3/3 | Complete | 2026-03-03 |
| 2. Content Library Ingestion | v1.0 | 3/3 | Complete | 2026-03-03 |
| 3. Zod Schema Layer | v1.0 | 2/2 | Complete | 2026-03-03 |
| 4. Touch 1-3 Asset Generation | v1.0 | 3/3 | Complete | 2026-03-04 |
| 5. Transcript Processing | v1.0 | 3/3 | Complete | 2026-03-04 |
| 6. HITL Checkpoint 1 | v1.0 | 2/2 | Complete | 2026-03-04 |
| 7. RAG Retrieval | v1.0 | 2/2 | Complete | 2026-03-04 |
| 8. Google Workspace Output | v1.0 | 3/3 | Complete | 2026-03-04 |
| 9. HITL Checkpoint 2 | v1.0 | 2/2 | Complete | 2026-03-04 |
| 10. Pre-Call Briefing | v1.0 | 2/2 | Complete | 2026-03-04 |
| 11. E2E Integration | v1.0 | 2/2 | Complete | 2026-03-04 |
| 12. Content Re-ingestion | v1.0 | 2/2 | Complete | 2026-03-04 |
| 13. Touch 4 Poll Loop Fixes | v1.0 | 1/1 | Complete | 2026-03-04 |
| 14. Database Migration | v1.1 | 2/2 | Complete | 2026-03-05 |
| 15. Service-to-Service Auth | v1.1 | 1/1 | Complete | 2026-03-05 |
| 16. Google OAuth Login Wall | v1.1 | 2/2 | Complete | 2026-03-05 |
| 17. Deployment & Go-Live | v1.1 | 1/1 | Complete | 2026-03-05 |
| 18. CI/CD Pipeline & pgvector Schema | v1.2 | Complete    | 2026-03-05 | 2026-03-05 |
| 19. Navigation & Template Management | 2/3 | In Progress|  | - |
| 20. Slide Ingestion Agent | v1.2 | 0/TBD | Not started | - |
| 21. Preview & Review Engine | v1.2 | 0/TBD | Not started | - |
