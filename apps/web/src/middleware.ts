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
  // Sets a cookie so client components can show re-auth banners.
  // NEVER signs the user out — Supabase auth and Google token
  // are independent concerns.
  // ────────────────────────────────────────────────────────────
  if (
    user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const tokenStatus = request.cookies.get("google-token-status")?.value;

    if (!tokenStatus) {
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
