---
phase: quick-15
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/agent/src/env.ts
  - apps/agent/src/lib/supabase-jwt-auth.ts
  - apps/agent/src/mastra/index.ts
  - apps/web/src/lib/api-client.ts
  - apps/web/src/lib/actions/settings-actions.ts
  - apps/web/src/lib/supabase/google-token.ts
  - apps/web/src/app/api/deals/[dealId]/chat/route.ts
  - apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts
  - apps/web/src/app/api/deck-structures/chat/route.ts
  - apps/web/src/app/api/agents/chat/route.ts
  - apps/web/src/app/api/drive/token/route.ts
  - apps/web/src/(authenticated)/api/upload/route.ts
  - apps/web/src/middleware.ts
  - apps/web/src/env.ts
  - apps/agent/.env
  - apps/web/.env.local
autonomous: true
requirements: [QUICK-15]

must_haves:
  truths:
    - "Agent verifies Supabase JWTs and rejects invalid/expired tokens with 401"
    - "Web app forwards the user's Supabase access_token as Bearer token to agent"
    - "User identity is extracted from the verified JWT sub claim, not from a spoofable header"
    - "AGENT_API_KEY env var is removed from both apps"
  artifacts:
    - path: "apps/agent/src/lib/supabase-jwt-auth.ts"
      provides: "JWT verification middleware for Hono/Mastra"
      exports: ["verifySupabaseJwt"]
    - path: "apps/web/src/lib/supabase/get-access-token.ts"
      provides: "Helper to extract Supabase access_token from session"
  key_links:
    - from: "apps/web/src/lib/api-client.ts"
      to: "apps/agent/src/lib/supabase-jwt-auth.ts"
      via: "Authorization: Bearer <supabase_access_token>"
      pattern: "Bearer.*access_token"
    - from: "apps/agent/src/lib/supabase-jwt-auth.ts"
      to: "apps/agent/src/lib/request-auth.ts"
      via: "JWT sub claim replaces X-User-Id header"
---

<objective>
Replace the static AGENT_API_KEY authentication between the Next.js web app and Mastra agent with Supabase JWT verification. The web app will forward the user's Supabase access_token (from their session) as a Bearer token. The agent will verify it using the Supabase JWT secret, extract user identity from the JWT `sub` claim, and eliminate the spoofable X-User-Id header.

Purpose: Eliminate shared static secret, tie every agent request to a verified user identity, close the X-User-Id spoofing vector.
Output: Both apps authenticate via Supabase JWT; AGENT_API_KEY removed entirely.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/lib/api-client.ts
@apps/web/src/env.ts
@apps/agent/src/env.ts
@apps/agent/src/mastra/index.ts (lines 550-562 — SimpleAuth setup)
@apps/agent/src/lib/request-auth.ts
@apps/web/src/middleware.ts
@apps/web/src/lib/supabase/server.ts
@apps/web/src/lib/supabase/google-token.ts
@apps/web/src/lib/actions/settings-actions.ts
@apps/web/src/app/api/deals/[dealId]/chat/route.ts
@apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts
@apps/web/src/app/api/deck-structures/chat/route.ts
@apps/web/src/app/api/agents/chat/route.ts
@apps/web/src/app/api/drive/token/route.ts
@apps/web/src/(authenticated)/api/upload/route.ts

<interfaces>
<!-- Current auth contract to be replaced -->

From apps/agent/src/mastra/index.ts (lines 556-562):
```typescript
const auth = new SimpleAuth({
  headers: ["X-API-Key"],
  tokens: {
    [env.AGENT_API_KEY]: { id: "web-app", role: "service" },
  },
  public: publicPaths,
});
```

From apps/agent/src/lib/request-auth.ts:
```typescript
export interface GoogleAuthResult {
  accessToken?: string;
  userId?: string;
}
export async function extractGoogleAuth(c: RequestContext): Promise<GoogleAuthResult>;
```

