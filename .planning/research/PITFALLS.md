# Pitfalls Research

**Domain:** Adding AtlusAI token pool auth, Mastra MCP client, Drive fallback replacement, Action Required extension, and Discovery UI to existing Next.js + Mastra monorepo
**Researched:** 2026-03-06
**Confidence:** HIGH (based on existing codebase analysis, Mastra MCP docs, MCP protocol spec, Vercel serverless constraints, and v1.3 token pool implementation patterns)

## Critical Pitfalls

### Pitfall 1: SSE Connection Lifecycle in Vercel Serverless Functions Causes Silent Tool Call Failures

**What goes wrong:**
The Mastra `MCPClient` holds a persistent SSE connection to `https://knowledge-base-api.lumenalta.com/sse`. On Vercel, serverless functions have hard timeouts (60s Hobby, 300s Pro). If a web Server Action creates an `MCPClient`, the SSE connection opens, but the function terminates when the response completes -- killing the SSE connection mid-flight if any background work is pending. On subsequent requests, a new function invocation gets a new `MCPClient` with a new SSE connection. If the `MCPClient` is cached at module scope (singleton pattern), Vercel's function recycling means the cached instance may hold a dead SSE connection that silently fails on the next tool call.

**Why it happens:**
Vercel serverless functions are stateless and ephemeral. SSE connections are stateful and persistent. These two paradigms are fundamentally incompatible. The MCP protocol requires an `initialize` handshake on each new SSE session, but a cached `MCPClient` instance does not know its SSE connection has been severed by function recycling. The `MCPClient` auto-connects lazily on first `listTools()` or tool call, but does not detect that the underlying transport died.

**How to avoid:**
1. **Do NOT create MCPClient on Vercel (web app) at all.** All MCP operations must go through the Railway-hosted agent service, which is a long-running process that can hold persistent SSE connections.
2. The web app should call agent API endpoints (via `fetchWithGoogleAuth` or `fetchJSON`) that internally use the MCPClient on the agent side.
3. On Railway (agent), create a singleton `MCPClient` at startup with proper reconnect handling. The agent process is long-lived, so SSE connections persist naturally.
4. Implement a health check that verifies the SSE connection is alive before tool calls: wrap `listTools()` in a try/catch and reconnect (`disconnect()` then re-create) on failure.
5. Set the MCPClient `timeout` to 30 seconds (not the default 60s) to fail fast on stale connections.

**Warning signs:**
- Tool calls that work in development (long-running Node.js process) but fail in production (Vercel serverless)
- `ECONNRESET` or `fetch failed` errors from the MCPClient
- SSE connection established but tool responses never arrive
- MCPClient `listTools()` returning empty arrays after function recycling

**Phase to address:**
Mastra MCP Client phase -- must be an agent-side-only component from the start.

---

### Pitfall 2: MCPClient SSE Connection on Railway Dies After Server Restarts Without Reconnect Logic

**What goes wrong:**
Railway auto-restarts containers on deploy, health check failure, or OOM. When the agent process restarts, the singleton `MCPClient` is destroyed. If the `MCPClient` is created in a module-level `const`, it initializes lazily on first use after restart -- but the AtlusAI SSE endpoint may take 5-10 seconds to establish, during which incoming requests that need MCP tools will fail. Additionally, if the AtlusAI server itself restarts or has a network blip, the SSE connection drops and `MCPClient` does not auto-reconnect. Per the MCP TypeScript SDK issue #510, "SSEClientTransport doesn't re-establish lifecycle state on disconnect/reconnect" -- reconnecting creates a new session but the client assumes the old initialization state.

**Why it happens:**
The MCP SSE transport is session-based. Each SSE connection has a session ID. When the connection drops, the server forgets the session. The client must fully re-initialize (new handshake, new session). But `MCPClient` does not have built-in reconnect with re-initialization -- it reconnects the transport but skips the `initialize` message exchange.

