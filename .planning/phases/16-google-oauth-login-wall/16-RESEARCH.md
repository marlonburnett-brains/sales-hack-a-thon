# Phase 16: Google OAuth Login Wall - Research

**Researched:** 2026-03-05
**Domain:** Supabase Auth SSR + Google OAuth + Next.js 15 App Router
**Confidence:** HIGH

## Summary

This phase implements a complete authentication gate using Supabase Auth with Google OAuth, restricted to `@lumenalta.com` accounts. The standard approach uses `@supabase/ssr` (v0.9.x) with `@supabase/supabase-js` (v2.98.x) -- Supabase's official SSR package that replaces the deprecated `@supabase/auth-helpers-nextjs`. The implementation requires three utility files (browser client, server client, middleware proxy), a login page, an OAuth callback route, and modifications to the existing root layout for conditional nav rendering with user avatar dropdown.

Domain restriction is a two-layer defense: the `hd` query parameter on `signInWithOAuth()` provides a UX optimization (Google only shows `@lumenalta.com` accounts in the picker), but this is NOT a security boundary -- it can be bypassed client-side. The actual enforcement MUST happen server-side in the OAuth callback route by checking the user's email domain after `exchangeCodeForSession()` and immediately signing out + rejecting non-matching domains.

**Primary recommendation:** Use `@supabase/ssr` with PKCE flow (default), implement domain validation server-side in the callback route, and use Next.js middleware for session refresh + route protection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Login page: Minimal centered layout -- clean white page, no nav bar, standalone gate
- Branding: briefcase icon + "Lumenalta Sales" text + subtitle "Agentic Sales Orchestration" (matches existing nav)
- Single "Sign in with Google" button centered below branding
- Plain white background -- no gradients, no images
- Small note below button: "@lumenalta.com accounts only"
- Post-login: Land on /deals page after login (existing home route, no new dashboard)
- Preserve return URL -- if user was trying to reach /deals/123, redirect back there after login
- Nav bar shows Google avatar as circular image on right side
- Avatar click reveals dropdown with: display name, email address, "Sign out" button
- No other items in the dropdown for v1.1
- Domain rejection: Error appears on the same login page (no separate error route)
- Neutral, clear message: "Access is restricted to @lumenalta.com accounts. Please sign in with your Lumenalta Google account."
- Auto sign out the rejected session so the "Sign in with Google" button reappears
- User can immediately try again with a different account
- Session: Silent redirect to login page on session expiry (no error banners or toasts)
- Instant sign out -- no confirmation dialog (low-stakes internal tool)
- Session persists across browser refresh via Supabase cookie-based SSR

