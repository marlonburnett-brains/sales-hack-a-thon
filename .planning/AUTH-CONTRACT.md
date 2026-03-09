## Auth Header Contract (Web <-> Agent)

### Current Behavior (Quick Task 15)
- **Web app**: Sends `Authorization: Bearer <supabase_access_token>` (the user's Supabase session JWT)
- **Agent service**: Custom `SupabaseJwtAuth` provider verifies the JWT via JWKS endpoint (supports ECC P-256 / ES256 and key rotation)
- **User identity**: Extracted from JWT `sub` claim (verified, not spoofable)
- **Google auth**: `X-Google-Access-Token` header still used for Google API calls (separate concern)

### Previous Behavior (Removed)
- Static `AGENT_API_KEY` shared secret between web and agent
- `X-User-Id` header for user identity (spoofable)
- `SimpleAuth` with `X-API-Key` header config

### Security Improvements
1. No more static shared secret (AGENT_API_KEY eliminated)
2. No more shared symmetric secret (SUPABASE_JWT_SECRET eliminated)
3. User identity verified cryptographically via asymmetric JWT signature (ES256)
4. JWKS-based verification auto-handles key rotation
5. X-User-Id header no longer sent from web app
6. Each request tied to authenticated user session

### Decision Log
- Phase 45: Discovered Mastra auth issue, chose Bearer workaround (see STATE.md)
- Phase 45-07: Gap closure attempted X-API-Key alignment but reverted due to Mastra internals
- Quick Task 15: Replaced static API key with Supabase JWT verification (permanent fix)