**How to avoid:**
1. Create a wrapper around `MCPClient` that detects connection drops and fully re-creates the client (not just reconnects the transport):
```typescript
let mcpClient: MCPClient | null = null;

async function getAtlusAIMCPClient(): Promise<MCPClient> {
  if (mcpClient) {
    try {
      await mcpClient.listTools(); // health check
      return mcpClient;
    } catch {
      await mcpClient.disconnect().catch(() => {});
      mcpClient = null;
    }
  }
  mcpClient = new MCPClient({ servers: { atlus: { url: new URL(ATLUS_SSE_URL), ... } } });
  return mcpClient;
}
```
2. Add a `process.on('SIGTERM', ...)` handler to gracefully disconnect before Railway kills the container.
3. Use the MCPClient `id` parameter to prevent memory leaks: `id: 'atlus-ai-singleton'`. Without this, creating multiple instances with identical config throws an error.
4. Add startup readiness gating: the agent should not accept MCP-dependent requests until the SSE connection is confirmed alive via `listTools()`.

**Warning signs:**
- MCP tool calls failing immediately after Railway deploys
- "MCPClient already exists with this configuration" errors (memory leak from re-creation without disconnect)
- Tools working for hours, then suddenly failing (network blip killed SSE)
- Agent logs showing SSE connection established but `initialize` handshake never completed

**Phase to address:**
Mastra MCP Client phase -- reconnect wrapper must be part of the initial integration.

---

### Pitfall 3: Two Independent Token Pools (Google + AtlusAI) Create Cascade Failures and Confusing Action Required Items

**What goes wrong:**
The existing `getPooledGoogleAuth()` iterates `UserGoogleToken` records for Google API access. v1.4 adds a second pool (`UserAtlusToken`) for AtlusAI API access. Both pools create `ActionRequired` records with different `actionType` values (`reauth_needed` vs `atlus_account_required`). When a user's Google token expires, the system creates a Google re-auth action. When they also lack an AtlusAI account, they get an AtlusAI action. The Actions page becomes a confusing mix of Google and AtlusAI issues with no clear categorization. Worse, if a background job needs BOTH pools (e.g., search AtlusAI + fetch from Drive), one pool failure causes the whole operation to fail, but only one `ActionRequired` is created -- the user fixes one issue and the job still fails on the other.

**Why it happens:**
Two independent pools with independent fallback chains and independent error paths. No coordination between the pools. The Action Required UI treats all actions as a flat list with no grouping. Background jobs that need both APIs do not atomically check both before starting.

**How to avoid:**
1. Group Action Required items by category in the UI. Add an `actionCategory` field or derive from `actionType`: Google actions vs AtlusAI actions. Show them in separate sections.
2. For operations requiring both pools, pre-check both pools at the start and create all needed `ActionRequired` records upfront -- do not discover them one at a time.
3. Keep the pools completely independent in code. Do NOT create a unified "token pool" abstraction -- Google OAuth and AtlusAI auth are different systems with different credentials, different refresh mechanisms, and different scopes. A bad abstraction here causes more bugs than it prevents.
4. Use distinct `actionType` values that are clearly named: `google_reauth_needed`, `atlus_account_required`, `atlus_project_required` (not generic `reauth_needed` that could mean either).
5. Add de-duplication: before creating a new `ActionRequired`, check for an existing unresolved record with the same `userId` + `actionType` (the existing Google pool already does this -- replicate for AtlusAI pool).

**Warning signs:**
- Users seeing 4+ unresolved actions with unclear categorization
- Background jobs failing twice -- once for Google, once for AtlusAI -- when both credentials are expired
- `ActionRequired` table growing with duplicate entries for the same user/issue

**Phase to address:**
Auth & Token Pool phase AND Action Required Integration phase -- both phases must coordinate on `actionType` naming and UI grouping.

---

### Pitfall 4: MCP Auth Credential Injection -- Passing AtlusAI Tokens Through requestInit/eventSourceInit Incorrectly

**What goes wrong:**
The AtlusAI SSE endpoint (`/sse`) returns 401 without auth. The `MCPClient` needs to pass the AtlusAI access token via request headers. However, the MCPClient has TWO header configuration points: `requestInit` (for the initial Streamable HTTP attempt and subsequent POST requests) and `eventSourceInit` (for the SSE fallback). If you only set `requestInit`, the SSE fallback connection opens without auth headers and gets 401. The MCPClient silently falls back from Streamable HTTP to SSE, then SSE fails with 401, and the error message just says "connection failed" without indicating that SSE auth headers were missing.

