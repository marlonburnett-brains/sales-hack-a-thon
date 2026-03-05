# Pitfalls Research

**Domain:** SQLite-to-Supabase migration, Vercel deployment, Google OAuth -- adding infrastructure to existing Next.js 15 + Mastra AI monorepo
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH (well-documented problem domains; Prisma migration and Vercel deployment are extremely well-trodden; Supabase Auth patterns are stable; web search unavailable so Mastra-on-Vercel specifics are training-data-only)

---

## Critical Pitfalls

### Pitfall 1: Prisma Migration History is Provider-Locked to SQLite

**What goes wrong:**
The existing `migration_lock.toml` says `provider = "sqlite"`. All four migration files contain SQLite-specific SQL (`DATETIME`, `TEXT NOT NULL PRIMARY KEY` without sequence). Changing the `datasource` provider to `postgresql` in `schema.prisma` causes `prisma migrate dev` to refuse to run: "The migrations have been created for a different provider (sqlite) than the current provider (postgresql)." The migrations directory must be rebuilt from scratch for Postgres.

**Why it happens:**
Prisma's migration system embeds the provider in a lock file and generates provider-specific SQL. There is no automatic SQLite-to-Postgres migration translation. Developers change the provider in schema.prisma, run `prisma migrate dev`, and hit a hard error they did not expect.

**How to avoid:**
Do NOT attempt to reuse the existing migrations directory. The correct procedure is:
1. Archive the current `prisma/migrations/` directory (keep it in git history for reference).
2. Delete the `migrations/` directory and `migration_lock.toml`.
3. Change `datasource db { provider = "postgresql" }` in schema.prisma.
4. Run `prisma migrate dev --name init_postgres` to generate a fresh baseline migration with Postgres-native SQL.
5. For the Supabase prod database, use `prisma migrate deploy` (not `prisma migrate dev`) in CI/CD.
6. Migrate existing data separately with a one-time script (see Pitfall 2).

**Warning signs:**
- Error: "The migrations have been created for a different provider"
- `migration_lock.toml` still says `provider = "sqlite"` after changing schema.prisma
- Attempting to use `prisma migrate resolve` to skip the provider mismatch -- this does not work

**Phase to address:**
Database migration phase (first phase of v1.1). Must be the very first task before any other infrastructure work.

---

### Pitfall 2: SQLite-to-Postgres Data Type Mismatches Cause Silent Corruption

**What goes wrong:**
The current schema stores JSON as `String` (SQLite TEXT), dates as `DateTime` (SQLite stores as text strings), and uses `@default(cuid())` for IDs. When migrating to Postgres:
- `DateTime` fields that were stored as ISO strings in SQLite become native `TIMESTAMP` in Postgres. If you do a raw data migration, date strings must be parsed correctly or they silently insert as NULL (if the column is nullable) or throw a cast error.
- Fields like `payload`, `result`, `tags`, `inputs`, `generatedContent`, `outputRefs`, `secondaryPillars`, `useCases`, `roiFraming`, and `content` are all `String` holding JSON blobs. In Postgres, these should ideally be `Json` type for queryability -- but changing them in the schema alters the Prisma Client API (`string` vs `object`), which breaks every call site.
- `Boolean` in SQLite is stored as 0/1 integers. Postgres uses native booleans. If any raw data migration sends `0`/`1`, Postgres may reject them.

**Why it happens:**
Prisma abstracts away these differences at the schema level, making developers think the migration is just "change the provider and go." The Prisma schema itself may migrate cleanly, but the actual data sitting in SQLite needs type-aware transformation.

**How to avoid:**
1. Keep all JSON-blob fields as `String` for v1.1 to minimize code changes. Do NOT switch them to `Json` type during the migration -- that is a separate, future refactor.
2. Write a one-time data migration script that: reads from SQLite, transforms each row (parse dates, validate JSON strings, handle nulls), and inserts into Postgres.
3. Test the migration script against a copy of the production SQLite data first, not just seed data.
4. Validate row counts and spot-check 5-10 records after migration.

**Warning signs:**
- `DateTime` fields showing `NULL` or epoch date after migration
- JSON fields that were valid in SQLite failing Prisma validation after migration
- Prisma Client type errors at every call site that touches JSON fields (if you changed to `Json` type)

