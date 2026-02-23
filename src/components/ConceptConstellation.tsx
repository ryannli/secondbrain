"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cloud from "d3-cloud";

interface ConceptNodeData {
  id: string;
  term: string;
  count: number;
  score: number;
  latestDate: string;
  status?: "learned" | "knew";
  cluster: string;
  clusterColor: string;
}

interface CloudWord {
  text: string;
  size: number;
  fontWeight: number;
  color: string;
  opacity: number;
  id: string;
  status?: "learned" | "knew";
  count: number;
  cluster: string;
  // Placed by d3-cloud
  x?: number;
  y?: number;
  rotate?: number;
}

export type ConceptTimeRange = "week" | "month";

interface ConceptConstProps {
  palette: Record<number, string>;
  theme: Record<string, string>;
  range: ConceptTimeRange;
}

/**
 * Clustered word cloud of concepts using d3-cloud spiral layout.
 * Font size encodes frequency + learning status, color encodes semantic cluster.
 */
export function ConceptConstellation({ theme, range }: ConceptConstProps) {
  const [rawData, setRawData] = useState<{
    clusters: string[];
    clusterColors: string[];
    concepts: ConceptNodeData[];
  } | null>(null);
  const [placedWords, setPlacedWords] = useState<CloudWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/history/concepts");
        const json = await res.json();
        if (!cancelled && json.success) {
          setRawData(json.result);
        } else if (!cancelled) {
          setError(json.error || "Failed to load");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Filter by time range, then rank-based sizing for variation
  const cloudWords = useMemo(() => {
    if (!rawData || rawData.concepts.length === 0) return [];

    const now = Date.now();
    const cutoff = range === "week"
      ? new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const filtered = rawData.concepts.filter(n => n.latestDate >= cutoff);
    if (filtered.length === 0) return [];

    // Value-based with deterministic jitter for same-score variation
    const minScore = Math.min(...filtered.map(n => n.score));
    const maxScore = Math.max(...filtered.map(n => n.score));
    const scoreRange = maxScore - minScore || 1;
    // Fewer concepts → larger base font so the cloud doesn't look sparse
    const boost = filtered.length < 40 ? Math.round((40 - filtered.length) * 0.15) : 0;
    const minFont = 14 + boost;
    const maxFont = 32 + boost;
    const jitterRange = 2; // ±2px variation within same score

    // Deterministic hash from term string → stable jitter per concept
    function hashJitter(term: string): number {
      let h = 0;
      for (let i = 0; i < term.length; i++) h = ((h << 5) - h + term.charCodeAt(i)) | 0;
      return ((h % 100) / 100) * jitterRange * 2 - jitterRange; // [-4, +4]
    }

    const allSameScore = maxScore === minScore;

    return filtered.map((n): CloudWord => {
      const t = allSameScore ? 0.5 : (n.score - minScore) / scoreRange;
      const base = minFont + t * (maxFont - minFont);
      const size = Math.round(Math.max(minFont, Math.min(maxFont, base + hashJitter(n.term))));
      const opacity = n.status === "learned" ? 1 : n.status === "knew" ? 0.85 : 0.7;
      const fontWeight = n.status === "learned" ? 700 : t >= 0.5 ? 600 : 400;

      return {
        text: n.term,
        size,
        fontWeight,
        color: n.clusterColor,
        opacity,
        id: n.id,
        status: n.status,
        count: n.count,
        cluster: n.cluster,
      };
    });
  }, [rawData, range]);

  // Run d3-cloud layout
  const onEnd = useCallback((words: CloudWord[]) => {
    setPlacedWords(words);
  }, []);

  useEffect(() => {
    if (cloudWords.length === 0) {
      setPlacedWords([]);
      return;
    }

    const width = 700;
    const height = 480;

    const padX = 20;
    const padY = 60;
    const layout = cloud<CloudWord>()
      .size([width - padX * 2, height - padY * 2])
      .words(cloudWords.map(w => ({ ...w })))
      .padding(3)
      .rotate(0)
      .fontSize(d => d.size ?? 12)
      .fontWeight(d => d.fontWeight ?? 400)
      .font("system-ui, -apple-system, sans-serif")
      .spiral("archimedean")
      .on("end", onEnd);

    layout.start();
  }, [cloudWords, onEnd]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: theme.textLight }} />
        <span className="text-xs" style={{ color: theme.textMuted }}>Mapping concept clusters...</span>
      </div>
    );
  }

  if (error || !rawData || rawData.concepts.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {error ? "Could not load concepts" : "Add sources to see your concept constellation"}
        </p>
      </div>
    );
  }

  const width = 700;
  const height = 380;
  const noResults = cloudWords.length === 0;

  return (
    <div>
      {noResults ? (
        <div className="text-center py-10">
          <p className="text-xs" style={{ color: theme.textMuted }}>
            No concepts from this {range === "week" ? "week" : "month"}
          </p>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 480 }}>
            <g transform={`translate(${width / 2},${height / 2})`}>
              {placedWords.map(word => {
                const isHovered = hoveredId === word.id;
                return (
                  <text
                    key={word.id}
                    textAnchor="middle"
                    transform={`translate(${word.x ?? 0},${word.y ?? 0})`}
                    fontSize={word.size}
                    fontWeight={word.fontWeight}
                    fontFamily="system-ui, -apple-system, sans-serif"
                    fill={word.color}
                    fillOpacity={isHovered ? 1 : word.opacity}
                    className="select-none"
                    style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                    onMouseEnter={() => setHoveredId(word.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {word.text}
                  </text>
                );
              })}
            </g>
          </svg>

          {/* Tooltip */}
          {hoveredId && (() => {
            const word = placedWords.find(w => w.id === hoveredId);
            if (!word || word.x == null || word.y == null) return null;
            return (
              <div
                className="absolute pointer-events-none px-2 py-1 rounded text-[10px] whitespace-nowrap -translate-x-1/2"
                style={{
                  left: `${((word.x + width / 2) / width) * 100}%`,
                  top: `${((word.y + height / 2) / height) * 100 - 4}%`,
                  backgroundColor: theme.text,
                  color: theme.bg,
                }}
              >
                <strong>{word.text}</strong>
                <span className="ml-1" style={{ opacity: 0.6 }}>
                  {word.count} {word.count === 1 ? "source" : "sources"}
                  {word.status ? ` · ${word.status}` : ""}
                </span>
              </div>
            );
          })()}
        </>
      )}

      {/* Cluster Legend */}
      {rawData.clusters.length > 0 && !noResults && (
        <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
          {rawData.clusters.map((cluster, i) => (
            <span key={cluster} className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.textMuted }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rawData.clusterColors[i] }} />
              {cluster}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
