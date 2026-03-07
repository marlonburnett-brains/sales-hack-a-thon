# Phase 31: Tech Debt Cleanup - Research

**Researched:** 2026-03-07
**Domain:** Code quality / tech debt remediation
**Confidence:** HIGH

## Summary

Phase 31 addresses three specific tech debt items identified in the v1.4 milestone audit. All three are well-scoped, low-risk changes with clear implementation paths. No new libraries or architectural changes are needed -- this is purely cleanup of existing code.

The three items are: (1) persist OAuth `client_id` to avoid re-registering on every MCP connect, (2) handle MCP results larger than 8000 chars in LLM extraction, and (3) remove dead code (`recheckAtlusAccessAction` and `recheckAtlusAccess`).

**Primary recommendation:** Tackle all three as independent, parallelizable tasks since they touch different files with no cross-dependencies.

## Standard Stack

No new libraries required. All changes use existing project dependencies:

| Library | Current Use | Relevant To |
|---------|-------------|-------------|
| Prisma 6.19.x | Database ORM | TD-1: Adding `clientId` column to `UserAtlusToken` |
| @mastra/mcp | MCP client | TD-1: Client registration flow |
| @google/genai | LLM extraction | TD-2: Handling larger payloads |

**CRITICAL (from CLAUDE.md):** All schema changes MUST use `prisma migrate dev --name <name>`. Never use `db push` or `migrate reset`.

## Architecture Patterns

### TD-1: Persist OAuth client_id

**Current state:** `registerAtlusClient()` in `atlus-auth.ts` (line 326) calls `POST /auth/register` on every agent process start. The result is cached in module-level `cachedRegistrationClientId` variable, but this is lost on process restart (Railway redeploy, crash, etc.).

In `mcp-client.ts`, `initMcp()` (line 227) calls `registerAtlusClient()` every time the MCP client initializes. The returned `client_id` is stored in module-level `cachedClientId` (line 43), used by `handleAuthFailure()` (line 99) for token refresh.

**Fix pattern:**
1. Add an optional `clientId String?` column to `UserAtlusToken` Prisma model
2. After successful registration, persist `client_id` alongside the user's token record
3. On `initMcp()`, check if the pooled auth result includes a stored `client_id` before calling `registerAtlusClient()`
4. Only call `registerAtlusClient()` if no persisted `client_id` exists

**Key files:**
- `apps/agent/prisma/schema.prisma` (line 275: `UserAtlusToken` model)
- `apps/agent/src/lib/atlus-auth.ts` (line 326: `registerAtlusClient()`, line 257: `cachedRegistrationClientId`)
- `apps/agent/src/lib/mcp-client.ts` (line 43: `cachedClientId`, line 226-229: registration call)

**Migration required:** Yes -- add `clientId String?` to `UserAtlusToken`. Must use `prisma migrate dev --name add-atlus-client-id`.

**Alternative approach (simpler):** Instead of a DB column, persist to a JSON file or env var. However, since `client_id` is per-registration and the token pool iterates users, persisting per-user in the DB is the correct approach -- different users may have different client registrations.

**Simplest viable approach:** Since the current code already caches `cachedRegistrationClientId` at module level and `registerAtlusClient()` returns early if cached (line 329-331), the real issue is only on process restart. The fix could be as simple as:
- Store `client_id` in the `UserAtlusToken` record when the token is first stored via OAuth
- Load it from DB in `getPooledAtlusAuth()` return value
- Use it in `initMcp()` instead of re-registering

### TD-2: LLM Extraction Handles Large MCP Results

**Current state:** `extractSlideResults()` in `atlusai-search.ts` (line 133-134) hard-truncates raw MCP JSON to 8000 chars:
```typescript
const truncatedRaw = rawStr.length > 8000 ? rawStr.substring(0, 8000) + "..." : rawStr;
```

This silently drops data when MCP returns large result sets. The `...` appended makes the JSON invalid, so the LLM sees incomplete/broken data.

**Fix pattern -- Chunked extraction:**
1. If `rawStr.length <= 8000`: process as-is (no change)
2. If `rawStr.length > 8000`: split the raw result array into chunks that fit within the limit
3. Run LLM extraction on each chunk independently
4. Merge and deduplicate results

**Implementation detail:**
- The raw MCP result is typically an array of objects. Parse it, split into chunks of N items each (where N items serialize to < 8000 chars), run extraction per chunk, concatenate results.
- If the result is NOT an array (single large object), increase the limit or summarize -- but this case is unlikely for search results.
- The 8000 char limit was chosen to stay within LLM context. Modern Gemini models have 1M+ token context windows, so the limit could be raised significantly (e.g., 32000 or 64000 chars) as a simpler fix.

