import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Source, SourceMeta, SourceSummary, Analysis, ACTION_CONFIG, ActionType, ProcessingStatus } from "./types";

/**
 * User configuration stored in config.json
 */
export interface UserConfig {
  accentColor?: string;  // Hex color like "#3b6044"
  fontFamily?: string;   // Font name
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
 * Create a pending source immediately (before processing)
 * This allows the UI to show the source right away with a loading state
 */
export async function createPendingSource(
  meta: Omit<SourceMeta, "id" | "createdAt" | "processingStatus">,
  originalContent: string,
  libraryPath = getLibraryPath()
): Promise<{ id: string; meta: SourceMeta }> {
  const id = uuidv4().slice(0, 8);
  const createdAt = new Date().toISOString();

  const sourceMeta: SourceMeta = {
    ...meta,
    id,
    createdAt,
    processingStatus: "processing",
  };

  const sourceDir = path.join(libraryPath, id);
  await fs.mkdir(sourceDir, { recursive: true });

  // Save original content for reprocessing later
  const isHtml = originalContent.includes("<!DOCTYPE") || originalContent.includes("<html");
  if (isHtml) {
    await fs.writeFile(path.join(sourceDir, "original.html"), originalContent, "utf-8");
  } else {
    await fs.writeFile(path.join(sourceDir, "original.txt"), originalContent, "utf-8");
  }

  // Save minimal source.md with pending status
  const frontmatter = `---
title: "${sourceMeta.title.replace(/"/g, '\\"')}"
type: ${sourceMeta.type}
${sourceMeta.sourceUrl ? `source_url: "${sourceMeta.sourceUrl}"` : ""}
created_at: "${createdAt}"
processing_status: processing
---

Processing content...
`;
  await fs.writeFile(path.join(sourceDir, "source.md"), frontmatter, "utf-8");

  return { id, meta: sourceMeta };
}

/**
 * Complete a pending source with processed content and analysis
 */
export async function completeSource(
  id: string,
  content: string,
  analysis: Analysis,
  title?: string, // optional new title if extracted
  libraryPath = getLibraryPath()
): Promise<Source> {
  const sourceDir = path.join(libraryPath, id);

  // Load existing meta
  const sourceMd = await fs.readFile(path.join(sourceDir, "source.md"), "utf-8");
  const { meta } = parseSourceMd(sourceMd, id);

  // Update title if provided
  const finalTitle = title || meta.title;
  const updatedMeta: SourceMeta = {
    ...meta,
    title: finalTitle,
    processingStatus: "ready",
  };

  // Load original content
  let originalContent = "";
  try {
    originalContent = await fs.readFile(path.join(sourceDir, "original.html"), "utf-8");
  } catch {
    try {
      originalContent = await fs.readFile(path.join(sourceDir, "original.txt"), "utf-8");
    } catch {
      // No original content found
    }
  }

  // Update source.md with processed content
  const frontmatter = `---
title: "${finalTitle.replace(/"/g, '\\"')}"
type: ${updatedMeta.type}
${updatedMeta.sourceUrl ? `source_url: "${updatedMeta.sourceUrl}"` : ""}
created_at: "${updatedMeta.createdAt}"
processing_status: ready
---`;

  const newSourceMd = `${frontmatter}

<!-- PROCESSED_CONTENT_START -->
${content}
<!-- PROCESSED_CONTENT_END -->
`;
  await fs.writeFile(path.join(sourceDir, "source.md"), newSourceMd, "utf-8");

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
 * Mark a source as failed
 */
export async function failSource(
  id: string,
  error: string,
  libraryPath = getLibraryPath()
): Promise<void> {
  const sourceDir = path.join(libraryPath, id);

  // Load and update source.md
  const sourceMd = await fs.readFile(path.join(sourceDir, "source.md"), "utf-8");
  const { meta } = parseSourceMd(sourceMd, id);

  const frontmatter = `---
title: "${meta.title.replace(/"/g, '\\"')}"
type: ${meta.type}
${meta.sourceUrl ? `source_url: "${meta.sourceUrl}"` : ""}
created_at: "${meta.createdAt}"
processing_status: failed
processing_error: "${error.replace(/"/g, '\\"')}"
---

Processing failed: ${error}
`;
  await fs.writeFile(path.join(sourceDir, "source.md"), frontmatter, "utf-8");
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
  // First try direct path (for backward compatibility)
  const directPath = path.join(libraryPath, id);
  try {
    await fs.access(path.join(directPath, "source.md"));
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
    processingStatus: (extractYamlValue(frontmatter, "processing_status") as ProcessingStatus) || "ready",
    processingError: extractYamlValue(frontmatter, "processing_error"),
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
  const summaries: SourceSummary[] = [];

  // Recursively scan for sources
  async function scanDir(dir: string, relativePath: string = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      // Check if this directory is a source (has source.md)
      try {
        await fs.access(path.join(fullPath, "source.md"));
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
 * Load source from a specific directory path
 */
async function loadSourceFromPath(
  sourceDir: string,
  id: string
): Promise<Source | null> {
  try {
    const sourceMd = await fs.readFile(path.join(sourceDir, "source.md"), "utf-8");
    const { meta, content } = parseSourceMd(sourceMd, id);

    let originalContent = "";
    try {
      originalContent = await fs.readFile(path.join(sourceDir, "original.html"), "utf-8");
    } catch {
      try {
        originalContent = await fs.readFile(path.join(sourceDir, "original.txt"), "utf-8");
      } catch {
        // Fallback for old sources
      }
    }

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

/**
 * Update source content (title and/or body)
 */
export async function updateSourceContent(
  id: string,
  updates: { title?: string; content?: string },
  libraryPath = getLibraryPath()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find source directory (same logic as loadSource)
    let sourceDir = path.join(libraryPath, id);
    try {
      await fs.access(path.join(sourceDir, "source.md"));
    } catch {
      // Not at direct path, search recursively
      const foundPath = await findSourcePath(id, libraryPath);
      if (!foundPath) {
        return { success: false, error: "Source not found" };
      }
      sourceDir = foundPath;
    }

    // Read current source.md
    const sourceMdPath = path.join(sourceDir, "source.md");
    const sourceMd = await fs.readFile(sourceMdPath, "utf-8");
    const { meta, content: currentContent } = parseSourceMd(sourceMd, id);

    // Apply updates
    const newTitle = updates.title ?? meta.title;
    const newContent = updates.content ?? currentContent;

    // Write updated source.md
    const frontmatter = `---
title: "${newTitle.replace(/"/g, '\\"')}"
type: ${meta.type}
${meta.sourceUrl ? `source_url: "${meta.sourceUrl}"` : ""}
created_at: "${meta.createdAt}"
processing_status: ${meta.processingStatus || "ready"}
---`;

    const newSourceMd = `${frontmatter}

<!-- PROCESSED_CONTENT_START -->
${newContent}
<!-- PROCESSED_CONTENT_END -->
`;
    await fs.writeFile(sourceMdPath, newSourceMd, "utf-8");

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

      // Check if this is a source directory
      try {
        await fs.access(path.join(fullPath, "source.md"));
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
          await fs.access(path.join(fullPath, "source.md"));
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

  await fs.rm(sourcePath, { recursive: true });
  return true;
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
