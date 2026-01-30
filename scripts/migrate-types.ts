/**
 * Migration script: Update original.json files with new type system
 *
 * Changes:
 * - type: "article" | "youtube" | "twitter" | "podcast" → "html"
 * - type: "pdf" → "document"
 * - type: "note" → "text"
 * - Adds original_file field based on existing files
 *
 * Usage: npx tsx scripts/migrate-types.ts
 */

import { promises as fs } from "fs";
import path from "path";

const LIBRARY_PATH = process.env.SECONDBRAIN_LIBRARY || path.join(process.cwd(), "user_data/library");

// Type mapping: old type → new type
const TYPE_MAPPING: Record<string, string> = {
  article: "html",
  youtube: "html",
  twitter: "html",
  podcast: "html",
  pdf: "document",
  note: "text",
};

interface OldOriginalData {
  id: string;
  source_url?: string;
  created_at: string;
  type: string;
  original_title: string;
}

interface NewOriginalData extends OldOriginalData {
  type: "html" | "text" | "document" | "image";
  original_file: string;
}

async function findOriginalFile(sourceDir: string): Promise<string | null> {
  const possibleFiles = [
    "original.html",
    "original.txt",
    "original.pdf",
    "original.png",
    "original.jpg",
    "original.jpeg",
    "original.gif",
    "original.webp",
  ];

  for (const file of possibleFiles) {
    try {
      await fs.access(path.join(sourceDir, file));
      return file;
    } catch {
      // File doesn't exist, continue
    }
  }

  return null;
}

async function migrateSource(sourceDir: string): Promise<boolean> {
  const originalJsonPath = path.join(sourceDir, "original.json");

  try {
    const content = await fs.readFile(originalJsonPath, "utf-8");
    const data: OldOriginalData = JSON.parse(content);

    // Check if already migrated (has original_file)
    if ("original_file" in data) {
      console.log(`  [SKIP] ${data.id}: Already migrated`);
      return false;
    }

    // Map old type to new type
    const oldType = data.type;
    const newType = TYPE_MAPPING[oldType] || oldType;

    // Find the original file
    const originalFile = await findOriginalFile(sourceDir);

    if (!originalFile) {
      console.log(`  [WARN] ${data.id}: No original file found, using default`);
    }

    // Determine default original_file based on new type
    let defaultFile: string;
    switch (newType) {
      case "html":
        defaultFile = "original.html";
        break;
      case "text":
        defaultFile = "original.txt";
        break;
      case "document":
        defaultFile = "original.pdf";
        break;
      case "image":
        defaultFile = "original.png";
        break;
      default:
        defaultFile = "original.txt";
    }

    const newData: NewOriginalData = {
      ...data,
      type: newType as NewOriginalData["type"],
      original_file: originalFile || defaultFile,
    };

    // Write updated data
    await fs.writeFile(originalJsonPath, JSON.stringify(newData, null, 2), "utf-8");
    console.log(`  [OK] ${data.id}: ${oldType} → ${newType}, file: ${newData.original_file}`);
    return true;
  } catch (error) {
    console.error(`  [ERR] ${sourceDir}: ${error}`);
    return false;
  }
}

async function scanAndMigrate(dir: string): Promise<{ migrated: number; skipped: number; errors: number }> {
  const stats = { migrated: 0, skipped: 0, errors: 0 };

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const fullPath = path.join(dir, entry.name);
      const originalJsonPath = path.join(fullPath, "original.json");

      try {
        await fs.access(originalJsonPath);
        // This is a source directory
        const result = await migrateSource(fullPath);
        if (result) {
          stats.migrated++;
        } else {
          stats.skipped++;
        }
      } catch {
        // Not a source directory, recurse
        const subStats = await scanAndMigrate(fullPath);
        stats.migrated += subStats.migrated;
        stats.skipped += subStats.skipped;
        stats.errors += subStats.errors;
      }
    }
  } catch (error) {
    console.error(`Error scanning ${dir}: ${error}`);
    stats.errors++;
  }

  return stats;
}

async function main() {
  console.log("=== Type System Migration ===");
  console.log(`Library path: ${LIBRARY_PATH}\n`);

  try {
    await fs.access(LIBRARY_PATH);
  } catch {
    console.log("Library directory does not exist. Nothing to migrate.");
    return;
  }

  const stats = await scanAndMigrate(LIBRARY_PATH);

  console.log("\n=== Migration Complete ===");
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped (already migrated): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
}

main().catch(console.error);
