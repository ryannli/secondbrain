import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sampleRoot = path.join(repoRoot, "sample_data");
const targetRoot = process.env.SECONDBRAIN_ROOT || path.join(repoRoot, "user_data");

async function exists(filePath) {
  try {
    await fs.lstat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyMissing(src, dest, stats) {
  const stat = await fs.lstat(src);

  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      await copyMissing(path.join(src, entry), path.join(dest, entry), stats);
    }
    return;
  }

  if (await exists(dest)) {
    stats.skipped += 1;
    return;
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(src);
    try {
      await fs.symlink(target, dest);
      stats.copied += 1;
    } catch {
      await copyMissing(path.resolve(path.dirname(src), target), dest, stats);
    }
    return;
  }

  await fs.copyFile(src, dest);
  stats.copied += 1;
}

const stats = { copied: 0, skipped: 0 };
await copyMissing(sampleRoot, targetRoot, stats);

console.log(`Imported sample data into ${targetRoot}`);
console.log(`Copied ${stats.copied} files, skipped ${stats.skipped} existing files.`);
