import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // SUPABASE_URL / SUPABASE_ANON_KEY are runtime env vars (non-NEXT_PUBLIC)
  // that override the compile-time inlined NEXT_PUBLIC_* values. This allows
  // the tutorial capture pipeline to point auth at a mock server without
  // needing to rebuild the app.
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

  // Detect client-side navigation (RSC fetches) vs full page loads.
  // RSC requests send "RSC: 1" header — these should be fast since
  // the user was already authenticated on the initial page load.
  const isRSC = request.headers.get("RSC") === "1";

  let user: { id: string } | null = null;

  if (isRSC) {
    // Fast path: read session from cookie (local JWT decode, no network call).
    // Token refresh + server validation already happened on the initial page load.
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
  } else {
    // Full page load: validate with Supabase server + refresh token if needed.
    const { data: { user: serverUser } } = await supabase.auth.getUser();
    user = serverUser;
  }

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
    // Server action requests (POST with Next-Action header) can't follow
    // redirects properly — return 401 so the client gets an error it can handle
    if (request.headers.get("next-action")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const url = request.nextUrl.clone();
    const returnTo = request.nextUrl.pathname + request.nextUrl.search;
    url.pathname = "/login";
    url.searchParams.set("next", returnTo);
    return NextResponse.redirect(url);
  }

  // ────────────────────────────────────────────────────────────
  // Google Token Status Check (informational only)
  // Only on full page loads — skip for RSC requests to keep
  // client-side navigation instant.
  // Sets a cookie so client components can show re-auth banners.
  // NEVER signs the user out — Supabase auth and Google token
  // are independent concerns.
  // ────────────────────────────────────────────────────────────
  if (
    !isRSC &&
    user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const tokenStatus = request.cookies.get("google-token-status")?.value;

    if (!tokenStatus) {
      // No cookie — check agent API for token existence
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:4111";
      const { data: { session: authSession } } = await supabase.auth.getSession();

      if (authSession?.access_token) {
        try {
          const checkResponse = await fetch(
            `${agentUrl}/tokens/check/${user.id}`,
            {
              headers: {
                Authorization: `Bearer ${authSession.access_token}`,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(3000),
            }
          );

          if (checkResponse.ok) {
            const { hasToken } = (await checkResponse.json()) as {
              hasToken: boolean;
            };

            supabaseResponse.cookies.set(
              "google-token-status",
              hasToken ? "valid" : "missing",
              {
                httpOnly: false,
                maxAge: 3600,
                sameSite: "lax",
                path: "/",
              }
            );
          }
        } catch {
          // Agent unreachable — assume valid briefly so we don't retry every request
          supabaseResponse.cookies.set("google-token-status", "valid", {
            httpOnly: false,
            maxAge: 300,
            sameSite: "lax",
            path: "/",
          });
        }
      }
    }
    // If cookie exists ("valid" or "missing"), trust it until it expires.
    // Client components (google-token-badge, actions page) read this cookie
    // to show appropriate re-auth banners without forcing sign-out.
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