From apps/web/src/lib/supabase/google-token.ts:
```typescript
export async function getGoogleAccessToken(): Promise<{
  accessToken: string | null;
  userId: string | null;
}>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create JWT verification on agent + replace SimpleAuth</name>
  <files>
    apps/agent/src/lib/supabase-jwt-auth.ts
    apps/agent/src/env.ts
    apps/agent/src/mastra/index.ts
    apps/agent/src/lib/request-auth.ts
    apps/agent/.env
  </files>
  <action>
**1. Add SUPABASE_JWT_SECRET to agent env:**

In `apps/agent/src/env.ts`, replace the `AGENT_API_KEY` line with:
```typescript
// Supabase JWT secret for verifying user tokens from the web app
// Found in: Supabase Dashboard -> Settings -> API -> JWT Secret
SUPABASE_JWT_SECRET: z.string().min(32, "SUPABASE_JWT_SECRET required for JWT verification"),
```

Remove `AGENT_API_KEY` entirely from the env schema.

**2. Create `apps/agent/src/lib/supabase-jwt-auth.ts`:**

This module exports a function that verifies a Supabase JWT from the Authorization header and returns the authenticated user info. Use the `jose` library (already a transitive dep of `@supabase/ssr`; if not available, use Node's built-in `crypto` with HMAC-SHA256 — Supabase JWTs use HS256 by default).

Check if `jose` is available first: `ls node_modules/jose`. If not, implement manual HS256 JWT verification using Node `crypto`:
- Split token into header.payload.signature
- Verify signature: `crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url')` matches signature
- Decode and parse payload JSON
- Check `exp` > now (reject expired tokens)
- Return `{ userId: payload.sub, email: payload.email, role: payload.role }`

Export:
```typescript
export interface JwtPayload {
  sub: string;       // Supabase user ID
  email?: string;
  role?: string;
  exp: number;
}

export async function verifySupabaseJwt(authHeader: string | undefined): Promise<JwtPayload | null>;
```

Returns null if header missing, malformed, expired, or signature invalid. Never throws.

**3. Replace SimpleAuth in `apps/agent/src/mastra/index.ts`:**

Remove the `SimpleAuth` import and instantiation (lines 556-562). Instead, create a custom auth middleware using Mastra's `registerApiRoute` or Hono middleware pattern. The agent uses Hono under the hood via Mastra.

Look at how Mastra's `server` config accepts an `auth` option. If Mastra requires a SimpleAuth-like object, create a custom implementation:

```typescript
import { verifySupabaseJwt } from "../lib/supabase-jwt-auth";

// Replace the SimpleAuth block with custom JWT verification
// that integrates with Mastra's auth system.
// The key change: instead of matching a static token, we verify the JWT
// and attach the user info to the request context.
```

The cleanest approach: Check if Mastra's auth config supports a custom `authenticate` function or middleware hook. If SimpleAuth is the only option, create a thin wrapper that:
- Extracts Bearer token from Authorization header
- Verifies it via `verifySupabaseJwt`
- If valid, allows the request through
- If invalid, returns 401

Also update the CORS `allowHeaders` array (line ~602): remove `'X-API-Key'` since it's no longer used. Keep `'X-User-Id'` for now as a fallback but we'll remove its usage.

**4. Update `apps/agent/src/lib/request-auth.ts`:**

Modify `extractGoogleAuth` to accept an optional `userId` parameter (from the verified JWT) instead of reading `X-User-Id` from the request header. This eliminates the spoofable header:

```typescript
export async function extractGoogleAuth(
  c: RequestContext,
  verifiedUserId?: string  // From JWT verification
): Promise<GoogleAuthResult> {
  const accessToken = c.req.header("X-Google-Access-Token");
  // Use verified userId from JWT instead of spoofable X-User-Id header
  const userId = verifiedUserId ?? c.req.header("X-User-Id");
  // ... rest stays the same
}
```

Update all call sites of `extractGoogleAuth` in `index.ts` to pass the verified userId from the JWT context.

**5. Update `apps/agent/.env`:**

