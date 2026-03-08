# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (shipped 2026-03-06) -- [Archive](milestones/v1.2-ROADMAP.md)
- v1.3 **Google API Auth: User-Delegated Credentials** -- Phases 22-26 (shipped 2026-03-06) -- [Archive](milestones/v1.3-ROADMAP.md)
- v1.4 **AtlusAI Authentication & Discovery** -- Phases 27-31 (shipped 2026-03-07) -- [Archive](milestones/v1.4-ROADMAP.md)
- v1.5 **Review Polish & Deck Intelligence** -- Phases 32-34 (shipped 2026-03-07) -- [Archive](milestones/v1.5-ROADMAP.md)
- v1.6 **Touch 4 Artifact Intelligence** -- Phases 35-40 (in progress)

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
- [x] Phase 30: Verification & Doc Reconciliation (1/1 plan) -- completed 2026-03-07
- [x] Phase 31: Tech Debt Cleanup (1/1 plan) -- completed 2026-03-07

</details>

<details>
<summary>v1.5 Review Polish & Deck Intelligence (Phases 32-34) -- SHIPPED 2026-03-07</summary>

- [x] Phase 32: UX Polish (2/2 plans) -- completed 2026-03-07
- [x] Phase 33: Slide Intelligence Foundation (3/3 plans) -- completed 2026-03-07
- [x] Phase 34: Deck Intelligence (3/3 plans) -- completed 2026-03-07

</details>

### v1.6 Touch 4 Artifact Intelligence (In Progress)

**Milestone Goal:** Add artifact type sub-classification (Proposal / Talk Track / FAQ) to Touch 4 Examples and display per-artifact-type deck structures in Settings.

- [x] **Phase 35: Schema & Constants Foundation** (2/2 plans) - Prisma migrations for artifactType columns and shared constants (completed 2026-03-07)
- [x] **Phase 36: Backend Engine & API Routes** - Inference, cron, chat refinement, and API routes updated for per-artifact-type operation (completed 2026-03-07)
- [x] **Phase 37: Frontend UI** - Classify UI artifact selector, Settings tabbed deck structure views, and slide-viewer badge hydration (completed 2026-03-07)
- [ ] **Phase 38: Live Verification Sweep** - Re-confirm backend live behavior and frontend browser flows for Touch 4 artifact handling
- [ ] **Phase 39: Artifact Contract Hardening** - Eliminate artifact-aware UI reuse risks and tighten shared `ArtifactType` typing across web and chat paths
- [ ] **Phase 40: Agent Typecheck Cleanup** - Resolve pre-existing `agent` TypeScript failures left outside the original milestone scope

## Phase Details

### Phase 35: Schema & Constants Foundation
**Goal**: Data model supports artifact type classification and per-artifact deck structures
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: SCHM-01, SCHM-02, SCHM-03
**Success Criteria** (what must be TRUE):
  1. `ARTIFACT_TYPES` constant is importable from `@lumenalta/schemas` and contains `proposal`, `talk_track`, `faq`
  2. Template model has nullable `artifactType` column and existing templates are unaffected (null value)
  3. DeckStructure model has nullable `artifactType` column with composite unique constraint on `(touchType, artifactType)`
  4. Existing mixed Touch 4 DeckStructure row is cleaned up during migration
  5. All migrations are forward-only and applied without reset
**Plans**: 2 plans

Plans:
- [x] 35-01-PLAN.md — Publish shared artifact type constants, labels, and type exports from `@lumenalta/schemas`
- [x] 35-02-PLAN.md — Add `artifactType` schema migration and preserve non-Touch-4 deck structure compatibility

### Phase 36: Backend Engine & API Routes
**Goal**: Inference, cron, and chat operate independently per artifact type for Touch 4
**Depends on**: Phase 35
**Requirements**: DECK-01, DECK-02, DECK-05
**Success Criteria** (what must be TRUE):
  1. `inferDeckStructure()` accepts `artifactType` parameter and filters Touch 4 examples to only that artifact type before sending to the LLM
  2. Cron auto-inference iterates 6 keys (Touch 1-3 + Touch 4 x3 artifact types) with per-key change detection including `artifactType` in hash
  3. Chat refinement threads `artifactType` through the entire chain, scoping conversation to the correct artifact-type structure
  4. API routes accept `?artifactType=` query parameter and return 7 deck structure entries: Touch 1, Touch 2, Touch 3, Pre-call, and 3 artifact-specific Touch 4 entries
**Plans**: 2 plans

Plans:
- [x] 36-01-PLAN.md — Add shared artifact-aware deck keys plus Touch 4 inference and cron isolation
- [x] 36-02-PLAN.md — Thread artifactType through deck-structure routes, chat refinement, and web proxies

