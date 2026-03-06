---
phase: quick
plan: 3
subsystem: api, ui
tags: [google-drive, template, form-simplification, zod]

requires:
  - phase: none
    provides: n/a
provides:
  - Auto-populated template name from Google Drive document title
  - Simplified 2-field Add Template form (URL + touch types)
affects: [template-creation, template-form]

tech-stack:
  added: []
  patterns: [drive-api-field-extraction, optional-with-fallback]

key-files:
  created: []
  modified:
    - apps/agent/src/mastra/index.ts
    - apps/web/src/components/template-form.tsx
    - apps/web/src/lib/actions/template-actions.ts
    - apps/web/src/lib/api-client.ts
    - apps/web/src/components/__tests__/template-form.test.tsx

key-decisions:
  - "Name field made optional (not removed) in zod schema for backward compatibility"
  - "Fallback chain: Drive doc title > client-provided name > 'Untitled Presentation'"

patterns-established:
  - "Drive field extraction: request additional metadata fields alongside access check"

requirements-completed: [QUICK-3]

duration: 4min
completed: 2026-03-06
---

# Quick Task 3: Auto-populate Template Name from Google Slides Summary

**Template name auto-fetched from Google Drive document title; Display Name field removed from Add Template form**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T21:25:44Z
- **Completed:** 2026-03-06T21:29:39Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- POST /templates now fetches document title from Google Drive API and uses it as the template name
- Display Name field removed from the Add Template form (now 2 fields: URL + touch types)
- All 8 template-form tests updated and passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent backend -- fetch doc title from Drive, make name optional** - `fdb5c8d` (feat)
2. **Task 2: Frontend -- remove Display Name field, update API client and tests** - `ce26721` (feat)

## Files Created/Modified
- `apps/agent/src/mastra/index.ts` - Made name optional in zod schema, added 'name' to Drive fields, use doc title as template name with fallback
- `apps/web/src/components/template-form.tsx` - Removed Display Name field, name from schema/defaults/onSubmit
- `apps/web/src/lib/actions/template-actions.ts` - Removed name from createTemplateAction parameter type
- `apps/web/src/lib/api-client.ts` - Removed name from createTemplate parameter type
- `apps/web/src/components/__tests__/template-form.test.tsx` - Updated all tests to reflect no-name form

## Decisions Made
- Name field made optional (not removed entirely) in agent zod schema for backward compatibility
- Fallback chain: Drive doc title > client-provided name > "Untitled Presentation"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 3*
*Completed: 2026-03-06*

## Self-Check: PASSED
