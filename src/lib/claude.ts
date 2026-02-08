import { spawn } from "child_process";
import { Analysis, Highlight, Connection, Concept, FeedItem } from "./types";
import { BraveSearchResult } from "./search";
import { FEED_CONFIG } from "./config";
import path from "path";
import { getLibraryPath } from "./storage";
import {
  promptGenerateTitle,
  promptGenerateBriefing,
  promptExtractInterests,
  promptExtractContent,
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
  const prompt = `Reformat this text into clean Markdown. Add headings (H2 and below), lists, and paragraph breaks to improve readability. Preserve all original content.

IMPORTANT: Do NOT add a main title (H1). The title is stored separately. Start directly with the content.
IMPORTANT: Output raw Markdown directly. Do NOT wrap in a code fence (\`\`\`markdown).

${text.slice(0, 30000)}`;

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

  const prompt = `Read the file at ${filePath} and extract its content.

${isPDF ? "This is a PDF document." : "This is an image file (likely a screenshot, document scan, or note)."}

Your job is to:
1. Extract ALL text content from the file
2. Format it as clean Markdown, preserving the structure (headings, lists, paragraphs, tables, etc.)
3. Generate a concise title (5-10 words) that captures the main topic

Format your response EXACTLY as:
TITLE: [your title here]

CONTENT:
[extracted text formatted as Markdown - preserve structure, use ## for headings, - for lists, etc.]

Rules:
- Extract ALL text, don't summarize or paraphrase
- Preserve the original structure as much as possible
- If there are multiple sections or pages, use Markdown headings to organize
- If there are bullet points or numbered lists, preserve them
- If there are tables, format them as Markdown tables
- ${isPDF ? "For multi-page PDFs, process all pages" : "If the image text is hard to read, do your best to interpret it"}
- If the file doesn't contain meaningful text, describe what you see instead`;

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
  const prompt = `Analyze the following content and help the reader decide how to allocate their attention.

Title: ${title}
${sourceUrl ? `Source: ${sourceUrl}` : ""}

Content:
${content.slice(0, 20000)}${content.length > 20000 ? "\n\n[Content truncated...]" : ""}

## Your Task

Give a single **recommendation score (0-100)** that answers: "How much attention is this worth?"

Think objectively: **Would many people find this valuable?**

Consider:
- **Information density**: Signal vs noise ratio. How much can you learn per paragraph?
- **Originality**: Is this genuine content (from experience, expertise, or research), or AI-generated fluff / rehashed content that adds nothing new?
- **Quality of content**: Well-explained? Clear? Teaches something effectively?

Content can be valuable in different ways:
- **Educational**: Explains concepts, teaches skills, shares knowledge
- **Insightful**: Offers deep analysis, unique perspectives, or non-obvious observations
- **Informational**: Provides useful facts, data, or reference material

**IMPORTANT - Do NOT penalize for:**
- Brevity or concise format (dense content is GOOD, not bad)
- Lack of detailed argumentation (ideas can be valuable without lengthy justification)
- Informal style or personal notes format
- Missing citations or data (judge the ideas themselves)

**Scoring Guide** (action MUST match score range):
- 80-100 → action: "must_read" — Must read. Every sentence counts.
- 60-79 → action: "worth_reading" — Worth reading. Read key sections.
- 40-59 → action: "skim" — Mixed value. Quick scan only.
- 20-39 → action: "summary_only" — Low value. Just read the summary.
- 0-19 → action: "skip" — Not worth your time.

Provide your analysis as a JSON object:
{
  "triage": {
    "score": <0-100>,
    "reason": "<one sentence: why this score?>",
    "action": "<must_read|worth_reading|skim|summary_only|skip>",
    "readTimeMinutes": <estimated minutes to read and understand>,
    "density": <0-100, information per unit text>,
    "originality": <0-100, genuine thinking vs rehashed/AI content>
  },
  "digest": {
    "summary": "<2-3 sentences>",
    "highlights": [
      {"id": "h1", "text": "<key point or takeaway>", "type": "<insight|fact|actionable>"}
    ],
    "concepts": [{"id": "c1", "term": "<term>", "definition": "<definition>"}],
    "structure": ["<outline>"]
  },
  "critique": {
    "hiddenAssumptions": ["<items>"],
    "potentialIssues": ["<items>"],
    "needsVerification": ["<items>"],
    "biasIndicators": ["<items>"]
  }
}

**Highlight Types**:
- insight: Core idea, observation, or argument (whether fact or opinion)
- fact: Specific verifiable claim or data point
- actionable: Practical advice or recommendation to act on

Respond with ONLY the JSON object.`;

  const responseText = await callClaude(prompt);

  const analysisData = parseJsonResponse(responseText, "analyzeContent");
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

  const prompt = `You are analyzing a knowledge library to find connections between articles.

## New Source Summary
${newSourceSummary}

## Existing Sources in Library
${sourcesContext}

## Task
Identify which existing sources might have meaningful connections with the new source. Look for:
1. **Topic overlap** - Similar subjects, concepts, or domains
2. **Potential contradictions** - Opposing viewpoints or conflicting claims
3. **Conceptual extensions** - The new source builds on ideas from existing sources
4. **Supporting/related evidence** - Sources that support or relate to each other

Return a JSON array of source IDs that have potential connections, ordered by relevance.
Maximum 5 sources. If no relevant connections exist, return an empty array.

Respond with ONLY the JSON array, no explanation.
Example: ["abc123", "def456"]`;

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

  const prompt = `You are analyzing connections between a new article and existing sources in a knowledge library.

## New Source: ${newSource.title}
${newSourceContext}

## Related Sources
${relatedContext}
${learnedContext}

## Task
Identify specific, meaningful connections between the new source and the related sources.

## Connection Types
1. **redundant** - The new source covers similar ground as an existing source. User can skip one.
2. **contradicts** - The new source contradicts or presents opposing viewpoints to an existing source. User should read critically.
3. **related** - The sources share concepts, build on each other, or discuss related topics. Worth reading together.

## Rules
- Be specific about what conflicts, overlaps, or relates
- Reference specific claims, highlights, or concepts
- Keep summaries concise (one sentence)
- IMPORTANT: In the summary field, always refer to sources by their TITLE, not their ID. For example, write "Overlaps with 'Article Title'" instead of "Overlaps with ID abc123"
- Provide enough detail for user to understand without reading both sources
- Only report meaningful connections, not superficial topic overlaps
- A single connection can reference multiple related sources if they all relate to the same point

Return a JSON array of connections:
{
  "connections": [
    {
      "id": "conn1",
      "type": "redundant|contradicts|related",
      "summary": "One-line description of the connection",
      "details": "2-3 sentences explaining the connection with specific references",
      "relatedSourceIds": ["id1", "id2"]
    }
  ]
}

If no meaningful connections exist, return: { "connections": [] }

Respond with ONLY the JSON object.`;

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

  const prompt = `You are helping organize connections between knowledge sources.

## Target Source: "${targetSourceTitle}"

## Existing Connections:
${connectionsContext}

## New Source to Merge:
- ID: ${newSource.id}
- Title: "${newSource.title}"
- Summary: ${newSource.summary}

## Task
Decide how to integrate the new source into the target's connections:
1. **Merge**: If the new source discusses the same topic as an existing connection, add it to that connection's relatedSourceIds
2. **Create new**: If the new source discusses a different topic, create a new connection

## Rules
- Only merge if the topics are semantically the same (not just vaguely related)
- Keep connection summaries general enough to cover all related sources
- If merging, you may update the summary to better reflect all sources

Return the complete updated connections array as JSON:
{
  "connections": [
    {
      "id": "existing-or-new-id",
      "type": "redundant|contradicts|related",
      "summary": "Updated or new summary",
      "details": "Updated or new details",
      "relatedSourceIds": ["id1", "id2", "newSourceId"]
    }
  ]
}

Respond with ONLY the JSON object.`;

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
  preferredSources: string[] = []
): Promise<FeedItem[]> {
  if (searchResults.length === 0) return [];

  const escapeForJson = (s: string) => s.replace(/"/g, "'").replace(/\n/g, " ");
  const libraryContext = userSources.length > 0
    ? userSources.slice(0, 15).map((s) => `- "${escapeForJson(s.title?.slice(0, 60) ?? "")}" (${s.concepts.slice(0, 3).join(", ")})`).join("\n")
    : "Empty library";

  const { promptFilterFeed } = await import("./prompts");

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

      const prompt = promptFilterFeed(libraryContext, resultsContext, FEED_CONFIG.maxFeedItems, preferredSources);
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
  userSources: { title: string; concepts: string[] }[]
): Promise<string> {
  // Only use recommended items for briefing
  const recommendedItems = feedItems.filter(item => item.scoring.action === "recommend");
  if (recommendedItems.length === 0) {
    return "";
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

  const prompt = promptGenerateBriefing(libraryContext, feedContext);

  try {
    const briefing = await callClaude(prompt);
    return briefing.trim();
  } catch (err) {
    console.error("[generateBriefing] Failed:", err);
    return "";
  }
}
