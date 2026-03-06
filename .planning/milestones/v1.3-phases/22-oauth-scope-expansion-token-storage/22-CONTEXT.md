# Phase 22: OAuth Scope Expansion & Token Storage - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Capture Google OAuth tokens with expanded scopes during login and store encrypted refresh tokens per user. This phase adds scopes, offline access, and the UserGoogleToken model with AES-256-GCM encryption. It does NOT modify Google API client factories (Phase 23) or implement the background token pool (Phase 24).

</domain>

<decisions>
## Implementation Decisions

### Re-consent experience
- Force re-login on next visit for existing users who don't have a stored token
- Detection: middleware checks if user has a `UserGoogleToken` record in DB; if not, sign out and redirect to login
- Login page shows message: "We've upgraded Drive access. Please sign in again to continue."
- Re-consent check frequency: Claude's discretion (balance reliability vs. performance)

### Scope configuration
- Scopes configured in code via `signInWithOAuth` options, not in Supabase Dashboard
- Use standard read scopes: `drive.file`, `presentations`, `documents` (future-proofs for v2 write operations)
- Consent prompt: conditional -- force `prompt: 'consent'` only when user has no stored token; use `prompt: 'select_account'` for returning users with existing tokens (avoids constant re-consent)
- Google Cloud Console OAuth consent screen scope configuration is a manual deploy step (documented in deploy checklist, not automated)

### Token storage API
- New `POST /tokens` route on agent service
- Uses existing `AGENT_API_KEY` Bearer auth (consistent with all web->agent calls)
- Refresh token sent raw over HTTPS; agent encrypts with `GOOGLE_TOKEN_ENCRYPTION_KEY` before storing
- Auth callback awaits confirmation from agent before redirecting user
- Agent response format: Claude's discretion (follow existing api-client.ts patterns)

### Error handling on missing token
- If Google doesn't return a refresh token, allow login but flag user for re-consent on next visit
- Subtle badge/icon in nav/profile area when user is operating without a Google token (service account fallback)
- If agent token storage call fails during callback: show toast warning after redirect ("Drive access setup incomplete. Sign out and back in to retry.") using Sonner
- Dedicated "Connect Google" button in profile/settings area for users to manually retry consent/token setup

### Claude's Discretion
- Re-consent check frequency (every page load vs. once per session vs. cached)
- Agent token storage response format
- Exact wording and placement of the "Limited Drive access" badge
- "Connect Google" button placement and design in profile/settings area
- Toast notification exact copy

</decisions>

<specifics>
## Specific Ideas

- Re-login message should be brief and friendly: "We've upgraded Drive access. Please sign in again to continue."
- Standard read scopes chosen over narrowest read-only to future-proof for v2 write scope expansion
- Conditional consent avoids pestering returning users while guaranteeing initial token capture

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/login/page.tsx`: Current login page with `signInWithOAuth` -- add scopes, offline access, and conditional prompt here
- `apps/web/src/app/auth/callback/route.ts`: Auth callback with domain enforcement -- add token capture and agent storage call here
- `apps/web/src/lib/api-client.ts`: `fetchJSON` wrapper with AGENT_API_KEY auth -- add `storeGoogleToken()` function here
- `apps/web/src/lib/supabase/client.ts`: Browser Supabase client -- session contains `provider_refresh_token` after consent
- Sonner toast library already installed for notifications

### Established Patterns
- All web->agent communication goes through `api-client.ts` `fetchJSON` with Bearer token auth
- Prisma schema lives in `apps/agent/prisma/schema.prisma` with forward-only migrations
- Agent routes registered in `apps/agent/src/mastra/index.ts`
- Node.js `crypto` for encryption (no external dependencies per requirements)

### Integration Points
- `apps/web/src/middleware.ts`: Auth middleware -- add re-consent check here
- `apps/agent/src/mastra/index.ts`: Register new `/tokens` route
- `apps/agent/prisma/schema.prisma`: Add `UserGoogleToken` model
- New file: `apps/agent/src/lib/token-encryption.ts` for AES-256-GCM encrypt/decrypt
- New env var: `GOOGLE_TOKEN_ENCRYPTION_KEY` on agent service

</code_context>

<deferred>
## Deferred Ideas

- Token management admin UI (valid count, per-user status, manual revocation) -- v2 requirement TMUI-01/02
- Write scope expansion for Drive output to user folders -- v2 requirement WRIT-01/02
- Automatic scope upgrade detection (detecting when scopes change and prompting re-consent) -- explicitly out of scope per REQUIREMENTS.md

</deferred>

---

*Phase: 22-oauth-scope-expansion-token-storage*
*Context gathered: 2026-03-06*
