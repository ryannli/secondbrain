import { NextRequest, NextResponse } from "next/server";
import { findEntryPath, getNotebookPath } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { UserHighlight } from "@/lib/types";

/**
 * Find an entry directory by ID, searching both library and notebook.
 */
async function findEntryInAll(id: string): Promise<string | null> {
  // Search library first (default), then notebook
  const libraryResult = await findEntryPath(id);
  if (libraryResult) return libraryResult;
  return findEntryPath(id, getNotebookPath());
}

async function loadHighlights(entryDir: string): Promise<UserHighlight[]> {
  try {
    const raw = await fs.readFile(path.join(entryDir, "highlights.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveHighlights(entryDir: string, highlights: UserHighlight[]): Promise<void> {
  await fs.writeFile(path.join(entryDir, "highlights.json"), JSON.stringify(highlights, null, 2), "utf-8");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entryDir = await findEntryInAll(id);
  if (!entryDir) {
    return NextResponse.json({ success: true, highlights: [] });
  }
  return NextResponse.json({ success: true, highlights: await loadHighlights(entryDir) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ success: false, error: "text is required" }, { status: 400 });
    }

    const entryDir = await findEntryInAll(id);
    if (!entryDir) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    const highlights = await loadHighlights(entryDir);
    highlights.push({
      id: `uh-${Date.now().toString(36)}`,
      text,
      createdAt: new Date().toISOString(),
    });
    await saveHighlights(entryDir, highlights);

    return NextResponse.json({ success: true, highlights });
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
      return NextResponse.json({ success: false, error: "highlightId is required" }, { status: 400 });
    }

    const entryDir = await findEntryInAll(id);
    if (!entryDir) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    const highlights = (await loadHighlights(entryDir)).filter((h) => h.id !== highlightId);
    await saveHighlights(entryDir, highlights);

    return NextResponse.json({ success: true, highlights });
  } catch (error) {
    console.error("Remove highlight error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