**Phase to address:**
Database migration phase. Must include a data migration validation step -- do not consider the database migration "done" until row counts match and sample records are verified.

---

### Pitfall 3: Mastra LibSQLStore Uses a Separate SQLite Database That Also Needs Migration

**What goes wrong:**
The codebase has TWO databases: Prisma's `dev.db` (application data) and Mastra's `mastra.db` (workflow execution state, suspend/resume snapshots, traces). The `mastra/index.ts` configures `LibSQLStore` with `url: "file:./prisma/mastra.db"`. When deploying to Vercel, both databases disappear -- Vercel's ephemeral filesystem does not persist SQLite files between invocations. Migrating only the Prisma database to Supabase leaves Mastra's workflow state on an ephemeral local file, which means: every cold start loses all suspended workflows, active HITL checkpoints are orphaned, workflow resume fails with "run not found."

**Why it happens:**
Developers focus on migrating the application database and forget that Mastra's internal storage is also SQLite-based. The two-database architecture is documented in a code comment but not in the project infrastructure diagram.

**How to avoid:**
Mastra needs its own durable storage backend for Vercel deployment. Options:
1. **Mastra PostgreSQL storage adapter** (`@mastra/pg`) -- if available, configure it to use the same Supabase Postgres instance (separate schema or tables).
2. **Turso/LibSQL cloud** -- LibSQL has a cloud offering that replaces the local file URL with a remote URL. This keeps Mastra's internal storage on its own service.
3. **Verify Mastra supports serverless** -- Mastra's Hono server runs as a persistent process. On Vercel, it must be adapted to run as serverless functions or a dedicated Node.js service (see Pitfall 7).

This is the highest-risk pitfall for v1.1 because it affects whether the agent server can function on Vercel at all.

**Warning signs:**
- Workflows start but can never be resumed after a Vercel deployment or cold start
- `run.resume()` throws "workflow run not found"
- Local dev works perfectly but deployed version loses state

**Phase to address:**
Database migration phase AND deployment phase (spans both). The Mastra storage migration must be planned alongside the Prisma migration, not as an afterthought.

---

### Pitfall 4: Vercel Serverless Function Size Limit Exceeded by Mastra Agent Bundle

**What goes wrong:**
Vercel's serverless function size limit is 250 MB (compressed, including node_modules). The Mastra agent server includes: `@mastra/core`, `@mastra/libsql`, `@prisma/client` (with Postgres binary), `googleapis` (very large -- 30+ MB), `google-auth-library`, and `zod`. The `googleapis` package alone may push the function over the limit. Additionally, Prisma Client generates a native binary for the query engine -- the wrong binary target (e.g., shipping the macOS binary instead of the Linux one) adds 30-40 MB of dead weight.

**Why it happens:**
Mastra's `mastra build` output bundles everything into a deployable artifact. On Vercel serverless, each API route becomes a separate function, but shared dependencies are included in each function's bundle. The `googleapis` package is notoriously large because it includes types and client code for ALL Google APIs, not just the Slides/Drive/Docs APIs used here.

**How to avoid:**
1. Replace `googleapis` with individual API packages: `@googleapis/slides`, `@googleapis/drive`, `@googleapis/docs`. This drops bundle size from ~30 MB to ~3 MB.
2. Set `binaryTargets = ["native", "rhel-openssl-3.0.x"]` in Prisma's generator config. The `rhel-openssl-3.0.x` target is correct for Vercel's Lambda environment. Remove `native` in production builds to avoid shipping the macOS binary.
3. If the agent cannot fit in serverless functions, deploy it as a Vercel "standalone" Node.js server or on a separate platform (Railway, Fly.io) and point the web app's `AGENT_SERVICE_URL` to it.
4. Check bundle size BEFORE deploying: `du -sh .mastra/output` locally.

**Warning signs:**
- Vercel build fails with "Function size too large" or "FUNCTION_INVOCATION_FAILED"
- Build succeeds but function takes 15+ seconds to cold start (bundle too large to load)
- Import errors for Prisma binary at runtime on Vercel

**Phase to address:**
Deployment phase. Must be validated in the first deployment attempt, not after building the full deployment pipeline.

---

### Pitfall 5: Vercel Serverless Function Timeout Kills Long-Running Workflows

