import { NextRequest, NextResponse } from "next/server";
import { listConversations, saveConversation } from "@/lib/storage";
import { AgentConversation } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

/**
 * GET /api/conversations
 * List all conversations
 */
export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    console.error("[GET /api/conversations] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, messages } = body;

    const now = new Date().toISOString();
    const conversation: AgentConversation = {
      id: `conv-${uuidv4().slice(0, 8)}`,
      title: title || "New conversation",
      createdAt: now,
      updatedAt: now,
      messages: messages || [],
    };

    await saveConversation(conversation);

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    console.error("[POST /api/conversations] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
