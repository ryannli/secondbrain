"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  theme: "neutral",
  securityLevel: "loose",
  fontFamily: "inherit",
});

interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className = "" }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart.trim()) return;

      try {
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, chart.trim());
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg text-sm ${className}`}>
        <p className="text-red-600 font-medium mb-2">Diagram error</p>
        <pre className="text-red-500 text-xs overflow-x-auto">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-container overflow-x-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
