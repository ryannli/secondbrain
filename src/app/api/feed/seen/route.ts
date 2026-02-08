import { NextRequest, NextResponse } from "next/server";
import { markFeedItemsSeen } from "@/lib/storage";

/**
 * POST /api/feed/seen
 * Mark feed item URLs as seen (for dedup)
 */
export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: true }); // no-op
    }

    await markFeedItemsSeen(urls);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/feed/seen] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
