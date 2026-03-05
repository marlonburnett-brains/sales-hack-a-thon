# Feature Research

**Domain:** Infrastructure hardening -- database migration, deployment, authentication, and service auth for an existing agentic sales platform
**Researched:** 2026-03-04
**Confidence:** MEDIUM -- web tools unavailable; findings based on training knowledge of Supabase, Vercel, Next.js 15, Prisma, Mastra, and Google OAuth through May 2025. Confidence downgrades noted where recency matters. Existing codebase read directly (HIGH confidence for architecture analysis).

---

## Scope

This document covers ONLY the v1.1 milestone features. The v1.0 product features (touches 1-4, pre-call briefing, HITL, RAG, etc.) are shipped. The v1.1 milestone adds four infrastructure capabilities to make the platform usable by the Lumenalta team:

1. SQLite to Supabase (PostgreSQL) database migration
2. Vercel deployment (2 projects: web + agent, prod/preview envs)
3. Google OAuth login wall restricted to @lumenalta.com
4. Service-to-service API key auth between web and agent

---

## Feature Landscape

### Table Stakes (Users Expect These)

For an internal team tool being deployed for real use, these features are non-negotiable. Without them, the platform remains a localhost demo.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Persistent database (not SQLite file)** | Team members expect data to survive deployments and be shared across environments. A SQLite file on localhost is a single-user demo, not a team tool. | MEDIUM | Prisma schema already exists with 9 models. Must switch datasource provider from `sqlite` to `postgresql`, handle JSON column differences, and create a fresh migration history for Postgres. |
| **Deployed web app with a URL** | Sellers need a bookmark they can hit from any machine, not `localhost:3000`. | LOW | Next.js 15 on Vercel is a standard deployment. The web app is a straightforward Next.js build. |
| **Deployed agent server with a URL** | The web app calls the agent service over HTTP. On Vercel, the agent URL must be a real endpoint, not `localhost:4111`. | HIGH | Mastra's Hono-based server uses `mastra build` and runs as a long-lived Node.js process, not a serverless function. Vercel's serverless model may not fit. This is the hardest deployment question. |
| **Login wall (only Lumenalta people)** | An internal tool exposed on the internet without auth is a security incident. Domain-restricted login ensures only @lumenalta.com employees access the platform. | MEDIUM | Supabase Auth with Google OAuth provider. Domain restriction at the application level (check `email.endsWith('@lumenalta.com')` after OAuth callback). |
| **Session persistence across page loads** | Users expect to stay logged in. Refreshing the page should not require re-authentication. | LOW | Supabase Auth handles JWT refresh tokens automatically. `@supabase/ssr` package provides cookie-based session management for Next.js. |
| **Preview deployments for testing** | Developers pushing PRs expect a preview URL to test changes before merging to production. Standard Vercel workflow. | LOW | Vercel provides this automatically. Preview deploys connect to a dev/staging Supabase instance (not production). |
| **Environment separation (dev/prod databases)** | Data created during development and testing must not pollute production. Two Supabase projects. | LOW | Two Supabase projects: one for dev/preview, one for production. Different `DATABASE_URL` per Vercel environment. |
| **Protected API routes (agent not publicly callable)** | The agent server exposes endpoints that create database records, trigger AI workflows, and write to Google Drive. Without auth, anyone with the URL can trigger expensive operations. | MEDIUM | API key shared between web and agent. Web sends `Authorization: Bearer <key>` header; agent validates on every request. |

### Differentiators (What Makes This Setup Better Than Minimum)

