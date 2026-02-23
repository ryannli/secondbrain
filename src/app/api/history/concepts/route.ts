import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentRootPath, listSourcesForConnections } from "@/lib/storage";
import { analyzeConceptNetwork, ConceptNetworkData } from "@/lib/claude";

interface ConceptCache {
  generatedAt: string;
  conceptCount: number;
  result: ConceptNetworkData;
}

function getCachePath(): string {
  return path.join(getCurrentRootPath(), ".cache", "concept-constellation.json");
}

async function loadCache(): Promise<ConceptCache | null> {
  try {
    const raw = await fs.readFile(getCachePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveCache(cache: ConceptCache): Promise<void> {
  const dir = path.dirname(getCachePath());
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(getCachePath(), JSON.stringify(cache, null, 2), "utf-8");
}

/**
 * GET /api/history/concepts
 * Returns Claude-analyzed concept nodes + relationships for the Concept Constellation.
 * Uses cache invalidated by concept count change.
 */
export async function GET() {
  try {
    const sources = await listSourcesForConnections();

    // Count total unique concepts
    const conceptKeys = new Set<string>();
    for (const s of sources) {
      for (const c of s.concepts) {
        const key = c.term.toLowerCase().trim();
        if (key) conceptKeys.add(key);
      }
    }
    const conceptCount = conceptKeys.size;

    if (conceptCount === 0) {
      return NextResponse.json({ success: true, result: { clusters: [], clusterColors: [], concepts: [] } });
    }

    // Check cache
    const cache = await loadCache();
    if (cache && cache.conceptCount === conceptCount) {
      return NextResponse.json({ success: true, result: cache.result });
    }

    // Cache stale — regenerate with Claude
    const result = await analyzeConceptNetwork();

    await saveCache({
      generatedAt: new Date().toISOString(),
      conceptCount,
      result,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[/api/history/concepts] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
