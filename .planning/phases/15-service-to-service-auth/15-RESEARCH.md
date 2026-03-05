# Phase 15: Service-to-Service Auth - Research

**Researched:** 2026-03-05
**Domain:** API key authentication between Next.js web app and Mastra/Hono agent server
**Confidence:** HIGH

## Summary

Phase 15 requires adding shared API key authentication between the web app (Next.js) and the agent server (Mastra/Hono). The agent server must reject all requests without a valid `X-API-Key` header with a 401 response, and the web app must include this header on every outbound request.

Mastra v1.8.0 (the installed version) provides a built-in `SimpleAuth` class in `@mastra/core/server` that supports exactly this pattern: token-to-user mapping with configurable header names. This is the recommended approach over raw Hono middleware because it integrates with Mastra's route system, respects `requiresAuth: false` on individual routes, and handles the `/api/*` built-in routes (workflows, etc.) automatically. The `headers` option accepts custom header names like `X-API-Key`, and the `public` option allows exempting the health check endpoint.

On the web side, there are exactly two injection points: the `fetchJSON` wrapper function (handles all JSON requests) and the `uploadTouch1Override` function (uses raw `fetch` for FormData). Both are in `apps/web/src/lib/api-client.ts`. The API key is a server-side env var (`AGENT_API_KEY`) that never reaches the browser because all web-to-agent traffic flows through Next.js server actions.

**Primary recommendation:** Use Mastra's built-in `SimpleAuth` with `headers: ['X-API-Key']` for agent-side auth, add `AGENT_API_KEY` to both apps' env schemas via `@t3-oss/env`, and inject the header in `fetchJSON` and `uploadTouch1Override`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Health check endpoint is public (no API key required) -- for monitoring in Phase 17 deployment
- Returns simple `{ "status": "ok" }` -- no version, uptime, or internal diagnostics exposed
- All other endpoints require valid API key
- Mastra built-in routes (playground, API docs) open in development, blocked in production (NODE_ENV-gated)
- Generic error toast on the web side when auth fails -- "Something went wrong. Please try again."
- No dedicated error page for auth failures
- Existing `fetchJSON` error handling in api-client.ts already handles non-200 responses with error messages
- Separate API keys per environment (dev, preview, production) -- prevents cross-env calls
- `X-API-Key` header -- matches roadmap success criteria, avoids conflict with Phase 16 Authorization headers
- Placeholder dev key in `.env.example` for frictionless local setup -- real keys only in deployed environments

