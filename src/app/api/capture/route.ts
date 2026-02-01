import { NextRequest, NextResponse } from "next/server";
import { extractFromUrl, extractFromHtml, getSourceType, getTypeFromExtension } from "@/lib/content";
import { analyzeContent, generateTitle, formatTextContent, analyzeFile, findRelatedSources, analyzeConnections } from "@/lib/claude";
import { createPendingSource, completeSource, failSource, ensureLibraryExists, listSourcesForConnections, addConnectionToSource, saveSourceContent, saveSourceAnalysis } from "@/lib/storage";
import { SourceType, Connection } from "@/lib/types";

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

    // Step 1: Extract content
    if (html) {
      console.log(`[${id}] Extracting content from HTML (${html.length} chars)...`);
      const extracted = await extractFromHtml(html, url);
      extractedTitle = extracted.title;
      content = extracted.content;
    } else if (url) {
      console.log(`[${id}] Extracting content from: ${url}`);
      const extracted = await extractFromUrl(url);
      extractedTitle = extracted.title;
      content = extracted.content;
    } else {
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

    // Progressive save: content is now visible to user
    console.log(`[${id}] Saving content (progressive step 1)...`);
    await saveSourceContent(id, content, extractedTitle);

    // Step 2: Analyze with Claude
    console.log(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content, url);

    // Progressive save: analysis is now visible to user
    console.log(`[${id}] Saving analysis (progressive step 2)...`);
    await saveSourceAnalysis(id, analysis);

    // Step 3: Find connections with existing sources (can be slower)
    console.log(`[${id}] Finding connections...`);
    const connections = await findConnectionsForSource(id, extractedTitle, analysis);
    if (connections.length > 0) {
      analysis.connections = connections;
      console.log(`[${id}] Found ${connections.length} connections`);
      // Progressive save: connections now visible
      console.log(`[${id}] Saving connections (progressive step 3)...`);
      await saveSourceAnalysis(id, analysis);
    }

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

    // Step 1: Extract content from file
    if (sourceType === "image" || sourceType === "document") {
      console.log(`[${id}] Analyzing ${sourceType} with Claude...`);
      const fileResult = await analyzeFile(id, originalFileName);
      content = fileResult.content;
      extractedTitle = fileResult.title;
    } else {
      console.log(`[${id}] Unsupported file type: ${sourceType}`);
      content = `File: ${displayName}\n\n[Content extraction for this file type is not yet supported]`;
      extractedTitle = displayName.replace(/\.[^.]+$/, "");
    }

    // Progressive save: content is now visible to user
    console.log(`[${id}] Saving content (progressive step 1)...`);
    await saveSourceContent(id, content, extractedTitle);

    // Step 2: Analyze with Claude
    console.log(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content);

    // Progressive save: analysis is now visible to user
    console.log(`[${id}] Saving analysis (progressive step 2)...`);
    await saveSourceAnalysis(id, analysis);

    // Step 3: Find connections with existing sources
    console.log(`[${id}] Finding connections...`);
    const connections = await findConnectionsForSource(id, extractedTitle, analysis);
    if (connections.length > 0) {
      analysis.connections = connections;
      console.log(`[${id}] Found ${connections.length} connections`);
      // Progressive save: connections now visible
      console.log(`[${id}] Saving connections (progressive step 3)...`);
      await saveSourceAnalysis(id, analysis);
    }

    console.log(`[${id}] File processing complete`);
  } catch (error) {
    console.error(`[${id}] File processing failed:`, error);
    await failSource(id, error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Find connections between a new source and existing sources
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
    console.log(`[${sourceId}] Loaded ${existingSources.length} existing sources`);

    if (existingSources.length === 0) {
      console.log(`[${sourceId}] No existing sources to compare`);
      return [];
    }

    // Phase 1: Find potentially related sources using summaries only
    console.log(`[${sourceId}] Calling findRelatedSources...`);
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
      console.log(`[${sourceId}] Creating reverse connections...`);
      await createReverseConnections(sourceId, title, connections);
    }

    return connections;
  } catch (error) {
    console.error(`[${sourceId}] Failed to find connections:`, error);
    return []; // Graceful degradation - continue without connections
  }
}

/**
 * Create reverse connections in related sources
 * e.g., if A "builds_on" B, then B gets "extended_by" A
 */
async function createReverseConnections(
  newSourceId: string,
  newSourceTitle: string,
  connections: Connection[]
): Promise<void> {
  // Map connection types to their reverse (all symmetric now)
  const reverseType: Record<string, Connection["type"]> = {
    redundant: "redundant",
    contradicts: "contradicts",
    related: "related",
  };

  // Group connections by related source to avoid updating the same source multiple times
  const connectionsBySource = new Map<string, Connection[]>();

  for (const conn of connections) {
    for (const relatedId of conn.relatedSourceIds) {
      if (!connectionsBySource.has(relatedId)) {
        connectionsBySource.set(relatedId, []);
      }
      connectionsBySource.get(relatedId)!.push(conn);
    }
  }

  // Create reverse connections for each related source
  for (const [relatedSourceId, sourceConnections] of connectionsBySource) {
    for (const conn of sourceConnections) {
      // Rewrite summary to reference the new source title instead of the original
      // The original summary references the related source, so we need to flip the perspective
      const reverseSummary = rewriteSummaryForReverse(conn.summary, conn.relatedSourceTitles, newSourceTitle);

      const reverseConnection: Connection = {
        id: `rev-${conn.id}-${newSourceId}`,
        type: reverseType[conn.type] || conn.type,
        summary: reverseSummary,
        details: conn.details,
        relatedSourceIds: [newSourceId],
        relatedSourceTitles: [newSourceTitle],
        conceptTerms: conn.conceptTerms,
      };

      const success = await addConnectionToSource(relatedSourceId, reverseConnection);
      if (success) {
        console.log(`[${newSourceId}] Added reverse connection to ${relatedSourceId}`);
      }
    }
  }
}

/**
 * Rewrite a connection summary to reference the new source instead of the original
 */
function rewriteSummaryForReverse(
  originalSummary: string,
  originalTitles: string[],
  newSourceTitle: string
): string {
  // Simply reference the new source title for the reverse connection
  // The summary will point to the new source that has a connection back
  return `Related to "${newSourceTitle}"`;
}
