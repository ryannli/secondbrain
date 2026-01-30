import { NextRequest, NextResponse } from "next/server";
import { loadSource } from "@/lib/storage";
import { updateAnalysis } from "@/lib/storage";

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

    const source = await loadSource(id);
    if (!source || !source.analysis) {
      return NextResponse.json(
        { success: false, error: "Source or analysis not found" },
        { status: 404 }
      );
    }

    const analysis = { ...source.analysis };

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

    // Save updated analysis
    await updateAnalysis(id, analysis);

    return NextResponse.json({
      success: true,
      source: { ...source, analysis },
    });
  } catch (error) {
    console.error("Reaction update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
