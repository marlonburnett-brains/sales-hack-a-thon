"use server";

import { createClient } from "./server";

/**
 * Extract the Supabase access_token (JWT) from the current user session.
 *
 * This token is sent as a Bearer token to the agent service, which verifies
 * it using the Supabase JWT secret to authenticate the user.
 *
 * Returns null if no active session exists.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  // Tutorial mock mode — return a synthetic token without touching Supabase.
  // The Edge Runtime middleware already skips auth when MOCK_AUTH=true,
  // but server components also need an access token for agent API calls.
  if (process.env.MOCK_AUTH === "true") {
    return "mock-access-token";
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
