# Phase 25: Integration Verification & Cutover - Research

**Researched:** 2026-03-06
**Domain:** Integration testing, vitest mocking, deploy documentation
**Confidence:** HIGH

## Summary

Phase 25 is a verification and documentation phase. All implementation work (Phases 22-24) is complete. The task is to write vitest smoke tests that verify the auth priority chain works correctly across all critical workflows, update traceability documentation, and create a deploy checklist.

The codebase already has vitest 4.0.18 configured in `apps/agent/vitest.config.ts` with an established test pattern (see `token-encryption.test.ts` and `smart-merge.test.ts`). Tests use `vi.mock()` for module-level mocking and `describe/it/expect` from vitest. The key challenge is mocking the deeply nested Google API clients (`googleapis`, `google-auth-library`) and Prisma while testing the auth selection logic in `google-auth.ts`, `request-auth.ts`, `token-cache.ts`, and the route handlers in `mastra/index.ts`.

**Primary recommendation:** Write per-module unit tests that mock googleapis/Prisma at the module boundary, testing the auth priority chain (access token -> userId refresh -> service account fallback) and the token pool iteration (valid token success, invalid token skip + ActionRequired, pool exhaustion -> service account). Do NOT attempt to test Mastra workflow orchestration or HTTP routing -- test the auth selection functions directly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Automated vitest smoke tests with mocked Google APIs (no real API calls)
- All critical workflows covered: Touch 1-4 workflows, template ingestion & staleness polling, pre-call briefing, token pool fallback chain
- Tests verify auth path selection works correctly (user token -> pool -> service account fallback chain)
- Tests kept permanently in the codebase as regression suite
- Service account remains as permanent fallback -- no demotion, no feature flag, no removal
- Deploy checklist updated with new v1.3 env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_TOKEN_ENCRYPTION_KEY
- Supabase OAuth scope configuration documented in deploy checklist
- Phase 24 must be fully executed before Phase 25 begins (hard dependency)
- REQUIREMENTS.md traceability table updated: INTG-01, INTG-02, INTG-03 marked complete when tests pass
- Bugs fixed inline as discovered during verification -- not cataloged first
- Forward-only migrations allowed if schema changes are needed (CLAUDE.md compliance)
- Individual atomic commits per fix (not batched)
- Critical rework of Phase 22-24 code handled here -- this is the final phase, no deferral

### Claude's Discretion
- Test file organization (single file vs per-workflow files)
- Mock strategy and test fixtures
- Deploy checklist format and location
- PROJECT.md update scope and wording
- Specific assertions within each smoke test

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTG-01 | Existing Touch 1-4 workflows, pre-call briefing, and template ingestion continue to function with service account fallback | Test auth factory functions with no GoogleAuthOptions (undefined) to verify service account path; test extractGoogleAuth with no headers to verify empty result; test route handler pattern `getDriveClient(googleAuth.accessToken ? googleAuth : undefined)` |
| INTG-02 | A user with Google token can access org-shared files that the service account cannot | Test getUserAuth returns OAuth2Client when accessToken provided; test getDriveClient/getSlidesClient/getDocsClient use user auth when options.accessToken is set; test extractGoogleAuth priority chain |
| INTG-03 | Background staleness polling works with pooled user tokens | Test getPooledGoogleAuth iterates tokens, marks invalid on failure, creates ActionRequired, falls back to service account; test token-cache getAccessTokenForUser cache hit/miss/refresh paths |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^4.0.18 | Test framework | Already configured in apps/agent/vitest.config.ts |
| vi.mock() | (vitest built-in) | Module mocking | Standard vitest approach for mocking googleapis, Prisma |
| vi.fn() | (vitest built-in) | Function spies | Track calls to Google API methods |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vi.hoisted() | (vitest built-in) | Hoist mock declarations | When mocks need to be defined before vi.mock() factory runs |
| vi.spyOn() | (vitest built-in) | Spy on existing methods | When testing console.warn for pool health warnings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vi.mock() module mocks | Dependency injection | DI would require refactoring production code; vi.mock is non-invasive |
| Per-module test files | Single integration test file | Per-module is cleaner but more files; single file risks test coupling |

**Installation:**
No new dependencies needed. vitest 4.0.18 already installed.

## Architecture Patterns

