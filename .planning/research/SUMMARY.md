# Project Research Summary

**Project:** Lumenalta Sales Platform — v1.1 Infrastructure & Access Control
**Domain:** Infrastructure hardening — database migration (SQLite to Supabase/PostgreSQL), Vercel deployment, Google OAuth login wall, and service-to-service authentication
**Researched:** 2026-03-04
**Confidence:** MEDIUM (training data only; web tools unavailable; codebase analysis is HIGH confidence)

## Executive Summary

The v1.1 milestone transforms a functioning localhost demo into a team-accessible deployed platform. The work is purely infrastructure — no new business features, no changes to the AI workflows, and no schema model additions. The four pieces of work (database migration, auth, agent deployment, service auth) have clearly defined dependencies and all four researchers agree on the correct technical approach: Supabase for both the database and auth, Vercel for the web app, and a non-serverless host (Railway/Fly.io/Render) for the Mastra agent. The existing v1.0 architecture is sound and does not need restructuring — only new wiring is required.

The highest-confidence recommendation across all four research files is to keep the existing Prisma ORM as-is, change only the datasource provider to `postgresql`, and use Supabase purely as a managed Postgres host plus auth service. The Supabase JS client is used ONLY for auth operations (signIn/signOut/getSession) — never for data queries, which remain Prisma's domain. This avoids a dual-query layer and means the vast majority of existing application code (workflows, Server Actions, api-client, Google API helpers) stays completely unchanged.

The single biggest risk — flagged consistently across all four research files — is deploying the Mastra agent to Vercel serverless. Mastra workflows executing touch sequences take 30-120 seconds end-to-end, exceeding Vercel's function timeout on all but the most expensive Pro plan with `maxDuration` overrides. The strongly recommended mitigation is to deploy the agent on a persistent-process host (Railway, Render, or Fly.io), with the web app staying on Vercel. This is already compatible with the existing `AGENT_SERVICE_URL` env var design. A secondary risk is that `@mastra/pg` (the Postgres storage adapter for Mastra's internal workflow state) needs to be verified against current npm before implementation — if it does not exist, the fallback is Turso (hosted LibSQL cloud), which requires only a URL change.

## Key Findings

### Recommended Stack

The v1.1 stack additions are minimal and intentionally avoid introducing new vendors beyond Supabase and a persistent-process hosting platform. Supabase is chosen because it bundles managed PostgreSQL and Google OAuth into a single provider, eliminating the need for a separate auth service (NextAuth, Clerk, Firebase Auth). Prisma remains the ORM — it treats Supabase as an ordinary Postgres host and requires no code changes beyond the connection string and datasource provider field.

**Core technologies (new additions only):**
- `@supabase/supabase-js ^2.x`: Supabase client — used ONLY in `apps/web` for auth (signIn/signOut/getSession); never for data queries
- `@supabase/ssr ^0.5+`: Server-side auth helpers for Next.js App Router — cookie-based sessions in middleware, Server Components, and Route Handlers
- Supabase Auth (hosted service): Google OAuth provider with JWT issuance — no custom auth server; domain restriction enforced at the application level
- Supabase PostgreSQL (hosted service): Managed Postgres with Supavisor connection pooling — replaces the SQLite file; all app queries remain through Prisma unchanged
- Vercel (web project only): Hosts `apps/web` (Next.js) — zero-config Next.js App Router, automatic preview deployments per PR
- Railway/Render/Fly.io (agent server): Hosts `apps/agent` (Mastra/Hono) as a persistent Node.js process — eliminates serverless timeout risk entirely
- Shared API key (env var): Service-to-service auth between web and agent — simplest effective pattern; no JWT/OAuth complexity for first-party services
- `@mastra/pg` or Turso equivalent (VERIFY): Postgres or hosted LibSQL adapter for Mastra's internal workflow state — replaces `file:./prisma/mastra.db`; required for suspend/resume to survive deployments

**Versions requiring verification before implementation:**
- `@supabase/supabase-js` — may be v3.x as of March 2026; check npm
- `@supabase/ssr` — was `^0.5` at training cutoff; verify current version and API
- `@mastra/pg` — package name, existence, and constructor API must be confirmed; fallback is Turso with `@mastra/libsql` and a `libsql://` URL

### Expected Features

All v1.1 features are infrastructure features. They are security and deployment requirements, not user-facing functionality changes. Users gain access to a deployed URL with login; they do not see new product features.

