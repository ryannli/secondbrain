import { spawn } from "child_process";
import { promises as fs } from "fs";
import { Analysis, Highlight, Connection, Concept, FeedItem, InsightItem, StructuredBriefing, BriefingNewsItem, BriefingGoDeeper } from "./types";
import { BraveSearchResult } from "./search";
import { FEED_CONFIG } from "./config";
import path from "path";
import { getLibraryPath, getCurrentRootPath, loadProfileDoc, listSourcesForConnections, SourceForConnections, findEntryPath } from "./storage";
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
  promptExtractTopics,
} from "./prompts";

/**
 * Call Claude via CLI in print mode (async, non-blocking)
 */
// Cache user profile docs for the lifetime of the process to avoid
// reading from disk on every single Claude call.
let _profileCache: { userProfile: string; memoryProfile: string } | null = null;

async function loadUserProfiles(): Promise<{ userProfile: string; memoryProfile: string }> {
  if (!_profileCache) {
    const [userProfile, memoryProfile] = await Promise.all([
      loadProfileDoc("USER").catch(() => ""),
      loadProfileDoc("MEMORY").catch(() => ""),
    ]);
    _profileCache = { userProfile, memoryProfile };
  }
  return _profileCache;
}

// Call this when user edits their profile docs to invalidate the cache
export function invalidateProfileCache(): void {
  _profileCache = null;
}

