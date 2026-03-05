# Architecture Research: v1.1 Infrastructure & Access Control

**Domain:** Supabase migration, Vercel deployment, and Google OAuth integration into existing Mastra AI + Next.js 15 monorepo
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH (Supabase/Prisma/Vercel patterns well-established in training data; Mastra deployment specifics are MEDIUM confidence)

---

## Existing Architecture Snapshot

Before detailing what changes, here is what exists and MUST NOT break:

```
lumenalta-hackathon/
├── apps/
│   ├── web/                    # Next.js 15 (App Router, Server Actions)
│   │   ├── src/
│   │   │   ├── app/            # Routes: /deals, /deals/[id], /api/upload
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts       # ALL web->agent HTTP calls (fetchJSON wrapper)
│   │   │   │   ├── actions/            # Server Actions (deal-actions.ts, touch-actions.ts)
│   │   │   │   └── error-messages.ts
│   │   │   ├── components/             # shadcn/ui + custom components
│   │   │   └── env.ts                  # t3-env: AGENT_SERVICE_URL, NODE_ENV
│   │   └── next.config.ts
│   │
│   └── agent/                  # Mastra Hono server (port 4111)
│       ├── src/
│       │   ├── mastra/
│       │   │   ├── index.ts            # Mastra init: LibSQLStore, workflows, API routes
│       │   │   └── workflows/          # touch-1 through touch-4, pre-call
│       │   ├── lib/                    # Google APIs, Drive, AtlusAI client
│       │   └── env.ts                  # t3-env: DATABASE_URL, Google creds, Vertex AI
│       └── prisma/
│           ├── schema.prisma           # SQLite provider, 9 models
│           ├── dev.db                  # Application database
│           ├── mastra.db              # Mastra internal state (LibSQL)
│           └── migrations/             # 4 forward-only migrations
│
├── packages/
│   ├── schemas/                # Shared Zod v4 types + constants
│   ├── eslint-config/
│   └── tsconfig/
│
├── turbo.json                  # build depends on ^db:generate
├── pnpm-workspace.yaml
└── package.json                # pnpm@9.12.0, turbo@^2.3.3
```

**Critical invariants:**
- Web app has ZERO direct database access -- all data flows through `api-client.ts` to agent server
- Agent owns both databases: Prisma (app data) and LibSQL (Mastra workflow state)
- Mastra workflows use suspend/resume -- workflow state MUST survive server restarts
- Google API calls use a service account (not user OAuth) -- this stays unchanged
- Server Actions in web app proxy to agent server -- they do NOT access DB directly

---

## What Changes, What Stays the Same

### STAYS THE SAME (do not touch)

| Component | Why Unchanged |
|-----------|---------------|
| `apps/web/src/lib/api-client.ts` | Web->agent HTTP communication pattern is correct; only the BASE_URL changes per environment |
| `apps/web/src/lib/actions/*.ts` | Server Actions proxy to agent; auth will wrap these, not replace them |
| `apps/agent/src/mastra/workflows/*.ts` | Workflow logic is database-agnostic; Prisma client handles the switch |
| `apps/agent/src/lib/` (Google API helpers) | Service account auth is separate from user auth |
| `packages/schemas/` | Shared Zod types are infrastructure-independent |
| `turbo.json` | Build pipeline stays the same; Vercel respects Turborepo out of the box |
| All UI components | Auth wraps the layout, does not change page components |

### CHANGES (new or modified)

| Component | Change Type | Details |
|-----------|-------------|---------|
| `apps/agent/prisma/schema.prisma` | **MODIFY** | Change `provider = "sqlite"` to `provider = "postgresql"`, add connection pooling URL |
| `apps/agent/prisma/migrations/` | **RECREATE** | New Postgres migration baseline (SQLite migrations are not portable) |
| `apps/agent/prisma/migration_lock.toml` | **MODIFY** | Lock changes from `sqlite` to `postgresql` |
| `apps/agent/src/env.ts` | **MODIFY** | `DATABASE_URL` becomes a Postgres connection string; add `DIRECT_DATABASE_URL` for migrations |
| `apps/agent/src/mastra/index.ts` | **MODIFY** | Replace `LibSQLStore` with Postgres-compatible store (see below) |
| `apps/web/src/env.ts` | **MODIFY** | Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `apps/web/src/middleware.ts` | **NEW** | Next.js middleware for Supabase Auth session refresh |
| `apps/web/src/lib/supabase/` | **NEW** | Supabase client factories (server, client, middleware) |
| `apps/web/src/app/auth/` | **NEW** | Login page, callback route, auth components |
| `apps/web/src/app/layout.tsx` | **MODIFY** | Wrap with auth provider, add user display in nav |
| `apps/web/src/lib/api-client.ts` | **MODIFY** | Pass auth token in headers to agent server |
| `apps/agent/src/mastra/index.ts` API routes | **MODIFY** | Add API key validation middleware for service-to-service auth |
| `vercel.json` (root) | **NEW** | Vercel project configuration (if needed beyond defaults) |
| `.env.example` files | **MODIFY** | Add Supabase and deployment env vars |

