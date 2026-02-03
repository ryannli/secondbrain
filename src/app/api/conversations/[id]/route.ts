import { NextRequest, NextResponse } from "next/server";
import { loadConversation, saveConversation, deleteConversation } from "@/lib/storage";

/**
 * GET /api/conversations/[id]
 * Get a single conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await loadConversation(id);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    console.error("[GET /api/conversations/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update a conversation (title, messages, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await loadConversation(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Update fields
    const updated = {
      ...existing,
      title: body.title ?? existing.title,
      messages: body.messages ?? existing.messages,
      updatedAt: new Date().toISOString(),
    };

    await saveConversation(updated);

    return NextResponse.json({ success: true, conversation: updated });
  } catch (error) {
    console.error("[PATCH /api/conversations/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteConversation(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/conversations/[id]] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
