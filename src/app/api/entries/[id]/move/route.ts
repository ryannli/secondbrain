import { NextRequest, NextResponse } from "next/server";
import { moveEntry, getLibraryPath, getNotebookPath } from "@/lib/storage";

type Section = "library" | "notebook";

function getBasePathAndMarker(section: Section): { basePath: string; markerFile: string } {
  if (section === "notebook") {
    return { basePath: getNotebookPath(), markerFile: "meta.json" };
  }
  // Library also uses meta.json now (with fallback to original.json for compatibility)
  return { basePath: getLibraryPath(), markerFile: "meta.json" };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { targetFolder, section = "library" } = body as {
      targetFolder: string;
      section?: Section;
    };

    if (typeof targetFolder !== "string") {
      return NextResponse.json(
        { success: false, error: "targetFolder is required" },
        { status: 400 }
      );
    }

    // Validate target folder path (no ..)
    if (targetFolder.includes("..")) {
      return NextResponse.json(
        { success: false, error: "Invalid folder path" },
        { status: 400 }
      );
    }

    const { basePath, markerFile } = getBasePathAndMarker(section);
    const moved = await moveEntry(id, targetFolder, basePath, markerFile);

    if (!moved) {
      return NextResponse.json(
        { success: false, error: "Entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error moving entry:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
