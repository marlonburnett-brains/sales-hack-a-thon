import { fetchActionCount } from "@/lib/api-client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const count = await fetchActionCount();
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
