import { debugLog } from "./log";
import { AGENT_CONTEXT_CONFIG } from "@/lib/config";
import { extractFromUrl, extractFromHtml } from "@/lib/content";
import { analyzeContent, analyzeFile, findRelatedSources, analyzeConnections, mergeSourceIntoConnections, formatTextContent, generateTitle } from "@/lib/claude";
import { saveSourceContent, saveSourceAnalysis, setSourceConnections, saveConnectionError, listSourcesForConnections, loadSource, failSource } from "@/lib/storage";
import { Connection, SourceType } from "@/lib/types";

interface ProcessInput {
  url?: string;
  text?: string;
  title?: string;
  html?: string;
  userAgent?: string;
}

/**
 * Process source content and analysis in background
 */
export async function processSourceInBackground(
  id: string,
  input: ProcessInput
): Promise<void> {
  const { url, text, title, html, userAgent } = input;

  try {
    let extractedTitle: string;
    let content: string;

    // Step 1: Extract content
    if (html) {
      debugLog(`[${id}] Extracting content from HTML (${html.length} chars)...`);
      const extracted = await extractFromHtml(html, url, undefined, id);
      extractedTitle = extracted.title;
      content = extracted.content;
    } else if (url) {
      debugLog(`[${id}] Fetching and extracting content from: ${url}`);
      const extracted = await extractFromUrl(url, userAgent, id);
      extractedTitle = extracted.title;
      content = extracted.content;
    } else {
      debugLog(`[${id}] Formatting text content...`);
      content = await formatTextContent(text!, id);
      if (title) {
        extractedTitle = title;
      } else {
        debugLog(`[${id}] Generating title for text content...`);
        extractedTitle = await generateTitle(text!, id);
        debugLog(`[${id}] Generated title: ${extractedTitle}`);
      }
    }

    // Progressive save: content is now visible to user
    debugLog(`[${id}] Saving content (progressive step 1)...`);
    await saveSourceContent(id, content, extractedTitle);

    // Step 2: Analyze with the configured agent
    debugLog(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content, url, id);

    // Progressive save: analysis is now visible to user
    debugLog(`[${id}] Saving analysis (progressive step 2)...`);
    await saveSourceAnalysis(id, analysis);

    // Step 3: Find connections (isolated — failure here never marks source as failed)
    await findAndSaveConnections(id, extractedTitle, analysis);

    debugLog(`[${id}] Source processing complete`);
  } catch (error) {
    console.error(`[${id}] Processing failed:`, error);
    await failSource(id, error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Process uploaded file in background
 */
export async function processFileInBackground(
  id: string,
  originalFileName: string, // e.g. "original.png", "original.pdf"
  sourceType: SourceType,
  displayName: string // original filename for display
): Promise<void> {
  try {
    let content: string;
    let extractedTitle: string;

    // Step 1: Extract content from file
    if (sourceType === "image" || sourceType === "document") {
      debugLog(`[${id}] Analyzing ${sourceType} with agent...`);
      const fileResult = await analyzeFile(id, originalFileName);
      content = fileResult.content;
      extractedTitle = fileResult.title;
    } else {
      debugLog(`[${id}] Unsupported file type: ${sourceType}`);
      content = `File: ${displayName}\n\n[Content extraction for this file type is not yet supported]`;
      extractedTitle = displayName.replace(/\.[^.]+$/, "");
    }

    // Progressive save: content is now visible to user
    debugLog(`[${id}] Saving content (progressive step 1)...`);
    await saveSourceContent(id, content, extractedTitle);

    // Step 2: Analyze with the configured agent
    debugLog(`[${id}] Analyzing content: ${extractedTitle}`);
    const analysis = await analyzeContent(extractedTitle, content, undefined, id);

    // Progressive save: analysis is now visible to user
    debugLog(`[${id}] Saving analysis (progressive step 2)...`);
    await saveSourceAnalysis(id, analysis);

    // Step 3: Find connections (isolated — failure here never marks source as failed)
    await findAndSaveConnections(id, extractedTitle, analysis);

    debugLog(`[${id}] File processing complete`);
  } catch (error) {
    console.error(`[${id}] File processing failed:`, error);
    await failSource(id, error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Step 3 helper: find and save connections, fully isolated.
 * Failures here never propagate — the source already has content + analysis.
 */
async function findAndSaveConnections(
  id: string,
  title: string,
  analysis: { digest: { summary: string; highlights: { text: string }[]; concepts: { term: string; definition: string; status?: "knew" | "learned" }[] } }
): Promise<void> {
  try {
    debugLog(`[${id}] Finding connections...`);
    const { connections, error } = await findConnectionsForSource(id, title, analysis);
    if (error) {
      console.error(`[${id}] Connection error: ${error}`);
      await saveConnectionError(id, error);
    } else {
      debugLog(`[${id}] Found ${connections.length} connections`);
      debugLog(`[${id}] Saving connections (progressive step 3)...`);
      await setSourceConnections(id, connections);
    }
  } catch (error) {
    console.error(`[${id}] Connection step failed:`, error);
    try {
      await saveConnectionError(id, `Connection step failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } catch {
      // Storage-layer stale detection is the final safety net
    }
  }
}

/**
 * Find connections between a new source and existing sources
 * Returns { connections, error } - error is set if connection analysis failed
 */
async function findConnectionsForSource(
  sourceId: string,
  title: string,
  analysis: { digest: { summary: string; highlights: { text: string }[]; concepts: { term: string; definition: string; status?: "knew" | "learned" }[] } }
): Promise<{ connections: Connection[]; error?: string }> {
  try {
    // Load all existing sources with their analysis
    debugLog(`[${sourceId}] Loading existing sources for connections...`);
    // Bounded to the newest candidates — comparing against the whole library
    // makes every capture slower as the library grows
    const existingSources = await listSourcesForConnections(sourceId, undefined, AGENT_CONTEXT_CONFIG.connectionCandidates);
    debugLog(`[${sourceId}] Loaded ${existingSources.length} existing sources`);

    if (existingSources.length === 0) {
      debugLog(`[${sourceId}] No existing sources to compare`);
      return { connections: [] };
    }

    // Phase 1: Find potentially related sources using summaries only
    debugLog(`[${sourceId}] Calling findRelatedSources...`);
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
      debugLog(`[${sourceId}] Smart merging into related sources...`);
      await smartMergeIntoRelatedSources(
        sourceId,
        title,
        analysis.digest.summary,
        connections
      );
    }

    return { connections };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${sourceId}] Failed to find connections:`, errorMsg);
    return { connections: [], error: `Connection analysis failed: ${errorMsg}` };
  }
}

/**
 * Smart merge a new source into related sources' connections
 * Instead of creating simple reverse connections, this asks AI to:
 * 1. Merge into existing connection if same topic
 * 2. Create new connection if different topic
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
      const relatedSource = await loadSource(relatedSourceId);
      if (!relatedSource) {
        debugLog(`[${newSourceId}] Could not load related source ${relatedSourceId} for merge`);
        continue;
      }

      const existingConnections = relatedSource.analysis?.connections || [];

      // Ask AI to merge the new source into existing connections
      debugLog(`[${newSourceId}] Merging into ${relatedSourceId}'s connections...`);
      const mergedConnections = await mergeSourceIntoConnections(
        existingConnections,
        { id: newSourceId, title: newSourceTitle, summary: newSourceSummary },
        relatedSource.meta.title
      );

      // Save the merged connections
      await setSourceConnections(relatedSourceId, mergedConnections);
      debugLog(`[${newSourceId}] Merged into ${relatedSourceId} (${existingConnections.length} → ${mergedConnections.length} connections)`);
    } catch (error) {
      console.error(`[${newSourceId}] Failed to merge into ${relatedSourceId}:`, error);
      // Continue with other sources even if one fails
    }
  }
}