These features go beyond "it works" and make the platform genuinely comfortable for the team.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic preview deploys per PR with staging data** | Every pull request gets its own URL pointing at the dev Supabase instance. QA reviewers can test changes without asking the developer to run anything locally. Accelerates iteration on the platform. | LOW | Vercel provides this for free. Only configuration needed is environment variables on the Vercel project. |
| **Google OAuth with Supabase (not raw NextAuth)** | Using Supabase Auth means the auth layer is co-located with the database. User records live in the same Supabase project. No separate auth database or provider. Simplifies the stack. | MEDIUM | Supabase Auth is purpose-built for this. Alternatives (NextAuth/Auth.js, Clerk) add a third service. Supabase consolidates auth + database. |
| **Middleware-based route protection** | Next.js middleware intercepts every request before it reaches a page. Unauthenticated users are redirected to `/login` without loading page code. Fast, secure, no flash of protected content. | LOW | `@supabase/ssr` provides `createServerClient` for use in Next.js middleware. Standard pattern. |
| **Supabase Row Level Security (RLS) as defense-in-depth** | Even if application auth is bypassed, RLS policies on the database prevent unauthorized data access. Not strictly needed for v1.1 (internal tool, single tenant), but sets up the right foundation. | MEDIUM | Supabase enables RLS by default on new tables. For v1.1, a simple "authenticated users can do everything" policy is sufficient. More granular policies (per-user, per-deal) are v2. |
| **Mastra internal storage migration (LibSQL to Supabase)** | Currently Mastra uses a local LibSQL file (`mastra.db`) for workflow state. Moving this to a hosted database means workflow suspend/resume state survives deployments and is shared across instances. | MEDIUM | Mastra supports `@mastra/pg` storage adapter as an alternative to `@mastra/libsql`. Switching to the Postgres adapter means both application data and Mastra internal state live in Supabase. |

### Anti-Features (Do NOT Build for v1.1)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Role-based access control (admin/seller/SME roles)** | "Different users should see different things" | Adds a permissions model, role assignment UI, and authorization checks on every endpoint. All current users are Lumenalta employees with equal access needs. Over-engineering for a 20-person team. | All authenticated @lumenalta.com users get full access. RBAC is a v2 feature if the tool scales beyond the sales team. |
| **User profile management / settings page** | "Users should be able to set their preferences" | Google OAuth provides name, email, and avatar. There is nothing to configure in v1.1. A settings page with nothing in it is worse than no settings page. | Display user name/avatar from Google profile in the nav bar. No editable settings. |
| **Magic link or email/password auth** | "What if someone doesn't have Google?" | All Lumenalta employees have Google Workspace accounts. Adding email/password creates a password management burden, security liability, and UX fork for zero benefit. | Google OAuth only. No alternative auth methods. |
| **Multi-tenant / organization support** | "What if we sell this to other companies?" | Adds tenant isolation, data scoping, billing, and onboarding. Premature for an internal tool. Would require rewriting every database query to include tenant filtering. | Single-tenant. Lumenalta only. Re-evaluate if the tool is productized. |
| **Custom domain (e.g., sales.lumenalta.com)** | "Looks more professional than a .vercel.app URL" | Requires DNS configuration, SSL certificate management, and Vercel custom domain setup. Low priority for an internal team tool. | Use the Vercel-provided URL. Add a custom domain later if desired. |
| **Database migration of existing SQLite data** | "Can we keep the demo data?" | The existing SQLite data is demo/seed data (Meridian Capital Group fixture). It has no production value. Migrating it adds complexity (data type conversion, ID remapping) for worthless data. | Start fresh with a clean Supabase database. Re-seed the demo scenario with a Prisma seed script targeting Postgres. |
| **Serverless agent deployment (Vercel Functions)** | "Keep everything on Vercel" | The Mastra agent server is a long-lived Hono HTTP server that needs persistent connections for workflow suspend/resume and LibSQL/Postgres connections. Vercel Functions have a 10s default / 60s max timeout. Workflows that call LLMs and Google APIs run for 30-120 seconds. Serverless is architecturally incompatible. | Deploy the agent on a platform that supports long-lived processes: Railway, Render, Fly.io, or a Vercel-adjacent VPS. Or investigate Mastra's `mastra deploy` if it supports a managed hosting option. |
| **WebSocket or SSE real-time updates** | "Show workflow progress in real-time" | The current polling pattern (check workflow status every 2s) works and is simple. WebSockets add connection management, reconnection logic, and serverless incompatibility. | Keep the polling pattern. It works. |

---

## Feature Dependencies

