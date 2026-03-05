---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Infrastructure & Access Control
status: executing
stopped_at: Completed 17-01-PLAN.md
last_updated: "2026-03-05T14:16:55.174Z"
last_activity: 2026-03-05 -- Completed Phase 17 Plan 01 (Deployment Infrastructure)
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 7
  completed_plans: 6
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Sellers walk into every meeting prepared and walk out of every meeting with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Current focus:** Phase 17 in progress -- Deployment & Go-Live

## Current Position

Phase: 17 (4 of 4 in v1.1) -- Deployment & Go-Live
Plan: 1 of 2 complete
Status: Plan 01 complete (deployment infrastructure files) -- Plan 02 pending (VM provisioning + deploy)
Last activity: 2026-03-05 -- Completed Phase 17 Plan 01 (Deployment Infrastructure)

Progress: [########..] 86%

## Performance Metrics

**Velocity:**
- Total plans completed: 6 (v1.1) / 36 (all-time)
- Average duration: 7min (v1.1)
- Total execution time: 44min (v1.1)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 14 - Database Migration | 2/2 | 33min | 17min |
| 15 - Service-to-Service Auth | 1/1 | 4min | 4min |
| 16 - Google OAuth Login Wall | 2/2 | 5min | 3min |
| 17 - Deployment & Go-Live | 1/2 | 2min | 2min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table (13 decisions with outcomes from v1.0).

New v1.1 decisions:
- Architecture: Web (Next.js) on Vercel, Agent (Mastra/Hono) on Oracle Cloud Ampere A1 VM (Docker + Caddy HTTPS)
- Database: Supabase PostgreSQL (2 instances: dev + prod), replaces SQLite
- Auth: Supabase Auth with Google OAuth, @lumenalta.com domain restriction
- Service auth: Shared API key between web and agent
- [14-01] Direct DB host over Supabase pooler for dev (pooler propagation delay for new projects)
- [14-01] PostgresStore uses DIRECT_URL (non-pooled) for reliable Mastra storage connections
- [14-01] Schema isolation: public schema (Prisma) + mastra schema (PostgresStore) in single database
- [14-02] Seed script requires no changes for PostgreSQL -- all Prisma Client operations are database-agnostic
- [14-02] Prod migrations applied via subshell env override (no .env file modification)
- [15-01] X-API-Key header (not Authorization Bearer) to avoid collision with future Google OAuth user auth
- [15-01] Dev mode keeps /api/* routes public for Mastra playground/docs accessibility
- [15-01] /health endpoint public with requiresAuth: false for uptime monitoring
- [16-01] getAll/setAll cookie pattern (not deprecated get/set/remove) for Supabase SSR
- [16-01] Server-side domain enforcement in callback route (hd parameter is UX-only)
- [16-01] Route group (authenticated) for layout split -- nav bar only on authenticated pages
- [16-01] Middleware redirects authenticated users away from /login to /deals
- [16-02] Client component for login page (useSearchParams + onClick require 'use client')
- [16-02] Suspense boundary wrapping useSearchParams per Next.js 15 requirement
- [16-02] Async server component for authenticated layout to fetch user data via getUser()
- [17-01] Entrypoint script writes VERTEX_SERVICE_ACCOUNT_KEY to file for GOOGLE_APPLICATION_CREDENTIALS (zero code changes)
- [17-01] Caddy domain configurable via AGENT_DOMAIN env var with localhost fallback
- [17-01] Docker health check uses wget --spider against /health endpoint
- [17-01] SSH deploy script with atomic git pull + build + restart via heredoc

### Pending Todos

None.

### Blockers/Concerns

- ~~Research flag: Verify `@mastra/pg` package on npm before Phase 14 implementation~~ RESOLVED: @mastra/pg@1.7.1 installed and working
- ~~Research flag: Prisma migration history must be deleted and recreated for Postgres~~ RESOLVED: Fresh baseline migration created and applied
- ~~Research flag: `GOOGLE_APPLICATION_CREDENTIALS` needs inline JSON for deployed environments (no file path)~~ RESOLVED: Entrypoint script writes VERTEX_SERVICE_ACCOUNT_KEY env var to /tmp/vertex-credentials.json
- Research flag: `googleapis` package may need splitting to individual packages for Vercel function size
- Content library access: 14/17 Drive shortcut targets need Viewer access (not code-blocking for v1.1)
- Note: Supabase pooler URLs (pooler.supabase.com) may work after propagation delay; test before production

## Session Continuity

Last session: 2026-03-05T14:16:54.241Z
Stopped at: Completed 17-01-PLAN.md
Resume file: None
