import { NextRequest, NextResponse } from "next/server";
import { loadSource, findEntryPath } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { Analysis } from "@/lib/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "text is required" },
        { status: 400 }
      );
    }

    const sourceDir = await findEntryPath(id);
    if (!sourceDir) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

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

    const highlight = {
      id: `uh-${Date.now().toString(36)}`,
      text,
      createdAt: new Date().toISOString(),
    };

    if (!analysis.userHighlights) {
      analysis.userHighlights = [];
    }
    analysis.userHighlights.push(highlight);

    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");

    const source = await loadSource(id);
    return NextResponse.json({
      success: true,
      source: source ? { ...source, analysis } : null,
    });
  } catch (error) {
    console.error("Add highlight error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { highlightId } = await request.json();

    if (!highlightId) {
      return NextResponse.json(
        { success: false, error: "highlightId is required" },
        { status: 400 }
      );
    }

    const sourceDir = await findEntryPath(id);
    if (!sourceDir) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

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

    if (analysis.userHighlights) {
      analysis.userHighlights = analysis.userHighlights.filter(
        (h) => h.id !== highlightId
      );
    }

    await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");

    const source = await loadSource(id);
    return NextResponse.json({
      success: true,
      source: source ? { ...source, analysis } : null,
    });
  } catch (error) {
    console.error("Remove highlight error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
