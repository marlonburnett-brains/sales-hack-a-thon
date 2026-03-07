# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (shipped 2026-03-06) -- [Archive](milestones/v1.2-ROADMAP.md)
- v1.3 **Google API Auth: User-Delegated Credentials** -- Phases 22-26 (shipped 2026-03-06) -- [Archive](milestones/v1.3-ROADMAP.md)
- v1.4 **AtlusAI Authentication & Discovery** -- Phases 27-31 (shipped 2026-03-07) -- [Archive](milestones/v1.4-ROADMAP.md)
- **v1.5 Review Polish & Deck Intelligence** -- Phases 32-34 (in progress)

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

<details>
<summary>v1.2 Templates & Slide Intelligence (Phases 18-21) -- SHIPPED 2026-03-06</summary>

- [x] Phase 18: CI/CD Pipeline & pgvector Schema (2/2 plans) -- completed 2026-03-05
- [x] Phase 19: Navigation & Template Management (3/3 plans) -- completed 2026-03-05
- [x] Phase 20: Slide Ingestion Agent (2/2 plans) -- completed 2026-03-06
- [x] Phase 21: Preview & Review Engine (3/3 plans) -- completed 2026-03-06

</details>

<details>
<summary>v1.3 Google API Auth: User-Delegated Credentials (Phases 22-26) -- SHIPPED 2026-03-06</summary>

- [x] Phase 22: OAuth Scope Expansion & Token Storage (3/3 plans) -- completed 2026-03-06
- [x] Phase 23: User-Delegated API Clients & Token Passthrough (2/2 plans) -- completed 2026-03-06
- [x] Phase 24: Token Pool & Refresh Lifecycle (2/2 plans) -- completed 2026-03-06
- [x] Phase 25: Integration Verification & Cutover (2/2 plans) -- completed 2026-03-06
- [x] Phase 26: Tech Debt Cleanup (1/1 plan) -- completed 2026-03-06

</details>

<details>
<summary>v1.4 AtlusAI Authentication & Discovery (Phases 27-31) -- SHIPPED 2026-03-07</summary>

- [x] Phase 27: Auth Foundation (5/5 plans) -- completed 2026-03-06
- [x] Phase 28: MCP Integration (2/2 plans) -- completed 2026-03-07
- [x] Phase 29: Discovery UI (3/3 plans) -- completed 2026-03-07
- [x] Phase 30: Verification & Documentation Reconciliation (1/1 plan) -- completed 2026-03-07
- [x] Phase 31: Tech Debt Cleanup (1/1 plan) -- completed 2026-03-07

</details>

### v1.5 Review Polish & Deck Intelligence (In Progress)

**Milestone Goal:** Fix UX gaps (thumbnails, ingestion status, feedback latency), deepen slide intelligence (descriptions, element maps), add content classification (Template vs Example), and build Settings page with AI-inferred deck structures per touch.

- [x] **Phase 32: UX Polish** - Discovery thumbnails, consistent ingestion status, and immediate ingest feedback (completed 2026-03-07)
- [ ] **Phase 33: Slide Intelligence Foundation** - Rich descriptions, element maps, and content classification
- [ ] **Phase 34: Deck Intelligence** - Settings page with AI-inferred deck structures and chat refinement

## Phase Details

### Phase 32: UX Polish
**Goal**: Users see polished, responsive Discovery and Templates pages with visual document previews, consistent status indicators, and instant feedback on actions
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: UXP-01, UXP-02, UXP-03, UXP-04, UXP-05
**Success Criteria** (what must be TRUE):
  1. User sees thumbnail previews on Discovery page document cards that persist across page reloads (GCS-cached, not ephemeral Drive URLs)
  2. User sees appropriate file-type icons (Slides, Docs, Sheets, PDF) when no thumbnail is available
  3. User sees identical ingestion status (progress bar and slide count) on both Discovery and Templates pages for the same presentation
  4. User clicks Ingest and sees immediate visual confirmation (button disables, menu closes, toast appears) before the server responds
  5. User cannot trigger duplicate ingestion by rapid-clicking the Ingest button
**Plans**: 2 plans

