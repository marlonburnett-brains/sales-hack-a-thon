# Phase 25: Integration Verification & Cutover - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify all existing features work with the new auth model (Phases 22-24) and confirm user-delegated tokens can access org-shared files the service account cannot. Fix any issues discovered. Update documentation and requirements traceability. This is the final phase of v1.3. Phase 24 must be fully complete before Phase 25 executes.

</domain>

<decisions>
## Implementation Decisions

### Verification scope & method
- Automated vitest smoke tests with mocked Google APIs (no real API calls)
- All critical workflows covered: Touch 1-4 workflows, template ingestion & staleness polling, pre-call briefing, token pool fallback chain
- Tests verify auth path selection works correctly (user token -> pool -> service account fallback chain)
- Tests kept permanently in the codebase as regression suite

### Cutover strategy
- Service account remains as permanent fallback -- no demotion, no feature flag, no removal
- Deploy checklist updated with new v1.3 env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`
- Supabase OAuth scope configuration documented in deploy checklist
- Phase 24 must be fully executed before Phase 25 begins (hard dependency)
- REQUIREMENTS.md traceability table updated: INTG-01, INTG-02, INTG-03 marked complete when tests pass

### Failure handling
- Bugs fixed inline as discovered during verification -- not cataloged first
- Forward-only migrations allowed if schema changes are needed (CLAUDE.md compliance)
- Individual atomic commits per fix (not batched)
- Critical rework of Phase 22-24 code handled here -- this is the final phase, no deferral

### Success criteria
- All vitest smoke tests pass for every critical workflow
- REQUIREMENTS.md updated with INTG-01/02/03 completion status
- PROJECT.md updated to reflect v1.3 as shipped
- Deploy checklist documents all new env vars and Supabase configuration

### Claude's Discretion
- Test file organization (single file vs per-workflow files)
- Mock strategy and test fixtures
- Deploy checklist format and location
- PROJECT.md update scope and wording
- Specific assertions within each smoke test

</decisions>

<specifics>
## Specific Ideas

- Smoke tests should test the auth priority chain: access token header -> user ID refresh -> service account fallback
- Token pool fallback test should verify: valid token success, invalid token skip + mark invalid + ActionRequired creation, pool exhaustion -> service account
- Each workflow smoke test should verify the Google auth options are threaded through correctly from route handler to API client factory
- Deploy checklist should be a practical "new environment setup" reference, not just a list of env vars

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/agent/src/lib/google-auth.ts`: Dual-mode factories + `getPooledGoogleAuth()` -- primary verification targets
- `apps/agent/src/lib/request-auth.ts`: `extractGoogleAuth()` -- verify header extraction works
- `apps/agent/src/lib/token-cache.ts`: In-memory token cache with refresh -- verify cache hit/miss paths
- `apps/agent/src/lib/token-encryption.ts`: AES-256-GCM encrypt/decrypt -- used by pool for token rotation
- `UserGoogleToken` model with `[isValid, lastUsedAt]` index -- pool query target
- `ActionRequired` model -- created on token failure

### Established Patterns
- All web->agent communication via `api-client.ts` `fetchJSON` with Bearer auth + Google headers
- Background jobs in `mastra/index.ts` using `setInterval` for staleness polling
- Ingestion queue in `mastra/index.ts` processes templates sequentially
- Touch 1-4 workflows in `apps/agent/src/mastra/workflows/` with Mastra suspend/resume
- 14+ files call Google API factories -- all backward compatible via optional `GoogleAuthOptions`

### Integration Points
- `apps/agent/src/mastra/index.ts`: Staleness polling + ingestion queue use `getPooledGoogleAuth()`
- `apps/agent/src/mastra/index.ts`: Route handlers call `extractGoogleAuth()` for interactive requests
- `apps/web/src/lib/api-client.ts`: `fetchWithGoogleAuth()` sends Google headers
- `apps/agent/src/mastra/workflows/`: Touch 1-4 workflows receive auth options via step context

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 25-integration-verification-cutover*
*Context gathered: 2026-03-06*
