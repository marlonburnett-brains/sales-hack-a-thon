import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { getSupabaseAccessToken } from "@/lib/supabase/get-access-token";

/**
 * POST /api/visual-qa
 *
 * Proxies the SSE stream from the agent's /visual-qa/run endpoint.
 * Forwards the Supabase JWT for authentication.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { presentationId, interactionId } = body;

  if (!presentationId || !interactionId) {
    return NextResponse.json(
      { error: "Missing presentationId or interactionId" },
      { status: 400 },
    );
  }

  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 },
    );
  }

  try {
    const agentUrl = env.AGENT_SERVICE_URL;
    const response = await fetch(`${agentUrl}/visual-qa/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ presentationId, interactionId }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Agent error: ${text}` },
        { status: response.status },
      );
    }

    // Pipe the SSE stream through
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Visual QA request failed";
    console.error("[api/visual-qa] Error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
