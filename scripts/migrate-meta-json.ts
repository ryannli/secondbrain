/**
 * Migration script: Rename all original.json to meta.json
 *
 * Run with: npx ts-node scripts/migrate-meta-json.ts
 */

import { promises as fs } from "fs";
import path from "path";

const ROOT_PATH = process.env.SECONDBRAIN_ROOT || path.join(process.cwd(), "user_data");
const LIBRARY_PATH = process.env.SECONDBRAIN_LIBRARY || path.join(ROOT_PATH, "library");

async function migrateDirectory(dir: string): Promise<number> {
  let count = 0;

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);
    const originalJsonPath = path.join(fullPath, "original.json");
    const metaJsonPath = path.join(fullPath, "meta.json");

    // Check if original.json exists but meta.json doesn't
    try {
      await fs.access(originalJsonPath);

      // Check if meta.json already exists
      try {
        await fs.access(metaJsonPath);
        console.log(`  [SKIP] ${fullPath} - meta.json already exists`);
      } catch {
        // Rename original.json to meta.json
        await fs.rename(originalJsonPath, metaJsonPath);
        console.log(`  [MIGRATED] ${fullPath}`);
        count++;
      }
    } catch {
      // No original.json, might be a folder - recurse
      count += await migrateDirectory(fullPath);
    }
  }

  return count;
}

async function main() {
  console.log("=== Migrating original.json to meta.json ===\n");
  console.log(`Library path: ${LIBRARY_PATH}\n`);

  try {
    await fs.access(LIBRARY_PATH);
  } catch {
    console.log("Library directory does not exist. Nothing to migrate.");
    return;
  }

  const count = await migrateDirectory(LIBRARY_PATH);

  console.log(`\n=== Migration complete: ${count} files migrated ===`);
}

main().catch(console.error);
