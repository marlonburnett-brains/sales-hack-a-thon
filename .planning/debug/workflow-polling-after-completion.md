---
status: awaiting_human_verify
trigger: "After a deck finishes generation for touch_2, the web frontend keeps polling the workflow status endpoint, which returns 404"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: The polling catch block in startPolling silently swallows 404 errors, so when Mastra cleans up a completed workflow run and starts returning 404, polling never stops.
test: Read the startPolling catch block and confirm it has no logic to handle persistent errors
expecting: Empty catch block that just continues polling on all errors including 404
next_action: Fix the catch block to detect 404 specifically and treat it as completion (stop polling, refresh)

## Symptoms

expected: After deck generation completes, polling should stop and UI should show the completed deck
actual: Polling continues indefinitely after completion, getting 404 "Workflow run not found" errors. UI stays stuck on generation spinner.
errors: Agent returns 404 "Workflow run not found"; Web gets 502 from /api/workflows/status; fetchJSON throws at line 52
reproduction: Generate a touch_2 deck, wait for completion. Polling continues with same runId.
started: Happening currently after deck generation completes

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-10T00:01:00Z
  checked: startPolling callback in touch-page-client.tsx lines 278-322
  found: catch block at line 316-318 is completely empty (`catch { // Continue polling on transient errors }`). It catches ALL errors including 404 from the status endpoint and just continues polling.
  implication: When Mastra returns 404 (workflow run cleaned up after completion), the error is swallowed and polling continues forever.

- timestamp: 2026-03-10T00:01:30Z
  checked: getStatusChecker function in touch-page-client.tsx lines 822-836
  found: Throws Error on any non-ok response (`throw new Error("Status check failed: ${res.status}")`). The 404 status is not differentiated from transient errors.
  implication: The status checker throws the same generic error for 404 as for 500, so the caller cannot distinguish "workflow gone" from "transient failure".

- timestamp: 2026-03-10T00:02:00Z
  checked: /api/workflows/status/route.ts error handler
  found: Catches errors from api-client and returns 502 with the error message. Does not parse or forward the original status code.
  implication: The 404 from the agent is converted to 502 before reaching the client, losing the original status information.

## Resolution

root_cause: Two-part issue: (1) getStatusChecker throws the same error for all non-ok responses, losing the 404 status code. (2) startPolling's catch block silently swallows all errors, causing it to poll forever when the workflow run no longer exists (404). The workflow/status route handler also converts all errors to 502, losing the original status code.
fix: Three changes - (1) route.ts: parse original status code from agent error message and forward it instead of always 502; (2) touch-page-client.tsx: add StatusCheckError class with httpStatus field so callers can distinguish error types; (3) touch-page-client.tsx: startPolling catch block now detects 404 and stops polling + refreshes page
verification: TypeScript compiles with no new errors. Awaiting human verification.
files_changed:
  - apps/web/src/app/api/workflows/status/route.ts
  - apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx
