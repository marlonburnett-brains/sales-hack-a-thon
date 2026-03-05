---
phase: 16-google-oauth-login-wall
plan: 01
subsystem: auth
tags: [supabase, google-oauth, ssr, middleware, next.js, route-groups]

# Dependency graph
requires:
  - phase: 14-database-migration
    provides: Supabase PostgreSQL database and project configuration
  - phase: 15-service-to-service-auth
    provides: AGENT_API_KEY env var pattern in env.ts
provides:
  - Supabase SSR client utilities (browser + server)
  - Auth middleware for session refresh and route protection
  - OAuth callback route with @lumenalta.com domain enforcement
  - signOut server action
  - (authenticated) route group with nav bar layout
affects: [16-02-login-page-ui, deployment, user-management]

# Tech tracking
tech-stack:
  added: ["@supabase/supabase-js@^2.98.0", "@supabase/ssr@^0.9.0"]
  patterns: [supabase-ssr-cookies, middleware-auth-guard, route-group-layout-split, server-side-domain-enforcement]

key-files:
  created:
    - apps/web/src/lib/supabase/client.ts
    - apps/web/src/lib/supabase/server.ts
    - apps/web/src/middleware.ts
    - apps/web/src/app/auth/callback/route.ts
    - apps/web/src/lib/actions/auth.ts
    - apps/web/src/app/(authenticated)/layout.tsx
  modified:
    - apps/web/src/env.ts
    - apps/web/next.config.ts
    - apps/web/src/app/layout.tsx
    - apps/web/package.json
    - apps/web/.env.example

key-decisions:
  - "getAll/setAll cookie pattern (not deprecated get/set/remove) for Supabase SSR"
  - "Server-side domain enforcement in callback route (not relying on hd parameter)"
  - "Route group (authenticated) for layout split -- nav bar only on authenticated pages"
  - "Middleware redirects authenticated users away from /login to /deals"

patterns-established:
  - "Supabase client utilities: always import createClient from lib/supabase/client or lib/supabase/server"
  - "Middleware auth guard: getUser() call both refreshes tokens and checks auth status"
  - "Route group layout split: (authenticated) group has nav bar, root layout is shell only"
  - "Server actions for auth: signOut in lib/actions/auth.ts"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 16 Plan 01: Auth Infrastructure Summary

**Supabase SSR auth with middleware route protection, OAuth callback with @lumenalta.com domain enforcement, and (authenticated) route group restructure**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T03:42:48Z
- **Completed:** 2026-03-05T03:46:34Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Supabase SSR client utilities (browser and server) with getAll/setAll cookie pattern
- Auth middleware at src root that refreshes tokens on every request and redirects unauthenticated users to /login with return URL preserved
- OAuth callback route with server-side @lumenalta.com domain enforcement -- non-lumenalta users are signed out and rejected
- All existing routes (deals, api/upload) moved to (authenticated) route group -- URLs unchanged
- Root layout stripped to shell (html/body/font/toaster); nav bar moved to authenticated layout
- Build passes cleanly with all routes intact

## Task Commits

Each task was committed atomically:

1. **Task 1: Install packages, create Supabase client utilities, extend env validation** - `31df0f6` (feat)
2. **Task 2: Create middleware, OAuth callback, sign-out action, restructure routes** - `c3d001d` (feat)

## Files Created/Modified
- `apps/web/src/lib/supabase/client.ts` - Browser Supabase client using createBrowserClient
- `apps/web/src/lib/supabase/server.ts` - Server Supabase client using createServerClient with cookie proxy
- `apps/web/src/middleware.ts` - Auth middleware for session refresh and route protection
- `apps/web/src/app/auth/callback/route.ts` - OAuth callback with domain validation
- `apps/web/src/lib/actions/auth.ts` - signOut server action
- `apps/web/src/app/(authenticated)/layout.tsx` - Authenticated layout with nav bar
- `apps/web/src/env.ts` - Extended with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- `apps/web/next.config.ts` - Added *.googleusercontent.com to image remotePatterns
- `apps/web/src/app/layout.tsx` - Stripped to shell (removed nav and main wrapper)
- `apps/web/package.json` - Added @supabase/supabase-js and @supabase/ssr
- `apps/web/.env.example` - Added Supabase env var placeholders
- `apps/web/src/app/(authenticated)/deals/` - Moved from app/deals/ (7 files)
- `apps/web/src/app/(authenticated)/api/` - Moved from app/api/ (1 file)

## Decisions Made
- Used getAll/setAll cookie pattern exclusively (not deprecated get/set/remove) per Supabase SSR best practices
- Server-side domain enforcement in OAuth callback (hd parameter is UX-only, not a security boundary)
- Route group (authenticated) for layout separation: authenticated pages get nav bar, login page does not
- Middleware redirects authenticated users away from /login to /deals (prevents showing login when already authenticated)
- Placeholder env vars in build verification (actual Supabase credentials are deployment concern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added Supabase vars to .env.example**
- **Found during:** Task 2 (post-build verification)
- **Issue:** .env.example did not include NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY -- developers would not know these are required
- **Fix:** Added both env vars with placeholder values and comment pointing to Supabase dashboard
- **Files modified:** apps/web/.env.example
- **Verification:** File contains both new env vars
- **Committed in:** (included in docs commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Developer experience improvement -- no scope creep.

## Issues Encountered
None -- build passes cleanly, all routes intact at original URLs.

## User Setup Required

Before the auth flow will work end-to-end, the following setup is needed:
- **Supabase Dashboard:** Enable Google OAuth provider under Authentication > Providers
- **Google Cloud Console:** Create OAuth 2.0 credentials with callback URL `https://<project-ref>.supabase.co/auth/v1/callback`
- **Environment variables:** Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `apps/web/.env.local`

## Next Phase Readiness
- Auth infrastructure is complete -- Plan 02 can build the login page UI and UserNav avatar dropdown
- Plan 02 will consume: createClient (browser), signOut action, middleware redirect behavior
- Login page will use `?error=domain` and `?next=` query parameters set by callback/middleware

## Self-Check: PASSED

All created files verified present. Both task commits (31df0f6, c3d001d) confirmed in git log. Old deals/page.tsx confirmed removed. Build verified successful.

---
*Phase: 16-google-oauth-login-wall*
*Completed: 2026-03-05*
