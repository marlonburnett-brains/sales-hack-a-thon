# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (shipped 2026-03-06) -- [Archive](milestones/v1.2-ROADMAP.md)
- v1.3 **Google API Auth: User-Delegated Credentials** -- Phases 22-26 (shipped 2026-03-06) -- [Archive](milestones/v1.3-ROADMAP.md)
- v1.4 **AtlusAI Authentication & Discovery** -- Phases 27-31 (shipped 2026-03-07) -- [Archive](milestones/v1.4-ROADMAP.md)
- v1.5 **Review Polish & Deck Intelligence** -- Phases 32-34 (shipped 2026-03-07) -- [Archive](milestones/v1.5-ROADMAP.md)
- v1.6 **Touch 4 Artifact Intelligence** -- Phases 35-40 (shipped 2026-03-08) -- [Archive](milestones/v1.6-ROADMAP.md)
- **v1.7 Deals & HITL Pipeline** -- Phases 41-47 (in progress)

## Phases

<details>
<summary>v1.0 Agentic Sales MVP (Phases 1-13) -- SHIPPED 2026-03-05</summary>

- [x] Phase 1: Monorepo Foundation (3/3 plans) -- completed 2026-03-03
- [x] Phase 2: Content Library Ingestion (3/3 plans) -- completed 2026-03-03
- [x] Phase 3: Zod Schema Layer (2/2 plans) -- completed 2026-03-03
- [x] Phase 4: Touch 1-3 Asset Generation (3/3 plans) -- completed 2026-03-04
- [x] Phase 5: Transcript Processing (3/3 plans) -- completed 2026-03-04
- [x] Phase 6: HITL Checkpoint 1 (2/2 plans) -- completed 2026-03-04
- [x] Phase 7: RAG Retrieval (2/2 plans) -- completed 2026-03-04
- [x] Phase 8: Google Workspace Output (3/3 plans) -- completed 2026-03-04
- [x] Phase 9: HITL Checkpoint 2 (2/2 plans) -- completed 2026-03-04
- [x] Phase 10: Pre-Call Briefing (2/2 plans) -- completed 2026-03-04
- [x] Phase 11: E2E Integration (2/2 plans) -- completed 2026-03-04
- [x] Phase 12: Content Re-ingestion (2/2 plans) -- completed 2026-03-04
- [x] Phase 13: Touch 4 Poll Loop Fixes (1/1 plan) -- completed 2026-03-04

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
<summary>v1.3 Google API Auth (Phases 22-26) -- SHIPPED 2026-03-06</summary>

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
- [x] Phase 30: Verification & Doc Reconciliation (1/1 plan) -- completed 2026-03-07
- [x] Phase 31: Tech Debt Cleanup (1/1 plan) -- completed 2026-03-07

</details>

<details>
<summary>v1.5 Review Polish & Deck Intelligence (Phases 32-34) -- SHIPPED 2026-03-07</summary>

- [x] Phase 32: UX Polish (2/2 plans) -- completed 2026-03-07
- [x] Phase 33: Slide Intelligence Foundation (3/3 plans) -- completed 2026-03-07
- [x] Phase 34: Deck Intelligence (3/3 plans) -- completed 2026-03-07

</details>

<details>
<summary>v1.6 Touch 4 Artifact Intelligence (Phases 35-40) -- SHIPPED 2026-03-08</summary>

- [x] Phase 35: Schema & Constants Foundation (2/2 plans) -- completed 2026-03-07
- [x] Phase 36: Backend Engine & API Routes (2/2 plans) -- completed 2026-03-07
- [x] Phase 37: Frontend UI (4/4 plans) -- completed 2026-03-07
- [x] Phase 38: Live Verification Sweep (6/6 plans) -- completed 2026-03-08
- [x] Phase 39: Artifact Contract Hardening (3/3 plans) -- completed 2026-03-08
- [x] Phase 40: Agent Typecheck Cleanup (3/3 plans) -- completed 2026-03-08

</details>

### v1.7 Deals & HITL Pipeline (In Progress)

**Milestone Goal:** Transform the app from a content-generation tool into a full deal-management platform with pipeline views, deal detail navigation, AI chat assistance, and human-in-the-loop artifact generation across all four touches.

**Parallelization Map:**
```
Tier 1 (start immediately):  41 ────┐     43 ────┐
                                     |            |
Tier 2 (after tier 1):       42 ────┤     44 ────┤
                              (needs 41)   (needs 43)
                                     |            |
Tier 3 (after 42 + 43):      45 ────┤     46 ────┤
                           (needs 42+43) (needs 42+43)
                                                  |
Tier 4 (after 46):                           47 ──┘
                                            (needs 46)
```

