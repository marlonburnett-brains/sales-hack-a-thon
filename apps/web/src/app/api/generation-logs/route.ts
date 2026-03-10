import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

/**
 * GET /api/generation-logs?dealId=...&touchType=touch_2
 *
 * Proxies real-time generation log entries from the agent's
 * in-memory log store. No auth required — logs are transient
 * non-sensitive data keyed by dealId+touchType.
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
    const agentUrl = `${env.AGENT_SERVICE_URL}/api/generation-logs/${encodeURIComponent(dealId)}/${encodeURIComponent(touchType)}`;
    const res = await fetch(agentUrl);

    if (!res.ok) {
      console.warn(`[generation-logs] Agent returned ${res.status}`);
      return NextResponse.json({ logs: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch logs";
    console.warn("[generation-logs] Error:", message);
    return NextResponse.json({ logs: [] });
  }
}