### Recommended Test File Structure
```
apps/agent/src/lib/__tests__/
  token-encryption.test.ts    # EXISTING
  google-auth.test.ts         # NEW -- INTG-01, INTG-02, INTG-03
  request-auth.test.ts        # NEW -- INTG-01, INTG-02
  token-cache.test.ts         # NEW -- INTG-03
apps/agent/src/mastra/__tests__/
  staleness-polling.test.ts   # NEW -- INTG-03 (pollStaleTemplates logic)
```

**Rationale:** Per-module test files match the existing pattern (`token-encryption.test.ts`, `smart-merge.test.ts`). Each auth module has distinct mocking needs. The staleness polling test goes in mastra/__tests__ since it tests logic in mastra/index.ts.

### Pattern 1: Mocking googleapis and google-auth-library
**What:** Mock the Google API client factories at the module level so no real HTTP calls are made.
**When to use:** Every test that touches google-auth.ts, token-cache.ts, or route handlers.
**Example:**
```typescript
// Source: vitest docs + existing project pattern
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis before importing the module under test
vi.mock("googleapis", () => ({
  google: {
    auth: {
      GoogleAuth: vi.fn().mockImplementation(() => ({
        getClient: vi.fn().mockResolvedValue({
          getAccessToken: vi.fn().mockResolvedValue({ token: "sa-token" }),
        }),
      })),
    },
    slides: vi.fn().mockReturnValue({ presentations: { get: vi.fn() } }),
    drive: vi.fn().mockReturnValue({ files: { get: vi.fn(), create: vi.fn() } }),
    docs: vi.fn().mockReturnValue({ documents: { get: vi.fn() } }),
  },
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    setCredentials: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue({ token: "user-access-token" }),
    on: vi.fn(),
  })),
}));
```

### Pattern 2: Mocking PrismaClient
**What:** Mock PrismaClient for tests that query UserGoogleToken or ActionRequired.
**When to use:** getPooledGoogleAuth tests, token-cache tests.
**Example:**
```typescript
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    userGoogleToken: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    actionRequired: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
  })),
}));
```

### Pattern 3: Testing Auth Priority Chain
**What:** Verify extractGoogleAuth returns the correct result based on which headers are present.
**When to use:** INTG-01 and INTG-02 verification.
**Example:**
```typescript
describe("extractGoogleAuth priority chain", () => {
  it("returns accessToken when X-Google-Access-Token header present", async () => {
    const c = { req: { header: (name: string) =>
      name === "X-Google-Access-Token" ? "user-token" :
      name === "X-User-Id" ? "user-123" : undefined
    }};
    const result = await extractGoogleAuth(c);
    expect(result.accessToken).toBe("user-token");
  });

  it("returns empty result when no headers (service account fallback)", async () => {
    const c = { req: { header: () => undefined } };
    const result = await extractGoogleAuth(c);
    expect(result.accessToken).toBeUndefined();
    expect(result.userId).toBeUndefined();
  });
});
```

### Anti-Patterns to Avoid
- **Testing Mastra workflow orchestration:** The workflows (touch-1 through touch-4) use Mastra's createWorkflow/createStep which requires Mastra runtime. Do NOT try to instantiate and run workflows in tests. Instead, test the auth selection functions that workflows consume.
- **Testing HTTP routing directly:** Mastra uses Hono internally. Do NOT try to create Hono app instances. Test the auth extraction and client factory functions directly.
- **Making real Google API calls:** All Google interactions must be mocked. The tests verify auth path selection logic, not Google API correctness.
- **Sharing mutable mock state between tests:** Reset mocks in beforeEach to prevent test coupling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Google API mocking | Custom HTTP interceptors | vi.mock("googleapis") | Module-level mocking is cleaner and more maintainable |
| Prisma mocking | In-memory database | vi.mock("@prisma/client") | No need for actual DB; testing auth logic, not queries |
| Request context simulation | Full Hono server | Plain objects matching RequestContext interface | extractGoogleAuth only needs `{ req: { header() } }` |

**Key insight:** The auth modules use a minimal `RequestContext` interface (not full Hono Context), making them trivially testable with plain objects.

## Common Pitfalls

