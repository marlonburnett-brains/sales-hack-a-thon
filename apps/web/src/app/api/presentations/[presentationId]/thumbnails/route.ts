import { NextRequest, NextResponse } from "next/server";
import { getPresentationThumbnails } from "@/lib/api-client";

/**
 * GET /api/presentations/:presentationId/thumbnails
 *
 * Proxies presentation thumbnail requests to the agent service.
 * Returns GCS-cached slide thumbnail URLs for embedding in the UI
 * without requiring public Google Drive sharing.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ presentationId: string }> },
) {
  const { presentationId } = await params;

  if (!presentationId) {
    return NextResponse.json(
      { error: "Missing presentationId" },
      { status: 400 },
    );
  }

  try {
    const result = await getPresentationThumbnails(presentationId);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch thumbnails";
    console.warn("[presentation-thumbnails] Error:", message);
    return NextResponse.json({ thumbnails: [], caching: false });
  }
}
