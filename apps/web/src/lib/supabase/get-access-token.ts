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
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
