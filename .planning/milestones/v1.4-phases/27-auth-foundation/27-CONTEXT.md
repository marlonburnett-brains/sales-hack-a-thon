# Phase 27: Auth Foundation - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

AtlusAI credential storage, token pool rotation with env var fallback, 3-tier access detection, ActionRequired integration with new persistent/silenceable UX, and token capture triggered from ActionRequired items. This phase does NOT include MCP client setup (Phase 28) or Discovery UI (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Credential format
- AtlusAI uses Google OAuth SSO with @lumenalta.com emails -- same identity provider as the app
- Strategy: try reusing existing Google OAuth tokens first, fall back to separate AtlusAI auth if different scopes/client are needed
- Auth mechanism specifics are unknown -- Plan 27-01 must discover by probing the AtlusAI SSE endpoint
- UserAtlusToken model mirrors UserGoogleToken structure but may need adaptation based on discovery findings

### Token capture UI
- No dedicated settings page or credential form -- AtlusAI uses SSO, same as the MCP endpoint expects
- Credential capture is triggered from ActionRequired items in the sidebar
- If token reuse fails and separate auth is needed, the ActionRequired item provides the SSO entry point

### Access detection timing
- Check on login (try reusing Google token against AtlusAI) and on credential update
- Toast notification (Sonner) when AtlusAI access is missing -- non-blocking, user can proceed with other features
- Automatic cascade: resolving tier 1 immediately re-checks tiers 2/3 (TIER-04)
- No background periodic polling -- checks happen at login and on credential events only

### ActionRequired UX overhaul (all action types)
- Actions are persistent -- they exist as long as the issue exists, auto-resolved by the system when fixed
- No more "Dismiss" button -- replaced with "Silence" that mutes the badge count
- Silenced items: don't count toward badge AND appear visually dimmed in the list
- Re-surfacing: when the system detects the issue again, bump to top (update timestamp), un-silence automatically
- Auto-resolve: items disappear immediately when the system detects the issue is fixed
- This applies to ALL action types (reauth_needed, share_with_sa, drive_access + new AtlusAI types)
- New action types: atlus_account_required, atlus_project_required

### Claude's Discretion
- SSO redirect approach (new tab vs in-app redirect) for AtlusAI authentication
- Exact ActionRequired component refactoring approach (retrofit existing vs new component)
- Token pool health check threshold and warning log format (mirror Google pool pattern)
- Database migration strategy for ActionRequired schema changes (add silenced/seenAt fields)

</decisions>

<specifics>
## Specific Ideas

- "Action items should never be dismissable... they should exist as long as they keep being an issue"
- "The only thing that should be 'dismissable' is the increment on the badge count... if the user already saw that action item, they can choose to 'silent' it"
- "Whenever an action item is required again, it should change position to top of the list, i.e. update the requested date each time system needs it and don't have it"
- AtlusAI SSO login is the same corporate Google OAuth -- explore token reuse before building separate credential capture

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `token-encryption.ts`: AES-256-GCM encrypt/decrypt functions -- reuse directly for AtlusAI tokens
- `UserGoogleToken` model: Template for UserAtlusToken (same fields: encryptedRefresh, iv, authTag, lastUsedAt, isValid, revokedAt)
- `getPooledGoogleAuth()` in `google-auth.ts`: Pool rotation pattern to mirror for `getPooledAtlusAuth()`
- `ActionRequired` model: Already has userId, actionType, title, description, resolved fields
- `actions-client.tsx`: Current ActionRequired UI component -- needs refactoring (remove Dismiss, add Silence, add dimming)
- `action-required-actions.ts`: Server actions for list/resolve -- needs silence action added
- Sonner toast library already integrated for notifications

### Established Patterns
- Token encryption: shared `GOOGLE_TOKEN_ENCRYPTION_KEY` env var for AES-256-GCM
- Pool iteration: `findMany({ where: { isValid: true }, orderBy: { lastUsedAt: 'desc' } })`
- ActionRequired dedup: `findFirst({ where: { userId, actionType, resolved: false } })` before creating
- Fire-and-forget updates: `.update().catch(() => {})` for non-critical pool bookkeeping

### Integration Points
- `apps/agent/prisma/schema.prisma`: Add UserAtlusToken model, extend ActionRequired with silenced/seenAt
- `apps/agent/src/lib/`: New `atlus-auth.ts` alongside `google-auth.ts`
- `apps/web/src/app/(authenticated)/actions/`: Refactor actions-client.tsx for new UX
- `packages/schemas`: Action type constants shared between web and agent

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 27-auth-foundation*
*Context gathered: 2026-03-06*