**Must have (table stakes — without these the platform is a localhost demo):**
- Persistent PostgreSQL database (Supabase) — team data must survive deployments and be shared across members
- Google OAuth login wall restricted to `@lumenalta.com` — security requirement for any internet-exposed internal tool
- Middleware-based route protection — every page behind auth; no flash of unprotected content
- Login page UI — branded "Sign in with Google" button with clear `@lumenalta.com` domain requirement
- Auth callback route handler — exchanges OAuth code for Supabase session; enforces domain check server-side
- Deployed web app URL (Vercel) — sellers need a bookmark, not `localhost:3000`
- Deployed agent server URL (Railway/Render/Fly.io) — web app must call a real endpoint, not `localhost:4111`
- Service-to-service API key auth — agent endpoints create DB records and trigger costly AI workflows; cannot be publicly accessible
- Environment variable configuration — Supabase URL/keys, API key, and agent URL correctly set in both Vercel projects for both Production and Preview environments
- Postgres-compatible seed script — re-seeds the Meridian Capital Group demo scenario on the fresh Supabase database

**Should have (quality improvements within v1.1 scope):**
- Mastra internal storage migration (LibSQL file to hosted Postgres/Turso) — prevents workflow state loss on agent redeployment; enables suspend/resume across cold starts
- Preview deployments per PR (Vercel) — automatic with correct env var scoping; QA can test PRs without running locally
- Supabase project separation (dev vs. prod) — isolates test data from production; required from day one

**Defer to v2+:**
- Role-based access control — all users are equal in v1.1; RBAC is over-engineering for a 20-person internal team
- User settings/preferences page — nothing to configure; Google profile provides name and avatar
- Multi-tenant support — internal tool only; premature
- Magic link or email/password auth — all team members have Google Workspace accounts
- Supabase RLS policies — server-side Prisma queries make RLS redundant for this single-tenant setup
- Custom domain — Vercel-provided URL is sufficient for an internal tool

**Do NOT build (anti-features confirmed by research):**
- Serverless agent deployment on Vercel — workflow timeouts are architecturally incompatible
- SQLite data migration to Postgres — existing data is demo-only seed data; start fresh
- WebSocket/SSE real-time workflow updates — existing polling pattern works and is simpler
- User profile management — Google OAuth provides all needed identity data

### Architecture Approach

The v1.1 architecture is an additive wrapper around the existing v1.0 system. The web app gains an auth layer (middleware + login page + Supabase client utilities); the agent gains API key validation middleware; and the database connection string changes. No data access code, workflow logic, Server Actions, or Google API helpers require modification. The two-service deployment topology (`apps/web` on Vercel, `apps/agent` on persistent compute) is a natural extension of the existing monorepo structure, with `AGENT_SERVICE_URL` as the seam between them.

**Major components:**
1. **Next.js middleware (`apps/web/src/middleware.ts`)** — intercepts every request, validates Supabase session cookie, redirects unauthenticated users to `/auth/login`; transparently refreshes expiring tokens
2. **Supabase client utilities (`apps/web/src/lib/supabase/`)** — three factory files: `client.ts` (browser), `server.ts` (RSC/Server Actions), `middleware.ts` (edge); all use `@supabase/ssr`
3. **Auth routes (`apps/web/src/app/auth/`)** — login page with Google sign-in button, plus callback route handler that exchanges OAuth code, validates `@lumenalta.com` domain, and sets session cookies
4. **Prisma schema update (`apps/agent/prisma/schema.prisma`)** — provider changes from `sqlite` to `postgresql`; `directUrl` field added for migrations; all 9 models remain unchanged
5. **Prisma migrations (recreated from scratch)** — existing SQLite migration history deleted; fresh Postgres baseline generated with `prisma migrate dev --name init-postgres`
6. **Mastra storage backend (`apps/agent/src/mastra/index.ts`)** — `LibSQLStore` replaced with `PostgresStore` (or Turso LibSQL) so workflow state survives deployments
7. **API key middleware (agent Hono server)** — validates `X-API-Key` header on all agent routes; rejects unauthorized requests with 401
8. **API client update (`apps/web/src/lib/api-client.ts`)** — adds `X-API-Key: ${AGENT_API_KEY}` header to all outbound calls to the agent