Plans:
- [ ] 32-01-PLAN.md — Backend thumbnail pipeline, shared UI components, and server-side duplicate guard
- [ ] 32-02-PLAN.md — Discovery card redesign, status unification, optimistic UI, and visual verification

### Phase 33: Slide Intelligence Foundation
**Goal**: Ingestion pipeline produces rich AI descriptions and structured element maps per slide, and users can classify presentations as Template or Example with touch binding
**Depends on**: Phase 32 (UX patterns established; not a hard data dependency)
**Requirements**: SLI-01, SLI-02, SLI-03, SLI-04, SLI-05, CCL-01, CCL-02, CCL-03, CCL-04
**Success Criteria** (what must be TRUE):
  1. User opens per-template slide viewer and sees a rich AI-generated description for each slide (purpose, visual composition, key content, use cases)
  2. System stores structured element maps per slide (element ID, type, position, content) accessible for downstream consumption
  3. User re-ingests a template and previously-ingested slides receive backfilled descriptions and element maps
  4. User can classify any presentation as "Template" or "Example" and bind examples to a specific touch type (Touch 1-4)
  5. User sees "Action Required" indicator on unclassified presentations, and classification is visible on template cards and detail views
**Plans**: 3 plans

Plans:
- [ ] 33-01-PLAN.md — Schema migration, AI description generator, element extractor, pipeline wiring, and backfill logic
- [ ] 33-02-PLAN.md — Content classification API, status helpers, and classification UI in template cards and detail views
- [ ] 33-03-PLAN.md — Description and element map display in slide viewer with visual verification

### Phase 34: Deck Intelligence
**Goal**: Users can view AI-inferred deck structures per touch type and refine them via conversational chat
**Depends on**: Phase 33 (requires element maps and classified examples)
**Requirements**: DKI-01, DKI-02, DKI-03, DKI-04, DKI-05, DKI-06, DKI-07
**Success Criteria** (what must be TRUE):
  1. User can navigate to a Settings page from the main sidebar and see nested sub-navigation for different settings sections
  2. User can view AI-inferred deck structure breakdown for each touch type showing section flow, variations, and reference slides mapped to each section
  3. User sees a confidence score per touch type based on the number of available classified examples
  4. User can type feedback in a chat bar to refine the AI analysis (flag issues, add context) and the deck structure updates in response
**Plans**: TBD

Plans:
- [ ] 34-01: TBD
- [ ] 34-02: TBD
- [ ] 34-03: TBD

## Progress

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
| 18. CI/CD Pipeline & pgvector Schema | v1.2 | 2/2 | Complete | 2026-03-05 |
| 19. Navigation & Template Management | v1.2 | 3/3 | Complete | 2026-03-05 |
| 20. Slide Ingestion Agent | v1.2 | 2/2 | Complete | 2026-03-06 |
| 21. Preview & Review Engine | v1.2 | 3/3 | Complete | 2026-03-06 |
| 22. OAuth Scope Expansion & Token Storage | v1.3 | 3/3 | Complete | 2026-03-06 |
| 23. User-Delegated API Clients & Token Passthrough | v1.3 | 2/2 | Complete | 2026-03-06 |
| 24. Token Pool & Refresh Lifecycle | v1.3 | 2/2 | Complete | 2026-03-06 |
| 25. Integration Verification & Cutover | v1.3 | 2/2 | Complete | 2026-03-06 |
| 26. Tech Debt Cleanup | v1.3 | 1/1 | Complete | 2026-03-06 |
| 27. Auth Foundation | v1.4 | 5/5 | Complete | 2026-03-06 |
| 28. MCP Integration | v1.4 | 2/2 | Complete | 2026-03-07 |
| 29. Discovery UI | v1.4 | 3/3 | Complete | 2026-03-07 |
| 30. Verification & Doc Reconciliation | v1.4 | 1/1 | Complete | 2026-03-07 |
| 31. Tech Debt Cleanup | v1.4 | 1/1 | Complete | 2026-03-07 |
| 32. UX Polish | v1.5 | 2/2 | Complete | 2026-03-07 |
| 33. Slide Intelligence Foundation | 1/3 | In Progress|  | - |
| 34. Deck Intelligence | v1.5 | 0/TBD | Not started | - |
