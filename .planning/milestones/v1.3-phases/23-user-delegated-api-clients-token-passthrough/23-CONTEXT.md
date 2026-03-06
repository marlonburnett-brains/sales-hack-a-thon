# Phase 23: User-Delegated API Clients & Token Passthrough - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Modify Google API client factories to accept user tokens and wire up the web->agent token passthrough for all interactive requests. This phase makes `getSlidesClient()`, `getDriveClient()`, and `getDocsClient()` dual-mode (user token or service account), adds `fetchWithGoogleAuth()` on the web side, and implements graceful failure with browser-side retry queue. Background token pool is Phase 24; integration verification is Phase 25.

</domain>

<decisions>
## Implementation Decisions

### Token type & refresh strategy
- Primary: Access token from Supabase session (`provider_token`) sent as `X-Google-Access-Token` header
- Backup: When no access token in session, web sends `X-User-Id` header; agent retrieves stored refresh token, exchanges for access token
- Agent caches refreshed access tokens in memory with ~50min TTL (Google access tokens last 1h)
- Priority chain: `X-Google-Access-Token` header (use directly) -> `X-User-Id` header (agent-side refresh) -> service account fallback
- Web sends both headers when available; agent tries in priority order

### Fallback behavior on token failure
- Graceful failure: when user's Google token fails (403, revoked, insufficient scopes), show toast with two actions: "Reconnect Google" and "Run in background"
- "Reconnect Google": redirects to login for re-consent
- "Run in background": sends operation to agent using service account for now (Phase 24 upgrades to token pool)
- Browser-side retry queue: failed operations stored in React state; automatically retried when user reconnects Google
- Auth errors trigger the toast; non-auth errors bubble up normally

### Rollout scope — all interactive Google API calls
- All interactive requests get user token passthrough: template ingestion, staleness checks, slide thumbnails, Touch 1-4 workflows, pre-call briefing
- Fallback chain differs by operation type:
  - **Interactive read** (thumbnails, staleness, slide data): user token -> token pool -> service account
  - **Interactive write** (create deck, create doc, copy slides): user token -> service account (no pool for writes)
  - **Background write**: initiating user's stored token -> service account
  - **Background read** (staleness polling): initiating user's stored token -> token pool -> service account

### Server Action token plumbing
- New `getGoogleAccessToken()` helper in `lib/supabase/` — calls `getSession()`, returns `{ accessToken, userId }`
- New `fetchWithGoogleAuth<T>()` wrapper in `api-client.ts` — calls `getGoogleAccessToken()` + `fetchJSON()` with Google headers attached
- Google token headers sent only on Google-triggering requests (template ops, workflows, slides) — not on CRUD operations (companies, deals, briefs, tokens)
- Agent-side: shared `extractGoogleAuth(c)` helper reads both headers from Hono context, route handlers pass result to Google API factories

### Factory design
- `getSlidesClient()`, `getDriveClient()`, `getDocsClient()` accept optional `{ accessToken?, userId?, mode? }` parameter
- With user credentials: use `OAuth2Client` with the access token or refreshed token
- Without: fall back to existing service account behavior (backward compatible, all 14+ existing callers unchanged)
- Read vs write mode determination: Claude's discretion on whether caller specifies or factory infers

### Claude's Discretion
- Exact factory function signature design (mode parameter vs separate functions)
- In-memory cache implementation details (Map structure, cleanup strategy)
- Browser retry queue implementation (React state vs sessionStorage)
- Toast notification exact copy and timing
- Which specific agent routes need `extractGoogleAuth()` wired up
- "Run in background" endpoint design (Phase 23 uses service account; Phase 24 upgrades)

</decisions>

<specifics>
## Specific Ideas

- Priority chain pattern: access token -> user ID refresh -> service account — ensures best available auth is always used
- Browser-side retry queue should feel seamless — user reconnects and operations resume automatically
- Toast should offer both immediate (Reconnect) and deferred (Run in background) paths so user isn't blocked
- Read vs write fallback distinction: reads can safely use any valid token from pool; writes should use the initiating user's token or service account for audit trail

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/google-auth.ts`: Current factory functions (`getSlidesClient`, `getDriveClient`, `getDocsClient`) — add optional user token parameter
- `apps/web/src/lib/api-client.ts`: `fetchJSON` wrapper — add `fetchWithGoogleAuth` alongside it
- `apps/agent/src/lib/token-encryption.ts`: AES-256-GCM encrypt/decrypt — use `decryptToken()` for agent-side refresh backup
- `apps/web/src/lib/supabase/client.ts`: Browser Supabase client — `getSession()` provides `provider_token`
- Sonner toast library — for failure notification with action buttons

### Established Patterns
- All web->agent communication goes through `api-client.ts` `fetchJSON` with Bearer token auth
- Agent routes registered in `apps/agent/src/mastra/index.ts` as Hono route handlers
- Google API clients use `googleapis` library with `google.auth.GoogleAuth` for service account
- Server Actions in `apps/web/src/lib/actions/*.ts` call `api-client.ts` functions

### Integration Points
- `apps/agent/src/lib/google-auth.ts`: Add `OAuth2Client` path alongside existing `GoogleAuth`
- `apps/web/src/lib/api-client.ts`: Add `fetchWithGoogleAuth()` wrapper
- `apps/web/src/lib/supabase/`: New `google-token.ts` helper for `getGoogleAccessToken()`
- `apps/agent/src/lib/`: New `request-auth.ts` for `extractGoogleAuth()` helper
- 14+ agent files call Google API factories — all backward compatible (no changes needed)
- 5 Server Action files — template-actions, slide-actions, touch-actions need `fetchWithGoogleAuth`
- `apps/agent/src/mastra/index.ts`: Staleness polling currently calls `getDriveClient()` directly — needs user auth option

</code_context>

<deferred>
## Deferred Ideas

- Token pool with ordered fallback and health alerting — Phase 24
- Background job token selection logic — Phase 24
- Token management admin UI — v2 requirement TMUI-01/02
- Write scope expansion for Drive output to user folders — v2 requirement WRIT-01/02

</deferred>

---

*Phase: 23-user-delegated-api-clients-token-passthrough*
*Context gathered: 2026-03-06*
