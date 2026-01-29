import { NextRequest, NextResponse } from "next/server";
import { extractFromUrl, extractFromHtml } from "@/lib/content";
import { analyzeContent, generateTitle, formatTextContent } from "@/lib/claude";
import { saveSource, ensureLibraryExists } from "@/lib/storage";
import { CaptureResponse, SourceType } from "@/lib/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle CORS preflight
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest): Promise<NextResponse<CaptureResponse>> {
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

    let extractedTitle: string;
    let originalContent: string;
    let content: string;
    let sourceUrl: string | undefined;
    let sourceType: SourceType;

    if (html) {
      // Extract content from pre-rendered HTML (from browser extension)
      console.log(`Extracting content from HTML (${html.length} chars)...`);
      const extracted = await extractFromHtml(html, body.url, body.title);
      extractedTitle = extracted.title;
      originalContent = extracted.originalContent;
      content = extracted.content;
      sourceUrl = body.url;
      sourceType = extracted.type;
    } else if (url) {
      // Extract content from URL
      console.log(`Extracting content from: ${url}`);
      const extracted = await extractFromUrl(url);
      extractedTitle = extracted.title;
      originalContent = extracted.originalContent;
      content = extracted.content;
      sourceUrl = url;
      sourceType = extracted.type;
    } else {
      // Format the provided text
      originalContent = text;
      console.log("Formatting text content...");
      content = await formatTextContent(text);
      sourceType = "note";
      if (title) {
        extractedTitle = title;
      } else {
        // Generate title using AI
        console.log("Generating title for text content...");
        extractedTitle = await generateTitle(text);
        console.log(`Generated title: ${extractedTitle}`);
      }
    }

    // Analyze with Claude
    console.log(`Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content, sourceUrl);

    // Save to filesystem
    console.log(`Saving source: ${extractedTitle}`);
    const source = await saveSource(
      {
        title: extractedTitle,
        type: sourceType,
        sourceUrl,
      },
      originalContent,
      content,
      analysis
    );

    console.log(`Source saved with ID: ${source.meta.id}`);

    return NextResponse.json({ success: true, source }, { headers: corsHeaders });
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
