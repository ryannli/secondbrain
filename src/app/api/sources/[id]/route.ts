import { NextRequest, NextResponse } from "next/server";
import { loadSource, deleteEntry, updateSourceContent, updateReadStatus } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const source = await loadSource(id);

    if (!source) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    // Auto-mark as read when viewing (if ready and not already read)
    if (source.meta.processingStatus === "ready" && source.meta.readStatus !== "read") {
      await updateReadStatus(id, "read");
      source.meta.readStatus = "read";
      source.meta.lastReadAt = new Date().toISOString();
    }

    return NextResponse.json({ success: true, source });
  } catch (error) {
    console.error("Error loading source:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const deleted = await deleteEntry(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting source:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, content, readStatus } = body as {
      title?: string;
      content?: string;
      readStatus?: "read" | "unread";
    };

    if (!title && !content && !readStatus) {
      return NextResponse.json(
        { success: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    // Update read status if provided
    if (readStatus) {
      const statusResult = await updateReadStatus(id, readStatus);
      if (!statusResult.success) {
        return NextResponse.json(
          { success: false, error: statusResult.error },
          { status: 404 }
        );
      }
    }

    // Update content if provided
    if (title || content) {
      const result = await updateSourceContent(id, { title, content });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating source:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
