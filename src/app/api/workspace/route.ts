import { NextResponse } from "next/server";
import { listWorkspaceDocuments, listWorkspaceFolders } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const [documents, folders] = await Promise.all([
      listWorkspaceDocuments(),
      listWorkspaceFolders(),
    ]);
    return NextResponse.json({ success: true, documents, folders });
  } catch (error) {
    console.error("Error listing workspace:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