**Why it happens:**
The MCPClient first tries Streamable HTTP transport (protocol version 2025-03-26), then falls back to legacy SSE (protocol version 2024-11-05). These are two different transports with two different request configurations. The AtlusAI server is an SSE server (legacy protocol), so the Streamable HTTP attempt will always fail. The SSE connection needs auth in `eventSourceInit`, not `requestInit`. Developers set `requestInit` headers assuming it covers all transports.

**How to avoid:**
1. Set auth headers in BOTH `requestInit` AND `eventSourceInit`:
```typescript
const mcpClient = new MCPClient({
  id: 'atlus-ai',
  servers: {
    atlus: {
      url: new URL('https://knowledge-base-api.lumenalta.com/sse'),
      requestInit: {
        headers: { Authorization: `Bearer ${atlusToken}` },
      },
      eventSourceInit: {
        fetch: (url, init) => fetch(url, {
          ...init,
          headers: { ...init?.headers, Authorization: `Bearer ${atlusToken}` },
        }),
      },
    },
  },
});
```
2. Alternatively, use the `fetch` option on the server config which covers ALL transports:
```typescript
fetch: async (url, init) => {
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  });
}
```
3. The `fetch` option is preferred because it provides a single auth injection point that works regardless of which transport the MCPClient selects.
4. Since the AtlusAI token comes from a pool (rotated per request), use the `fetch` callback pattern so tokens are resolved at request time, not at MCPClient construction time.

**Warning signs:**
- MCPClient connects but all tool calls return 401
- "Bad credentials" errors after SSE connection appears to establish
- Auth works in manual `fetch()` test but not through MCPClient
- MCPClient falls back to SSE silently and then fails

**Phase to address:**
Mastra MCP Client phase -- auth injection pattern must be correct from the first connection attempt.

---

### Pitfall 5: Replacing Drive Fallback Search Without Preserving the Multi-Pass Retrieval Contract

**What goes wrong:**
The existing `atlusai-search.ts` has a carefully designed multi-pass retrieval system: primary pillar search (20 slides), secondary pillar searches (5 each), case study search (5), with three-tier fallback broadening when results are sparse. The `searchForProposal()` function returns `ProposalSearchResult` with per-pass counts for diagnostics. Replacing Drive-based search with MCP-based search seems simple -- swap the underlying `searchSlides()` call -- but the MCP tools (`knowledge_base_search_semantic`, `knowledge_base_search_structured`) return different result shapes, have different pagination, and may not support the same filtering. If the replacement only swaps the search call without preserving the multi-pass logic, fallback tiers, and deduplication, proposal quality degrades silently.

**Why it happens:**
The temptation is to rip out `atlusai-search.ts` entirely and replace it with direct MCP calls. But `searchForProposal()` and `searchByCapability()` are consumed by 5 workflow files (`touch-1` through `touch-4` and `pre-call`). Each expects the `SlideSearchResult` interface. The MCP tools return different fields. A naive replacement breaks the contract.

**How to avoid:**
1. Keep the `SlideSearchResult` interface as the public API contract. The replacement should only change the internal implementation of `searchSlides()`.
2. Create an adapter that maps MCP `knowledge_base_search_semantic` results to `SlideSearchResult`:
   - Map MCP document fields to `slideId`, `textContent`, `speakerNotes`, `metadata`
   - Preserve `presentationId` and `slideObjectId` extraction from MCP metadata
3. Keep `searchForProposal()` and `searchByCapability()` unchanged -- they orchestrate multiple `searchSlides()` calls and handle deduplication/fallback.
4. Run a side-by-side comparison: for the same query, compare Drive search results vs MCP search results. Verify that MCP returns equal or better quality before cutting over.
5. Keep the Drive fallback path available (behind a feature flag) during the transition. If MCP search returns poor results or is down, fall back to Drive search.

