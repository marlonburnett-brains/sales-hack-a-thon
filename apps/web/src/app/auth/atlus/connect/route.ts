import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  generatePKCE,
  generateState,
  registerAtlusClient,
  buildAuthorizeUrl,
} from "@/lib/atlus-oauth";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/auth/atlus/callback`;

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  try {
    // Dynamic client registration with AtlusAI
    const clientId = await registerAtlusClient(redirectUri);

    // Generate PKCE challenge + state
    const { verifier, challenge } = generatePKCE();
    const state = generateState();

    // Store PKCE verifier, client_id, and state in secure cookies
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600, // 10 minutes — enough for the OAuth round-trip
    };

    cookieStore.set("atlus_pkce_verifier", verifier, cookieOptions);
    cookieStore.set("atlus_client_id", clientId, cookieOptions);
    cookieStore.set("atlus_oauth_state", state, cookieOptions);

    // Redirect to AtlusAI authorization
    const authorizeUrl = buildAuthorizeUrl({
      clientId,
      redirectUri,
      codeChallenge: challenge,
      state,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    console.error("[atlus-oauth] Failed to initiate OAuth:", err);
    const errorUrl = new URL("/actions", origin);
    errorUrl.searchParams.set("atlus_error", "oauth_init_failed");
    return NextResponse.redirect(errorUrl);
  }
}
