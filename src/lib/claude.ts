import { spawn } from "child_process";
import { Analysis, Highlight, Connection, Concept, FeedItem, InsightItem, StructuredBriefing, BriefingNewsItem, BriefingGoDeeper } from "./types";
import { BraveSearchResult } from "./search";
import { FEED_CONFIG } from "./config";
import path from "path";
import { getLibraryPath } from "./storage";
import {
  promptGenerateTitle,
  promptGenerateBriefing,
  promptGenerateInsights,
  promptExtractInterests,
  promptExtractContent,
  promptFormatText,
  promptAnalyzeFile,
  promptAnalyzeContent,
  promptFindRelatedSources,
  promptAnalyzeConnections,
  promptMergeConnections,
  promptFilterFeed,
} from "./prompts";

/**
 * Call Claude via CLI in print mode (async, non-blocking)
 */
async function callClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["--print", "--tools", "", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * Parse JSON from Claude response
 * Strips markdown code blocks if present
 */
function parseJsonResponse(response: string, context: string): Record<string, unknown> | null {
  // Strip markdown code block if present
  let jsonText = response;
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  }

  // Find JSON object
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`[${context}] No JSON found in response`);
    return null;
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    const err = e as Error;
    console.error(`[${context}] JSON parse error:`, err.message);
    // Log the problematic part of the JSON (around the error position)
    const posMatch = err.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const start = Math.max(0, pos - 100);
      const end = Math.min(jsonMatch[0].length, pos + 100);
      console.error(`[${context}] JSON context around error:`, jsonMatch[0].slice(start, end));
    }
    return null;
  }
}

/**
 * Generate a concise title for content using AI
 */