**Warning signs:**
- Workflows that previously generated good slide selections now produce irrelevant results
- `searchForProposal()` returning 0 candidates (MCP search returning empty)
- Type errors in workflow files after search replacement (interface mismatch)
- Loss of per-pass count diagnostics (primaryCount, secondaryCount, caseStudyCount)

**Phase to address:**
Replace Drive Fallback phase -- must be an adapter swap, not a rewrite of the retrieval orchestration.

---

### Pitfall 6: Extending ActionRequired Model With New Types Breaks Existing Switch Statements and Icon Mapping

**What goes wrong:**
The existing `actions-client.tsx` has a `getActionIcon()` function that switches on `actionType`: `reauth_needed`, `share_with_sa`, `drive_access`. Adding new types (`atlus_account_required`, `atlus_project_required`) without updating this switch falls through to the `default` case (generic gray icon). The agent-side code that creates `ActionRequired` records also has hardcoded type-specific logic (e.g., the Google pool creates `reauth_needed` with specific title/description patterns). Adding new types without updating ALL consumers of `actionType` creates inconsistent behavior.

**Why it happens:**
The `actionType` field is a plain `String` in Prisma, not an enum. There is no compile-time check when new types are added. The consumers are split across apps: agent creates records, web displays them. Adding a type on the agent side without updating the web side is easy to miss.

**How to avoid:**
1. Define a shared `ACTION_TYPES` constant in `packages/schemas` that lists all valid action types. Both agent and web import from this single source.
2. When adding new types, grep for ALL `actionType` references across both apps. Key files to update:
   - `apps/web/src/app/(authenticated)/actions/actions-client.tsx` -- icon mapping, display logic
   - `apps/web/src/lib/actions/action-required-actions.ts` -- any type-specific server actions
   - `apps/agent/src/lib/google-auth.ts` -- existing type creation
   - `apps/agent/src/mastra/index.ts` -- any route-level type handling
3. Add an icon and description for every new `actionType` in `getActionIcon()` BEFORE the agent starts creating records with that type.
4. Consider adding a `resolutionUrl` field to `ActionRequired` so the UI can show a "Fix this" button that navigates to the appropriate page (e.g., AtlusAI login page, Google re-auth page).

**Warning signs:**
- New action types appearing in the UI with generic gray icons
- Action descriptions that are confusing because the web app does not know how to format them
- Users seeing "Action Required" items with no clear resolution path

**Phase to address:**
Action Required Integration phase -- shared type definition must ship before either app creates records with new types.

---

### Pitfall 7: Discovery UI Browse/Search/Ingest State Machine Becomes Spaghetti Without Explicit State Management

**What goes wrong:**
The Discovery UI has three modes (browse, search, ingest) with complex transitions: browse lists projects/documents, search returns results with selection, ingest takes selected items through a multi-step pipeline (fetch slides, embed, classify, save). Without explicit state management, the component accumulates `useState` hooks for: current mode, search query, search results, selected items, ingestion progress per item, error states per item, and filter state. State interactions become unpredictable -- a user searches, selects items, switches to browse, comes back to search, and the selection is lost. Ingestion progress overwrites search results in the same state variable.

**Why it happens:**
React `useState` works for simple UIs but breaks down for multi-phase flows with intermediate state. The project's existing pattern (see `touch-4-form.tsx` stepper) uses a monotonic set pattern for progress, but the Discovery UI has bidirectional navigation (browse <-> search, select <-> deselect) that monotonic patterns do not support.

**How to avoid:**
1. Use `useReducer` with explicit states and transitions:
```typescript
type DiscoveryState =
  | { mode: 'browse'; projects: Project[]; loading: boolean }
  | { mode: 'search'; query: string; results: SearchResult[]; selected: Set<string> }
  | { mode: 'ingesting'; items: IngestItem[]; progress: Map<string, IngestStatus> }
```
2. Keep selected items as a `Set<string>` that persists across mode switches (browse and search share the same selection).
3. Separate data fetching state from UI mode state. Search results and browse data should live in separate state slices, not be mutually exclusive.
4. For ingestion progress, use a `Map<itemId, status>` where status is `'pending' | 'fetching' | 'embedding' | 'classifying' | 'done' | 'error'`. This maps naturally to a progress UI per item.
5. Follow the existing polling pattern (used in template ingestion) for long-running operations. Do NOT use SSE from the web app for ingestion progress -- the web app is on Vercel where SSE is unreliable.

