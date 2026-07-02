import { debugLog } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { getSourceType, getTypeFromExtension } from "@/lib/content";
import { createPendingSource, ensureLibraryExists } from "@/lib/storage";
import { SourceType } from "@/lib/types";
import { processSourceInBackground, processFileInBackground } from "@/lib/capturePipeline";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check content type for file upload vs JSON
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      return handleFileUpload(request);
    }

    const body = await request.json();
    const { url, text, title, html } = body;

    // Get user's User-Agent for forwarding to target sites
    const userAgent = request.headers.get("user-agent") || undefined;

    if (!url && !text && !html) {
      return NextResponse.json(
        { success: false, error: "url, text, or html is required" },
        { status: 400 }
      );
    }

    await ensureLibraryExists();

    // Check if URL is a direct PDF link (like arXiv)
    if (url && isPdfUrl(url)) {
      debugLog(`Detected PDF URL: ${url}`);
      return handlePdfUrl(url, title);
    }

    // Determine initial title and type for immediate display
    let initialTitle: string;
    let sourceType: SourceType;
    let sourceUrl: string | undefined;
    let originalContent: string;

    if (html) {
      initialTitle = title || "Processing...";
      sourceUrl = body.url;
      sourceType = getSourceType(sourceUrl);
      originalContent = html;
    } else if (url) {
      initialTitle = title || new URL(url).hostname;
      sourceUrl = url;
      sourceType = getSourceType(url);
      originalContent = ""; // Will be fetched during processing
    } else {
      initialTitle = title || text.slice(0, 50) + "...";
      sourceType = "text";
      originalContent = text;
    }

    // Phase 1: Create pending source immediately
    debugLog(`Creating pending source: ${initialTitle}`);
    const { id, meta } = await createPendingSource(
      {
        title: initialTitle,
        type: sourceType,
        sourceUrl,
      },
      originalContent
    );

    // Return immediately with pending source
    const pendingResponse = NextResponse.json({
      success: true,
      source: {
        meta,
        content: "Processing...",
        originalContent,
      },
    }, { headers: corsHeaders });

    // Phase 2: Process in background (fire and forget)
    processSourceInBackground(id, { url, text, title, html, userAgent }).catch((error) => {
      console.error(`Background processing failed for ${id}:`, error);
    });

    return pendingResponse;
  } catch (error) {
    console.error("Capture error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle file upload (images, documents)
 */
async function handleFileUpload(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    await ensureLibraryExists();

    const filename = file.name;
    const sourceType = getTypeFromExtension(filename);
    const ext = filename.split(".").pop()?.toLowerCase() || "bin";
    const originalFileName = `original.${ext}`;

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Initial title from filename
    const initialTitle = filename.replace(/\.[^.]+$/, "") || "Uploaded file";

    debugLog(`Creating pending source for file: ${filename} (${sourceType})`);
    const { id, meta } = await createPendingSource(
      {
        title: initialTitle,
        type: sourceType,
      },
      buffer,
      { originalFileName }
    );

    // Return immediately
    const response = NextResponse.json({
      success: true,
      source: {
        meta,
        content: "Processing...",
        originalContent: `[File: ${filename}]`,
      },
    }, { headers: corsHeaders });

    // Process in background - pass the file path in library, not buffer
    // File is already saved at: user_data/library/{id}/{originalFileName}
    processFileInBackground(id, originalFileName, sourceType, filename).catch((error) => {
      console.error(`Background file processing failed for ${id}:`, error);
    });

    return response;
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Check if URL is a direct PDF link
 */
function isPdfUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();

    // Direct .pdf extension
    if (pathname.endsWith(".pdf")) {
      return true;
    }

    // arXiv PDF URLs: arxiv.org/pdf/xxxx
    if (parsedUrl.hostname.includes("arxiv.org") && pathname.includes("/pdf/")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Handle PDF URL by downloading and processing as a file
 */
async function handlePdfUrl(url: string, title?: string): Promise<NextResponse> {
  try {
    debugLog(`Downloading PDF from: ${url}`);

    // Download the PDF
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract filename from URL or use default
    let filename = "document.pdf";
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;

      // Try to get a meaningful name from the URL
      if (parsedUrl.hostname.includes("arxiv.org")) {
        // arXiv: extract paper ID (e.g., 2401.12345)
        const match = pathname.match(/(\d+\.\d+)/);
        if (match) {
          filename = `arxiv-${match[1]}.pdf`;
        }
      } else if (pathname.endsWith(".pdf")) {
        filename = pathname.split("/").pop() || filename;
      }
    } catch {
      // Use default filename
    }

    const initialTitle = title || filename.replace(/\.pdf$/i, "");
    const originalFileName = "original.pdf";

    debugLog(`Creating pending source for PDF: ${filename}`);
    const { id, meta } = await createPendingSource(
      {
        title: initialTitle,
        type: "document",
        sourceUrl: url,
      },
      buffer,
      { originalFileName }
    );

    // Return immediately
    const pendingResponse = NextResponse.json({
      success: true,
      source: {
        meta,
        content: "Processing...",
        originalContent: `[PDF: ${filename}]`,
      },
    }, { headers: corsHeaders });

    // Process in background
    processFileInBackground(id, originalFileName, "document", filename).catch((error) => {
      console.error(`Background PDF processing failed for ${id}:`, error);
    });

    return pendingResponse;
  } catch (error) {
    console.error("PDF download error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download PDF",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