**What goes wrong:**
Vercel's Hobby plan has a 10-second timeout; Pro plan has 60 seconds (300 seconds max with streaming). The Touch 4 workflow (transcript extraction + brief generation + slide assembly + compliance check) takes 2-5 minutes end-to-end. A single serverless function invocation cannot host this entire workflow. Even individual steps like "generate 15 slides via Google Slides API" may exceed 60 seconds due to sequential API calls.

**Why it happens:**
The current architecture runs Mastra as a persistent Hono server on port 4111. Workflows execute as long-running processes with suspend/resume. Vercel serverless functions are designed for request/response cycles under 60 seconds. The paradigm mismatch is fundamental.

**How to avoid:**
The agent server (apps/agent) likely CANNOT run as Vercel serverless functions. Options:
1. **Vercel with `maxDuration`** -- Pro plan allows up to 300 seconds with `export const maxDuration = 300`. This might be enough for individual workflow steps but NOT for the full pipeline in one request.
2. **Dedicated compute for agent** -- Deploy the Mastra agent on Railway, Fly.io, Render, or a Vercel-adjacent VPS. The web app stays on Vercel serverless; `AGENT_SERVICE_URL` points to the dedicated agent server.
3. **Vercel Fluid Compute** -- Vercel's newer compute model allows longer-running functions. Check if the plan supports it.
4. **Keep the async pattern** -- The current architecture already separates "start workflow" (fast, returns runId) from "poll status" (fast, returns current state). This is compatible with serverless IF the workflow execution itself runs on durable compute, not inside the serverless function.

**Warning signs:**
- `504 GATEWAY_TIMEOUT` on workflow start or resume endpoints
- Workflows start but never complete (the function timed out mid-execution)
- Works locally (no timeout) but fails on Vercel

**Phase to address:**
Deployment architecture phase. This is an architectural decision that must be made BEFORE writing any Vercel configuration. The choice of where the agent runs determines all downstream deployment work.

---

### Pitfall 6: Supabase Auth Token Not Forwarded in Service-to-Service Calls

**What goes wrong:**
The web app (apps/web) authenticates users via Supabase Auth (Google OAuth). The web app then calls the agent server's API. If the agent server needs to know which user made the request (for audit trails, row-level security), the Supabase JWT must be forwarded from the web app to the agent. But the current `api-client.ts` does not include any `Authorization` header -- it is a simple fetch wrapper. Adding auth to the web app without updating the api-client creates a system where users are authenticated on the web side but the agent accepts unauthenticated requests from anyone who knows the URL.

**Why it happens:**
Auth is added to the web app first (it has the UI, it is the user-facing surface). The agent server is treated as an "internal service" and left unauthenticated. But once both are deployed to public Vercel URLs, the agent's API is publicly accessible.

**How to avoid:**
Implement a two-layer auth model:
1. **Web app** -- Supabase Auth with Google OAuth. Middleware checks for valid session on all routes except `/login` and auth callbacks.
2. **Agent server** -- API key authentication. The web app includes a shared secret (`AGENT_API_KEY`) in every request to the agent. The agent validates this key in middleware. This is simpler than forwarding Supabase JWTs and sufficient for service-to-service auth.
3. Update `api-client.ts` to include `Authorization: Bearer ${AGENT_API_KEY}` in all requests.
4. Store `AGENT_API_KEY` as an environment variable in both Vercel projects, NOT in the codebase.

**Warning signs:**
- Agent API is accessible without authentication from any browser
- No `Authorization` header in the web-to-agent fetch calls
- Audit trail has no user attribution (all actions appear as "system")

**Phase to address:**
Auth phase. Must be implemented alongside the Google OAuth login wall, not deferred to a later phase.

---

### Pitfall 7: Google OAuth Redirect URL Mismatch Between Environments

**What goes wrong:**
Google OAuth requires exact redirect URI matching. When deploying to Vercel with preview environments (each PR gets a unique URL like `project-abc123.vercel.app`), the redirect URI for OAuth callbacks changes with every preview deployment. Google Cloud Console only accepts pre-registered redirect URIs. Preview deployments fail OAuth with "redirect_uri_mismatch" error because the dynamic Vercel preview URL is not registered in GCP.

**Why it happens:**
Developers register `localhost:3000` and `production.vercel.app` in GCP OAuth credentials. They forget that Vercel preview deployments use dynamic URLs. Each preview deployment has a unique subdomain that cannot be pre-registered.

