import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Source, SourceMeta, SourceSummary, Analysis, ACTION_CONFIG, ActionType, ProcessingStatus, OriginalData, SourceType, Connection, FeedCache } from "./types";

/**
 * User configuration stored in config.json
 */
export interface UserConfig {
  accentColor?: string;  // Hex color like "#3b6044"
  fontFamily?: string;   // Font ID like "outfit", "inter", etc.
  feedSources?: string[]; // Domains to prioritize in feed (e.g., ["reddit.com", "news.ycombinator.com"])
}

/**
 * Get the root path for Second Brain user data
 * Default: ./user_data (inside project, for easy debugging)
 */
function getRootPath(): string {
  return process.env.SECONDBRAIN_ROOT || path.join(process.cwd(), "user_data");
}

/**
 * Get library path (inside root)
 */
function getLibraryPath(): string {
  return process.env.SECONDBRAIN_LIBRARY || path.join(getRootPath(), "library");
}

/**
 * Get config file path
 */
function getConfigPath(): string {
  return path.join(getRootPath(), "config.json");
}

/**
 * Load user configuration
 */
export async function loadUserConfig(): Promise<UserConfig> {
  try {
    const configPath = getConfigPath();
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {}; // Return defaults if config doesn't exist
  }
}

/**
 * Save user configuration
 */
