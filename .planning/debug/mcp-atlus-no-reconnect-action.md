---
status: awaiting_human_verify
trigger: "When the AtlusAI MCP connection fails (MCP_CLIENT_CONNECT_FAILED), no Action Required item is surfaced to the user in the UI to prompt them to reconnect."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T01:00:00Z
---

## Current Focus

hypothesis: TWO problems: (1) initMcp() health check failure and outer catch never create ActionRequired records, (2) discovery page shows generic "temporarily unavailable" with no connect button when mcp_unavailable.
test: applied fixes to both agent and frontend, verifying with human
expecting: user sees "Connect AtlusAI" button on discovery page AND sees action item in Actions page
next_action: await human verification

## Symptoms

expected: When MCP connection to AtlusAI fails and can't be recovered by refresh token, an "Action Required" action item should appear in the UI telling the user to reconnect their AtlusAI account.
actual: MCP connection fails repeatedly with MCP_CLIENT_CONNECT_FAILED error but no action item appears in the UI. The error is only visible in server logs. Discovery page shows "temporarily unavailable" with no reconnect option.
errors: MastraError - id: MCP_CLIENT_CONNECT_FAILED, domain: MCP, category: THIRD_PARTY, details: { name: 'atlus' }. Cause: "Could not connect to server with any available HTTP transport".
reproduction: Let the AtlusAI refresh token expire or become invalid. The MCP connection will fail repeatedly but no UI indicator appears.
started: Ongoing - error handling path never had this logic.

## Eliminated

- hypothesis: Previous fix (adding upsertActionRequired to handleAuthFailure only) was sufficient
  evidence: User screenshots show NO action item and "temporarily unavailable" on discovery page. handleAuthFailure() only fires on 401/403 during callMcpTool(). The actual error is MCP_CLIENT_CONNECT_FAILED at HTTP transport level in initMcp() health check, which happens BEFORE any tool call or auth check. handleAuthFailure() was never reached.
  timestamp: 2026-03-09T01:00:00Z

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: mcp-client.ts handleAuthFailure() lines 125-229
  found: When refresh fails, token is marked isValid=false in DB (line 179) and pool is rotated. When all tokens exhausted, fallbackMode=true is set. NO call to upsertActionRequired() anywhere.
  implication: Token invalidation never creates user-visible action items.

- timestamp: 2026-03-09T00:02:00Z
  checked: mcp-client.ts initMcp() lines 239-310
  found: When health check fails or no tokens available, fallbackMode=true is set with only console.warn(). No ActionRequired created.
  implication: Boot-time MCP failures also invisible to users.

- timestamp: 2026-03-09T00:03:00Z
  checked: atlus-auth.ts detectAtlusAccess() lines 173-217
  found: This function DOES call upsertActionRequired() with ATLUS_ACCOUNT_REQUIRED when auth probe fails. But it's only called from /atlus/oauth/store-token and /atlus/detect endpoints - never from runtime MCP failure paths.
  implication: The action-creation logic exists but isn't wired into the runtime failure path.

- timestamp: 2026-03-09T00:04:00Z
  checked: atlus-auth.ts getPooledAtlusAuth() line 359 comment
  found: Comment says "NOTE: Does NOT create ActionRequired on failure -- that is Plan 27-03's job."
  implication: This was a known TODO that was never implemented.

- timestamp: 2026-03-09T00:05:00Z
  checked: packages/schemas/constants.ts ACTION_TYPES
  found: ATLUS_ACCOUNT_REQUIRED already exists as an action type. UI already handles it with "Connect to AtlusAI" button in actions-client.tsx.
  implication: Only the trigger is missing; the UI rendering and action type are already in place.

- timestamp: 2026-03-09T01:00:00Z
  checked: discovery/page.tsx frontend handling of mcp_unavailable
  found: When access-check returns mcp_unavailable, the switch/case falls through to default which shows "temporarily unavailable" text and showConnectButton stays false. User has no way to act.
  implication: Even if the action item IS created, the discovery page itself gives no reconnect affordance.

- timestamp: 2026-03-09T01:01:00Z
  checked: /discovery/access-check route in mastra/index.ts
  found: When isMcpAvailable() returns false, the route checks for tokens. If tokens exist but MCP is down, it returns {hasAccess: false, reason: "mcp_unavailable"}. This is correct but the frontend doesn't act on it usefully.
  implication: The agent correctly distinguishes no_tokens vs mcp_unavailable; the frontend just doesn't show reconnect UI for mcp_unavailable.

## Resolution

root_cause: TWO gaps in the error handling chain:
  (1) initMcp() health check failure path (lines 307-316) and outer catch (lines 317-320) enter fallbackMode without creating ActionRequired records. The previous fix only added upsertActionRequired to handleAuthFailure(), but handleAuthFailure() only fires on 401/403 during callMcpTool() -- never during initMcp() boot failures. MCP_CLIENT_CONNECT_FAILED happens at the HTTP transport level BEFORE any tool call.
  (2) The discovery page frontend shows "temporarily unavailable" with no connect button when mcp_unavailable. The showConnectButton flag was only true for "no_tokens", not "mcp_unavailable".

fix: Applied 3 changes:
  (a) mcp-client.ts initMcp() health check catch: added upsertActionRequired(userId, ATLUS_ACCOUNT_REQUIRED) fire-and-forget call when health check fails
  (b) mcp-client.ts initMcp() outer catch: added same upsertActionRequired call for any unexpected init failure
  (c) discovery/page.tsx: changed mcp_unavailable case to show "Could not connect to AtlusAI. Your session may have expired." message WITH showConnectButton=true so user can re-authenticate

verification: TypeScript compiles without errors for both apps. upsertActionRequired has dedup semantics. UI already renders ATLUS_ACCOUNT_REQUIRED actions correctly. Auto-resolve happens in detectAtlusAccess() on successful OAuth.
files_changed: [apps/agent/src/lib/mcp-client.ts, apps/web/src/app/(authenticated)/discovery/page.tsx]
