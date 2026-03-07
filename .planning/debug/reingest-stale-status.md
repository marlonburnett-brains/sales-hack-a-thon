---
status: awaiting_human_verify
trigger: "When a template is asked to re-ingest, the UI stays stuck in Queued state even though the backend is already ingesting"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED - Polling useEffect in TemplateCard only activates when status === "ingesting", not "queued"
test: Applied fix, verified TypeScript compilation
expecting: Card now polls during "queued" state and transitions to "ingesting" automatically
next_action: Await human verification

## Symptoms

expected: After triggering re-ingest, template card transitions from "Queued" to "Ingesting..." in real-time with progress bar
actual: Card stays stuck on "Queued" status. Backend IS ingesting (confirmed by manual refresh showing correct status)
errors: No visible errors - just stale UI state
reproduction: Templates page -> trigger re-ingest on template via menu -> card stays "Queued"
started: Current behavior

## Eliminated

## Evidence

- timestamp: 2026-03-06T00:00:01Z
  checked: template-card.tsx useEffect polling logic (lines 89-124)
  found: Polling only starts when `status !== "ingesting"` guard passes. When status is "queued", the effect returns early with no interval set.
  implication: No mechanism to detect queued->ingesting transition. Card stays stuck on "queued" until full page refresh.

- timestamp: 2026-03-06T00:00:01Z
  checked: handleTriggerIngestion() in template-card.tsx (lines 147-157)
  found: Calls triggerIngestionAction then onRefresh() once. Backend returns { queued: true } and sets ingestionStatus to "queued". The single refresh picks up "queued" status, but no further refreshes happen.
  implication: After the one refresh, UI has "queued" status and no polling to detect the transition to "ingesting".

- timestamp: 2026-03-06T00:00:01Z
  checked: getTemplateStatus() in template-utils.ts
  found: Correctly maps ingestionStatus "queued" -> "queued" and "ingesting" -> "ingesting". Status derivation is correct.
  implication: The status logic is fine. The problem is purely about polling/refresh timing.

- timestamp: 2026-03-06T00:00:02Z
  checked: TypeScript compilation of modified template-card.tsx
  found: Zero type errors in the source file. Pre-existing test file issues unrelated.
  implication: Fix is syntactically and type-safe.

## Resolution

root_cause: The useEffect polling in TemplateCard only activates when status === "ingesting" (line 90 guard: `if (status !== "ingesting") return`). When the backend sets ingestionStatus to "queued" after triggering re-ingest, the card renders "Queued" but the polling effect exits early. There is no mechanism to detect when the backend transitions from "queued" to "ingesting", so the card stays stuck on "Queued" until the user manually refreshes the page.
fix: Extended the polling useEffect guard to also activate when status === "queued". During the "queued" state, the interval polls getIngestionProgressAction every 2 seconds. When the backend reports a status other than "queued" (i.e., "ingesting", "idle", or "failed"), the interval clears and calls onRefresh() to re-fetch template data. This causes the card to re-render with the new status, and if it's "ingesting", the existing progress-tracking polling takes over seamlessly.
verification: TypeScript compilation passes with zero errors. Awaiting human verification of runtime behavior.
files_changed:
  - apps/web/src/components/template-card.tsx