export async function saveUserConfig(config: UserConfig): Promise<void> {
  const rootPath = getRootPath();
  await fs.mkdir(rootPath, { recursive: true });
  const configPath = getConfigPath();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Get the current root path (for display in UI)
 */
export function getCurrentRootPath(): string {
  return getRootPath();
}

export async function ensureLibraryExists(libraryPath = getLibraryPath()): Promise<void> {
  await fs.mkdir(libraryPath, { recursive: true });
}

/**
 * Determine the original_file name based on type and content
 */
function getOriginalFileName(type: SourceType, content?: string | Buffer): string {
  switch (type) {
    case "html":
      return "original.html";
    case "text":
      return "original.txt";
    case "document":
      // For documents, we'll get the extension from the actual file
      // Default to .pdf for now
      return "original.pdf";
    case "image":
      // For images, we'll get the extension from the actual file
      // Default to .png for now
      return "original.png";
    default:
      // Detect from content
      if (typeof content === "string") {
        const isHtml = content.includes("<!DOCTYPE") || content.includes("<html");
        return isHtml ? "original.html" : "original.txt";
      }
      return "original.txt";
  }
}

/**
 * Create a pending source immediately (before processing)
 * This allows the UI to show the source right away with a loading state.
 *
 * Creates:
 * - original.json (immutable metadata)
 * - original file (raw content)
 *
 * Status "processing" is inferred from original.json existing without content.md
 */
export async function createPendingSource(
  meta: Omit<SourceMeta, "id" | "createdAt" | "processingStatus">,
  originalContent: string | Buffer,
  options?: { originalFileName?: string },
  libraryPath = getLibraryPath()
): Promise<{ id: string; meta: SourceMeta }> {
  const id = uuidv4().slice(0, 8);
  const createdAt = new Date().toISOString();

  const sourceDir = path.join(libraryPath, id);
  await fs.mkdir(sourceDir, { recursive: true });

  // Determine original_file name
  const originalFile = options?.originalFileName || getOriginalFileName(meta.type, originalContent);

  // Save original.json (immutable metadata)
  const originalData: OriginalData = {
    id,
    source_url: meta.sourceUrl,
    created_at: createdAt,
    type: meta.type,
    original_file: originalFile,
    original_title: meta.title,
  };
  await fs.writeFile(
    path.join(sourceDir, "original.json"),
    JSON.stringify(originalData, null, 2),
    "utf-8"
  );

  // Save original content for reprocessing later
  if (Buffer.isBuffer(originalContent)) {
    await fs.writeFile(path.join(sourceDir, originalFile), originalContent);
  } else {
    await fs.writeFile(path.join(sourceDir, originalFile), originalContent, "utf-8");
  }

  const sourceMeta: SourceMeta = {
    ...meta,
    id,
    createdAt,
    processingStatus: "processing",
  };

  return { id, meta: sourceMeta };
}

/**
 * Update read status in content.md frontmatter
 */
export async function updateReadStatus(
  id: string,
  status: "read" | "unread",
  libraryPath = getLibraryPath()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find source directory
    let sourceDir = path.join(libraryPath, id);
    try {
      await fs.access(path.join(sourceDir, "original.json"));
    } catch {
      const foundPath = await findSourcePath(id, libraryPath);
      if (!foundPath) {
        return { success: false, error: "Source not found" };
      }
      sourceDir = foundPath;
    }

    // Read current content.md
    const contentMdPath = path.join(sourceDir, "content.md");
    let currentTitle = "Untitled";
    let currentContent = "";

    try {
      const contentMd = await fs.readFile(contentMdPath, "utf-8");
      const parsed = parseContentMd(contentMd);
      currentTitle = parsed.title;
      currentContent = parsed.content;
    } catch {
      // content.md doesn't exist yet
      return { success: false, error: "Content not ready" };
    }

    // Build new frontmatter
    const lastReadAt = status === "read" ? new Date().toISOString() : undefined;
    const frontmatterLines = [`title: "${currentTitle.replace(/"/g, '\\"')}"`];
    if (status === "read") {
      frontmatterLines.push(`readStatus: "read"`);
      frontmatterLines.push(`lastReadAt: "${lastReadAt}"`);
    }
    // For unread, we simply omit the readStatus field (backward compatible default)

    const newContentMd = `---
${frontmatterLines.join("\n")}
---

${currentContent}
`;
    await fs.writeFile(contentMdPath, newContentMd, "utf-8");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Save content.md for a source (progressive update - step 1)
 * This makes the content visible to the user immediately.
 */
export async function saveSourceContent(
  id: string,
  content: string,
  title: string,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);
  const contentMd = `---
title: "${title.replace(/"/g, '\\"')}"
---

${content}
`;
  await fs.writeFile(path.join(sourceDir, "content.md"), contentMd, "utf-8");
}

/**
 * Save analysis.json for a source (progressive update - step 2)
 * Also generates README.md
 *
 * WARNING: This overwrites the entire analysis.json. If you only need to
 * add connections, use setSourceConnections() instead to avoid race conditions.
 */
export async function saveSourceAnalysis(
  id: string,
  analysis: Analysis,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);

  // Load original.json for metadata
  const originalJson = await fs.readFile(path.join(sourceDir, "original.json"), "utf-8");
  const originalData: OriginalData = JSON.parse(originalJson);

  // Load title from content.md if it exists
  let title = originalData.original_title;
  try {
    const contentMd = await fs.readFile(path.join(sourceDir, "content.md"), "utf-8");
    const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
    if (titleMatch) title = titleMatch[1];
  } catch {
    // content.md doesn't exist yet
  }

  // Save analysis.json
  await fs.writeFile(
    path.join(sourceDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf-8"
  );

  // Generate and save README.md
  const meta: SourceMeta = {
    id: originalData.id,
    title,
    type: originalData.type,
    sourceUrl: originalData.source_url,
    createdAt: originalData.created_at,
    processingStatus: "ready",
  };
  const readme = generateReadme(meta, analysis);
  await fs.writeFile(path.join(sourceDir, "README.md"), readme, "utf-8");
}

/**
 * Safely set connections for a source (read-modify-write pattern)
 * This reads the current analysis, updates only the connections field, and writes back.
 * Safer than saveSourceAnalysis when only updating connections.
 */
export async function setSourceConnections(
  id: string,
  connections: Connection[],
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);
  const analysisPath = path.join(sourceDir, "analysis.json");

  // Read current analysis
  const analysisJson = await fs.readFile(analysisPath, "utf-8");
  const analysis: Analysis = JSON.parse(analysisJson);

  // Update only connections
  analysis.connections = connections;
  // Clear any previous connection error
  delete analysis.connectionError;

  // Write back
  await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");
}

/**
 * Save a connection error to analysis.json
 * This allows the UI to show the error to the user
 */
