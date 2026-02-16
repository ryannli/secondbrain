import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentRootPath, getLibraryPath, listSourcesForConnections, findEntryPath } from "@/lib/storage";
import { extractTopicStream, InterestStreamData } from "@/lib/claude";

interface GalaxyNode {
  id: string;
  title: string;
  topic: string;
  color: string;
  score?: number;
}

interface GalaxyEdge {
  source: string;
  target: string;
  type: string;
}

/**
 * GET /api/history/galaxy
 * Returns source nodes with topic colors + connection edges for the Knowledge Galaxy.
 * Uses topic assignments from the interest-stream cache.
 */
export async function GET() {
  try {
    const sources = await listSourcesForConnections();
    if (sources.length === 0) {
      return NextResponse.json({ success: true, result: { nodes: [], edges: [], topics: [], colors: [] } });
    }

    // Load topic assignments from stream cache, or generate if missing
    let streamData: InterestStreamData | null = null;
    try {
      const cachePath = path.join(getCurrentRootPath(), ".cache", "interest-stream.json");
      const raw = await fs.readFile(cachePath, "utf-8");
      const cache = JSON.parse(raw);
      streamData = cache.result as InterestStreamData;
    } catch {
      // No cache
    }

    // If cache is missing sourceTopics, generate them (calls Claude)
    if (!streamData?.sourceTopics && sources.length >= 3) {
      try {
        const result = await extractTopicStream();
        streamData = result;
        // Save to stream cache so Brain Waves and future galaxy loads reuse it
        const cachePath = path.join(getCurrentRootPath(), ".cache", "interest-stream.json");
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, JSON.stringify({
          generatedAt: new Date().toISOString(),
          sourceCount: sources.length,
          latestSourceDate: new Date().toISOString(),
          result,
        }, null, 2), "utf-8");
      } catch (err) {
        console.error("[/api/history/galaxy] Failed to generate topics:", err);
      }
    }

    // Build source → topic mapping from cache
    const sourceTopicMap = new Map<string, string>();
    if (streamData?.sourceTopics) {
      for (const st of streamData.sourceTopics) {
        // Use first topic as primary
        if (st.topics.length > 0) {
          sourceTopicMap.set(st.id, st.topics[0]);
        }
      }
    }

    // Build topic → color mapping
    const topicColorMap = new Map<string, string>();
    if (streamData) {
      streamData.topics.forEach((t, i) => {
        topicColorMap.set(t, streamData!.colors[i]);
      });
    }

    const libraryPath = getLibraryPath();
    const nodes: GalaxyNode[] = [];
    const edges: GalaxyEdge[] = [];
    const sourceIds = new Set(sources.map(s => s.id));

    for (const s of sources) {
      const topic = sourceTopicMap.get(s.id) ?? "Other";
      const color = topicColorMap.get(topic) ?? "#9ca3af";

      // Load score + connections from analysis.json
      let score: number | undefined;
      try {
        let analysisPath = path.join(libraryPath, s.id, "analysis.json");
        try { await fs.access(analysisPath); } catch {
          const ep = await findEntryPath(s.id, libraryPath);
          if (ep) analysisPath = path.join(ep, "analysis.json");
        }
        const raw = await fs.readFile(analysisPath, "utf-8");
        const analysis = JSON.parse(raw);
        score = analysis.triage?.score;

        // Collect connections as edges
        if (Array.isArray(analysis.connections)) {
          for (const conn of analysis.connections) {
            for (const relatedId of conn.relatedSourceIds ?? []) {
              if (sourceIds.has(relatedId)) {
                edges.push({ source: s.id, target: relatedId, type: conn.type ?? "related" });
              }
            }
          }
        }
      } catch { /* no analysis */ }

      nodes.push({ id: s.id, title: s.title, topic, color, score });
    }

    // Deduplicate edges (A→B and B→A)
    const edgeSet = new Set<string>();
    const dedupedEdges: GalaxyEdge[] = [];
    for (const e of edges) {
      const key = [e.source, e.target].sort().join("-");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        dedupedEdges.push(e);
      }
    }

    return NextResponse.json({
      success: true,
      result: {
        nodes,
        edges: dedupedEdges,
        topics: streamData?.topics ?? [],
        colors: streamData?.colors ?? [],
      },
    });
  } catch (error) {
    console.error("[/api/history/galaxy] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
