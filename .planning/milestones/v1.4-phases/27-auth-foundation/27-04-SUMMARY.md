---
phase: 27-auth-foundation
plan: 04
subsystem: ui
tags: [react, server-actions, action-required, silence, atlus-ai, lucide-react, sonner]

# Dependency graph
requires:
  - phase: 27-01
    provides: "ActionRequired schema with silenced/seenAt fields, ACTION_TYPES constants"
  - phase: 27-03
    provides: "PATCH /actions/:id/silence agent route, POST /atlus/detect route, GET /actions/count excludes silenced"
provides:
  - "Silence UX replacing Dismiss in ActionRequired UI"
  - "silenceAction and recheckAtlusAccess API client functions"
  - "silenceActionAction and recheckAtlusAccessAction server actions"
  - "AtlusAI action type icons (KeyRound, ShieldCheck) in actions list"
  - "Re-check Access button on AtlusAI action cards"
  - "Dimmed rendering for silenced action items"
affects: [28-atlus-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["optimistic-update-with-revert for silence action", "icon-per-action-type pattern extended for AtlusAI types"]

key-files:
  created: []
  modified:
    - "apps/web/src/lib/api-client.ts"
    - "apps/web/src/lib/actions/action-required-actions.ts"
    - "apps/web/src/app/(authenticated)/actions/actions-client.tsx"

key-decisions:
  - "Re-check Access button disabled with TODO for phase-28 -- Google OAuth provider_token not available from Supabase session in current flow"
  - "Silenced items kept in list with opacity-50 dimming rather than filtered out"
  - "Optimistic UI update on silence with revert on error"

patterns-established:
  - "Optimistic update with revert: set local state immediately, call server action, revert on error"
  - "Icon-per-action-type: getActionIcon maps ACTION_TYPES constants to colored lucide-react icons"

requirements-completed: [ATLS-04, ACTN-01, ACTN-02, ACTN-05]

# Metrics
duration: 12min
completed: 2026-03-06
---

# Phase 27 Plan 04: ActionRequired UX Overhaul Summary

**Silence UX replacing Dismiss with optimistic updates, AtlusAI action type icons (KeyRound/ShieldCheck), and Re-check Access button stub**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-06T21:19:00Z
- **Completed:** 2026-03-06T21:31:35Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments
- Replaced Dismiss button with Silence (BellOff icon) across all action items with optimistic update and error revert
- Silenced items render dimmed (opacity-50) in the actions list instead of being hidden
- Added purple KeyRound icon for atlus_account_required and indigo ShieldCheck icon for atlus_project_required action types
- Added Re-check Access button on AtlusAI action cards (disabled stub with TODO for phase-28 OAuth token wiring)
- Header badge count now excludes silenced items
- Added silenceAction and recheckAtlusAccess API client functions
- Added silenceActionAction and recheckAtlusAccessAction server actions with revalidatePath

## Task Commits

Each task was committed atomically:

1. **Task 1: Add silenceAction and recheckAtlusAccess API functions and server actions** - `af0ad61` (feat)
2. **Task 2: Refactor ActionsClient -- Silence UX, dimming, AtlusAI icons, Re-check Access** - `e8df346` (feat)
3. **Task 3: Verify ActionRequired UX overhaul** - human-verify checkpoint (approved)

## Files Created/Modified
- `apps/web/src/lib/api-client.ts` - Added silenceAction and recheckAtlusAccess API functions
- `apps/web/src/lib/actions/action-required-actions.ts` - Added silenceActionAction and recheckAtlusAccessAction server actions
- `apps/web/src/app/(authenticated)/actions/actions-client.tsx` - Full UI overhaul: Silence UX, dimming, AtlusAI icons, Re-check Access button

## Decisions Made
- **Re-check Access disabled stub:** Google OAuth provider_token is not readily available from the Supabase session in the current auth flow. Added a TODO(phase-28) comment and disabled the button with tooltip "Available after next login" to avoid blocking the rest of the UI work.
- **Silenced items stay visible:** Items are dimmed with opacity-50 rather than hidden, so users can still see what they've silenced and the list doesn't feel empty unexpectedly.
- **Optimistic updates:** Silence action uses optimistic local state update with revert on error for responsive UX.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 27 Auth Foundation is now complete (all 4 plans done)
- AtlusAI Re-check Access button needs OAuth provider_token wiring in Phase 28
- All ActionRequired UI patterns established for future action type additions

---
*Phase: 27-auth-foundation*
*Completed: 2026-03-06*
