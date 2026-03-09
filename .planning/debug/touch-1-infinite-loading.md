---
status: awaiting_human_verify
trigger: "Touch 1 page shows 'Loading stage content...' indefinitely with spinner. No browser console errors."
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - stale interaction with null hitlStage causes infinite spinner
test: N/A - root cause confirmed via DB query and code analysis
expecting: N/A
next_action: Implement fix in touch-page-client.tsx

## Symptoms

expected: Touch 1 page should load and display stage content for the deal
actual: Shows "Loading stage content..." with spinner indefinitely, never resolves
errors: No errors visible in browser console
reproduction: Navigate to a deal (PepsiCo), click Touch 1 in sidebar
started: Unknown if it ever worked

## Eliminated

## Evidence

- timestamp: 2026-03-09
  checked: touch-page-client.tsx rendering logic (lines 506-514)
  found: "Loading stage content..." shown when currentStage is null OR stageContent is null
  implication: Any interaction with null hitlStage will show infinite spinner

- timestamp: 2026-03-09
  checked: Database - InteractionRecord for PepsiCo touch_1
  found: Record cmmjipjff000lvdzm84f37gmg has hitlStage=null, stageContent=null, status=in_progress, createdAt=updatedAt (never updated after creation)
  implication: Workflow step 1 (generateContent) created the record but failed before setting hitlStage/stageContent

- timestamp: 2026-03-09
  checked: touch-1-workflow.ts step 1 (generateContent)
  found: InteractionRecord is created BEFORE the agent call, then updated AFTER. If agent call fails, record stays with null hitlStage
  implication: Any failure in the agent generation step leaves a stale record

- timestamp: 2026-03-09
  checked: touch-page-client.tsx polling and state recovery
  found: isGenerating is client-only state (useState). On page refresh/navigation, it resets to false. No mechanism to resume polling or detect stale interactions
  implication: Page refresh after workflow failure = permanent infinite spinner

## Resolution

root_cause: When the Touch 1 workflow fails during content generation (step 1), it creates an InteractionRecord with hitlStage=null and stageContent=null. The UI component (touch-page-client.tsx) treats any existing interaction that isn't "ready" as an "active stage" view, but shows "Loading stage content..." when both currentStage and stageContent are null. Since there's no polling active (isGenerating is false on page load), the spinner never resolves.
fix: Added stale-interaction guard in touch-page-client.tsx (before the "Active stage" render). When activeInteraction exists but currentStage and stageContent are both null, show an amber warning banner ("A previous generation did not complete") plus the TouchGuidedStart component so user can retry.
verification: Type-check passes. No new TS errors introduced.
files_changed: [apps/web/src/app/(authenticated)/deals/[dealId]/touch/[touchNumber]/touch-page-client.tsx]
