# Phase 16: Google OAuth Login Wall - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Only authenticated @lumenalta.com users can access the application; everyone else is blocked. Implements Google OAuth via Supabase Auth with domain restriction. Covers login page, session management, nav bar user info, and sign-out. Does NOT include role-based access, user management UI, or admin features.

</domain>

<decisions>
## Implementation Decisions

### Login page design
- Minimal centered layout — clean white page, no nav bar, standalone gate
- Branding: briefcase icon + "Lumenalta Sales" text + subtitle "Agentic Sales Orchestration" (matches existing nav)
- Single "Sign in with Google" button centered below branding
- Plain white background — no gradients, no images
- Small note below button: "@lumenalta.com accounts only"

### Post-login experience
- Land on /deals page after login (existing home route, no new dashboard)
- Preserve return URL — if user was trying to reach /deals/123, redirect back there after login
- Nav bar shows Google avatar as circular image on right side
- Avatar click reveals dropdown with: display name, email address, "Sign out" button
- No other items in the dropdown for v1.1

### Domain rejection UX
- Error appears on the same login page (no separate error route)
- Neutral, clear message: "Access is restricted to @lumenalta.com accounts. Please sign in with your Lumenalta Google account."
- Auto sign out the rejected session so the "Sign in with Google" button reappears
- User can immediately try again with a different account

### Session behavior
- Silent redirect to login page on session expiry (no error banners or toasts)
- Instant sign out — no confirmation dialog (low-stakes internal tool)
- Session persists across browser refresh via Supabase cookie-based SSR

### Claude's Discretion
- Domain restriction enforcement approach (server-side middleware, Supabase config, or both)
- Auth loading state implementation (spinner vs skeleton while checking auth)
- Multi-tab sign-out behavior (Supabase default cookie handling)
- Supabase Auth SSR package choice and middleware implementation details
- OAuth callback route structure

</decisions>

<specifics>
## Specific Ideas

No specific references — decisions are clear and conventional. The login page should feel like a standard SaaS login gate (Linear, Vercel style) — minimal, professional, no friction for Lumenalta users.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/app/layout.tsx`: Root layout with nav bar — needs conditional rendering (no nav on login, user info on authenticated pages)
- `apps/web/src/components/ui/`: Full shadcn/ui component library (Button, Card, etc.) — use for login page and dropdown
- `apps/web/src/lib/utils.ts`: `cn()` utility for Tailwind class merging
- `apps/web/src/components/ui/sonner.tsx`: Toaster for any error notifications

### Established Patterns
- Next.js 15 with Server Actions — auth can use server-side session checks
- No existing middleware.ts — will need to create for route protection
- No auth packages installed — Supabase SSR packages need to be added
- `@t3-oss/env-core` used in agent for env validation — web app may need similar for Supabase keys
- Inter font + Tailwind + shadcn/ui design system — login page should match

### Integration Points
- Root layout (`layout.tsx`) — needs auth provider/wrapper and conditional nav rendering
- No existing middleware — new `middleware.ts` at app root for auth checks
- `apps/web/package.json` — needs `@supabase/supabase-js` and `@supabase/ssr` packages
- `.env` files — need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Google Cloud Console — OAuth consent screen and credentials configuration (external to code)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-google-oauth-login-wall*
*Context gathered: 2026-03-05*