export async function saveConnectionError(
  id: string,
  error: string,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);
  const analysisPath = path.join(sourceDir, "analysis.json");

  // Read current analysis
  const analysisJson = await fs.readFile(analysisPath, "utf-8");
  const analysis: Analysis = JSON.parse(analysisJson);

  // Set the error
  analysis.connectionError = error;

  // Write back
  await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");
}

/**
 * Complete a pending source with processed content and analysis
 *
 * Creates:
 * - content.md (derived, editable content with title in frontmatter)
 * - analysis.json
 * - README.md (triage card)
 */
export async function completeSource(
  id: string,
  content: string,
  analysis: Analysis,
  title?: string, // optional new title if extracted
  libraryPath = getLibraryPath()
): Promise<Source> {
  const sourceDir = path.join(libraryPath, id);

  // Load original.json
  const originalJson = await fs.readFile(path.join(sourceDir, "original.json"), "utf-8");
  const originalData: OriginalData = JSON.parse(originalJson);

  // Use provided title or fall back to original_title
  const finalTitle = title || originalData.original_title;

  const updatedMeta: SourceMeta = {
    id: originalData.id,
    title: finalTitle,
    type: originalData.type,
    sourceUrl: originalData.source_url,
    createdAt: originalData.created_at,
    processingStatus: "ready",
  };

  // Load original content using original_file from metadata
  let originalContent = "";
  const originalFile = originalData.original_file || "original.html"; // fallback for old format
  try {
    const filePath = path.join(sourceDir, originalFile);
    // For binary files (images), we don't load content here
    if (originalData.type === "image") {
      originalContent = `[Image: ${originalFile}]`;
    } else {
      originalContent = await fs.readFile(filePath, "utf-8");
    }
  } catch {
    // Try legacy file names for backward compatibility
    try {
      originalContent = await fs.readFile(path.join(sourceDir, "original.html"), "utf-8");
    } catch {
      try {
        originalContent = await fs.readFile(path.join(sourceDir, "original.txt"), "utf-8");
      } catch {
        // No original content found
      }
    }
  }

  // Write content.md with title in frontmatter
  const contentMd = `---
title: "${finalTitle.replace(/"/g, '\\"')}"
---

${content}
`;
  await fs.writeFile(path.join(sourceDir, "content.md"), contentMd, "utf-8");

  // Save analysis.json
  await fs.writeFile(
    path.join(sourceDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf-8"
  );

  // Generate and save README.md
  const readme = generateReadme(updatedMeta, analysis);
  await fs.writeFile(path.join(sourceDir, "README.md"), readme, "utf-8");

  return {
    meta: updatedMeta,
    originalContent,
    content,
    analysis,
  };
}

/**
 * Mark a source as failed by writing error.txt
 */
export async function failSource(
  id: string,
  error: string,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);
  await fs.writeFile(path.join(sourceDir, "error.txt"), error, "utf-8");
}

/**
 * Save a fully processed source (one-shot, no pending state)
 *
 * Creates:
 * - original.json (immutable metadata)
 * - original file (raw content)
 * - content.md (derived content)
 * - analysis.json
 * - README.md (triage card)
 */