- [x] **Phase 41: Deal Pipeline Page** - Deal list with status lifecycle, view toggle, filtering, and assignment (completed 2026-03-08)
- [x] **Phase 42: Deal Detail Layout** - Sub-page routing with breadcrumbs, sidebar, overview dashboard, and briefing page (completed 2026-03-08)
- [x] **Phase 43: Named Agent Architecture** - Formalized agents with DB-backed versioned system prompts (completed 2026-03-08)
- [x] **Phase 44: Agent Management UI** - Settings page for viewing, editing, versioning, and publishing agent prompts (completed 2026-03-08)
- [ ] **Phase 45: Persistent AI Chat Bar** - Deal-scoped chat with context, transcripts, and knowledge base queries
- [x] **Phase 46: Touch Pages & HITL Workflow** - Per-touch artifact generation with 3-stage HITL and chat refinement (completed 2026-03-08)
- [ ] **Phase 47: Drive Artifact Integration** - Folder selection, sharing controls, and org-default permissions for generated artifacts

## Phase Details

### Phase 41: Deal Pipeline Page
**Goal**: Users can manage their deal pipeline with status tracking, multiple views, and team assignment
**Depends on**: Nothing (Tier 1 -- start immediately)
**Parallel with**: Phase 43
**Requirements**: DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DEAL-06, DEAL-07
**Success Criteria** (what must be TRUE):
  1. User sees each deal's status (Open, Won, Lost, Abandoned) displayed on the deals page
  2. User can change a deal's status and the change persists across page reloads
  3. User can switch between card grid view and list/table view on the deals page
  4. Deals page loads showing Open deals by default, with filters available for other statuses
  5. User can assign an owner and collaborators to a deal, and filter the list by assignee
**Plans**: 3 plans
Plans:
- [x] 41-01-PLAN.md — Schema migration, API endpoints, and web data layer
- [ ] 41-02-PLAN.md — Filter bar, view toggle, table view, and card enhancements
- [ ] 41-03-PLAN.md — Status actions, assignment picker, and assignee filtering

### Phase 42: Deal Detail Layout
**Goal**: Users can navigate within a deal through organized sub-pages with overview and briefing content
**Depends on**: Phase 41 (Deal model with status/assignment fields)
**Parallel with**: Phase 44
**Requirements**: NAV-01, NAV-02, NAV-03, OVER-01, OVER-02, OVER-03, OVER-04, BRIEF-01, BRIEF-02
**Success Criteria** (what must be TRUE):
  1. User sees breadcrumbs on any deal sub-page and can navigate back to the deals list
  2. Deal detail has a left sidebar with links to Overview, Briefing, and Touch 1-4, each loading its own sub-page
  3. Overview page displays deal state, status, key metrics, activity timeline, and assignment info
  4. Briefing page shows consolidated pre-call briefing, research data, and meeting notes in one place
**Plans**: 3 plans
Plans:
- [ ] 42-01-PLAN.md — Navigation infrastructure: breadcrumbs, deal sidebar, nested layout, route placeholders
- [ ] 42-02-PLAN.md — Overview page: deal header, status actions, metrics cards, activity timeline
- [ ] 42-03-PLAN.md — Briefing page: AI chat panel shell, prior briefings list

### Phase 43: Named Agent Architecture
**Goal**: All LLM interactions use formalized named agents with dedicated, versioned system prompts
**Depends on**: Nothing (Tier 1 -- start immediately)
**Parallel with**: Phase 41
**Requirements**: AGENT-01, AGENT-02
**Success Criteria** (what must be TRUE):
  1. Every LLM call in the system routes through a named agent with a dedicated system prompt
  2. Each agent has a clear responsibility boundary documented in its configuration
  3. Agent system prompts are stored in the database with version history and can be loaded with caching
**Plans**: 5 plans

Plans:
- [ ] `43-01-PLAN.md` - Shared agent catalog, Prisma prompt models, and published seed defaults
- [ ] `43-02-PLAN.md` - Prisma-backed prompt resolver, version-safe cache, and Mastra registry
- [ ] `43-03-PLAN.md` - Seller-facing workflow and shared-helper migration with version pinning
- [ ] `43-04-PLAN.md` - Extraction, ingestion, and validation migration for internal/background jobs
- [ ] `43-05-PLAN.md` - Deck-intelligence migration and final repo-level coverage guardrails

### Phase 44: Agent Management UI
**Goal**: Users can view, edit, version, and publish agent system prompts from the Settings page
**Depends on**: Phase 43 (agent config models and seed data)
**Parallel with**: Phase 42
**Requirements**: MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05
**Success Criteria** (what must be TRUE):
  1. User can see all formal agents and their current system prompts listed in Settings
  2. User can edit an agent's system prompt via direct text editing or conversational AI chat
  3. Saving a prompt edit creates a draft version; changes are not live until the user publishes
  4. Each published version is retained in full history, and the user can review or rollback to any prior version
**Plans**: 3 plans
Plans:
- [ ] 44-01-PLAN.md — Agent config CRUD API routes, web data layer, settings nav, and agent list page
- [ ] 44-02-PLAN.md — Agent detail page with prompt editing, draft/publish workflow, and baseline editor
- [ ] 44-03-PLAN.md — AI chat panel for prompt editing, version history timeline with diff and rollback

