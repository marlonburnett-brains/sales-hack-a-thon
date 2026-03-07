---
phase: quick-7
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/src/components/template-card.tsx
  - apps/web/src/lib/__tests__/template-utils.test.ts
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "Failed templates show Re-ingest option in dropdown menu"
    - "Clicking Re-ingest on a failed template triggers ingestion"
  artifacts:
    - path: "apps/web/src/components/template-card.tsx"
      provides: "Re-ingest menu item for failed status"
      contains: "failed"
  key_links:
    - from: "apps/web/src/components/template-card.tsx"
      to: "triggerIngestionAction"
      via: "handleTriggerIngestion on failed status"
      pattern: 'status === "failed"'
---

<objective>
Add the Re-ingest option to the template card dropdown menu for templates with "failed" ingestion status.

Purpose: Currently, templates that fail ingestion show a "Failed" badge and error banner but no way to retry. The user must delete and re-add the template. Adding "failed" to the existing ingest/re-ingest condition gives users a one-click recovery path.

Output: Updated template-card.tsx with failed status included in the ingestion trigger condition.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/web/src/components/template-card.tsx
@apps/web/src/lib/template-utils.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add failed status to re-ingest dropdown condition</name>
  <files>apps/web/src/components/template-card.tsx</files>
  <action>
In template-card.tsx, line 233, update the condition that controls the Ingest/Re-ingest dropdown menu item:

Current:
```tsx
{(status === "not_ingested" || status === "stale" || status === "ready") && (
```

Change to:
```tsx
{(status === "not_ingested" || status === "stale" || status === "ready" || status === "failed") && (
```

Also update the button label logic on the same menu item (currently line 242) to show "Re-ingest" for failed templates:

Current:
```tsx
{status === "ready" ? "Re-ingest" : "Ingest"}
```

Change to:
```tsx
{status === "ready" || status === "failed" ? "Re-ingest" : "Ingest"}
```

This reuses the existing `handleTriggerIngestion` function which calls `triggerIngestionAction` -- no new handler needed.
  </action>
  <verify>
    <automated>cd /Users/marlonburnett/source/lumenalta-hackathon && grep -n 'failed.*Re-ingest\|failed.*handleTriggerIngestion\|status === "failed"' apps/web/src/components/template-card.tsx</automated>
  </verify>
  <done>Templates with "failed" status show "Re-ingest" in the dropdown menu, using the existing ingestion trigger handler.</done>
</task>

</tasks>

<verification>
- grep confirms `"failed"` appears in the dropdown menu condition alongside `"not_ingested"`, `"stale"`, and `"ready"`
- grep confirms the label logic includes `"failed"` in the "Re-ingest" branch
- `npm run build --filter=web` compiles without errors (if available)
</verification>

<success_criteria>
- Failed templates display "Re-ingest" in their dropdown menu
- Clicking "Re-ingest" calls triggerIngestionAction (same as other statuses)
- No regression: other statuses (ready, stale, not_ingested) retain their existing behavior
</success_criteria>

<output>
After completion, create `.planning/quick/7-ingestion-failed-templates-should-have-t/7-SUMMARY.md`
</output>