---

## System Overview: v1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Next.js App (React 19)                                     │    │
│  │  Google OAuth login -> Supabase Auth session (cookie-based) │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────┐
│               VERCEL PROJECT 1: web                                 │
│                                                                      │
│  ┌────────────────────┐  ┌─────────────────────────────────────┐    │
│  │  middleware.ts      │  │  Server Actions (deal, touch)      │    │
│  │  - Session refresh  │  │  - Forward user JWT to agent       │    │
│  │  - Auth gate        │  │  - Proxy all calls via api-client  │    │
│  │  - Domain check     │  └──────────────┬──────────────────────┘    │
│  └────────────────────┘                  │                           │
│                                          │ HTTP + API Key + JWT      │
│  ┌────────────────────┐                  │                           │
│  │  /auth/callback     │                  │                           │
│  │  (OAuth redirect)   │                  │                           │
│  └────────────────────┘                  │                           │
└──────────────────────────────────────────┼───────────────────────────┘
                                           │
┌──────────────────────────────────────────▼───────────────────────────┐
│               VERCEL PROJECT 2: agent                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Mastra Hono Server                                          │    │
│  │  - API key validation on all routes                          │    │
│  │  - Prisma Client -> Supabase PostgreSQL                      │    │
│  │  - Mastra Storage -> Postgres (or Upstash/Turso for state)   │    │
│  │  - Workflow suspend/resume (durable state)                   │    │
│  │  - Google Workspace API calls (service account, unchanged)   │    │
│  └──────────────────────────────┬───────────────────────────────┘    │
└──────────────────────────────────┼───────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │    SUPABASE                   │
                    │                               │
                    │  ┌─────────────────────────┐  │
                    │  │  Auth (Google OAuth)     │  │
                    │  │  - @lumenalta.com only   │  │
                    │  │  - JWT tokens            │  │
                    │  └─────────────────────────┘  │
                    │                               │
                    │  ┌─────────────────────────┐  │
                    │  │  PostgreSQL Database     │  │
                    │  │  - App tables (Prisma)   │  │
                    │  │  - Supavisor pooling     │  │
                    │  │  - dev + prod instances  │  │
                    │  └─────────────────────────┘  │
                    └───────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │  EXTERNAL SERVICES           │
                    │  (unchanged from v1.0)       │
                    │  - Google Slides/Docs/Drive  │
                    │  - Vertex AI (GPT-OSS 120b)  │
                    │  - AtlusAI (RAG/MCP)          │
                    └──────────────────────────────┘
```

---

## Component Integration Details

### 1. Database Migration: SQLite -> Supabase PostgreSQL

**What changes in Prisma:**

The schema.prisma file changes minimally -- SQLite and PostgreSQL share most Prisma syntax. Key differences:

```prisma
// BEFORE (v1.0)
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// AFTER (v1.1)
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Supavisor pooled connection (port 6543)
  directUrl = env("DIRECT_DATABASE_URL") // Direct connection (port 5432, for migrations)
}
```

**Schema changes needed for Postgres compatibility:**
- `String` fields used for JSON blobs (e.g., `payload`, `tags`, `inputs`) can stay as `String` (Postgres TEXT) or be upgraded to `Json` type for better querying. Recommendation: keep as `String` for v1.1 to minimize diff; upgrade to `Json` in v1.2 when query patterns demand it.
- `@default(cuid())` works identically in Postgres.
- `DateTime` fields work identically.
- `@@index` annotations work identically.
- The `@unique` constraint on `ContentSource.name` and `ImageAsset.driveFileId` works identically.

**Migration strategy (forward-only, per CLAUDE.md rules):**
1. Create a NEW Supabase project (dev instance)
2. Change `schema.prisma` provider to `postgresql`
3. Delete the `migrations/` directory (SQLite migrations cannot be applied to Postgres -- the SQL dialects differ)
4. Delete `migration_lock.toml`
5. Run `prisma migrate dev --name init-postgres` to generate a fresh Postgres baseline
6. The dev.db SQLite file becomes irrelevant for deployed environments but stays in .gitignore for local reference
7. Seed data can be re-run via `prisma db seed`

**Confidence:** HIGH -- Prisma provider switching is well-documented and the schema uses no SQLite-specific features.

**Connection string format (Supabase):**
```
# Pooled (for application connections -- use in DATABASE_URL)
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true

