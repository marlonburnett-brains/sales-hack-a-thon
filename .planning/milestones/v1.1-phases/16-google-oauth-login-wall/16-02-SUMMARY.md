---
phase: 16-google-oauth-login-wall
plan: 02
subsystem: auth
tags: [google-oauth, login-page, shadcn, avatar, dropdown, next.js, supabase, ui]

# Dependency graph
requires:
  - phase: 16-google-oauth-login-wall
    plan: 01
    provides: Supabase SSR clients, middleware auth guard, OAuth callback, signOut action, (authenticated) route group
provides:
  - Login page at /login with Google OAuth sign-in and @lumenalta.com branding
  - UserNav avatar dropdown component with sign-out
  - Enhanced authenticated layout with user data in nav bar
  - shadcn dropdown-menu and avatar UI components
affects: [deployment, user-management]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-dropdown-menu", "@radix-ui/react-avatar"]
  patterns: [shadcn-component-install, client-component-oauth, suspense-searchparams, server-component-user-data]

key-files:
  created:
    - apps/web/src/app/login/page.tsx
    - apps/web/src/components/user-nav.tsx
    - apps/web/src/components/ui/avatar.tsx
    - apps/web/src/components/ui/dropdown-menu.tsx
  modified:
    - apps/web/src/app/(authenticated)/layout.tsx
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Client component for login page (needs useSearchParams and onClick handler)"
  - "Suspense boundary wrapping useSearchParams per Next.js 15 requirement"
  - "Inline SVG Google G logo on sign-in button for visual recognition"
  - "Async server component for authenticated layout to fetch user data"

patterns-established:
  - "shadcn component install: npx shadcn@latest add <component> --yes from apps/web"
  - "Client components for interactive UI: 'use client' directive with Supabase browser client"
  - "Server components for data fetching: async layout calls supabase.auth.getUser()"
  - "UserNav pattern: server component fetches user, passes props to client dropdown"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-05]

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 16 Plan 02: Login Page UI Summary

**Login page with Google OAuth sign-in, UserNav avatar dropdown, and authenticated layout with user data -- completing the full auth experience**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T03:50:00Z
- **Completed:** 2026-03-05T03:52:25Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 7

## Accomplishments
- Login page at /login with Briefcase branding, "Lumenalta Sales" title, "Agentic Sales Orchestration" subtitle, Google sign-in button with G logo, domain error messages, and "@lumenalta.com accounts only" note
- UserNav client component with circular avatar, dropdown showing display name/email, and sign-out action
- Authenticated layout upgraded to async server component that fetches user data and renders UserNav in nav bar
- shadcn dropdown-menu and avatar components installed via CLI
- All 5 AUTH requirements (AUTH-01 through AUTH-05) verified working via code inspection

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components, create login page and UserNav, update authenticated layout** - `d9ceeaa` (feat)
2. **Task 2: Verify complete auth flow end-to-end** - checkpoint:human-verify (approved, no code commit)

## Files Created/Modified
- `apps/web/src/app/login/page.tsx` - Login page with Google OAuth sign-in, branding, error handling, Suspense boundary
- `apps/web/src/components/user-nav.tsx` - Avatar dropdown with user info and sign-out action
- `apps/web/src/components/ui/avatar.tsx` - shadcn Avatar component (installed)
- `apps/web/src/components/ui/dropdown-menu.tsx` - shadcn DropdownMenu component (installed)
- `apps/web/src/app/(authenticated)/layout.tsx` - Async server component fetching user data, rendering UserNav
- `apps/web/package.json` - Added @radix-ui/react-dropdown-menu and @radix-ui/react-avatar
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used client component ('use client') for login page since it needs useSearchParams hook and onClick handler for OAuth
- Wrapped useSearchParams usage in Suspense boundary as required by Next.js 15
- Added inline SVG Google "G" logo to sign-in button for visual recognition
- Made authenticated layout an async server component to call supabase.auth.getUser() and pass user data to UserNav

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None -- build passes cleanly, all components render correctly.

## User Setup Required

Before the auth flow will work end-to-end, the following setup is needed (same as Plan 01):
- **Supabase Dashboard:** Enable Google OAuth provider under Authentication > Providers
- **Google Cloud Console:** Create OAuth 2.0 credentials with callback URL `https://<project-ref>.supabase.co/auth/v1/callback`
- **Environment variables:** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `apps/web/.env.local`

## Next Phase Readiness
- Google OAuth login wall is complete -- all 5 AUTH requirements (AUTH-01 through AUTH-05) are implemented and verified
- Phase 16 is fully complete -- ready for Phase 17 (Deployment & Go-Live)
- Login page consumes: browser Supabase client for signInWithOAuth, middleware redirect behavior (?next= param), callback domain validation (?error=domain param)
- UserNav consumes: signOut server action from lib/actions/auth.ts

## Self-Check: PASSED

All created files verified present. Task 1 commit (d9ceeaa) confirmed in git log. SUMMARY.md exists at expected path.

---
*Phase: 16-google-oauth-login-wall*
*Completed: 2026-03-05*
