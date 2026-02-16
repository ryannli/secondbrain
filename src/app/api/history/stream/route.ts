import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentRootPath, getLibraryPath, listSourcesForConnections, findEntryPath } from "@/lib/storage";
import { extractTopicStream, InterestStreamData } from "@/lib/claude";

interface StreamCache {
  generatedAt: string;
  sourceCount: number;
  latestSourceDate: string;
  result: InterestStreamData;
}

function getCachePath(): string {
  return path.join(getCurrentRootPath(), ".cache", "interest-stream.json");
}

async function loadCache(): Promise<StreamCache | null> {
  try {
    const raw = await fs.readFile(getCachePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCache(cache: StreamCache): Promise<void> {
  const dir = path.dirname(getCachePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getCachePath(), JSON.stringify(cache, null, 2), "utf-8");
}

/**
 * GET /api/history/stream
 * Returns topic stream data for the Brain Waves visualization.
 * Uses cache invalidated by source count change or newer source.
 */
export async function GET() {
  try {
    const sources = await listSourcesForConnections();
    const sourceCount = sources.length;

    if (sourceCount < 3) {
      return NextResponse.json({
        success: true,
        result: { topics: [], colors: [], weeks: [], data: [] },
      });
    }

    // Find latest source date for cache invalidation
    let latestSourceDate = "";
    const libraryPath = getLibraryPath();
    for (const s of sources) {
      try {
        let metaPath = path.join(libraryPath, s.id, "meta.json");
        try {
          await fs.access(metaPath);
        } catch {
          const entryPath = await findEntryPath(s.id, libraryPath);
          if (entryPath) metaPath = path.join(entryPath, "meta.json");
        }
        const raw = await fs.readFile(metaPath, "utf-8");
        const meta = JSON.parse(raw);
        if (meta.created_at && meta.created_at > latestSourceDate) {
          latestSourceDate = meta.created_at;
        }
      } catch {
        // Skip
      }
    }

    // Check cache
    const cache = await loadCache();
    if (
      cache &&
      cache.sourceCount === sourceCount &&
      cache.latestSourceDate === latestSourceDate
    ) {
      return NextResponse.json({ success: true, result: cache.result });
    }

    // Cache stale — regenerate
    const result = await extractTopicStream();

    await saveCache({
      generatedAt: new Date().toISOString(),
      sourceCount,
      latestSourceDate,
      result,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[/api/history/stream] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