Remove `AGENT_API_KEY=...` line. Add `SUPABASE_JWT_SECRET=<value>` (copy from Supabase Dashboard or from the web app's Supabase config). The JWT secret is typically available as the `JWT_SECRET` in Supabase project settings.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>Agent verifies Supabase JWTs instead of static API key. AGENT_API_KEY removed from agent env schema and .env file. extractGoogleAuth accepts verified userId from JWT.</done>
</task>

<task type="auto">
  <name>Task 2: Update web app to forward Supabase access_token instead of AGENT_API_KEY</name>
  <files>
    apps/web/src/lib/api-client.ts
    apps/web/src/lib/actions/settings-actions.ts
    apps/web/src/app/api/deals/[dealId]/chat/route.ts
    apps/web/src/app/api/deals/[dealId]/chat/bindings/route.ts
    apps/web/src/app/api/deck-structures/chat/route.ts
    apps/web/src/app/api/agents/chat/route.ts
    apps/web/src/app/api/drive/token/route.ts
    apps/web/src/(authenticated)/api/upload/route.ts
    apps/web/src/middleware.ts
    apps/web/src/env.ts
    apps/web/.env.local
  </files>
  <action>
The web app currently sends `Authorization: Bearer ${env.AGENT_API_KEY}` to the agent. Replace this with the user's Supabase access_token from their session.

**1. Create a helper to get the Supabase access_token:**

In `apps/web/src/lib/supabase/google-token.ts` (which already creates a Supabase client and gets the session), note that `session.access_token` is the Supabase JWT we need. Either:
- Add a new export `getSupabaseAccessToken()` to this file, OR
- Create a new file `apps/web/src/lib/supabase/get-access-token.ts`

```typescript
"use server";
import { createClient } from "./server";

export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
```

**2. Update `apps/web/src/lib/api-client.ts`:**

Change `fetchAgent` to get the Supabase access_token instead of using AGENT_API_KEY:

```typescript
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

async function fetchAgent(path: string, init?: RequestInit): Promise<Response> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Not authenticated — no Supabase session");
  }

  return await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
}
```

Remove the `env.AGENT_API_KEY` import/usage. The `fetchWithGoogleAuth` and `fetchWithGoogleAuthResponse` functions still send `X-Google-Access-Token` for Google API calls — that's fine, it's a separate concern. But they can STOP sending `X-User-Id` since the agent now gets userId from the JWT. Remove the `X-User-Id` header from `fetchWithGoogleAuth` and `fetchWithGoogleAuthResponse`.

**3. Update `apps/web/src/lib/actions/settings-actions.ts`:**

Replace the `agentFetch` function's auth header the same way — get Supabase access_token and use it as Bearer token instead of AGENT_API_KEY:

```typescript
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

async function agentFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) throw new Error("Not authenticated");

  const response = await fetch(`${env.AGENT_SERVICE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  // ... rest unchanged
}
```

**4. Update Next.js API route proxy handlers:**

These routes (`deals/[dealId]/chat/route.ts`, `bindings/route.ts`, `deck-structures/chat/route.ts`, `agents/chat/route.ts`, `drive/token/route.ts`, `upload/route.ts`) have their own `buildProxyHeaders` or inline `Authorization` header construction. They run server-side in Next.js route handlers where the Supabase session is available via cookies.

For each of these files, update the auth header:

```typescript
import { createClient } from "@/lib/supabase/server";

// In buildProxyHeaders or wherever Authorization is set:
const supabase = await createClient();
const { data: { session } } = await supabase.auth.getSession();
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${session?.access_token ?? ""}`,
};
```

Since `buildProxyHeaders` needs to be async now, update the call sites accordingly.

For `apps/web/src/app/api/drive/token/route.ts`: it already creates a Supabase client — just use `session.access_token` for the Authorization header instead of `env.AGENT_API_KEY`.

For `apps/web/src/(authenticated)/api/upload/route.ts`: same pattern.

**5. Update `apps/web/src/middleware.ts`:**

The middleware uses `process.env.AGENT_API_KEY` directly (not via env.ts) to check google token status. Replace with the user's Supabase session token:

```typescript
// Instead of:
// const agentKey = process.env.AGENT_API_KEY;
// Authorization: `Bearer ${agentKey}`,

// Use the Supabase session that's already available in this middleware:
const { data: { session } } = await supabase.auth.getSession();
if (session?.access_token) {
  // Use session.access_token as Bearer token
  const checkResponse = await fetch(`${agentUrl}/tokens/check/${user.id}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(3000),
  });
  // ... rest unchanged
}
```

Remove the `const agentKey = process.env.AGENT_API_KEY;` line and the `if (agentKey)` guard.

**6. Remove AGENT_API_KEY from web env:**

In `apps/web/src/env.ts`: Remove `AGENT_API_KEY` from the `server` schema and from `runtimeEnv`.

In `apps/web/.env.local`: Remove the `AGENT_API_KEY=...` line.

**7. Update test mocks:**

Search for all test files mocking `AGENT_API_KEY` and update them. Files:
- `apps/web/src/lib/__tests__/api-client.deck-structures.test.ts`
- `apps/web/src/lib/__tests__/api-client-google-auth.test.ts`
- `apps/web/src/lib/__tests__/slide-api-client.test.ts`
- `apps/web/src/lib/__tests__/api-client.deal-chat.test.ts`
- `apps/web/src/lib/__tests__/api-client-actions.test.ts`
- `apps/web/src/app/api/deals/[dealId]/chat/__tests__/route.test.ts`
- `apps/web/src/app/api/deals/[dealId]/chat/bindings/__tests__/route.test.ts`
- `apps/web/src/app/api/deck-structures/chat/__tests__/route.test.ts`

Remove `AGENT_API_KEY` from env mocks. Instead, mock `getSupabaseAccessToken` or the Supabase client to return a test JWT. The simplest approach: mock the `@/lib/supabase/get-access-token` module to return a fixed test token, and for route tests mock `@/lib/supabase/server` to return a session with a test access_token.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30 && grep -r "AGENT_API_KEY" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test." | head -5</automated>
  </verify>
  <done>Web app sends Supabase access_token as Bearer token. AGENT_API_KEY removed from web env schema, .env.local, and all production code. X-User-Id header no longer sent (agent extracts userId from JWT). Test files updated to mock Supabase session instead of static API key.</done>
</task>

<task type="auto">
  <name>Task 3: Verify end-to-end auth flow and clean up references</name>
  <files>
    apps/agent/src/mastra/index.ts
    apps/web/src/lib/api-client.ts
  </files>
  <action>
**1. Run both TypeScript compilations to catch any remaining AGENT_API_KEY references:**

```bash
cd apps/agent && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Fix any type errors.