export async function generateTitle(content: string): Promise<string> {
  const prompt = promptGenerateTitle(content);
  const title = await callClaude(prompt);
  return title.replace(/^["']|["']$/g, "").trim() || "Untitled Note";
}

/**
 * Extract readable content from HTML using AI (fallback for JS-rendered pages)
 */
export async function extractReadableContent(html: string): Promise<string> {
  // Clean HTML first to reduce token usage
  const cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ");

  const prompt = promptExtractContent(cleanedHtml.slice(0, 120000));
  return await callClaude(prompt);
}

/**
 * Format raw text into readable Markdown
 */
export async function formatTextContent(text: string): Promise<string> {
  const prompt = promptFormatText(text.slice(0, 30000));
  return await callClaude(prompt);
}

/**
 * Analyze a file (image or PDF) using Claude's Read tool
 * - Images: Uses vision capabilities to extract text (OCR) and understand content
 * - PDFs: Extracts text directly (for text PDFs) or uses vision (for scanned PDFs)
 *
 * @param sourceId - The source ID (used to locate the file in library)
 * @param originalFileName - The filename in the source directory (e.g. "original.png", "original.pdf")
 */
export async function analyzeFile(
  sourceId: string,
  originalFileName: string
): Promise<{ title: string; content: string }> {
  // File is saved at: user_data/library/{sourceId}/{originalFileName}
  const filePath = path.join(getLibraryPath(), sourceId, originalFileName);
  const ext = originalFileName.split(".").pop()?.toLowerCase() || "";
  const isPDF = ext === "pdf";

  const prompt = promptAnalyzeFile(filePath, isPDF);

  // Call Claude with Read tool to analyze the file
  const result = await callClaudeWithReadTool(prompt);

  // Parse the response
  const titleMatch = result.match(/TITLE:\s*(.+?)(?:\n|$)/i);
  const contentMatch = result.match(/CONTENT:\s*([\s\S]+)/i);

  const title = titleMatch?.[1]?.trim() || originalFileName.replace(/\.[^.]+$/, "");
  const content = contentMatch?.[1]?.trim() || result;

  return { title, content };
}

/**
 * Call Claude CLI with Read tool enabled (for reading local files including images)
 */
async function callClaudeWithReadTool(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use Read tool with permission-mode dontAsk to auto-accept file reads
    const proc = spawn("claude", [
      "--print",
      "--tools", "Read",
      "--output-format", "text",
      "--permission-mode", "dontAsk"
    ], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export async function analyzeContent(
  title: string,
  content: string,
  sourceUrl?: string
): Promise<Analysis> {
  const truncatedContent = content.slice(0, 20000) + (content.length > 20000 ? "\n\n[Content truncated...]" : "");
  const prompt = promptAnalyzeContent(title, truncatedContent, sourceUrl);

  const responseText = await callClaude(prompt);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisData = parseJsonResponse(responseText, "analyzeContent") as any;
  if (!analysisData) {
    console.error("[analyzeContent] Failed to parse:", responseText.slice(0, 500));
    throw new Error("Failed to parse analysis response");
  }

  return {
    triage: {
      score: analysisData.triage?.score ?? 50,
      reason: analysisData.triage?.reason ?? "Unable to assess",
      action: analysisData.triage?.action ?? "skim",
      readTimeMinutes: analysisData.triage?.readTimeMinutes ?? 5,
      density: analysisData.triage?.density ?? 50,
      originality: analysisData.triage?.originality ?? 50,
    },
    digest: {
      summary: analysisData.digest?.summary ?? "",
      highlights: (analysisData.digest?.highlights ?? []).map((h: Partial<Highlight>, i: number) => ({
        id: h.id ?? `h${i + 1}`,
        text: h.text ?? "",
        type: h.type ?? "insight",
      })),
      concepts: (analysisData.digest?.concepts ?? []).map((c: { id?: string; term?: string; definition?: string }, i: number) => ({
        id: c.id ?? `c${i + 1}`,
        term: c.term ?? "",
        definition: c.definition ?? "",
      })),
      structure: analysisData.digest?.structure ?? [],
    },
    critique: {
      hiddenAssumptions: analysisData.critique?.hiddenAssumptions ?? [],
      potentialIssues: analysisData.critique?.potentialIssues ?? [],
      needsVerification: analysisData.critique?.needsVerification ?? [],
      biasIndicators: analysisData.critique?.biasIndicators ?? [],
    },
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Source summary for connection finding (minimal data for coarse filter)
 */
interface SourceSummaryForConnections {
  id: string;
  title: string;
  summary: string;
}

/**
 * Full source analysis for detailed connection analysis
 */
interface SourceAnalysisForConnections {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
  concepts: { term: string; definition: string }[];
}

/**
 * Find sources that are potentially related to the new source (Phase 1: Coarse filter)
 */
export async function findRelatedSources(
  newSourceSummary: string,
  existingSources: SourceSummaryForConnections[]
): Promise<string[]> {
  if (existingSources.length === 0) return [];

  const sourcesContext = existingSources
    .map((s) => `- ID: ${s.id}\n  Title: ${s.title}\n  Summary: ${s.summary}`)
    .join("\n\n");

  const prompt = promptFindRelatedSources(newSourceSummary, sourcesContext);

  console.log("[findRelatedSources] Calling Claude...");
  const responseText = await callClaude(prompt);
  console.log("[findRelatedSources] Claude response:", responseText.slice(0, 300));

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[findRelatedSources] No JSON array found in response");
      return [];
    }
    const ids = JSON.parse(jsonMatch[0]);
    console.log("[findRelatedSources] Parsed IDs:", ids);
    return Array.isArray(ids) ? ids.filter((id: unknown) => typeof id === "string").slice(0, 5) : [];
  } catch (err) {
    console.error("[findRelatedSources] Failed to parse:", responseText.slice(0, 200), err);
    return [];
  }
}

/**
 * Analyze specific connections between new source and related sources (Phase 2: Detailed analysis)
 */
export async function analyzeConnections(
  newSource: SourceAnalysisForConnections,
  relatedSources: SourceAnalysisForConnections[],
  learnedConcepts: { term: string; sourceId: string; sourceTitle: string }[]
): Promise<Connection[]> {
  if (relatedSources.length === 0) return [];

  const relatedContext = relatedSources
    .map((s) => {
      const highlights = s.highlights.map((h) => `  - ${h}`).join("\n");
      const concepts = s.concepts.map((c) => `  - ${c.term}: ${c.definition}`).join("\n");
      return `### ${s.title} (ID: ${s.id})
Summary: ${s.summary}
Highlights:
${highlights}
Concepts:
${concepts}`;
    })
    .join("\n\n");

  const learnedContext = learnedConcepts.length > 0
    ? `\n## Your Previously Learned Concepts\n${learnedConcepts.map((c) => `- "${c.term}" (from: ${c.sourceTitle})`).join("\n")}`
    : "";

  const newSourceContext = `
Summary: ${newSource.summary}
Highlights:
${newSource.highlights.map((h) => `  - ${h}`).join("\n")}
Concepts:
${newSource.concepts.map((c) => `  - ${c.term}: ${c.definition}`).join("\n")}`;

  const prompt = promptAnalyzeConnections(newSource.title, newSourceContext, relatedContext, learnedContext);

  const responseText = await callClaude(prompt);

  try {
    let jsonText = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const result = JSON.parse(jsonMatch[0]);
    const connections = result.connections ?? [];

    return connections.map((c: Partial<Connection>, i: number) => ({
      id: c.id ?? `conn${i + 1}`,
      type: c.type ?? "redundant",
      summary: c.summary ?? "",
      details: c.details ?? "",
      relatedSourceIds: c.relatedSourceIds ?? [],
    }));
  } catch {
    console.error("Failed to parse connections:", responseText.slice(0, 200));
    return [];
  }
}

/**
 * Merge a new source into an existing source's connections
 * Either adds to an existing connection (if semantically similar) or creates a new one
 */
export async function mergeSourceIntoConnections(
  existingConnections: Connection[],
  newSource: { id: string; title: string; summary: string },
  targetSourceTitle: string
): Promise<Connection[]> {
  // If no existing connections, create a new one
  if (existingConnections.length === 0) {
    return [{
      id: `conn-${newSource.id}`,
      type: "related",
      summary: `Related to "${newSource.title}"`,
      details: newSource.summary,
      relatedSourceIds: [newSource.id],
    }];
  }

  const connectionsContext = existingConnections
    .map((c, i) => `${i + 1}. [${c.type}] "${c.summary}" - Sources: ${c.relatedSourceIds.join(", ")}`)
    .join("\n");

  const prompt = promptMergeConnections(targetSourceTitle, connectionsContext, newSource.id, newSource.title, newSource.summary);

  const responseText = await callClaude(prompt);

  try {
    let jsonText = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Failed to parse merge response, keeping existing + new");
      // Fallback: just add a new connection
      return [...existingConnections, {
        id: `conn-${newSource.id}`,
        type: "related" as const,
        summary: `Related to "${newSource.title}"`,
        details: newSource.summary,
        relatedSourceIds: [newSource.id],
      }];
    }

    const result = JSON.parse(jsonMatch[0]);
    const connections = result.connections ?? [];

    return connections.map((c: Partial<Connection>, i: number) => ({
      id: c.id ?? `conn${i + 1}`,
      type: c.type ?? "related",
      summary: c.summary ?? "",
      details: c.details ?? "",
      relatedSourceIds: c.relatedSourceIds ?? [],
    }));
  } catch {
    console.error("Failed to parse merge connections:", responseText.slice(0, 200));
    // Fallback: just add a new connection
    return [...existingConnections, {
      id: `conn-${newSource.id}`,
      type: "related" as const,
      summary: `Related to "${newSource.title}"`,
      details: newSource.summary,
      relatedSourceIds: [newSource.id],
    }];
  }
}

/**
 * Source data for interest extraction
 */
interface SourceForInterests {
  title: string;
  concepts: { term: string; definition: string }[];
  highlights: string[];
}

/**
 * Extract user interests from their library for feed generation
 * Returns 3-5 search-friendly topic strings
 */
export async function extractUserInterests(
  sources: SourceForInterests[]
): Promise<string[]> {
  if (sources.length === 0) return [];

  const sourcesContext = sources
    .slice(0, 20) // Limit to recent 20 sources
    .map((s, i) => {
      const concepts = s.concepts.map((c) => c.term).join(", ");
      const highlights = s.highlights.slice(0, 3).join("; ");
      return `${i + 1}. "${s.title}"
   Concepts: ${concepts || "none"}
   Key points: ${highlights || "none"}`;
    })
    .join("\n\n");

  const prompt = promptExtractInterests(sourcesContext, sources.length, FEED_CONFIG.maxInterests);
  const responseText = await callClaude(prompt);

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[extractUserInterests] No JSON array found");
      return [];
    }
    const interests = JSON.parse(jsonMatch[0]);
    return Array.isArray(interests)
      ? interests.filter((i: unknown) => typeof i === "string").slice(0, FEED_CONFIG.maxInterests)
      : [];
  } catch (err) {
    console.error("[extractUserInterests] Failed to parse:", responseText.slice(0, 200), err);
    return [];
  }
}

/**
 * Interaction signals extracted from user's library
 */
export interface InteractionSignals {
  starredHighlights: { text: string; sourceTitle: string }[];
  dismissedHighlights: { text: string; sourceTitle: string }[];
  learnedConcepts: { term: string; sourceTitle: string }[];
  knewConcepts: { term: string; sourceTitle: string }[];
}

/**
 * Build interaction context string from user's attention signals
 */
export function buildInteractionContext(signals: InteractionSignals): string {
  const { starredHighlights, dismissedHighlights, learnedConcepts, knewConcepts } = signals;
  const hasAny = starredHighlights.length + dismissedHighlights.length + learnedConcepts.length + knewConcepts.length > 0;
  if (!hasAny) return "";

  const parts: string[] = [];

  if (starredHighlights.length > 0) {
    parts.push("## User's Starred Highlights (what they find important)");
    for (const h of starredHighlights.slice(0, 10)) {
      parts.push(`- "${h.text}" (from: ${h.sourceTitle})`);
    }
  }

  if (learnedConcepts.length > 0) {
    parts.push("## User's Learned Concepts (topics they actively study)");
    for (const c of learnedConcepts.slice(0, 10)) {
      parts.push(`- ${c.term} (from: ${c.sourceTitle})`);
    }
  }

  if (dismissedHighlights.length > 0) {
    parts.push("## User's Dismissed Highlights (what they are NOT interested in)");
    for (const h of dismissedHighlights.slice(0, 10)) {
      parts.push(`- "${h.text}" (from: ${h.sourceTitle})`);
    }
  }

  if (knewConcepts.length > 0) {
    parts.push("## User's Already-Known Concepts (skip basics on these)");
    for (const c of knewConcepts.slice(0, 10)) {
      parts.push(`- ${c.term} (from: ${c.sourceTitle})`);
    }
  }

  parts.push("");
  parts.push("NOTE: These signals are noisy — users may star/dismiss casually. Use as soft hints, not hard rules.");

  return parts.join("\n");
}

/**
 * Source summary for feed filtering
 */
interface SourceSummaryForFeed {
  id: string;
  title: string;
  summary: string;
  concepts: string[];
}

/**
 * Filter and score search results - recommend only what's genuinely worth reading
 * Returns all items (both recommended and filtered) with reasons
 */
export async function filterFeedItems(
  searchResults: BraveSearchResult[],
  userSources: SourceSummaryForFeed[],
  preferredSources: string[] = [],
  interactionContext: string = "",
  interests: string[] = []
): Promise<FeedItem[]> {
  if (searchResults.length === 0) return [];

  const escapeForJson = (s: string) => s.replace(/"/g, "'").replace(/\n/g, " ");
  const libraryContext = userSources.length > 0
    ? userSources.slice(0, 15).map((s) => `- "${escapeForJson(s.title?.slice(0, 60) ?? "")}" (${s.concepts.slice(0, 3).join(", ")})`).join("\n")
    : "Empty library";

  // Split into batches and process in parallel
  const BATCH_SIZE = 30;
  const batches: BraveSearchResult[][] = [];
  for (let i = 0; i < searchResults.length; i += BATCH_SIZE) {
    batches.push(searchResults.slice(i, i + BATCH_SIZE));
  }

  // Process all batches in parallel
  const batchResults = await Promise.all(
    batches.map(async (batch) => {
      const resultsContext = batch
        .map((r, i) => `${i + 1}. "${escapeForJson(r.title?.slice(0, 60) ?? "")}"
   Source: ${r.meta_url?.hostname ?? "unknown"}, Age: ${r.age ?? "recent"}`)
        .join("\n");

      const prompt = promptFilterFeed(libraryContext, resultsContext, FEED_CONFIG.maxFeedItems, preferredSources, interactionContext, interests);
      const responseText = await callClaude(prompt);

      const items: FeedItem[] = [];
      try {
        const result = parseJsonResponse(responseText, "filterFeedItems");
        if (!result) return items;

        const scoredItems = Array.isArray(result.items) ? result.items : [];
        for (const scored of scoredItems) {
          const idx = (scored.index ?? 1) - 1;
          if (idx < 0 || idx >= batch.length) continue;

          const searchResult = batch[idx];
          const overall = scored.score ?? 50;
          // Threshold: score >= 75 = recommend, otherwise skip
          const action = overall >= 75 ? "recommend" : "skip";

          items.push({
            id: generateFeedItemId(searchResult.url),
            title: searchResult.title,
            url: searchResult.url,
            snippet: searchResult.description,
            publishedAt: searchResult.page_age ?? new Date().toISOString(),
            source: searchResult.meta_url?.hostname ?? "unknown",
            thumbnail: searchResult.thumbnail?.src,
            scoring: { overall, action, whyRead: scored.whyRead, whySkip: scored.whySkip, connectsTo: scored.connectsTo },
          });
        }
      } catch (err) {
        console.error("[filterFeedItems] Batch failed:", err);
      }
      return items;
    })
  );

  const allFeedItems = batchResults.flat();

  // Sort: recommended first, then by score
  allFeedItems.sort((a, b) => {
    if (a.scoring.action !== b.scoring.action) {
      return a.scoring.action === "recommend" ? -1 : 1;
    }
    return b.scoring.overall - a.scoring.overall;
  });

  return allFeedItems;
}

/**
 * Generate a stable ID for a feed item from its URL
 */
function generateFeedItemId(url: string): string {
  // Simple hash function for URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `feed-${Math.abs(hash).toString(36)}`;
}

/**
 * Generate a Chief of Staff style briefing for the user
 */
export async function generateBriefing(
  feedItems: FeedItem[],
  userSources: { title: string; concepts: string[] }[],
  interactionContext: string = "",
  interests: string[] = []
): Promise<StructuredBriefing | null> {
  // Only use recommended items for briefing
  const recommendedItems = feedItems.filter(item => item.scoring.action === "recommend");
  if (recommendedItems.length === 0) {
    return null;
  }

  // Use top 20 recommended items (sorted by score)
  const topItems = recommendedItems
    .sort((a, b) => b.scoring.overall - a.scoring.overall)
    .slice(0, 20);

  const feedContext = topItems.map((item, i) =>
    `${i + 1}. "${item.title}" (${item.source}) - ${item.scoring.whyRead || ""}`
  ).join("\n");

  const libraryContext = userSources.length > 0
    ? userSources.slice(0, 10).map(s => `- "${s.title}" (${s.concepts.slice(0, 3).join(", ")})`).join("\n")
    : "Empty library";

  const prompt = promptGenerateBriefing(libraryContext, feedContext, interactionContext, interests);

  try {
    const responseText = await callClaude(prompt);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = parseJsonResponse(responseText, "generateBriefing") as any;
    if (!parsed) {
      console.error("[generateBriefing] Failed to parse JSON:", responseText.slice(0, 500));
      return null;
    }

    const news: BriefingNewsItem[] = (parsed.news ?? []).map((item: Record<string, unknown>) => ({
      headline: (item.headline as string) ?? "",
      detail: (item.detail as string) ?? "",
      connection: item.connection as string | undefined,
      refs: Array.isArray(item.refs) ? item.refs.filter((r: unknown) => typeof r === "number") : [],
    }));

    const goDeeper: BriefingGoDeeper[] = (parsed.goDeeper ?? []).map((item: Record<string, unknown>) => ({
      ref: (item.ref as number) ?? 0,
      reason: (item.reason as string) ?? "",
    }));

    return { news, goDeeper };
  } catch (err) {
    console.error("[generateBriefing] Failed:", err);
    return null;
  }
}

/**
 * Generate insights from user's reading behavior and interaction history
 */
export async function generateInsights(
  interactionSignals: InteractionSignals,
  userSources: { title: string; concepts: string[] }[],
  interests: string[] = []
): Promise<InsightItem[]> {
  const interactionContext = buildInteractionContext(interactionSignals);
  if (!interactionContext) return [];

  const libraryContext = userSources.length > 0
    ? userSources.slice(0, 15).map(s => `- "${s.title}" (${s.concepts.slice(0, 3).join(", ")})`).join("\n")
    : "Empty library";

  const prompt = promptGenerateInsights(interactionContext, libraryContext, interests);

  try {
    const responseText = await callClaude(prompt);

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[generateInsights] No JSON array found");
      return [];
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) return [];

    return items
      .filter((item: { emoji?: string; text?: string }) => item.emoji && item.text)
      .slice(0, 4)
      .map((item: { emoji: string; text: string }) => ({
        emoji: item.emoji,
        text: item.text,
      }));
  } catch (err) {
    console.error("[generateInsights] Failed:", err);
    return [];
  }
}
