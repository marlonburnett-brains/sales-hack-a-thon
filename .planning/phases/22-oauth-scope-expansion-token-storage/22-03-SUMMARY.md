---
phase: 22-oauth-scope-expansion-token-storage
plan: 03
subsystem: ui
tags: [react, tailwind, oauth, google, supabase, cookie]
requirements_completed: []

# Dependency graph
requires:
  - phase: 22-01
    provides: "Token storage model and encryption (UserGoogleToken)"
  - phase: 22-02
    provides: "Middleware sets google-token-status cookie"
provides:
  - "GoogleTokenBadge component reading google-token-status cookie"
  - "Connect Google menu item in UserNav dropdown triggering OAuth consent"
affects: [23-google-api-client-factories]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Cookie-based client-side token status detection", "Self-service OAuth re-consent from user dropdown"]

key-files:
  created:
    - apps/web/src/components/google-token-badge.tsx
  modified:
    - apps/web/src/components/user-nav.tsx

key-decisions:
  - "Badge uses document.cookie read (no server round-trip) for instant status display"
  - "Connect Google always forces prompt:consent to guarantee fresh token capture"

patterns-established:
  - "Cookie-driven UI state: client components read middleware-set cookies for conditional rendering"

requirements-completed: [OAUTH-03, OAUTH-04]

# Metrics
duration: 1min
completed: 2026-03-06
---

# Phase 22 Plan 03: UI Token Nudge Summary

**Amber badge on avatar for tokenless users + Connect Google self-service menu item in UserNav dropdown**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T16:16:12Z
- **Completed:** 2026-03-06T16:17:37Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- GoogleTokenBadge component reads google-token-status cookie and renders amber dot when missing/absent
- UserNav avatar overlays badge for tokenless users as a non-disruptive nudge
- Connect Google dropdown menu item triggers signInWithOAuth with expanded scopes and consent prompt
- Badge disappears automatically when middleware sets cookie to "valid" after successful consent

## Task Commits

Each task was committed atomically:

1. **Task 1: GoogleTokenBadge component + Connect Google menu item in UserNav** - `c91e2eb` (feat)

## Files Created/Modified
- `apps/web/src/components/google-token-badge.tsx` - Client component that reads google-token-status cookie and conditionally renders amber warning dot
- `apps/web/src/components/user-nav.tsx` - Added GoogleTokenBadge overlay on avatar, Connect Google menu item with Link2 icon

## Decisions Made
- Badge reads document.cookie directly in useEffect (no server round-trip needed since middleware already sets the cookie)
- Connect Google always uses prompt: "consent" because its explicit purpose is to request a new token with expanded scopes
- Badge positioned with absolute -top-0.5 -right-0.5 for subtle overlay that does not obstruct avatar
- Added aria-label on badge span for screen reader accessibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in template-card.test.tsx and template-table.test.tsx (ingestionStatus type mismatch) -- unrelated to this plan, not in scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 22 complete: token storage (Plan 01), middleware re-consent + scoped login (Plan 02), and UI nudge (Plan 03) all implemented
- Ready for Phase 23 (Google API client factories) which will use stored tokens for user-delegated API calls

---
*Phase: 22-oauth-scope-expansion-token-storage*
*Completed: 2026-03-06*
