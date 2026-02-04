"use client";

import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid with light theme config
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  securityLevel: "loose",
  fontFamily: "inherit",
  themeVariables: {
    // Light background with good contrast
    primaryColor: "#e8f5e9",
    primaryTextColor: "#1a1a1a",
    primaryBorderColor: "#4caf50",
    lineColor: "#666666",
    secondaryColor: "#f3f4f6",
    tertiaryColor: "#fff",
    // Text colors
    textColor: "#1a1a1a",
    nodeTextColor: "#1a1a1a",
  },
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
      className={`mermaid-container overflow-x-auto p-4 bg-white rounded-lg border border-gray-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