# Direct (for migrations -- use in DIRECT_DATABASE_URL)
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

**Confidence:** HIGH -- Supabase connection string format is stable and well-documented.

### 2. Mastra Internal Storage Migration

**Current state:** Mastra uses `LibSQLStore` pointing to a local `file:./prisma/mastra.db` SQLite file. This stores workflow execution state, suspend/resume snapshots, and step outputs.

**Problem for Vercel:** Vercel serverless functions have an ephemeral filesystem. A local SQLite file will be lost between invocations. The Mastra storage backend MUST move to a networked database.

**Options (ordered by recommendation):**

| Option | Recommendation | Notes |
|--------|---------------|-------|
| `@mastra/pg` (PostgresStore) | **RECOMMENDED** | Uses the same Supabase Postgres instance; Mastra stores its tables in a separate schema. Single database, no extra service. |
| Turso (LibSQL cloud) | Alternative | LibSQLStore already works; Turso is the hosted version. Adds another service but keeps the LibSQL compatibility. |
| Upstash Redis | Not recommended | Different data model; Mastra's Postgres store is more natural for workflow state. |

**Implementation:**

```typescript
// BEFORE (v1.0)
import { LibSQLStore } from "@mastra/libsql";

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: "mastra-store",
    url: "file:./prisma/mastra.db",
  }),
  // ...
});

// AFTER (v1.1) -- using @mastra/pg
import { PostgresStore } from "@mastra/pg";

export const mastra = new Mastra({
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  // ...
});
```

**Confidence:** MEDIUM -- `@mastra/pg` package name and API are based on Mastra documentation patterns from training data. The exact import path and constructor shape should be verified against current Mastra v1.8 docs. If `@mastra/pg` does not exist, Mastra may use a different package name like `@mastra/postgres` or accept a Drizzle/Prisma adapter. **Verify on npmjs.com before implementing.**

**Risk:** If Mastra does not have a first-party Postgres storage adapter, the fallback is Turso (hosted LibSQL, which `@mastra/libsql` already supports -- just change the URL from `file:` to `libsql://`).

### 3. Google OAuth via Supabase Auth

**Architecture decision:** Authentication lives entirely in `apps/web`. The agent server does NOT handle user authentication -- it validates a shared API key for service-to-service trust.

**Why Supabase Auth (not NextAuth/Auth.js):**
- Single platform: Database and auth from the same provider eliminates credential sprawl
- Google OAuth is a first-class Supabase Auth provider
- Domain restriction (`@lumenalta.com`) is handled server-side in Supabase
- JWT tokens are automatically managed via Supabase client libraries
- No additional service to deploy or manage

**Components to add in `apps/web`:**

```
apps/web/src/
├── lib/
│   └── supabase/
│       ├── client.ts           # createBrowserClient() for client components
│       ├── server.ts           # createServerClient() for Server Actions/RSC
│       └── middleware.ts       # createServerClient() for middleware session refresh
├── middleware.ts               # NEW: Auth gate + session refresh at edge
├── app/
│   ├── auth/
│   │   ├── login/page.tsx      # Login page with "Sign in with Google" button
│   │   └── callback/route.ts   # OAuth callback handler (GET /auth/callback)
│   └── layout.tsx              # MODIFIED: conditional auth wrapper
```

**Auth flow:**

```
1. User visits any page
       │
2. middleware.ts intercepts
       │
       ├── Has valid Supabase session cookie? -> Allow through
       │
       └── No session? -> Redirect to /auth/login
                              │
3. User clicks "Sign in with Google"
       │
4. supabase.auth.signInWithOAuth({ provider: 'google' })
       │   -> Redirects to Google consent screen
       │   -> Google authenticates, checks @lumenalta.com domain (via Google Workspace)
       │
5. Google redirects to /auth/callback?code=...
       │
6. /auth/callback/route.ts exchanges code for session
       │   -> supabase.auth.exchangeCodeForSession(code)
       │   -> Supabase sets session cookies
       │   -> Server-side check: if email domain !== '@lumenalta.com', sign out + error
       │
7. Redirect to /deals (authenticated)
```

