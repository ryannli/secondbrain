import { spawn } from "child_process";
import { Analysis, Highlight } from "./types";

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
  const prompt = `Generate a concise, descriptive title (5-10 words) for this content. The title should capture the main topic or insight. Respond with ONLY the title, no quotes or explanation.

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