### Phase 37: Frontend UI
**Goal**: Users can classify Touch 4 examples by artifact type and view per-artifact deck structures in Settings
**Depends on**: Phase 36
**Requirements**: CLSF-01, CLSF-02, DECK-03, DECK-04
**Success Criteria** (what must be TRUE):
  1. When classifying a presentation as Touch 4 Example, user sees artifact type selector (Proposal / Talk Track / FAQ) and selection is persisted
  2. Artifact type selector only appears when both Touch 4 and Example are selected -- hidden for all other combinations
  3. Settings Touch 4 page shows three tabs (Proposal / Talk Track / FAQ) each with its own deck structure display
  4. Each Touch 4 artifact tab shows independent confidence scoring based on classified example count for that specific artifact type
  5. Chat refinement on each tab is scoped to the correct artifact type structure
**Plans**: 4 plans

Plans:
- [x] 37-01-PLAN.md — Add shared Touch 4 artifact classification controls and persist `artifactType` through the classify flow
- [x] 37-02-PLAN.md — Convert Touch 4 settings into artifact tabs with per-tab confidence, empty states, and scoped chat
- [x] 37-03-PLAN.md — Wire both classify surfaces to the shared Touch 4 control and show saved artifact badges
- [x] 37-04-PLAN.md — Hydrate persisted slide-viewer artifact badges after reload

### Phase 38: Live Verification Sweep
**Goal**: Clear remaining live-environment verification debt for Touch 4 artifact workflows
**Depends on**: Phase 37
**Requirements**: None (verification closure for v1.6)
**Tech Debt Closure**: Backend live streaming and cron confirmation; frontend human browser confirmation for reload, settings tabs, and chat behavior
**Success Criteria** (what must be TRUE):
  1. Live external-service streaming behavior is exercised and documented against a reachable environment
  2. Background cron behavior is re-confirmed in a live-like environment with artifact-qualified Touch 4 processing evidence
  3. Human browser validation confirms cross-surface Touch 4 classification reload behavior end-to-end
  4. Human browser validation confirms Touch 4 settings tab and chat behavior stay artifact-scoped end-to-end
**Plans**: 3 plans

Plans:
- [ ] 38-01-PLAN.md — Lock one reachable verification target and write the Phase 38 live runbook
- [ ] 38-02-PLAN.md — Capture live streaming and cron evidence for artifact-qualified Touch 4 backend paths
- [ ] 38-03-PLAN.md — Run reachable-environment browser UAT for Touch 4 reload and settings/chat behavior

### Phase 39: Artifact Contract Hardening
**Goal**: Remove artifact-type maintenance risks and align web/chat code with the shared artifact contract
**Depends on**: Phase 38
**Requirements**: None (maintains DECK-03, DECK-04, DECK-05, CLSF-01, CLSF-02)
**Tech Debt Closure**: `deck-structure-view.tsx` artifact-awareness gap and broad `string` typing for `artifactType`
**Success Criteria** (what must be TRUE):
  1. `apps/web/src/components/settings/deck-structure-view.tsx` correctly loads and preserves artifact-qualified Touch 4 details if reused
  2. Web helper paths use the shared `ArtifactType` contract instead of broad `string` where artifact-qualified data is expected
  3. Chat-related paths use the shared `ArtifactType` contract end-to-end for compile-time safety
  4. Regression coverage or verification proves artifact-aware UI and chat flows still work after contract tightening
**Plans**: 0 plans

Plans:
- [ ] Planning pending

### Phase 40: Agent Typecheck Cleanup
**Goal**: Restore a clean `agent` TypeScript baseline so v1.6 artifact work sits on a passing compile target
**Depends on**: Phase 39
**Requirements**: None (repo health cleanup for v1.6 closeout)
**Tech Debt Closure**: Pre-existing `pnpm --filter agent exec tsc --noEmit` failures left outside prior plan scope
**Success Criteria** (what must be TRUE):
  1. Current `agent` TypeScript failures are inventoried and reduced to in-scope actionable fixes
  2. Pre-existing `agent` type errors that block a clean no-emit compile are resolved without regressing Touch 4 behavior
  3. `pnpm --filter agent exec tsc --noEmit` passes or remaining failures are explicitly isolated outside the repository baseline
**Plans**: 0 plans

Plans:
- [ ] Planning pending

## Progress

**Execution Order:** 35 -> 36 -> 37 -> 38 -> 39 -> 40

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
| 37. Frontend UI | v1.6 | Complete    | 2026-03-07 | 2026-03-07 |
| 38. Live Verification Sweep | v1.6 | 1/3 | In Progress | |
| 39. Artifact Contract Hardening | v1.6 | 0/0 | Planned | |
| 40. Agent Typecheck Cleanup | v1.6 | 0/0 | Planned | |