**Domain restriction enforcement (defense in depth):**

1. **Google Cloud Console:** Configure the OAuth consent screen as "Internal" (Google Workspace). This inherently restricts to `@lumenalta.com` users at the Google level. No external user can even reach the consent screen.

2. **Supabase callback (server-side):** In `/auth/callback/route.ts`, verify `user.email?.endsWith('@lumenalta.com')`. If not, immediately sign out and redirect with error. This catches edge cases where OAuth consent screen is misconfigured as "External."

3. **middleware.ts (edge):** On every request, validate session exists and has not expired. If expired, Supabase client automatically refreshes the token using the refresh token cookie.

**Confidence:** HIGH for the auth flow pattern (Supabase + Next.js + Google OAuth is thoroughly documented). MEDIUM for the exact `@supabase/ssr` API as it was evolving through 2025.

**Key dependency:** `@supabase/ssr` (replaces the deprecated `@supabase/auth-helpers-nextjs`). This is the current official package for Next.js App Router integration with Supabase Auth.

### 4. Vercel Deployment: Two Projects

**Why two Vercel projects (not one):**
- `apps/web` is a Next.js app -- Vercel's primary deployment target with zero-config
- `apps/agent` is a Mastra/Hono server -- NOT a Next.js app; needs a different build and runtime
- Different scaling characteristics: web is request-response, agent has long-running workflows
- Independent environment variables per project
- Independent preview URLs per project (each PR gets both a web and agent preview)

**Vercel project configuration:**

| Setting | web project | agent project |
|---------|-------------|---------------|
| Root Directory | `apps/web` | `apps/agent` |
| Framework Preset | Next.js | Other |
| Build Command | `cd ../.. && pnpm turbo build --filter=web` | `cd ../.. && pnpm turbo build --filter=agent` |
| Output Directory | `.next` | `.mastra/output` (verify Mastra build output) |
| Install Command | `pnpm install` | `pnpm install` |
| Node.js Version | 20.x | 20.x |

**Monorepo handling:** Vercel natively detects pnpm workspaces and Turborepo. Setting the Root Directory tells Vercel which app to build. The Install Command runs at the workspace root so all workspace dependencies (including `packages/schemas`) are available.

**Environment variables per Vercel project:**

Web project:
```
AGENT_SERVICE_URL=https://agent-[project].vercel.app  (prod)
                  https://agent-[hash]-[project].vercel.app  (preview)
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
AGENT_API_KEY=shared-secret-for-service-auth
```

Agent project:
```
DATABASE_URL=postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_DATABASE_URL=postgresql://...@pooler.supabase.com:5432/postgres
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=...
GOOGLE_TEMPLATE_PRESENTATION_ID=...
MEET_LUMENALTA_PRESENTATION_ID=...
CAPABILITY_DECK_PRESENTATION_ID=...
GOOGLE_CLOUD_PROJECT=...
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=  (handled differently on Vercel -- see pitfall)
AGENT_API_KEY=shared-secret-for-service-auth
```

**Confidence:** HIGH for web deployment (Next.js on Vercel is trivial). MEDIUM for agent deployment -- Mastra's `mastra build` produces a standalone Hono server, and its compatibility with Vercel's serverless/edge model needs verification.

### 5. Agent Server on Vercel: The Key Challenge

**Problem:** The Mastra agent runs as a long-lived Hono server (`mastra dev` / `mastra build`). Vercel's default deployment model is serverless functions with a 10-second (hobby) to 300-second (pro) timeout. Mastra workflows (especially Touch 4) can run for 30-120 seconds including multiple LLM calls and Google API operations.

**Options:**

| Option | Viability | Notes |
|--------|-----------|-------|
| Vercel Serverless Functions | **RISKY** | 300s max on Pro plan. Touch 4 workflows may exceed this. Cold starts add latency. |
| Vercel Fluid Compute | **POSSIBLE** | Allows streaming/long-running functions. Check if Mastra's Hono adapter is compatible. |
| Separate hosting (Railway, Fly.io, Render) | **SAFEST** | Deploy agent as a persistent Node.js process. No timeout limits. Adds another platform but eliminates timeout risk. |
| Vercel + background function pattern | **RECOMMENDED** | Start workflow in a serverless function, return runId immediately. Workflow executes asynchronously (with Postgres-backed state). Client polls for completion. This already matches the existing architecture. |