```
[Supabase Project Setup (dev + prod)]
    |
    +--required-by--> [Prisma Schema Migration (SQLite -> PostgreSQL)]
    |                      |
    |                      +--required-by--> [Prisma Seed Script (Postgres-compatible)]
    |                      |
    |                      +--required-by--> [Mastra Storage Migration (LibSQL -> @mastra/pg)]
    |
    +--required-by--> [Supabase Auth Configuration (Google OAuth provider)]
                           |
                           +--required-by--> [Next.js Auth Integration (@supabase/ssr)]
                           |                      |
                           |                      +--required-by--> [Middleware Route Protection]
                           |                      |
                           |                      +--required-by--> [Login Page UI]
                           |                      |
                           |                      +--required-by--> [Auth Callback Route Handler]
                           |
                           +--required-by--> [Domain Restriction Logic (@lumenalta.com check)]

[Vercel Project Setup (web)]
    |
    +--required-by--> [Environment Variables Configuration]
    |                      |
    |                      +--required-by--> [Preview Deploy Testing]
    |
    +--required-by--> [Production Deploy]

[Agent Hosting Decision (Railway/Render/Fly/other)]
    |
    +--required-by--> [Agent Deployment Configuration]
    |                      |
    |                      +--required-by--> [AGENT_SERVICE_URL in Vercel env vars]
    |
    +--required-by--> [Service-to-Service API Key Auth]
                           |
                           +--required-by--> [API Key Middleware on Agent (validate Bearer token)]
                           |
                           +--required-by--> [Web App API Client Update (send Authorization header)]

[Prisma Schema Migration] --must-complete-before--> [Vercel Production Deploy]
[Supabase Auth Configuration] --must-complete-before--> [Vercel Production Deploy]
[Agent Hosting Decision] --must-complete-before--> [Vercel Production Deploy]
```

### Dependency Notes

- **Supabase project setup gates everything:** Both the database migration and the auth configuration depend on having Supabase projects created. This is the first action item.

- **Prisma schema migration is independent of auth:** The database migration (SQLite to Postgres) and the auth setup (Google OAuth) can proceed in parallel once Supabase projects exist. They converge at production deployment.

- **Agent hosting is the critical path question:** The web app deploys trivially on Vercel. The agent server does NOT fit Vercel's serverless model. The hosting decision for the agent must be made early because it determines the `AGENT_SERVICE_URL` that the web app needs, and whether the agent needs its own CI/CD pipeline.

- **Service-to-service auth depends on agent hosting:** The API key auth pattern between web and agent can only be implemented after both services have their deployment targets decided, because the API key must be shared as environment variables on both platforms.

- **Domain restriction depends on Supabase Auth:** The @lumenalta.com email check happens in the auth callback handler, after Google OAuth returns the user's email. This is application-level logic, not a Supabase configuration.

- **Mastra storage migration is optional but recommended:** The agent currently uses LibSQL (local file) for Mastra's internal state. This works for development but state is lost on redeployment. Migrating to `@mastra/pg` (using the same Supabase Postgres) makes workflow state persistent across deployments. This is a code change in `apps/agent/src/mastra/index.ts`.

---

## Detailed Feature Descriptions

### 1. SQLite to Supabase (PostgreSQL) Migration

**What the developer does:**

1. Create two Supabase projects: `lumenalta-sales-dev` and `lumenalta-sales-prod`
2. Change `schema.prisma` datasource provider from `"sqlite"` to `"postgresql"`
3. Update `DATABASE_URL` from `file:./prisma/dev.db` to the Supabase connection string (`postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`)
4. Handle SQLite-to-Postgres schema differences:
   - `String` fields storing JSON blobs (e.g., `payload`, `tags`, `useCases`) should become `Json` type in Prisma
   - `DateTime` fields work the same way (Prisma abstracts this)
   - `@default(cuid())` works identically
   - `@@index` and `@@unique` constraints translate directly
5. Delete the existing SQLite migration history (`prisma/migrations/`)
6. Create a fresh baseline migration for Postgres: `prisma migrate dev --name init-postgres`
7. Update the seed script to work with Postgres (likely no changes needed)

**What changes in the schema:**

The 9 existing models (WorkflowJob, ImageAsset, ContentSource, Company, Deal, InteractionRecord, FeedbackSignal, Transcript, Brief) move to Postgres. Key changes:

- Fields currently stored as `String` with JSON content (e.g., `payload String`, `tags String`, `useCases String`) can optionally become `Json` type for proper Postgres JSONB storage. This is a quality improvement but not required -- `String` with JSON works in Postgres too.
- No structural model changes needed. The schema is already well-designed.
- SQLite's `TEXT` type (used for `rawText` on Transcript) maps to Postgres `TEXT` with no practical limit. No change needed.

**What the user experiences:** Nothing changes. The web UI behaves identically. Data persists across deployments. Multiple team members share the same database.

**Complexity:** MEDIUM. The schema translation is mechanical. The complexity is in: (a) not breaking the seed script, (b) ensuring the Supabase connection string includes the correct pooler URL for serverless contexts, and (c) updating all environment files and CI/CD secrets.