**How to avoid:**
1. **Use Supabase as the OAuth intermediary** -- Supabase handles the Google OAuth redirect internally. The redirect URL registered in GCP is Supabase's own callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`), NOT the Vercel app URL. Supabase then redirects back to the app. This means: you register ONE redirect URL in GCP (Supabase's), and Supabase redirects to whatever app URL is configured.
2. In Supabase, configure the "Redirect URLs" allowlist to include: `http://localhost:3000/**`, `https://your-production.vercel.app/**`, and `https://*-your-team.vercel.app/**` (wildcard for preview deployments).
3. In the Next.js app, use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables (these are safe to expose client-side).

**Warning signs:**
- OAuth works in local dev but fails on Vercel preview deployments
- "redirect_uri_mismatch" error from Google
- OAuth works on production URL but not on preview URLs

**Phase to address:**
Auth phase. Must be configured correctly from the first deployment. Wildcard redirect patterns in Supabase must be set up before the first preview deployment test.

---

### Pitfall 8: Supabase Auth Domain Restriction is Client-Side Only

**What goes wrong:**
You want to restrict login to `@lumenalta.com` email addresses only. Supabase Auth does not natively support domain-based login restriction at the provider level. If you only check the domain on the client side (after the OAuth flow completes), a user with a personal Gmail account can complete the OAuth flow, receive a valid Supabase session, and access the app until the client-side check kicks them out. During that window, they have a valid JWT that the agent server would accept.

**Why it happens:**
Google OAuth returns ANY Google account that the user authenticates with. Domain restriction is not a feature of the OAuth flow itself. Developers assume "login with Google" means "login with Google Workspace" but it means "login with any Google account."

**How to avoid:**
Enforce domain restriction at THREE levels:
1. **Google Cloud Console** -- In the OAuth consent screen, set the app to "Internal" if using Google Workspace. This restricts OAuth to users in the `lumenalta.com` Workspace org. If "Internal" is not possible (e.g., external OAuth app type), this level cannot enforce it.
2. **Supabase Database Hook or Edge Function** -- Create a Supabase auth hook (or database trigger on `auth.users`) that checks the email domain on sign-up. If the domain is not `@lumenalta.com`, immediately delete the auth record and return an error.
3. **Next.js Middleware** -- As a defense-in-depth layer, check `user.email.endsWith('@lumenalta.com')` in the Next.js middleware and redirect non-matching users to an "access denied" page.

All three layers are needed. Do not rely on any single layer.

**Warning signs:**
- A personal Gmail account can complete the OAuth flow and land on the dashboard
- The Supabase auth.users table contains entries with non-`@lumenalta.com` emails
- Domain restriction "works" but only because no one has tried a personal account

**Phase to address:**
Auth phase. The domain restriction must be tested with a non-`@lumenalta.com` Google account as part of acceptance criteria.

---

### Pitfall 9: Next.js Middleware Ordering Conflict Between Supabase Auth and Existing Routes

**What goes wrong:**
Adding Supabase Auth middleware to the Next.js app requires a `middleware.ts` at the app root that intercepts requests, checks for a valid session, and redirects unauthenticated users to login. The current app has NO middleware. Adding one incorrectly can: (1) block API routes that should be public (health checks, webhooks), (2) create an infinite redirect loop on the login page, (3) break the Server Actions that call the agent (Server Actions run server-side but middleware runs on the edge -- the Supabase client behaves differently in each).

**Why it happens:**
Next.js middleware runs on the Edge Runtime, which has a limited Node.js API surface. Supabase's `@supabase/ssr` package provides middleware helpers, but they require careful matcher configuration. Developers add middleware that matches all routes (`export const config = { matcher: '/(.*)'}`), which catches the login page itself, creating a redirect loop.

**How to avoid:**
1. Use a precise middleware matcher that EXCLUDES: `/login`, `/auth/callback`, `/_next/`, `/favicon.ico`, and any public API routes.
2. Pattern: `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|login|auth).*)'] }`
3. In middleware, use `@supabase/ssr`'s `createServerClient` with the request/response cookie helpers -- do not use the browser client.
4. Test the middleware with: (a) unauthenticated user hits dashboard -- should redirect to /login, (b) unauthenticated user hits /login -- should NOT redirect, (c) authenticated user hits dashboard -- should pass through.