### Claude's Discretion
- Health check endpoint path (e.g., /health vs /api/health)
- API key generation format (hex, UUID, etc.)
- 401 response body detail level (minimal vs descriptive)
- Console warn logging on failed auth attempts
- Exact Hono middleware implementation pattern
- How to handle the direct `fetch` call in `uploadTouch1Override` (separate from `fetchJSON`)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-06 | Agent server rejects requests without valid API key with 401 response | Mastra `SimpleAuth` validates `X-API-Key` header against configured tokens; returns 401 when missing/invalid. Health check route uses `requiresAuth: false` to bypass. |
| AUTH-07 | Web app sends API key header on all requests to agent server | `AGENT_API_KEY` added to web env schema; injected in `fetchJSON` headers and `uploadTouch1Override` fetch call in `api-client.ts`. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mastra/core` | 1.8.0 | `SimpleAuth` class for API key validation | Already installed; built-in auth that integrates with Mastra route system and `requiresAuth` flag |
| `@t3-oss/env-core` | 0.13.10 | Agent-side env var validation (AGENT_API_KEY) | Already used in `apps/agent/src/env.ts` for all env vars |
| `@t3-oss/env-nextjs` | 0.13.10 | Web-side env var validation (AGENT_API_KEY) | Already used in `apps/web/src/env.ts` for AGENT_SERVICE_URL |
| `zod` | 4.3.6 | Schema validation for env vars | Already a dependency in both apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hono` | (bundled with Mastra) | Underlying HTTP framework -- Context type used in middleware | Already present via Mastra; no separate install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SimpleAuth` | Raw Hono middleware via `server.middleware` | SimpleAuth integrates with Mastra's `requiresAuth` per-route flag and handles built-in `/api/*` routes automatically. Raw middleware requires manual path matching. |
| `SimpleAuth` | `MastraAuthConfig` (object-style) via `server.auth` | Works but `SimpleAuth` class is cleaner for static token auth and supports custom headers natively. |
| `X-API-Key` header | `Authorization: Bearer` header | `X-API-Key` avoids collision with Phase 16 Supabase Auth which will use `Authorization` header. Locked decision. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
apps/agent/src/
├── env.ts                    # Add AGENT_API_KEY to Zod schema
├── mastra/
│   └── index.ts              # Add SimpleAuth to server.auth + health check route
apps/web/src/
├── env.ts                    # Add AGENT_API_KEY to server schema
├── lib/
│   └── api-client.ts         # Inject X-API-Key header in fetchJSON + uploadTouch1Override
.env.example (both apps)      # Add AGENT_API_KEY placeholder
```

### Pattern 1: SimpleAuth with Custom Header
**What:** Use Mastra's `SimpleAuth` class to validate API keys sent via `X-API-Key` header
**When to use:** When you need static token auth with Mastra's built-in route system integration
**Example:**
```typescript
// Source: @mastra/core v1.8.0 SimpleAuth implementation (verified from source)
import { SimpleAuth } from "@mastra/core/server";
import { env } from "../env";

const auth = new SimpleAuth({
  headers: ["X-API-Key"],
  tokens: {
    [env.AGENT_API_KEY]: { id: "web-app", role: "service" },
  },
  public: ["/health"],
});

export const mastra = new Mastra({
  // ... existing config ...
  server: {
    // ... existing server config ...
    auth,
  },
});
```

**How SimpleAuth works internally (verified from source code):**
1. `SimpleAuth` extends `MastraAuthProvider`
2. Constructor accepts `headers` option -- defaults to `["Authorization", "X-Playground-Access"]`, custom headers are **appended** to defaults
3. `authenticateToken()` reads all configured headers, strips `Bearer ` prefix, and looks up the token in the `tokens` map
4. `public` paths bypass authentication entirely
5. Routes with `requiresAuth: false` also bypass authentication
6. All other routes (custom `apiRoutes` + built-in `/api/*` routes) require valid token

### Pattern 2: Health Check Endpoint
**What:** Public endpoint that returns server status without requiring auth
**When to use:** For uptime monitoring, load balancer health probes, Phase 17 deployment monitoring
**Example:**
```typescript
// Source: Mastra registerApiRoute with requiresAuth: false (verified from type definitions)
registerApiRoute("/health", {
  method: "GET",
  requiresAuth: false,
  handler: async (c) => {
    return c.json({ status: "ok" });
  },
}),
```

### Pattern 3: Web-Side Header Injection
**What:** Add `X-API-Key` header to all outbound requests from web to agent
**When to use:** In the centralized `fetchJSON` wrapper and the `uploadTouch1Override` direct fetch
**Example:**
```typescript
// Source: Existing api-client.ts pattern extended with auth header
import { env } from "@/env";

const BASE_URL = env.AGENT_SERVICE_URL;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.AGENT_API_KEY,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}
```

### Pattern 4: Environment Variable Schema Extension
**What:** Add `AGENT_API_KEY` to both apps' Zod-validated env schemas
**When to use:** Any new env var in this project must go through `@t3-oss/env`
**Example:**
```typescript
// Agent: apps/agent/src/env.ts -- add to server schema
AGENT_API_KEY: z.string().min(1),

// Web: apps/web/src/env.ts -- add to server schema
AGENT_API_KEY: z.string().min(1),

// Web: also add to runtimeEnv mapping
runtimeEnv: {
  AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
  AGENT_API_KEY: process.env.AGENT_API_KEY,
  NODE_ENV: process.env.NODE_ENV,
},
```

### Pattern 5: Production Gating for Mastra Dev Routes
**What:** Block Mastra playground and API docs in production while keeping them open in development
**When to use:** Locked decision from CONTEXT.md
**Example:**
```typescript
// SimpleAuth public paths, NODE_ENV-gated:
const publicPaths: (string | RegExp)[] = ["/health"];

if (env.NODE_ENV === "development") {
  // Mastra dev playground and swagger UI are served under /api/*
  // In development, they should remain accessible without auth
  // SimpleAuth's public option can include regex patterns
  publicPaths.push(/^\/api\//);
}

const auth = new SimpleAuth({
  headers: ["X-API-Key"],
  tokens: { [env.AGENT_API_KEY]: { id: "web-app", role: "service" } },
  public: publicPaths,
});
```

### Anti-Patterns to Avoid
- **Hardcoded API keys in source code:** Always read from environment variables validated by `@t3-oss/env`
- **Using `Authorization` header for service auth:** Phase 16 will use this for Supabase user auth -- `X-API-Key` prevents collision
- **Raw Hono middleware bypassing Mastra auth system:** Loses integration with `requiresAuth: false` on routes and may not cover built-in `/api/*` workflow routes
- **Client-side API key exposure:** `AGENT_API_KEY` must be a `server` env var in the web app (not `client`), ensuring it only runs in server actions / API routes

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key validation middleware | Custom Hono middleware with manual path matching | `SimpleAuth` from `@mastra/core/server` | Handles path matching, integrates with `requiresAuth`, covers built-in routes |
| Environment variable validation | Manual `process.env` checks | `@t3-oss/env-core` / `@t3-oss/env-nextjs` with Zod | Already the project standard; fails fast at startup with clear error messages |
| Timing-safe comparison | `===` string comparison for tokens | SimpleAuth's built-in token lookup (uses Map) | Simpler than implementing constant-time comparison; for internal service auth with long random keys, Map lookup is acceptable |

**Key insight:** Mastra already solved the "auth middleware for Hono" problem with `SimpleAuth`. Using it means auth works identically for custom routes AND built-in `/api/workflows/*` routes without additional configuration.

## Common Pitfalls

### Pitfall 1: Forgetting `uploadTouch1Override`
**What goes wrong:** Auth works for all `fetchJSON` calls but the Touch 1 file upload (which uses direct `fetch`) fails with 401
**Why it happens:** `uploadTouch1Override` (lines 371-390) bypasses `fetchJSON` because it needs to send `FormData` without JSON content-type
**How to avoid:** Add `X-API-Key` header directly to the `fetch` call in `uploadTouch1Override`
**Warning signs:** Touch 1 override upload fails while all other workflows succeed

### Pitfall 2: ENV Schema Validation Breaking Startup
**What goes wrong:** Adding `AGENT_API_KEY: z.string().min(1)` to the agent env schema causes the agent to crash on startup if the env var is missing
**Why it happens:** `@t3-oss/env` validates at import time -- if the `.env` file doesn't have `AGENT_API_KEY`, the process exits immediately
**How to avoid:** Add the env var to `.env` files BEFORE updating the schema. Update `.env.example` with placeholder. For dev, use a simple placeholder like `dev-api-key-change-me`.
**Warning signs:** Immediate crash on `mastra dev` with Zod validation error

### Pitfall 3: SimpleAuth `headers` Appends, Doesn't Replace
**What goes wrong:** Expecting only `X-API-Key` to work, but `Authorization` and `X-Playground-Access` also work
**Why it happens:** SimpleAuth constructor does `[...DEFAULT_HEADERS].concat(options.headers || [])` -- custom headers are added to defaults, not replacing them
**How to avoid:** This is actually desired behavior -- the Mastra playground sends `Authorization` header, so keeping defaults means the playground still works in dev mode. No action needed, just be aware.
**Warning signs:** None -- this is correct behavior

### Pitfall 4: Missing Web .env File
**What goes wrong:** Web app env validation fails because there's no `.env` file (currently the web app has no `.env`, only `.env.example`)
**Why it happens:** The web app currently has only `AGENT_SERVICE_URL` with a default value, so it works without a `.env` file. Adding `AGENT_API_KEY` without a default means it will fail.
**How to avoid:** Create `.env.local` for the web app or ensure `AGENT_API_KEY` is set in the environment. For Next.js, `.env.local` is the standard local override file.
**Warning signs:** Next.js build/dev fails with "Missing environment variable: AGENT_API_KEY"

### Pitfall 5: Built-in Mastra Routes Not Covered
**What goes wrong:** `/api/workflows/touch-1-workflow/start` and other Mastra built-in routes are not protected by auth
**Why it happens:** Using raw Hono middleware only covers custom routes, not Mastra's internally registered `/api/*` routes
**How to avoid:** Use `server.auth` (SimpleAuth) instead of `server.middleware` -- Mastra's auth system covers ALL routes including built-in ones
**Warning signs:** Curl to `/api/workflows/touch-1-workflow/start` without API key succeeds

## Code Examples

### Complete Agent-Side Auth Implementation
```typescript
// Source: Verified from @mastra/core v1.8.0 source code + type definitions
import { Mastra } from "@mastra/core";
import { registerApiRoute, SimpleAuth } from "@mastra/core/server";
import { env } from "../env";

// Build public paths list -- health always public, dev routes in development only
const publicPaths: (string | RegExp)[] = ["/health"];
if (env.NODE_ENV === "development") {
  publicPaths.push(/^\/api\//);
}

const auth = new SimpleAuth({
  headers: ["X-API-Key"],
  tokens: {
    [env.AGENT_API_KEY]: { id: "web-app", role: "service" },
  },
  public: publicPaths,
});

export const mastra = new Mastra({
  // ... existing storage, workflows config ...
  server: {
    port: parseInt(env.MASTRA_PORT, 10),
    auth,
    apiRoutes: [
      // Health check -- public, no auth required
      registerApiRoute("/health", {
        method: "GET",
        requiresAuth: false,
        handler: async (c) => {
          return c.json({ status: "ok" });
        },
      }),
      // ... all existing routes unchanged ...
    ],
  },
});
```

### Complete Web-Side Header Injection
```typescript
// Source: Existing api-client.ts with auth header added
import { env } from "@/env";

const BASE_URL = env.AGENT_SERVICE_URL;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.AGENT_API_KEY,
      ...init?.headers,
    },
  });
  // ... existing error handling unchanged ...
}

export async function uploadTouch1Override(
  dealId: string,
  file: File
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("dealId", dealId);

  const response = await fetch(`${BASE_URL}/touch-1/upload`, {
    method: "POST",
    headers: {
      "X-API-Key": env.AGENT_API_KEY,
    },
    body: formData,
  });
  // ... existing error handling unchanged ...
}
```

### Agent env.ts Addition
```typescript
// Add to apps/agent/src/env.ts server schema:
AGENT_API_KEY: z.string().min(1),
```

### Web env.ts Addition
```typescript
// Add to apps/web/src/env.ts:
// In server schema:
AGENT_API_KEY: z.string().min(1),
// In runtimeEnv:
AGENT_API_KEY: process.env.AGENT_API_KEY,
```

### .env.example Updates
```bash
# apps/agent/.env.example -- add:
AGENT_API_KEY=dev-api-key-change-me

# apps/web/.env.example -- add:
AGENT_API_KEY=dev-api-key-change-me
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw Hono middleware for auth | `SimpleAuth` / `MastraAuthProvider` via `server.auth` | Mastra v1.0 (Jan 2026) | Built-in auth covers all routes including `/api/*` workflow routes |
| `defineAuth()` config object | `SimpleAuth` class or custom `MastraAuthProvider` subclass | Mastra v1.0 | Class-based approach is cleaner, supports custom headers natively |
| Global middleware only | Per-route `requiresAuth: false` flag | Mastra v1.0 | Individual routes can opt out of auth cleanly |

**Deprecated/outdated:**
- `defineAuth()` function still exists but `SimpleAuth` class is the recommended approach for static token auth

## Open Questions

1. **SimpleAuth behavior with invalid `public` path format**
   - What we know: `public` accepts `(RegExp | string | [string, Methods | Methods[]])[]` per the type definitions
   - What's unclear: Whether `/health` string pattern matches the route exactly or as a prefix (i.e., does it also match `/health/foo`?)
   - Recommendation: Use exact string `/health` -- if prefix matching is an issue, use regex `^/health$` instead. Test during implementation.

2. **Mastra dev playground route paths**
   - What we know: Built-in routes are under `/api/*`. Playground is served by `mastra dev`.
   - What's unclear: The exact paths for playground UI vs API endpoints. The type definition restricts custom routes from starting with `/api/` because "it is reserved for internal API routes."
   - Recommendation: Use `publicPaths.push(/^\/api\//)` in development to exempt all built-in routes. This is safe because in production, only the web app calls the agent (and it sends the API key).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test framework configured in this project |
| Config file | none |
| Quick run command | Manual curl testing |
| Full suite command | Manual curl testing |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-06 | Agent rejects requests without valid API key | manual-only | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4111/companies` (expect 401) | N/A |
| AUTH-06 | Agent rejects requests with wrong API key | manual-only | `curl -s -o /dev/null -w "%{http_code}" -H "X-API-Key: wrong-key" http://localhost:4111/companies` (expect 401) | N/A |
| AUTH-06 | Health check is public (no key needed) | manual-only | `curl -s http://localhost:4111/health` (expect `{"status":"ok"}`) | N/A |
| AUTH-07 | Web app sends API key on fetchJSON calls | manual-only | Start both apps, trigger any workflow from UI, verify it succeeds | N/A |
| AUTH-07 | Web app sends API key on uploadTouch1Override | manual-only | Upload a Touch 1 override file, verify it succeeds | N/A |

**Justification for manual-only:** No test framework is configured in this project. The phase success criteria explicitly specify curl commands for verification. Adding a test framework is out of scope for this phase.

### Sampling Rate
- **Per task commit:** Manual curl commands from test map above
- **Per wave merge:** Full curl verification of all 5 scenarios
- **Phase gate:** All curl tests pass + existing workflows functional

### Wave 0 Gaps
None -- manual testing is the established pattern for this project. No test infrastructure to set up.

## Sources

### Primary (HIGH confidence)
- `@mastra/core@1.8.0` source code -- `dist/server/index.js` (SimpleAuth implementation, lines 101-138)
- `@mastra/core@1.8.0` type definitions -- `dist/server/types.d.ts` (ServerConfig.auth, Middleware types)
- `@mastra/core@1.8.0` type definitions -- `dist/server/simple-auth.d.ts` (SimpleAuthOptions interface)
- `@mastra/core@1.8.0` type definitions -- `dist/server/index.d.ts` (registerApiRoute, requiresAuth option)
- Existing source code -- `apps/agent/src/mastra/index.ts` (current Mastra config)
- Existing source code -- `apps/web/src/lib/api-client.ts` (fetchJSON, uploadTouch1Override)
- Existing source code -- `apps/agent/src/env.ts`, `apps/web/src/env.ts` (env validation patterns)

### Secondary (MEDIUM confidence)
- [Mastra SimpleAuth docs](https://mastra.ai/docs/server/auth/simple-auth) -- Usage patterns, constructor options
- [Mastra Custom API Routes docs](https://mastra.ai/docs/server/custom-api-routes) -- `requiresAuth: false` behavior

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed and used in the project; no new dependencies
- Architecture: HIGH -- SimpleAuth implementation verified directly from installed source code; env pattern verified from existing code
- Pitfalls: HIGH -- Identified from direct code analysis (uploadTouch1Override bypass, SimpleAuth header behavior, env validation timing)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- Mastra v1.8.0 is installed and pinned)
