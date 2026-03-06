---
phase: 27-auth-foundation
plan: 05
status: complete
started: 2026-03-06
completed: 2026-03-06
---

## What Was Built

AtlusAI OAuth 2.0 authorization code flow with PKCE, replacing the incorrect API token paste form.

### Key Decisions

- **OAuth with PKCE instead of API token paste**: AtlusAI exposes a standard OAuth 2.0 server at `knowledge-base-api.lumenalta.com/.well-known/oauth-authorization-server` with dynamic client registration, authorization code + PKCE (S256), and refresh token support. No API tokens exist to paste.
- **Dynamic client registration per OAuth initiation**: AtlusAI's registration endpoint is open (`token_endpoint_auth_method: none`), so we register a public client each time. This avoids needing to persist a client_id across deployments.
- **Token stored as JSON blob**: OAuth access_token + refresh_token are JSON-serialized and stored in the existing `UserAtlusToken` encrypted field, avoiding schema migrations.

### Deviations from Plan

- **Complete approach change**: Plan 27-05 specified an API token paste form. This was fundamentally wrong — AtlusAI uses OAuth, not API tokens. Reverted the original 2 commits and rebuilt with OAuth 2.0.
- **No server action for OAuth initiation**: Used route handlers (`/auth/atlus/connect`, `/auth/atlus/callback`) instead of server actions, which is the standard Next.js pattern for OAuth flows requiring redirects and cookies.

## Key Files

### Created
- `apps/web/src/lib/atlus-oauth.ts` — PKCE generation, client registration, authorize URL builder, token exchange
- `apps/web/src/app/auth/atlus/connect/route.ts` — OAuth initiation (register client, set PKCE cookies, redirect to AtlusAI)
- `apps/web/src/app/auth/atlus/callback/route.ts` — OAuth callback (validate state, exchange code, store tokens, redirect to /actions)

### Modified
- `apps/agent/src/mastra/index.ts` — Added `POST /atlus/oauth/store-token` route
- `apps/web/src/lib/api-client.ts` — Added `storeAtlusOAuthToken()` function
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` — Replaced disabled Re-check Access button with "Connect to AtlusAI" OAuth link + toast feedback from OAuth redirect

## Self-Check: PASSED

- [x] OAuth connect route initiates PKCE flow with AtlusAI
- [x] Callback route exchanges code for tokens and stores via agent
- [x] Agent route encrypts and stores OAuth tokens, runs access detection
- [x] UI shows "Connect to AtlusAI" button on AtlusAI action cards
- [x] Toast feedback on OAuth success/failure
- [x] CSRF protection via state parameter
- [x] PKCE verifier stored in secure httpOnly cookies
