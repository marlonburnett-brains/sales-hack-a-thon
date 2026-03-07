# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (shipped 2026-03-06) -- [Archive](milestones/v1.2-ROADMAP.md)
- v1.3 **Google API Auth: User-Delegated Credentials** -- Phases 22-26 (shipped 2026-03-06) -- [Archive](milestones/v1.3-ROADMAP.md)
- v1.4 **AtlusAI Authentication & Discovery** -- Phases 27-31 (in progress)

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

### v1.4 AtlusAI Authentication & Discovery (In Progress)

**Milestone Goal:** Direct AtlusAI integration via Mastra MCP client with token pool auth, access detection, and a discovery UI for browsing/searching/ingesting AtlusAI content -- replacing the Drive API fallback with semantic search.

- [x] **Phase 27: Auth Foundation** - AtlusAI token storage, pool rotation, 3-tier access detection, and ActionRequired integration (completed 2026-03-06)
- [x] **Phase 28: MCP Integration** - MCPClient singleton wired to AtlusAI SSE with Drive fallback replacement (completed 2026-03-07)
- [x] **Phase 29: Discovery UI** - Sidebar nav, browse/search page, and selective ingestion into SlideEmbedding pipeline (completed 2026-03-07)
- [x] **Phase 30: Verification & Documentation Reconciliation** - Phase 29 VERIFICATION.md, Nyquist compliance for phases 27-29 (completed 2026-03-07)
- [x] **Phase 31: Tech Debt Cleanup** - Persist OAuth client_id, fix MCP truncation, remove dead code (completed 2026-03-07)

## Phase Details

### Phase 27: Auth Foundation
**Goal**: Users can store AtlusAI credentials and the system detects their access level, surfacing clear guidance when action is needed
**Depends on**: Phase 26 (v1.3 complete)
**Requirements**: ATLS-01, ATLS-02, ATLS-03, ATLS-04, ATLS-05, POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, TIER-01, TIER-02, TIER-03, TIER-04, TIER-05, ACTN-01, ACTN-02, ACTN-03, ACTN-04, ACTN-05
**Success Criteria** (what must be TRUE):
  1. User can submit AtlusAI credentials via a web form and re-submitting updates the existing record (not duplicates)
  2. Stored tokens are encrypted at rest (AES-256-GCM) and the system tracks validity, last usage, and revocation per token
  3. Background processes obtain a valid AtlusAI token from the pool (ordered by last used), with automatic invalidation on failure and env var fallback when the pool is empty
  4. When a user lacks an AtlusAI account or project access, a specific ActionRequired item appears in the sidebar with resolution guidance -- and resolving one tier immediately re-checks the next
  5. The system logs a warning when fewer than 3 valid AtlusAI tokens remain in the pool
**Plans**: 5 plans

Plans:
- [x] 27-01-PLAN.md -- UserAtlusToken model, ActionRequired schema extensions, action type constants, token CRUD helpers
- [x] 27-02-PLAN.md -- Token pool rotation (getPooledAtlusAuth) with env var fallback
- [x] 27-03-PLAN.md -- 3-tier access detection cascade and agent route updates (silence, badge count)
- [x] 27-04-PLAN.md -- ActionRequired UX overhaul (Silence replacing Dismiss, dimming, AtlusAI icons)
- [ ] 27-05-PLAN.md -- Gap closure: AtlusAI credential submission web form (ATLS-04)

### Phase 28: MCP Integration
**Goal**: AtlusAI semantic search replaces Drive API keyword search in all existing workflows, with Drive retained as a degraded fallback
**Depends on**: Phase 27
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06
**Success Criteria** (what must be TRUE):
  1. The MCPClient connects to the AtlusAI SSE endpoint using pooled credentials and lives only on the agent service (no MCP imports in apps/web)
  2. The MCPClient self-heals: health check via listTools() before use, disconnect and recreate on failure, forced recycle after configurable max lifetime, graceful shutdown on SIGTERM
  3. Each MCP request gets a fresh token from the pool via fetch callback (tokens rotate without breaking existing connections)
  4. searchSlides(), searchForProposal(), and searchByCapability() use MCP semantic search with results mapped to the existing SlideSearchResult interface -- all 5 consumer files unchanged
  5. Setting ATLUS_USE_MCP=false switches back to Drive API search; MCP search is scoped to the configured ATLUS_PROJECT_ID
**Plans**: 2 plans

Plans:
- [x] 28-01-PLAN.md -- MCPClient singleton wrapper with health check, lifecycle, and auth injection
- [x] 28-02-PLAN.md -- MCP-to-SlideSearchResult adapter with LLM parsing and Drive fallback replacement

### Phase 29: Discovery UI
**Goal**: Users can browse, search, and selectively ingest AtlusAI content from within the application
**Depends on**: Phase 28
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06, DISC-07, DISC-08, DISC-09
**Success Criteria** (what must be TRUE):
  1. "AtlusAI" appears in the sidebar navigation and leads to a /discovery route with browse and search views
  2. Browse view shows a paginated document inventory from AtlusAI filtered to the configured project; search view returns semantic results with content previews and relevance scoring on debounced input
  3. If the user (or pool) lacks AtlusAI access, the discovery page shows the appropriate ActionRequired state instead of content
  4. Users can select items from browse or search results and ingest them into the local SlideEmbedding pipeline, with per-item progress indication
  5. Already-ingested content is visually marked in results to prevent duplicate ingestion
**Plans**: 3 plans

Plans:
- [x] 29-01-PLAN.md -- Agent API endpoints, server actions, sidebar nav, /discovery route with access gating
- [x] 29-02-PLAN.md -- Browse view with infinite scroll, card/list toggle, search with debounce, relevance scoring, preview panel
- [x] 29-03-PLAN.md -- Batch selection, floating toolbar, ingestion progress polling, dedup markers (scope absorbed by 29-01 and 29-02)

### Phase 30: Verification & Documentation Reconciliation
**Goal**: Formal verification of Phase 29 and Nyquist compliance across all v1.4 phases
**Depends on**: Phase 29
**Requirements**: None (verification/compliance phase)
**Gap Closure**: Closes verification gap from v1.4 audit
**Success Criteria** (what must be TRUE):
  1. Phase 29 has a VERIFICATION.md confirming DISC-01..09 satisfaction with evidence
  2. Nyquist compliance addressed for phases 27, 28, and 29
  3. All tech debt items from audit are documented or resolved
**Plans**: 1 plan

Plans:
- [ ] 30-01-PLAN.md -- Write Phase 29 VERIFICATION.md, address Nyquist compliance for phases 27-29

### Phase 31: Tech Debt Cleanup
**Goal**: Address tech debt identified in v1.4 milestone audit
**Depends on**: Phase 29
**Requirements**: None (tech debt phase)
**Gap Closure**: Closes 3 tech debt items from v1.4 audit
**Success Criteria** (what must be TRUE):
  1. OAuth client registration persists `client_id` to avoid re-registering on every connect
  2. LLM extraction handles MCP results larger than 8000 chars (pagination or chunking)
  3. Dead code removed: `recheckAtlusAccessAction` and `recheckAtlusAccess`
**Plans**: 1 plan

Plans:
- [ ] 31-01-PLAN.md -- Persist OAuth client_id, fix MCP truncation limit, remove dead code

## Progress

**Execution Order:**
Phases execute in numeric order: 27 -> 28 -> 29 -> 30 -> 31

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
| 30. Verification & Doc Reconciliation | 1/1 | Complete    | 2026-03-07 | - |
| 31. Tech Debt Cleanup | v1.4 | Complete    | 2026-03-07 | 2026-03-07 |