export async function saveSource(
  meta: Omit<SourceMeta, "id" | "createdAt">,
  originalContent: string | Buffer,
  content: string,
  analysis: Analysis,
  options?: { originalFileName?: string },
  libraryPath = getLibraryPath()
): Promise<Source> {
  const id = uuidv4().slice(0, 8);
  const createdAt = new Date().toISOString();

  const sourceDir = path.join(libraryPath, id);
  await fs.mkdir(sourceDir, { recursive: true });

  // Determine original_file name
  const originalFile = options?.originalFileName || getOriginalFileName(meta.type, originalContent);

  // 1. Save original.json (immutable metadata)
  const originalData: OriginalData = {
    id,
    source_url: meta.sourceUrl,
    created_at: createdAt,
    type: meta.type,
    original_file: originalFile,
    original_title: meta.title,
  };
  await fs.writeFile(
    path.join(sourceDir, "original.json"),
    JSON.stringify(originalData, null, 2),
    "utf-8"
  );

  // 2. Save original content for reprocessing later
  if (Buffer.isBuffer(originalContent)) {
    await fs.writeFile(path.join(sourceDir, originalFile), originalContent);
  } else {
    await fs.writeFile(path.join(sourceDir, originalFile), originalContent, "utf-8");
  }

  // 3. Save content.md with title in frontmatter
  const contentMd = `---
title: "${meta.title.replace(/"/g, '\\"')}"
---

${content}
`;
  await fs.writeFile(path.join(sourceDir, "content.md"), contentMd, "utf-8");

  // 4. Save analysis.json
  await fs.writeFile(
    path.join(sourceDir, "analysis.json"),
    JSON.stringify(analysis, null, 2),
    "utf-8"
  );

  const sourceMeta: SourceMeta = {
    ...meta,
    id,
    createdAt,
    processingStatus: "ready",
  };

  // 5. Generate and save README.md (Triage Card)
  const readme = generateReadme(sourceMeta, analysis);
  await fs.writeFile(path.join(sourceDir, "README.md"), readme, "utf-8");

  return {
    meta: sourceMeta,
    originalContent: Buffer.isBuffer(originalContent) ? "[Binary content]" : originalContent,
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
  // First try direct path
  const directPath = path.join(libraryPath, id);
  try {
    await fs.access(path.join(directPath, "original.json"));
    return loadSourceFromPath(directPath, id);
  } catch {
    // Not at direct path, search recursively
  }

  // Search recursively
  const sourcePath = await findSourcePath(id, libraryPath);
  if (!sourcePath) return null;

  return loadSourceFromPath(sourcePath, id);
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

/**
 * Add a connection to an existing source's analysis
 * Used for creating reverse connections when a new source is added
 */
export async function addConnectionToSource(
  id: string,
  connection: Connection,
  libraryPath = getLibraryPath()
): Promise<boolean> {
  try {
    // Find source directory
    let sourceDir = path.join(libraryPath, id);
    try {
      await fs.access(path.join(sourceDir, "analysis.json"));
    } catch {
      const foundPath = await findSourcePath(id, libraryPath);
      if (!foundPath) return false;
      sourceDir = foundPath;
    }

    // Load existing analysis
    const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
    const analysis: Analysis = JSON.parse(analysisJson);

    // Initialize connections array if needed
    if (!analysis.connections) {
      analysis.connections = [];
    }

    // Check if this connection already exists (same source pair)
    const existingIndex = analysis.connections.findIndex(
      (c) => c.relatedSourceIds.length === connection.relatedSourceIds.length &&
             c.relatedSourceIds.every((id) => connection.relatedSourceIds.includes(id))
    );

    if (existingIndex >= 0) {
      // Update existing connection
      analysis.connections[existingIndex] = connection;
    } else {
      // Add new connection
      analysis.connections.push(connection);
    }

    // Save updated analysis
    await fs.writeFile(
      path.join(sourceDir, "analysis.json"),
      JSON.stringify(analysis, null, 2),
      "utf-8"
    );

    return true;
  } catch (error) {
    console.error(`Failed to add connection to source ${id}:`, error);
    return false;
  }
}

/**
 * Parsed frontmatter from content.md
 */
interface ContentMdFrontmatter {
  title: string;
  content: string;
  readStatus?: "unread" | "read";
  lastReadAt?: string;
}

/**
 * Parse content.md frontmatter to extract title and read status
 */
function parseContentMd(fileContent: string): ContentMdFrontmatter {
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { title: "Untitled", content: fileContent.trim() };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const title = extractYamlValue(frontmatter, "title") || "Untitled";
  const readStatus = extractYamlValue(frontmatter, "readStatus") as "unread" | "read" | undefined;
  const lastReadAt = extractYamlValue(frontmatter, "lastReadAt");

  return { title, content: body.trim(), readStatus, lastReadAt };
}

function extractYamlValue(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m"));
  return match ? match[1] : undefined;
}

/**
 * Determine processing status based on file existence
 */
async function getProcessingStatus(sourceDir: string): Promise<{ status: ProcessingStatus; error?: string }> {
  // Check for error.txt (failed)
  try {
    const error = await fs.readFile(path.join(sourceDir, "error.txt"), "utf-8");
    return { status: "failed", error };
  } catch {
    // No error.txt
  }

  // Check for content.md (ready)
  try {
    await fs.access(path.join(sourceDir, "content.md"));
    return { status: "ready" };
  } catch {
    // No content.md = still processing
    return { status: "processing" };
  }
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
  const summaries: SourceSummary[] = [];

  // Recursively scan for sources
  async function scanDir(dir: string, relativePath: string = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      // Check if this directory is a source (has original.json)
      try {
        await fs.access(path.join(fullPath, "original.json"));
        // It's a source directory - load it
        const source = await loadSourceFromPath(fullPath, entry.name);
        if (source) {
          // Set folder path (empty for root level)
          source.meta.folder = relativePath || undefined;
          summaries.push({
            meta: source.meta,
            score: source.analysis?.triage.score,
            reason: source.analysis?.triage.reason,
            action: source.analysis?.triage.action,
          });
        }
      } catch {
        // Not a source directory - recurse into it
        await scanDir(fullPath, entryRelativePath);
      }
    }
  }

  await scanDir(libraryPath);

  // Sort by createdAt descending (newest first)
  summaries.sort((a, b) => new Date(b.meta.createdAt).getTime() - new Date(a.meta.createdAt).getTime());

  return summaries;
}

/**
 * Source data for connection analysis
 */
export interface SourceForConnections {
  id: string;
  title: string;
  summary: string;
  highlights: string[];
  concepts: { term: string; definition: string; status?: "knew" | "learned" }[];
}

/**
 * Load all sources with their analysis summaries for connection finding
 * Returns minimal data needed for connections analysis
 */
export async function listSourcesForConnections(
  excludeId?: string,
  libraryPath = getLibraryPath()
): Promise<SourceForConnections[]> {
  await ensureLibraryExists(libraryPath);
  const sources: SourceForConnections[] = [];

  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      try {
        await fs.access(path.join(fullPath, "original.json"));
        // It's a source directory
        if (entry.name === excludeId) continue;

        // Load analysis.json
        try {
          const analysisJson = await fs.readFile(path.join(fullPath, "analysis.json"), "utf-8");
          const analysis: Analysis = JSON.parse(analysisJson);

          // Load title from content.md
          let title = entry.name;
          try {
            const contentMd = await fs.readFile(path.join(fullPath, "content.md"), "utf-8");
            const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
            if (titleMatch) title = titleMatch[1];
          } catch {
            // Use original.json title as fallback
            try {
              const originalJson = await fs.readFile(path.join(fullPath, "original.json"), "utf-8");
              const original = JSON.parse(originalJson);
              title = original.original_title || entry.name;
            } catch {
              // Keep entry.name as title
            }
          }

          sources.push({
            id: entry.name,
            title,
            summary: analysis.digest?.summary ?? "",
            highlights: (analysis.digest?.highlights ?? []).map((h) => h.text),
            concepts: (analysis.digest?.concepts ?? []).map((c) => ({
              term: c.term,
              definition: c.definition,
              status: c.status,
            })),
          });
        } catch {
          // No analysis.json - source still processing, skip
        }
      } catch {
        // Not a source directory - recurse into it
        await scanDir(fullPath);
      }
    }
  }

  await scanDir(libraryPath);
  return sources;
}