### 2. Vercel Deployment (2 Projects)

**What the deployment topology looks like:**

```
GitHub Repo: lumenalta-hackathon/
    |
    +-- Vercel Project "lumenalta-web"
    |       Root Directory: apps/web
    |       Framework: Next.js
    |       Build Command: (auto-detected or `cd ../.. && npx turbo run build --filter=web`)
    |       Environments:
    |           Production: main branch -> lumenalta-web.vercel.app
    |           Preview: PR branches -> lumenalta-web-pr-123.vercel.app
    |       Env Vars:
    |           AGENT_SERVICE_URL = https://agent-host.example.com
    |           NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
    |           NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
    |           SUPABASE_SERVICE_ROLE_KEY = eyJ...
    |           AGENT_API_KEY = sk-...
    |
    +-- Agent Server (NOT on Vercel)
            Host: Railway / Render / Fly.io
            Build: `mastra build`
            Start: node output
            Env Vars:
                DATABASE_URL = postgresql://...
                GOOGLE_SERVICE_ACCOUNT_KEY = {...}
                GOOGLE_DRIVE_FOLDER_ID = ...
                GOOGLE_TEMPLATE_PRESENTATION_ID = ...
                GOOGLE_CLOUD_PROJECT = ...
                GOOGLE_CLOUD_LOCATION = ...
                AGENT_API_KEY = sk-... (same key, validates inbound requests)
```

**Why 2 projects, not 1:**

The web app (Next.js) and the agent server (Mastra/Hono) have fundamentally different runtime requirements. Next.js is designed for Vercel. Mastra's Hono server is a long-running Node.js process that needs:
- Persistent connections to Postgres (for Prisma and Mastra storage)
- Long request timeouts (workflow execution can take 30-120 seconds)
- File system access during build (for `mastra build`)
- A stable process for workflow suspend/resume state

Vercel Functions timeout at 10s (Hobby) or 60s (Pro), which is insufficient for LLM + Google API workflow execution.

**What the developer experience looks like:**

1. Push to `main` -> Vercel auto-deploys the web app to production
2. Push a PR branch -> Vercel creates a preview deploy of the web app
3. Preview deploys use dev Supabase; production uses prod Supabase
4. Agent deploys separately on its hosting platform (Railway/Render/Fly)
5. Agent hosting platform watches the same GitHub repo (or a deploy hook)

**What the user experiences:**

- Production URL: `https://lumenalta-web.vercel.app` (or custom domain)
- Everything works the same as localhost, but accessible from any browser
- Preview URLs let QA test changes before they reach production

**Complexity:** LOW for the web app (Vercel + Next.js is trivial). HIGH for the agent server (choosing a host, configuring the build pipeline, ensuring `mastra build` output is deployable, managing environment variables on a second platform).

### 3. Google OAuth Login Wall (@lumenalta.com)

**What the login flow looks like (user perspective):**

1. User navigates to `https://lumenalta-web.vercel.app/`
2. Next.js middleware checks for a Supabase session cookie
3. No session found -> redirect to `/login`
4. `/login` page shows: Lumenalta logo, "Sign in with Google" button, and a note: "Only @lumenalta.com accounts are allowed"
5. User clicks "Sign in with Google"
6. Browser redirects to Google's OAuth consent screen
7. User selects their @lumenalta.com Google account and consents
8. Google redirects to `/auth/callback` with an authorization code
9. The callback route handler:
   a. Exchanges the code for tokens via Supabase Auth
   b. Gets the user's email from the token
   c. Checks: does the email end with `@lumenalta.com`?
   d. If YES: creates/updates the user in Supabase Auth, sets session cookie, redirects to `/`
   e. If NO: destroys the session, redirects to `/login?error=unauthorized` with message "Only @lumenalta.com accounts can access this application"
10. User is now on the main app page, logged in. Their name and avatar appear in the navigation.
11. Subsequent page loads: middleware finds valid session cookie, allows access. No re-authentication.
12. Session expires (configurable, default 1 hour with refresh): automatic token refresh via `@supabase/ssr`. User stays logged in as long as they have an active browser session.

**What the middleware does:**

```
Every request to the web app
    |
    +-- Is this /login, /auth/callback, or a static asset?
    |       YES -> Allow through (no auth required)
    |
    +-- Does the request have a valid Supabase session cookie?
    |       YES -> Allow through (user is authenticated)
    |       NO  -> Redirect to /login
```

