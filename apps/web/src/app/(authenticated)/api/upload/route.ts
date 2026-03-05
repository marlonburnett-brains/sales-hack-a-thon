/**
 * File Upload Route Handler for Touch 1 Override
 *
 * Receives FormData with file + dealId, forwards to agent service.
 * Uses Route Handler (not Server Action) per Pitfall 6 in research:
 * large file uploads are better served by Route Handlers with streaming.
 */

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const dealId = formData.get("dealId");

    if (!file || !dealId) {
      return NextResponse.json(
        { error: "file and dealId are required" },
        { status: 400 }
      );
    }

    // Forward to agent service
    const agentFormData = new FormData();
    agentFormData.append("file", file);
    agentFormData.append("dealId", dealId.toString());

    const response = await fetch(`${env.AGENT_SERVICE_URL}/touch-1/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AGENT_API_KEY}`,
      },
      body: agentFormData,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `Agent upload failed: ${text}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[upload route] Error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: String(err) },
      { status: 500 }
    );
  }
}