/**
 * Load source from a specific directory path
 * Reads original.json for metadata and content.md for processed content
 */
async function loadSourceFromPath(
  sourceDir: string,
  id: string
): Promise<Source | null> {
  try {
    // Read original.json (required)
    const originalJson = await fs.readFile(path.join(sourceDir, "original.json"), "utf-8");
    const originalData: OriginalData = JSON.parse(originalJson);

    // Get processing status from file existence
    const { status, error } = await getProcessingStatus(sourceDir);

    // Read content.md if it exists
    let title = originalData.original_title;
    let content = "";
    let readStatus: "unread" | "read" | undefined;
    let lastReadAt: string | undefined;
    try {
      const contentMd = await fs.readFile(path.join(sourceDir, "content.md"), "utf-8");
      const parsed = parseContentMd(contentMd);
      title = parsed.title;
      content = parsed.content;
      readStatus = parsed.readStatus;
      lastReadAt = parsed.lastReadAt;
    } catch {
      // Content not ready yet (processing state)
    }

    // Read original content using original_file from metadata
    let originalContent = "";
    const originalFile = originalData.original_file || "original.html"; // fallback for old format
    try {
      const filePath = path.join(sourceDir, originalFile);
      // For binary files (images), we don't load content here
      if (originalData.type === "image") {
        originalContent = `[Image: ${originalFile}]`;
      } else {
        originalContent = await fs.readFile(filePath, "utf-8");
      }
    } catch {
      // Try legacy file names for backward compatibility
      try {
        originalContent = await fs.readFile(path.join(sourceDir, "original.html"), "utf-8");
      } catch {
        try {
          originalContent = await fs.readFile(path.join(sourceDir, "original.txt"), "utf-8");
        } catch {
          // No original content found
        }
      }
    }

    // Read analysis if it exists
    let analysis: Analysis | undefined;
    try {
      const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
      analysis = JSON.parse(analysisJson);

      // Resolve connection titles dynamically
      if (analysis?.connections) {
        for (const conn of analysis.connections) {
          const titles: string[] = [];
          for (const relatedId of conn.relatedSourceIds) {
            const relatedTitle = await getSourceTitle(relatedId);
            titles.push(relatedTitle || relatedId); // Fallback to ID if title not found
          }
          // Add resolved titles to connection (not stored, just for display)
          (conn as Connection & { relatedSourceTitles?: string[] }).relatedSourceTitles = titles;
        }
      }
    } catch {
      // Analysis might not exist yet
    }

    const meta: SourceMeta = {
      id: originalData.id,
      title,
      type: originalData.type,
      sourceUrl: originalData.source_url,
      createdAt: originalData.created_at,
      processingStatus: status,
      processingError: error,
      readStatus,
      lastReadAt,
    };

    return { meta, originalContent, content, analysis };
  } catch {
    return null;
  }
}

