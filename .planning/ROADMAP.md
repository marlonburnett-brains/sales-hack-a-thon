# Roadmap: Lumenalta Agentic Sales Orchestration

## Milestones

- v1.0 **Agentic Sales MVP** -- Phases 1-13 (shipped 2026-03-05) -- [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 **Infrastructure & Access Control** -- Phases 14-17 (shipped 2026-03-05) -- [Archive](milestones/v1.1-ROADMAP.md)
- v1.2 **Templates & Slide Intelligence** -- Phases 18-21 (shipped 2026-03-06) -- [Archive](milestones/v1.2-ROADMAP.md)
- v1.3 **Google API Auth: User-Delegated Credentials** -- Phases 22-25

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

### v1.3 Google API Auth: User-Delegated Credentials (Phases 22-25)

- [x] Phase 22: OAuth Scope Expansion & Token Storage (completed 2026-03-06)
- [x] Phase 23: User-Delegated API Clients & Token Passthrough (completed 2026-03-06)
- [x] Phase 24: Token Pool & Refresh Lifecycle (completed 2026-03-06)
- [ ] Phase 25: Integration Verification & Cutover

## Phase Details — v1.3

### Phase 22: OAuth Scope Expansion & Token Storage

**Goal:** Capture Google OAuth tokens with expanded scopes during login and store encrypted refresh tokens per user.

**Requirements:** OAUTH-01, OAUTH-02, OAUTH-03, OAUTH-04, TOKS-01, TOKS-02, TOKS-03, TOKS-04, TOKS-05

**Success criteria:**
- Login requests Drive, Slides, Docs read-only scopes + offline access
- Consent screen appears on login
- Refresh token captured in auth callback and stored encrypted via agent API
- `UserGoogleToken` model with AES-256-GCM encryption, `lastUsedAt`, `isValid` tracking
- Encryption uses Node.js `crypto` only (no new dependencies)
- New env vars: `GOOGLE_TOKEN_ENCRYPTION_KEY`

**Key files:**
- `apps/web/src/app/login/page.tsx` — add scopes + offline access
- `apps/web/src/app/auth/callback/route.ts` — capture refresh token, store via agent
- `apps/agent/prisma/schema.prisma` — `UserGoogleToken` model
- `apps/agent/src/lib/token-encryption.ts` — new: AES-256-GCM encrypt/decrypt
- `apps/agent/src/mastra/index.ts` — new: token storage API route

**Plans:** 3/3 plans complete

Plans:
- [x] 22-01-PLAN.md — Agent-side token encryption, UserGoogleToken model, and token API routes
- [x] 22-02-PLAN.md — Web-side OAuth scope expansion, callback token capture, middleware re-consent
- [x] 22-03-PLAN.md — Token status badge and Connect Google button in user nav

---

### Phase 23: User-Delegated API Clients & Token Passthrough

**Goal:** Modify Google API client factories to accept user tokens and wire up the web->agent token passthrough.

**Requirements:** GAPI-01, GAPI-02, GAPI-03, GAPI-04, PASS-01, PASS-02, PASS-03, PASS-04

**Success criteria:**
- `getSlidesClient()`, `getDriveClient()`, `getDocsClient()` accept optional `accessToken`
- With token: use `OAuth2Client` with user's credentials
- Without token: fall back to service account (backward compatible)
- `api-client.ts` sends `X-Google-Access-Token` header when token available
- Agent routes extract header and pass to Google API factories
- Server Actions retrieve Google token from Supabase session
- Template operations use user token for Google API calls

**Key files:**
- `apps/agent/src/lib/google-auth.ts` — add user-delegated auth path
- `apps/web/src/lib/api-client.ts` — add `X-Google-Access-Token` header
- `apps/web/src/lib/actions/*.ts` — pass Google token from session
- `apps/agent/src/mastra/index.ts` — extract token from request headers

**Plans:** 2/2 plans complete

Plans:
- [x] 23-01-PLAN.md — Agent-side dual-mode factories, token cache, request-auth helper, and route wiring
- [x] 23-02-PLAN.md — Web-side fetchWithGoogleAuth wrapper and Server Action passthrough

---

### Phase 24: Token Pool & Refresh Lifecycle

**Goal:** Implement background job token pool with ordered fallback, refresh token lifecycle management, and Action Required UI for surfacing manual user actions.

**Requirements:** POOL-01, POOL-02, POOL-03, POOL-04, POOL-05, LIFE-01, LIFE-02, LIFE-03

**Success criteria:**
- Background jobs draw from pool of user tokens ordered by lastUsedAt DESC, fallback to service account
- Pool tries ALL valid tokens with automatic fallback on failure
- Failed tokens marked `isValid: false` with `revokedAt`
- Successful usage updates `lastUsedAt`
- Warning logged when valid pool < 3 tokens
- Token rotation handled (new refresh token from Google updates stored token)
- Re-login updates existing token (upsert on userId)
- ActionRequired model tracks manual user interventions (re-auth, sharing, Drive access)
- Action Required page and sidebar badge in web app

**Key files:**
- `apps/agent/src/lib/google-auth.ts` — `getPooledGoogleAuth()` function
- `apps/agent/prisma/schema.prisma` — `ActionRequired` model
- `apps/agent/src/mastra/index.ts` — background job wiring + ActionRequired CRUD routes
- `apps/web/src/app/(authenticated)/actions/page.tsx` — Action Required page
- `apps/web/src/components/sidebar.tsx` — Action Required nav item with badge

**Plans:** 2/2 plans complete

Plans:
- [ ] 24-01-PLAN.md — Token pool core, ActionRequired model, background job wiring, CRUD routes
- [ ] 24-02-PLAN.md — Action Required web UI with sidebar badge and full-page listing

---

### Phase 25: Integration Verification & Cutover

**Goal:** Verify all existing features work with the new auth model and that user-delegated tokens can access org-shared files.

**Requirements:** INTG-01, INTG-02, INTG-03

**Success criteria:**
- Touch 1-4 workflows function with service account fallback (no regression)
- Template ingestion and staleness polling work with user tokens
- User with Google token can access org-shared files the service account cannot
- Background staleness polling works with pooled tokens
- All existing tests pass

**Key files:**
- Verification across all workflow and template files
- No new code expected; fixes for any issues discovered

**Estimated plans:** 1

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
| 24. Token Pool & Refresh Lifecycle | 1/2 | Complete    | 2026-03-06 | -- |
| 25. Integration Verification & Cutover | v1.3 | 0/1 | Pending | -- |
