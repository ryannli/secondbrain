import { debugLog } from "./log";
import { promises as fs } from "fs";
import { existsSync, readFileSync } from "fs";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { Source, SourceMeta, SourceSummary, Analysis, ACTION_CONFIG, ActionType, ProcessingStatus, ProcessingStage, OriginalData, SourceType, Connection, FeedCache, AgentConversation, AgentConversationSummary, NotebookDocument, HistoryEvent } from "./types";
import { AnalysisSchema, OriginalDataSchema } from "./schemas";
import type { AgentProvider } from "./agentTypes";
import { DEFAULT_RSS_FEEDS } from "./config";

/**
 * User configuration stored in config.json
 */
export type ThemeMode = "light" | "dark" | "system";

export interface RssFeedSource {
  url: string;    // e.g. "https://www.reddit.com/r/LocalLLaMA/.rss"
  label: string;  // e.g. "r/LocalLLaMA"
}

export interface UserConfig {
  accentColor?: string;  // Hex color like "#3b6044"
  fontFamily?: string;   // Font ID like "outfit", "inter", etc.
  theme?: ThemeMode;     // Theme mode: "light", "dark", or "system" (follow OS)
  feedSources?: string[];       // DEPRECATED — migrated to rssFeeds + searchSources
  rssFeeds?: RssFeedSource[];   // RSS feeds fetched directly
  searchSources?: string[];     // Domains for Brave Search
  feedInterests?: string[]; // Search terms for feed (e.g., ["AI agents", "startups"])
  agentModeEnabled?: boolean; // Must be enabled before entering the app
  onboardedAt?: string;   // Set once the first-run onboarding cards were seen
  agentProvider?: AgentProvider; // Local CLI provider used for AI analysis and chat
  agentModels?: Partial<Record<AgentProvider, string>>; // Optional model per provider; empty inherits the CLI default
  fontSize?: string;      // "sm" | "base" | "lg"
  headingStyle?: string;  // "clean" | "colored" | "accented"
}

export type RootPathSource = "env" | "local" | "default";

interface LocalAppConfig {
  rootPath?: string;
}

function getDefaultRootPath(): string {
  return path.join(process.cwd(), "user_data");
}

function getLocalConfigPath(): string {
  return process.env.SECONDBRAIN_LOCAL_CONFIG || path.join(process.cwd(), ".secondbrain.local.json");
}

export function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Data location is required");
  }

  const expanded = trimmed === "~" || trimmed.startsWith("~/")
    ? path.join(os.homedir(), trimmed.slice(2))
    : trimmed;

  return path.resolve(expanded);
}

function readLocalAppConfig(): LocalAppConfig {
  try {
    const configPath = getLocalConfigPath();
    if (!existsSync(configPath)) return {};
    const raw = JSON.parse(readFileSync(configPath, "utf-8")) as LocalAppConfig;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/**
 * Get the root path for Second Brain user data
 * Default: ./user_data (inside project, for easy debugging)
 */
function getRootPath(): string {
  if (process.env.SECONDBRAIN_ROOT) {
    return resolveUserPath(process.env.SECONDBRAIN_ROOT);
  }

  const localRootPath = readLocalAppConfig().rootPath;
  if (localRootPath) {
    return resolveUserPath(localRootPath);
  }

  return getDefaultRootPath();
}

function getSampleDataPath(): string {
  return path.join(process.cwd(), "sample_data");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * A root counts as having user data only if it contains at least one real file.
 * Empty directories don't count: API routes may mkdir library/, .tracking/, etc.
 * before first-run seeding gets a chance to check, and that must not block it.
 */
async function rootHasUserData(rootPath: string): Promise<boolean> {
  let entries;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name === "Thumbs.db") continue;
    if (entry.isDirectory()) {
      if (await rootHasUserData(path.join(rootPath, entry.name))) return true;
    } else {
      return true;
    }
  }
  return false;
}

async function copyMissingTree(src: string, dest: string): Promise<void> {
  const stat = await fs.lstat(src);

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    await Promise.all(entries.map((entry) => copyMissingTree(path.join(src, entry), path.join(dest, entry))));
    return;
  }

  if (await exists(dest)) return;

  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(src);
    try {
      await fs.symlink(target, dest);
    } catch {
      await copyMissingTree(path.resolve(path.dirname(src), target), dest);
    }
    return;
  }

  await fs.copyFile(src, dest);
}

/**
 * Seeded sample content ships with fixed timestamps that would read as
 * months-old on a fresh install. Re-stamp the seeded copies (never the
 * sample_data source) to recent dates — this happens at creation time,
 * before the user ever sees them, so meta.json immutability is preserved.
 */
