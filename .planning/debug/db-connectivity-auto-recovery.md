---
status: awaiting_human_verify
trigger: "Agent service crashes fatally on transient database connectivity issues and doesn't auto-recover"
created: 2026-03-11T00:00:00Z
updated: 2026-03-11T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED -- PostgresStore.init() throws MastraError on DNS failure; @mastra/core's augmentWithInit proxy caches the rejected promise permanently; no process-level handler catches the unhandled rejection, killing the process
test: Code analysis of @mastra/pg and @mastra/core internals
expecting: n/a -- fix applied and self-verified (type-checks clean)
next_action: Awaiting human verification that the fix survives a real transient DB failure

## Symptoms

expected: Agent service should handle transient DB connectivity issues (DNS failures, connection timeouts) gracefully and auto-recover
actual: Process crashes with uncaught MastraError during PostgresStore.init() -> createTable. The entire Node.js process exits.
errors: MastraError: getaddrinfo ENOTFOUND aws-1-us-east-1.pooler.supabase.com at PgDB.createTable (@mastra/pg/dist/index.js:2411). Error ID: MASTRA_STORAGE_PG_CREATE_TABLE_FAILED
reproduction: Happens intermittently when Supabase DNS is temporarily unreachable during dev server startup or runtime
started: Ongoing intermittent issue

## Eliminated

## Evidence

- timestamp: 2026-03-11T00:00:10Z
  checked: apps/agent/src/mastra/index.ts lines 594-599
  found: PostgresStore instantiated at module level with `new PostgresStore({...})` and passed directly to `new Mastra({ storage: ... })`; no try/catch or retry around it
  implication: Any init failure propagates unhandled

- timestamp: 2026-03-11T00:00:20Z
  checked: @mastra/core augmentWithInit (chunk-VBPU6CLZ.js:25340-25370)
  found: Core wraps storage in Proxy; on first operation calls `hasInitialized = storage.init()` and caches promise. If init rejects, the cached promise remains rejected PERMANENTLY -- subsequent calls re-throw the same cached rejection with no reset
  implication: Even if DNS recovers, the storage proxy is permanently broken after one failure

- timestamp: 2026-03-11T00:00:30Z
  checked: @mastra/pg PostgresStore.init() (dist/index.js:13148-13170)
  found: Sets `this.isInitialized = true` optimistically, then `await super.init()`, resets to false on catch. So the store itself CAN retry, but the proxy above it won't give it a chance
  implication: Fix must intercept at the init() boundary before the proxy caches the result

- timestamp: 2026-03-11T00:00:40Z
  checked: process.on handlers in mastra/index.ts
  found: Only SIGTERM handler exists; no unhandledRejection or uncaughtException handler
  implication: Any unhandled rejection from async init kills the process

- timestamp: 2026-03-11T00:00:50Z
  checked: apps/web/src/lib/api-client.ts line 42-44
  found: fetchAgent catch block immediately throws "Agent service is unreachable" with no retry
  implication: Even brief agent downtime during init retry will surface as user-facing errors with no recovery

## Resolution

root_cause: Two-layer failure: (1) PostgresStore.init() throws MastraError on DNS failure, (2) @mastra/core's augmentWithInit proxy caches the rejected promise permanently with no reset mechanism, (3) no process-level unhandledRejection handler exists, so the rejection crashes Node. Even if DNS recovers within seconds, the process is already dead.

fix: Three changes applied:
  1. Created `resilient-storage.ts` wrapper that intercepts `init()` with exponential backoff retry (up to 12 attempts, 1s-30s delays) for transient errors (ENOTFOUND, ECONNREFUSED, ECONNRESET, ETIMEDOUT, etc.). The wrapper ensures the promise returned to the proxy only rejects for permanent failures.
  2. Added `process.on("unhandledRejection")` safety net to prevent any other uncaught async errors from fatally crashing the process.
  3. Added retry logic (3 attempts with exponential backoff) to the web app's `fetchAgent()` so brief agent unavailability during recovery doesn't immediately surface as user errors.

verification: Type-check passes clean (no new errors). All pre-existing TS errors are unrelated (TS5097 in schemas package, TS2339 in existing index.ts code). PostgresStore is now only imported in the resilient wrapper.

files_changed:
  - apps/agent/src/lib/resilient-storage.ts (NEW)
  - apps/agent/src/mastra/index.ts (import + instantiation + unhandledRejection handler)
  - apps/web/src/lib/api-client.ts (retry logic in fetchAgent)