**Recommended approach:** Deploy the agent to Vercel as a Node.js serverless function, BUT restructure long workflows to use Mastra's durable execution with Postgres-backed state. The existing poll-based UI pattern (`getWorkflowStatus(runId)` every 3s) already handles this. The key is ensuring that Mastra's workflow engine can survive function restarts between polls -- which is exactly what the storage backend migration (LibSQL -> Postgres) enables.

If Vercel's `mastra build` output does not map to a Vercel-deployable artifact, the fallback is:
1. Deploy agent to **Railway** (persistent Node.js process, $5/mo, zero config for Docker)
2. Web stays on Vercel, AGENT_SERVICE_URL points to Railway

**Confidence:** MEDIUM -- the Mastra build artifact structure and Vercel compatibility require verification. The poll-based pattern is sound regardless of hosting platform.

### 6. Service-to-Service Authentication (Web -> Agent)

**Current state:** `api-client.ts` calls the agent server with no authentication. This is fine for local development but unacceptable for production.

**Recommended approach: Shared API key**

```typescript
// apps/web/src/lib/api-client.ts (MODIFIED)
async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.AGENT_API_KEY,      // NEW: shared secret
      ...init?.headers,
    },
  });
  // ...
}

// apps/agent/src/mastra/index.ts (add middleware to all routes)
// Validate X-API-Key header on every request
function validateApiKey(c: Context, next: () => Promise<void>) {
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.AGENT_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return next();
}
```

**Why not JWT forwarding from user session:**
- The agent server does not need to know WHO the user is -- it processes workflows for the platform
- Adding JWT verification to the agent would create a dependency on Supabase Auth from the agent, coupling the services
- A shared API key is simpler and sufficient for a private service-to-service link
- If user-level audit logging is needed later, the web app can include a `X-User-Email` header alongside the API key

**Confidence:** HIGH -- this is the standard pattern for internal service communication where both services are controlled by the same team.

---

## Data Flow Changes

### Authentication Flow (NEW)

```
Browser
    │
    │  GET /deals
    ▼
middleware.ts
    │
    ├── supabase.auth.getUser() -> valid session?
    │       │
    │       ├── YES -> pass through to page
    │       │
    │       └── NO -> redirect /auth/login
    │
    │  User clicks "Sign in with Google"
    ▼
supabase.auth.signInWithOAuth({ provider: 'google' })
    │
    │  -> Google OAuth consent (Internal, @lumenalta.com only)
    │  -> Redirect to /auth/callback?code=...
    ▼
/auth/callback/route.ts
    │
    │  supabase.auth.exchangeCodeForSession(code)
    │  verify email domain === '@lumenalta.com'
    │  set session cookies
    ▼
Redirect to /deals (authenticated)
```

### Modified Web -> Agent Flow

```
Server Action (deal-actions.ts / touch-actions.ts)
    │
    │  fetchJSON(path, { headers: { "X-API-Key": AGENT_API_KEY } })
    ▼
Agent Server (Mastra Hono)
    │
    │  validateApiKey middleware -> 401 if invalid
    │  Prisma Client -> Supabase PostgreSQL (pooled)
    │  Mastra Storage -> Supabase PostgreSQL
    ▼
Response -> Server Action -> Client Component
```

### Database Connections

```
apps/agent (Vercel serverless)
    │
    ├── Prisma Client ──────> Supabase Supavisor (port 6543, pgbouncer=true)
    │                          └── PostgreSQL (app tables)
    │
    ├── Prisma Migrate ─────> Supabase Direct (port 5432)
    │   (CI/CD or local only)  └── PostgreSQL (DDL operations)
    │
    └── Mastra PostgresStore -> Supabase Supavisor (port 6543)
                                 └── PostgreSQL (mastra.* schema/tables)
```

---

## Recommended Project Structure Changes

