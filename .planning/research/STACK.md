# Stack Research: v1.1 Infrastructure & Access Control

**Domain:** Database migration (SQLite to Supabase/Postgres), Vercel deployment, Google OAuth login wall
**Researched:** 2026-03-04
**Confidence:** MEDIUM (WebSearch/WebFetch unavailable; all findings from training data with cutoff May 2025; versions flagged where verification is needed)

---

## Research Note

External network tools (WebSearch, WebFetch) were unavailable during this research session. All findings are drawn from training data (cutoff May 2025) and analysis of the existing codebase. This research covers ONLY what is needed for v1.1 -- it does not re-research the existing v1.0 stack (Mastra, Next.js, Prisma, Google Workspace APIs, etc.).

**Scope of changes:**
1. Prisma provider switch: `sqlite` to `postgresql` (Supabase connection)
2. Supabase Auth with Google OAuth (domain-restricted to `@lumenalta.com`)
3. Vercel deployment: 2 projects from a single Turborepo monorepo
4. Service-to-service API key auth between `apps/web` and `apps/agent`
5. Mastra internal storage migration from local LibSQL to a durable store

---

## Recommended Stack Additions

### 1. Database: Supabase (PostgreSQL)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase (hosted) | Latest | Managed PostgreSQL with built-in Auth, dashboard, and connection pooling | Zero-ops Postgres; free tier covers dev; Auth module eliminates building login from scratch; pgbouncer connection pooling handles serverless cold-starts on Vercel |
| `@supabase/supabase-js` | `^2.45` [VERIFY] | Client SDK for Supabase Auth, Realtime, and direct DB access (NOT used for app queries -- Prisma handles those) | Required for Supabase Auth flows (signIn, signOut, getSession). Do NOT use for data queries -- keep Prisma as the single ORM | MEDIUM |
| `@supabase/ssr` | `^0.5` [VERIFY] | Server-side auth helpers for Next.js App Router | Creates Supabase clients that work in Server Components, Route Handlers, Middleware, and Server Actions. Replaces the deprecated `@supabase/auth-helpers-nextjs` | MEDIUM |

**Key decision: Prisma stays as the ORM.** Supabase provides the Postgres database and Auth service, but all application data queries continue through Prisma. The `@supabase/supabase-js` client is used ONLY for authentication (signIn, signOut, getSession, onAuthStateChange). This avoids a dual-query-layer and keeps all existing Prisma code unchanged.

### 2. Authentication: Supabase Auth + Google OAuth

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Supabase Auth (built-in) | N/A (managed service) | Google OAuth provider, session management, JWT issuance | No custom auth server needed; Google OAuth is a first-class provider in Supabase dashboard; JWT tokens enable stateless session validation | HIGH |
| `@supabase/ssr` | `^0.5` [VERIFY] | Next.js middleware for session refresh and route protection | Handles cookie-based session storage compatible with Server Components; refreshes tokens transparently in middleware before page render | MEDIUM |

**Domain restriction (`@lumenalta.com`):** Supabase Auth does NOT have a built-in "restrict to email domain" setting in the dashboard. Two approaches:

1. **Google Workspace restriction (RECOMMENDED):** Configure the Google Cloud OAuth consent screen as "Internal" (if Lumenalta has Google Workspace). This restricts login at the Google level -- only `@lumenalta.com` accounts can authenticate. No application-level filtering needed.

2. **Application-level check (FALLBACK):** If the OAuth consent screen must be "External" (e.g., testing with non-Workspace accounts during dev), add a check in the auth callback or middleware:
   ```typescript
   // In auth callback route handler
   const { data: { user } } = await supabase.auth.getUser();
   if (user?.email && !user.email.endsWith('@lumenalta.com')) {
     await supabase.auth.signOut();
     redirect('/login?error=unauthorized_domain');
   }
   ```
   Additionally, use a Supabase Database Function/hook or RLS policy to prevent row creation for non-lumenalta emails.

