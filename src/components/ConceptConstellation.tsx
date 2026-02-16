"use client";

import React, { useEffect, useState, useMemo } from "react";
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

interface ConceptNodeData {
  id: string;
  term: string;
  count: number;
  status?: "learned" | "knew";
  cluster: string;
  clusterColor: string;
}

interface ConceptEdgeData {
  source: string;
  target: string;
  weight: number;
  type: string;
}

interface ConceptNode extends SimulationNodeDatum {
  id: string;
  term: string;
  count: number;
  status?: "learned" | "knew";
  cluster: string;
  clusterColor: string;
  radius: number;
}

interface ConceptConstProps {
  palette: Record<number, string>;
  theme: Record<string, string>;
}

/**
 * Force-directed concept network with Claude-analyzed clusters and relationships.
 */
export function ConceptConstellation({ theme }: ConceptConstProps) {
  const [rawData, setRawData] = useState<{
    clusters: string[];
    clusterColors: string[];
    concepts: ConceptNodeData[];
    relationships: ConceptEdgeData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ConceptNode | null>(null);

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

  // Run simulation
  const { nodes, edges, positions } = useMemo(() => {
    if (!rawData || rawData.concepts.length === 0) {
      return { nodes: [], edges: [] as ConceptEdgeData[], positions: new Map<string, { x: number; y: number }>() };
    }

    const width = 500;
    const height = 380;
    const maxCount = Math.max(...rawData.concepts.map(n => n.count), 1);

    // Build simulation nodes with radius based on count
    const simNodes: ConceptNode[] = rawData.concepts.map(n => ({
      ...n,
      radius: 6 + (n.count / maxCount) * 18,
    }));

    const nodeMap = new Map(simNodes.map(n => [n.id, n]));

    // Build links from relationships
    type SimLink = SimulationLinkDatum<ConceptNode> & { weight: number };
    const simLinks: SimLink[] = rawData.relationships
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        weight: e.weight,
      }));

    // Cluster centers for pulling nodes toward their cluster
    const uniqueClusters = rawData.clusters.length > 0 ? rawData.clusters : [...new Set(simNodes.map(n => n.cluster))];
    const clusterCenters = new Map<string, { x: number; y: number }>();
    uniqueClusters.forEach((c, i) => {
      const angle = (2 * Math.PI * i) / uniqueClusters.length;
      const radius = Math.min(width, height) * 0.2;
      clusterCenters.set(c, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    const sim = forceSimulation(simNodes)
      .force("link", forceLink<ConceptNode, SimLink>(simLinks).distance(50).strength(e => Math.min(0.5, e.weight * 0.1)))
      .force("charge", forceManyBody().strength(-60))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide<ConceptNode>(d => d.radius + 3))
      .force("x", forceX<ConceptNode>(d => clusterCenters.get(d.cluster)?.x ?? width / 2).strength(0.12))
      .force("y", forceY<ConceptNode>(d => clusterCenters.get(d.cluster)?.y ?? height / 2).strength(0.12))
      .stop();

    for (let i = 0; i < 200; i++) sim.tick();

    const pos = new Map<string, { x: number; y: number }>();
    for (const n of simNodes) {
      pos.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }

    return { nodes: simNodes, edges: rawData.relationships, positions: pos };
  }, [rawData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: theme.textLight }} />
        <span className="text-xs" style={{ color: theme.textMuted }}>Mapping concept relationships...</span>
      </div>
    );
  }

  if (error || nodes.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {error ? "Could not load concepts" : "Add sources to see your concept constellation"}
        </p>
      </div>
    );
  }

  const width = 500;
  const height = 380;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 380 }}>
        {/* Edges */}
        {edges.map((edge, i) => {
          const s = positions.get(edge.source);
          const t = positions.get(edge.target);
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={theme.borderLight}
              strokeWidth={Math.min(2, edge.weight)}
              strokeOpacity={0.4}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const isHovered = hoveredNode?.id === node.id;
          const color = node.clusterColor;

          // Learned/knew get full opacity, unreviewed slightly faded
          const baseOpacity = node.status ? 0.85 : 0.55;

          return (
            <g key={node.id}>
              {isHovered && (
                <circle cx={pos.x} cy={pos.y} r={node.radius + 4} fill={color} fillOpacity={0.15} />
              )}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={node.radius}
                fill={color}
                fillOpacity={isHovered ? 0.95 : baseOpacity}
                stroke={node.status === "learned" ? color : "none"}
                strokeWidth={node.status === "learned" ? 1.5 : 0}
                style={{ cursor: "default", transition: "fill-opacity 0.15s" }}
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              {/* Label for larger nodes */}
              {node.radius > 12 && (
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[8px] pointer-events-none select-none"
                  fill={theme.bg}
                  fontWeight={600}
                >
                  {node.term.length > 12 ? node.term.slice(0, 10) + ".." : node.term}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredNode && positions.get(hoveredNode.id) && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[10px] whitespace-nowrap -translate-x-1/2"
          style={{
            left: `${(positions.get(hoveredNode.id)!.x / width) * 100}%`,
            top: `${(positions.get(hoveredNode.id)!.y / height) * 100 - 5}%`,
            backgroundColor: theme.text,
            color: theme.bg,
          }}
        >
          <strong>{hoveredNode.term}</strong>
          <span className="ml-1" style={{ opacity: 0.6 }}>
            {hoveredNode.count} {hoveredNode.count === 1 ? "source" : "sources"}
            {hoveredNode.status ? ` · ${hoveredNode.status}` : ""}
            {hoveredNode.cluster ? ` · ${hoveredNode.cluster}` : ""}
          </span>
        </div>
      )}

      {/* Cluster Legend */}
      {rawData && rawData.clusters.length > 0 && (
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