```
apps/web/src/
├── middleware.ts                    # NEW: auth gate + session refresh
├── lib/
│   ├── supabase/                   # NEW: Supabase client factories
│   │   ├── client.ts               #   createBrowserClient()
│   │   ├── server.ts               #   createServerClient() for RSC/Actions
│   │   └── middleware.ts           #   createServerClient() for edge middleware
│   ├── api-client.ts               # MODIFIED: add X-API-Key header
│   └── actions/                    # UNCHANGED (but auth-protected by middleware)
├── app/
│   ├── auth/                       # NEW: auth routes
│   │   ├── login/page.tsx          #   Google sign-in button
│   │   └── callback/route.ts       #   OAuth code exchange
│   ├── layout.tsx                  # MODIFIED: auth context wrapper
│   └── ...                         # UNCHANGED
└── env.ts                          # MODIFIED: add Supabase env vars

apps/agent/
├── prisma/
│   ├── schema.prisma               # MODIFIED: postgresql provider + directUrl
│   └── migrations/                 # RECREATED: fresh postgres baseline
├── src/
│   ├── mastra/
│   │   └── index.ts                # MODIFIED: PostgresStore, API key middleware
│   └── env.ts                      # MODIFIED: DATABASE_URL, DIRECT_DATABASE_URL, AGENT_API_KEY
└── package.json                    # MODIFIED: add @mastra/pg, remove @mastra/libsql (maybe)
```

---

## Architectural Patterns

### Pattern 1: Supabase Auth with Next.js App Router (Server-Side Sessions)

**What:** Use `@supabase/ssr` to create Supabase clients in three contexts: browser (client components), server (RSC/Server Actions), and middleware (edge runtime). Sessions are stored in HTTP-only cookies, not localStorage.

**When to use:** Always for Supabase + Next.js App Router. The `@supabase/ssr` package handles cookie serialization across all three contexts.

**Trade-offs:** Slightly more boilerplate than NextAuth (3 client factory files), but gives direct access to Supabase's full auth API including RLS, JWT claims, and admin operations.