### 3. Prisma Provider Migration: SQLite to PostgreSQL

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `prisma` | `^6.3` (already installed) | Schema definition, migration generation, client generation | Already in use; changing `provider` from `"sqlite"` to `"postgresql"` and updating connection string is the only schema-level change | HIGH |
| `@prisma/client` | `^6.3` (already installed) | Generated type-safe query client | No version change needed; regenerating the client with `prisma generate` after provider switch produces Postgres-compatible queries | HIGH |

**Schema migration changes required:**

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // Required for Supabase -- bypasses pgbouncer for migrations
}
```

**SQLite to PostgreSQL differences affecting this schema:**

| SQLite Pattern | PostgreSQL Equivalent | Affected Models |
|----------------|----------------------|-----------------|
| `String` for JSON blobs | `Json` native type (or keep as `String`) | WorkflowJob.payload, WorkflowJob.result, InteractionRecord.inputs, FeedbackSignal.content, Brief.useCases, etc. |
| `@default(cuid())` | `@default(cuid())` -- unchanged | All models (cuid works the same) |
| `DateTime @default(now())` | `DateTime @default(now())` -- unchanged | All models |
| `@@unique` constraints | Work identically | Company.name |
| No native arrays | `String[]` available but not required | Could upgrade Brief.secondaryPillars from JSON string to `String[]`, but not required for migration |

**IMPORTANT: Do NOT change JSON string fields to `Json` type during the migration.** The existing code serializes/deserializes JSON manually with `JSON.stringify`/`JSON.parse`. Changing to Prisma's `Json` type would require updating every read/write site. Keep fields as `String` for now; optimize to `Json` type in a future milestone if desired.

**Migration strategy (forward-only, per CLAUDE.md rules):**
1. Change provider to `postgresql` in schema.prisma
2. Set `DATABASE_URL` to Supabase connection string (pooled, port 6543)
3. Set `DIRECT_URL` to Supabase direct connection string (port 5432)
4. Run `prisma migrate dev --name switch-to-postgresql` to generate initial migration
5. Since this is a fresh Supabase database, the migration will create all tables from scratch
6. Run seed script to populate demo data (Meridian Capital Group fixture)

### 4. Vercel Deployment: 2 Projects from Turborepo Monorepo

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vercel Platform | N/A | Hosting for both `apps/web` (Next.js) and `apps/agent` (Mastra/Hono) | Native Turborepo support; automatic preview deployments per PR; environment variable management with prod/preview scoping | HIGH |
| `@hono/node-server` | `^1.13` [VERIFY] | Node.js HTTP adapter for Hono (used by Mastra) | Mastra builds to a Hono server; this adapter runs Hono on Node.js in Vercel's Serverless/Edge runtime | MEDIUM |

**Two Vercel projects, one Git repo:**

Vercel natively supports multiple projects from a single monorepo. Each project points to a different root directory:

| Vercel Project | Root Directory | Framework | Build Command | Output |
|----------------|---------------|-----------|---------------|--------|
| `lumenalta-web` | `apps/web` | Next.js | `cd ../.. && pnpm turbo run build --filter=web` | `.next/` |
| `lumenalta-agent` | `apps/agent` | Other (Node.js) | `cd ../.. && pnpm turbo run build --filter=agent` | `.mastra/output/` |

**Critical: Vercel project configuration**

For each project in the Vercel dashboard:
- **Root Directory:** Set to `apps/web` or `apps/agent`
- **Build Command:** Override to use Turborepo from the monorepo root (Vercel auto-detects Turborepo and handles this, but verify)
- **Install Command:** `pnpm install` (Vercel detects pnpm from `packageManager` field in root `package.json`)
- **Node.js Version:** Set to 20.x in project settings

**Environment variables per project:**

| Variable | `lumenalta-web` | `lumenalta-agent` | Scope |
|----------|-----------------|-------------------|-------|
| `AGENT_SERVICE_URL` | Yes (points to agent URL) | No | prod + preview |
| `AGENT_API_KEY` | Yes | Yes (must match) | prod + preview |
| `DATABASE_URL` | No | Yes (Supabase pooled) | prod + preview |
| `DIRECT_URL` | No | Yes (Supabase direct) | prod only (migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No | prod + preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | No | prod + preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (for server-side auth) | No | prod + preview |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | No | Yes | prod + preview |
| `GOOGLE_DRIVE_FOLDER_ID` | No | Yes | prod + preview |
| `GOOGLE_TEMPLATE_PRESENTATION_ID` | No | Yes | prod + preview |
| `GOOGLE_CLOUD_PROJECT` | No | Yes | prod + preview |
| `GOOGLE_CLOUD_LOCATION` | No | Yes | prod + preview |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Yes (base64 encoded on Vercel) | prod + preview |

**Preview vs Production environments:**
- Use Supabase's dev instance for Vercel preview deployments (linked to PR branches)
- Use Supabase's prod instance for the production deployment
- Vercel supports scoping env vars to "Production", "Preview", and "Development" independently

### 5. Agent Server Deployment on Vercel

**Problem:** Mastra builds to a standalone Hono server (`mastra build` produces `.mastra/output/`). This is NOT a Next.js app and does not use Vercel's native Next.js adapter.

**Two deployment options for the agent:**

**Option A: Vercel Serverless Functions (RECOMMENDED for this project)**

Mastra 1.8+ supports deployment to Vercel serverless functions. The `mastra build` command can output a Vercel-compatible serverless function format.

Key considerations:
- Vercel serverless functions have a 60-second timeout on Pro plan (10s on Hobby)
- Mastra workflows (touch-1 through touch-4) can run 30-120 seconds for full deck generation
- Suspend/resume pattern already in use -- workflows can be split across function invocations
- The `/api/workflows/*/start` endpoint kicks off and returns immediately; status is polled

If Mastra's Vercel adapter handles this natively, use it. Check `mastra deploy` docs.

**Option B: Separate hosting (Railway/Fly.io)**

If Mastra requires a long-running Node.js process (persistent WebSocket connections, in-memory state):
- Deploy to Railway or Fly.io as a Docker container
- This adds infrastructure but removes serverless timeout concerns
- `AGENT_SERVICE_URL` would point to the Railway/Fly.io URL instead of a Vercel URL

**Recommendation:** Start with Option A (Vercel). Mastra's suspend/resume pattern means workflows do NOT need a persistent process. Each API call is stateless -- workflow state is persisted in the LibSQL/Postgres store. If timeouts become an issue, fall back to Option B.

### 6. Mastra Storage Migration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@mastra/pg` | `^1.0` [VERIFY package name] | PostgreSQL storage adapter for Mastra's internal state | Replaces `@mastra/libsql` with file:// URL; Mastra's workflow snapshots, suspend/resume state, and step outputs need a durable store accessible from Vercel's serverless environment | LOW -- verify package exists |

**Current state:**
```typescript
storage: new LibSQLStore({
  id: "mastra-store",
  url: "file:./prisma/mastra.db",  // Local SQLite file -- won't work on Vercel
})
```

**Required change:** Mastra's internal storage must move to a network-accessible database. Options:

1. **Supabase Postgres (same instance):** Use a separate schema or table prefix for Mastra's internal tables. Mastra likely supports a Postgres connection URL directly.
2. **Turso (LibSQL cloud):** `@mastra/libsql` already in use; switch from `file://` to a Turso cloud URL. Free tier available.
3. **Upstash Redis:** If Mastra supports Redis storage adapters.

**Recommendation:** Use the same Supabase Postgres instance with a dedicated `mastra` schema. This avoids adding another service. Verify that `@mastra/libsql` can accept a Turso URL as an alternative if Mastra does not ship a native Postgres adapter.

```typescript
// Target configuration (verify adapter package name)
storage: new PostgresStore({
  connectionString: env.DATABASE_URL,
  schemaName: "mastra",  // Separate from app tables
})
```

### 7. Service-to-Service Authentication (Web to Agent)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Shared API key (env var) | N/A | Authenticate requests from `apps/web` to `apps/agent` | Simplest effective pattern for two first-party services; no OAuth complexity needed for server-to-server | HIGH |

**Implementation pattern:**

The existing `api-client.ts` in `apps/web` already centralizes all fetch calls to the agent. Adding an API key header requires ONE change:

```typescript
// apps/web/src/lib/api-client.ts
async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.AGENT_API_KEY,  // Add this line
      ...init?.headers,
    },
  });
  // ...
}
```

**Agent-side middleware (Hono):**

Mastra's Hono server supports middleware. Add an API key check:

```typescript
// apps/agent/src/middleware/api-key.ts
import { createMiddleware } from "hono/factory";

export const apiKeyAuth = createMiddleware(async (c, next) => {
  // Skip auth for health checks
  if (c.req.path === "/health") return next();

  const apiKey = c.req.header("X-API-Key");
  if (!apiKey || apiKey !== process.env.AGENT_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
```

**Where to apply:** Mastra's `server.middleware` configuration option (verify exact API). The middleware must wrap all `apiRoutes` registered in `mastra/index.ts`.

**Key generation:** Use `openssl rand -base64 32` to generate a cryptographically random API key. Store identical values in both Vercel projects' environment variables.

---

## Supporting Libraries (NEW additions only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `^2.45` [VERIFY] | Supabase client for Auth operations | ONLY in `apps/web` for login/logout/session. NOT for data queries (use Prisma) |
| `@supabase/ssr` | `^0.5` [VERIFY] | Server-side Supabase client creation for Next.js | In middleware.ts, Server Components, and Route Handlers that need auth context |
| `@mastra/pg` or equivalent | `^1.0` [VERIFY] | Mastra Postgres storage adapter | In `apps/agent/src/mastra/index.ts` to replace LibSQLStore |

---

## Installation

```bash
# In apps/web -- Supabase Auth client
pnpm add @supabase/supabase-js @supabase/ssr

# In apps/agent -- no new packages needed for Prisma switch
# Prisma is already installed; just change the provider and connection string

# For Mastra Postgres storage (verify package name first)
pnpm add @mastra/pg  # [VERIFY] -- may be @mastra/postgres or configuration-only
```

---

## Integration Points with Existing Code

### Prisma Schema (apps/agent/prisma/schema.prisma)

**Before:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**After:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

No model changes required. All existing models are compatible with PostgreSQL as-is.

### Environment Configuration (apps/agent/src/env.ts)

Add new env vars:
```typescript
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),    // Now a postgres:// URL
    DIRECT_URL: z.string().min(1),       // NEW: Direct Supabase connection
    AGENT_API_KEY: z.string().min(32),   // NEW: Service-to-service auth
    // ... existing vars unchanged
  },
  runtimeEnv: process.env,
});
```

### Environment Configuration (apps/web/src/env.ts)

Add new env vars:
```typescript
export const env = createEnv({
  server: {
    AGENT_SERVICE_URL: z.string().url(),
    AGENT_API_KEY: z.string().min(32),           // NEW
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), // NEW: Server-side auth checks
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),   // NEW
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1), // NEW
  },
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    AGENT_API_KEY: process.env.AGENT_API_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

### Next.js Middleware (NEW file: apps/web/middleware.ts)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login") &&
      !request.nextUrl.pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

### Supabase Client Utilities (NEW files in apps/web)

```typescript
// apps/web/src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
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

// apps/web/src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

### Auth Callback Route (NEW: apps/web/src/app/auth/callback/route.ts)

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Domain restriction check
      if (!data.user.email?.endsWith("@lumenalta.com")) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=unauthorized_domain`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
```

### Turbo Configuration (turbo.json)

No changes needed. The existing `turbo.json` already supports the monorepo build pipeline. Vercel's Turborepo integration uses this configuration automatically.

However, environment variables should be declared for cache invalidation:

```json
{
  "globalEnv": [
    "DATABASE_URL",
    "DIRECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]
}
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Supabase Auth (Google OAuth) | NextAuth.js v5 / Auth.js | NextAuth adds another abstraction layer over OAuth; Supabase Auth is already included with the Supabase database -- using it avoids managing sessions separately from the DB provider; fewer moving parts |
| Supabase Auth | Clerk | Clerk is excellent but adds a paid dependency and another vendor; Supabase Auth is free and co-located with the database |
| Supabase Auth | Firebase Auth | Firebase would require a separate Firebase project; Supabase already provides the database, so Auth is zero-marginal-cost |
| Supabase Postgres | Neon Postgres | Neon is excellent but does not include built-in Auth; using Supabase gets both DB and Auth from one provider |
| Supabase Postgres | PlanetScale (MySQL) | PlanetScale is MySQL-only; Prisma would need more schema changes; PostgreSQL is a more natural upgrade from SQLite |
| API key auth (service-to-service) | JWT/OAuth2 between services | Overkill for two first-party services in the same monorepo; API key is simpler, equally secure over HTTPS, and requires no token refresh logic |
| API key auth | Vercel internal networking | Vercel does not provide private networking between serverless functions across projects; public HTTPS with API key is the standard pattern |
| Vercel for agent | Railway / Fly.io | Adds another hosting provider; Vercel can host the agent as serverless functions; only fall back if timeout limits are hit |
| Prisma (keep) | Drizzle ORM | Switching ORMs during a migration milestone adds unnecessary risk; Prisma is already integrated with 10+ models and extensive query code |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/auth-helpers-nextjs` | Deprecated in favor of `@supabase/ssr`; the auth-helpers package is no longer maintained | `@supabase/ssr` |
| Supabase JS client for data queries | Creates a dual-query-layer alongside Prisma; confusing, harder to maintain, and Prisma is already deeply integrated | Prisma for all data queries; Supabase JS only for Auth |
| `prisma db push` | Explicitly forbidden by CLAUDE.md project rules; all schema changes must go through `prisma migrate dev` | `prisma migrate dev --name <descriptive-name>` |
| `prisma migrate reset` | Explicitly forbidden by CLAUDE.md; treat dev DB as production | Forward-only migrations; use `prisma migrate resolve --applied` if history drifts |
| Supabase Edge Functions | Would compete with Mastra's workflow engine for business logic; creates confusion about where logic lives | Keep all business logic in Mastra workflows; Supabase is only for DB + Auth |
| Supabase Realtime | Adds complexity; the existing polling pattern for workflow status works well enough; realtime can be added later | Keep existing polling pattern in `api-client.ts` |
| Supabase Storage | Google Drive is the file storage system (per project constraints); adding another storage layer creates confusion | Google Drive via service account (already working) |
| Row Level Security (RLS) on Supabase | RLS is for multi-tenant apps where users query the DB directly via Supabase client; since Prisma handles all queries server-side, RLS adds complexity without benefit | Server-side auth checks in middleware + API key for agent |
| `next-auth` / `auth.js` | Adds a third auth layer alongside Supabase Auth; unnecessary and creates session management conflicts | Supabase Auth via `@supabase/ssr` |

---

## Stack Patterns by Variant

**If Mastra does not have a native Postgres storage adapter:**
- Use `@mastra/libsql` with a Turso cloud URL instead of `file://`
- Turso provides a free tier with a hosted LibSQL database
- Change: `url: "file:./prisma/mastra.db"` to `url: env.MASTRA_STORAGE_URL` (a `libsql://` URL)
- This is the lowest-risk change since the adapter code stays the same

**If Vercel serverless function timeouts are too short for Mastra workflows:**
- Deploy `apps/agent` to Railway instead of Vercel
- Railway supports long-running Node.js processes and WebSocket connections
- The `AGENT_SERVICE_URL` env var in `apps/web` would point to the Railway URL
- API key auth works identically regardless of hosting

**If Google Workspace OAuth consent screen cannot be set to "Internal":**
- Implement domain restriction at the application level (see section 2 above)
- Add a Supabase Database Webhook or Postgres trigger to block non-lumenalta sign-ups at the database level
- Consider adding the domain check in BOTH the auth callback AND the middleware for defense-in-depth

**If dev and prod need different Supabase instances:**
- Create two Supabase projects: `lumenalta-dev` and `lumenalta-prod`
- In Vercel, scope `DATABASE_URL` and Supabase keys to "Preview" vs "Production" environments
- Run `prisma migrate deploy` against prod (not `prisma migrate dev`) -- migrations are generated in dev and applied in prod

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@supabase/supabase-js@^2` | `@supabase/ssr@^0.5` | These must be the same major generation; v2 client with v0.x SSR helpers |
| `@supabase/ssr@^0.5` | Next.js 15 App Router | SSR helpers explicitly support App Router's `cookies()` API from `next/headers` |
| Prisma `^6.3` | PostgreSQL 15/16 (Supabase default) | Prisma 6 fully supports PG 15+; Supabase provisions PG 15 by default |
| Prisma `^6.3` | Supabase connection pooling (pgbouncer) | Use `?pgbouncer=true` in the pooled connection string; use `directUrl` for migrations |
| `@t3-oss/env-nextjs@^0.13` | Zod v4 | Already in use; `createEnv` works with both Zod v3 and v4 |
| Turborepo `^2.3` | Vercel deployment | Vercel auto-detects Turborepo and runs builds with Remote Caching |
| pnpm `9.12` | Vercel | Vercel supports pnpm natively; detects from `packageManager` field in root `package.json` |

---

## Connection String Formats

```bash
# Supabase pooled connection (for app runtime -- port 6543)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase direct connection (for migrations -- port 5432)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Supabase Auth configuration
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."  # Public anon key (safe for client-side)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."      # Server-only; never expose to client

# Service-to-service
AGENT_API_KEY="[openssl rand -base64 32 output]"
AGENT_SERVICE_URL="https://lumenalta-agent.vercel.app"  # Production agent URL
```

---

## Supabase Setup Checklist

1. Create Supabase project (free tier is sufficient for dev)
2. Enable Google OAuth provider in Authentication > Providers
3. Configure Google Cloud OAuth consent screen:
   - Set to "Internal" (Lumenalta Workspace restriction)
   - Add authorized redirect URI: `https://[project-ref].supabase.co/auth/v1/callback`
4. Copy Google OAuth Client ID and Secret into Supabase dashboard
5. Copy connection strings from Settings > Database
6. Set `NEXT_PUBLIC_SUPABASE_URL` and keys in Vercel env vars
7. Run Prisma migrations against the new database

---

## Sources

- Training data (cutoff May 2025) -- Supabase Auth with Next.js App Router patterns, `@supabase/ssr` usage
- Training data -- Prisma PostgreSQL provider documentation, connection pooling with pgbouncer
- Training data -- Vercel Turborepo monorepo deployment patterns
- Training data -- Hono middleware patterns for API key authentication
- Codebase analysis -- `apps/agent/src/mastra/index.ts`, `apps/web/src/lib/api-client.ts`, `prisma/schema.prisma`
- Codebase analysis -- existing env.ts configurations in both apps

**Items requiring verification before implementation:**
1. `@supabase/ssr` current version -- check npmjs.com (training data says ^0.5, may be higher now)
2. `@supabase/supabase-js` current version -- check npmjs.com (may be v2.46+ or v3.x by March 2026)
3. Mastra Postgres storage adapter -- check mastra.ai docs for `@mastra/pg` or equivalent; fallback to Turso/LibSQL cloud
4. Mastra Vercel deployment support -- check if `mastra deploy` or `mastra build --target vercel` exists
5. Supabase direct connection string format -- verify in Supabase dashboard (port and URL format may vary by region)

---

*Stack research for: v1.1 Infrastructure & Access Control (Supabase + Vercel + Google OAuth)*
*Researched: 2026-03-04*
