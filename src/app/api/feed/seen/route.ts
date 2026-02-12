import { NextRequest, NextResponse } from "next/server";
import { markFeedItemsSeen, unmarkFeedItemsSeen } from "@/lib/storage";

/**
 * POST /api/feed/seen
 * Mark or unmark feed item URLs as seen (for dedup)
 * Body: { urls: string[], unseen?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { urls, unseen, text } = await request.json();

    if ((!Array.isArray(urls) || urls.length === 0) && !text) {
      return NextResponse.json({ success: true }); // no-op
    }

    if (unseen) {
      await unmarkFeedItemsSeen(urls || [], text);
    } else {
      await markFeedItemsSeen(urls || [], text);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/feed/seen] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