**Warning signs:**
- More than 8 `useState` hooks in a single component
- State interactions causing stale renders (search results from previous query appearing during new search)
- Ingestion progress not updating (state update batching issues)
- User selections disappearing on mode switch

**Phase to address:**
Discovery UI phase -- `useReducer` state machine must be designed before UI implementation begins.

---

### Pitfall 8: MCPClient Token Rotation Creates Stale Credential in SSE Connection

**What goes wrong:**
The `MCPClient` is created with an AtlusAI token injected via `fetch` callback or `requestInit`. AtlusAI tokens may expire or rotate (similar to Google OAuth). If the token is captured by closure at MCPClient creation time, the SSE connection continues using the stale token. Eventually the server rejects requests with 401, but the SSE transport connection itself may still be "alive" (EventSource reconnects automatically). The health check (`listTools()`) might pass (server accepts the SSE connection) but tool calls fail (server rejects the tool invocation).

**Why it happens:**
SSE connections are long-lived. The auth token is provided at connection time. If the token expires after the connection is established, different MCP servers handle this differently -- some reject mid-connection, others reject only new tool calls. The `MCPClient`'s `fetch` callback is called for POST requests (tool invocations) but the SSE GET connection was established with the original token.

**How to avoid:**
1. Use the `fetch` callback pattern (not `requestInit`) so that every POST request to the MCP server gets a fresh token:
```typescript
fetch: async (url, init) => {
  const freshToken = await getPooledAtlusAuth(); // get fresh token from pool
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${freshToken}` },
  });
}
```
2. Implement a periodic SSE reconnect (every 30 minutes) that tears down and re-creates the MCPClient with a fresh token. This ensures the SSE connection itself has valid credentials.
3. On 401 from any tool call, immediately disconnect and re-create the MCPClient with a new pooled token.
4. Do NOT cache the MCPClient indefinitely. Set a max lifetime (e.g., 1 hour) after which it is forcibly recycled.

**Warning signs:**
- Tool calls returning 401 while `listTools()` succeeds
- MCPClient working for hours then suddenly failing
- All tool calls failing simultaneously (token expiry affects all operations)

**Phase to address:**
Mastra MCP Client phase and Auth & Token Pool phase -- token freshness and MCPClient lifecycle must be coordinated.

---

### Pitfall 9: AtlusAI 3-Tier Access Detection Creates False Negatives During Pool Initialization

**What goes wrong:**
The v1.4 spec calls for 3-tier access detection: (1) has AtlusAI account, (2) has accessible project, (3) can search content. During initial pool setup, if a user has an AtlusAI account but no project access, the system should create an `atlus_project_required` action. But if the detection runs before the user has logged in and stored their AtlusAI token, the detection returns "no account" (tier 1 failure) which masks the actual issue (tier 2 -- no project). When the user creates an account and provides credentials, the system may not re-run detection to discover the tier 2 issue.

**Why it happens:**
Access detection is a waterfall: each tier depends on the previous. If tier 1 fails, tiers 2 and 3 are never checked. But the resolution for tier 1 (user creates account) should trigger a re-check of tiers 2 and 3. Without an event-driven re-check, the `ActionRequired` record for tier 1 is resolved (user has account now) but tiers 2 and 3 are never evaluated until the next background job attempts to use AtlusAI.

**How to avoid:**
1. When resolving an `atlus_account_required` action (user provides credentials), immediately run the full 3-tier detection again. Create any needed tier 2/3 actions right away.
2. Store the access detection result alongside the token: a `accessLevel` field on `UserAtlusToken` with values `'none' | 'account_only' | 'project_access' | 'full_access'`.
3. Re-run detection on token store/update, not just on background job failure.
4. Show all three tiers in the Action Required UI as a checklist (like an onboarding flow), not as individual disconnected items.

**Warning signs:**
- User resolves "create AtlusAI account" action but still cannot use AtlusAI features
- No new `ActionRequired` created after account creation (detection not re-triggered)
- Users stuck in a loop of resolving one action only to discover another

**Phase to address:**
Auth & Token Pool phase -- 3-tier detection must be re-triggerable, not one-shot.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single MCPClient with no reconnect logic | Faster initial integration | Silent failures after network blips, requires agent restart to recover | Never -- reconnect wrapper from day one |
| Storing AtlusAI token in plaintext (not encrypted) | Faster implementation | Inconsistent with Google token pattern, security liability | Never -- use existing `token-encryption.ts` for consistency |
| Hardcoding AtlusAI SSE URL in MCPClient config | One less env var | Cannot switch environments (staging/prod AtlusAI) without code change | Only during initial development; extract to env var before merge |
| Flat ActionRequired list without grouping | Simpler UI component | Users overwhelmed when they have both Google and AtlusAI issues | Acceptable for initial launch; add grouping when > 3 action types exist |
| Creating MCPClient per request instead of singleton | Avoids stale connection issues | Memory leaks (MCPClient instances accumulate), SSE connection storm on server | Never -- use singleton with health check |
| Skipping Drive fallback feature flag during MCP cutover | Simpler code path | No rollback if MCP search quality is worse than Drive search | Never -- keep Drive fallback until MCP search is validated |
| Discovery UI with raw useState (no useReducer) | Faster initial UI prototype | State spaghetti within 2 weeks, hard to add new flows | Only for throwaway prototype; refactor before merge |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCPClient + SSE auth | Setting `requestInit` headers only | Set auth in `fetch` callback OR both `requestInit` AND `eventSourceInit` -- SSE uses different config from HTTP |
| MCPClient + Vercel | Creating MCPClient in web app Server Actions | MCPClient lives only on Railway agent; web calls agent API endpoints that proxy to MCP |
| MCPClient + singleton | Re-creating without calling `disconnect()` first | Always `disconnect()` before re-creating; use `id` parameter to prevent memory leak errors |
| AtlusAI token pool + Google token pool | Sharing `ActionRequired` type names | Use distinct, prefixed action types: `google_reauth_needed` vs `atlus_account_required` |
| MCP search + existing retrieval | Replacing `searchForProposal()` entirely | Only replace the internal `searchSlides()` implementation; keep the multi-pass orchestration unchanged |
| AtlusAI search results + SlideSearchResult | Assuming MCP returns same fields as Drive search | Build an explicit adapter layer that maps MCP result shape to existing `SlideSearchResult` interface |
| Discovery UI + ingestion pipeline | Calling ingestion synchronously from the UI | Use the existing `ingestionQueue` pattern -- enqueue items, poll for progress |
| Two token pools + background jobs | Checking pools sequentially (Google first, then AtlusAI on failure) | Check both pools upfront before starting the operation; create all needed `ActionRequired` records at once |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Creating new MCPClient per MCP operation | 2-5 second SSE handshake delay per operation; connection storm on AtlusAI server | Singleton with health check wrapper | Immediately noticeable on first use |
| Searching AtlusAI with broad queries returning 100+ results | MCP tool call takes 10+ seconds; response too large for SSE message frame | Limit results in MCP tool parameters; paginate if supported | > 50 concurrent searches |
| Discovery UI fetching all AtlusAI projects on page load | Page load takes 5+ seconds; unnecessary API calls when user navigates away | Lazy load projects on first browse tab click; cache in React state | > 100 projects in AtlusAI |
| Polling ingestion progress too aggressively from Discovery UI | Agent API overwhelmed with status checks; Vercel function invocations spike | Poll every 3-5 seconds (matching existing template ingestion pattern); use exponential backoff when idle | > 5 concurrent ingestions |
| Two token pools both doing concurrent health checks | Double the database queries per background job cycle | Stagger pool health checks; Google pool checks on even minutes, AtlusAI pool on odd minutes | > 50 background job cycles/hour |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging AtlusAI access tokens in agent debug output | Token leakage in Railway logs; anyone with log access gets AtlusAI credentials | Never log tokens; log only `source: 'pool'` and `userId` without the token value |
| Storing AtlusAI tokens without encryption | Inconsistent with Google token handling; database compromise exposes all AtlusAI credentials | Use existing `encryptToken` / `decryptToken` from `token-encryption.ts` |
| Passing AtlusAI tokens from web to agent without HTTPS | MITM interception of credentials | Already mitigated -- both Vercel and Railway enforce HTTPS; verify agent service URL uses `https://` |
| MCPClient `fetch` callback not checking token expiry before use | Expired token sent to AtlusAI server; 401 error cascade | Check token `expiresAt` before use; refresh if needed; mark invalid if refresh fails |
| Exposing MCP tool results directly in web API responses | AtlusAI content that should require auth is visible to any authenticated user | Verify user has AtlusAI access before returning MCP results; filter by user's project access |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing AtlusAI connection errors with technical MCP jargon ("SSE transport failed", "initialize handshake timeout") | User has no idea what happened or how to fix it | Show user-friendly message: "AtlusAI is temporarily unavailable. Your search will use local slides instead." with automatic Drive fallback |
| Discovery UI browse loads entire AtlusAI catalog at once | Slow initial load, overwhelming content list | Paginated browse with folder/project hierarchy; lazy-load children on expand |
| Ingestion progress showing only "in progress" with no per-slide detail | User cannot tell if ingestion is stuck or just slow | Reuse existing ingestion progress pattern: "Processing slide N of M... Classifying..." |
| Action Required page showing AtlusAI setup actions to users who do not need AtlusAI | Confusion: "What is AtlusAI and why do I need it?" | Only show AtlusAI actions to users who have attempted to use AtlusAI features (triggered by first Discovery page visit) |
| Search results from AtlusAI showing raw document metadata instead of formatted previews | Users cannot evaluate result quality before ingesting | Show slide text preview, source presentation name, and classification tags in search results |
| No clear distinction between "already ingested" and "not yet ingested" AtlusAI content in Discovery UI | Users accidentally re-ingest content, creating duplicates | Mark already-ingested items with a checkmark; show "Re-ingest" instead of "Ingest" with confirmation dialog |

