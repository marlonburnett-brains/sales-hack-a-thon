---
status: awaiting_human_verify
trigger: "agent-deck-structure-analyst-not-found"
created: 2026-03-08T00:00:00Z
updated: 2026-03-08T00:00:00Z
---

## Current Focus

hypothesis: Agent catalog rows were never seeded in the database for deck-structure-analyst
test: Added startup seed call to ensure all catalog agents exist in DB
expecting: Cron no longer fails with "Agent deck-structure-analyst was not found"
next_action: User verifies the fix by running `make run dev` and checking cron logs

## Symptoms

expected: Deck structure inference should complete successfully for touch_2 and touch_3
actual: Error "Agent deck-structure-analyst was not found" during deck-infer-cron cycle
errors: |
  [deck-infer-cron] Error inferring touch_2: Agent deck-structure-analyst was not found.
  [deck-infer-cron] Error inferring touch_3: Agent deck-structure-analyst was not found.
reproduction: Run `make run dev` - the deck-infer-cron triggers every 10 minutes and fails
started: Currently happening on startup

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-03-08
  checked: grep for "deck-structure-analyst" across codebase
  found: Agent is defined in AGENT_CATALOG (packages/schemas/agent-catalog.ts line 203) and referenced in infer-deck-structure.ts line 459
  implication: The agent ID is correct and consistently used

- timestamp: 2026-03-08
  checked: agent-config.ts getPublishedAgentConfig() at line 174
  found: Error message "Agent ${agentId} was not found." thrown when prisma.agentConfig.findUnique returns null
  implication: The error is a database lookup failure, not a code reference issue

- timestamp: 2026-03-08
  checked: Where seedPublishedAgentCatalog is called
  found: Only called from prisma/seed.ts (manual seed) and tests. No auto-seed at startup.
  implication: If `prisma db seed` was never run (or run before this agent was added to catalog), the DB row is missing

## Resolution

root_cause: |
  The `getPublishedAgentConfig("deck-structure-analyst")` function queries the `AgentConfig` database
  table, but no startup mechanism ensures catalog agents are seeded. The seed only runs via manual
  `prisma db seed`. If the seed was never run or was run before deck-structure-analyst was added to
  AGENT_CATALOG, the DB row is missing.

fix: |
  Added `seedPublishedAgentCatalog(prisma)` call to the Mastra startup sequence in
  apps/agent/src/mastra/index.ts. This is idempotent (skips existing agents) and runs
  before the deck inference cron fires its first cycle (15s delay).

verification: Awaiting user verification via `make run dev`

files_changed:
  - apps/agent/src/mastra/index.ts (added import + startup seed call)