/**
 * Update source content (title and/or body)
 * Only modifies content.md (derived data), never touches original.json
 */
export async function updateSourceContent(
  id: string,
  updates: { title?: string; content?: string },
  libraryPath = getLibraryPath()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find source directory
    let sourceDir = path.join(libraryPath, id);
    try {
      await fs.access(path.join(sourceDir, "original.json"));
    } catch {
      // Not at direct path, search recursively
      const foundPath = await findSourcePath(id, libraryPath);
      if (!foundPath) {
        return { success: false, error: "Source not found" };
      }
      sourceDir = foundPath;
    }

    // Read current content.md
    const contentMdPath = path.join(sourceDir, "content.md");
    let currentTitle = "Untitled";
    let currentContent = "";
    try {
      const contentMd = await fs.readFile(contentMdPath, "utf-8");
      const parsed = parseContentMd(contentMd);
      currentTitle = parsed.title;
      currentContent = parsed.content;
    } catch {
      // content.md doesn't exist yet, use original.json title
      const originalJson = await fs.readFile(path.join(sourceDir, "original.json"), "utf-8");
      const originalData: OriginalData = JSON.parse(originalJson);
      currentTitle = originalData.original_title;
    }

    // Apply updates
    const newTitle = updates.title ?? currentTitle;
    const newContent = updates.content ?? currentContent;

    // Write updated content.md
    const newContentMd = `---
title: "${newTitle.replace(/"/g, '\\"')}"
---

${newContent}
`;
    await fs.writeFile(contentMdPath, newContentMd, "utf-8");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * List all folders in the library
 */
export async function listFolders(libraryPath = getLibraryPath()): Promise<string[]> {
  await ensureLibraryExists(libraryPath);
  const folders: string[] = [];

  async function scanDir(dir: string, relativePath: string = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      // Check if this is a source directory (has original.json)
      try {
        await fs.access(path.join(fullPath, "original.json"));
        // It's a source, not a folder - skip
      } catch {
        // It's a folder
        folders.push(entryRelativePath);
        // Recurse into subfolders
        await scanDir(fullPath, entryRelativePath);
      }
    }
  }

  await scanDir(libraryPath);
  return folders.sort();
}

