"use server";

import { createClient } from "./server";

/**
 * Extract the Google access token and Supabase user ID from the current session.
 *
 * - `accessToken` comes from `session.provider_token` which is only populated
 *   when the session is fresh from an OAuth login. It may be `null` on
 *   subsequent requests — the agent falls back to userId-based refresh.
 * - `userId` comes from `auth.getUser()` which is always reliable.
 */
export async function getGoogleAccessToken(): Promise<{
  accessToken: string | null;
  userId: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    accessToken: session?.provider_token ?? null,
    userId: user?.id ?? null,
  };
}
