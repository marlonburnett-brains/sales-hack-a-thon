import { NextRequest, NextResponse } from "next/server";
import {
  getWorkflowStatus,
  getTouch2WorkflowStatus,
  getTouch3WorkflowStatus,
  getTouch4WorkflowStatus,
} from "@/lib/api-client";

/**
 * GET /api/workflows/status?runId=...&touchType=touch_1
 *
 * Client-side polling endpoint for workflow status checks.
 * Using a Route Handler (instead of server actions) avoids blocking
 * the Next.js navigation queue when polling runs concurrently with
 * client-side navigation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const runId = searchParams.get("runId");
  const touchType = searchParams.get("touchType");

  if (!runId || !touchType) {
    return NextResponse.json(
      { error: "Missing runId or touchType" },
      { status: 400 },
    );
  }

  try {
    let status;
    switch (touchType) {
      case "touch_1":
        status = await getWorkflowStatus(runId);
        break;
      case "touch_2":
        status = await getTouch2WorkflowStatus(runId);
        break;
      case "touch_3":
        status = await getTouch3WorkflowStatus(runId);
        break;
      case "touch_4":
        status = await getTouch4WorkflowStatus(runId);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown touch type: ${touchType}` },
          { status: 400 },
        );
    }

    console.log(`[workflows/status] runId=${runId} status=${(status as Record<string, unknown>).status}`);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Status check failed";
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[workflows/status] Error:", message);
    if (stack) console.error("[workflows/status] Stack:", stack);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
