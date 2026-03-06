import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/atlus-oauth";
import { storeAtlusOAuthToken } from "@/lib/api-client";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const actionsUrl = new URL("/actions", origin);
  const redirectUri = `${origin}/auth/atlus/callback`;

  // Handle AtlusAI error response
  if (error) {
    console.error("[atlus-oauth] Authorization error:", error);
    actionsUrl.searchParams.set("atlus_error", error);
    return NextResponse.redirect(actionsUrl);
  }

  if (!code) {
    actionsUrl.searchParams.set("atlus_error", "missing_code");
    return NextResponse.redirect(actionsUrl);
  }

  // Read PKCE + state cookies
  const cookieStore = await cookies();
  const verifier = cookieStore.get("atlus_pkce_verifier")?.value;
  const clientId = cookieStore.get("atlus_client_id")?.value;
  const savedState = cookieStore.get("atlus_oauth_state")?.value;

  // Clear OAuth cookies regardless of outcome
  const clearOpts = { path: "/", maxAge: 0 };
  cookieStore.set("atlus_pkce_verifier", "", clearOpts);
  cookieStore.set("atlus_client_id", "", clearOpts);
  cookieStore.set("atlus_oauth_state", "", clearOpts);

  if (!verifier || !clientId || !savedState) {
    actionsUrl.searchParams.set("atlus_error", "missing_oauth_state");
    return NextResponse.redirect(actionsUrl);
  }

  // Validate state to prevent CSRF
  if (state !== savedState) {
    actionsUrl.searchParams.set("atlus_error", "state_mismatch");
    return NextResponse.redirect(actionsUrl);
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user?.email) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  try {
    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      redirectUri,
      codeVerifier: verifier,
    });

    // Store tokens via agent API (encrypted at rest) + run access detection
    const result = await storeAtlusOAuthToken(
      user.id,
      user.email,
      tokens.access_token,
      tokens.refresh_token,
    );

    if (result.accessResult === "full_access") {
      actionsUrl.searchParams.set("atlus_success", "connected");
    } else if (result.accessResult === "no_project") {
      actionsUrl.searchParams.set("atlus_success", "no_project");
    } else {
      actionsUrl.searchParams.set("atlus_error", "access_denied");
    }

    return NextResponse.redirect(actionsUrl);
  } catch (err) {
    console.error("[atlus-oauth] Token exchange failed:", err);
    actionsUrl.searchParams.set("atlus_error", "token_exchange_failed");
    return NextResponse.redirect(actionsUrl);
  }
}