### Claude's Discretion
- Domain restriction enforcement approach (server-side middleware, Supabase config, or both)
- Auth loading state implementation (spinner vs skeleton while checking auth)
- Multi-tab sign-out behavior (Supabase default cookie handling)
- Supabase Auth SSR package choice and middleware implementation details
- OAuth callback route structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with Google OAuth (@lumenalta.com accounts only) | `signInWithOAuth({ provider: 'google' })` with `hd` param + server-side email domain check in callback route |
| AUTH-02 | Users from non-@lumenalta.com domains are rejected with clear error message | Callback route checks `user.email` domain after `exchangeCodeForSession()`, signs out invalid users, redirects to `/login?error=domain` |
| AUTH-03 | Unauthenticated users are redirected to login page on any app route | Next.js `middleware.ts` calls `supabase.auth.getUser()`, redirects to `/login` if no user, preserves return URL via `?next=` param |
| AUTH-04 | User session persists across browser refresh (cookie-based via Supabase SSR) | `@supabase/ssr` handles cookie storage via `getAll`/`setAll`, middleware refreshes tokens on each request |
| AUTH-05 | User can sign out and is redirected to login page | `supabase.auth.signOut()` in Server Action, redirect to `/login` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.98.0 | Supabase client SDK | Official JS client; required by @supabase/ssr |
| `@supabase/ssr` | ^0.9.0 | SSR cookie-based auth | Official Supabase SSR package; replaces deprecated auth-helpers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-dropdown-menu` | ^2.x | Avatar dropdown menu | User menu in nav bar (install via shadcn CLI) |
| `@radix-ui/react-avatar` | ^1.x | Avatar component with fallback | User avatar display in nav (install via shadcn CLI) |

### Already Installed (Reuse)
| Library | Purpose |
|---------|---------|
| `lucide-react` (^0.576.0) | Briefcase icon for login page branding, LogOut icon |
| `next` (^15.5.12) | App Router, middleware, server components |
| `shadcn/ui components` | Button, Card, Skeleton for login page |
| `@t3-oss/env-nextjs` (^0.13.10) | Environment variable validation (extend for Supabase keys) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is DEPRECATED; ssr is the replacement |
| @supabase/ssr | NextAuth.js | Adds unnecessary abstraction; project already uses Supabase for DB |
| Server-side domain check | Supabase Auth Hook (Custom Access Token) | Hooks require Supabase Pro plan; server-side check is free and simpler |

**Installation:**
```bash
cd apps/web && pnpm add @supabase/supabase-js @supabase/ssr
npx shadcn@latest add dropdown-menu avatar
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/
│   ├── (authenticated)/      # Route group: pages requiring auth (has nav bar)
│   │   ├── layout.tsx         # Nav bar with user avatar dropdown
│   │   ├── deals/             # Existing deals pages (moved here)
│   │   └── api/               # Existing API routes
│   ├── login/
│   │   └── page.tsx           # Login page (no nav bar, standalone gate)
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts       # OAuth callback handler (GET)
│   ├── layout.tsx             # Root layout (font, toaster, NO nav bar)
│   ├── globals.css
│   └── page.tsx               # Redirect to /deals (existing)
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # Browser client (createBrowserClient)
│   │   └── server.ts          # Server client (createServerClient with cookies)
│   └── ...
├── middleware.ts               # Auth middleware (at src root, NOT inside app/)
└── env.ts                     # Extended with Supabase env vars
```

**IMPORTANT:** The `middleware.ts` file MUST be placed at `apps/web/src/middleware.ts` (since the project uses a `src/` directory). Next.js only recognizes middleware at the project root or inside `src/`.

### Pattern 1: Route Group for Auth Layout Split
**What:** Use Next.js route groups `(authenticated)` to separate layouts -- login page gets no nav bar, authenticated pages get nav bar with user info.
**When to use:** When different routes need different layout wrappers (auth vs unauth).
**Example:**
```
app/
├── layout.tsx                 # Root: html, body, font, toaster only
├── (authenticated)/
│   ├── layout.tsx             # Adds nav bar with avatar dropdown
│   └── deals/...             # Protected pages
└── login/
    └── page.tsx              # Standalone login (no nav bar)
