---
phase: 16-google-oauth-login-wall
verified: 2026-03-05T04:15:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Sign in with a @lumenalta.com Google account"
    expected: "Google account picker opens, sign-in completes, user is redirected to /deals with nav bar showing avatar"
    why_human: "Requires live Supabase project, Google OAuth credentials, and browser interaction; cannot be confirmed programmatically"
  - test: "Sign in with a non-@lumenalta.com account (e.g., personal Gmail)"
    expected: "Redirected to /login?error=domain with message 'Access is restricted to @lumenalta.com accounts...'"
    why_human: "Requires live OAuth flow with a non-lumenalta account; domain enforcement path in callback only exercisable in browser"
  - test: "Navigate to /deals in an incognito window (not logged in)"
    expected: "Redirected to /login?next=%2Fdeals immediately"
    why_human: "Middleware redirect behavior requires running Next.js server; cannot be traced statically"
  - test: "Refresh the browser while authenticated"
    expected: "Still signed in and on the same page"
    why_human: "Cookie-based session persistence requires live Supabase session; cannot verify statically"
  - test: "Click avatar, then 'Sign out'"
    expected: "Dropdown shows display name and email; clicking Sign out redirects to /login; /deals then redirects back to /login"
    why_human: "Sign-out action and resulting session clearing require live Supabase session"
---

# Phase 16: Google OAuth Login Wall Verification Report

**Phase Goal:** Google OAuth login wall with @lumenalta.com domain restriction
**Verified:** 2026-03-05T04:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All automated checks pass. The full auth flow requires live Supabase credentials and browser interaction for end-to-end confirmation. The code correctly implements every requirement; five behaviors need human testing to confirm runtime correctness.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supabase client utilities exist for both browser and server contexts | VERIFIED | `apps/web/src/lib/supabase/client.ts` exports `createClient()` via `createBrowserClient`; `server.ts` exports async `createClient()` via `createServerClient` with `getAll`/`setAll` cookies |
| 2 | Middleware redirects unauthenticated users to /login with return URL preserved | VERIFIED | `middleware.ts` line 50-53: builds `returnTo = pathname + search`, sets `url.searchParams.set("next", returnTo)`, redirects to `/login`; matcher covers all non-static routes |
| 3 | OAuth callback validates @lumenalta.com domain and rejects others | VERIFIED | `auth/callback/route.ts` line 19-23: `!user.email.endsWith("@lumenalta.com")` triggers `supabase.auth.signOut()` then redirect to `/login?error=domain` |
| 4 | Session tokens refresh automatically on every request via middleware | VERIFIED | `middleware.ts` line 32: `supabase.auth.getUser()` called on every request; `setAll` writes refreshed tokens to both request and response cookies |
| 5 | Existing deals routes still work at the same URLs after route group restructure | VERIFIED | `app/(authenticated)/deals/page.tsx` and `app/(authenticated)/deals/[dealId]/` exist; old `app/deals/` is confirmed absent; route groups are URL-transparent in Next.js |
| 6 | Login page shows briefcase icon, 'Lumenalta Sales' branding, subtitle, and 'Sign in with Google' button | VERIFIED | `login/page.tsx` lines 59-98: Briefcase icon, "Lumenalta Sales" span, "Agentic Sales Orchestration" subtitle, `Button variant="outline"` with Google SVG G logo, "@lumenalta.com accounts only" note |
| 7 | Domain rejection error message displays on login page for non-@lumenalta.com users | VERIFIED | `login/page.tsx` lines 71-76: `error === "domain"` renders exact message "Access is restricted to @lumenalta.com accounts..." in `text-destructive` |
| 8 | Nav bar shows user's Google avatar and clicking reveals dropdown with display name, email, and 'Sign out' | VERIFIED | `user-nav.tsx`: Avatar with AvatarImage + AvatarFallback; DropdownMenuLabel renders `user.name` and `user.email`; DropdownMenuItem calls `signOut()` |
| 9 | Clicking 'Sign out' ends session and redirects to login page | VERIFIED | `user-nav.tsx` line 51: `onClick={() => signOut()}`; `lib/actions/auth.ts`: `'use server'`, calls `supabase.auth.signOut()`, then `redirect("/login")` |

**Score:** 9/9 truths verified (automated)

### Required Artifacts

#### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/supabase/client.ts` | Browser Supabase client using createBrowserClient | VERIFIED | 8 lines, exports `createClient()`, uses `createBrowserClient` with env vars |
| `apps/web/src/lib/supabase/server.ts` | Server Supabase client using createServerClient with cookies | VERIFIED | 28 lines, async `createClient()`, `getAll`/`setAll` pattern, try/catch for Server Component safety |
| `apps/web/src/middleware.ts` | Auth middleware for session refresh and route protection | VERIFIED | 63 lines, exports `middleware` and `config`, full cookie proxy, redirect logic present |
| `apps/web/src/app/auth/callback/route.ts` | OAuth callback with domain validation | VERIFIED | 34 lines, exports `GET`, `exchangeCodeForSession`, `@lumenalta.com` enforcement, error redirect |
| `apps/web/src/lib/actions/auth.ts` | Server action for sign out | VERIFIED | 10 lines, `'use server'`, `supabase.auth.signOut()`, `redirect("/login")` |
| `apps/web/src/app/(authenticated)/layout.tsx` | Authenticated layout with nav bar and UserNav | VERIFIED | 43 lines, async server component, fetches user, renders Briefcase + UserNav |

#### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/login/page.tsx` | Login page with Google OAuth sign-in | VERIFIED | 120 lines (min 30 required), client component, Suspense boundary, full branding, error handling, `signInWithOAuth` call |
| `apps/web/src/components/user-nav.tsx` | Avatar dropdown with user info and sign-out | VERIFIED | 59 lines (min 30 required), client component, Avatar + DropdownMenu, displays name/email, calls `signOut()` |
| `apps/web/src/components/ui/avatar.tsx` | shadcn Avatar component | VERIFIED | File present |
| `apps/web/src/components/ui/dropdown-menu.tsx` | shadcn DropdownMenu component | VERIFIED | File present |

#### Supporting Infrastructure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/env.ts` | Extended with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY | VERIFIED | Both vars in `client` block with `z.string().url()` and `z.string().min(1)`; both in `runtimeEnv` |
| `apps/web/next.config.ts` | remotePatterns for *.googleusercontent.com | VERIFIED | `images.remotePatterns` with `protocol: "https", hostname: "*.googleusercontent.com"` |
| `apps/web/src/app/layout.tsx` | Root layout stripped to shell only | VERIFIED | 30 lines, no nav, no main wrapper — only html, body, font, Toaster, children |
| Route restructure | deals/ and api/ moved into (authenticated)/ group | VERIFIED | `app/(authenticated)/deals/` present with [dealId]/; `app/(authenticated)/api/upload/route.ts` present; old `app/deals/` and `app/api/` absent |

### Key Link Verification

#### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `@supabase/ssr` | `createServerClient` with `getAll`/`setAll` cookie proxy | WIRED | Lines 7-26: `createServerClient(...)` with `getAll()` from `request.cookies` and `setAll()` updating both request and response cookies |
| `auth/callback/route.ts` | `lib/supabase/server.ts` | `import createClient` | WIRED | Line 2: `import { createClient } from "@/lib/supabase/server"`; Line 10: `await createClient()`; Line 11: `exchangeCodeForSession`; Line 19: `endsWith("@lumenalta.com")` check |
| `middleware.ts` | `/login` | redirect when no user | WIRED | Lines 44-53: `!user && !pathname.startsWith("/login") && !pathname.startsWith("/auth")` → `redirect(url)` with `next` param |

#### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `login/page.tsx` | `lib/supabase/client.ts` | `signInWithOAuth` call | WIRED | Line 7: `import { createClient } from "@/lib/supabase/client"`; Lines 43-51: `supabase.auth.signInWithOAuth({ provider: "google", options: { ... hd: "lumenalta.com" } })` |
| `user-nav.tsx` | `lib/actions/auth.ts` | `signOut` server action | WIRED | Line 13: `import { signOut } from "@/lib/actions/auth"`; Line 51: `onClick={() => signOut()}` |
| `(authenticated)/layout.tsx` | `components/user-nav.tsx` | renders UserNav with user data | WIRED | Line 4: `import { UserNav } from "@/components/user-nav"`; Line 35: `<UserNav user={{ name, email, avatarUrl }} />` with data from `supabase.auth.getUser()` |

### Requirements Coverage

| Requirement | Description | Source Plans | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | User can sign in with Google OAuth (@lumenalta.com accounts only) | 16-01, 16-02 | SATISFIED (needs runtime confirm) | `login/page.tsx` calls `signInWithOAuth` with `provider: "google"` and `hd: "lumenalta.com"`; callback enforces domain server-side |
| AUTH-02 | Users from non-@lumenalta.com domains are rejected with clear error message | 16-01, 16-02 | SATISFIED (needs runtime confirm) | `auth/callback/route.ts` checks `endsWith("@lumenalta.com")`, signs out, redirects to `/login?error=domain`; login page renders exact error message |
| AUTH-03 | Unauthenticated users are redirected to login page on any app route | 16-01, 16-02 | SATISFIED (needs runtime confirm) | `middleware.ts` redirects `!user` to `/login?next={returnPath}` with matcher covering all non-static routes |
| AUTH-04 | User session persists across browser refresh (cookie-based via Supabase SSR) | 16-01 | SATISFIED (needs runtime confirm) | Middleware calls `getUser()` every request, refreshing tokens; `setAll` writes cookies back to response; `createServerClient` with cookie store |
| AUTH-05 | User can sign out and is redirected to login page | 16-01, 16-02 | SATISFIED (needs runtime confirm) | `user-nav.tsx` calls `signOut()` server action; `auth.ts` calls `supabase.auth.signOut()` then `redirect("/login")` |

