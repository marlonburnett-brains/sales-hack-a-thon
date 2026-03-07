import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/deck-structures/chat
 *
 * Streaming proxy from Next.js to the agent's deck structure chat endpoint.
 * Pipes the agent's streaming response directly back to the client.
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as { touchType: string; message: string };

  if (!body.touchType || !body.message?.trim()) {
    return NextResponse.json(
      { error: "touchType and message are required" },
      { status: 400 },
    );
  }

  const agentUrl = `${env.AGENT_SERVICE_URL}/api/deck-structures/${encodeURIComponent(body.touchType)}/chat`;

  const agentRes = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AGENT_API_KEY}`,
    },
    body: JSON.stringify({ message: body.message.trim() }),
  });

  if (!agentRes.ok) {
    const text = await agentRes.text();
    return NextResponse.json(
      { error: "Agent chat failed", details: text },
      { status: agentRes.status },
    );
  }

  // Pipe the streaming body directly back
  return new Response(agentRes.body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