```

### Pattern 2: Supabase Client Utilities (Official Pattern)
**What:** Two utility files -- one for browser, one for server -- that create properly configured Supabase clients.
**When to use:** Every Supabase operation. Never create clients inline.

**Browser client (`lib/supabase/client.ts`):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server client (`lib/supabase/server.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component.
            // Can be ignored if middleware handles session refresh.
          }
        },
      },
    }
  )
}
```

### Pattern 3: Middleware for Session Refresh + Route Protection
**What:** Next.js middleware that (a) refreshes the Supabase auth token on every request, and (b) redirects unauthenticated users to `/login`.
**When to use:** Applied to every request except static files and auth routes.

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not remove this call. It refreshes the auth token.
  const { data: { user } } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.searchParams.set('next', returnTo)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 4: OAuth Callback with Domain Validation
**What:** Route handler that exchanges the OAuth code for a session, then checks the email domain.
**When to use:** Critical for AUTH-01 and AUTH-02.

```typescript
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/deals'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      // SERVER-SIDE domain enforcement
      if (user?.email && !user.email.endsWith('@lumenalta.com')) {
        await supabase.auth.signOut()
        const url = new URL('/login', origin)
        url.searchParams.set('error', 'domain')
        return NextResponse.redirect(url.toString())
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth error fallback
  const url = new URL('/login', origin)
  url.searchParams.set('error', 'auth')
  return NextResponse.redirect(url.toString())
}
```

### Pattern 5: Sign Out via Server Action
**What:** Server Action that signs out the user and redirects to login.
**When to use:** Called from the avatar dropdown "Sign out" button.

```typescript
// lib/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Anti-Patterns to Avoid
- **Using `getSession()` in server code:** Never trust `getSession()` on the server. Use `getUser()` which validates the JWT against Supabase Auth server every time.
- **Using `get`, `set`, `remove` cookie methods:** Only use `getAll` and `setAll`. The individual methods are deprecated in `@supabase/ssr`.
- **Importing from `@supabase/auth-helpers-nextjs`:** This package is deprecated. Use `@supabase/ssr` exclusively.
- **Relying solely on `hd` parameter for domain restriction:** The `hd` parameter is a client-side UX hint only. It can be bypassed. Always validate server-side.
- **Creating Supabase clients inline:** Always use the utility functions from `lib/supabase/`.
- **Skipping middleware token refresh:** Even if you only want route protection, the middleware MUST call `supabase.auth.getUser()` to refresh expired tokens. Without this, sessions silently expire.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based session storage | Custom cookie management | `@supabase/ssr` getAll/setAll | Handles chunked cookies (>4KB), secure flags, httpOnly |
| OAuth PKCE flow | Manual code verifier/challenge | `signInWithOAuth()` + `exchangeCodeForSession()` | PKCE is cryptographically sensitive; Supabase handles it |
| Token refresh | Manual refresh token rotation | Middleware calling `getUser()` | Automatic refresh via middleware on every request |
| JWT validation | Manual JWT parsing/verification | `supabase.auth.getUser()` | Validates against Supabase Auth server, handles edge cases |
| Avatar component with fallback | Custom img + error handling | shadcn/ui Avatar component | Handles loading, error states, fallback initials |
| Dropdown menu | Custom dropdown with positioning | shadcn/ui DropdownMenu (Radix) | Keyboard navigation, screen reader support, collision detection |

**Key insight:** Supabase Auth's cookie-based SSR implementation handles edge cases like cookies exceeding the 4KB browser limit by automatically chunking them. Reimplementing this is error-prone.

## Common Pitfalls

### Pitfall 1: middleware.ts File Location
**What goes wrong:** Middleware doesn't execute; routes are unprotected.
**Why it happens:** Placing `middleware.ts` inside `app/` directory instead of at `src/` root (or project root if no `src/`).
**How to avoid:** Place at `apps/web/src/middleware.ts` -- Next.js only recognizes middleware at the project root or `src/` root.
**Warning signs:** Auth checks work in Server Components but not on navigation.

### Pitfall 2: Missing `supabase.auth.getUser()` in Middleware
**What goes wrong:** Auth tokens expire silently; users get 401s or stale sessions.
**Why it happens:** Developers remove the `getUser()` call thinking it's only for the redirect check.
**How to avoid:** The `getUser()` call serves TWO purposes: (1) triggers token refresh, (2) checks authentication status. Never remove it.
**Warning signs:** Sessions expire after 1 hour (default JWT expiry) even though refresh tokens are valid.

### Pitfall 3: Environment Variable Naming
**What goes wrong:** Client-side Supabase client can't connect.
**Why it happens:** Using `SUPABASE_URL` instead of `NEXT_PUBLIC_SUPABASE_URL`. Next.js only exposes env vars prefixed with `NEXT_PUBLIC_` to the browser.
**How to avoid:** Always use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Warning signs:** "supabaseUrl is required" error in browser console.

### Pitfall 4: Google Avatar Image Domain Not Configured
**What goes wrong:** Google profile images fail to load with Next.js `<Image>` component, or render as broken images.
**Why it happens:** Next.js blocks external images by default unless configured in `next.config.ts`.
**How to avoid:** Add `*.googleusercontent.com` to `remotePatterns` in `next.config.ts`, OR use a plain `<img>` tag (acceptable for small avatars).
**Warning signs:** 500 error from `/_next/image` or broken image icon.

