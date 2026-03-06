# Phase 24: Token Pool & Refresh Lifecycle - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement background job token pool with ordered fallback, refresh token lifecycle management, and an Action Required UI for surfacing manual user actions. Background jobs (staleness polling, ingestion queue) draw from a pool of stored user refresh tokens before falling back to the service account. The Action Required screen tracks issues requiring user intervention (re-auth, sharing, Drive access). Phase 25 handles integration verification and cutover.

</domain>

<decisions>
## Implementation Decisions

### Pool exhaustion fallback
- Try ALL valid tokens (not capped at 5) ordered by `lastUsedAt` DESC before falling back to service account
- Service account fallback is silent unless SA itself hits a permission error
- On SA permission error: create an ActionRequired record for the affected resource ("Share [doc] with [SA email]")
- Lazy notification: users are only bothered when fallback actually fails, not preemptively

### Background job cutover
- Staleness polling AND ingestion queue both switch to pooled auth
- Strategy: pool first, service account fallback (gradual transition, no breakage risk)
- `getPooledGoogleAuth()` function returns an authenticated client from the pool
- Existing `getDriveClient()` / `getSlidesClient()` calls in background jobs updated to use pooled auth

### Alerting on low pool
- Console log warning when valid token pool drops below 3 tokens (raised from 2 given ~20 sellers)
- Low-pool alert is server-side logging only (not surfaced in Action Required UI)
- Action Required screen is reserved for per-user actionable issues

### Token rotation
- Immediate update: when Google returns a new refresh_token during OAuth2 token exchange, encrypt and upsert immediately
- No audit trail of previous tokens (upsert replaces; old tokens invalidated by Google anyway)
- Re-login upserts existing token record (userId unique constraint)

### Action Required UI
- New sidebar menu item "Action Required" with badge showing count of pending actions
- Full screen listing all pending manual actions with type, description, and resolution guidance
- Action types (extensible pattern):
  - `reauth_needed` -- user's token revoked/expired, needs to re-login
  - `share_with_sa` -- document needs explicit sharing with service account email
  - `drive_access` -- Drive access needed for a template/file (covers existing 14/17 shortcut access issue)
- Actions dismissed when resolved (user re-logins, shares doc, etc.)
- New `ActionRequired` model in Prisma schema to track pending actions

### Claude's Discretion
- `getPooledGoogleAuth()` function signature and internal caching strategy
- Action Required page layout and component design
- Badge implementation (sidebar dot/count)
- How to detect action resolution (polling vs event-driven)
- Ingestion queue integration approach (where to inject pooled auth)
- Rate limiting between token attempts in the pool

</decisions>

<specifics>
## Specific Ideas

- Action Required screen should be a general-purpose pattern for any manual user intervention, not just token issues
- Lazy notification philosophy: don't bother users unless something actually fails — surface issues only when they become blocking
- The existing 14/17 Drive shortcut access issue is a good candidate for pre-populating Action Required items
- Low-pool threshold raised to 3 (from requirement's 2) because with ~20 sellers, 2 feels thin

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/token-cache.ts`: Single-user refresh with in-memory cache, dedup, auto-invalidation -- extend for pool selection
- `apps/agent/src/lib/token-encryption.ts`: AES-256-GCM encrypt/decrypt -- use for token rotation updates
- `apps/agent/src/lib/google-auth.ts`: Dual-mode factories (user token or service account) -- add `getPooledGoogleAuth()` here
- `apps/agent/src/lib/request-auth.ts`: `extractGoogleAuth()` for request-scoped auth -- pool is for background (no request context)
- `UserGoogleToken` model with `[isValid, lastUsedAt]` index -- perfect for pool queries

### Established Patterns
- All web->agent communication via `api-client.ts` `fetchJSON` with Bearer auth
- Background jobs in `mastra/index.ts` using `setInterval` for polling
- Ingestion queue in `mastra/index.ts` processes templates sequentially
- Sonner toasts for user notifications on web side
- Sidebar nav in `apps/web` with collapsible sections (Phase 19 pattern)

### Integration Points
- `apps/agent/src/mastra/index.ts` line 46: `getDriveClient()` in staleness polling -- switch to pooled auth
- `apps/agent/src/mastra/index.ts`: ingestion queue processor -- inject pooled auth for Google API calls
- `apps/agent/prisma/schema.prisma`: Add `ActionRequired` model
- `apps/web/src/app/(authenticated)/`: Add Action Required page route
- `apps/web/src/components/nav/`: Add badge to sidebar nav item
- `apps/agent/src/mastra/index.ts`: New API routes for Action Required CRUD

</code_context>

<deferred>
## Deferred Ideas

- Token management admin UI (pool health dashboard, manual revocation) -- v2 requirement TMUI-01/02
- Email/Slack notification when pool drops below threshold -- v2 enhancement
- Write scope expansion for Drive output to user folders -- v2 requirement WRIT-01/02
- Automatic scope upgrade detection -- explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 24-token-pool-refresh-lifecycle*
*Context gathered: 2026-03-06*