**Simplest viable approach:** Raise the truncation limit to 32000 chars (well within Gemini's context window) AND implement array-level chunking as a safety net for truly massive results. This avoids over-engineering while eliminating data loss.

**Key files:**
- `apps/agent/src/lib/atlusai-search.ts` (line 127-173: `extractSlideResults()`)

### TD-3: Remove Dead Code

**Current state:** Two functions are dead code, superseded by the OAuth connect flow introduced later in Phase 27:

1. `recheckAtlusAccessAction` -- server action in `apps/web/src/lib/actions/action-required-actions.ts` (line 30-34)
2. `recheckAtlusAccess` -- API client function in `apps/web/src/lib/api-client.ts` (line 780-785)

**Verification:** Grep confirms these are ONLY referenced from each other and from planning docs. No UI component imports or calls either function. The functions call `POST /atlus/detect` on the agent, which still exists but is no longer the intended flow (OAuth connect handles access detection automatically now).

**Fix pattern:** Simply delete both functions and their import. Remove the `recheckAtlusAccess` import from `action-required-actions.ts` line 8.

**Key files:**
- `apps/web/src/lib/actions/action-required-actions.ts` (lines 8, 30-34)
- `apps/web/src/lib/api-client.ts` (lines 780-785)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array chunking | Custom chunk splitter | Simple `Array.slice()` loop with JSON size check | Edge cases with nested objects |
| Migration | Manual SQL | `prisma migrate dev` | Project rule -- all schema changes through migrations |

## Common Pitfalls

### Pitfall 1: Breaking Token Refresh by Changing client_id Storage
**What goes wrong:** If the `client_id` persistence changes the flow such that `cachedClientId` in `mcp-client.ts` is no longer set correctly, token refresh silently stops working (line 99 checks `cachedClientId` before attempting refresh).
**How to avoid:** Ensure `cachedClientId` is populated from the DB-stored value during `initMcp()`, before any auth failure could trigger refresh.

### Pitfall 2: Invalid JSON from Chunking
**What goes wrong:** Naively splitting a JSON string mid-object produces invalid JSON that the LLM cannot parse.
**How to avoid:** Always chunk at the array-item level (parse first, then split), never at the string level.

### Pitfall 3: Prisma Migration with Existing Data
**What goes wrong:** Adding a required column to a table with existing rows fails.
**How to avoid:** The `clientId` column MUST be optional (`String?`) since existing rows won't have a value. Never use `prisma db push` or `prisma migrate reset`.

### Pitfall 4: Removing Dead Code That Has Side Effects
**What goes wrong:** Removing a function that appears unused but is actually imported dynamically or via barrel exports.
**How to avoid:** Already verified -- `recheckAtlusAccess` and `recheckAtlusAccessAction` have zero UI consumers. Safe to remove.

## Code Examples

### TD-1: Persisting client_id (schema change)

```prisma
// In schema.prisma - UserAtlusToken model
model UserAtlusToken {
  // ... existing fields ...
  clientId       String?   // OAuth dynamic registration client_id
  // ... rest unchanged ...
}
```

### TD-1: Loading persisted client_id

```typescript
// In atlus-auth.ts - modify getPooledAtlusAuth return type
export interface PooledAtlusAuthResult {
  token: string;
  refreshToken?: string;
  userId: string;
  source: "pool" | "env";
  clientId?: string; // Add this
}
```

### TD-2: Chunked extraction pattern

```typescript
async function extractSlideResults(rawResult: unknown, searchQuery: string): Promise<SlideSearchResult[]> {
  const rawStr = JSON.stringify(rawResult);

  if (rawStr.length <= 32000) {
    // Small enough -- process in one shot
    return extractSingleBatch(rawStr, searchQuery);
  }

  // Large result -- chunk at array level
  const arr = Array.isArray(rawResult) ? rawResult : [rawResult];
  const chunks: unknown[][] = [];
  let current: unknown[] = [];
  let currentSize = 0;

  for (const item of arr) {
    const itemSize = JSON.stringify(item).length;
    if (currentSize + itemSize > 30000 && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(item);
    currentSize += itemSize;
  }
  if (current.length > 0) chunks.push(current);

  // Extract each chunk and merge
  const results = await Promise.all(
    chunks.map(chunk => extractSingleBatch(JSON.stringify(chunk), searchQuery))
  );
  return results.flat();
}
```

### TD-3: Dead code removal

```typescript
// action-required-actions.ts - Remove import and function
// DELETE: import { recheckAtlusAccess } from "@/lib/api-client";
// DELETE: export async function recheckAtlusAccessAction(...)

// api-client.ts - Remove function
// DELETE: export async function recheckAtlusAccess(...)
```

## State of the Art

No technology changes relevant -- all fixes use existing patterns already in the codebase.

## Open Questions

1. **Should the agent-side `/atlus/detect` route also be removed?**
   - What we know: `recheckAtlusAccess` calls `POST /atlus/detect`. This route may still be useful for other purposes or future use.
   - What's unclear: Whether the route has other callers.
   - Recommendation: Out of scope for this phase -- only remove the web-side dead code as specified. The agent route can be audited separately.

2. **Should the LLM extraction limit be configurable?**
   - What we know: 8000 was a conservative hardcoded value.
   - What's unclear: Actual MCP result sizes in production.
   - Recommendation: Use a reasonable default (32000) without adding env var config -- keeps it simple.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of `atlus-auth.ts`, `mcp-client.ts`, `atlusai-search.ts`, `action-required-actions.ts`, `api-client.ts`
- `v1.4-MILESTONE-AUDIT.md` -- tech debt item definitions
- `schema.prisma` -- current `UserAtlusToken` model structure
- `CLAUDE.md` -- Prisma migration discipline rules

### Secondary (MEDIUM confidence)
- Grep verification that `recheckAtlusAccess*` has zero UI consumers

## Metadata

**Confidence breakdown:**
- TD-1 (client_id persistence): HIGH -- clear code path, well-understood OAuth pattern
- TD-2 (large MCP results): HIGH -- straightforward chunking, existing code is simple
- TD-3 (dead code removal): HIGH -- verified zero consumers via grep

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stable codebase, no external dependency changes)