/**
 * Find the full path to a source by its ID (searches recursively)
 */
export async function findSourcePath(
  id: string,
  libraryPath = getLibraryPath()
): Promise<string | null> {
  async function searchDir(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      // Check if this is the source we're looking for
      if (entry.name === id) {
        try {
          await fs.access(path.join(fullPath, "original.json"));
          return fullPath;
        } catch {
          // Not a source, continue
        }
      }

      // Recurse into subdirectories
      const found = await searchDir(fullPath);
      if (found) return found;
    }

    return null;
  }

  return searchDir(libraryPath);
}

/**
 * Get a source's title by ID (for resolving connection titles)
 */
async function getSourceTitle(
  id: string,
  libraryPath = getLibraryPath()
): Promise<string | null> {
  const sourcePath = await findSourcePath(id, libraryPath);
  if (!sourcePath) return null;

  // Try to get title from content.md first
  try {
    const contentMd = await fs.readFile(path.join(sourcePath, "content.md"), "utf-8");
    const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
    if (titleMatch) return titleMatch[1];
  } catch {
    // No content.md
  }

  // Fall back to original.json
  try {
    const originalJson = await fs.readFile(path.join(sourcePath, "original.json"), "utf-8");
    const original = JSON.parse(originalJson);
    return original.original_title || null;
  } catch {
    return null;
  }
}

/**
 * Move a source to a new folder
 */
export async function moveSource(
  id: string,
  targetFolder: string, // relative path, empty string for root
  libraryPath = getLibraryPath()
): Promise<boolean> {
  const sourcePath = await findSourcePath(id, libraryPath);
  if (!sourcePath) return false;

  const targetDir = targetFolder
    ? path.join(libraryPath, targetFolder, id)
    : path.join(libraryPath, id);

  // Don't move if already in target location
  if (sourcePath === targetDir) return true;

  // Ensure target parent directory exists
  const targetParent = path.dirname(targetDir);
  await fs.mkdir(targetParent, { recursive: true });

  // Move the directory
  await fs.rename(sourcePath, targetDir);
  return true;
}

/**
 * Delete a source by ID
 */
export async function deleteSource(
  id: string,
  libraryPath = getLibraryPath()
): Promise<boolean> {
  const sourcePath = await findSourcePath(id, libraryPath);
  if (!sourcePath) return false;

  // Security check: ensure path is within library
  const resolvedPath = path.resolve(sourcePath);
  const resolvedLibrary = path.resolve(libraryPath);
  if (!resolvedPath.startsWith(resolvedLibrary)) {
    throw new Error("Security error: path is outside library");
  }

  // Clean up connections in other sources that reference this source
  await removeConnectionsToSource(id, libraryPath);

  await fs.rm(sourcePath, { recursive: true });
  return true;
}

/**
 * Remove all connections referencing a specific source from all other sources
 * Called when a source is deleted to clean up orphaned connections
 */
async function removeConnectionsToSource(
  deletedSourceId: string,
  libraryPath: string
): Promise<void> {
  // Scan all sources and remove connections that reference the deleted source
  async function scanAndClean(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      // Check if this is a source directory
      try {
        await fs.access(path.join(fullPath, "original.json"));

        // Skip the source being deleted
        if (entry.name === deletedSourceId) continue;

        // Check if this source has an analysis.json
        try {
          const analysisPath = path.join(fullPath, "analysis.json");
          const analysisJson = await fs.readFile(analysisPath, "utf-8");
          const analysis: Analysis = JSON.parse(analysisJson);

          if (analysis.connections && analysis.connections.length > 0) {
            // Filter out connections that reference the deleted source
            const filteredConnections = analysis.connections.filter(
              (conn) => !conn.relatedSourceIds.includes(deletedSourceId)
            );

            // Only update if we removed something
            if (filteredConnections.length < analysis.connections.length) {
              analysis.connections = filteredConnections;
              await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");
              console.log(`Cleaned up connections in source ${entry.name}`);
            }
          }
        } catch {
          // No analysis.json, skip
        }
      } catch {
        // Not a source directory - recurse into it
        await scanAndClean(fullPath);
      }
    }
  }

  await scanAndClean(libraryPath);
}

