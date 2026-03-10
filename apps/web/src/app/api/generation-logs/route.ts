import { NextRequest, NextResponse } from "next/server";
import { getGenerationLogs } from "@/lib/api-client";

/**
 * GET /api/generation-logs?dealId=...&touchType=touch_2
 *
 * Proxies real-time generation log entries from the agent's
 * in-memory log store. Uses the standard authenticated fetchAgent
 * path (Supabase JWT forwarding) consistent with all other agent calls.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dealId = searchParams.get("dealId");
  const touchType = searchParams.get("touchType");

  if (!dealId || !touchType) {
    return NextResponse.json(
      { error: "Missing dealId or touchType" },
      { status: 400 },
    );
  }

  try {
    const logs = await getGenerationLogs(dealId, touchType);
    return NextResponse.json({ logs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch logs";
    console.warn("[generation-logs] Error:", message);
    return NextResponse.json({ logs: [] });
  }
}
