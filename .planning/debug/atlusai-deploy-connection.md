---
status: awaiting_human_verify
trigger: "AtlusAI connection page shows 'AtlusAI Not Available - No AtlusAI credentials configured' on Vercel/Railway deployment. Works fine locally."
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED -- The "no_tokens" state is EXPECTED for a fresh deployment. The real problem is the discovery page shows a dead-end "Connect AtlusAI" link to /actions, but there is no AtlusAI action card on the /actions page unless one was previously created by detectAtlusAccess(). The chicken-and-egg: you need a token to trigger detectAtlusAccess() which creates the action card, but you need the action card to find the OAuth connect button. Additionally, isMcpAvailable() returns false because initMcp() sets fallbackMode=true when no tokens exist yet, but the access-check endpoint conflates "MCP SSE connection not established" with "no tokens available" -- when tokens ARE added later via OAuth, isMcpAvailable() stays false until the agent process restarts.
test: N/A -- confirmed via code trace
expecting: N/A
next_action: Fix the discovery page to link directly to /auth/atlus/connect instead of /actions, and fix the access-check endpoint to re-initialize MCP after a token is stored

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

- timestamp: 2026-03-07T00:00:35Z
  checked: Web .env.prod
  found: AGENT_SERVICE_URL=https://FILL_IN_PRODUCTION_AGENT_URL (placeholder), WEB_APP_URL=https://FILL_IN_PRODUCTION_WEB_URL (placeholder in agent .env.prod)
  implication: These placeholders suggest deployment env vars may be set in Vercel/Railway dashboard directly, not from these files. Not the root cause of the AtlusAI issue.

## Resolution

root_cause: Two interconnected issues prevent AtlusAI from working on fresh deployment: (1) The discovery page "Connect AtlusAI" button links to /actions, but /actions only shows the connect button when an atlus_account_required ActionRequired record exists -- which is only created by detectAtlusAccess(), creating a chicken-and-egg problem. (2) Even after a user successfully completes OAuth and tokens are stored, `isMcpAvailable()` returns false because `fallbackMode` was set to true during boot and the store-token endpoint never resets it or re-initializes MCP.
fix: Three targeted changes - (1) Changed discovery page "Connect AtlusAI" button from Link to /actions to an anchor to /auth/atlus/connect so users go directly to OAuth flow. (2) After storing OAuth tokens with full_access result, call initMcp() to re-establish MCP connection, clearing fallbackMode without requiring agent restart. (3) After successful OAuth with full_access, redirect user to /discovery instead of /actions so they immediately see their content.
verification: TypeScript type-check passes (all errors are pre-existing in test files). Code logic verified by reading full flow end-to-end.
files_changed:
  - apps/web/src/app/(authenticated)/discovery/page.tsx
  - apps/agent/src/mastra/index.ts
  - apps/web/src/app/auth/atlus/callback/route.ts