/**
 * Create a new folder in the library
 */
export async function createFolder(
  folderPath: string, // relative path within library
  libraryPath = getLibraryPath()
): Promise<boolean> {
  // Validate folder name
  if (!folderPath || folderPath.includes("..")) {
    throw new Error("Invalid folder path");
  }

  const fullPath = path.join(libraryPath, folderPath);

  // Security check
  const resolvedPath = path.resolve(fullPath);
  const resolvedLibrary = path.resolve(libraryPath);
  if (!resolvedPath.startsWith(resolvedLibrary)) {
    throw new Error("Security error: path is outside library");
  }

  await fs.mkdir(fullPath, { recursive: true });
  return true;
}

/**
 * Delete a folder and all its contents
 */
export async function deleteFolder(
  folderPath: string, // relative path within library
  libraryPath = getLibraryPath()
): Promise<boolean> {
  if (!folderPath || folderPath.includes("..")) {
    throw new Error("Invalid folder path");
  }

  const fullPath = path.join(libraryPath, folderPath);

  // Security check
  const resolvedPath = path.resolve(fullPath);
  const resolvedLibrary = path.resolve(libraryPath);
  if (!resolvedPath.startsWith(resolvedLibrary) || resolvedPath === resolvedLibrary) {
    throw new Error("Security error: cannot delete this path");
  }

  // Check if folder exists
  try {
    const stat = await fs.stat(fullPath);
    if (!stat.isDirectory()) {
      throw new Error("Path is not a folder");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Folder not found");
    }
    throw err;
  }

  await fs.rm(fullPath, { recursive: true });
  return true;
}

/**
 * Rename a folder
 */
export async function renameFolder(
  oldPath: string, // relative path within library
  newName: string, // new folder name (not full path)
  libraryPath = getLibraryPath()
): Promise<string> {
  if (!oldPath || oldPath.includes("..")) {
    throw new Error("Invalid folder path");
  }
  if (!newName || newName.includes("/") || newName.includes("..")) {
    throw new Error("Invalid new folder name");
  }
  // Validate folder name
  if (!/^[a-zA-Z0-9_-]+$/.test(newName)) {
    throw new Error("Folder name can only contain letters, numbers, dash, and underscore");
  }

  const fullOldPath = path.join(libraryPath, oldPath);
  const parentDir = path.dirname(fullOldPath);
  const fullNewPath = path.join(parentDir, newName);
  const newRelativePath = path.relative(libraryPath, fullNewPath);

  // Security checks
  const resolvedOld = path.resolve(fullOldPath);
  const resolvedNew = path.resolve(fullNewPath);
  const resolvedLibrary = path.resolve(libraryPath);

  if (!resolvedOld.startsWith(resolvedLibrary) || resolvedOld === resolvedLibrary) {
    throw new Error("Security error: cannot rename this path");
  }
  if (!resolvedNew.startsWith(resolvedLibrary)) {
    throw new Error("Security error: new path is outside library");
  }

  // Check if old folder exists
  try {
    const stat = await fs.stat(fullOldPath);
    if (!stat.isDirectory()) {
      throw new Error("Path is not a folder");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("Folder not found");
    }
    throw err;
  }

  // Check if new path already exists
  try {
    await fs.access(fullNewPath);
    throw new Error("A folder with this name already exists");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  await fs.rename(fullOldPath, fullNewPath);
  return newRelativePath;
}

// =============================================================================
// Feed Cache Functions
// =============================================================================

/**
 * Get feed cache directory path
 */
function getFeedPath(): string {
  return path.join(getRootPath(), ".feed");
}

/**
 * Load feed cache from disk
 * Returns null if cache doesn't exist or is corrupted
 */
export async function loadFeedCache(): Promise<FeedCache | null> {
  try {
    const cachePath = path.join(getFeedPath(), "cache.json");
    const content = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save feed cache to disk
 */
export async function saveFeedCache(cache: FeedCache): Promise<void> {
  const feedDir = getFeedPath();
  await fs.mkdir(feedDir, { recursive: true });
  const cachePath = path.join(feedDir, "cache.json");
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}
