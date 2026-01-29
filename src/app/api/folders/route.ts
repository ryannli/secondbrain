import { NextRequest, NextResponse } from "next/server";
import { listFolders, createFolder } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const folders = await listFolders();
    return NextResponse.json({ success: true, folders });
  } catch (error) {
    console.error("Error listing folders:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { name, parentPath } = body as { name: string; parentPath?: string };

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "Folder name is required" },
        { status: 400 }
      );
    }

    // Validate folder name (no special characters except dash and underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: "Folder name can only contain letters, numbers, dash, and underscore" },
        { status: 400 }
      );
    }

    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    await createFolder(folderPath);

    return NextResponse.json({ success: true, path: folderPath });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
