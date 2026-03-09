---
phase: 44-agent-management-ui
plan: 02
subsystem: ui
tags: [agent-config, prompt-editing, draft-publish, baseline, textarea, diff]

# Dependency graph
requires:
  - phase: 44-agent-management-ui
    provides: Agent config CRUD API routes, server actions, api-client typed functions
provides:
  - Agent detail page at /settings/agents/[agentId] with tabbed layout
  - Role prompt editing with draft/publish lifecycle
  - Publish confirmation dialog with line-diff and change note
  - Baseline editor at /settings/agents/baseline with blast-radius warning
affects: [44-03, 44-04, 44-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [auto-resize textarea, line-diff display, draft publish bar with amber styling]

key-files:
  created:
    - apps/web/src/app/(authenticated)/settings/agents/[agentId]/page.tsx
    - apps/web/src/components/settings/agent-detail.tsx
    - apps/web/src/components/settings/agent-prompt-editor.tsx
    - apps/web/src/components/settings/publish-dialog.tsx
    - apps/web/src/components/settings/baseline-editor.tsx
    - apps/web/src/app/(authenticated)/settings/agents/baseline/page.tsx
  modified: []

key-decisions:
  - "Publish dialog uses simple line-diff (removed/added sets) rather than external diff library -- Plan 03 will install diff package for full history comparison"
  - "Baseline editor fetches baseline via company-researcher agent config rather than a dedicated baseline endpoint"

patterns-established:
  - "Auto-resize textarea: useEffect setting height=auto then scrollHeight on value change"
  - "Draft publish bar: amber-50 bg with amber-200 border, conditional render when config.draft exists"
  - "PublishDialog rendered conditionally in parent with open prop, controlled by showPublishDialog state"

requirements-completed: [MGMT-02, MGMT-04]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 44 Plan 02: Agent Detail Page with Prompt Editing Summary

**Agent detail page with tabbed prompts/history layout, monospace textarea editing, draft/publish lifecycle, and baseline editor with blast-radius warning**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T21:49:51Z
- **Completed:** 2026-03-08T21:54:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Agent detail page at /settings/agents/[agentId] with header, family badge, responsibility, and tabbed layout
- Role prompt editing in auto-resizing monospace textarea with Save Draft, isDirty tracking, and sonner toast feedback
- Draft publish bar with Publish (opens diff dialog) and Discard Draft (AlertDialog confirmation) buttons
- Publish dialog showing line-diff of changes with optional change note before publishing
- Baseline editor page at /settings/agents/baseline with AlertTriangle blast-radius warning and publish confirmation

## Task Commits

Each task was committed atomically:

1. **Task 1: Agent detail page with prompt editing and draft workflow** - `ee6904b` (feat)
2. **Task 2: Publish dialog, discard confirmation, and baseline editor** - `6ca931f` (feat)

## Files Created/Modified
- `apps/web/src/app/(authenticated)/settings/agents/[agentId]/page.tsx` - Server component fetching config + versions, back link
- `apps/web/src/components/settings/agent-detail.tsx` - Tabbed detail view with draft bar, Prompts + History tabs
- `apps/web/src/components/settings/agent-prompt-editor.tsx` - Read-only baseline with expand toggle, editable role prompt textarea
- `apps/web/src/components/settings/publish-dialog.tsx` - AlertDialog with line-diff and change note for publish confirmation
- `apps/web/src/components/settings/baseline-editor.tsx` - Baseline textarea with blast-radius warning and publish flow
- `apps/web/src/app/(authenticated)/settings/agents/baseline/page.tsx` - Server component for baseline editing page

## Decisions Made
- Used simple line-diff (set-based removed/added) for publish dialog rather than importing diff library; Plan 03 will add full diff support for version history
- Baseline page fetches baseline prompt via `getAgentConfigAction("company-researcher")` since there is no dedicated baseline-only endpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Detail page and baseline editor ready for Plan 03 (version history with timeline and diff comparison)
- History tab placeholder ready to be populated
- Publish dialog ready for upgrade to proper diff library in Plan 03

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (ee6904b, 6ca931f) verified in git log.

---
*Phase: 44-agent-management-ui*
*Completed: 2026-03-08*
