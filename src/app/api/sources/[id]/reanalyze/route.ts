import { NextRequest, NextResponse } from "next/server";
import { loadSource } from "@/lib/storage";
import { analyzeContent, formatTextContent } from "@/lib/claude";
import { extractFromUrl, extractFromHtml } from "@/lib/content";
import { promises as fs } from "fs";
import path from "path";

function getLibraryPath(): string {
  return process.env.SECONDBRAIN_LIBRARY || path.join(process.cwd(), "library");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const source = await loadSource(id);

    if (!source) {
      return NextResponse.json(
        { success: false, error: "Source not found" },
        { status: 404 }
      );
    }

    let newContent: string;
    let newOriginalContent = source.originalContent;
    const sourceDir = path.join(getLibraryPath(), id);

    // Check if we have stored HTML (from extension capture)
    const hasStoredHtml = source.originalContent && source.originalContent.includes("<!DOCTYPE") || source.originalContent.includes("<html");

    if (hasStoredHtml) {
      // Use stored HTML to reprocess
      console.log("Re-processing from stored HTML...");
      const extracted = await extractFromHtml(source.originalContent, source.meta.sourceUrl, source.meta.title);
      newContent = extracted.content;
    } else if (source.meta.sourceUrl) {
      // URL without stored HTML: re-fetch
      console.log(`Re-fetching content from: ${source.meta.sourceUrl}`);
      const extracted = await extractFromUrl(source.meta.sourceUrl);
      newOriginalContent = extracted.originalContent;
      newContent = extracted.content;
      // Save the new HTML for future reprocessing
      await fs.writeFile(path.join(sourceDir, "original.html"), newOriginalContent, "utf-8");
    } else {
      // Plain text: re-format
      console.log("Re-formatting text content...");
      newContent = await formatTextContent(source.originalContent);
    }

    // Re-analyze the content
    console.log("Re-analyzing content...");
    const analysis = await analyzeContent(
      source.meta.title,
      newContent,
      source.meta.sourceUrl
    );

    // Update source.md
    const sourceMd = `---
title: "${source.meta.title.replace(/"/g, '\\"')}"
type: ${source.meta.type}
${source.meta.sourceUrl ? `source_url: "${source.meta.sourceUrl}"` : ""}
created_at: "${source.meta.createdAt}"
---

<!-- PROCESSED_CONTENT_START -->
${newContent}
<!-- PROCESSED_CONTENT_END -->
`;
    await fs.writeFile(path.join(sourceDir, "source.md"), sourceMd, "utf-8");

    // Save updated analysis
    await fs.writeFile(
      path.join(sourceDir, "analysis.json"),
      JSON.stringify(analysis, null, 2),
      "utf-8"
    );

    const updatedSource = {
      ...source,
      originalContent: newOriginalContent,
      content: newContent,
      analysis,
    };

    return NextResponse.json({
      success: true,
      source: updatedSource,
    });
  } catch (error) {
    console.error("Error re-processing source:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