### Pitfall 5: `hd` Parameter False Sense of Security
**What goes wrong:** Non-lumenalta.com users can still authenticate if they bypass the Google account picker.
**Why it happens:** The `hd` parameter only filters the Google account picker UI. It does NOT enforce domain restriction on Google's auth server.
**How to avoid:** Always validate `user.email.endsWith('@lumenalta.com')` server-side in the callback route.
**Warning signs:** Users with personal Gmail accounts can sometimes sign in despite `hd` being set.

### Pitfall 6: Route Group Migration Breaking Existing Links
**What goes wrong:** Moving `deals/` into `(authenticated)/deals/` changes nothing in the URL, but could break relative imports or file references.
**Why it happens:** Route groups `(parentheses)` are invisible in URLs but change directory structure.
**How to avoid:** Route groups don't affect URLs -- `/deals` still works. But verify all imports after restructuring.
**Warning signs:** 404 errors on pages that previously worked.

### Pitfall 7: Supabase Key Naming Transition
**What goes wrong:** Docs show `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but project uses older `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
**Why it happens:** Supabase renamed keys in late 2025 (publishable replaces anon). Both work for now.
**How to avoid:** Check the Supabase dashboard for which key format the project uses. New projects (post Nov 2025) use `publishable_key`; older projects still have `anon` key. Use whichever the dashboard shows. The env var name is your choice -- just be consistent.
**Warning signs:** Key not found in Supabase dashboard under the expected name.

## Code Examples

### Login Page with Google Sign-In
```typescript
// app/login/page.tsx
'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Briefcase } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const next = searchParams.get('next') ?? '/deals'

  const handleGoogleSignIn = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          hd: 'lumenalta.com', // UX hint only -- server validates
        },
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <Briefcase className="h-8 w-8 text-blue-600" />
          <span className="text-2xl font-semibold text-slate-900">
            Lumenalta Sales
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Agentic Sales Orchestration
        </p>

        {error === 'domain' && (
          <p className="text-sm text-destructive max-w-sm text-center">
            Access is restricted to @lumenalta.com accounts. Please sign in
            with your Lumenalta Google account.
          </p>
        )}

        <Button onClick={handleGoogleSignIn} variant="outline" size="lg">
          Sign in with Google
        </Button>

        <p className="text-xs text-muted-foreground">
          @lumenalta.com accounts only
        </p>
      </div>
    </div>
  )
}
```

### Nav Bar with Avatar Dropdown
```typescript
// components/user-nav.tsx (client component for avatar dropdown)
'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/actions/auth'

interface UserNavProps {
  user: {
    name: string
    email: string
    avatarUrl: string
  }
}

export function UserNav({ user }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback>
              {user.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Extending Environment Validation
```typescript
// env.ts -- extended for Supabase
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    AGENT_SERVICE_URL: z.string().url().default("http://localhost:4111"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  },
  runtimeEnv: {
    AGENT_SERVICE_URL: process.env.AGENT_SERVICE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
});
```

### Next.js Config for Google Avatars
```typescript
// next.config.ts
import type { NextConfig } from "next";
import "./src/env";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers deprecated; all new projects use ssr |
| `getSession()` for server auth | `getUser()` for server auth | 2024 | getSession doesn't revalidate JWT; getUser validates with Supabase server |
| `get`/`set`/`remove` cookies | `getAll`/`setAll` cookies | 2024 | Individual cookie methods deprecated in @supabase/ssr |
| `SUPABASE_ANON_KEY` | `SUPABASE_PUBLISHABLE_KEY` | Nov 2025 | Key naming transition; both work, check dashboard |
| `getClaims()` for JWT check | `getUser()` for server validation | 2025 | getClaims validates JWT locally only; getUser contacts auth server |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Fully deprecated, no longer maintained
- `supabase.auth.getSession()` in server code: Unsafe, does not revalidate JWT
- Individual cookie methods (`get`, `set`, `remove`): Replaced by `getAll`/`setAll`

## Open Questions

