import { NextRequest, NextResponse } from "next/server";
import { loadSource, findEntryPath } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { Analysis } from "@/lib/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, itemId, reaction } = body;

    // type: "highlight" or "concept"
    // itemId: the id of the highlight or concept
    // reaction: the user's reaction/status

    // Find source path
    const sourceDir = await findEntryPath(id);
    if (!sourceDir) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    // Read fresh analysis from disk to avoid race conditions
    // (connections might have been added after the source was loaded in the UI)
    const analysisPath = path.join(sourceDir, "analysis.json");
    let analysis: Analysis;
    try {
      const analysisJson = await fs.readFile(analysisPath, "utf-8");
      analysis = JSON.parse(analysisJson);
    } catch {
      return NextResponse.json(
        { success: false, error: "Analysis not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    if (type === "highlight") {
      const highlights = analysis.digest.highlights ?? [];
      const highlight = highlights.find((h) => h.id === itemId);
      if (highlight) {
        // Toggle reaction: if same reaction clicked again, clear it
        const newReaction = highlight.reaction === reaction ? undefined : reaction;
        highlight.reaction = newReaction;
        highlight.reactionAt = newReaction ? now : undefined;
      }
    }

    if (type === "concept") {
      const concepts = analysis.digest.concepts ?? [];
      const concept = concepts.find((c) => c.id === itemId);
      if (concept) {
        // Toggle status: if same status clicked again, clear it
        const newStatus = concept.status === reaction ? undefined : reaction;
        concept.status = newStatus;
        concept.statusAt = newStatus ? now : undefined;
      }
    }

    if (type === "rating") {
      // reaction is the numeric value as string (e.g. "3.5"), or "" to clear
      if (reaction === "" || reaction === undefined) {
        analysis.userRating = undefined;
        analysis.userRatingAt = undefined;
      } else {
        const numValue = parseFloat(reaction);
        if (!isNaN(numValue) && numValue >= 0.5 && numValue <= 5) {
          analysis.userRating = numValue;
          analysis.userRatingAt = now;
        }
      }
    }

    // Save updated analysis directly to file
    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");

    // Load full source for response
    const source = await loadSource(id);

    return NextResponse.json({
      success: true,
      source: source ? { ...source, analysis } : null,
    });
  } catch (error) {
    console.error("Reaction update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
