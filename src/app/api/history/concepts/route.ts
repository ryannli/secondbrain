import { NextResponse } from "next/server";
import { listSourcesForConnections } from "@/lib/storage";

interface ConceptNode {
  id: string;
  term: string;
  count: number;           // how many sources mention this concept
  status?: "learned" | "knew";  // user's strongest status across sources
}

interface ConceptEdge {
  source: string;
  target: string;
  weight: number;          // co-occurrence count
}

/**
 * GET /api/history/concepts
 * Returns aggregated concept nodes + co-occurrence edges for the Concept Constellation.
 * No AI call needed — pure aggregation from existing analysis data.
 */
export async function GET() {
  try {
    const sources = await listSourcesForConnections();

    // Aggregate concepts across all sources
    // Key = lowercase term for dedup, value = { term (display), count, status, sourceIds }
    const conceptMap = new Map<string, {
      term: string;
      count: number;
      status?: "learned" | "knew";
      sourceIds: string[];
    }>();

    for (const s of sources) {
      for (const c of s.concepts) {
        const key = c.term.toLowerCase().trim();
        if (!key) continue;

        const existing = conceptMap.get(key);
        if (existing) {
          existing.count++;
          existing.sourceIds.push(s.id);
          // Promote status: learned > knew > undefined
          if (c.status === "learned") existing.status = "learned";
          else if (c.status === "knew" && existing.status !== "learned") existing.status = "knew";
        } else {
          conceptMap.set(key, {
            term: c.term,
            count: 1,
            status: c.status,
            sourceIds: [s.id],
          });
        }
      }
    }

    // Build nodes — only include concepts that appear in 1+ sources
    const nodes: ConceptNode[] = [];
    const conceptList = Array.from(conceptMap.entries());

    // Sort by count desc, take top 60 to keep visualization readable
    conceptList.sort((a, b) => b[1].count - a[1].count);
    const topConcepts = conceptList.slice(0, 60);

    const keyToId = new Map<string, string>();
    topConcepts.forEach(([key, val], i) => {
      const id = `c${i}`;
      keyToId.set(key, id);
      nodes.push({
        id,
        term: val.term,
        count: val.count,
        status: val.status,
      });
    });

    // Build co-occurrence edges (concepts that appear in the same source)
    const edgeMap = new Map<string, number>(); // "c0-c1" → weight

    for (const [key1, val1] of topConcepts) {
      const id1 = keyToId.get(key1)!;
      for (const [key2, val2] of topConcepts) {
        if (key1 >= key2) continue; // avoid duplicates + self
        const id2 = keyToId.get(key2)!;

        // Count shared sources
        const shared = val1.sourceIds.filter(sid => val2.sourceIds.includes(sid)).length;
        if (shared > 0) {
          const edgeKey = `${id1}-${id2}`;
          edgeMap.set(edgeKey, shared);
        }
      }
    }

    const edges: ConceptEdge[] = [];
    for (const [key, weight] of edgeMap) {
      const [source, target] = key.split("-");
      edges.push({ source, target, weight });
    }

    return NextResponse.json({ success: true, result: { nodes, edges } });
  } catch (error) {
    console.error("[/api/history/concepts] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
