---
status: awaiting_human_verify
trigger: "AtlusAI connection page shows 'AtlusAI Not Available - No AtlusAI credentials configured' on Vercel/Railway deployment. Works fine locally."
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED -- The Tier 2 project probe in detectAtlusAccess fetches https://knowledge-base-api.lumenalta.com/projects/{id}/tools which returns 404 (endpoint does not exist on the AtlusAI MCP server). The AtlusAI API is an MCP server with /sse, /auth/token, /auth/register endpoints only. ATLUS_PROJECT_ID is a filter param for MCP tool calls (project_id arg in knowledge_base_search_semantic), not a REST API resource.
test: Confirmed via direct HTTP probe -- all /projects/* paths return 404
expecting: N/A
next_action: Remove the broken Tier 2 project probe from detectAtlusAccess. If Tier 1 auth passes, grant full_access directly.

## Symptoms

expected: Clicking "Connect AtlusAI" should initiate an OAuth flow to connect AtlusAI account
actual: Page shows "AtlusAI Not Available" with "No AtlusAI credentials configured" message
errors: Not yet checked
reproduction: Visit the AtlusAI page on the deployed app (Vercel frontend / Railway backend)
started: Never worked on deployment - first time testing AtlusAI on server

## Eliminated

- hypothesis: Missing env vars for AtlusAI on deployment
  evidence: ATLUS_USE_MCP defaults to "true", ATLUS_PROJECT_ID is set in .env.prod. No ATLUS_API_TOKEN needed -- pool rotation should work once user tokens exist.
  timestamp: 2026-03-07T00:00:30Z

- hypothesis: OAuth routes missing or misconfigured
  evidence: /auth/atlus/connect and /auth/atlus/callback routes exist, use dynamic client registration (no static client_id needed), and use request.url origin for redirect URIs so they adapt to any domain automatically.
  timestamp: 2026-03-07T00:00:40Z

## Evidence

- timestamp: 2026-03-07T00:00:10Z
  checked: discovery/page.tsx access check flow
  found: Page calls checkAtlusAccessAction() -> agent GET /discovery/access-check. If hasAccess=false and reason="no_tokens", shows "Connect AtlusAI" linking to /actions page.
  implication: The connect button sends user to /actions, NOT directly to OAuth flow.

- timestamp: 2026-03-07T00:00:15Z
  checked: /discovery/access-check endpoint in agent (index.ts:1857-1881)
  found: Checks isMcpAvailable() first. If false, checks getPooledAtlusAuth() -- if null returns "no_tokens". isMcpAvailable() is a sync check on module-level `fallbackMode` boolean.
  implication: fallbackMode is set at boot time in initMcp() and stays true until agent restarts.

- timestamp: 2026-03-07T00:00:20Z
  checked: initMcp() in mcp-client.ts
  found: On boot, calls getPooledAtlusAuth(). If no pool tokens AND no ATLUS_API_TOKEN env var, sets fallbackMode=true. No ATLUS_API_TOKEN exists in .env or .env.prod.
  implication: On fresh deploy with empty DB, fallbackMode=true permanently until restart.

- timestamp: 2026-03-07T00:00:25Z
  checked: OAuth store-token endpoint (index.ts:1780-1830) and actions-client.tsx
  found: After OAuth, tokens are stored and detectAtlusAccess() runs. But nothing resets fallbackMode or re-initializes MCP. The /actions page only shows "Connect to AtlusAI" button on action cards of type atlus_account_required or atlus_project_required.
  implication: TWO problems: (1) discovery page links to /actions but no action card exists for a fresh user, (2) even after successful OAuth, isMcpAvailable() remains false until process restart.

- timestamp: 2026-03-07T00:02:00Z
  checked: Tier 2 project probe endpoint via direct HTTP
  found: GET https://knowledge-base-api.lumenalta.com/projects/b455bbd9-18c7-409d-8454-24e79591ee97/tools returns 404 {"statusCode":404,"message":"Cannot GET /projects/...","error":"Not Found"}. Also tested /project/, /api/projects/, /api/v1/projects/ -- all 404.
  implication: The project probe URL was fabricated during development. The AtlusAI MCP server has no REST endpoint for project access verification. ATLUS_PROJECT_ID is only used as a filter arg in MCP tool calls (atlusai-search.ts:89-90). The Tier 2 probe will ALWAYS fail with 404, making every user get "no_project" regardless of actual access.

- timestamp: 2026-03-07T00:00:35Z
  checked: Web .env.prod
  found: AGENT_SERVICE_URL=https://FILL_IN_PRODUCTION_AGENT_URL (placeholder), WEB_APP_URL=https://FILL_IN_PRODUCTION_WEB_URL (placeholder in agent .env.prod)
  implication: These placeholders suggest deployment env vars may be set in Vercel/Railway dashboard directly, not from these files. Not the root cause of the AtlusAI issue.

## Resolution

root_cause: THREE interconnected issues prevented AtlusAI from working on deployment. Issue 3 (NEW): The Tier 2 "project probe" in detectAtlusAccess() fetches https://knowledge-base-api.lumenalta.com/projects/{ATLUS_PROJECT_ID}/tools -- this REST endpoint does not exist on the AtlusAI MCP server (always returns 404). ATLUS_PROJECT_ID is actually a filter parameter for MCP tool calls (project_id arg), not a REST API resource. This caused every user to get "no_project" even after successful OAuth, regardless of actual access. Issues 1 and 2 (PRIOR): Discovery page chicken-and-egg linking and fallbackMode not resetting after OAuth -- already fixed.
fix: Removed the broken Tier 2 project probe from detectAtlusAccess(). If Tier 1 auth probe passes (SSE endpoint accepts the token), grant full_access directly and store the token. Also auto-resolves any existing ATLUS_PROJECT_REQUIRED action records. Project-level access errors surface naturally when the user invokes MCP tools with the project_id argument.
verification: TypeScript type-check passes (all errors are pre-existing). Direct HTTP probe confirmed /projects/{id}/tools returns 404. Code logic verified end-to-end.
files_changed:
  - apps/web/src/app/(authenticated)/discovery/page.tsx
  - apps/agent/src/mastra/index.ts
  - apps/web/src/app/auth/atlus/callback/route.ts
  - apps/agent/src/lib/atlus-auth.ts