const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function callClaude(prompt: string, debugLabel?: string): Promise<string> {
  // Prepend user profile context so all Claude calls respect user preferences
  const { userProfile, memoryProfile } = await loadUserProfiles();
  const profileParts: string[] = [];
  if (userProfile) profileParts.push(`<user-preferences file="USER.md">\n${userProfile}\n</user-preferences>`);
  if (memoryProfile) profileParts.push(`<user-memory file="MEMORY.md">\n${memoryProfile}\n</user-memory>`);
  const fullPrompt = profileParts.length > 0
    ? `You MUST follow the instructions in <user-preferences>.\n\n${profileParts.join("\n\n")}\n\n${prompt}`
    : prompt;

  const promptPreview = prompt.slice(0, 80).replace(/\n/g, " ");
  console.log(`[callClaude] Starting: "${promptPreview}..."`);
  console.log(`[callClaude] User profile: ${userProfile ? `${userProfile.length} chars` : "none"}, Memory: ${memoryProfile ? `${memoryProfile.length} chars` : "none"}`);
  const startTime = Date.now();

  // Debug: write full prompt and response to file
  const debugDir = path.join(getCurrentRootPath(), ".debug");
  const randomId = Math.random().toString(36).slice(2, 8);
  const debugFile = path.join(debugDir, `claude-${debugLabel ?? "unknown"}-${randomId}.txt`);
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(debugFile, `=== PROMPT ===\n${fullPrompt}\n`, "utf-8");
  console.log(`[callClaude] Debug log: ${debugFile}`);

  return new Promise((resolve, reject) => {
    const proc = spawn("claude", ["--print", "--tools", "", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: getCurrentRootPath(),
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      reject(new Error(`Claude timed out after ${elapsed}s: "${promptPreview}..."`));
    }, CLAUDE_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (killed) return; // already rejected
      if (code === 0) {
        console.log(`[callClaude] Done in ${elapsed}s (${stdout.length} chars)`);
        fs.appendFile(debugFile, `\n=== RESPONSE ===\n${stdout}\n`).catch(() => {});
        resolve(stdout.trim());
      } else {
        console.error(`[callClaude] Failed (code ${code}) in ${elapsed}s: ${stderr.slice(0, 200)}`);
        reject(new Error(stderr || `Claude exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin.write(fullPrompt);
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
    // "Unexpected non-whitespace character after JSON at position N" —
    // Claude output valid JSON followed by extra text. Truncate and retry.
    const posMatch = err.message.match(/after JSON at position (\d+)/);
    if (posMatch) {
      try {
        return JSON.parse(jsonMatch[0].slice(0, parseInt(posMatch[1])));
      } catch { /* fall through */ }
    }
    console.error(`[${context}] JSON parse error:`, err.message);
    return null;
  }
}

/**
 * Generate a concise title for content using AI
 */
export async function generateTitle(content: string, sourceId?: string): Promise<string> {
  const prompt = promptGenerateTitle(content);
  const title = await callClaude(prompt, `${sourceId ?? "unknown"}-generateTitle`);
  return title.replace(/^["']|["']$/g, "").trim() || "Untitled Note";
}

/**
 * Extract readable content from HTML using AI (fallback for JS-rendered pages)
 */
export async function extractReadableContent(html: string, sourceId?: string): Promise<string> {
  // Clean HTML first to reduce token usage
  const cleanedHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ");

  const prompt = promptExtractContent(cleanedHtml.slice(0, 120000));
  return await callClaude(prompt, `${sourceId ?? "unknown"}-extractContent`);
}

/**
 * Format raw text into readable Markdown
 */
export async function formatTextContent(text: string, sourceId?: string): Promise<string> {
  const prompt = promptFormatText(text.slice(0, 30000));
  return await callClaude(prompt, `${sourceId ?? "unknown"}-formatText`);
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
  sourceUrl?: string,
  sourceId?: string
): Promise<Analysis> {
  const truncatedContent = content.slice(0, 20000) + (content.length > 20000 ? "\n\n[Content truncated...]" : "");
  const prompt = promptAnalyzeContent(title, truncatedContent, sourceUrl);

  const responseText = await callClaude(prompt, `${sourceId ?? "unknown"}-analyzeContent`);

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
  const responseText = await callClaude(prompt, "findRelatedSources");
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

  const responseText = await callClaude(prompt, "analyzeConnections");

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

  const responseText = await callClaude(prompt, "mergeConnections");

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
  const responseText = await callClaude(prompt, "extractInterests");

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
  starredHighlights: { text: string; sourceTitle: string; at?: string }[];
  dismissedHighlights: { text: string; sourceTitle: string; at?: string }[];
  learnedConcepts: { term: string; sourceTitle: string; at?: string }[];
  knewConcepts: { term: string; sourceTitle: string; at?: string }[];
}

/**
 * Build interaction context string from user's attention signals
 */
function formatTimeAgo(isoDate?: string): string {
  if (!isoDate) return "";
  const days = Math.round((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return " [today]";
  if (days === 1) return " [yesterday]";
  if (days < 7) return ` [${days}d ago]`;
  if (days < 30) return ` [${Math.round(days / 7)}w ago]`;
  return ` [${Math.round(days / 30)}mo ago]`;
}

export function buildInteractionContext(signals: InteractionSignals): string {
  const { starredHighlights, dismissedHighlights, learnedConcepts, knewConcepts } = signals;
  const hasAny = starredHighlights.length + dismissedHighlights.length + learnedConcepts.length + knewConcepts.length > 0;
  if (!hasAny) return "";

  const parts: string[] = [];

  if (starredHighlights.length > 0) {
    parts.push("## User's Starred Highlights (what they find important)");
    for (const h of starredHighlights.slice(0, 10)) {
      parts.push(`- "${h.text}" (from: ${h.sourceTitle})${formatTimeAgo(h.at)}`);
    }
  }

  if (learnedConcepts.length > 0) {
    parts.push("## User's Learned Concepts (topics they actively study)");
    for (const c of learnedConcepts.slice(0, 10)) {
      parts.push(`- ${c.term} (from: ${c.sourceTitle})${formatTimeAgo(c.at)}`);
    }
  }

  if (dismissedHighlights.length > 0) {
    parts.push("## User's Dismissed Highlights (what they are NOT interested in)");
    for (const h of dismissedHighlights.slice(0, 10)) {
      parts.push(`- "${h.text}" (from: ${h.sourceTitle})${formatTimeAgo(h.at)}`);
    }
  }

  if (knewConcepts.length > 0) {
    parts.push("## User's Already-Known Concepts (skip basics on these)");
    for (const c of knewConcepts.slice(0, 10)) {
      parts.push(`- ${c.term} (from: ${c.sourceTitle})${formatTimeAgo(c.at)}`);
    }
  }

  parts.push("");
  parts.push("NOTE: These signals are noisy — users may star/dismiss casually. Use as soft hints, not hard rules.");
  parts.push("Timestamps like [2d ago] indicate when the user made each interaction.");

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
      const responseText = await callClaude(prompt, "filterFeed");

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
    const responseText = await callClaude(prompt, "generateBriefing");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = parseJsonResponse(responseText, "generateBriefing") as any;
    if (!parsed) {
      console.error("[generateBriefing] Failed to parse JSON:", responseText.slice(0, 500));
      return null;
    }

    const news: BriefingNewsItem[] = (parsed.news ?? []).map((item: Record<string, unknown>) => ({
      text: (item.text as string) ?? "",
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
  userSources: { title: string; summary?: string; concepts: string[] }[],
  interests: string[] = []
): Promise<InsightItem[]> {
  const interactionContext = buildInteractionContext(interactionSignals);
  if (!interactionContext) return [];

  const libraryContext = userSources.length > 0
    ? userSources.slice(0, 15).map(s => {
        const concepts = s.concepts.slice(0, 3).join(", ");
        const summary = s.summary ? ` — ${s.summary}` : "";
        return `- "${s.title}" (${concepts})${summary}`;
      }).join("\n")
    : "Empty library";

  const prompt = promptGenerateInsights(interactionContext, libraryContext, interests);

  try {
    const responseText = await callClaude(prompt, "generateInsights");

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[generateInsights] No JSON array found");
      return [];
    }

    const items = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(items)) return [];

    return items
      .filter((item: { text?: string }) => item.text)
      .slice(0, 4)
      .map((item: { text: string }) => ({
        text: item.text,
      }));
  } catch (err) {
    console.error("[generateInsights] Failed:", err);
    return [];
  }
}

// Stream graph color palette (distinct, medium-saturation)
const STREAM_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#f97316", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#84cc16",
];

export interface InterestStreamData {
  topics: string[];
  colors: string[];
  weeks: string[];
  data: number[][];  // weeks × topics matrix
  sourceTopics?: { id: string; topics: string[] }[];  // source → topic assignments
}

/**
 * Extract topic stream data from library sources for the Brain Waves visualization.
 * Groups sources by week × topic to produce streamgraph data.
 */
export async function extractTopicStream(): Promise<InterestStreamData> {
  const sources = await listSourcesForConnections();
  if (sources.length < 3) {
    return { topics: [], colors: [], weeks: [], data: [] };
  }

  // Build context for Claude
  const sourcesContext = sources.map((s, i) => {
    const concepts = s.concepts.map(c => c.term).join(", ");
    return `${i + 1}. ID: ${s.id} | Title: "${s.title}" | Summary: ${s.summary.slice(0, 120)} | Concepts: ${concepts || "none"}`;
  }).join("\n");

  const prompt = promptExtractTopics(sourcesContext);
  const responseText = await callClaude(prompt, "extractTopics");

  // Parse response
  const parsed = parseJsonResponse(responseText, "extractTopicStream");
  if (!parsed || !Array.isArray(parsed.topics) || !Array.isArray(parsed.sources)) {
    console.error("[extractTopicStream] Invalid response");
    return { topics: [], colors: [], weeks: [], data: [] };
  }

  const topics: string[] = parsed.topics as string[];
  const sourceTopics = parsed.sources as { id: string; topics: string[] }[];

  // Build a map: sourceId → topics
  const sourceTopicMap = new Map<string, string[]>();
  for (const st of sourceTopics) {
    sourceTopicMap.set(st.id, st.topics);
  }

  // Load created_at dates from meta.json for each source
  const libraryPath = getLibraryPath();
  const sourceDates = new Map<string, string>();
  for (const s of sources) {
    try {
      let metaPath = path.join(libraryPath, s.id, "meta.json");
      try {
        await fs.access(metaPath);
      } catch {
        const entryPath = await findEntryPath(s.id, libraryPath);
        if (entryPath) metaPath = path.join(entryPath, "meta.json");
      }
      const raw = await fs.readFile(metaPath, "utf-8");
      const meta = JSON.parse(raw);
      if (meta.created_at) sourceDates.set(s.id, meta.created_at);
    } catch {
      // Skip sources without readable meta
    }
  }

  // Determine time span from ALL events (additions + attention interactions)
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const allTimestamps: number[] = [];
  for (const [, dateStr] of sourceDates) {
    allTimestamps.push(new Date(dateStr).getTime());
  }
  for (const s of sources) {
    for (const h of s.highlights) {
      if (h.reactionAt && h.reaction === "star") allTimestamps.push(new Date(h.reactionAt).getTime());
    }
    for (const c of s.concepts) {
      if (c.statusAt && c.status === "learned") allTimestamps.push(new Date(c.statusAt).getTime());
    }
  }

  let earliest = now.getTime();
  for (const t of allTimestamps) {
    if (t < earliest) earliest = t;
  }

  const spanDays = Math.max(1, Math.ceil((now.getTime() - earliest) / dayMs));

  // Pick granularity based on usage span
  let bucketMs: number;
  let maxBuckets: number;
  let granularity: "day" | "week" | "month";

  if (spanDays <= 14) {
    // Under 2 weeks → daily buckets
    granularity = "day";
    bucketMs = dayMs;
    maxBuckets = 14;
  } else if (spanDays <= 90) {
    // 2 weeks to 3 months → weekly buckets
    granularity = "week";
    bucketMs = 7 * dayMs;
    maxBuckets = 13;
  } else {
    // Over 3 months → monthly buckets (~30 day)
    granularity = "month";
    bucketMs = 30 * dayMs;
    maxBuckets = 12;
  }

  const totalBuckets = Math.max(1, Math.ceil((now.getTime() - earliest) / bucketMs));
  const numBuckets = Math.min(totalBuckets, maxBuckets);
  const startTime = now.getTime() - numBuckets * bucketMs;

  // Build labels based on granularity
  const weeks: string[] = [];
  for (let b = 0; b < numBuckets; b++) {
    const bucketStart = new Date(startTime + b * bucketMs);
    if (b === numBuckets - 1) {
      weeks.push("Now");
    } else if (granularity === "day") {
      // Show day labels: "Mon 3", but skip some to avoid crowding
      if (b === 0 || bucketStart.getDay() === 1 /* Monday */) {
        weeks.push(bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
      } else {
        weeks.push("");
      }
    } else if (granularity === "week") {
      // Show month name at start of each month
      if (b === 0 || bucketStart.getDate() <= 7) {
        weeks.push(bucketStart.toLocaleDateString(undefined, { month: "short" }));
      } else {
        weeks.push("");
      }
    } else {
      // Monthly: always show month name
      weeks.push(bucketStart.toLocaleDateString(undefined, { month: "short" }));
    }
  }

  // Collect weighted attention events
  // Weight reflects how strong an attention signal each interaction is
  const timedEvents: { sourceId: string; timestamp: number; weight: number }[] = [];

  // Source added — baseline interest (+1)
  for (const [sourceId, dateStr] of sourceDates) {
    timedEvents.push({ sourceId, timestamp: new Date(dateStr).getTime(), weight: 1 });
  }

  // User interactions — attention signals from source highlights & concepts
  for (const s of sources) {
    for (const h of s.highlights) {
      if (h.reactionAt && h.reaction === "star") {
        // Starred highlight = strong attention signal (+2)
        timedEvents.push({ sourceId: s.id, timestamp: new Date(h.reactionAt).getTime(), weight: 2 });
      }
      // Dismiss = not interested, skip (weight 0)
    }
    for (const c of s.concepts) {
      if (c.statusAt && c.status === "learned") {
        // Learned new concept = deep engagement (+2)
        timedEvents.push({ sourceId: s.id, timestamp: new Date(c.statusAt).getTime(), weight: 2 });
      }
      // Knew = already known, no current attention signal
    }
  }

  // Note: Starred briefing items are omitted — they don't map to specific source topics.

  // Build data matrix: buckets × topics
  const data: number[][] = Array.from({ length: numBuckets }, () =>
    Array(topics.length).fill(0)
  );

  for (const { sourceId, timestamp, weight } of timedEvents) {
    if (timestamp < startTime) continue;
    const bucketIndex = Math.min(
      numBuckets - 1,
      Math.floor((timestamp - startTime) / bucketMs)
    );
    const sourceTopicList = sourceTopicMap.get(sourceId) ?? [];
    for (const topic of sourceTopicList) {
      const topicIndex = topics.indexOf(topic);
      if (topicIndex >= 0) {
        data[bucketIndex][topicIndex] += weight;
      }
    }
  }

  const colors = topics.map((_, i) => STREAM_COLORS[i % STREAM_COLORS.length]);

  return { topics, colors, weeks, data, sourceTopics };
}
