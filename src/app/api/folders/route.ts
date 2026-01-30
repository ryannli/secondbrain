import { NextRequest, NextResponse } from "next/server";
import { listFolders, createFolder, deleteFolder, renameFolder } from "@/lib/storage";

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

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { path: folderPath } = body as { path: string };

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { success: false, error: "Folder path is required" },
        { status: 400 }
      );
    }

    await deleteFolder(folderPath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { path: folderPath, newName } = body as { path: string; newName: string };

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { success: false, error: "Folder path is required" },
        { status: 400 }
      );
    }

    if (!newName || typeof newName !== "string") {
      return NextResponse.json(
        { success: false, error: "New folder name is required" },
        { status: 400 }
      );
    }

    const newPath = await renameFolder(folderPath, newName);
    return NextResponse.json({ success: true, newPath });
  } catch (error) {
    console.error("Error renaming folder:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