**Key patterns to follow:**
- Prisma is the sole data query layer — Supabase JS client is auth-only, never data
- Auth boundary is the web app — the agent validates only a shared API key, not user JWTs
- Defense-in-depth for domain restriction — Google Workspace "Internal" OAuth + server-side email check in callback + middleware session validation
- Supabase dual connection strings — pooled URL (port 6543, `?pgbouncer=true`) for app queries; direct URL (port 5432) for migrations only
- Turborepo build pipeline unchanged — Vercel native Turborepo detection handles both projects

### Critical Pitfalls

1. **Prisma migration history is provider-locked to SQLite** — Existing `migrations/` directory contains SQLite-specific SQL that refuses to run against Postgres; `migration_lock.toml` embeds the provider. Avoid by deleting the `migrations/` directory and `migration_lock.toml`, then generating a fresh Postgres baseline. Keep old migrations in git history for reference only.

2. **Mastra LibSQLStore uses a separate SQLite file that also needs migration** — The `mastra.db` file is separate from `dev.db`. Migrating only Prisma leaves Mastra's workflow state on an ephemeral local file that Vercel destroys on every cold start. Any suspended HITL workflows or active runs will be permanently orphaned. Avoid by migrating Mastra's storage to `@mastra/pg` (PostgresStore) or Turso in the same phase as the Prisma migration — not as an afterthought.

3. **Vercel serverless timeout kills long-running workflows** — Touch 4 workflows take 30-120 seconds. Vercel Hobby is 10 seconds; Pro is 60 seconds (300 with `maxDuration`). The Mastra agent is architecturally incompatible with serverless. Deploy on persistent compute (Railway/Render/Fly.io). The existing async poll-based architecture (start workflow, return runId, poll for status) is already designed for this separation — no redesign required.

4. **Google OAuth redirect URI mismatch on Vercel preview deployments** — Registering the Vercel app URL in Google Cloud Console breaks on dynamic preview URLs. Avoid by using Supabase as the OAuth intermediary — register only Supabase's callback URL in GCP, and configure Supabase's redirect allowlist with a wildcard pattern for Vercel preview subdomains.

5. **Supabase domain restriction is not enforced at the provider level** — A personal Gmail user can complete the OAuth flow and receive a valid Supabase session unless explicitly blocked. Enforce at three layers: (1) Google Workspace "Internal" OAuth consent, (2) server-side email check in the `/auth/callback` route handler, and (3) middleware session check. Test with an actual personal Gmail account as acceptance criteria.

6. **Prisma connection pool exhaustion on Vercel serverless** — Each function invocation creates a new Prisma Client instance with its own pool. Supabase free tier allows 60 connections. Under moderate load, this exhausts quickly. Avoid by using the Supabase Supavisor pooler URL (port 6543, `?pgbouncer=true&connection_limit=1`) in `DATABASE_URL` from day one.

## Implications for Roadmap

The dependency chain is unambiguous: the database must exist before anything can be tested, service auth must exist before any deployment is secure, auth must be complete before deployment is useful, and all three must converge before go-live. All four research files independently converged on a 4-phase structure with the same ordering rationale.

### Phase 1: Database Migration (Supabase + Prisma + Mastra Storage)

**Rationale:** Everything else depends on a working Postgres database. Auth, deployment, and service auth all require Supabase to exist. This phase has zero auth dependencies and zero deployment dependencies — it can be started immediately. It also has the highest complexity per line of code changed (migration history recreation, dual connection strings, Mastra storage adapter verification).

**Delivers:** Supabase dev and prod projects created; all 9 Prisma models running on PostgreSQL; Mastra workflow state on a hosted durable store (Postgres or Turso); Meridian Capital Group seed data re-created on Postgres; agent runs locally against Supabase dev instance

**Addresses:** "Persistent database (table stakes)", "Mastra internal storage migration (should have)", "Environment separation dev/prod"

**Avoids:** Pitfall 1 (migration lock mismatch), Pitfall 2 (data type issues — keep all JSON fields as `String` for v1.1), Pitfall 3 (Mastra LibSQLStore on local file), Pitfall 12 (connection pool exhaustion — pooler URL from day one)

**Research flag needed:** Verify `@mastra/pg` package existence and constructor API on npmjs.com before writing code. If absent, switch to Turso cloud (`@mastra/libsql` with a `libsql://` URL — zero API change, only URL change).