### Phase 45: Persistent AI Chat Bar
**Goal**: Users can interact with an AI assistant on any deal sub-page for context, transcripts, and knowledge queries
**Depends on**: Phase 42 (deal detail layout) + Phase 43 (named agents)
**Parallel with**: Phase 46
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):
  1. User can open a persistent chat bar on any deal sub-page, and it survives navigation between sub-pages
  2. User can add context, notes, or paste call transcripts via chat and bind them to a specific touch step
  3. User can ask questions about the deal's data and history and receive relevant answers
  4. User can query similar cases and use cases from the knowledge base and get results via chat
**Plans**: 5 plans
Plans:
- [ ] 45-01-PLAN.md — Deal chat contracts and governed named-agent identity
- [ ] 45-04-PLAN.md — Prisma storage, thread persistence helpers, and confirmation-aware binding heuristics
- [ ] 45-02-PLAN.md — Deal chat orchestrator, agent route registration, and direct route coverage
- [ ] 45-05-PLAN.md — Typed web proxy, api-client helpers, and deal-chat server actions
- [ ] 45-03-PLAN.md — Persistent dock/side-panel UI, route-aware suggestions, and layout wiring

### Phase 46: Touch Pages & HITL Workflow
**Goal**: Users can generate artifacts for each touch through a 3-stage human-in-the-loop workflow with AI chat refinement
**Depends on**: Phase 42 (deal detail layout with sub-page routing) + Phase 43 (named agents)
**Parallel with**: Phase 45
**Requirements**: TOUCH-01, TOUCH-02, TOUCH-03, TOUCH-04, TOUCH-05, TOUCH-06, TOUCH-07
**Success Criteria** (what must be TRUE):
  1. User can access a dedicated page for each touch (1-4) within the deal detail sidebar
  2. Touch 1 generates a first-contact pager, Touch 2 a Meet Lumenalta deck, Touch 3 a capability deck, Touch 4 a proposal + talk track + FAQ
  3. Each touch follows a visible 3-stage HITL workflow (Skeleton > Low-fi sketch > High-fi presentation) with stage indicators
  4. User can interact with AI chat at each HITL stage to refine the artifact before approving and advancing
**Plans**: 3 plans
Plans:
- [ ] 46-01-PLAN.md — Schema migration, shared HITL types, stepper, context provider, and preferences hook
- [ ] 46-02-PLAN.md — Multi-stage suspend points for all touch workflows and stage transition server actions
- [ ] 46-03-PLAN.md — Touch page shell UI, guided start, stage content display, history, and full page wiring

### Phase 47: Drive Artifact Integration
**Goal**: Users can save generated artifacts to Google Drive with folder and sharing controls
**Depends on**: Phase 46 (touch pages that produce artifacts to save)
**Requirements**: DRIVE-01, DRIVE-02, DRIVE-03
**Success Criteria** (what must be TRUE):
  1. User can choose a destination folder in Google Drive when saving a generated artifact
  2. User can configure the sharing scope of newly generated documents before saving
  3. Default sharing is set to entire org plus the service account, applied automatically unless overridden
**Plans**: 3 plans
Plans:
- [ ] 47-01-PLAN.md — UserSetting schema, org-scoped sharing utilities, root folder resolver, and OAuth scope upgrade
- [ ] 47-02-PLAN.md — Drive settings page with Google Picker folder selector and access token API
- [ ] 47-03-PLAN.md — Workflow migration to user-rooted folders, shareWithOrg, archive-on-regen, and Drive status UI

## Progress

**Execution Order (with parallelization):**
- Tier 1: Phase 41 + Phase 43 (concurrent, no dependencies)
- Tier 2: Phase 42 + Phase 44 (concurrent, each depends on one Tier 1 phase)
- Tier 3: Phase 45 + Phase 46 (concurrent, both depend on Phases 42 + 43)
- Tier 4: Phase 47 (depends on Phase 46)

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
| 33. Slide Intelligence Foundation | v1.5 | 3/3 | Complete | 2026-03-07 |
| 34. Deck Intelligence | v1.5 | 3/3 | Complete | 2026-03-07 |
| 35. Schema & Constants Foundation | v1.6 | 2/2 | Complete | 2026-03-07 |
| 36. Backend Engine & API Routes | v1.6 | 2/2 | Complete | 2026-03-07 |
| 37. Frontend UI | v1.6 | 4/4 | Complete | 2026-03-07 |
| 38. Live Verification Sweep | v1.6 | 6/6 | Complete | 2026-03-08 |
| 39. Artifact Contract Hardening | v1.6 | 3/3 | Complete | 2026-03-08 |
| 40. Agent Typecheck Cleanup | v1.6 | 3/3 | Complete | 2026-03-08 |
| 41. Deal Pipeline Page | 3/3 | Complete    | 2026-03-08 | - |
| 42. Deal Detail Layout | 3/3 | Complete    | 2026-03-08 | - |
| 43. Named Agent Architecture | 5/5 | Complete    | 2026-03-08 | - |
| 44. Agent Management UI | 3/3 | Complete    | 2026-03-08 | - |
| 45. Persistent AI Chat Bar | 3/5 | In Progress|  | - |
| 46. Touch Pages & HITL Workflow | 3/3 | Complete    | 2026-03-08 | - |
| 47. Drive Artifact Integration | 2/3 | In Progress|  | - |
