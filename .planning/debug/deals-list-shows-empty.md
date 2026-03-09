---
status: awaiting_human_verify
trigger: "deals-list-shows-empty - Deals list page shows empty despite deals existing"
created: 2026-03-08T00:00:00Z
updated: 2026-03-08T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - assignee="all" filter bug in agent GET /deals handler
test: N/A - root cause confirmed via code trace
expecting: N/A
next_action: Apply fix to agent handler and frontend api-client

## Symptoms

expected: Open deals should appear in the deals list page after creation
actual: Deals list page shows "No deals match your filters" with count 0, even though deals exist
errors: No visible errors mentioned
reproduction: Create a new deal -> see it on its detail page -> navigate back to deals main page -> deals list is empty
started: Currently broken

## Eliminated

- hypothesis: Status value mismatch between creation and filter
  evidence: Prisma schema default is "open", page defaults filter to "open", agent handler uses exact string match -- all consistent
  timestamp: 2026-03-08T00:00:00Z

## Evidence

- timestamp: 2026-03-08T00:00:00Z
  checked: deals/page.tsx line 25-27
  found: Default status is "open", default assignee is "all"
  implication: Both "open" and "all" are sent as query params to the agent

- timestamp: 2026-03-08T00:00:00Z
  checked: api-client.ts listDealsFiltered lines 186-190
  found: params.assignee="all" is truthy, so "assignee=all" is added to query string
  implication: The "all" value is sent to the agent, not omitted

- timestamp: 2026-03-08T00:00:00Z
  checked: apps/agent/src/mastra/index.ts lines 669-677
  found: The assignee filter block runs when assigneeParam is truthy (it is "all"). Then targetUserId = "all" (since "all" !== "me"). This creates OR clause {ownerId:"all"} | {collaborators contains "all"} which matches ZERO deals.
  implication: ROOT CAUSE - "all" is treated as a specific user ID instead of being skipped

## Resolution

root_cause: In the agent GET /deals handler, the assignee filter block (line 669) checks `if (assigneeParam)` but does not exclude the value "all". When assignee="all" is passed, it creates a Prisma OR clause filtering for ownerId="all", which matches no deals.
fix: Add `&& assigneeParam !== "all"` to the assignee filter condition in the agent handler. Also fix the frontend api-client to not send assignee="all" in the first place.
verification: TypeScript compiles; logic trace confirms "all" is now excluded from Prisma where clause
files_changed:
  - apps/agent/src/mastra/index.ts (line 669: added `&& assigneeParam !== "all"` guard)
  - apps/web/src/lib/api-client.ts (line 188: skip sending assignee="all" param)