## "Looks Done But Isn't" Checklist

- [ ] **MCPClient SSE connection:** Connects to AtlusAI AND handles reconnect on disconnect AND handles token rotation AND health check wrapper is tested -- not just "it connected once"
- [ ] **AtlusAI token pool:** Encrypted storage AND pool iteration AND invalid token marking AND ActionRequired creation AND 3-tier access detection re-triggers on resolution -- not just "tokens are stored"
- [ ] **Drive fallback replacement:** MCP search adapter returns `SlideSearchResult` interface AND multi-pass retrieval preserved AND fallback tiers work AND side-by-side quality comparison run AND Drive fallback behind feature flag -- not just "MCP calls work"
- [ ] **Action Required extension:** New types have icons AND descriptions AND resolution URLs AND shared type constants AND UI grouping AND de-duplication -- not just "records are created"
- [ ] **Discovery UI:** Browse loads lazily AND search debounces AND selection persists across mode switches AND ingestion uses queue (not sync) AND progress polls at correct interval AND already-ingested items are marked -- not just "the page renders"
- [ ] **Token pool race conditions:** Both pools handle concurrent access without duplicate ActionRequired records AND stale token marking is idempotent AND pool health warnings do not spam logs -- not just "tokens work one at a time"

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MCPClient singleton holds dead SSE connection | LOW | Restart agent service on Railway (auto-restarts clear the singleton); add reconnect wrapper to prevent recurrence |
| Wrong auth injection pattern (requestInit only, missing eventSourceInit) | LOW | Update MCPClient config to use `fetch` callback; redeploy agent |
| Drive fallback removed before MCP search validated | MEDIUM | Re-add `atlusai-search.ts` from git history; add feature flag to switch between Drive and MCP search; run quality comparison |
| ActionRequired type mismatch between agent and web | LOW | Add missing types to `getActionIcon()` switch statement; deploy web; no data migration needed |
| Discovery UI state spaghetti | MEDIUM | Refactor to `useReducer`; extract state machine; re-test all flows (browse, search, select, ingest, error, retry) |
| AtlusAI tokens stored unencrypted | MEDIUM | Add encrypted columns via migration; encrypt all existing plaintext tokens; drop plaintext column in subsequent migration |
| MCPClient memory leak from re-creation without disconnect | LOW | Add `id` parameter to MCPClient constructor; add `disconnect()` call before re-creation; restart agent to clear accumulated instances |
| Two pools creating duplicate ActionRequired records | LOW | Add unique constraint or upsert logic on `[userId, actionType, resolved: false]`; deduplicate existing records via migration |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SSE connection lifecycle in serverless (Vercel) | Mastra MCP Client | MCPClient exists ONLY in agent code; no `@mastra/mcp` imports in `apps/web` |
| SSE reconnect on Railway | Mastra MCP Client | Agent survives `railway restart`; MCPClient reconnects; tool calls succeed within 15 seconds of restart |
| Two independent token pools cascade | Auth & Token Pool + Action Required | Both pools create distinct, de-duplicated ActionRequired records; UI groups by category |
| MCP auth credential injection | Mastra MCP Client | Tool calls authenticate successfully via `fetch` callback; token rotation does not break existing connections |
| Drive fallback replacement contract | Replace Drive Fallback | `searchForProposal()` returns same interface; workflow files unchanged; side-by-side quality comparison passes |
| ActionRequired type extension | Action Required Integration | All new types have icons, descriptions, and resolution guidance in web UI; shared constants in `packages/schemas` |
| Discovery UI state management | Discovery UI | `useReducer` manages all state; selections persist across mode switches; ingestion progress tracks per item |
| MCPClient token rotation | Mastra MCP Client + Auth & Token Pool | `fetch` callback resolves fresh token per request; periodic MCPClient recycling every 30-60 minutes |
| 3-tier access detection false negatives | Auth & Token Pool | Resolving tier 1 action triggers re-detection; tier 2/3 actions created immediately if needed |