**Example:**
```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

### Pattern 2: Edge Middleware Auth Gate

**What:** Next.js middleware runs on every request before the page renders. Use it to check auth state and redirect unauthenticated users. Do NOT use it for heavy logic -- just session validation.

**When to use:** For protecting all routes except `/auth/*` and static assets.

**Trade-offs:** Runs on Vercel's edge network (fast), but cannot access Node.js APIs. The Supabase middleware client is edge-compatible.

**Example:**
```typescript
// apps/web/src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  // Allow auth routes and static assets
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return response;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### Pattern 3: Prisma Dual Connection URLs for Supabase

**What:** Supabase provides two connection endpoints -- a pooled connection (Supavisor, port 6543) for application queries, and a direct connection (port 5432) for schema migrations. Prisma needs both.

**When to use:** Always when using Prisma with Supabase in a serverless environment.

**Trade-offs:** Requires managing two connection strings, but this is standard Supabase practice.

**Example:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // pooled: port 6543, pgbouncer=true
  directUrl = env("DIRECT_DATABASE_URL") // direct: port 5432 (migrations only)
}
```

### Pattern 4: API Key Service Authentication

**What:** The web app includes a shared secret (API key) in every request to the agent server. The agent validates this key before processing any request. No user identity is forwarded -- the agent trusts the web app.

**When to use:** When two services are controlled by the same team and the downstream service (agent) does not need user-level authorization.

**Trade-offs:** Simpler than JWT/mTLS but requires secure key rotation practices. Sufficient for this use case.

---

## Anti-Patterns

### Anti-Pattern 1: Adding Supabase Auth to the Agent Server

**What people do:** Import `@supabase/ssr` into `apps/agent` and verify user JWTs on every agent API route.

**Why it's wrong:** The agent server is an internal service. Adding user auth creates tight coupling between user identity and workflow execution. It also requires the agent to know about Supabase, doubling the auth configuration surface.

**Do this instead:** The web app is the auth boundary. It validates user sessions and forwards requests to the agent with a simple API key. The agent trusts the web app.

### Anti-Pattern 2: Using Supabase Client Library for Database Queries

**What people do:** Replace Prisma with `supabase.from('companies').select('*')` for database access, since Supabase provides a client library.

**Why it's wrong:** The existing codebase has 9 Prisma models with relations, indices, and a migration history. Replacing Prisma with the Supabase JS client would rewrite all data access code. Prisma connects directly to PostgreSQL via the connection string -- it does not know or care that the database is hosted on Supabase.

**Do this instead:** Keep Prisma as the ORM. Point `DATABASE_URL` at the Supabase Postgres connection string. Supabase is just a managed Postgres host from Prisma's perspective.

### Anti-Pattern 3: Single Vercel Project for Both Apps

**What people do:** Try to deploy both `apps/web` and `apps/agent` from a single Vercel project using rewrites or custom routing.

**Why it's wrong:** Web and agent have different build commands (`next build` vs `mastra build`), different runtimes, different scaling needs, and different environment variables. Cramming them into one project creates deployment fragility.

**Do this instead:** Two Vercel projects, one Git repo. Each project has its Root Directory set to the respective app. Both build from the same commit.

### Anti-Pattern 4: Storing Supabase Service Role Key in Web App

**What people do:** Use `SUPABASE_SERVICE_ROLE_KEY` in the web app for admin operations.

**Why it's wrong:** The service role key bypasses Row-Level Security and has full database access. If it leaks to the client (easy mistake in Next.js), it compromises the entire database.

**Do this instead:** Use only `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the web app. If admin operations are needed, add them as agent API routes and call them through the authenticated api-client.

---

## Integration Points

### External Services (v1.1 additions)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` in `apps/web` only; Google OAuth provider configured in Supabase Dashboard | OAuth consent screen must be "Internal" in Google Cloud Console for domain restriction. Supabase project needs Google OAuth client ID/secret. |
| Supabase PostgreSQL | Prisma Client connects via `DATABASE_URL` (pooled) in `apps/agent` | No code change in data access layer -- only connection string changes. Add `?pgbouncer=true` for pooled connections. |
| Vercel (hosting) | Two projects via Vercel Dashboard or CLI; Git integration for auto-deploy | Both projects deploy from same repo. Preview environments need preview-specific AGENT_SERVICE_URL. |

### Internal Boundaries (v1.1 additions)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Browser <-> Web (auth) | Supabase Auth cookies (HTTP-only, automatic refresh) | No custom token management needed; `@supabase/ssr` handles it |
| Web middleware <-> Supabase | Edge-compatible HTTP call to Supabase Auth API | Runs on every request; fast because Supabase Auth API is designed for this |
| Web Server Actions <-> Agent | HTTP + `X-API-Key` header | Same pattern as v1.0 but with auth header added |
| Agent <-> Supabase DB | Prisma Client over PostgreSQL wire protocol | Connection pooling via Supavisor; Prisma's connection pool should be set low (~5) for serverless |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-20 users (v1.1 launch) | Current architecture is sufficient. Supabase free tier handles this. Vercel hobby/pro handles the traffic. |
| 20-100 users | Monitor Supabase connection count. Serverless can exhaust Postgres connections quickly. Supavisor pooling handles this. Set Prisma `connection_limit=5` in DATABASE_URL. |
| 100+ users | Consider moving agent to a persistent process (Railway/Fly.io) to avoid cold starts and connection churn. Add Supabase Pro plan for higher connection limits. |

### Scaling Priorities

1. **First bottleneck (v1.1):** Vercel cold starts on the agent serverless function. Each cold start re-establishes a Prisma connection to Supabase. Mitigation: connection pooling via Supavisor (already in the architecture).
2. **Second bottleneck:** Workflow execution timeouts on Vercel. If Touch 4 workflows exceed 300s, move agent to a persistent host.

---

## Suggested Build Order

Dependencies dictate this sequence. Each phase produces a testable, deployable artifact.

```
Phase 1: Database Migration (no auth dependency, no deployment dependency)
  ├── Create Supabase project (dev instance)
  ├── Modify schema.prisma: provider -> postgresql, add directUrl
  ├── Generate fresh Postgres migration baseline
  ├── Update apps/agent/src/env.ts with new env vars
  ├── Replace LibSQLStore with PostgresStore in mastra/index.ts
  ├── Test: pnpm turbo build (verify Prisma generates for Postgres)
  ├── Test: Run agent locally against Supabase dev instance
  └── Verify: All existing workflows work with Postgres backend

Phase 2: Service-to-Service Auth (depends on Phase 1)
  ├── Add AGENT_API_KEY env var to both apps
  ├── Add API key validation to agent Hono routes
  ├── Modify api-client.ts to send X-API-Key header
  ├── Test: Agent rejects requests without valid API key
  └── Test: Web app can still call agent with API key

Phase 3: Google OAuth + Login Wall (independent of Phases 1-2, can parallel)
  ├── Configure Google OAuth in Supabase Dashboard
  ├── Configure OAuth consent screen as "Internal" in Google Cloud Console
  ├── Install @supabase/ssr in apps/web
  ├── Create lib/supabase/ client factories (client.ts, server.ts, middleware.ts)
  ├── Create middleware.ts with auth gate
  ├── Create /auth/login page and /auth/callback route
  ├── Modify layout.tsx to show user info in nav
  ├── Add domain verification in callback
  ├── Test: Login flow works, non-@lumenalta.com users rejected
  └── Test: All existing pages accessible after login

Phase 4: Vercel Deployment (depends on Phases 1, 2, 3)
  ├── Create Vercel project for web (Root Directory: apps/web)
  ├── Create Vercel project for agent (Root Directory: apps/agent)
  ├── Configure environment variables in both projects
  ├── Create Supabase prod instance (separate from dev)
  ├── Run prisma migrate deploy against prod Supabase
  ├── Deploy both projects
  ├── Test: End-to-end flow on production URLs
  ├── Verify: Preview environments work (preview-specific AGENT_SERVICE_URL)
  └── Verify: Google OAuth redirects work with production URLs
```

**Phase ordering rationale:**
- Phase 1 (DB) is foundational -- everything else depends on Postgres being the data layer
- Phase 2 (API key) is small and blocks deployment (cannot deploy without service auth)
- Phase 3 (OAuth) can run in parallel with Phase 2 since auth is web-only
- Phase 4 (deployment) requires all three preceding phases to be complete and tested

**Research flags:**
- Phase 1: Verify `@mastra/pg` or equivalent package exists on npmjs.com. If not, fall back to Turso.
- Phase 4: Verify `mastra build` output is Vercel-compatible. If not, deploy agent to Railway instead.

---

## Preview Environment Strategy

For Vercel preview deployments (one per PR), the web app needs to know the agent's preview URL:

**Option A (Simple):** Use a shared staging agent URL for all preview deployments. Web previews always point to a fixed staging agent.

**Option B (Full isolation):** Each PR deploys both web and agent previews. The web preview's `AGENT_SERVICE_URL` is set dynamically via Vercel's `VERCEL_URL` environment variable on the agent project. This requires a deployment hook or manual URL setting.

**Recommendation:** Option A for v1.1 (simpler). Full preview isolation is a v1.2 enhancement.

---

## Environment Variable Summary

### apps/web

| Variable | Required | Scope | Source |
|----------|----------|-------|--------|
| `AGENT_SERVICE_URL` | Yes | Server | Vercel project env var |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | Supabase Dashboard -> Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase Dashboard -> Settings -> API |
| `AGENT_API_KEY` | Yes | Server | Generate shared secret, set in both projects |
| `NODE_ENV` | Auto | Server | Set by Vercel |

### apps/agent

| Variable | Required | Scope | Source |
|----------|----------|-------|--------|
| `DATABASE_URL` | Yes | Server | Supabase connection string (pooled, port 6543) |
| `DIRECT_DATABASE_URL` | Yes (migrations) | Server | Supabase connection string (direct, port 5432) |
| `AGENT_API_KEY` | Yes | Server | Same shared secret as web project |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Yes | Server | Unchanged from v1.0 |
| `GOOGLE_DRIVE_FOLDER_ID` | Yes | Server | Unchanged |
| `GOOGLE_TEMPLATE_PRESENTATION_ID` | Yes | Server | Unchanged |
| `MEET_LUMENALTA_PRESENTATION_ID` | Optional | Server | Unchanged |
| `CAPABILITY_DECK_PRESENTATION_ID` | Optional | Server | Unchanged |
| `GOOGLE_CLOUD_PROJECT` | Yes | Server | Unchanged |
| `GOOGLE_CLOUD_LOCATION` | Yes | Server | Unchanged |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | Server | **PITFALL:** File path does not work on Vercel. Must use inline JSON or Workload Identity Federation. |
| `MASTRA_PORT` | No | Server | Only for local dev; Vercel assigns port automatically |

---

## Sources

- Existing codebase analysis: `apps/agent/prisma/schema.prisma`, `apps/agent/src/mastra/index.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/src/env.ts`, `apps/agent/src/env.ts` -- HIGH confidence (direct code reading)
- Prisma documentation: PostgreSQL provider, `directUrl` for Supabase -- HIGH confidence (well-documented, stable feature)
- Supabase Auth: Google OAuth provider, domain restriction patterns -- HIGH confidence (core Supabase feature)
- `@supabase/ssr`: Next.js App Router integration patterns -- MEDIUM confidence (API was evolving through 2025; verify current package API)
- Mastra AI: Storage backends, deployment patterns -- MEDIUM confidence (training data; verify `@mastra/pg` package existence)
- Vercel: Monorepo deployment, serverless function limits -- HIGH confidence (well-documented platform)
- Next.js middleware: Edge runtime auth patterns -- HIGH confidence (stable since Next.js 13)

---

*Architecture research for: v1.1 Infrastructure & Access Control -- Supabase migration, Vercel deployment, Google OAuth*
*Researched: 2026-03-04*