### Pitfall 1: Module-level PrismaClient instantiation
**What goes wrong:** `google-auth.ts` and `token-cache.ts` create `new PrismaClient()` at module scope (line 8 and line 23 respectively). If you mock `@prisma/client` after import, the real PrismaClient constructor runs.
**Why it happens:** vi.mock() is hoisted but the mock factory must be defined before the import.
**How to avoid:** Place `vi.mock("@prisma/client", ...)` before any import of the module under test. Use dynamic `await import()` if needed (existing pattern in token-encryption.test.ts).
**Warning signs:** "Cannot connect to database" errors in test output.

### Pitfall 2: env module side effects
**What goes wrong:** Importing modules that depend on `../../env` triggers env validation (t3-env) which fails without all env vars set.
**Why it happens:** `env.ts` uses `@t3-oss/env-core` which validates at import time.
**How to avoid:** Mock `../../env` or `../env` with vi.mock() providing the needed env values, OR set process.env values before import.
**Warning signs:** "Missing environment variable" errors during test startup.

### Pitfall 3: Testing wrong level of abstraction
**What goes wrong:** Trying to test "Touch 1 workflow works with service account fallback" by running the actual workflow, which requires Mastra runtime, Prisma DB, Google API, and AI model.
**Why it happens:** Phase requirements say "workflows function with service account fallback" which sounds like E2E testing.
**How to avoid:** Verify INTG-01 by testing the auth factory functions (getSlidesClient, getDriveClient, getDocsClient) in isolation. If `options` is undefined, they must use service account auth. If `options.accessToken` is set, they must use user auth. The workflow correctness is already tested by the workflow running in production.
**Warning signs:** Test setup growing beyond 50 lines of mocking.

### Pitfall 4: Token cache state leaking between tests
**What goes wrong:** `token-cache.ts` uses a module-level `Map` for caching. If tests share the same module instance, cache state leaks.
**Why it happens:** vitest module caching.
**How to avoid:** Either use `vi.resetModules()` between tests or export a cache-clearing function for testing.
**Warning signs:** Tests pass individually but fail when run together.

### Pitfall 5: fire-and-forget Prisma calls in getPooledGoogleAuth
**What goes wrong:** `getPooledGoogleAuth` has multiple fire-and-forget `.catch(() => {})` calls for updating lastUsedAt and marking tokens invalid. Tests may not catch assertion failures on these.
**Why it happens:** The function intentionally does not await these operations.
**How to avoid:** Use `vi.fn()` mocks and verify they were called with expected arguments. The mock resolves immediately so there is no race.
**Warning signs:** Mock assertions pass even when the code path that calls them is broken.

## Code Examples

### Auth Factory Selection Logic (from google-auth.ts)
```typescript
// Source: apps/agent/src/lib/google-auth.ts lines 44-58
// This is the exact pattern all 14+ callers use:
export function getSlidesClient(options?: GoogleAuthOptions) {
  const auth = options ? getUserAuth(options) ?? getGoogleAuth() : getGoogleAuth()
  return google.slides({ version: 'v1', auth })
}
```
**Test strategy:** Verify that when `options` is undefined, `getGoogleAuth()` is used (service account). When `options.accessToken` is set, `getUserAuth()` returns an OAuth2Client. When `options.accessToken` is undefined but options object exists, still falls back to getGoogleAuth.

### Route Handler Auth Pattern (from mastra/index.ts)
```typescript
// Source: apps/agent/src/mastra/index.ts lines 895-897
// This pattern repeats at lines 328, 895, 1062, 1178
const googleAuth = await extractGoogleAuth(c);
const drive = getDriveClient(googleAuth.accessToken ? googleAuth : undefined);
```
**Test strategy:** This pattern means if extractGoogleAuth returns `{}` (no auth headers), `getDriveClient(undefined)` is called, which uses service account. If it returns `{ accessToken: "token" }`, user auth is used. Test extractGoogleAuth in isolation.

### Staleness Polling Auth Pattern (from mastra/index.ts)
```typescript
// Source: apps/agent/src/mastra/index.ts lines 46-49
const { accessToken, source } = await getPooledGoogleAuth();
console.log(`[staleness] Polling with ${source} auth`);
const drive = getDriveClient(accessToken ? { accessToken } : undefined);
```
**Test strategy:** Test getPooledGoogleAuth returns `{ source: 'pool', accessToken: '...' }` when valid tokens exist, and `{ source: 'service_account' }` when pool is exhausted.

