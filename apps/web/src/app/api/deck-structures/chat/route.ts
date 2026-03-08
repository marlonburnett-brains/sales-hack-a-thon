import { ARTIFACT_TYPES, type ArtifactType } from "@lumenalta/schemas";
import { env } from "@/env";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type DeckStructureChatRequest = {
  touchType: string;
  artifactType?: ArtifactType;
  message: string;
};

const deckStructureChatRequestSchema: z.ZodType<DeckStructureChatRequest> = z.object({
  touchType: z.string().min(1),
  artifactType: z.enum(ARTIFACT_TYPES).optional(),
  message: z.string().min(1),
});

/**
 * POST /api/deck-structures/chat
 *
 * Streaming proxy from Next.js to the agent's deck structure chat endpoint.
 * Pipes the agent's streaming response directly back to the client.
 */
export async function POST(request: NextRequest) {
  const body = deckStructureChatRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "touchType and message are required" },
      { status: 400 },
    );
  }

  if (body.data.touchType === "touch_4" && !body.data.artifactType) {
    return NextResponse.json(
      { error: "artifactType is required for touch_4 chat requests" },
      { status: 400 },
    );
  }

  const query = new URLSearchParams();
  if (body.data.artifactType) {
    query.set("artifactType", body.data.artifactType);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";

  const agentUrl = `${env.AGENT_SERVICE_URL}/deck-structures/${encodeURIComponent(body.data.touchType)}/chat${suffix}`;

  const agentRes = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AGENT_API_KEY}`,
    },
    body: JSON.stringify({ message: body.data.message.trim() }),
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
