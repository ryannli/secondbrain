import { NextRequest, NextResponse } from "next/server";
import { moveSource } from "@/lib/storage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { targetFolder } = body as { targetFolder: string };

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

    const moved = await moveSource(id, targetFolder);

    if (!moved) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error moving source:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