1. **Supabase key format for this project**
   - What we know: The Supabase project was created during Phase 14. New projects post-Nov 2025 use `publishable_key`; older ones use `anon` key.
   - What's unclear: Which key format this specific Supabase project uses.
   - Recommendation: Check the Supabase dashboard during implementation. Use whichever key is available. The env var can be named either way -- just match it consistently across `env.ts`, `.env.local`, and the Supabase client utilities.

2. **Google Cloud Console OAuth credentials**
   - What we know: A Google Cloud project needs OAuth 2.0 credentials with the Supabase callback URL configured.
   - What's unclear: Whether the team already has a Google Cloud project or OAuth consent screen configured.
   - Recommendation: Implementation should include clear instructions for Google Console setup (external to code). The callback URL will be `https://<project-ref>.supabase.co/auth/v1/callback`.

3. **Route group migration impact**
   - What we know: Moving `deals/` into `(authenticated)/` preserves URLs but changes directory structure.
   - What's unclear: Whether there are any hardcoded path references in the existing codebase.
   - Recommendation: Verify imports after restructuring. Route groups are URL-transparent, so `/deals` continues to work.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no test framework installed |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Google OAuth sign-in for @lumenalta.com | manual-only | N/A (requires real OAuth flow) | N/A |
| AUTH-02 | Reject non-@lumenalta.com with error message | manual-only | N/A (requires real OAuth flow) | N/A |
| AUTH-03 | Redirect unauthenticated to login | manual-only | N/A (requires browser + middleware) | N/A |
| AUTH-04 | Session persists across refresh | manual-only | N/A (requires browser session) | N/A |
| AUTH-05 | Sign out redirects to login | manual-only | N/A (requires authenticated session) | N/A |

**Justification for manual-only:** All AUTH requirements involve real OAuth flows with Google, browser cookie state, and Supabase Auth server interaction. Unit testing these flows would require extensive mocking of Supabase Auth, Next.js middleware, and cookie handling -- the ROI is low for an internal tool with 5 acceptance criteria that can be verified in under 5 minutes by hand. Integration/E2E testing (Playwright/Cypress) would be valuable but is out of scope for this phase and not in the current test infrastructure.

### Sampling Rate
- **Per task commit:** Manual smoke test -- visit app unauthenticated, verify redirect to login
- **Per wave merge:** Full manual walkthrough of all 5 success criteria
- **Phase gate:** All 5 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- No test infrastructure exists in this project (no framework, no test directory, no test scripts)
- Adding test infrastructure is out of scope for this phase (no testing requirements in AUTH-01 through AUTH-05)
- All validation is manual for this phase

## Sources

### Primary (HIGH confidence)
- [Supabase SSR Next.js Setup Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) -- middleware, client utilities, matcher config
- [Supabase AI Prompt: Next.js Auth](https://supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth) -- complete code examples for client.ts, server.ts, middleware.ts
- [Supabase Google OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-google) -- OAuth setup, `hd` parameter, callback configuration
- [Supabase Creating SSR Client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) -- getAll/setAll cookie pattern

### Secondary (MEDIUM confidence)
- [Supabase API Key Changes Discussion](https://github.com/orgs/supabase/discussions/29260) -- publishable key vs anon key transition timeline
- [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) -- getClaims vs getUser, PKCE flow details
- [Next.js Image Remote Patterns](https://nextjs.org/docs/app/api-reference/components/image) -- Google avatar domain configuration
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu) -- Avatar dropdown pattern

### Tertiary (LOW confidence)
- npm version numbers (@supabase/supabase-js 2.98.0, @supabase/ssr 0.9.0) -- checked via WebSearch, may have minor updates by implementation time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Official Supabase docs are clear and consistent; `@supabase/ssr` is the canonical approach
- Architecture: HIGH -- Route groups, middleware placement, and callback routes are well-documented Next.js patterns
- Pitfalls: HIGH -- Multiple sources confirm the getSession vs getUser issue, hd parameter limitations, and middleware placement
- Domain restriction: HIGH -- Multiple sources confirm hd is UX-only and server-side validation is required
- UI components: MEDIUM -- shadcn/ui patterns are standard but specific composition for this use case is application-specific

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- Supabase SSR patterns are mature)