No orphaned requirements detected. All five AUTH-01 through AUTH-05 requirements are claimed by Phase 16 plans and have implementation evidence. AUTH-06 and AUTH-07 are assigned to Phase 15 (not this phase).

### Anti-Patterns Found

None detected. Scanned all key files for TODO/FIXME/HACK/PLACEHOLDER comments, empty implementations (`return null`, `return {}`, `return []`), and console.log-only stubs. All implementations are substantive.

Notable observation: `user-nav.tsx` line 51 calls `onClick={() => signOut()}` — this wraps the server action in a lambda rather than passing it directly (`onClick={signOut}`). Both patterns work in React; the wrapper does not prevent functionality but is slightly redundant. Not a blocker.

### Human Verification Required

The code correctly implements all five AUTH requirements. The following items require a live Supabase project with Google OAuth configured and a running dev server to confirm runtime behavior.

**Prerequisites before testing:**
1. Supabase Dashboard: Enable Google provider under Authentication > Providers with OAuth Client ID and Secret
2. Google Cloud Console: OAuth 2.0 Client ID with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
3. `apps/web/.env.local`: Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Run: `cd apps/web && pnpm dev`

---

### 1. AUTH-01 — Google Sign-In with @lumenalta.com Account

**Test:** Open http://localhost:3000 in a fresh incognito window. Click "Sign in with Google". Choose a @lumenalta.com Google account.
**Expected:** Google account picker shows @lumenalta.com accounts (hd hint filters picker); sign-in completes; browser redirects to /deals; nav bar shows user's Google avatar in top-right.
**Why human:** Requires live Supabase OAuth flow, Google credentials, and browser interaction.

---

### 2. AUTH-02 — Domain Rejection for Non-@lumenalta.com Account

**Test:** Click "Sign in with Google" and choose a personal Gmail or other non-@lumenalta.com account (may require dismissing the domain hint first).
**Expected:** Redirected to /login with message "Access is restricted to @lumenalta.com accounts. Please sign in with your Lumenalta Google account." shown in red.
**Why human:** Domain enforcement is server-side in the callback; only exercisable via a live OAuth exchange with a disallowed account.

---

### 3. AUTH-03 — Route Protection Redirects to Login with Return URL

**Test:** In incognito, navigate to http://localhost:3000/deals/some-deal-id.
**Expected:** Immediately redirected to /login?next=%2Fdeals%2Fsome-deal-id. After signing in, redirected back to /deals/some-deal-id.
**Why human:** Middleware redirect behavior requires a running Next.js dev server; cannot be traced from static file analysis.

---

### 4. AUTH-04 — Session Persists Across Browser Refresh

**Test:** Sign in successfully. Press Cmd+R (or F5) to refresh. Open a new tab and navigate to http://localhost:3000/deals.
**Expected:** Still signed in after refresh; new tab lands on /deals without triggering login.
**Why human:** Cookie-based session persistence requires a live Supabase session and browser cookie storage.

---

### 5. AUTH-05 — Sign Out Clears Session and Redirects to Login

**Test:** While signed in, click the avatar in the top-right nav. Verify dropdown shows your display name and email. Click "Sign out". Then navigate to http://localhost:3000/deals.
**Expected:** Dropdown shows name and email; clicking Sign out immediately redirects to /login (no dialog); subsequent attempt to access /deals redirects to /login.
**Why human:** Session clearing requires a live Supabase session; redirect behavior requires running server.

---

## Commit Verification

All three phase 16 commits exist and are valid:

| Commit | Description | Files |
|--------|-------------|-------|
| `31df0f6` | feat(16-01): install Supabase packages and create client utilities | `client.ts`, `server.ts`, `env.ts`, `next.config.ts`, `package.json` |
| `c3d001d` | feat(16-01): add auth middleware, OAuth callback, sign-out action, restructure routes | `middleware.ts`, `callback/route.ts`, `auth.ts`, `(authenticated)/` group |
| `d9ceeaa` | feat(16-02): add login page, UserNav avatar dropdown, and enhanced auth layout | `login/page.tsx`, `user-nav.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, updated layout |

---

_Verified: 2026-03-05T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