## Sources

- [Mastra MCPClient Reference](https://mastra.ai/reference/tools/mcp-client) -- constructor parameters, `requestInit` vs `eventSourceInit`, `fetch` callback, `id` parameter, lifecycle methods
- [MCP SSE Reconnection Issue #510](https://github.com/modelcontextprotocol/typescript-sdk/issues/510) -- SSEClientTransport does not re-establish lifecycle state on disconnect/reconnect
- [MCP Transport Specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) -- SSE deprecated in favor of Streamable HTTP; session lifecycle requirements
- [Vercel Serverless Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) -- maxDuration limits per plan (60s Hobby, 300s Pro)
- [Vercel SSE Timeout Discussion](https://community.vercel.com/t/sse-requests-timing-out/7964) -- SSE connections in serverless functions
- Existing codebase: `apps/agent/src/lib/google-auth.ts` -- token pool pattern, `getPooledGoogleAuth()`, `PooledAuthResult` interface
- Existing codebase: `apps/agent/src/lib/atlusai-search.ts` -- multi-pass retrieval, `searchForProposal()`, `SlideSearchResult` interface
- Existing codebase: `apps/agent/src/lib/atlusai-client.ts` -- SSE endpoint URL, known MCP tools, auth discovery
- Existing codebase: `apps/web/src/app/(authenticated)/actions/actions-client.tsx` -- `getActionIcon()` switch, Action Required UI
- Existing codebase: `apps/agent/prisma/schema.prisma` -- `ActionRequired` model, `UserGoogleToken` model
- Existing codebase: `.mcp.json` -- AtlusAI SSE endpoint configuration
- v1.3 Phase 24 research: `24-RESEARCH.md` -- token pool patterns, race condition analysis, ActionRequired creation patterns

---
*Pitfalls research for: v1.4 AtlusAI Authentication & Discovery*
*Researched: 2026-03-06*
