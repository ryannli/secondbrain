import { NextRequest, NextResponse } from "next/server";
import { loadWorkspaceDocument, getDocumentOutputPath } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const document = await loadWorkspaceDocument(id);

    if (!document) {
      return NextResponse.json(
        { success: false, error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error("Error loading document:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