**Technical implementation (Next.js + Supabase):**

- Package: `@supabase/ssr` (replaces the older `@supabase/auth-helpers-nextjs`)
- Two Supabase client utilities:
  - `createServerClient` for Server Components and middleware (reads/writes cookies)
  - `createBrowserClient` for Client Components (reads cookies)
- Auth callback route: `apps/web/src/app/auth/callback/route.ts` (Route Handler)
- Middleware: `apps/web/src/middleware.ts` (Next.js Middleware)
- Login page: `apps/web/src/app/login/page.tsx` (public, shows Google sign-in button)

**Domain restriction approach:**

There are two ways to restrict to @lumenalta.com:

1. **Google Cloud Console -> OAuth consent screen -> restrict to organization** (Google Workspace admin setting). This prevents non-Lumenalta Google accounts from even seeing the consent screen. Requires Google Workspace admin access. The cleanest approach if admin access is available.

2. **Application-level check in the auth callback** (check `user.email.endsWith('@lumenalta.com')`). Works regardless of Google Workspace settings. Defense-in-depth: even if someone bypasses the Google restriction, the app rejects them.

**Recommendation:** Use BOTH. Configure Google OAuth to the organization at the Google Cloud level, AND check the email domain in the callback handler. Belt and suspenders.

**Complexity:** MEDIUM. The auth flow has several moving parts (Supabase project config, Google Cloud Console OAuth client, callback handler, middleware, cookie management), but each piece is well-documented and follows standard patterns.

### 4. Service-to-Service API Key Auth (Web to Agent)

**What this protects:**

The agent server (`apps/agent`) exposes HTTP endpoints that:
- Create/modify database records (Company, Deal, InteractionRecord, Brief)
- Trigger AI workflows (LLM calls cost money, Google API calls have quotas)
- Write to Google Drive (creating presentations, documents)

Without auth, anyone who discovers the agent URL can trigger all of these operations.

**How it works:**

1. Generate a random API key: `openssl rand -hex 32` -> `sk-abc123...`
2. Store the key as an environment variable on BOTH services:
   - Web app (Vercel): `AGENT_API_KEY=sk-abc123...`
   - Agent server (Railway/Render): `AGENT_API_KEY=sk-abc123...`
3. Web app sends the key on every request to the agent:
   ```
   Authorization: Bearer sk-abc123...
   ```
4. Agent server validates the key on every incoming request:
   ```
   if (request.headers.get('Authorization') !== `Bearer ${process.env.AGENT_API_KEY}`) {
     return 401 Unauthorized
   }
   ```

**What changes in the existing code:**

- `apps/web/src/lib/api-client.ts`: Add `Authorization` header to the `fetchJSON` function
- `apps/agent/src/mastra/index.ts`: Add auth middleware before all API routes (Hono middleware)
- `apps/web/src/env.ts`: Add `AGENT_API_KEY` to the env schema
- `apps/agent/src/env.ts`: Add `AGENT_API_KEY` to the env schema

**What the user experiences:** Nothing. The API key is invisible to end users. It is a backend-to-backend security measure.

**Complexity:** LOW. It is a shared secret with header validation. No token refresh, no JWT, no OAuth. For an internal tool with two services, this is the right level of security.

---

## MVP Definition

### Launch With (v1.1)

The minimum to get the platform deployed and accessible to the Lumenalta team with basic security.

- [ ] **Supabase project setup (dev + prod)** -- foundation for everything else
- [ ] **Prisma schema migration to PostgreSQL** -- the application database must work on Supabase before anything else can be tested
- [ ] **Supabase Auth with Google OAuth** -- the login wall is a security requirement, not a nice-to-have
- [ ] **@lumenalta.com domain restriction** -- both at Google Cloud level and in application callback
- [ ] **Next.js middleware route protection** -- every page behind auth
- [ ] **Login page UI** -- simple, branded, Google sign-in button
- [ ] **Auth callback route handler** -- exchanges code for session, checks domain
- [ ] **Vercel web app deployment** -- prod + preview environments
- [ ] **Agent server deployment (Railway/Render/Fly)** -- long-running process, not serverless
- [ ] **Service-to-service API key auth** -- protects agent endpoints from public access
- [ ] **Environment variable configuration** -- Supabase URL, keys, API key, agent URL across all environments
- [ ] **Demo seed data for Postgres** -- re-seed Meridian Capital Group scenario on the new database