async function refreshSeededTimestamps(rootPath: string): Promise<void> {
  const dayMs = 24 * 60 * 60 * 1000;

  const rewriteJson = async (
    filePath: string,
    update: (data: Record<string, unknown>) => void,
  ) => {
    try {
      const data = JSON.parse(await fs.readFile(filePath, "utf-8")) as Record<string, unknown>;
      update(data);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Seeded file absent or malformed — not worth failing initialization
    }
  };

  const restamp = async (dir: string, createdKey: "created_at" | "createdAt") => {
    let index = 0;
    // Entries may sit inside seeded folders (e.g. library/examples/), so walk
    // recursively: any directory containing meta.json is an entry to restamp.
    const walk = async (current: string): Promise<void> => {
      let entries: string[];
      try {
        entries = (await fs.readdir(current, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort();
      } catch {
        return;
      }
      for (const name of entries) {
        const entryPath = path.join(current, name);
        if (await exists(path.join(entryPath, "meta.json"))) {
          index += 1;
          const stamp = new Date(Date.now() - index * dayMs).toISOString();
          await rewriteJson(path.join(entryPath, "meta.json"), (meta) => {
            if (meta[createdKey]) meta[createdKey] = stamp;
          });
          await rewriteJson(path.join(entryPath, "analysis.json"), (analysis) => {
            if (analysis.analyzedAt) analysis.analyzedAt = stamp;
          });
        } else {
          await walk(entryPath);
        }
      }
    };
    await walk(dir);
  };

  await restamp(path.join(rootPath, "library"), "created_at");
  await restamp(path.join(rootPath, "notebook"), "createdAt");
}

async function migrateLegacyNotebookDirectory(rootPath: string): Promise<void> {
  const legacyPath = path.join(rootPath, "studio");
  const notebookPath = path.join(rootPath, "notebook");
  if (await exists(notebookPath) || !(await exists(legacyPath))) return;
  await fs.rename(legacyPath, notebookPath);
}

const initializationPromises = new Map<string, Promise<void>>();

export function clearUserDataInitializationCacheForTests(): void {
  initializationPromises.clear();
}

export async function ensureUserDataInitialized(rootPath = getRootPath()): Promise<void> {
  const resolvedRootPath = path.resolve(rootPath);
  // sample_data is the seed template. Running the app against it writes
  // runtime state (feed cache, read status, onboarding flags) into files
  // that ship to every new user — refuse loudly instead.
  if (resolvedRootPath === path.resolve(getSampleDataPath())) {
    throw new Error(
      "sample_data is the seed template and cannot be used as the data root. Point SECONDBRAIN_ROOT at any other folder (e.g. /tmp/preview) and it will be seeded from sample_data."
    );
  }
  const existingPromise = initializationPromises.get(resolvedRootPath);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    if (await rootHasUserData(resolvedRootPath)) {
      await migrateLegacyNotebookDirectory(resolvedRootPath);
      return;
    }

    const samplePath = getSampleDataPath();
    if (await exists(samplePath)) {
      await copyMissingTree(samplePath, resolvedRootPath);
      await refreshSeededTimestamps(resolvedRootPath);
      await migrateLegacyNotebookDirectory(resolvedRootPath);
      return;
    }

    await fs.mkdir(path.join(resolvedRootPath, "library"), { recursive: true });
    await fs.mkdir(path.join(resolvedRootPath, "notebook"), { recursive: true });
  })();

  initializationPromises.set(resolvedRootPath, promise);
  try {
    await promise;
  } catch (error) {
    initializationPromises.delete(resolvedRootPath);
    throw error;
  }
}

export function getRootPathSource(): RootPathSource {
  if (process.env.SECONDBRAIN_ROOT) return "env";
  if (readLocalAppConfig().rootPath) return "local";
  return "default";
}

export function isRootPathLocked(): boolean {
  return Boolean(process.env.SECONDBRAIN_ROOT);
}

export async function saveLocalRootPath(rootPath: string): Promise<string> {
  const resolvedRootPath = resolveUserPath(rootPath);
  const configPath = getLocalConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify({ rootPath: resolvedRootPath }, null, 2), "utf-8");
  await ensureUserDataInitialized(resolvedRootPath);
  return resolvedRootPath;
}

/**
 * Get library path (inside root)
 */
export function getLibraryPath(): string {
  return process.env.SECONDBRAIN_LIBRARY || path.join(getRootPath(), "library");
}

/**
 * Get notebook path (inside root)
 */
export function getNotebookPath(): string {
  return path.join(getRootPath(), "notebook");
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
  await ensureUserDataInitialized();

  try {
    const configPath = getConfigPath();
    const content = await fs.readFile(configPath, "utf-8");
    const config: UserConfig = JSON.parse(content);

    // Migrate legacy feedSources → rssFeeds + searchSources
    if (config.feedSources && !config.rssFeeds && !config.searchSources) {
      config.rssFeeds = config.feedSources.includes("news.ycombinator.com")
        ? DEFAULT_RSS_FEEDS
        : [];
      config.searchSources = config.feedSources.filter(s => s !== "news.ycombinator.com");
      delete config.feedSources;
      await saveUserConfig(config);
    }

    return config;
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
  if (path.resolve(libraryPath) === path.resolve(getLibraryPath())) {
    await ensureUserDataInitialized();
  }
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
 * Helper to read meta.json (with fallback to legacy original.json)
 */
async function readMetaJson(sourceDir: string): Promise<OriginalData> {
  const metaPath = path.join(sourceDir, "meta.json");
  const legacyPath = path.join(sourceDir, "original.json");

  let content: string;
  let usedPath = metaPath;
  try {
    content = await fs.readFile(metaPath, "utf-8");
  } catch {
    content = await fs.readFile(legacyPath, "utf-8");
    usedPath = legacyPath;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Failed to parse metadata at ${usedPath}: ${message}`);
  }

  const parsed = OriginalDataSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[readMetaJson] Invalid metadata at ${usedPath}:`, parsed.error.flatten());
    throw new Error(`Invalid metadata at ${usedPath}`);
  }

  return parsed.data;
}

function parseAnalysisJson(
  analysisJson: string,
  context: string
): { analysis?: Analysis; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(analysisJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { error: `Invalid JSON in analysis.json: ${message}` };
  }

  const parsed = AnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`[${context}] Invalid analysis.json schema:`, parsed.error.flatten());
    return { error: "Invalid analysis.json schema" };
  }

  return { analysis: parsed.data as Analysis };
}

/**
 * Helper to check if a directory is an entry (has meta.json)
 */