### Phase 2: Service-to-Service API Key Auth

**Rationale:** Small change (two files modified, one env var each side) that must exist before the agent is deployed to any public URL. Piggybacks on Phase 1's env.ts changes. Can be completed in the same work session as Phase 1 with minimal overhead.

**Delivers:** Agent server rejects all requests without a valid `X-API-Key` header; web app sends the key on every outbound call; both services have the key in their validated env var schemas; curl test confirms rejection without auth

**Addresses:** "Protected API routes (table stakes)", "Service-to-service API key auth (P1)"

**Avoids:** Pitfall 6 (auth token not forwarded — fixed here), security mistake "agent server deployed without authentication"

**Research flag needed:** None. This is a textbook shared-secret pattern. No additional research required.

### Phase 3: Google OAuth Login Wall (Auth)

**Rationale:** Depends on Supabase existing (Phase 1) but is otherwise independent of service auth. Can begin in parallel with Phase 1 once the Supabase project is created. The Google Cloud OAuth consent screen configuration and Supabase Auth provider setup can happen while Phase 1 database work is in progress.

**Delivers:** All app routes protected behind login; Google OAuth restricted to `@lumenalta.com` at three enforcement layers; login page with "Sign in with Google" button and domain messaging; auth callback with server-side domain enforcement; session cookie management via `@supabase/ssr`; user name and avatar displayed in the nav bar

**Addresses:** "Login wall (table stakes)", "Session persistence (table stakes)", "Middleware-based route protection (should have)", "@lumenalta.com domain restriction (P1)"

**Avoids:** Pitfall 7 (OAuth redirect mismatch — use Supabase as intermediary with wildcard allowlist), Pitfall 8 (domain restriction client-side only — enforce at all 3 layers), Pitfall 9 (middleware ordering conflict — precise matcher required, exclude `/auth/` and static assets)

**Research flag needed:** Consult current `@supabase/ssr` official docs before implementing. The package API was evolving through 2025. Standard enough to proceed without a full research-phase — just verify the `createServerClient`/`createBrowserClient` signatures before writing code.

### Phase 4: Vercel + Agent Deployment (Go-Live)

**Rationale:** Requires all three preceding phases to be complete and tested locally. The web app cannot be deployed usefully without auth. The agent cannot be deployed securely without API key auth and a hosted database. This phase is the integration and go-live phase — it converges all prior work.

**Delivers:** Production web URL on Vercel; production agent URL on Railway/Render/Fly.io; preview deployments per PR with correct env var scoping; prod Supabase database with `prisma migrate deploy`; end-to-end workflow verified on production URLs; Google OAuth redirect working on both production and preview deployments; CORS headers on Hono server; canonical env var manifest verified

**Addresses:** "Deployed web app URL (table stakes)", "Deployed agent server URL (table stakes)", "Preview deployments (should have)", "Environment variable configuration (P1)"

**Avoids:** Pitfall 4 (serverless bundle size — agent is NOT on Vercel serverless), Pitfall 5 (workflow timeout — agent on persistent compute), Pitfall 7 (OAuth redirects — Supabase wildcard allowlist), Pitfall 10 (env var misconfiguration — create canonical manifest as first deployment task), Pitfall 11 (CORS between Vercel projects — add CORS middleware to Hono server before first cross-domain deploy)

**Research flag needed:** This is the highest-risk phase. Verify that `mastra build` output is deployable on Railway/Render/Fly.io and confirm the correct start command (likely `node .mastra/output/index.mjs`). Check Mastra v1.8 deployment docs specifically for Railway/persistent-process deployment. If Mastra has added a managed hosting option since training cutoff, it may simplify this phase.

### Phase Ordering Rationale

- Phase 1 is foundational — Supabase must exist before any other work is testable or meaningful
- Phase 2 is tiny and security-critical — it belongs with Phase 1 to ensure the agent is never exposed unauthenticated
- Phase 3 can begin in parallel with Phase 1 but must complete before Phase 4; the Supabase project (from Phase 1) is the only prerequisite
- Phase 4 is the convergence and go-live phase; partial deployment is not useful — all three predecessors must be tested first
- The existing async poll-based workflow architecture is a deliberate advantage: it means the web app makes only short-lived HTTP calls to the agent, which decouples serverless web from persistent-process agent cleanly

### Research Flags

