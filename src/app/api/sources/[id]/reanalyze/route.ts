import { debugLog } from "@/lib/log";
import { NextRequest, NextResponse } from "next/server";
import { loadSource, findEntryPath, listSourcesForConnections, setSourceConnections } from "@/lib/storage";
import { analyzeContent, formatTextContent, findRelatedSources, analyzeConnections, mergeSourceIntoConnections } from "@/lib/claude";
import { extractFromUrl, extractFromHtml } from "@/lib/content";
import { Connection } from "@/lib/types";
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
    const sourceDir = await findEntryPath(id);

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
    // Note: type is now "html" for all web pages, so we check the URL instead
    const isTwitter = source.meta.sourceUrl && (source.meta.sourceUrl.includes("x.com") || source.meta.sourceUrl.includes("twitter.com"));
    const hasRenderedTwitterContent = isTwitter && source.originalContent?.includes('data-testid="tweetText"');
    const shouldUseStoredHtml = hasStoredHtml && (!isTwitter || hasRenderedTwitterContent);

    debugLog(`Original content length: ${source.originalContent?.length || 0}, hasStoredHtml: ${hasStoredHtml}, isTwitter: ${isTwitter}, hasRenderedTwitterContent: ${hasRenderedTwitterContent}`);

    if (shouldUseStoredHtml) {
      // Use stored HTML to reprocess - don't pass providedTitle so it extracts fresh
      debugLog("Re-processing from stored HTML...");
      const extracted = await extractFromHtml(source.originalContent, source.meta.sourceUrl, undefined, id);
      newContent = extracted.content;
      newTitle = extracted.title;
    } else if (source.meta.sourceUrl) {
      // URL without usable stored HTML: re-fetch
      debugLog(`Re-fetching content from: ${source.meta.sourceUrl}`);
      const extracted = await extractFromUrl(source.meta.sourceUrl, undefined, id);
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
      debugLog("Re-formatting text content...");
      newContent = await formatTextContent(source.originalContent, id);
    }

    // Re-analyze the content with new title
    debugLog("Re-analyzing content...");
    const analysis = await analyzeContent(
      newTitle,
      newContent,
      source.meta.sourceUrl,
      id
    );

    // Find connections with existing sources
    debugLog("Finding connections...");
    let connectionError: string | undefined;
    const { connections, error: connError } = await findConnectionsForSource(id, newTitle, analysis);
    if (connError) {
      connectionError = connError;
      console.error(`Connection error: ${connError}`);
    } else if (connections.length > 0) {
      analysis.connections = connections;
      debugLog(`Found ${connections.length} connections`);
    } else {
      debugLog("No connections found");
    }

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
      connectionError, // Include any connection errors for UI to display
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

/**
 * Find connections between a source and existing sources
 */