async function isEntryDirectory(dir: string): Promise<boolean> {
  try {
    await fs.access(path.join(dir, "meta.json"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Update saved status in meta.json
 */
export async function updateEntrySaved(
  id: string,
  saved: boolean,
  basePath = getLibraryPath()
): Promise<{ success: boolean; error?: string }> {
  try {
    const entryPath = await findEntryPath(id, basePath);
    if (!entryPath) {
      return { success: false, error: "Entry not found" };
    }

    const metaPath = path.join(entryPath, "meta.json");
    const meta = await readMetaJson(entryPath);
    meta.saved = saved;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Create a pending source immediately (before processing)
 * This allows the UI to show the source right away with a loading state.
 *
 * Creates:
 * - meta.json (immutable metadata)
 * - original file (raw content)
 *
 * Status "processing" is inferred from meta.json existing without content.md
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

  // Save meta.json (immutable metadata)
  const originalData: OriginalData = {
    id,
    schemaVersion: 1,
    source_url: meta.sourceUrl,
    created_at: createdAt,
    type: meta.type,
    original_file: originalFile,
    original_title: meta.title,
  };
  await fs.writeFile(
    path.join(sourceDir, "meta.json"),
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
    if (!await isEntryDirectory(sourceDir)) {
      const foundPath = await findEntryPath(id, libraryPath);
      if (!foundPath) {
        return { success: false, error: "Source not found" };
      }
      sourceDir = foundPath;
    }

    // Read current content.md
    const contentMdPath = path.join(sourceDir, "content.md");
    let parsed: ContentMdFrontmatter;

    try {
      const contentMd = await fs.readFile(contentMdPath, "utf-8");
      parsed = parseContentMd(contentMd);
    } catch {
      // content.md doesn't exist yet
      return { success: false, error: "Content not ready" };
    }

    // Build new frontmatter preserving existing fields
    const lastReadAt = status === "read" ? new Date().toISOString() : undefined;
    const frontmatterLines = [`title: "${parsed.title.replace(/"/g, '\\"')}"`];
    if (status === "read") {
      frontmatterLines.push(`readStatus: "read"`);
      frontmatterLines.push(`lastReadAt: "${lastReadAt}"`);
    }
    // For unread, we simply omit the readStatus field (backward compatible default)
    if (parsed.totalReadTimeSeconds) {
      frontmatterLines.push(`totalReadTimeSeconds: ${parsed.totalReadTimeSeconds}`);
    }

    const newContentMd = `---\n${frontmatterLines.join("\n")}\n---\n\n${parsed.content}\n`;
    await fs.writeFile(contentMdPath, newContentMd, "utf-8");

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Add reading time seconds to a source's totalReadTimeSeconds in content.md frontmatter
 */
export async function addReadingTime(
  id: string,
  seconds: number,
  libraryPath = getLibraryPath()
): Promise<{ success: boolean; totalSeconds?: number; error?: string }> {
  try {
    let sourceDir = path.join(libraryPath, id);
    if (!await isEntryDirectory(sourceDir)) {
      const foundPath = await findEntryPath(id, libraryPath);
      if (!foundPath) return { success: false, error: "Source not found" };
      sourceDir = foundPath;
    }

    const contentMdPath = path.join(sourceDir, "content.md");
    let contentMd: string;
    try {
      contentMd = await fs.readFile(contentMdPath, "utf-8");
    } catch {
      return { success: false, error: "Content not ready" };
    }

    const parsed = parseContentMd(contentMd);
    const existing = parsed.totalReadTimeSeconds ?? 0;
    const total = existing + seconds;

    // Rebuild frontmatter preserving all existing fields
    const frontmatterLines = [`title: "${parsed.title.replace(/"/g, '\\"')}"`];
    if (parsed.readStatus) frontmatterLines.push(`readStatus: "${parsed.readStatus}"`);
    if (parsed.lastReadAt) frontmatterLines.push(`lastReadAt: "${parsed.lastReadAt}"`);
    frontmatterLines.push(`totalReadTimeSeconds: ${total}`);

    const newContentMd = `---\n${frontmatterLines.join("\n")}\n---\n\n${parsed.content}\n`;
    await fs.writeFile(contentMdPath, newContentMd, "utf-8");

    return { success: true, totalSeconds: total };
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

  // Load meta.json for metadata (with fallback to original.json)
  const originalData: OriginalData = await readMetaJson(sourceDir);

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
  const parsed = parseAnalysisJson(analysisJson, id);
  if (parsed.error || !parsed.analysis) {
    throw new Error(`[${id}] Failed to parse analysis.json: ${parsed.error || "invalid analysis"}`);
  }
  const analysis = parsed.analysis;

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
  const parsed = parseAnalysisJson(analysisJson, id);
  if (parsed.error || !parsed.analysis) {
    throw new Error(`[${id}] Failed to parse analysis.json: ${parsed.error || "invalid analysis"}`);
  }
  const analysis = parsed.analysis;

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

  // Load meta.json (with fallback to original.json)
  const originalData: OriginalData = await readMetaJson(sourceDir);

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
 * - meta.json (immutable metadata)
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

  // 1. Save meta.json (immutable metadata)
  const originalData: OriginalData = {
    id,
    schemaVersion: 1,
    source_url: meta.sourceUrl,
    created_at: createdAt,
    type: meta.type,
    original_file: originalFile,
    original_title: meta.title,
  };
  await fs.writeFile(
    path.join(sourceDir, "meta.json"),
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
  // First try direct path (root level)
  const directPath = path.join(libraryPath, id);
  if (await isEntryDirectory(directPath)) {
    const source = await loadSourceFromPath(directPath, id);
    // No folder for root level sources
    return source;
  }

  // Search recursively
  const sourcePath = await findEntryPath(id, libraryPath);
  if (!sourcePath) return null;

  const source = await loadSourceFromPath(sourcePath, id);
  if (source) {
    // Extract folder from path: /library/folder/id → folder
    const relativePath = path.relative(libraryPath, sourcePath);
    const folder = path.dirname(relativePath);
    source.meta.folder = folder !== "." ? folder : undefined;
  }
  return source;
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
      const foundPath = await findEntryPath(id, libraryPath);
      if (!foundPath) return false;
      sourceDir = foundPath;
    }

    // Load existing analysis
    const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
    const parsed = parseAnalysisJson(analysisJson, id);
    if (parsed.error || !parsed.analysis) {
      console.error(`[${id}] Failed to parse analysis.json: ${parsed.error || "invalid analysis"}`);
      return false;
    }
    const analysis = parsed.analysis;

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
  totalReadTimeSeconds?: number;
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
  const totalReadTimeStr = extractYamlValue(frontmatter, "totalReadTimeSeconds");
  const totalReadTimeSeconds = totalReadTimeStr ? parseInt(totalReadTimeStr, 10) : undefined;

  return { title, content: body.trim(), readStatus, lastReadAt, totalReadTimeSeconds };
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

      // Check if this directory is a source (has meta.json or original.json)
      if (await isEntryDirectory(fullPath)) {
        const summary = await loadSourceSummaryFromPath(fullPath, relativePath || undefined);
        if (summary) {
          summaries.push(summary);
        }
      } else {
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

async function loadSourceSummaryFromPath(
  sourceDir: string,
  folder?: string
): Promise<SourceSummary | null> {
  try {
    const originalData = await readMetaJson(sourceDir);
    const { status, error } = await getProcessingStatus(sourceDir);

    let title = originalData.original_title;
    let readStatus: "unread" | "read" | undefined;
    let lastReadAt: string | undefined;
    let totalReadTimeSeconds: number | undefined;
    try {
      const contentMd = await fs.readFile(path.join(sourceDir, "content.md"), "utf-8");
      const parsed = parseContentMd(contentMd);
      title = parsed.title;
      readStatus = parsed.readStatus;
      lastReadAt = parsed.lastReadAt;
      totalReadTimeSeconds = parsed.totalReadTimeSeconds;
    } catch {
      // Content may still be processing.
    }

    let score: number | undefined;
    let reason: string | undefined;
    let action: ActionType | undefined;
    let hasAnalysis = false;
    let hasConnections = false;
    let hasConnectionError = false;
    let analysisError: string | undefined;
    try {
      const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
      const raw = JSON.parse(analysisJson) as {
        triage?: {
          score?: unknown;
          reason?: unknown;
          action?: unknown;
        };
        connections?: unknown;
        connectionError?: unknown;
      };
      if (!raw.triage) {
        analysisError = "Invalid analysis.json schema";
      } else {
        hasAnalysis = true;
        score = typeof raw.triage.score === "number" ? raw.triage.score : undefined;
        reason = typeof raw.triage.reason === "string" ? raw.triage.reason : undefined;
        action = typeof raw.triage.action === "string" && raw.triage.action in ACTION_CONFIG
          ? raw.triage.action as ActionType
          : undefined;
        hasConnections = Array.isArray(raw.connections);
        hasConnectionError = typeof raw.connectionError === "string";
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        analysisError = `Invalid JSON in analysis.json: ${error.message}`;
      }
    }

    let processingStage: ProcessingStage | undefined;
    if (status === "failed") {
      processingStage = undefined;
    } else if (status === "processing") {
      processingStage = "extracting";
    } else if (!hasAnalysis && !analysisError) {
      processingStage = "analyzing";
    } else if (hasAnalysis && !hasConnections && !hasConnectionError) {
      const ageMs = Date.now() - new Date(originalData.created_at).getTime();
      processingStage = ageMs > 10 * 60 * 1000 ? "complete" : "connecting";
    } else {
      processingStage = "complete";
    }

    return {
      meta: {
        id: originalData.id,
        title,
        type: originalData.type,
        sourceUrl: originalData.source_url,
        createdAt: originalData.created_at,
        folder,
        processingStatus: status,
        processingStage,
        processingError: error,
        analysisError,
        readStatus,
        lastReadAt,
        totalReadTimeSeconds,
        saved: originalData.saved,
      },
      score,
      reason,
      action,
    };
  } catch (error) {
    console.error(`Failed to load source summary at ${sourceDir}:`, error);
    return null;
  }
}

/**
 * Source data for connection analysis
 */
export interface SourceForConnections {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  highlights: { text: string; type: string; reaction?: "star" | "dismiss"; reactionAt?: string }[];
  concepts: { term: string; definition: string; status?: "knew" | "learned"; statusAt?: string }[];
}

/**
 * Load sources with their analysis summaries for connection finding,
 * newest first. Returns minimal data needed for connections analysis.
 * Pass `limit` to bound agent prompt size — context otherwise grows
 * with the library and slows every feed/capture down.
 */
export async function listSourcesForConnections(
  excludeId?: string,
  libraryPath = getLibraryPath(),
  limit?: number
): Promise<SourceForConnections[]> {
  await ensureLibraryExists(libraryPath);
  const sources: SourceForConnections[] = [];

  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      if (await isEntryDirectory(fullPath)) {
        // It's a source directory
        if (entry.name === excludeId) continue;

        // Load analysis.json
        try {
          const analysisJson = await fs.readFile(path.join(fullPath, "analysis.json"), "utf-8");
          const parsed = parseAnalysisJson(analysisJson, entry.name);
          if (parsed.error || !parsed.analysis) {
            console.error(`[${entry.name}] Skipping analysis.json: ${parsed.error || "invalid analysis"}`);
            continue;
          }
          const analysis = parsed.analysis;

          // Load title from content.md
          let title = entry.name;
          let createdAt = "";
          try {
            const metaData = await readMetaJson(fullPath);
            createdAt = metaData.created_at || "";
            title = metaData.original_title || entry.name;
          } catch {
            // Keep entry.name as title
          }
          try {
            const contentMd = await fs.readFile(path.join(fullPath, "content.md"), "utf-8");
            const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
            if (titleMatch) title = titleMatch[1];
          } catch {
            // Keep meta.json/entry.name title
          }

          sources.push({
            id: entry.name,
            title,
            createdAt,
            summary: analysis.digest?.summary ?? "",
            highlights: (analysis.digest?.highlights ?? []).map((h) => ({
              text: h.text,
              type: h.type,
              reaction: h.reaction,
              reactionAt: h.reactionAt,
            })),
            concepts: (analysis.digest?.concepts ?? []).map((c) => ({
              term: c.term,
              definition: c.definition,
              status: c.status,
              statusAt: c.statusAt,
            })),
          });
        } catch {
          // No analysis.json - source still processing, skip
        }
      } else {
        // Not a source directory - recurse into it
        await scanDir(fullPath);
      }
    }
  }

  await scanDir(libraryPath);
  sources.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return limit ? sources.slice(0, limit) : sources;
}

/**
 * Load source from a specific directory path
 * Reads meta.json for metadata and content.md for processed content
 */
async function loadSourceFromPath(
  sourceDir: string,
  id: string
): Promise<Source | null> {
  try {
    // Read meta.json (with fallback to original.json)
    const originalData: OriginalData = await readMetaJson(sourceDir);

    // Get processing status from file existence
    const { status, error } = await getProcessingStatus(sourceDir);

    // Read content.md if it exists
    let title = originalData.original_title;
    let content = "";
    let readStatus: "unread" | "read" | undefined;
    let lastReadAt: string | undefined;
    let totalReadTimeSeconds: number | undefined;
    try {
      const contentMd = await fs.readFile(path.join(sourceDir, "content.md"), "utf-8");
      const parsed = parseContentMd(contentMd);
      title = parsed.title;
      content = parsed.content;
      readStatus = parsed.readStatus;
      lastReadAt = parsed.lastReadAt;
      totalReadTimeSeconds = parsed.totalReadTimeSeconds;
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
    let analysisError: string | undefined;
    try {
      const analysisJson = await fs.readFile(path.join(sourceDir, "analysis.json"), "utf-8");
      const parsed = parseAnalysisJson(analysisJson, id);
      if (parsed.error) {
        analysisError = parsed.error;
        console.error(`[${id}] ${analysisError}`);
      } else {
        analysis = parsed.analysis;
      }

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
      // File doesn't exist - analysis not ready yet (normal during processing)
    }

    // Compute granular processing stage
    let processingStage: import("@/lib/types").ProcessingStage | undefined;
    if (status === "failed") {
      processingStage = undefined;
    } else if (status === "processing") {
      processingStage = "extracting";
    } else if (!analysis && !analysisError) {
      processingStage = "analyzing";
    } else if (analysis && analysis.connections === undefined && !analysis.connectionError) {
      const ageMs = Date.now() - new Date(originalData.created_at).getTime();
      if (ageMs > 10 * 60 * 1000) {
        analysis.connectionError = "Connection analysis interrupted";
        processingStage = "complete";
      } else {
        processingStage = "connecting";
      }
    } else {
      processingStage = "complete";
    }

    const meta: SourceMeta = {
      id: originalData.id,
      title,
      type: originalData.type,
      sourceUrl: originalData.source_url,
      createdAt: originalData.created_at,
      processingStatus: status,
      processingStage,
      processingError: error,
      analysisError,
      readStatus,
      lastReadAt,
      totalReadTimeSeconds,
      saved: originalData.saved,
    };

    return { meta, originalContent, content, analysis };
  } catch {
    return null;
  }
}

/**
 * Update source content (title and/or body)
 * Only modifies content.md (derived data), never touches meta.json
 */
export async function updateSourceContent(
  id: string,
  updates: { title?: string; content?: string },
  libraryPath = getLibraryPath()
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find source directory
    let sourceDir = path.join(libraryPath, id);
    if (!await isEntryDirectory(sourceDir)) {
      // Not at direct path, search recursively
      const foundPath = await findEntryPath(id, libraryPath);
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
      // content.md doesn't exist yet, use meta.json title
      const originalData = await readMetaJson(sourceDir);
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

      // Check if this is a source directory (has meta.json or original.json)
      if (await isEntryDirectory(fullPath)) {
        // It's a source, not a folder - skip
      } else {
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
 * Find the full path to an entry by its ID (searches recursively)
 * @param id - Entry ID to find
 * @param basePath - Base directory to search in
 * @param markerFile - File that identifies a valid entry (e.g., "meta.json")
 */
export async function findEntryPath(
  id: string,
  basePath = getLibraryPath(),
  markerFile = "meta.json"
): Promise<string | null> {
  async function searchDir(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      // Check if this is the entry we're looking for
      if (entry.name === id) {
        try {
          await fs.access(path.join(fullPath, markerFile));
          return fullPath;
        } catch {
          // Not a valid entry, continue
        }
      }

      // Recurse into subdirectories
      const found = await searchDir(fullPath);
      if (found) return found;
    }

    return null;
  }

  return searchDir(basePath);
}

/**
 * Get a source's title by ID (for resolving connection titles)
 */
async function getSourceTitle(
  id: string,
  libraryPath = getLibraryPath()
): Promise<string | null> {
  const sourcePath = await findEntryPath(id, libraryPath);
  if (!sourcePath) return null;

  // Try to get title from content.md first
  try {
    const contentMd = await fs.readFile(path.join(sourcePath, "content.md"), "utf-8");
    const titleMatch = contentMd.match(/^---\n[\s\S]*?title:\s*"([^"]+)"[\s\S]*?\n---/);
    if (titleMatch) return titleMatch[1];
  } catch {
    // No content.md
  }

  // Fall back to meta.json (with original.json fallback)
  try {
    const metaData = await readMetaJson(sourcePath);
    return metaData.original_title || null;
  } catch {
    return null;
  }
}

/**
 * Move an entry to a new folder
 * @param id - Entry ID to move
 * @param targetFolder - Target folder path (relative to basePath), empty string for root
 * @param basePath - Base directory to search in
 * @param markerFile - File that identifies a valid entry
 */
export async function moveEntry(
  id: string,
  targetFolder: string,
  basePath = getLibraryPath(),
  markerFile = "meta.json"
): Promise<boolean> {
  const entryPath = await findEntryPath(id, basePath, markerFile);
  if (!entryPath) return false;

  const targetDir = targetFolder
    ? path.join(basePath, targetFolder, id)
    : path.join(basePath, id);

  // Don't move if already in target location
  if (entryPath === targetDir) return true;

  // Ensure target parent directory exists
  const targetParent = path.dirname(targetDir);
  await fs.mkdir(targetParent, { recursive: true });

  // Move the directory
  await fs.rename(entryPath, targetDir);
  return true;
}

// Alias for backwards compatibility
export const moveSource = moveEntry;

/**
 * Delete an entry by ID
 * @param id - Entry ID to delete
 * @param basePath - Base directory to search in
 * @param markerFile - File that identifies a valid entry
 * @param cleanupConnections - Whether to clean up connections (only for library sources)
 */
export async function deleteEntry(
  id: string,
  basePath = getLibraryPath(),
  markerFile = "meta.json",
  cleanupConnections = true
): Promise<boolean> {
  const entryPath = await findEntryPath(id, basePath, markerFile);
  if (!entryPath) return false;

  // Security check: ensure path is within base path
  const resolvedPath = path.resolve(entryPath);
  const resolvedBase = path.resolve(basePath);
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error("Security error: path is outside allowed directory");
  }

  // Clean up connections in other sources that reference this entry (library sources only)
  if (cleanupConnections && markerFile === "meta.json") {
    await removeConnectionsToSource(id, basePath);
  }

  await fs.rm(entryPath, { recursive: true });
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

      // Check if this is a source directory (has meta.json or original.json)
      if (await isEntryDirectory(fullPath)) {
        // Skip the source being deleted
        if (entry.name === deletedSourceId) continue;

        // Check if this source has an analysis.json
        try {
          const analysisPath = path.join(fullPath, "analysis.json");
          const analysisJson = await fs.readFile(analysisPath, "utf-8");
          const parsed = parseAnalysisJson(analysisJson, entry.name);
          if (parsed.error || !parsed.analysis) {
            console.error(`[${entry.name}] Skipping analysis.json: ${parsed.error || "invalid analysis"}`);
            continue;
          }
          const analysis = parsed.analysis;

          if (analysis.connections && analysis.connections.length > 0) {
            // Filter out connections that reference the deleted source
            const filteredConnections = analysis.connections.filter(
              (conn) => !conn.relatedSourceIds.includes(deletedSourceId)
            );

            // Only update if we removed something
            if (filteredConnections.length < analysis.connections.length) {
              analysis.connections = filteredConnections;
              await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2), "utf-8");
              debugLog(`Cleaned up connections in source ${entry.name}`);
            }
          }
        } catch {
          // No analysis.json, skip
        }
      } else {
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
// Profile Document Functions (USER.md, MEMORY.md)
// =============================================================================

// USER.md is user-written (agent read-only); MEMORY.md is agent-maintained
type ProfileDocName = "USER" | "MEMORY";

/**
 * Load a profile document from root
 */
export async function loadProfileDoc(name: ProfileDocName): Promise<string> {
  try {
    const filePath = path.join(getRootPath(), `${name}.md`);
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Save a profile document to root
 */
export async function saveProfileDoc(name: ProfileDocName, content: string): Promise<void> {
  const rootPath = getRootPath();
  await fs.mkdir(rootPath, { recursive: true });
  const filePath = path.join(rootPath, `${name}.md`);
  await fs.writeFile(filePath, content, "utf-8");
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
 * Save feed cache to disk (also saves a dated snapshot)
 */
export async function saveFeedCache(cache: FeedCache): Promise<void> {
  const feedDir = getFeedPath();
  await fs.mkdir(feedDir, { recursive: true });
  const cachePath = path.join(feedDir, "cache.json");
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
  await saveFeedSnapshot(cache);
}

// =============================================================================
// Feed Snapshot Functions (browse past 7 days)
// =============================================================================

/**
 * Save a feed snapshot keyed by timestamp.
 * Filename: YYYY-MM-DDTHH-MM.json (colons replaced for filesystem safety)
 * Prunes snapshots older than 7 days.
 */
async function saveFeedSnapshot(cache: FeedCache): Promise<void> {
  const snapshotsDir = path.join(getFeedPath(), "snapshots");
  await fs.mkdir(snapshotsDir, { recursive: true });

  // e.g. "2026-02-10T14:30:00.000Z" → "2026-02-10T14-30"
  const key = snapshotKeyFromISO(cache.generatedAt);
  const snapshotPath = path.join(snapshotsDir, `${key}.json`);
  await fs.writeFile(snapshotPath, JSON.stringify(cache, null, 2), "utf-8");

  // Prune old snapshots
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    const files = await fs.readdir(snapshotsDir);
    for (const file of files) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2})\.json$/);
      if (match) {
        const iso = match[1].replace(/T(\d{2})-(\d{2})/, "T$1:$2");
        if (new Date(iso).getTime() < cutoff) {
          await fs.unlink(path.join(snapshotsDir, file));
        }
      }
      // Also clean up old date-only format (YYYY-MM-DD.json)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (dateMatch && new Date(dateMatch[1]).getTime() < cutoff) {
        await fs.unlink(path.join(snapshotsDir, file));
      }
    }
  } catch {
    // Ignore pruning errors
  }
}

/** Convert ISO timestamp to filesystem-safe snapshot key */
function snapshotKeyFromISO(iso: string): string {
  // "2026-02-10T14:30:05.000Z" → "2026-02-10T14-30"
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}-${min}`;
}

/**
 * List available snapshot keys (newest first).
 * Each key is like "2026-02-10T14-30".
 */
export async function listFeedSnapshots(): Promise<string[]> {
  const snapshotsDir = path.join(getFeedPath(), "snapshots");
  try {
    const files = await fs.readdir(snapshotsDir);
    const keys = files
      .map((f) => f.match(/^(.+)\.json$/)?.[1])
      .filter((k): k is string => !!k);
    keys.sort((a, b) => b.localeCompare(a)); // newest first
    return keys;
  } catch {
    return [];
  }
}

/**
 * Load a specific snapshot by key
 */
export async function loadFeedSnapshot(key: string): Promise<FeedCache | null> {
  try {
    const snapshotPath = path.join(getFeedPath(), "snapshots", `${key}.json`);
    const content = await fs.readFile(snapshotPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// =============================================================================
// Feed History Functions (dedup)
// =============================================================================

interface FeedHistoryEntry {
  url: string;
  seenAt: string;
}

interface FeedHistory {
  seen: FeedHistoryEntry[];
  readTexts?: string[];
}

/**
 * Load feed history from disk
 */
export async function loadFeedHistory(): Promise<FeedHistory> {
  try {
    const historyPath = path.join(getFeedPath(), "history.json");
    const content = await fs.readFile(historyPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { seen: [] };
  }
}

/**
 * Save feed history to disk
 */
async function saveFeedHistory(history: FeedHistory): Promise<void> {
  const feedDir = getFeedPath();
  await fs.mkdir(feedDir, { recursive: true });
  const historyPath = path.join(feedDir, "history.json");
  await fs.writeFile(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

/**
 * Mark feed item URLs as seen
 */
export async function markFeedItemsSeen(urls: string[], text?: string): Promise<void> {
  const history = await loadFeedHistory();
  const existingUrls = new Set(history.seen.map((e) => e.url));
  const now = new Date().toISOString();

  for (const url of urls) {
    if (!existingUrls.has(url)) {
      history.seen.push({ url, seenAt: now });
    }
  }

  // Track read briefing text
  if (text) {
    if (!history.readTexts) history.readTexts = [];
    if (!history.readTexts.includes(text)) {
      history.readTexts.push(text);
    }
  }

  // Prune entries older than 7 days
  pruneFeedHistory(history);
  await saveFeedHistory(history);
}

/**
 * Remove feed item URLs from seen list
 */
export async function unmarkFeedItemsSeen(urls: string[], text?: string): Promise<void> {
  const history = await loadFeedHistory();
  const removeSet = new Set(urls);
  history.seen = history.seen.filter((e) => !removeSet.has(e.url));

  // Remove read briefing text
  if (text && history.readTexts) {
    history.readTexts = history.readTexts.filter(t => t !== text);
  }

  await saveFeedHistory(history);
}

/**
 * Prune feed history entries older than 7 days (mutates in place)
 */
function pruneFeedHistory(history: FeedHistory): void {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  history.seen = history.seen.filter(
    (e) => new Date(e.seenAt).getTime() > cutoff
  );
}

// =============================================================================
// Starred Briefing Items
// =============================================================================

export interface StarredBriefingRef {
  url: string;
  title: string;
}

export interface StarredBriefingItem {
  text: string;                  // Raw briefing text (with markdown)
  starredAt: string;             // ISO timestamp
  feedDate?: string;             // When the feed was generated
  refs?: StarredBriefingRef[];   // Referenced feed items
}

interface StarredBriefings {
  items: StarredBriefingItem[];
}

export async function loadStarredBriefings(): Promise<StarredBriefings> {
  try {
    const filePath = path.join(getFeedPath(), "starred.json");
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { items: [] };
  }
}

async function saveStarredBriefings(data: StarredBriefings): Promise<void> {
  const feedDir = getFeedPath();
  await fs.mkdir(feedDir, { recursive: true });
  await fs.writeFile(path.join(feedDir, "starred.json"), JSON.stringify(data, null, 2));
}

export async function starBriefingItem(
  text: string,
  meta?: { feedDate?: string; refs?: StarredBriefingRef[] }
): Promise<void> {
  const data = await loadStarredBriefings();
  // Avoid duplicates
  if (data.items.some(i => i.text === text)) return;
  data.items.push({
    text,
    starredAt: new Date().toISOString(),
    feedDate: meta?.feedDate,
    refs: meta?.refs,
  });
  await saveStarredBriefings(data);
}

export async function unstarBriefingItem(text: string): Promise<void> {
  const data = await loadStarredBriefings();
  data.items = data.items.filter(i => i.text !== text);
  await saveStarredBriefings(data);
}

// =============================================================================
// Agent Conversation Functions
// =============================================================================

/**
 * Get agent conversations directory path
 */
function getAgentPath(): string {
  return path.join(getRootPath(), ".agent", "conversations");
}

/**
 * List all conversations (summaries only)
 */
export async function listConversations(): Promise<AgentConversationSummary[]> {
  const agentDir = getAgentPath();
  try {
    await fs.mkdir(agentDir, { recursive: true });
    const files = await fs.readdir(agentDir);
    const summaries: AgentConversationSummary[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(agentDir, file), "utf-8");
        const conv: AgentConversation = JSON.parse(content);
        const firstUserMsg = conv.messages.find((m) => m.role === "user");
        summaries.push({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: conv.messages.length,
          preview: firstUserMsg?.content.slice(0, 100) || "",
        });
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return summaries;
  } catch {
    return [];
  }
}

/**
 * Load a conversation by ID
 */
export async function loadConversation(id: string): Promise<AgentConversation | null> {
  try {
    const filePath = path.join(getAgentPath(), `${id}.json`);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Save a conversation (create or update)
 */
export async function saveConversation(conversation: AgentConversation): Promise<void> {
  const agentDir = getAgentPath();
  await fs.mkdir(agentDir, { recursive: true });
  const filePath = path.join(agentDir, `${conversation.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(conversation, null, 2), "utf-8");
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    const filePath = path.join(getAgentPath(), `${id}.json`);
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Notebook Storage Functions
// ============================================================================

/**
 * Ensure notebook directory exists
 */
export async function ensureNotebookExists(notebookPath = getNotebookPath()): Promise<void> {
  await fs.mkdir(notebookPath, { recursive: true });
}

/**
 * List all documents in notebook
 */
export async function listNotebookDocuments(notebookPath = getNotebookPath()): Promise<NotebookDocument[]> {
  await ensureNotebookExists(notebookPath);
  const documents: NotebookDocument[] = [];

  async function scanDir(dir: string, relativePath: string = "") {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      // Check if this is a document directory (has meta.json)
      try {
        const metaPath = path.join(fullPath, "meta.json");
        const metaContent = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(metaContent) as NotebookDocument;
        meta.folder = relativePath || undefined;
        documents.push(meta);
      } catch {
        // Not a document, might be a folder - recurse
        const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;
        await scanDir(fullPath, entryRelativePath);
      }
    }
  }

  await scanDir(notebookPath);
  return documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * List all folders in notebook
 */
export async function listNotebookFolders(notebookPath = getNotebookPath()): Promise<string[]> {
  await ensureNotebookExists(notebookPath);
  const folders: string[] = [];

  async function scanDir(dir: string, relativePath: string = "") {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      // Check if this is a document directory (has meta.json)
      try {
        await fs.access(path.join(fullPath, "meta.json"));
        // It's a document, not a folder - skip
      } catch {
        // It's a folder
        folders.push(entryRelativePath);
        await scanDir(fullPath, entryRelativePath);
      }
    }
  }

  await scanDir(notebookPath);
  return folders.sort();
}

/**
 * Load a document by ID
 */
export async function loadNotebookDocument(id: string): Promise<{ meta: NotebookDocument; content: string } | null> {
  const docPath = await findEntryPath(id, getNotebookPath(), "meta.json");
  if (!docPath) return null;

  try {
    const metaContent = await fs.readFile(path.join(docPath, "meta.json"), "utf-8");
    const meta = JSON.parse(metaContent) as NotebookDocument;
    
    const outputPath = path.join(docPath, meta.output);
    let content = "";
    
    // Only read content if it's a text-based format
    if (meta.output.endsWith(".md") || meta.output.endsWith(".txt") || meta.output.endsWith(".html")) {
      try {
        content = await fs.readFile(outputPath, "utf-8");
      } catch {
        // Output file doesn't exist yet
      }
    }

    return { meta, content };
  } catch {
    return null;
  }
}

/**
 * Get the output file path for a document
 */
export async function getDocumentOutputPath(id: string): Promise<string | null> {
  const docPath = await findEntryPath(id, getNotebookPath(), "meta.json");
  if (!docPath) return null;

  try {
    const metaContent = await fs.readFile(path.join(docPath, "meta.json"), "utf-8");
    const meta = JSON.parse(metaContent) as NotebookDocument;
    return path.join(docPath, meta.output);
  } catch {
    return null;
  }
}

/**
 * Update notebook document content (title and/or body)
 */
export async function updateNotebookDocument(
  id: string,
  updates: { title?: string; content?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const notebookPath = getNotebookPath();
    const docPath = await findEntryPath(id, notebookPath, "meta.json");
    if (!docPath) {
      return { success: false, error: "Document not found" };
    }

    const metaPath = path.join(docPath, "meta.json");
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(metaContent) as NotebookDocument;

    // Update title in meta.json if provided
    if (updates.title !== undefined && updates.title !== meta.title) {
      meta.title = updates.title;
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
    }

    // Update content if provided (only for text-based formats)
    if (updates.content !== undefined) {
      const outputPath = path.join(docPath, meta.output);
      if (meta.output.endsWith(".md") || meta.output.endsWith(".txt") || meta.output.endsWith(".html")) {
        await fs.writeFile(outputPath, updates.content, "utf-8");
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * List all user interaction events across the library for the History timeline.
 * Scans each source's analysis.json + meta.json for timestamped interactions.
 */
export async function listInteractionHistory(
  libraryPath = getLibraryPath()
): Promise<HistoryEvent[]> {
  await ensureLibraryExists(libraryPath);
  const events: HistoryEvent[] = [];

  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);

      if (await isEntryDirectory(fullPath)) {
        const sourceId = entry.name;

        // Load meta.json for created_at and lastReadAt
        let metaData: OriginalData | null = null;
        try {
          metaData = await readMetaJson(fullPath);
        } catch {
          continue; // No meta = skip
        }

        // Load title and lastReadAt from content.md, fallback to meta.json
        let title = sourceId;
        let lastReadAt: string | undefined;
        try {
          const contentMd = await fs.readFile(path.join(fullPath, "content.md"), "utf-8");
          const parsed = parseContentMd(contentMd);
          title = parsed.title;
          lastReadAt = parsed.lastReadAt;
        } catch {
          title = metaData?.original_title || sourceId;
        }

        // Always emit "added" event from meta.json created_at
        if (metaData?.created_at) {
          events.push({
            id: `${sourceId}-added`,
            type: "added",
            timestamp: metaData.created_at,
            sourceId,
            sourceTitle: title,
          });
        }

        // Load analysis.json for interaction events
        let analysis: Analysis | null = null;
        try {
          const analysisJson = await fs.readFile(path.join(fullPath, "analysis.json"), "utf-8");
          const parsed = parseAnalysisJson(analysisJson, sourceId);
          if (!parsed.error && parsed.analysis) {
            analysis = parsed.analysis;
          }
        } catch {
          // No analysis = no interaction events, but "added" already emitted
        }

        // Extract interaction events (only if analysis exists)
        if (analysis) {
          if (analysis.userRatingAt) {
            events.push({
              id: `${sourceId}-rating`,
              type: "rating",
              timestamp: analysis.userRatingAt,
              sourceId,
              sourceTitle: title,
              rating: analysis.userRating,
            });
          }

          for (const h of analysis.digest?.highlights ?? []) {
            if (h.reactionAt && h.reaction) {
              events.push({
                id: `${sourceId}-${h.id}`,
                type: h.reaction === "star" ? "star" : "dismiss",
                timestamp: h.reactionAt,
                sourceId,
                sourceTitle: title,
                highlightText: h.text,
              });
            }
          }

          for (const c of analysis.digest?.concepts ?? []) {
            if (c.statusAt && c.status) {
              events.push({
                id: `${sourceId}-${c.id}`,
                type: c.status,
                timestamp: c.statusAt,
                sourceId,
                sourceTitle: title,
                conceptTerm: c.term,
                conceptDefinition: c.definition,
              });
            }
          }
        }

        if (lastReadAt) {
          events.push({
            id: `${sourceId}-read`,
            type: "read",
            timestamp: lastReadAt,
            sourceId,
            sourceTitle: title,
          });
        }
      } else {
        await scanDir(fullPath);
      }
    }
  }

  await scanDir(libraryPath);

  // Include starred briefing items
  const starred = await loadStarredBriefings();
  for (const item of starred.items) {
    events.push({
      id: `briefing-${item.starredAt}`,
      type: "briefing_star",
      timestamp: item.starredAt,
      sourceId: "",
      sourceTitle: "Feed Briefing",
      briefingText: item.text,
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}
