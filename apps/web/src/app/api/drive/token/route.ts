import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";

/**
 * GET /api/drive/token
 *
 * Returns a fresh Google access token for the authenticated user.
 * The token is fetched from the agent's token-cache system which stores
 * encrypted refresh tokens and exchanges them for fresh access tokens.
 *
 * This solves research pitfall #6: Supabase provider_token is not
 * reliably available after the initial login session.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Call the agent service to get a fresh access token for this user
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch(
      `${env.AGENT_SERVICE_URL}/tokens/access/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`[api/drive/token] Agent returned ${response.status}: ${text}`);
      return NextResponse.json(
        { error: "Failed to get access token" },
        { status: response.status === 404 ? 404 : 500 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ accessToken: data.accessToken });
  } catch (err) {
    console.error("[api/drive/token] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