**Phases needing deeper validation during implementation (verify before writing code):**
- **Phase 1:** Confirm `@mastra/pg` package exists on npmjs.com. Identify its exact constructor API. If absent, plan switch to Turso — 15 minutes of verification that determines the implementation path.
- **Phase 4:** Confirm `mastra build` output structure and deployment procedure on Railway/Render/Fly.io. Check Mastra v1.8 release notes for any deployment adapter additions. This is the lowest-confidence area across all research files.

**Phases with standard patterns (no dedicated research-phase needed):**
- **Phase 2:** API key auth in Hono middleware is a trivial, textbook pattern. Proceed directly.
- **Phase 3:** Supabase Auth + Next.js App Router + Google OAuth is thoroughly documented with official examples. Consult `@supabase/ssr` docs directly; no research-phase required.
- **Phase 1 (Prisma part):** Provider switching is a well-documented, stable Prisma operation. Proceed with confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Supabase/Prisma/Vercel patterns are stable and well-established. Package versions need verification against npm (training cutoff behind current releases). Mastra storage adapter is LOW confidence — package may not exist under the assumed name. |
| Features | HIGH | Feature analysis is based on direct codebase reading (what exists, what is missing) and clear security requirements. No ambiguity about what needs to be built. |
| Architecture | MEDIUM-HIGH | Component boundaries, data flow, and integration points are clear from codebase analysis. Two low-confidence areas: (1) exact `@supabase/ssr` current API, (2) Mastra build output format and persistent-process deployment specifics. |
| Pitfalls | MEDIUM-HIGH | Most pitfalls are well-documented industry patterns (Prisma migration lock, serverless connection pooling, OAuth redirect URIs). Mastra-specific pitfalls (bundle size on Vercel, persistent-process requirement) are MEDIUM — training data confirms the general concern but not current Mastra-specific behavior. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **`@mastra/pg` package existence (CRITICAL):** Verify on npmjs.com before Phase 1 begins. If absent, use Turso (`@mastra/libsql` with `libsql://` URL — no API changes, only URL change). This is the most critical unknown and takes 15 minutes to resolve.
- **`mastra build` output format (HIGH):** Verify the build artifact structure (file name, entry point, start command) against current Mastra v1.8 docs before Phase 4 planning. The build may produce a different structure than assumed.
- **Agent deployment on Vercel (MEDIUM):** Research strongly advises against serverless for the agent due to timeout risk. However, if Mastra has added a Vercel-compatible deployment adapter since training cutoff, it could change the deployment topology. Check Mastra release notes.
- **`@supabase/ssr` current API (MEDIUM):** The package was in flux through 2025 (replaced deprecated `@supabase/auth-helpers-nextjs`). Verify current `createServerClient`, `createBrowserClient` signatures against official Supabase docs before writing auth code.
- **Google Workspace "Internal" OAuth availability (LOW):** Requires a Google Workspace org admin to verify whether the `lumenalta.com` GCP project's OAuth consent screen can be set to "Internal". If not, rely entirely on application-level domain restriction (which is already planned as a layer).

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `apps/agent/prisma/schema.prisma` — 9 models, SQLite datasource, 4 existing migrations
- `apps/agent/src/mastra/index.ts` — Mastra configuration with LibSQLStore, Hono API routes
- `apps/web/src/lib/api-client.ts` — web-to-agent HTTP communication pattern, no auth headers currently
- `apps/web/src/env.ts` and `apps/agent/src/env.ts` — current environment variable schemas
- `turbo.json`, `package.json` — monorepo build configuration

### Secondary (MEDIUM confidence — training data through May 2025)
- Supabase Auth with Next.js App Router, `@supabase/ssr` usage patterns
- Prisma PostgreSQL provider documentation, connection pooling with PgBouncer/Supavisor
- Vercel Turborepo monorepo deployment patterns, project configuration
- Hono middleware patterns for API key authentication
- Railway/Render/Fly.io persistent Node.js process deployment
- Next.js 15 middleware edge runtime, `@supabase/ssr` session management

### Tertiary (LOW confidence — verify before implementing)
- Mastra `@mastra/pg` storage adapter (package name, API, existence)
- Mastra `mastra build` output format for persistent-process deployment targets
- Mastra Vercel deployment adapter (may have been added after training cutoff)
- `@supabase/supabase-js` current version (may be v3.x by March 2026)

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
