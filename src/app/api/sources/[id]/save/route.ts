import { NextRequest, NextResponse } from "next/server";
import { updateEntrySaved, loadSource } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { saved } = body as { saved: boolean };

    if (typeof saved !== "boolean") {
      return NextResponse.json(
        { success: false, error: "saved must be a boolean" },
        { status: 400 }
      );
    }

    const result = await updateEntrySaved(id, saved);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    // Reload the source to return updated data
    const source = await loadSource(id);
    return NextResponse.json({ success: true, source });
  } catch (error) {
    console.error("Error updating saved status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