### Add After Validation (v1.1.x)

- [ ] **Mastra storage migration (LibSQL to @mastra/pg)** -- trigger: workflow state not persisting across agent redeployments
- [ ] **Supabase RLS policies** -- trigger: concern about direct database access or multi-role access patterns
- [ ] **Custom domain** -- trigger: team wants a professional URL
- [ ] **User activity logging** -- trigger: need to know who is using the platform and how often

### Future Consideration (v2+)

- [ ] **Role-based access control** -- defer: all users are equal in v1.1
- [ ] **User settings/preferences page** -- defer: nothing to configure
- [ ] **Multi-tenant support** -- defer: not a product, it is an internal tool
- [ ] **OAuth token-based service auth (JWT)** -- defer: API key is sufficient for two internal services

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Supabase project setup (dev + prod) | HIGH | LOW | P1 |
| Prisma schema migration (SQLite -> PostgreSQL) | HIGH | MEDIUM | P1 |
| Supabase Auth + Google OAuth configuration | HIGH | MEDIUM | P1 |
| @lumenalta.com domain restriction | HIGH | LOW | P1 |
| Next.js middleware route protection | HIGH | LOW | P1 |
| Login page UI | HIGH | LOW | P1 |
| Auth callback route handler | HIGH | LOW | P1 |
| Vercel web app deployment (prod + preview) | HIGH | LOW | P1 |
| Agent server deployment (Railway/Render/Fly) | HIGH | HIGH | P1 |
| Service-to-service API key auth | HIGH | LOW | P1 |
| Environment variables across all platforms | HIGH | LOW | P1 |
| Postgres-compatible seed script | MEDIUM | LOW | P1 |
| Mastra storage migration (LibSQL -> @mastra/pg) | MEDIUM | MEDIUM | P2 |
| Supabase RLS policies (defense-in-depth) | LOW | MEDIUM | P2 |
| Custom domain | LOW | LOW | P3 |
| User activity logging | LOW | MEDIUM | P3 |
| Role-based access control | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch (team can use the deployed platform)
- P2: Should have, add when v1.1 is stable
- P3: Nice to have, future consideration

---

## Login Flow UX Description

### Happy Path

```
[User opens lumenalta-web.vercel.app]
    |
    v
[Middleware: no session cookie]
    |
    v
[Redirect to /login]
    |
    v
[Login Page]
    +-- Lumenalta branding (logo, colors)
    +-- "Sign in to Sales Platform"
    +-- [Sign in with Google] button (shadcn/ui Button, Google icon)
    +-- Small text: "Only @lumenalta.com accounts are allowed"
    |
    v (user clicks button)
    |
[Supabase Auth: redirect to Google OAuth consent screen]
    |
    v (user selects their @lumenalta.com account)
    |
[Google redirects to /auth/callback?code=...]
    |
    v
[Callback Route Handler]
    +-- Exchanges code for Supabase session
    +-- Reads user.email from session
    +-- Checks: email.endsWith('@lumenalta.com')? YES
    +-- Sets session cookie
    +-- Redirects to / (or the URL they originally tried to visit)
    |
    v
[Main App Page -- user sees their name/avatar in nav]
```

### Rejection Path (Non-Lumenalta Account)

```
[User tries to log in with a @gmail.com account]
    |
    v
[Google OAuth consent screen -- user selects personal account]
    |
    v
[Callback Route Handler]
    +-- Exchanges code for session
    +-- Reads user.email: "user@gmail.com"
    +-- Checks: email.endsWith('@lumenalta.com')? NO
    +-- Destroys the Supabase session (sign out)
    +-- Redirects to /login?error=unauthorized
    |
    v
[Login Page with error banner]
    +-- Red alert: "Access denied. Only @lumenalta.com accounts can sign in."
    +-- [Try Again] button
```

### Session Refresh (Returning User)

```
[User opens the app hours later]
    |
    v
[Middleware: session cookie exists]
    +-- Verifies JWT with Supabase
    +-- Token expired? -> Supabase auto-refreshes using refresh token cookie
    +-- Refresh successful? -> Update cookies, allow request
    +-- Refresh failed? -> Redirect to /login (session fully expired)
```

---

## Deployment Flow Description

### Web App (Vercel)

