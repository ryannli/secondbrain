import { NextResponse } from "next/server";
import { listNotebookDocuments, listNotebookFolders } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const [documents, folders] = await Promise.all([
      listNotebookDocuments(),
      listNotebookFolders(),
    ]);
    return NextResponse.json({ success: true, documents, folders });
  } catch (error) {
    console.error("Error listing notebook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
