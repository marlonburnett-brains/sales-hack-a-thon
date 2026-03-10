---
status: awaiting_human_verify
trigger: "Users see re-authentication notifications for OTHER users on the Action Required page"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - fetchActions() and fetchActionCount() call agent API without userId param, so all users' actions are returned
test: Verified agent route supports optional userId filter, but frontend never passes it
expecting: N/A - root cause confirmed
next_action: Apply fix across 3 files: api-client.ts, action-required-actions.ts, actions/page.tsx, and api/actions/count/route.ts

## Symptoms

expected: Action Required page should only show notifications relevant to the currently logged-in user
actual: Shows re-auth notification for rudolf.gutlich@lumenalta.com while logged in as marlon.burnett@lumenalta
errors: No error messages - logic/filtering bug
reproduction: Log in as any user, go to Action Required page, see notifications for all users
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: Agent route GET /actions (apps/agent/src/mastra/index.ts:2294)
  found: Route accepts optional userId query param; if not provided, returns ALL unresolved actions for ALL users
  implication: The backend supports filtering but frontend must pass the param

- timestamp: 2026-03-09T00:01:30Z
  checked: Frontend fetchActions() and fetchActionCount() in api-client.ts
  found: Both call agent API at /actions and /actions/count WITHOUT any userId parameter
  implication: This is the root cause - no user scoping in the API calls

- timestamp: 2026-03-09T00:02:00Z
  checked: ActionRequired.userId field in Prisma schema
  found: userId is the Supabase Auth user ID (UUID string), same as user.id from supabase.auth.getUser()
  implication: Frontend can get user.id from Supabase session and pass as userId param

- timestamp: 2026-03-09T00:02:30Z
  checked: Sidebar action count fetch (components/sidebar.tsx + api/actions/count/route.ts)
  found: Same issue - sidebar fetches /api/actions/count without user scoping, internal route calls fetchActionCount() without userId
  implication: Badge count in sidebar also shows count for ALL users' actions

## Resolution

root_cause: fetchActions() and fetchActionCount() in apps/web/src/lib/api-client.ts call the agent API without passing a userId query parameter. The agent API GET /actions and GET /actions/count routes support optional userId filtering, but since it is never provided, they return ALL users' unresolved actions. This causes cross-user visibility of re-auth notifications and inflated badge counts.
fix: Added optional userId param to fetchActions() and fetchActionCount() in api-client.ts. Updated listActionsAction() server action and GET /api/actions/count route to extract current user ID from Supabase session and pass it to agent API. Agent backend already supported userId filtering.
verification: All 7 api-client-actions tests pass (including 2 new tests for userId param). All 24 sidebar tests pass. Actions client tests have pre-existing failures unrelated to this change (useSearchParams null in test env).
files_changed:
  - apps/web/src/lib/api-client.ts
  - apps/web/src/lib/actions/action-required-actions.ts
  - apps/web/src/app/(authenticated)/api/actions/count/route.ts
  - apps/web/src/lib/__tests__/api-client-actions.test.ts
