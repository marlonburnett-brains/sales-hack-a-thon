import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const agentChatRequestSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1),
  currentPrompt: z.string(),
});

/**
 * POST /api/agents/chat
 *
 * Streaming proxy from Next.js to the agent's prompt editing chat endpoint.
 * Pipes the agent's streaming response directly back to the client.
 */
export async function POST(request: NextRequest) {
  const body = agentChatRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "agentId, message, and currentPrompt are required" },
      { status: 400 },
    );
  }

  const agentUrl = `${env.AGENT_SERVICE_URL}/agent-configs/${encodeURIComponent(body.data.agentId)}/chat`;

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const agentRes = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify({
      message: body.data.message.trim(),
      currentPrompt: body.data.currentPrompt,
    }),
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
