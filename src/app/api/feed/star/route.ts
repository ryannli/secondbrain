import { NextRequest, NextResponse } from "next/server";
import { starBriefingItem, unstarBriefingItem } from "@/lib/storage";

/**
 * POST /api/feed/star
 * Star or unstar a briefing news item
 * Body: { text: string, unstar?: boolean, feedDate?: string, refs?: { url: string, title: string }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { text, unstar, feedDate, refs } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
    }

    if (unstar) {
      await unstarBriefingItem(text);
    } else {
      await starBriefingItem(text, { feedDate, refs });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/feed/star] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
