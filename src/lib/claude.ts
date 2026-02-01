import { spawn } from "child_process";
import { Analysis, Highlight, Connection, Concept } from "./types";
import path from "path";

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
 * Generate a concise title for content using AI
 */
export async function generateTitle(content: string): Promise<string> {
  const prompt = `Generate a concise, descriptive title (5-10 words) for this content.

Rules:
1. Capture the main topic or insight
2. If the author is a well-known person (tech leader, researcher, entrepreneur, public figure, etc.), include their name
   - Format: "Author Name: Topic" or "Author Name on Topic"
   - Examples: "Andrej Karpathy on LLM Training Workflows", "Paul Graham: How to Start a Startup"
3. If the author is not famous or cannot be identified, just describe the content without attribution

Respond with ONLY the title, no quotes or explanation.

Content:
${content.slice(0, 3000)}`;

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
    .replace(/<!--[\s\S]*?-->/g, "");

  const prompt = `Extract the main article content from this HTML. Ignore navigation, ads, sidebars. Format as clean Markdown with headings, lists, links preserved.

IMPORTANT: Do NOT include the article's main title (H1). The title is stored separately. Start from the first section or paragraph after the title.

Output only the content.

${cleanedHtml.slice(0, 50000)}`;

  return await callClaude(prompt);
}

/**
 * Format raw text into readable Markdown
 */
export async function formatTextContent(text: string): Promise<string> {
  const prompt = `Reformat this text into clean Markdown. Add headings (H2 and below), lists, and paragraph breaks to improve readability. Preserve all original content.

IMPORTANT: Do NOT add a main title (H1). The title is stored separately. Start directly with the content.

Output only the formatted Markdown.

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
  const filePath = path.join(process.cwd(), "user_data", "library", sourceId, originalFileName);
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

  let analysisData;
  try {
    // Strip markdown code block if present
    let jsonText = responseText;
    const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    analysisData = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("Failed to parse:", responseText.slice(0, 500));
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
      "relatedSourceIds": ["id1", "id2"],
      "relatedSourceTitles": ["Title 1", "Title 2"],
      "conceptTerms": ["term1", "term2"]  // Optional: key concepts involved
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
      relatedSourceTitles: c.relatedSourceTitles ?? [],
      conceptTerms: c.conceptTerms,
    }));
  } catch {
    console.error("Failed to parse connections:", responseText.slice(0, 200));
    return [];
  }
}
