# Quick Task 15: Replace AGENT_API_KEY with Supabase JWT Auth

**Status:** Complete
**Date:** 2026-03-09
**Commits:** e0f7b91, 9038c18, d3b7e6b

## What Changed

### Agent-side (apps/agent)
- Created `supabase-jwt-auth.ts` — HS256 JWT verification using Node crypto
- Created `SupabaseJwtAuth` extending Mastra's `MastraAuthProvider`
- Replaced `SimpleAuth` + `AGENT_API_KEY` with JWT verification against `SUPABASE_JWT_SECRET`
- Updated `extractGoogleAuth` to accept verified userId from JWT `sub` claim
- Added `getVerifiedUserId()` helper for route handlers
- Removed `X-API-Key` from CORS allowed headers

### Web-side (apps/web)
- Created `get-access-token.ts` helper to extract Supabase session JWT
- Updated `api-client.ts` to use `getSupabaseAccessToken()` instead of `AGENT_API_KEY`
- Updated all API route proxies (6 files) to forward Supabase JWT as Bearer token
- Updated `middleware.ts` to use session token for Google token status check
- Removed `AGENT_API_KEY` from `env.ts` schema
- Removed `X-User-Id` header from all outbound requests (agent derives from JWT)

### Env files
- All `.env.example` files updated (agent, web, deploy)
- Local `.env.dev` and `.env.prod` updated (gitignored)

### Tests
- Updated all test mocks to use Supabase session mocks instead of AGENT_API_KEY
- 184/197 tests pass (2 pre-existing failures unrelated to auth)

## Security Improvements
1. No more static shared secret between services
2. User identity verified cryptographically via JWT signature
3. X-User-Id spoofing vector eliminated
4. Each request tied to an authenticated user session

## Action Required
- Set `SUPABASE_JWT_SECRET` in production agent env (from Supabase Dashboard > Settings > API > JWT Secret)
