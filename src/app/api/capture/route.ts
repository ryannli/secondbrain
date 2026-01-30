import { NextRequest, NextResponse } from "next/server";
import { extractFromUrl, extractFromHtml, getSourceType, getTypeFromExtension } from "@/lib/content";
import { analyzeContent, generateTitle, formatTextContent, analyzeFile } from "@/lib/claude";
import { createPendingSource, completeSource, failSource, ensureLibraryExists } from "@/lib/storage";
import { SourceType } from "@/lib/types";

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

    if (!url && !text && !html) {
      return NextResponse.json(
        { success: false, error: "url, text, or html is required" },
        { status: 400 }
      );
    }

    await ensureLibraryExists();

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
    console.log(`Creating pending source: ${initialTitle}`);
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
    processSourceInBackground(id, { url, text, title, html }).catch((error) => {
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
 * Process source content and analysis in background
 */
async function processSourceInBackground(
  id: string,
  input: { url?: string; text?: string; title?: string; html?: string }
): Promise<void> {
  const { url, text, title, html } = input;

  try {
    let extractedTitle: string;
    let content: string;

    if (html) {
      // Extract content from pre-rendered HTML (from browser extension)
      console.log(`[${id}] Extracting content from HTML (${html.length} chars)...`);
      const extracted = await extractFromHtml(html, url);
      extractedTitle = extracted.title;
      content = extracted.content;
    } else if (url) {
      // Extract content from URL
      console.log(`[${id}] Extracting content from: ${url}`);
      const extracted = await extractFromUrl(url);
      extractedTitle = extracted.title;
      content = extracted.content;
      // Note: originalContent was empty, but extractFromUrl fetches it
      // We already saved during createPendingSource, need to update it
    } else {
      // Format the provided text
      console.log(`[${id}] Formatting text content...`);
      content = await formatTextContent(text!);
      if (title) {
        extractedTitle = title;
      } else {
        console.log(`[${id}] Generating title for text content...`);
        extractedTitle = await generateTitle(text!);
        console.log(`[${id}] Generated title: ${extractedTitle}`);
      }
    }

    // Analyze with Claude
    console.log(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content, url);

    // Complete the source
    console.log(`[${id}] Completing source: ${extractedTitle}`);
    await completeSource(id, content, analysis, extractedTitle);

    console.log(`[${id}] Source processing complete`);
  } catch (error) {
    console.error(`[${id}] Processing failed:`, error);
    await failSource(id, error instanceof Error ? error.message : "Unknown error");
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

    console.log(`Creating pending source for file: ${filename} (${sourceType})`);
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
 * Process uploaded file in background
 */
async function processFileInBackground(
  id: string,
  originalFileName: string,  // e.g. "original.png", "original.pdf"
  sourceType: SourceType,
  displayName: string  // original filename for display
): Promise<void> {
  try {
    let content: string;
    let extractedTitle: string;

    if (sourceType === "image" || sourceType === "document") {
      // Use Claude Read tool to analyze the file (works for both images and PDFs)
      // File is already saved in library at: user_data/library/{id}/{originalFileName}
      console.log(`[${id}] Analyzing ${sourceType} with Claude...`);
      const fileResult = await analyzeFile(id, originalFileName);
      content = fileResult.content;
      extractedTitle = fileResult.title;
    } else {
      // Unsupported file type
      console.log(`[${id}] Unsupported file type: ${sourceType}`);
      content = `File: ${displayName}\n\n[Content extraction for this file type is not yet supported]`;
      extractedTitle = displayName.replace(/\.[^.]+$/, "");
    }

    // Analyze with Claude
    console.log(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content);

    // Complete the source
    console.log(`[${id}] Completing source: ${extractedTitle}`);
    await completeSource(id, content, analysis, extractedTitle);

    console.log(`[${id}] File processing complete`);
  } catch (error) {
    console.error(`[${id}] File processing failed:`, error);
    await failSource(id, error instanceof Error ? error.message : "Unknown error");
  }
}
