---
phase: 27-auth-foundation
verified: 2026-03-06T23:45:00Z
status: verified
score: 5/5 success criteria verified
gaps: []
human_verification:
  - test: "Navigate to /actions and verify Silence UX replaces Dismiss"
    expected: "BellOff icon button on non-silenced items, no Dismiss text anywhere, silenced items dimmed at opacity-50"
    why_human: "Visual rendering and interactive behavior cannot be verified programmatically"
  - test: "Click 'Connect to AtlusAI' on an AtlusAI action card"
    expected: "Redirects to AtlusAI OAuth consent page, returns to /actions with toast feedback"
    why_human: "OAuth redirect flow and toast rendering need live app"
  - test: "Verify AtlusAI action type icons render correctly"
    expected: "Purple KeyRound for atlus_account_required, indigo ShieldCheck for atlus_project_required"
    why_human: "Icon rendering and color verification needs visual inspection"
---

# Phase 27: Auth Foundation Verification Report

**Phase Goal:** Users can store AtlusAI credentials and the system detects their access level, surfacing clear guidance when action is needed
**Verified:** 2026-03-06T23:45:00Z
**Status:** verified
**Re-verification:** Yes -- re-verified after 27-05 OAuth flow implementation and pool format fix

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can connect to AtlusAI via OAuth and re-connecting updates the existing record (not duplicates) | VERIFIED | OAuth connect route at `/auth/atlus/connect` registers client, generates PKCE, redirects to AtlusAI. Callback at `/auth/atlus/callback` exchanges code, stores via `upsertAtlusToken()` (upsert on userId). Agent route `POST /atlus/oauth/store-token` encrypts tokens and runs access detection. |
| 2 | Stored tokens are encrypted at rest (AES-256-GCM) and the system tracks validity, last usage, and revocation per token | VERIFIED | `atlus-auth.ts` calls `encryptToken()` from `token-encryption.ts`. Schema has `encryptedToken`, `iv`, `authTag`, `isValid`, `lastUsedAt`, `revokedAt` fields. |
| 3 | Background processes obtain a valid AtlusAI token from the pool (ordered by last used), with automatic invalidation on failure and env var fallback when the pool is empty | VERIFIED | `getPooledAtlusAuth()` queries `findMany({ where: { isValid: true }, orderBy: { lastUsedAt: 'desc' } })`. Uses `parseStoredToken()` to handle both JSON OAuth tokens and plain string tokens. Failed tokens marked `isValid: false`. Env fallback via `process.env.ATLUS_API_TOKEN`. 7 unit tests passing. |
| 4 | When a user lacks an AtlusAI account or project access, a specific ActionRequired item appears in the sidebar with resolution guidance -- and resolving one tier immediately re-checks the next | VERIFIED | `detectAtlusAccess()` implements 3-tier cascade. Tier 1 failure creates `atlus_account_required`, Tier 2 creates `atlus_project_required`. Auto-resolves prior tier before checking next. |
| 5 | The system logs a warning when fewer than 3 valid AtlusAI tokens remain in the pool | VERIFIED | `getPooledAtlusAuth()` calls `prisma.userAtlusToken.count({ where: { isValid: true } })` and logs `console.warn('[atlus-pool] WARNING: Only N valid token(s) remaining')` when count < 3. |

**Score:** 5/5 success criteria verified

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|------------|-------------|--------|
| ATLS-01 | 27-01 | UserAtlusToken Prisma model | SATISFIED |
| ATLS-02 | 27-01 | AES-256-GCM encryption via token-encryption.ts | SATISFIED |
| ATLS-03 | 27-01 | Tracks lastUsedAt, isValid, revokedAt | SATISFIED |
| ATLS-04 | 27-05 | User-facing AtlusAI credential submission | SATISFIED -- OAuth connect flow with PKCE |
| ATLS-05 | 27-01 | Token upsert on userId (no duplicates) | SATISFIED |
| POOL-01 | 27-02 | getPooledAtlusAuth iterates by lastUsedAt desc | SATISFIED |
| POOL-02 | 27-02 | Failed tokens marked isValid:false with revokedAt | SATISFIED |
| POOL-03 | 27-02 | Successful usage updates lastUsedAt | SATISFIED |
| POOL-04 | 27-02 | Warning when < 3 valid tokens | SATISFIED |
| POOL-05 | 27-02 | ATLUS_API_TOKEN env var fallback | SATISFIED |
| TIER-01 | 27-03 | Detects no-account state, creates atlus_account_required | SATISFIED |
| TIER-02 | 27-03 | Detects no-project state, creates atlus_project_required | SATISFIED |
| TIER-03 | 27-03 | Full access pools token without ActionRequired | SATISFIED |
| TIER-04 | 27-03 | Resolving tier re-checks next tiers (cascade) | SATISFIED |
| TIER-05 | 27-03 | ActionRequired dedup per user+actionType | SATISFIED |
| ACTN-01 | 27-04 | atlus_account_required with dedicated icon | SATISFIED |
| ACTN-02 | 27-04 | atlus_project_required with dedicated icon | SATISFIED |
| ACTN-03 | 27-01 | ACTION_TYPES in packages/schemas | SATISFIED |
| ACTN-04 | 27-03 | Resolution guidance in descriptions | SATISFIED |
| ACTN-05 | 27-04 | Sidebar badge includes AtlusAI types | SATISFIED |

### Key Decisions

1. **OAuth 2.0 with PKCE instead of API token paste**: AtlusAI exposes a standard OAuth 2.0 server at `knowledge-base-api.lumenalta.com/.well-known/oauth-authorization-server` with dynamic client registration, authorization code + PKCE (S256), and refresh token support. No API tokens exist.

2. **OAuth tokens stored as JSON in encrypted field**: `{"access_token":"...","refresh_token":"..."}` is JSON-serialized and encrypted into the existing `encryptedToken` column. `parseStoredToken()` handles both JSON (OAuth) and plain string (env fallback/legacy) formats transparently.

3. **Dynamic client registration per connect**: AtlusAI's registration endpoint is open (`token_endpoint_auth_method: none`), so a public client is registered each time a user clicks "Connect to AtlusAI". This avoids needing to persist a client_id.

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| atlus-oauth.ts | knowledge-base-api.lumenalta.com | OAuth endpoints (register, authorize, token) | WIRED |
| /auth/atlus/connect | atlus-oauth.ts | generatePKCE, registerAtlusClient, buildAuthorizeUrl | WIRED |
| /auth/atlus/callback | atlus-oauth.ts + api-client.ts | exchangeCodeForTokens + storeAtlusOAuthToken | WIRED |
| api-client.ts | POST /atlus/oauth/store-token | storeAtlusOAuthToken fetch call | WIRED |
| mastra/index.ts | atlus-auth.ts | upsertAtlusToken + resolveActionsByType + detectAtlusAccess | WIRED |
| getPooledAtlusAuth | parseStoredToken | Handles JSON OAuth and plain string formats | WIRED |
| actions-client.tsx | /auth/atlus/connect | "Connect to AtlusAI" anchor link | WIRED |

### Human Verification Required

1. **Silence UX**: Navigate to /actions, verify BellOff replaces Dismiss, click Silence to dim item
2. **Connect to AtlusAI**: Click button on AtlusAI action card, verify OAuth redirect + return toast
3. **AtlusAI Icons**: Verify purple KeyRound and indigo ShieldCheck icons render

---

_Verified: 2026-03-06T23:45:00Z_
