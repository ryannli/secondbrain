import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Source, SourceMeta, SourceSummary, Analysis, ACTION_CONFIG, ActionType } from "./types";

/**
 * Get library path from environment or use default
 * Configure via SECONDBRAIN_LIBRARY env var
 */
function getLibraryPath(): string {
  return process.env.SECONDBRAIN_LIBRARY || path.join(process.cwd(), "library");
}

export async function ensureLibraryExists(libraryPath = getLibraryPath()): Promise<void> {
  await fs.mkdir(libraryPath, { recursive: true });
}

export async function saveSource(
  meta: Omit<SourceMeta, "id" | "createdAt">,
  originalContent: string,
  content: string,
  analysis: Analysis,
  libraryPath = getLibraryPath()
): Promise<Source> {
  const id = uuidv4().slice(0, 8);
  const createdAt = new Date().toISOString();

  const sourceMeta: SourceMeta = {
    ...meta,
    id,
    createdAt,
  };

  const sourceDir = path.join(libraryPath, id);
  await fs.mkdir(sourceDir, { recursive: true });

  // 1. Save original content for reprocessing later
  const isHtml = originalContent.includes("<!DOCTYPE") || originalContent.includes("<html");
  if (isHtml) {
    await fs.writeFile(path.join(sourceDir, "original.html"), originalContent, "utf-8");
  } else {
    // Plain text - save as original.txt
    await fs.writeFile(path.join(sourceDir, "original.txt"), originalContent, "utf-8");
  }

  // 2. Save source.md with frontmatter and processed content
  const frontmatter = `---
title: "${sourceMeta.title.replace(/"/g, '\\"')}"
type: ${sourceMeta.type}
${sourceMeta.sourceUrl ? `source_url: "${sourceMeta.sourceUrl}"` : ""}
created_at: "${createdAt}"
---`;

  const sourceMd = `${frontmatter}

<!-- PROCESSED_CONTENT_START -->
${content}
<!-- PROCESSED_CONTENT_END -->
`;
  await fs.writeFile(path.join(sourceDir, "source.md"), sourceMd, "utf-8");

  // 3. Save analysis.json
  await fs.writeFile(
    path.join(sourceDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf-8"
  );

  // 4. Generate and save README.md (Triage Card)
  const readme = generateReadme(sourceMeta, analysis);
  await fs.writeFile(path.join(sourceDir, "README.md"), readme, "utf-8");

  return {
    meta: sourceMeta,
    originalContent,
    content,
    analysis,
  };
}

function generateReadme(meta: SourceMeta, analysis: Analysis): string {
  const { triage, digest } = analysis;

  const emojiMap: Record<ActionType, string> = {
    must_read: "🔥",
    worth_reading: "📖",
    skim: "👀",
    summary_only: "📌",
    skip: "⏭️",
  };

  const emoji = emojiMap[triage.action] ?? "📄";
  const label = ACTION_CONFIG[triage.action]?.label ?? triage.action;

  return `# ${meta.title}

${emoji} **${label}** (${triage.score}/100) - ${triage.reason}

| Metric | Value |
|--------|-------|
| Read Time | ${triage.readTimeMinutes} min |
| Density | ${triage.density}% |
| Originality | ${triage.originality}% |

${meta.sourceUrl ? `**Source**: [${new URL(meta.sourceUrl).hostname}](${meta.sourceUrl})` : ""}

---

## Summary

${digest.summary}

## Highlights

${digest.highlights.map((h) => `- **[${h.type.replace("_", " ")}]** ${h.text}`).join("\n")}

---

*Analyzed on ${new Date(analysis.analyzedAt).toLocaleDateString()}*
`;
}

export async function loadSource(
  id: string,
  libraryPath = getLibraryPath()
): Promise<Source | null> {
  const sourceDir = path.join(libraryPath, id);

  try {
    // Read source.md
    const sourceMd = await fs.readFile(path.join(sourceDir, "source.md"), "utf-8");
    const { meta, content } = parseSourceMd(sourceMd, id);

    // Read original content (for reprocessing)
    let originalContent = "";
    try {
      originalContent = await fs.readFile(path.join(sourceDir, "original.html"), "utf-8");
    } catch {
      try {
        originalContent = await fs.readFile(path.join(sourceDir, "original.txt"), "utf-8");
      } catch {
        // Fallback for old sources without original file
      }
    }

    // Read analysis.json
    let analysis: Analysis | undefined;
    try {
      const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
      analysis = JSON.parse(analysisJson);
    } catch {
      // Analysis might not exist yet
    }

    return { meta, originalContent, content, analysis };
  } catch {
    return null;
  }
}

export async function updateAnalysis(
  id: string,
  analysis: Analysis,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);
  await fs.writeFile(
    path.join(sourceDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf-8"
  );
}

function parseSourceMd(fileContent: string, id: string): { meta: SourceMeta; content: string } {
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      meta: { id, title: "Untitled", type: "note", createdAt: new Date().toISOString() },
      content: fileContent,
    };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  // Simple YAML parsing
  const meta: SourceMeta = {
    id,
    title: extractYamlValue(frontmatter, "title") || "Untitled",
    type: (extractYamlValue(frontmatter, "type") as SourceMeta["type"]) || "note",
    sourceUrl: extractYamlValue(frontmatter, "source_url"),
    createdAt: extractYamlValue(frontmatter, "created_at") || new Date().toISOString(),
  };

  // Try new format first (HTML comment markers)
  let contentMatch = body.match(/<!-- PROCESSED_CONTENT_START -->\n([\s\S]*?)\n<!-- PROCESSED_CONTENT_END -->/);

  // Fallback to old format (## headers)
  if (!contentMatch) {
    const oldContentMatch = body.match(/## Content\n\n([\s\S]*)$/);
    if (oldContentMatch) {
      contentMatch = oldContentMatch;
    }
  }

  const content = contentMatch ? contentMatch[1].trim() : body.trim();

  return { meta, content };
}

function extractYamlValue(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m"));
  return match ? match[1] : undefined;
}

export async function listSources(libraryPath = getLibraryPath()): Promise<SourceMeta[]> {
  await ensureLibraryExists(libraryPath);

  const entries = await fs.readdir(libraryPath, { withFileTypes: true });
  const sources: SourceMeta[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const source = await loadSource(entry.name, libraryPath);
      if (source) {
        sources.push(source.meta);
      }
    }
  }

  // Sort by createdAt descending (newest first)
  sources.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return sources;
}

export async function listSourceSummaries(libraryPath = getLibraryPath()): Promise<SourceSummary[]> {
  await ensureLibraryExists(libraryPath);

  const entries = await fs.readdir(libraryPath, { withFileTypes: true });
  const summaries: SourceSummary[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const source = await loadSource(entry.name, libraryPath);
      if (source) {
        summaries.push({
          meta: source.meta,
          score: source.analysis?.triage.score,
          reason: source.analysis?.triage.reason,
          action: source.analysis?.triage.action,
        });
      }
    }
  }

  // Sort by createdAt descending (newest first)
  summaries.sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime());

  return summaries;
}
