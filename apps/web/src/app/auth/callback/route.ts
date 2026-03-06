import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { storeGoogleToken } from "@/lib/api-client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/deals";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // SERVER-SIDE domain enforcement
      if (user?.email && !user.email.endsWith("@lumenalta.com")) {
        await supabase.auth.signOut();
        const url = new URL("/login", origin);
        url.searchParams.set("error", "domain");
        return NextResponse.redirect(url.toString());
      }

      // Capture Google refresh token from exchangeCodeForSession response
      // CRITICAL: provider_refresh_token is only available from this return value,
      // NOT from subsequent getSession() calls (see RESEARCH.md Pitfall 2)
      const refreshToken = data.session?.provider_refresh_token;
      if (refreshToken && user?.id && user?.email) {
        try {
          await storeGoogleToken({
            userId: user.id,
            email: user.email,
            refreshToken,
          });

          // Set cookie so middleware doesn't immediately re-check
          const redirectUrl = new URL(`${origin}${next}`);
          const response = NextResponse.redirect(redirectUrl.toString());
          response.cookies.set("google-token-status", "valid", {
            maxAge: 3600,
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
          return response;
        } catch (err) {
          console.error("[auth] Failed to store Google token:", err);
          // Set search param to trigger toast after redirect
          const redirectUrl = new URL(`${origin}${next}`);
          redirectUrl.searchParams.set("token_error", "1");
          return NextResponse.redirect(redirectUrl.toString());
        }
      }

      // No refresh token present (returning user without consent) — login normally
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error fallback
  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth");
  return NextResponse.redirect(url.toString());
}