**Warning signs:**
- Infinite redirect loop on any page (browser shows "too many redirects")
- Login page itself requires authentication (redirect loop)
- Server Actions fail with edge runtime compatibility errors
- `_next/static` assets blocked by middleware, causing blank pages

**Phase to address:**
Auth phase. Write the middleware matcher FIRST and test it with a mock session before integrating real Supabase auth.

---

### Pitfall 10: Vercel Environment Variable Misconfiguration Between Two Projects

**What goes wrong:**
With two Vercel projects (web + agent), environment variables must be configured independently in each project's Vercel dashboard. Common mistakes: (1) setting `AGENT_SERVICE_URL` in the agent project instead of the web project, (2) setting secrets in "Production" but not "Preview", (3) using `http://localhost:4111` as default in code and forgetting to override it in Vercel, (4) the agent project needs `DATABASE_URL` pointing to Supabase but the web project does not (it has no direct DB access), (5) Google service account credentials (JSON blob) may exceed Vercel's 4KB per-variable limit.

**Why it happens:**
Two separate Vercel projects mean two separate env var dashboards. It is easy to configure one and forget the other. Preview environments inherit from Production unless explicitly overridden, but some variables (like `AGENT_SERVICE_URL`) differ between preview and production.

**How to avoid:**
1. Create a canonical env var manifest listing every variable, which project(s) it belongs to, and which environments (Production, Preview, Development) it applies to.
2. For the Google service account JSON: if it exceeds 4KB, base64-encode it and decode at runtime, or use Vercel's "Sensitive Environment Variables" which support larger values.
3. Set `AGENT_SERVICE_URL` to the agent project's production URL in the web project's Production env, and the agent's preview URL pattern in the web project's Preview env.
4. Use `vercel env pull` to validate that the right variables are set before deploying.

**Warning signs:**
- Build succeeds but app crashes at runtime with "missing env var" errors
- Production works but preview deployments fail
- Web app cannot reach agent server (wrong URL)
- Google API calls fail with credential errors only on Vercel

**Phase to address:**
Deployment phase. Create the env var manifest as the FIRST deployment task, before any `vercel deploy` command.

---

### Pitfall 11: CORS Blocks Web-to-Agent Requests Between Two Vercel Domains

**What goes wrong:**
The web app (e.g., `web.vercel.app`) makes fetch requests to the agent server (e.g., `agent.vercel.app`). These are cross-origin requests. The agent server (Hono/Mastra) does not have CORS headers configured because in local dev, both run on `localhost` (different ports, but modern browsers handle same-host differently). On Vercel, different domains trigger CORS preflight requests. Without proper `Access-Control-Allow-Origin` headers on the agent, all browser-initiated requests fail with "CORS policy" errors.

**Why it happens:**
In local development, the web app makes server-side fetch calls (from Server Actions or API routes), which are NOT subject to CORS. On Vercel, if any client-side code calls the agent directly, or if the browser follows redirects to the agent domain, CORS applies. Even server-side fetches from Vercel serverless functions to the agent should work (no CORS for server-to-server), but developers may accidentally expose agent URLs to client-side code.

**How to avoid:**
1. **All agent calls must go through Server Actions or API routes** -- never call the agent URL from client-side JavaScript. The current architecture already does this correctly (api-client.ts is used in Server Actions).
2. **Add CORS headers to the Mastra/Hono server anyway** as defense-in-depth: `Access-Control-Allow-Origin: https://web.vercel.app`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type, Authorization`.
3. Handle `OPTIONS` preflight requests explicitly in the Hono middleware.
4. For preview environments, use a dynamic CORS origin based on the request's `Origin` header matched against an allowlist.

**Warning signs:**
- Browser console shows "Access to fetch has been blocked by CORS policy"
- Requests work from Postman/curl but fail from the browser
- Works in local dev but fails on Vercel

**Phase to address:**
Deployment phase. Add CORS middleware to the Mastra server before the first cross-origin deployment test.

---

### Pitfall 12: Prisma Client Connection Pool Exhaustion on Serverless

**What goes wrong:**
Each Vercel serverless function invocation creates a new Prisma Client instance. Each instance opens a connection to Postgres. Supabase's connection limit depends on the plan (free: 60 connections, Pro: 200-500). Under moderate concurrent load (10+ simultaneous requests), each cold start opens a new connection. The pool is exhausted within minutes, and subsequent requests fail with "too many clients already" or similar connection errors.

**Why it happens:**
Prisma Client is instantiated at the module level (`const prisma = new PrismaClient()`). In a traditional server, this is fine -- one instance, one connection pool. In serverless, each function instance gets its own Prisma Client with its own pool. Vercel may spin up dozens of instances under load.

**How to avoid:**
1. **Use Supabase's connection pooler** -- Supabase provides PgBouncer at port 6543 (vs. direct connection at port 5432). Use the pooler URL in `DATABASE_URL` for serverless deployments: `postgresql://user:pass@db.supabase.co:6543/postgres?pgbouncer=true`.
2. **Add `?pgbouncer=true&connection_limit=1`** to the connection string for serverless. This tells Prisma to use a single connection per instance and rely on PgBouncer for pooling.
3. **Use the singleton pattern** for Prisma Client in both apps -- check if `globalThis.prisma` exists before creating a new instance.
4. In `schema.prisma`, add `directUrl` for migrations (migrations need a direct connection, not pooled): `directUrl = env("DIRECT_URL")`.

