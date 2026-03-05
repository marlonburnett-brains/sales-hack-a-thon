# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Infrastructure & Access Control** -- Phases 14-17 (in progress)

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

### v1.1 Infrastructure & Access Control

- [x] **Phase 14: Database Migration** - Migrate from SQLite to Supabase PostgreSQL with Mastra durable storage
- [x] **Phase 15: Service-to-Service Auth** - Shared API key authentication between web app and agent server (completed 2026-03-05)
- [x] **Phase 16: Google OAuth Login Wall** - Supabase Auth with Google OAuth restricted to @lumenalta.com (completed 2026-03-05)
- [ ] **Phase 17: Deployment & Go-Live** - Deploy web to Vercel and agent to Oracle Cloud VM with HTTPS

## Phase Details

### Phase 14: Database Migration
**Goal**: All application data and workflow state persists in Supabase PostgreSQL instead of local SQLite files
**Depends on**: Nothing (first phase of v1.1; v1.0 complete)
**Requirements**: DB-01, DB-02, DB-03, DB-04, DB-05
**Success Criteria** (what must be TRUE):
  1. Supabase dev instance is reachable and Prisma can connect using the pooled connection string
  2. Running `pnpm dev` for the agent server starts without errors and all existing workflows (Touch 1-4, Pre-Call Briefing) execute against PostgreSQL with no application code changes
  3. A suspended HITL workflow can be resumed after an agent server restart (Mastra state survives in Postgres, not a local file)
  4. The Meridian Capital Group seed scenario loads successfully and appears correctly in the web UI
  5. Supabase prod instance exists with the same schema (migrations applied) but no seed data
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md -- Supabase setup, Prisma provider switch, Mastra storage swap
- [x] 14-02-PLAN.md -- Seed data, prod migration, full verification

### Phase 15: Service-to-Service Auth
**Goal**: The agent server rejects all unauthorized requests, and the web app authenticates every call to the agent
**Depends on**: Phase 14 (env var schemas updated during database migration)
**Requirements**: AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. A curl request to any agent endpoint without an `X-API-Key` header returns 401 Unauthorized
  2. A curl request with an incorrect API key returns 401 Unauthorized
  3. The web app successfully communicates with the agent when both share the correct API key (all existing workflows still function)
**Plans**: 1 plan

Plans:
- [x] 15-01-PLAN.md -- SimpleAuth middleware on agent, X-API-Key header injection on web, health check endpoint

### Phase 16: Google OAuth Login Wall
**Goal**: Only authenticated @lumenalta.com users can access the application; everyone else is blocked
**Depends on**: Phase 14 (Supabase project must exist for Supabase Auth)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. Visiting any app route while unauthenticated redirects to a login page with a "Sign in with Google" button
  2. Signing in with a @lumenalta.com Google account completes successfully and lands on the app home page
  3. Signing in with a non-@lumenalta.com Google account (e.g., personal Gmail) is rejected with a clear error message explaining the domain restriction
  4. After signing in, refreshing the browser or opening a new tab preserves the session (no re-login required)
  5. Clicking "Sign out" ends the session and redirects to the login page
**Plans**: 2 plans

Plans:
- [x] 16-01-PLAN.md -- Auth infrastructure: Supabase clients, middleware, OAuth callback, route restructure
- [x] 16-02-PLAN.md -- Login page UI, UserNav avatar dropdown, end-to-end verification

### Phase 17: Deployment & Go-Live
**Goal**: The platform is accessible at production URLs -- web app on Vercel, agent server on Oracle Cloud VM with HTTPS -- with correct environment separation
**Depends on**: Phase 14, Phase 15, Phase 16 (all must be complete and tested locally)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DEPLOY-07
**Success Criteria** (what must be TRUE):
  1. The web app is accessible at a Vercel production URL and loads the login page
  2. Pushing to main triggers an automatic production deployment; pushing to a feature branch creates a preview deployment with dev Supabase credentials
  3. The agent server is accessible at an HTTPS URL on the Oracle Cloud VM and responds to health checks
  4. The agent server automatically restarts after a crash (Docker restart policy verified)
  5. An end-to-end workflow (e.g., Touch 1 pager generation) completes successfully using production URLs -- web on Vercel calls agent on Oracle VM, agent writes to Google Drive via inline JSON credentials
**Plans**: TBD

Plans:
- [ ] 17-01: TBD
- [ ] 17-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 14 -> 15 -> 16 -> 17
(Phases 15 and 16 are independent of each other but both depend on Phase 14. Phase 17 depends on all three.)

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
| 17. Deployment & Go-Live | v1.1 | 0/? | Not started | - |
