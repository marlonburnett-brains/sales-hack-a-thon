# Requirements: v1.3 Google API Auth — User-Delegated Credentials

**Defined:** 2026-03-06
**Core Value:** Sellers walk into every meeting prepared and walk out with a polished, brand-compliant proposal deck in under 2 hours -- not 24 to 120 hours.
**Milestone Goal:** Replace service account with authenticated user credentials for all Google API access so the agent inherits org-wide file access naturally.

## v1.3 Requirements

### OAuth Scope Expansion

- [x] **OAUTH-01**: Google login requests Drive, Slides, and Docs read-only OAuth scopes in addition to existing profile scopes
- [x] **OAUTH-02**: Google login requests offline access (`access_type: "offline"`) to obtain a refresh token
- [x] **OAUTH-03**: Login page forces consent screen (`prompt: "consent"`) to ensure refresh token is returned on every login
- [x] **OAUTH-04**: Auth callback captures `provider_refresh_token` from Supabase session after code exchange

### Token Storage

- [x] **TOKS-01**: New `UserGoogleToken` Prisma model stores encrypted refresh tokens per Supabase user ID
- [x] **TOKS-02**: Refresh tokens are encrypted at rest using AES-256-GCM with a dedicated encryption key (`GOOGLE_TOKEN_ENCRYPTION_KEY`)
- [x] **TOKS-03**: Token encryption/decryption module uses Node.js built-in `crypto` (no new dependencies)
- [x] **TOKS-04**: Auth callback stores encrypted refresh token via agent API on successful login with consent
- [x] **TOKS-05**: Stored tokens track `lastUsedAt`, `isValid`, and `revokedAt` for pool health management

### User-Delegated API Clients

- [ ] **GAPI-01**: `google-auth.ts` exports `getSlidesClient()`, `getDriveClient()`, and `getDocsClient()` that accept an optional `accessToken` parameter
- [ ] **GAPI-02**: When `accessToken` is provided, API clients use `OAuth2Client` with the user's token instead of the service account
- [ ] **GAPI-03**: When no `accessToken` is provided, API clients fall back to the existing service account behavior
- [ ] **GAPI-04**: All existing callers of Google API clients (14+ files) continue to work with no changes required (backward compatible)

### Token Passthrough (Interactive Requests)

- [ ] **PASS-01**: `api-client.ts` `fetchJSON` accepts an optional Google access token and sends it as `X-Google-Access-Token` header
- [ ] **PASS-02**: Agent API routes extract `X-Google-Access-Token` header and pass it to Google API client factories
- [ ] **PASS-03**: Server Actions that trigger Google API operations retrieve the user's Google token from the Supabase session
- [ ] **PASS-04**: Template ingestion, staleness checks, and slide operations use the user's Google token when available

### Token Pool (Background Jobs)

- [ ] **POOL-01**: Background jobs (staleness polling, scheduled re-ingestion) draw from a pool of stored refresh tokens ordered by `lastUsedAt` descending
- [ ] **POOL-02**: Token pool tries up to 5 tokens with automatic fallback when a token fails (revoked/expired)
- [ ] **POOL-03**: Failed tokens are marked `isValid: false` with `revokedAt` timestamp
- [ ] **POOL-04**: Successful token usage updates `lastUsedAt` to keep the pool fresh
- [ ] **POOL-05**: System logs a warning when the valid token pool drops below 2 tokens

### Refresh Token Lifecycle

- [ ] **LIFE-01**: When Google issues a new refresh token during token refresh, the stored token is updated
- [ ] **LIFE-02**: Token refresh uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on the agent service
- [ ] **LIFE-03**: Users who re-login update their stored token (upsert on `userId`)

### Integration Verification

- [ ] **INTG-01**: Existing Touch 1-4 workflows, pre-call briefing, and template ingestion continue to function with service account fallback
- [ ] **INTG-02**: A user with Google token can access org-shared files that the service account cannot
- [ ] **INTG-03**: Background staleness polling works with pooled user tokens

## v2 Requirements

### Token Management UI

- **TMUI-01**: Admin page showing token pool health (valid count, last used, per-user status)
- **TMUI-02**: Manual token revocation from admin UI
- **TMUI-03**: Email notification when token pool drops below threshold

### Write Scope Expansion

- **WRIT-01**: Expand scopes to include Drive write access for generating decks in user-accessible folders
- **WRIT-02**: User can choose between service account shared Drive and personal Drive for deck output

## Out of Scope

| Feature | Reason |
|---------|--------|
| Domain-wide delegation | Requires Google Workspace admin involvement; user-delegated approach avoids this |
| Per-user Drive output folders | All writes go to service account shared Drive; user folders deferred to v2 |
| Token management admin UI | Health alerting via logs sufficient for ~20 users; UI deferred to v2 |
| Google service account removal | Service account remains as fallback; removal would break existing deploys |
| Multi-provider OAuth (Microsoft, etc.) | @lumenalta.com is Google Workspace; no other providers needed |
| Automatic scope upgrade detection | Users re-login manually on scope changes; automatic detection is overengineered |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OAUTH-01 | Phase 22 | Complete |
| OAUTH-02 | Phase 22 | Complete |
| OAUTH-03 | Phase 22 | Complete |
| OAUTH-04 | Phase 22 | Complete |
| TOKS-01 | Phase 22 | Complete |
| TOKS-02 | Phase 22 | Complete |
| TOKS-03 | Phase 22 | Complete |
| TOKS-04 | Phase 22 | Complete |
| TOKS-05 | Phase 22 | Complete |
| GAPI-01 | Phase 23 | Pending |
| GAPI-02 | Phase 23 | Pending |
| GAPI-03 | Phase 23 | Pending |
| GAPI-04 | Phase 23 | Pending |
| PASS-01 | Phase 23 | Pending |
| PASS-02 | Phase 23 | Pending |
| PASS-03 | Phase 23 | Pending |
| PASS-04 | Phase 23 | Pending |
| POOL-01 | Phase 24 | Pending |
| POOL-02 | Phase 24 | Pending |
| POOL-03 | Phase 24 | Pending |
| POOL-04 | Phase 24 | Pending |
| POOL-05 | Phase 24 | Pending |
| LIFE-01 | Phase 24 | Pending |
| LIFE-02 | Phase 24 | Pending |
| LIFE-03 | Phase 24 | Pending |
| INTG-01 | Phase 25 | Pending |
| INTG-02 | Phase 25 | Pending |
| INTG-03 | Phase 25 | Pending |

**Coverage:**
- v1.3 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