**Warning signs:**
- Intermittent "too many connections" errors under load
- Works with 1-2 concurrent users but fails with 5+
- Connection errors appear only on Vercel, never locally

**Phase to address:**
Database migration phase. The connection string must use the pooler URL from day one on Vercel. Do not use the direct connection URL for the application.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping JSON fields as `String` instead of migrating to Postgres `Json` type | Zero code changes at call sites; faster migration | Cannot use Postgres JSON operators for queries; fields are opaque blobs | Acceptable for v1.1 -- migrate to `Json` type in a future milestone |
| Using API key auth instead of forwarding Supabase JWTs to agent | Simpler implementation; no JWT verification on agent side | No per-user audit trail on agent; agent cannot enforce row-level security | Acceptable for v1.1 -- upgrade to JWT forwarding when RLS is needed |
| Hardcoding CORS origin instead of dynamic allowlist | Works immediately for production domain | Breaks on every new preview deployment URL | Never -- use environment-variable-based origin or wildcard matching |
| Deploying Mastra agent to a non-Vercel platform | Avoids serverless timeout and bundle size issues | Two different hosting platforms to manage; different deployment pipelines | Acceptable and likely NECESSARY -- Mastra as a persistent server is a better fit for Railway/Fly.io |
| Skipping data migration (starting fresh on Postgres) | No migration script needed; clean slate | Loss of demo data, interaction history, feedback signals, and content sources | Acceptable ONLY if the existing data is purely demo/seed data with no production value |
| Using Supabase free tier for dev/preview | No cost | 60 connection limit; 500 MB storage; no point-in-time recovery | Acceptable for development; unacceptable for production |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prisma + Supabase | Using the direct connection URL (port 5432) in serverless | Use the PgBouncer pooler URL (port 6543) with `?pgbouncer=true&connection_limit=1` |
| Prisma + Supabase | Not setting `directUrl` for migrations | Add `directUrl = env("DIRECT_URL")` in schema.prisma for `prisma migrate deploy` to use direct connection |
| Supabase Auth + Next.js | Using `@supabase/supabase-js` browser client in Server Components | Use `@supabase/ssr` with `createServerClient` for Server Components and middleware; browser client only in Client Components |
| Supabase Auth + Google OAuth | Registering the Vercel app URL as the Google OAuth redirect URI | Register SUPABASE's callback URL (`https://<ref>.supabase.co/auth/v1/callback`) as the redirect URI in GCP |
| Vercel + Monorepo | Not configuring the root directory in Vercel project settings | Each Vercel project must set its "Root Directory" to the correct app (`apps/web` or `apps/agent`) |
| Vercel + Turborepo | Turborepo caching artifacts not working on Vercel | Enable Vercel's Remote Caching by linking the Vercel project; set `TURBO_TOKEN` and `TURBO_TEAM` env vars |
| Vercel + Prisma | Prisma Client binary not targeting the correct platform | Add `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to the generator block in schema.prisma |
| Mastra + Vercel | Assuming `mastra build` output runs on serverless | Mastra generates a Hono HTTP server; it needs persistent compute, not serverless functions |
| Google Service Account + Vercel | JSON key exceeds 4KB env var limit | Base64-encode the JSON key: `GOOGLE_SA_KEY_BASE64=...`; decode at runtime |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold start on Prisma + Supabase with large schema | First request takes 3-5 seconds; Prisma Client initialization and connection setup | Use `prisma generate` at build time; connection pooler reduces handshake overhead | Noticeable on every cold start; Vercel Pro's "Keep Warm" helps |
| Mastra workflows blocking serverless function for minutes | 504 timeout; partial workflow execution | Deploy agent on persistent compute (Railway/Fly.io); keep async start/poll pattern | Immediate on Vercel Hobby (10s); Pro may survive if < 300s with maxDuration |
| Supabase Auth session refresh hammering the auth endpoint | Rate limiting from Supabase; slow page loads | Cache session in middleware using cookies; only refresh when near expiry | At 20+ concurrent active users |
| Full Prisma Client generation in Vercel build | Build takes 2+ minutes extra; may timeout | Add `prisma generate` to `postinstall` script; cache Prisma Client in Turborepo | Build timeout on large schemas |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Agent server deployed without authentication | Anyone can trigger workflows, read deal data, modify briefs via public URL | Add API key middleware to all Mastra routes; validate `Authorization` header |
| Supabase `anon` key used for privileged operations | Anon key is public; anyone can call Supabase directly | Use `service_role` key only on server-side; anon key only for client-side auth flows |
| Domain restriction only in middleware (no server-side enforcement) | Bypassed by directly calling API endpoints or using a modified client | Enforce domain check in Supabase auth hook AND Next.js middleware AND agent API |
| `AGENT_API_KEY` committed to repository | Key compromise allows full agent API access | Store in Vercel env vars only; add to `.gitignore`; rotate on suspected compromise |
| Supabase connection string in client-side bundle | Database credentials exposed in browser | `DATABASE_URL` must be server-only env var (no `NEXT_PUBLIC_` prefix); never import Prisma in client code |
| Google service account JSON in Vercel env without encryption | If Vercel account is compromised, attacker gets full Google API access | Use Vercel's "Sensitive" env var type; consider separate GCP service account per environment |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Login page shows "Sign in with Google" but fails for personal Gmail | User confused -- "I have a Google account, why can't I sign in?" | Show message: "Sign in with your @lumenalta.com Google Workspace account" and display clear error for non-org accounts |
| Auth session expires during long workflow (deck generation takes 2-5 min) | User returns to approval page, session is expired, must re-login, loses context | Set Supabase session duration to 24 hours; use refresh tokens; auto-refresh in middleware |
| Preview deployment URLs are not human-readable | Team members cannot tell which preview corresponds to which PR | Use Vercel's "Deploy Aliases" to set readable names; include PR number in branch name |
| Post-migration: existing bookmarks/links to old dev URLs break | Users saved links to `localhost:4111` endpoints during v1.0 | Communicate new URLs to team; update any documentation or Slack pinned messages |

---

## "Looks Done But Isn't" Checklist

- [ ] **Database migration:** Row counts match between SQLite source and Postgres target -- verify with `SELECT COUNT(*) FROM` each table
- [ ] **Database migration:** DateTime fields contain valid timestamps in Postgres, not NULL or epoch -- spot-check 5 records
- [ ] **Database migration:** JSON string fields are valid JSON in Postgres -- run `SELECT id FROM table WHERE payload::json IS NULL` (will error on invalid JSON)
- [ ] **Auth login wall:** A non-`@lumenalta.com` Google account cannot access ANY page after completing OAuth -- test with a personal Gmail
- [ ] **Auth login wall:** The agent server rejects requests without a valid API key -- test with curl (no auth header)
- [ ] **Vercel deployment:** Both web and agent projects build and deploy successfully -- check Vercel dashboard for both
- [ ] **Vercel deployment:** Preview deployments work (OAuth redirect, env vars, agent URL) -- test on an actual PR preview
- [ ] **Service-to-service auth:** Web app can reach agent server on Vercel -- test a workflow start from the deployed web app
- [ ] **Mastra workflow state:** A workflow suspended on the deployed agent can be resumed after a cold start -- test HITL flow end-to-end on Vercel
- [ ] **Connection pooling:** Under concurrent load (5+ users), no "too many connections" errors -- test with concurrent requests
- [ ] **CORS:** Browser console shows no CORS errors when using the deployed web app -- check browser DevTools Network tab
- [ ] **Environment variables:** All env vars are set in both Vercel projects for both Production and Preview -- use `vercel env ls` to verify

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Migration lock provider mismatch | LOW | Delete `migrations/` directory; regenerate with `prisma migrate dev --name init_postgres`; archive old migrations in git |
| Data corruption during migration | MEDIUM | Re-run migration script from SQLite source (which should be preserved read-only); fix transformation bugs; re-validate |
| Mastra state lost on Vercel | HIGH | Identify orphaned workflows from application database (InteractionRecord with status "generating"); manually re-trigger affected workflows; switch to persistent compute |
| Function size limit exceeded | MEDIUM | Replace `googleapis` with individual packages; remove unused dependencies; consider separate hosting for agent |
| Connection pool exhaustion | LOW | Switch to PgBouncer pooler URL; add `connection_limit=1` to connection string; redeploy |
| OAuth redirect mismatch | LOW | Add the correct redirect URL to Supabase's allowlist; for preview deployments, add wildcard pattern |
| Non-org user accessed the app | LOW | Delete the user from Supabase auth.users; add domain enforcement hook; audit for any actions taken |
| CORS blocking web-to-agent calls | LOW | Add CORS middleware to Hono server; redeploy agent; verify with browser DevTools |
| Env var missing in one environment | LOW | Check `vercel env ls`; add missing variable; redeploy; verify with runtime logs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Migration lock provider mismatch | Database Migration | Fresh `prisma migrate dev` succeeds with `provider = "postgresql"` |
| SQLite-to-Postgres data type issues | Database Migration | Migration script validates row counts and sample data integrity |
| Mastra LibSQLStore needs migration | Database Migration + Deployment | Workflow suspend/resume works across server restarts on deployed environment |
| Serverless function size limit | Deployment | `du -sh` of build output < 250 MB; Vercel build succeeds |
| Serverless timeout kills workflows | Deployment Architecture | Agent deployed on persistent compute; workflow end-to-end completes |
| Auth token not forwarded to agent | Auth | Agent rejects requests without valid API key; curl test confirms |
| OAuth redirect URL mismatch | Auth | OAuth flow completes on both production and preview Vercel deployments |
| Domain restriction is client-side only | Auth | Non-`@lumenalta.com` Google account is rejected at Supabase level, not just middleware |
| Middleware ordering conflict | Auth | No infinite redirects; login page accessible; dashboard requires auth |
| Env var misconfiguration | Deployment | Canonical manifest verified against both Vercel projects; `vercel env ls` matches |
| CORS between Vercel projects | Deployment | No CORS errors in browser console on deployed web app |
| Connection pool exhaustion | Database Migration | 10 concurrent requests succeed without connection errors |

---

## Sources

- Prisma documentation: provider-specific migration behavior, SQLite vs. PostgreSQL differences, serverless connection management -- HIGH confidence (stable, well-documented)
- Vercel documentation: serverless function limits (size, timeout, memory), monorepo configuration, environment variables -- HIGH confidence (well-documented, plan-specific limits are public)
- Supabase documentation: Auth with Google OAuth, redirect URL configuration, PgBouncer connection pooling, RLS -- HIGH confidence (actively maintained docs)
- Next.js documentation: middleware configuration, Edge Runtime limitations, Server Actions behavior -- HIGH confidence
- Google Cloud Console: OAuth consent screen configuration, redirect URI requirements -- HIGH confidence (stable API)
- Mastra framework: LibSQLStore configuration, build output format, serverless compatibility -- LOW confidence (newer framework, training data may not reflect current capabilities; verify against current docs)
- General serverless deployment patterns: connection pooling, cold starts, function bundling -- HIGH confidence (well-established patterns)

**Note:** WebSearch, WebFetch, and Bash were unavailable during this research session. All findings are drawn from training data (knowledge cutoff) and direct codebase analysis. Mastra-specific deployment behavior (Pitfalls 3, 4, 5) should be validated against current Mastra documentation before treating as authoritative. The Mastra framework may have added Vercel-specific deployment adapters or PostgreSQL storage options since training data cutoff.

---
*Pitfalls research for: SQLite-to-Supabase migration, Vercel deployment, Google OAuth -- Lumenalta v1.1 Infrastructure*
*Researched: 2026-03-04*