```
[Developer pushes to GitHub]
    |
    +-- Push to main branch:
    |       Vercel triggers production build
    |       Build: turbo run build --filter=web
    |       Deploy to: lumenalta-web.vercel.app
    |       Uses: Production env vars (prod Supabase, prod agent URL)
    |
    +-- Push to PR branch:
            Vercel triggers preview build
            Build: same as production
            Deploy to: lumenalta-web-<hash>.vercel.app
            Uses: Preview env vars (dev Supabase, dev/staging agent URL)
```

### Agent Server (Railway/Render/Fly)

```
[Developer pushes to GitHub]
    |
    v
[Railway/Render detects push]
    |
    v
[Build]
    +-- cd apps/agent
    +-- pnpm install
    +-- npx prisma generate
    +-- npx mastra build
    |
    v
[Start]
    +-- node .mastra/output/index.mjs (or equivalent mastra build output)
    +-- Listens on PORT (provided by platform)
    +-- Connects to Supabase Postgres via DATABASE_URL
    +-- Ready to accept requests from web app
```

---

## Supabase Migration Path Details

### What changes in the Prisma schema

```prisma
// BEFORE (SQLite)
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// AFTER (PostgreSQL)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### SQLite to Postgres differences that affect this schema

| SQLite Pattern | Postgres Equivalent | Affected Models |
|----------------|---------------------|-----------------|
| `String` for JSON data | Keep as `String` (works) or upgrade to `Json` type (better) | WorkflowJob.payload, WorkflowJob.result, ImageAsset.tags, InteractionRecord.inputs, InteractionRecord.generatedContent, InteractionRecord.outputRefs, FeedbackSignal.content, Brief.secondaryPillars, Brief.useCases, Brief.roiFraming, ContentSource.touchTypes |
| `@default(cuid())` | Works identically | All models |
| `DateTime @default(now())` | Works identically | All models |
| `@@index` | Works identically | All models |
| `@@unique` | Works identically | Company, ContentSource, Transcript, Brief |
| SQLite TEXT (unlimited) | Postgres TEXT (unlimited) | Transcript.rawText |

### Migration strategy

1. **Do NOT try to migrate SQLite data to Postgres.** The existing data is seed/demo data only.
2. Delete the `prisma/migrations/` directory entirely (4 SQLite migrations).
3. Change the datasource provider to `postgresql`.
4. Optionally upgrade JSON `String` fields to `Json` type.
5. Run `prisma migrate dev --name init-postgres` to create a fresh baseline migration.
6. Run the seed script to populate the Meridian Capital Group demo data.

This approach follows the project's migration discipline (forward-only migrations) while acknowledging that the SQLite migration history has no value in a Postgres context.

---

## Sources

- Codebase analysis: `apps/agent/prisma/schema.prisma` -- 9 models, SQLite datasource, 4 existing migrations (HIGH confidence, read directly)
- Codebase analysis: `apps/agent/src/mastra/index.ts` -- Mastra configuration with LibSQLStore, Hono-based API routes (HIGH confidence, read directly)
- Codebase analysis: `apps/web/src/lib/api-client.ts` -- web-to-agent communication pattern, no auth headers currently (HIGH confidence, read directly)
- Codebase analysis: `apps/web/src/env.ts` and `apps/agent/src/env.ts` -- current environment variable schemas (HIGH confidence, read directly)
- Training knowledge: Supabase Auth with Google OAuth provider, `@supabase/ssr` for Next.js (MEDIUM confidence -- based on training through May 2025; verify current package names and API)
- Training knowledge: Vercel monorepo deployment with Turborepo, root directory configuration (MEDIUM confidence -- standard pattern, unlikely to have changed significantly)
- Training knowledge: Prisma SQLite-to-PostgreSQL migration, datasource provider switching (MEDIUM confidence -- standard Prisma operation)
- Training knowledge: Mastra `@mastra/pg` storage adapter as alternative to `@mastra/libsql` (LOW confidence -- verify Mastra 1.8 supports this adapter and its configuration)
- Training knowledge: Railway/Render/Fly.io deployment for Node.js long-running processes (MEDIUM confidence -- all three are established platforms for this use case)
- Note: Web search and WebFetch tools were unavailable. All non-codebase claims should be verified against current documentation before implementation.

---

*Feature research for: v1.1 Infrastructure & Access Control milestone*
*Researched: 2026-03-04*
