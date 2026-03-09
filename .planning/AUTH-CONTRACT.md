## Auth Header Contract (Web <-> Agent)

### Current Behavior
- **Web app** (`apps/web/src/lib/api-client.ts`): Sends `Authorization: Bearer <AGENT_API_KEY>`
- **Agent service** (`apps/agent/src/mastra/index.ts`): Configures `SimpleAuth` with `headers: ["X-API-Key"]`
- **CORS config**: Allows both `Authorization` and `X-API-Key` headers
- **Runtime**: Works because Mastra internally maps Bearer tokens to SimpleAuth validation

### Risk
Fragile to Mastra version upgrades. If Mastra stops accepting Bearer as X-API-Key fallback, all web-to-agent calls will fail with 401.

### Recommended Future Fix
Align on one header. Either:
1. Change web `fetchAgent()` to send `X-API-Key: <key>` header (preferred -- matches SimpleAuth config)
2. Change agent SimpleAuth to `headers: ["Authorization"]`

### Decision Log
- Phase 45: Discovered Mastra auth issue, chose Bearer workaround (see STATE.md)
- Phase 45-07: Gap closure attempted X-API-Key alignment but reverted due to Mastra internals
