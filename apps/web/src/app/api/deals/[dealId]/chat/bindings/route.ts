import {
  dealChatTouchTypeSchema,
  dealContextSourceSchema,
} from "@lumenalta/schemas";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/env";

type RouteParams = {
  dealId: string;
};

const dealChatBindingRequestSchema = z.object({
  sourceId: z.string().optional(),
  source: dealContextSourceSchema,
  action: z.enum(["confirm", "correct", "save_general_note"]),
  touchType: dealChatTouchTypeSchema.nullable().optional(),
  interactionId: z.string().nullable().optional(),
  refinedText: z.string().nullable().optional(),
});

function buildProxyHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": env.AGENT_API_KEY,
  };

  const googleAccessToken = request.headers.get("X-Google-Access-Token");
  const userId = request.headers.get("X-User-Id");

  if (googleAccessToken) {
    headers["X-Google-Access-Token"] = googleAccessToken;
  }

  if (userId) {
    headers["X-User-Id"] = userId;
  }

  return headers;
}

async function resolveParams(params: Promise<RouteParams> | RouteParams): Promise<RouteParams> {
  return await params;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const { dealId } = await resolveParams(context.params);
  const body = dealChatBindingRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: "A valid deal chat binding payload is required" },
      { status: 400 },
    );
  }

  const agentResponse = await fetch(
    `${env.AGENT_SERVICE_URL}/deals/${encodeURIComponent(dealId)}/chat/bindings`,
    {
      method: "POST",
      headers: buildProxyHeaders(request),
      body: JSON.stringify(body.data),
    },
  );

  if (!agentResponse.ok) {
    const details = await agentResponse.text();
    return NextResponse.json(
      { error: "Agent deal chat binding failed", details },
      { status: agentResponse.status },
    );
  }

  return NextResponse.json(await agentResponse.json(), { status: agentResponse.status });
}
