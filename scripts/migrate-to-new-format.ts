/**
 * Migration script: source.md -> original.json + content.md
 *
 * This script migrates existing sources from the old format (source.md)
 * to the new format (original.json + content.md).
 *
 * Run with: npx tsx scripts/migrate-to-new-format.ts
 */

import { promises as fs } from "fs";
import path from "path";

const LIBRARY_PATH = process.env.SECONDBRAIN_LIBRARY ||
  path.join(process.cwd(), "user_data", "library");

interface OldMeta {
  title: string;
  type: string;
  source_url?: string;
  created_at: string;
  processing_status?: string;
  processing_error?: string;
}

interface OriginalData {
  id: string;
  source_url?: string;
  created_at: string;
  type: string;
  original_title: string;
}

function extractYamlValue(yaml: string, key: string): string | undefined {
  const match = yaml.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, "m"));
  return match ? match[1] : undefined;
}

function parseSourceMd(fileContent: string): { meta: OldMeta; content: string } {
  const frontmatterMatch = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return {
      meta: {
        title: "Untitled",
        type: "note",
        created_at: new Date().toISOString(),
      },
      content: fileContent,
    };
  }

  const frontmatter = frontmatterMatch[1];
  const body = frontmatterMatch[2];

  const meta: OldMeta = {
    title: extractYamlValue(frontmatter, "title") || "Untitled",
    type: extractYamlValue(frontmatter, "type") || "note",
    source_url: extractYamlValue(frontmatter, "source_url"),
    created_at: extractYamlValue(frontmatter, "created_at") || new Date().toISOString(),
    processing_status: extractYamlValue(frontmatter, "processing_status"),
    processing_error: extractYamlValue(frontmatter, "processing_error"),
  };

  // Extract content from HTML comment markers
  let contentMatch = body.match(/<!-- PROCESSED_CONTENT_START -->\n([\s\S]*?)\n<!-- PROCESSED_CONTENT_END -->/);

  // Fallback to old format
  if (!contentMatch) {
    const oldContentMatch = body.match(/## Content\n\n([\s\S]*)$/);
    if (oldContentMatch) {
      contentMatch = oldContentMatch;
    }
  }

  const content = contentMatch ? contentMatch[1].trim() : body.trim();

  return { meta, content };
}

async function migrateSource(sourceDir: string, id: string): Promise<void> {
  const sourceMdPath = path.join(sourceDir, "source.md");
  const originalJsonPath = path.join(sourceDir, "original.json");
  const contentMdPath = path.join(sourceDir, "content.md");
  const errorTxtPath = path.join(sourceDir, "error.txt");

  // Check if already migrated
  try {
    await fs.access(originalJsonPath);
    console.log(`  [SKIP] ${id}: already migrated (original.json exists)`);
    return;
  } catch {
    // Not migrated yet, continue
  }

  // Check if source.md exists
  try {
    await fs.access(sourceMdPath);
  } catch {
    console.log(`  [SKIP] ${id}: no source.md found`);
    return;
  }

  // Read and parse source.md
  const sourceMd = await fs.readFile(sourceMdPath, "utf-8");
  const { meta, content } = parseSourceMd(sourceMd);

  // Create original.json
  const originalData: OriginalData = {
    id,
    source_url: meta.source_url,
    created_at: meta.created_at,
    type: meta.type,
    original_title: meta.title,
  };
  await fs.writeFile(originalJsonPath, JSON.stringify(originalData, null, 2), "utf-8");

  // Handle different processing states
  if (meta.processing_status === "failed" && meta.processing_error) {
    // Create error.txt for failed sources
    await fs.writeFile(errorTxtPath, meta.processing_error, "utf-8");
    console.log(`  [MIGRATED] ${id}: failed source`);
  } else if (meta.processing_status === "processing") {
    // Processing sources: only original.json, no content.md
    console.log(`  [MIGRATED] ${id}: processing source`);
  } else {
    // Ready sources: create content.md
    const contentMd = `---
title: "${meta.title.replace(/"/g, '\\"')}"
---

${content}
`;
    await fs.writeFile(contentMdPath, contentMd, "utf-8");
    console.log(`  [MIGRATED] ${id}: ready source`);
  }

  // Keep source.md as backup (rename to source.md.backup)
  await fs.rename(sourceMdPath, path.join(sourceDir, "source.md.backup"));
}

async function scanAndMigrate(dir: string): Promise<number> {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);

    // Check if this is a source directory (has source.md)
    try {
      await fs.access(path.join(fullPath, "source.md"));
      // It's a source directory - migrate it
      await migrateSource(fullPath, entry.name);
      count++;
    } catch {
      // Not a source directory, recurse into it
      count += await scanAndMigrate(fullPath);
    }
  }

  return count;
}

async function main() {
  console.log(`Migrating sources in: ${LIBRARY_PATH}`);
  console.log("");

  try {
    await fs.access(LIBRARY_PATH);
  } catch {
    console.error(`Library path not found: ${LIBRARY_PATH}`);
    process.exit(1);
  }

  const count = await scanAndMigrate(LIBRARY_PATH);
  console.log("");
  console.log(`Migration complete. Processed ${count} sources.`);
  console.log("Backup files created as source.md.backup");
}

main().catch(console.error);