async function findConnectionsForSource(
  sourceId: string,
  title: string,
  analysis: { digest: { summary: string; highlights: { text: string }[]; concepts: { term: string; definition: string; status?: "knew" | "learned" }[] } }
): Promise<{ connections: Connection[]; error?: string }> {
  try {
    // Load all existing sources with their analysis
    debugLog(`[${sourceId}] Loading existing sources for connections...`);
    const existingSources = await listSourcesForConnections(sourceId);
    debugLog(`[${sourceId}] Found ${existingSources.length} existing sources`);

    if (existingSources.length === 0) {
      debugLog(`[${sourceId}] No existing sources to compare`);
      return { connections: [] };
    }

    // Phase 1: Find potentially related sources using summaries only
    debugLog(`[${sourceId}] Calling findRelatedSources with summary: "${analysis.digest.summary.slice(0, 100)}..."`);
    const relatedIds = await findRelatedSources(
      analysis.digest.summary,
      existingSources.map((s) => ({ id: s.id, title: s.title, summary: s.summary }))
    );
    debugLog(`[${sourceId}] findRelatedSources returned: ${JSON.stringify(relatedIds)}`);

    if (relatedIds.length === 0) {
      debugLog(`[${sourceId}] No related sources found`);
      return { connections: [] };
    }

    debugLog(`[${sourceId}] Found ${relatedIds.length} potentially related sources`);

    // Phase 2: Get detailed analysis of related sources
    const relatedSources = existingSources.filter((s) => relatedIds.includes(s.id));

    // Collect learned concepts from all sources
    const learnedConcepts: { term: string; sourceId: string; sourceTitle: string }[] = [];
    for (const source of existingSources) {
      for (const concept of source.concepts) {
        if (concept.status === "learned") {
          learnedConcepts.push({
            term: concept.term,
            sourceId: source.id,
            sourceTitle: source.title,
          });
        }
      }
    }

    // Analyze connections
    const connections = await analyzeConnections(
      {
        id: sourceId,
        title,
        summary: analysis.digest.summary,
        highlights: analysis.digest.highlights.map((h) => h.text),
        concepts: analysis.digest.concepts.map((c) => ({ term: c.term, definition: c.definition })),
      },
      relatedSources.map((s) => ({
        id: s.id,
        title: s.title,
        summary: s.summary,
        highlights: s.highlights.map((h) => h.text),
        concepts: s.concepts.map((c) => ({ term: c.term, definition: c.definition })),
      })),
      learnedConcepts
    );

    // Smart merge into related sources' connections
    if (connections.length > 0) {
      debugLog("Smart merging into related sources...");
      await smartMergeIntoRelatedSources(
        sourceId,
        title,
        analysis.digest.summary,
        connections
      );
    }

    return { connections };
  } catch (error) {
    console.error("Failed to find connections:", error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error finding connections";
    return { connections: [], error: errorMsg };
  }
}

/**
 * Smart merge a new source into related sources' connections
 */
async function smartMergeIntoRelatedSources(
  newSourceId: string,
  newSourceTitle: string,
  newSourceSummary: string,
  connections: Connection[]
): Promise<void> {
  // Collect unique related source IDs
  const relatedSourceIds = new Set<string>();
  for (const conn of connections) {
    for (const relatedId of conn.relatedSourceIds) {
      relatedSourceIds.add(relatedId);
    }
  }

  // For each related source, smart merge the new source into its connections
  for (const relatedSourceId of relatedSourceIds) {
    try {
      // Load the related source's current connections
      const relatedSource = await loadSourceForMerge(relatedSourceId);
      if (!relatedSource) {
        debugLog(`Could not load related source ${relatedSourceId} for merge`);
        continue;
      }

      const existingConnections = relatedSource.connections || [];

      // Ask AI to merge the new source into existing connections
      debugLog(`Merging into ${relatedSourceId}'s connections...`);
      const mergedConnections = await mergeSourceIntoConnections(
        existingConnections,
        { id: newSourceId, title: newSourceTitle, summary: newSourceSummary },
        relatedSource.title
      );

      // Save the merged connections
      await setSourceConnections(relatedSourceId, mergedConnections);
      debugLog(`Merged into ${relatedSourceId} (${existingConnections.length} → ${mergedConnections.length} connections)`);
    } catch (error) {
      console.error(`Failed to merge into ${relatedSourceId}:`, error);
    }
  }
}

/**
 * Load a source's title and connections for merge operation
 */
async function loadSourceForMerge(
  sourceId: string
): Promise<{ title: string; connections: Connection[] } | null> {
  try {
    const sourcePath = await findEntryPath(sourceId);
    if (!sourcePath) return null;

    // Load title from content.md
    let title = sourceId;
    try {
      const contentMd = await fs.readFile(path.join(sourcePath, "content.md"), "utf-8");
      const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
      if (titleMatch) title = titleMatch[1];
    } catch {
      // Try meta.json
      try {
        const metaContent = await fs.readFile(path.join(sourcePath, "meta.json"), "utf-8");
        const meta = JSON.parse(metaContent);
        title = meta.original_title || sourceId;
      } catch {
        // Use sourceId as fallback
      }
    }

    // Load connections from analysis.json
    let connections: Connection[] = [];
    try {
      const analysisJson = await fs.readFile(path.join(sourcePath, "analysis.json"), "utf-8");
      const analysis = JSON.parse(analysisJson);
      connections = analysis.connections || [];
    } catch {
      // No analysis or connections yet
    }

    return { title, connections };
  } catch {
    return null;
  }
}
