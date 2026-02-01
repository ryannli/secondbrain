import { NextRequest, NextResponse } from "next/server";
import { loadSource, findSourcePath, listSourcesForConnections, addConnectionToSource } from "@/lib/storage";
import { analyzeContent, formatTextContent, findRelatedSources, analyzeConnections } from "@/lib/claude";
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
    // Note: type is now "html" for all web pages, so we check the URL instead
    const isTwitter = source.meta.sourceUrl && (source.meta.sourceUrl.includes("x.com") || source.meta.sourceUrl.includes("twitter.com"));
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

    // Find connections with existing sources
    console.log("Finding connections...");
    const connections = await findConnectionsForSource(id, newTitle, analysis);
    if (connections.length > 0) {
      analysis.connections = connections;
      console.log(`Found ${connections.length} connections`);
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
): Promise<Connection[]> {
  try {
    // Load all existing sources with their analysis
    console.log(`[${sourceId}] Loading existing sources for connections...`);
    const existingSources = await listSourcesForConnections(sourceId);
    console.log(`[${sourceId}] Found ${existingSources.length} existing sources`);

    if (existingSources.length === 0) {
      console.log(`[${sourceId}] No existing sources to compare`);
      return [];
    }

    // Phase 1: Find potentially related sources using summaries only
    console.log(`[${sourceId}] Calling findRelatedSources with summary: "${analysis.digest.summary.slice(0, 100)}..."`);
    const relatedIds = await findRelatedSources(
      analysis.digest.summary,
      existingSources.map((s) => ({ id: s.id, title: s.title, summary: s.summary }))
    );
    console.log(`[${sourceId}] findRelatedSources returned: ${JSON.stringify(relatedIds)}`);

    if (relatedIds.length === 0) {
      console.log(`[${sourceId}] No related sources found`);
      return [];
    }

    console.log(`[${sourceId}] Found ${relatedIds.length} potentially related sources`);

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
        highlights: s.highlights,
        concepts: s.concepts.map((c) => ({ term: c.term, definition: c.definition })),
      })),
      learnedConcepts
    );

    // Create reverse connections for related sources
    if (connections.length > 0) {
      console.log("Creating reverse connections...");
      await createReverseConnections(sourceId, title, connections);
    }

    return connections;
  } catch (error) {
    console.error("Failed to find connections:", error);
    return []; // Graceful degradation - continue without connections
  }
}

/**
 * Create reverse connections in related sources
 */
async function createReverseConnections(
  newSourceId: string,
  newSourceTitle: string,
  connections: Connection[]
): Promise<void> {
  const reverseType: Record<string, Connection["type"]> = {
    redundant: "redundant",
    contradicts: "contradicts",
    related: "related",
  };

  const connectionsBySource = new Map<string, Connection[]>();

  for (const conn of connections) {
    for (const relatedId of conn.relatedSourceIds) {
      if (!connectionsBySource.has(relatedId)) {
        connectionsBySource.set(relatedId, []);
      }
      connectionsBySource.get(relatedId)!.push(conn);
    }
  }

  for (const [relatedSourceId, sourceConnections] of connectionsBySource) {
    for (const conn of sourceConnections) {
      // Create a simple summary that references the new source title
      const reverseSummary = `Related to "${newSourceTitle}"`;

      const reverseConnection: Connection = {
        id: `rev-${conn.id}-${newSourceId}`,
        type: reverseType[conn.type] || conn.type,
        summary: reverseSummary,
        details: conn.details,
        relatedSourceIds: [newSourceId],
        relatedSourceTitles: [newSourceTitle],
      };

      const success = await addConnectionToSource(relatedSourceId, reverseConnection);
      if (success) {
        console.log(`Added reverse connection to ${relatedSourceId}`);
      }
    }
  }
}
