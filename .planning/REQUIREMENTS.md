# Requirements: Lumenalta Agentic Sales Orchestration

**Defined:** 2026-03-04
**Core Value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.

## v1.1 Requirements

Requirements for Infrastructure & Access Control milestone. Each maps to roadmap phases.

### Database (DB)

- [x] **DB-01**: Supabase dev and prod projects created with Prisma-compatible connection strings
- [x] **DB-02**: Prisma provider switched from sqlite to postgresql with fresh migration baseline
- [x] **DB-03**: All existing Prisma models work against Supabase Postgres without application code changes
- [x] **DB-04**: Mastra workflow state persists in durable Postgres storage (not local SQLite file)
- [x] **DB-05**: Seed data loads successfully against Supabase dev instance

### Authentication (AUTH)

- [ ] **AUTH-01**: User can sign in with Google OAuth (@lumenalta.com accounts only)
- [ ] **AUTH-02**: Users from non-@lumenalta.com domains are rejected with clear error message
- [ ] **AUTH-03**: Unauthenticated users are redirected to login page on any app route
- [ ] **AUTH-04**: User session persists across browser refresh (cookie-based via Supabase SSR)
- [ ] **AUTH-05**: User can sign out and is redirected to login page
- [ ] **AUTH-06**: Agent server rejects requests without valid API key with 401 response
- [ ] **AUTH-07**: Web app sends API key header on all requests to agent server

### Deployment (DEPLOY)

- [ ] **DEPLOY-01**: Next.js web app deploys to Vercel with production and preview environments
- [ ] **DEPLOY-02**: Production deploys from main branch; preview deploys from other branches
- [ ] **DEPLOY-03**: Environment variables configured per Vercel environment (prod Supabase for production, dev Supabase for preview)
- [ ] **DEPLOY-04**: Mastra agent server runs on Oracle Cloud Ampere A1 VM with HTTPS via reverse proxy
- [ ] **DEPLOY-05**: Agent server auto-restarts on crash (Docker restart policy)
- [ ] **DEPLOY-06**: CI/CD: web auto-deploys via Vercel on push; agent deploys via GitHub Actions or deploy script
- [ ] **DEPLOY-07**: Google Workspace API credentials work in deployed environments (inline JSON, no file path dependency)

## Future Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Observability

- **OBS-01**: Centralized logging for agent server (structured JSON logs)
- **OBS-02**: Health check endpoint for agent server monitoring
- **OBS-03**: Vercel analytics for web app performance

### User Management

- **USER-01**: Admin can view list of authenticated users
- **USER-02**: User profile displayed in app header with Google avatar

## Out of Scope

| Feature | Reason |
|---------|--------|
| Per-user data isolation | All sellers share the same deal/company data; multi-tenancy is future |
| Role-based access control | All @lumenalta.com users have equal access for now |
| Custom domain for agent | Oracle VM uses IP + Caddy auto-TLS or subdomain; custom domain is future |
| Database data migration | v1.0 data is demo seed only; fresh start on Supabase is acceptable |
| Supabase Edge Functions | Not needed; Mastra handles all AI orchestration |
| Vercel Edge Runtime | Standard Node.js runtime sufficient for all routes |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DB-01 | Phase 14 | Complete |
| DB-02 | Phase 14 | Complete |
| DB-03 | Phase 14 | Complete |
| DB-04 | Phase 14 | Complete |
| DB-05 | Phase 14 | Complete |
| AUTH-01 | Phase 16 | Pending |
| AUTH-02 | Phase 16 | Pending |
| AUTH-03 | Phase 16 | Pending |
| AUTH-04 | Phase 16 | Pending |
| AUTH-05 | Phase 16 | Pending |
| AUTH-06 | Phase 15 | Pending |
| AUTH-07 | Phase 15 | Pending |
| DEPLOY-01 | Phase 17 | Pending |
| DEPLOY-02 | Phase 17 | Pending |
| DEPLOY-03 | Phase 17 | Pending |
| DEPLOY-04 | Phase 17 | Pending |
| DEPLOY-05 | Phase 17 | Pending |
| DEPLOY-06 | Phase 17 | Pending |
| DEPLOY-07 | Phase 17 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-05 after Phase 14 completion*
