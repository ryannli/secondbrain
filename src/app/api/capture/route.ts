import { NextRequest, NextResponse } from "next/server";
import { extractFromUrl, extractFromHtml, detectSourceType } from "@/lib/content";
import { analyzeContent, generateTitle, formatTextContent } from "@/lib/claude";
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
      sourceType = sourceUrl ? detectSourceType(sourceUrl) : "article";
      originalContent = html;
    } else if (url) {
      initialTitle = title || new URL(url).hostname;
      sourceUrl = url;
      sourceType = detectSourceType(url);
      originalContent = ""; // Will be fetched during processing
    } else {
      initialTitle = title || text.slice(0, 50) + "...";
      sourceType = "note";
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
