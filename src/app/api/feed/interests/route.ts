import { NextResponse } from "next/server";
import { listSourcesForConnections } from "@/lib/storage";
import { extractUserInterests } from "@/lib/claude";

/**
 * POST /api/feed/interests
 * Generate interests from user's library
 */
export async function POST() {
  try {
    const sources = await listSourcesForConnections();

    if (sources.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No sources in library to extract interests from",
      });
    }

    const sourcesForInterests = sources.map((s) => ({
      title: s.title,
      concepts: s.concepts,
      highlights: s.highlights.map((h) => h.text),
    }));

    const interests = await extractUserInterests(sourcesForInterests);

    return NextResponse.json({
      success: true,
      interests,
    });
  } catch (error) {
    console.error("[POST /api/feed/interests] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
