import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not remove this call. It refreshes the auth token
  // AND checks authentication status.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is authenticated and hits /login, redirect to /deals
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/deals";
    url.searchParams.delete("next");
    url.searchParams.delete("error");
    return NextResponse.redirect(url);
  }

  // If no user and not on login/auth pages, redirect to /login with return URL
  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.searchParams.set("next", returnTo);
    return NextResponse.redirect(url);
  }

  // ────────────────────────────────────────────────────────────
  // Google Token Re-consent Check (Phase 22)
  // Only for authenticated users NOT on /login or /auth pages
  // ────────────────────────────────────────────────────────────
  if (
    user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const tokenStatus = request.cookies.get("google-token-status")?.value;

    if (tokenStatus === "valid") {
      // Cookie cache hit — user has a token, proceed normally
    } else if (tokenStatus === "missing") {
      // Cookie cache hit — user has no token, force re-consent
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reconsent", "1");
      const returnTo = request.nextUrl.pathname + request.nextUrl.search;
      url.searchParams.set("next", returnTo);
      return NextResponse.redirect(url);
    } else {
      // No cookie — check agent API for token existence
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:4111";
      const agentKey = process.env.AGENT_API_KEY;

      if (agentKey) {
        try {
          const checkResponse = await fetch(
            `${agentUrl}/tokens/check/${user.id}`,
            {
              headers: {
                Authorization: `Bearer ${agentKey}`,
                "Content-Type": "application/json",
              },
              // Short timeout to avoid blocking page loads if agent is down
              signal: AbortSignal.timeout(3000),
            }
          );

          if (checkResponse.ok) {
            const { hasToken } = (await checkResponse.json()) as {
              hasToken: boolean;
            };

            if (hasToken) {
              // Token exists — set cache cookie and proceed
              supabaseResponse.cookies.set("google-token-status", "valid", {
                maxAge: 3600,
                httpOnly: true,
                sameSite: "lax",
                path: "/",
              });
            } else {
              // No token — set cache cookie, sign out, redirect to re-consent
              supabaseResponse.cookies.set("google-token-status", "missing", {
                maxAge: 3600,
                httpOnly: true,
                sameSite: "lax",
                path: "/",
              });
              await supabase.auth.signOut();
              const url = request.nextUrl.clone();
              url.pathname = "/login";
              url.searchParams.set("reconsent", "1");
              const returnTo =
                request.nextUrl.pathname + request.nextUrl.search;
              url.searchParams.set("next", returnTo);
              return NextResponse.redirect(url);
            }
          } else {
            // Agent returned non-OK — graceful degradation, proceed without check
            console.warn(
              `[middleware] Token check failed with status ${checkResponse.status}`
            );
          }
        } catch (err) {
          // Agent unreachable — graceful degradation, proceed without check
          console.warn("[middleware] Token check failed, agent unreachable:", err);
        }
      }
      // If no AGENT_API_KEY set, skip check (graceful degradation)
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
