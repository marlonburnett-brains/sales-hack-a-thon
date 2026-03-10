---
status: awaiting_human_verify
trigger: "Touch 3 (Capability Alignment) generation fails to find any slides because the AtlusAI MCP tool call doesn't include aiProjectId"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - searchSlidesMcp passes project_id instead of aiProjectId to MCP tool
test: Compared atlusai-search.ts (line 90) with index.ts (line 2480)
expecting: MCP tool expects aiProjectId parameter, not project_id
next_action: Fix parameter name in atlusai-search.ts

## Symptoms

expected: Touch 3 generation should search AtlusAI for capability slides matching the deal/prospect
actual: MCP search fails with "Multiple projects available. Please specify aiProjectId" error, falls back to Drive, finds 0 slides
errors: MCP tool error - "Multiple projects available. Please specify aiProjectId from: hack-a-thon, Weight Watchers..."
reproduction: POST /deals/cmmij6r6e0016vd0jwlqxqiwz/touch/3
started: Since multiple projects were added to AtlusAI

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:01:00Z
  checked: apps/agent/.env for ATLUS_PROJECT_ID
  found: ATLUS_PROJECT_ID=b455bbd9-18c7-409d-8454-24e79591ee97 (correctly set)
  implication: The env var exists, so the issue is not a missing config

- timestamp: 2026-03-09T00:02:00Z
  checked: atlusai-search.ts searchSlidesMcp function (lines 87-90)
  found: Code passes args.project_id = env.ATLUS_PROJECT_ID
  implication: Wrong parameter name - MCP tool expects aiProjectId

- timestamp: 2026-03-09T00:03:00Z
  checked: mastra/index.ts line 2479-2480 (working MCP call elsewhere)
  found: Working code uses args.aiProjectId = env.ATLUS_PROJECT_ID
  implication: Confirms correct parameter name is aiProjectId, not project_id

## Resolution

root_cause: In atlusai-search.ts line 90, searchSlidesMcp passes the project ID as `project_id` but the AtlusAI MCP tool expects the parameter name `aiProjectId`. The env var ATLUS_PROJECT_ID is correctly set but mapped to the wrong argument key. This causes the MCP server to return "Multiple projects available. Please specify aiProjectId" error, triggering the Drive fallback which finds nothing.
fix: Change args.project_id to args.aiProjectId in atlusai-search.ts line 90
verification: Code change verified - parameter name matches working usage in index.ts line 2480. Tests updated to match. Pre-existing TS errors unrelated to change.
files_changed:
  - apps/agent/src/lib/atlusai-search.ts
  - apps/agent/src/lib/__tests__/atlusai-search.test.ts
