import { NextResponse } from "next/server";
import { listInteractionHistory } from "@/lib/storage";

/**
 * GET /api/history
 * Returns all user interaction events for the history timeline.
 */
export async function GET() {
  try {
    const events = await listInteractionHistory();
    return NextResponse.json({ success: true, events });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
