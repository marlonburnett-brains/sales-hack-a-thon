---
status: awaiting_human_verify
trigger: "Templates page not showing touch badges for some templates"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Backend classify endpoint and frontend both discard touchTypes for "template" classification
test: Fixed both backend and frontend, all tests pass
expecting: User verifies fix works in browser
next_action: Awaiting human verification

## Symptoms

expected: All templates should show which touch(es) they are bound to (e.g., T1, T2, T3 badges)
actual: Some templates show touch badges while others only show "Template" with no touch badge
errors: No errors - data/display issue
reproduction: Go to Templates page, observe template cards
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-09T00:00:00Z
  checked: Database query of Template table
  found: Templates classified as "template" with empty touchTypes: "200A Master Deck" ([], template), "20251021 Master solutions deck" ([], template), "All Slide Layouts" ([], template). Templates with touchTypes: "Meet Lumenalta" (["touch_2"], example), "2026 GTM Solutions" (["touch_3"], template)
  implication: The "template" classification path does not persist touchTypes

- timestamp: 2026-03-09T00:00:00Z
  checked: Backend classify endpoint at apps/agent/src/mastra/index.ts
  found: Only updates touchTypes in DB when classification is "example" -- template classification silently drops touchTypes
  implication: Root cause on backend

- timestamp: 2026-03-09T00:00:00Z
  checked: Frontend handleClassify in template-card.tsx
  found: Passes undefined for touchTypes when classification is "template", sets savedTouchTypes to []
  implication: Root cause on frontend

- timestamp: 2026-03-09T00:00:00Z
  checked: TemplateClassificationControls UI
  found: UI correctly shows touch type checkboxes for "template" classification but initialTouchTypes was forced to [] for templates
  implication: Classify dialog didn't pre-populate existing touch types for templates

- timestamp: 2026-03-09T00:00:00Z
  checked: All 11 template-card tests pass after fix
  found: No regressions
  implication: Fix is safe

## Resolution

root_cause: Three-part bug preventing touch type persistence for "template" classification: (1) Backend classify endpoint only wrote touchTypes to DB for "example", not "template". (2) Frontend handleClassify passed undefined/[] touchTypes for "template" classification. (3) Classify dialog initialized touchTypes to [] for templates, hiding any previously saved touch types.
fix: (1) Backend: Always write touchTypes to DB regardless of classification type. (2) Frontend handleClassify: Always pass touchTypes from the form values. (3) Frontend classify dialog: Always initialize with savedTouchTypes.
verification: All 11 template-card tests pass. Type-check shows no new errors.
files_changed:
  - apps/agent/src/mastra/index.ts
  - apps/web/src/components/template-card.tsx
