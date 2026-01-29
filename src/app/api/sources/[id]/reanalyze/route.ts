import { NextRequest, NextResponse } from "next/server";
import { loadSource, findSourcePath } from "@/lib/storage";
import { analyzeContent, formatTextContent } from "@/lib/claude";
import { extractFromUrl, extractFromHtml } from "@/lib/content";
import { promises as fs } from "fs";
import path from "path";

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
    let newTitle: string = source.meta.title;
    let newOriginalContent = source.originalContent;
    const sourceDir = await findSourcePath(id);

    if (!sourceDir) {
      return NextResponse.json(
        { success: false, error: "Source directory not found" },
        { status: 404 }
      );
    }

    // Check if we have stored HTML (from extension capture)
    const hasStoredHtml = source.originalContent && (source.originalContent.includes("<!DOCTYPE") || source.originalContent.includes("<html"));

    // Twitter/X: check if stored HTML has actual rendered content (data-testid="tweetText")
    // If it does, we can use it; if not, fall back to fxtwitter
    const isTwitter = source.meta.type === "twitter" ||
      (source.meta.sourceUrl && (source.meta.sourceUrl.includes("x.com") || source.meta.sourceUrl.includes("twitter.com")));
    const hasRenderedTwitterContent = isTwitter && source.originalContent?.includes('data-testid="tweetText"');
    const shouldUseStoredHtml = hasStoredHtml && (!isTwitter || hasRenderedTwitterContent);

    console.log(`Original content length: ${source.originalContent?.length || 0}, hasStoredHtml: ${hasStoredHtml}, isTwitter: ${isTwitter}, hasRenderedTwitterContent: ${hasRenderedTwitterContent}`);

    if (shouldUseStoredHtml) {
      // Use stored HTML to reprocess - don't pass providedTitle so it extracts fresh
      console.log("Re-processing from stored HTML...");
      const extracted = await extractFromHtml(source.originalContent, source.meta.sourceUrl);
      newContent = extracted.content;
      newTitle = extracted.title;
    } else if (source.meta.sourceUrl) {
      // URL without usable stored HTML: re-fetch
      console.log(`Re-fetching content from: ${source.meta.sourceUrl}`);
      const extracted = await extractFromUrl(source.meta.sourceUrl);
      newOriginalContent = extracted.originalContent;
      newContent = extracted.content;
      newTitle = extracted.title;
      // Only save new HTML if we didn't have any stored HTML before
      // (don't overwrite potentially good extension-captured HTML with server-fetched HTML)
      if (!hasStoredHtml) {
        await fs.writeFile(path.join(sourceDir, "original.html"), newOriginalContent, "utf-8");
      }
    } else {
      // Plain text: re-format (title stays the same for plain text)
      console.log("Re-formatting text content...");
      newContent = await formatTextContent(source.originalContent);
    }

    // Re-analyze the content with new title
    console.log("Re-analyzing content...");
    const analysis = await analyzeContent(
      newTitle,
      newContent,
      source.meta.sourceUrl
    );

    // Write content.md (derived content, can be regenerated)
    const contentMd = `---
title: "${newTitle.replace(/"/g, '\\"')}"
---

${newContent}
`;
    await fs.writeFile(path.join(sourceDir, "content.md"), contentMd, "utf-8");

    // Save updated analysis
    await fs.writeFile(
      path.join(sourceDir, "analysis.json"),
      JSON.stringify(analysis, null, 2),
      "utf-8"
    );

    // Remove error.txt if it exists (source is now ready)
    try {
      await fs.unlink(path.join(sourceDir, "error.txt"));
    } catch {
      // error.txt didn't exist, that's fine
    }

    const updatedSource = {
      ...source,
      meta: {
        ...source.meta,
        title: newTitle,
        processingStatus: "ready" as const,
      },
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
