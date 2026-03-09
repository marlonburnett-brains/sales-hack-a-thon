import {
  dealChatRouteContextSchema,
  dealChatSendRequestSchema,
} from "@lumenalta/schemas";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/env";
import { createClient } from "@/lib/supabase/server";

type RouteParams = {
  dealId: string;
};

async function buildProxyHeaders(request: NextRequest): Promise<HeadersInit> {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session?.access_token ?? ""}`,
  };

  const googleAccessToken = request.headers.get("X-Google-Access-Token");
  if (googleAccessToken) {
    headers["X-Google-Access-Token"] = googleAccessToken;
  }

  return headers;
}

async function resolveParams(params: Promise<RouteParams> | RouteParams): Promise<RouteParams> {
  return await params;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const { dealId } = await resolveParams(context.params);
  const routeContext = dealChatRouteContextSchema.safeParse({
    section: request.nextUrl.searchParams.get("section") ?? "overview",
    touchType: request.nextUrl.searchParams.get("touchType") ?? null,
    pathname: request.nextUrl.searchParams.get("pathname") ?? `/deals/${dealId}`,
    pageLabel: request.nextUrl.searchParams.get("pageLabel") ?? "Overview",
  });

  if (!routeContext.success) {
    return NextResponse.json(
      { error: "Invalid route context for deal chat bootstrap" },
      { status: 400 },
    );
  }

  const query = new URLSearchParams({
    section: routeContext.data.section,
    pathname: routeContext.data.pathname,
    pageLabel: routeContext.data.pageLabel,
  });

  if (routeContext.data.touchType) {
    query.set("touchType", routeContext.data.touchType);
  }

  const agentResponse = await fetch(
    `${env.AGENT_SERVICE_URL}/deals/${encodeURIComponent(dealId)}/chat?${query.toString()}`,
    {
      method: "GET",
      headers: await buildProxyHeaders(request),
    },
  );

  if (!agentResponse.ok) {
    const details = await agentResponse.text();
    return NextResponse.json(
      { error: "Agent deal chat bootstrap failed", details },
      { status: agentResponse.status },
    );
  }

  return NextResponse.json(await agentResponse.json(), { status: agentResponse.status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<RouteParams> | RouteParams },
) {
  const { dealId } = await resolveParams(context.params);
  const body = dealChatSendRequestSchema.safeParse({
    ...(await request.json()),
    dealId,
  });

  if (!body.success) {
    return NextResponse.json(
      { error: "dealId, routeContext, and either message or transcriptUpload are required" },
      { status: 400 },
    );
  }

  const agentResponse = await fetch(
    `${env.AGENT_SERVICE_URL}/deals/${encodeURIComponent(dealId)}/chat`,
    {
      method: "POST",
      headers: await buildProxyHeaders(request),
      body: JSON.stringify(body.data),
    },
  );

  if (!agentResponse.ok) {
    const details = await agentResponse.text();
    return NextResponse.json(
      { error: "Agent deal chat request failed", details },
      { status: agentResponse.status },
    );
  }

  return new Response(agentResponse.body, {
    status: agentResponse.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