### Token Pool Iteration (from google-auth.ts)
```typescript
// Source: apps/agent/src/lib/google-auth.ts lines 94-176
// Key behaviors to test:
// 1. Iterates ALL valid tokens ordered by lastUsedAt DESC
// 2. On success: returns accessToken, updates lastUsedAt, checks pool health
// 3. On failure: marks isValid=false, sets revokedAt, creates ActionRequired
// 4. After all tokens fail: returns { source: 'service_account' }
// 5. Pool health warning when < 3 valid tokens
```

### extractGoogleAuth Priority Chain (from request-auth.ts)
```typescript
// Source: apps/agent/src/lib/request-auth.ts lines 27-50
// Priority 1: X-Google-Access-Token present -> use directly
// Priority 2: X-User-Id present (no access token) -> agent-side refresh via token-cache
// Priority 3: Neither present -> empty result (service account fallback)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Service account only | User token -> pool -> service account chain | v1.3 (Phase 22-24) | Users can now access org-shared files SA cannot |
| No background token pool | getPooledGoogleAuth iterates user tokens | v1.3 (Phase 24) | Background jobs benefit from user permissions |
| No token passthrough | X-Google-Access-Token header | v1.3 (Phase 23) | Interactive requests use user's own token |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | apps/agent/vitest.config.ts |
| Quick run command | `cd apps/agent && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/agent && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTG-01 | Auth factories fall back to service account when no options provided | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 |
| INTG-01 | extractGoogleAuth returns empty when no headers present | unit | `cd apps/agent && npx vitest run src/lib/__tests__/request-auth.test.ts -x` | Wave 0 |
| INTG-02 | Auth factories use user OAuth2Client when accessToken provided | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 |
| INTG-02 | extractGoogleAuth returns accessToken when header present | unit | `cd apps/agent && npx vitest run src/lib/__tests__/request-auth.test.ts -x` | Wave 0 |
| INTG-03 | getPooledGoogleAuth iterates tokens and falls back to SA | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 |
| INTG-03 | Token cache hit/miss/refresh paths | unit | `cd apps/agent && npx vitest run src/lib/__tests__/token-cache.test.ts -x` | Wave 0 |
| INTG-03 | Pool marks invalid tokens and creates ActionRequired | unit | `cd apps/agent && npx vitest run src/lib/__tests__/google-auth.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/agent && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd apps/agent && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/agent/src/lib/__tests__/google-auth.test.ts` -- covers INTG-01, INTG-02, INTG-03
- [ ] `apps/agent/src/lib/__tests__/request-auth.test.ts` -- covers INTG-01, INTG-02
- [ ] `apps/agent/src/lib/__tests__/token-cache.test.ts` -- covers INTG-03

## Open Questions

1. **How to handle env module in tests?**
   - What we know: env.ts uses @t3-oss/env-core which validates at import time. Existing tests (token-encryption.test.ts) avoid this by using process.env directly since token-encryption.ts reads process.env, not the env module.
   - What's unclear: google-auth.ts imports `env` for GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_SERVICE_ACCOUNT_KEY. We need to mock this.
   - Recommendation: Use `vi.mock("../../env", () => ({ env: { GOOGLE_CLIENT_ID: "test-id", GOOGLE_CLIENT_SECRET: "test-secret", GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}' } }))` at the top of test files.

2. **Deploy checklist location**
   - What we know: No existing deploy checklist file found in the project.
   - What's unclear: Should it be a top-level DEPLOY.md, or inside .planning/?
   - Recommendation: Create `DEPLOY.md` at project root -- it is operational documentation that should be visible and easy to find.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: apps/agent/src/lib/google-auth.ts, request-auth.ts, token-cache.ts, token-encryption.ts
- Codebase inspection: apps/agent/src/mastra/index.ts (staleness polling, route handlers)
- Codebase inspection: apps/web/src/lib/api-client.ts (fetchWithGoogleAuth pattern)
- Codebase inspection: apps/agent/vitest.config.ts, existing test files
- CONTEXT.md: locked decisions from user discussion

### Secondary (MEDIUM confidence)
- vitest mocking patterns: based on vitest 4.x documentation and existing project tests

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - vitest already configured and used, no new dependencies
- Architecture: HIGH - test structure follows existing project patterns
- Pitfalls: HIGH - derived from direct code inspection of module-level side effects

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- no external dependency changes expected)
