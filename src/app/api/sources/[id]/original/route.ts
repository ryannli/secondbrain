import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { findEntryPath } from "@/lib/storage";

/**
 * Serve the original file for a source (image, PDF, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Find the source directory
    const sourcePath = await findEntryPath(id);
    if (!sourcePath) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    // Read meta.json to get the original file name
    const originalData = JSON.parse(await fs.readFile(path.join(sourcePath, "meta.json"), "utf-8"));
    const originalFileName = originalData.original_file;

    if (!originalFileName) {
      return NextResponse.json(
        { success: false, error: "No original file found" },
        { status: 404 }
      );
    }

    // Read the original file
    const filePath = path.join(sourcePath, originalFileName);
    const fileBuffer = await fs.readFile(filePath);

    // Determine content type based on extension
    const ext = originalFileName.split(".").pop()?.toLowerCase() || "";
    const contentTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      html: "text/html",
      txt: "text/plain",
    };
    const contentType = contentTypes[ext] || "application/octet-stream";

    // Build response headers
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${originalFileName}"`,
    };

    // For HTML files, add CSP to disable JavaScript (prevents refresh loops from sites like Twitter)
    if (ext === "html") {
      headers["Content-Security-Policy"] = "script-src 'none'";
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error("Error serving original file:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
