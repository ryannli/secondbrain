import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getNotebookPath } from "@/lib/storage";

export async function GET(): Promise<NextResponse> {
  try {
    const notebookPath = getNotebookPath();

    // Ensure notebook exists
    try {
      await fs.access(notebookPath);
    } catch {
      await fs.mkdir(notebookPath, { recursive: true });
      return NextResponse.json({ success: true, folders: [] });
    }

    // Recursively find all folders
    const folders: string[] = [];

    async function scanDir(dir: string, relativePath: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const folderRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          // Check if this is a document folder (has meta.json) - skip these
          const metaPath = path.join(dir, entry.name, "meta.json");
          try {
            await fs.access(metaPath);
            // Has meta.json, this is a document folder, not a category folder
          } catch {
            // No meta.json, this is a category folder
            folders.push(folderRelPath);
            await scanDir(path.join(dir, entry.name), folderRelPath);
          }
        }
      }
    }

    await scanDir(notebookPath, "");
    return NextResponse.json({ success: true, folders });
  } catch (error) {
    console.error("Error listing notebook folders:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
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

    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        { success: false, error: "Folder name can only contain letters, numbers, dash, and underscore" },
        { status: 400 }
      );
    }

    const notebookPath = getNotebookPath();
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    const fullPath = path.join(notebookPath, folderPath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedNotebook = path.resolve(notebookPath);
    if (!resolvedPath.startsWith(resolvedNotebook)) {
      return NextResponse.json(
        { success: false, error: "Invalid folder path" },
        { status: 400 }
      );
    }

    await fs.mkdir(fullPath, { recursive: true });

    return NextResponse.json({ success: true, path: folderPath });
  } catch (error) {
    console.error("Error creating notebook folder:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
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

    const notebookPath = getNotebookPath();
    const fullPath = path.join(notebookPath, folderPath);

    // Security check
    const resolvedPath = path.resolve(fullPath);
    const resolvedNotebook = path.resolve(notebookPath);
    if (!resolvedPath.startsWith(resolvedNotebook)) {
      return NextResponse.json(
        { success: false, error: "Invalid folder path" },
        { status: 400 }
      );
    }

    await fs.rm(fullPath, { recursive: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting notebook folder:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
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

    // Validate new name
    if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
      return NextResponse.json(
        { success: false, error: "Folder name can only contain letters, numbers, dash, and underscore" },
        { status: 400 }
      );
    }

    const notebookPath = getNotebookPath();
    const fullOldPath = path.join(notebookPath, folderPath);

    // Compute new path
    const parentDir = path.dirname(folderPath);
    const newPath = parentDir === "." ? newName : `${parentDir}/${newName}`;
    const fullNewPath = path.join(notebookPath, newPath);

    // Security check
    const resolvedOld = path.resolve(fullOldPath);
    const resolvedNew = path.resolve(fullNewPath);
    const resolvedNotebook = path.resolve(notebookPath);
    if (!resolvedOld.startsWith(resolvedNotebook) || !resolvedNew.startsWith(resolvedNotebook)) {
      return NextResponse.json(
        { success: false, error: "Invalid folder path" },
        { status: 400 }
      );
    }

    await fs.rename(fullOldPath, fullNewPath);

    return NextResponse.json({ success: true, newPath });
  } catch (error) {
    console.error("Error renaming notebook folder:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
