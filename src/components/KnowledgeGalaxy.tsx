"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

interface GalaxyNode extends SimulationNodeDatum {
  id: string;
  title: string;
  topic: string;
  color: string;
  score?: number;
}

interface GalaxyEdge extends SimulationLinkDatum<GalaxyNode> {
  type: string;
}

interface GalaxyData {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  topics: string[];
  colors: string[];
}

interface KnowledgeGalaxyProps {
  palette: Record<number, string>;
  theme: Record<string, string>;
  onNavigateToSource?: (sourceId: string) => void;
}

/**
 * Force-directed graph showing sources as nodes clustered by topic.
 * Connections between sources are shown as edges.
 */
export function KnowledgeGalaxy({ theme, onNavigateToSource }: KnowledgeGalaxyProps) {
  const [data, setData] = useState<GalaxyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GalaxyNode | null>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/history/galaxy");
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json.result);
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

  // Run force simulation when data arrives
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;

    const width = 500;
    const height = 400;

    // Clone nodes for simulation
    const nodes: GalaxyNode[] = data.nodes.map(n => ({ ...n }));
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Build links from edges
    const links: GalaxyEdge[] = data.edges
      .filter(e => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map(e => ({
        source: nodeMap.get(e.source as string)!,
        target: nodeMap.get(e.target as string)!,
        type: e.type,
      }));

    // Create topic cluster targets
    const topicCenters = new Map<string, { x: number; y: number }>();
    const uniqueTopics = data.topics.length > 0 ? data.topics : [...new Set(nodes.map(n => n.topic))];
    uniqueTopics.forEach((t, i) => {
      const angle = (2 * Math.PI * i) / uniqueTopics.length;
      const radius = Math.min(width, height) * 0.25;
      topicCenters.set(t, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    const sim = forceSimulation(nodes)
      .force("link", forceLink(links).distance(60).strength(0.3))
      .force("charge", forceManyBody().strength(-80))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(14))
      // Pull nodes toward their topic cluster center
      .force("x", forceX<GalaxyNode>(d => topicCenters.get(d.topic)?.x ?? width / 2).strength(0.15))
      .force("y", forceY<GalaxyNode>(d => topicCenters.get(d.topic)?.y ?? height / 2).strength(0.15))
      .stop();

    // Run simulation synchronously
    for (let i = 0; i < 200; i++) sim.tick();

    // Extract final positions
    const pos = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      pos.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }

    setPositions(pos);
  }, [data]);

  const handleNodeClick = useCallback((nodeId: string) => {
    onNavigateToSource?.(nodeId);
  }, [onNavigateToSource]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: theme.textLight }} />
        <span className="text-xs" style={{ color: theme.textMuted }}>Loading knowledge graph...</span>
      </div>
    );
  }

  // A couple of floating dots reads as broken, not as a young galaxy —
  // ask for more sources until there's enough to show real structure.
  if (error || !data || data.nodes.length < 3) {
    return (
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {error ? "Could not load knowledge graph" : "Capture a few more sources to see your knowledge galaxy take shape"}
        </p>
      </div>
    );
  }

  const width = 500;
  const height = 400;

  return (
    <div ref={containerRef} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 400 }}>
        {/* Edges */}
        {data.edges.map((edge, i) => {
          const s = positions.get(edge.source as string);
          const t = positions.get(edge.target as string);
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={theme.borderLight}
              strokeWidth={1}
              strokeOpacity={0.5}
            />
          );
        })}

        {/* Nodes */}
        {data.nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isHovered = hoveredNode?.id === node.id;
          const r = node.score ? 4 + (node.score / 100) * 6 : 7;

          return (
            <g key={node.id}>
              {/* Glow on hover */}
              {isHovered && (
                <circle cx={pos.x} cy={pos.y} r={r + 4} fill={node.color} fillOpacity={0.2} />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={node.color}
                fillOpacity={isHovered ? 1 : 0.8}
                stroke={isHovered ? node.color : "none"}
                strokeWidth={2}
                style={{ cursor: "pointer", transition: "fill-opacity 0.15s" }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node.id)}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && positions.get(hoveredNode.id) && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[10px] whitespace-nowrap max-w-[200px] truncate -translate-x-1/2"
          style={{
            left: `${(positions.get(hoveredNode.id)!.x / width) * 100}%`,
            top: `${(positions.get(hoveredNode.id)!.y / height) * 100 - 5}%`,
            backgroundColor: theme.text,
            color: theme.bg,
          }}
        >
          {hoveredNode.title}
          <span className="ml-1" style={{ opacity: 0.6 }}>{hoveredNode.topic}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
        {data.topics.map((topic, i) => (
          <span key={topic} className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: data.colors[i] }} />
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
