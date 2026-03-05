# Phase 15: Service-to-Service Auth - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The agent server rejects all unauthorized requests with 401, and the web app authenticates every call to the agent using a shared API key sent via `X-API-Key` header. All existing workflows (Touch 1-4, Pre-Call Briefing) continue to function with auth in place.

</domain>

<decisions>
## Implementation Decisions

### Public endpoints
- Health check endpoint is public (no API key required) — for monitoring in Phase 17 deployment
- Returns simple `{ "status": "ok" }` — no version, uptime, or internal diagnostics exposed
- All other endpoints require valid API key
- Mastra built-in routes (playground, API docs) open in development, blocked in production (NODE_ENV-gated)

### Error behavior
- Generic error toast on the web side when auth fails — "Something went wrong. Please try again."
- No dedicated error page for auth failures — this is an edge case that shouldn't occur in normal operation
- Existing `fetchJSON` error handling in api-client.ts already handles non-200 responses with error messages

### Key management
- Separate API keys per environment (dev, preview, production) — prevents cross-env calls
- `X-API-Key` header — matches roadmap success criteria, avoids conflict with Phase 16 Authorization headers
- Placeholder dev key in `.env.example` for frictionless local setup — real keys only in deployed environments

### Claude's Discretion
- Health check endpoint path (e.g., /health vs /api/health)
- API key generation format (hex, UUID, etc.)
- 401 response body detail level (minimal vs descriptive)
- Console warn logging on failed auth attempts
- Exact Hono middleware implementation pattern
- How to handle the direct `fetch` call in `uploadTouch1Override` (separate from `fetchJSON`)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that all existing workflows must continue to function with auth added (no breaking changes to API contracts).

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/api-client.ts`: Central `fetchJSON` wrapper for ALL web→agent calls. Single injection point for adding `X-API-Key` header. One exception: `uploadTouch1Override` uses direct `fetch` for FormData upload — needs separate header injection.
- `apps/web/src/env.ts`: Uses `@t3-oss/env-nextjs` with `createEnv`. Currently has `AGENT_SERVICE_URL` only — add `AGENT_API_KEY`.
- `apps/agent/src/env.ts`: Uses `@t3-oss/env-core` with `createEnv`. Currently has DB, Google, and Vertex AI vars — add `AGENT_API_KEY`.

### Established Patterns
- Environment validation via `@t3-oss/env-core` / `@t3-oss/env-nextjs` with Zod schemas — new env vars follow this pattern
- Agent server runs on Mastra/Hono — middleware registration is the standard auth pattern
- All web→agent traffic is server-side (Next.js server actions / API routes) — API key never exposed to browser

### Integration Points
- `fetchJSON` in `apps/web/src/lib/api-client.ts` lines 12-27 — add `X-API-Key` header here
- `uploadTouch1Override` in same file lines 371-390 — add header to direct `fetch` call
- Mastra/Hono server initialization in `apps/agent/src/mastra/index.ts` — register auth middleware
- `.env` files in both apps — add `AGENT_API_KEY` env var
- `.env.example` files — add placeholder key for dev setup

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-service-to-service-auth*
*Context gathered: 2026-03-05*