**2. Grep for any remaining AGENT_API_KEY references across the entire repo:**

```bash
grep -r "AGENT_API_KEY" . --include="*.ts" --include="*.tsx" --include="*.env*" | grep -v node_modules | grep -v ".test."
```

Remove any stragglers.

**3. Grep for any remaining X-User-Id sends from the web app** (agent-side reads are OK for backward compat but web should not send):

```bash
grep -r "X-User-Id" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."
```

Remove any remaining X-User-Id header sends from web production code.

**4. Run existing tests to check for breakage:**

```bash
cd apps/web && npx vitest run --reporter=verbose 2>&1 | tail -30
cd apps/agent && npx vitest run --reporter=verbose 2>&1 | tail -30
```

Fix any failing tests. The most likely failures are in test files that mock AGENT_API_KEY — ensure all are updated.

**5. Update AUTH-CONTRACT.md if it exists:**

```bash
cat .planning/AUTH-CONTRACT.md 2>/dev/null
```

If it exists, update to reflect the new JWT-based auth contract. If not, no action needed.

**6. Remove the AUTH-CONTRACT comment in api-client.ts** (line 32) since the Bearer token is now semantically correct (it IS a Bearer token — the Supabase JWT).
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && npx tsc --noEmit -p apps/agent/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && echo "TypeScript OK" && grep -rc "AGENT_API_KEY" apps/web/src/ apps/agent/src/ --include="*.ts" --include="*.tsx" | grep -v ":0$" | grep -v ".test." | grep -v node_modules || echo "No AGENT_API_KEY references remain"</automated>
  </verify>
  <done>Both apps compile cleanly. No AGENT_API_KEY references remain in production code. Tests pass. Auth flow uses Supabase JWT end-to-end.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles cleanly in both apps: `npx tsc --noEmit`
2. No `AGENT_API_KEY` references in production code (test mocks excluded)
3. No `X-User-Id` header sends from web app production code
4. All existing tests pass (with updated mocks)
5. Agent rejects requests without valid Supabase JWT (manual test: `curl -X GET http://localhost:4111/deals` returns 401)
6. Agent accepts requests with valid Supabase JWT (web app works normally when both services running)
</verification>

<success_criteria>
- AGENT_API_KEY env var removed from both apps/web and apps/agent
- Agent verifies Supabase JWTs using SUPABASE_JWT_SECRET
- User identity derived from JWT sub claim (not X-User-Id header)
- Web app extracts Supabase session access_token and sends as Bearer token
- Both apps compile, all tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/15-replace-agent-api-key-with-supabase-jwt-/15-SUMMARY.md`
</output>
