"use client";

import React, { useMemo, useState, useEffect } from "react";
import { stack, stackOffsetWiggle, stackOrderInsideOut, area, curveBasis } from "d3-shape";
import { scaleLinear } from "d3-scale";

interface StreamData {
  topics: string[];
  colors: string[];
  weeks: string[];
  data: number[][]; // weeks × topics
}

interface InterestStreamProps {
  palette: Record<number, string>;
  theme: Record<string, string>;
}

export function InterestStream({ theme }: InterestStreamProps) {
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/history/stream");
        const json = await res.json();
        if (!cancelled) {
          if (json.success && json.result) {
            setStreamData(json.result);
          } else {
            setError(json.error || "Failed to load stream data");
          }
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

  // Compact loading indicator
  if (loading) {
    return (
      <div className="mb-8 flex items-center justify-center gap-2 py-4">
        <div
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: theme.textLight }}
        />
        <span className="text-xs" style={{ color: theme.textMuted }}>
          Mapping your interests...
        </span>
      </div>
    );
  }

  // Empty or error state
  if (error || !streamData || streamData.topics.length === 0) {
    return (
      <div className="mb-8 text-center py-6">
        <p className="text-xs" style={{ color: theme.textMuted }}>
          {error
            ? "Could not load topic stream"
            : "Add more sources to see your interest streams"}
        </p>
      </div>
    );
  }

  return <StreamGraph streamData={streamData} theme={theme} hoveredTopic={hoveredTopic} setHoveredTopic={setHoveredTopic} />;
}

function StreamGraph({
  streamData,
  theme,
  hoveredTopic,
  setHoveredTopic,
}: {
  streamData: StreamData;
  theme: Record<string, string>;
  hoveredTopic: string | null;
  setHoveredTopic: (t: string | null) => void;
}) {
  const { topics, colors, weeks, data } = streamData;

  const width = 600;
  const height = 200;
  const margin = { top: 12, right: 16, bottom: 24, left: 16 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const { paths, xScale } = useMemo(() => {
    // Convert data matrix (weeks × topics) into d3-compatible records
    const records: Record<string, number>[] = data.map((row) => {
      const record: Record<string, number> = {};
      topics.forEach((t, i) => {
        record[t] = row[i] ?? 0;
      });
      return record;
    });

    const stacker = stack<Record<string, number>>()
      .keys(topics)
      .offset(stackOffsetWiggle)
      .order(stackOrderInsideOut);

    const series = stacker(records);

    let yMin = Infinity, yMax = -Infinity;
    for (const s of series) {
      for (const d of s) {
        if (d[0] < yMin) yMin = d[0];
        if (d[1] > yMax) yMax = d[1];
      }
    }

    const xs = scaleLinear().domain([0, records.length - 1]).range([0, innerW]);
    const ys = scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

    const areaGen = area<[number, number]>()
      .x((_, i) => xs(i))
      .y0((d) => ys(d[0]))
      .y1((d) => ys(d[1]))
      .curve(curveBasis);

    const p = series.map((s, i) => ({
      topic: topics[i],
      color: colors[i] ?? "#888",
      d: areaGen(s as unknown as [number, number][]) ?? "",
    }));

    return { paths: p, xScale: xs };
  }, [topics, colors, data, innerW, innerH]);

  return (
    <div className="mb-8">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: 220 }}
      >
        <g transform={`translate(${margin.left},${margin.top})`}>
          {paths.map(({ topic, color, d }) => (
            <path
              key={topic}
              d={d}
              fill={color}
              fillOpacity={hoveredTopic === null ? 0.75 : hoveredTopic === topic ? 0.9 : 0.15}
              stroke={hoveredTopic === topic ? color : "none"}
              strokeWidth={1}
              style={{ transition: "fill-opacity 0.2s, stroke 0.2s" }}
              onMouseEnter={() => setHoveredTopic(topic)}
              onMouseLeave={() => setHoveredTopic(null)}
            />
          ))}

          {weeks.map((label, i) =>
            label ? (
              <text
                key={i}
                x={xScale(i)}
                y={innerH + 16}
                textAnchor="middle"
                className="text-[10px]"
                fill={theme.textLight}
              >
                {label}
              </text>
            ) : null
          )}
        </g>
      </svg>

      <div className="flex items-center justify-center gap-3 mt-1 flex-wrap">
        {paths.map(({ topic, color }) => (
          <button
            key={topic}
            className="flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded transition-opacity"
            style={{
              color: hoveredTopic === null || hoveredTopic === topic ? theme.text : theme.textLight,
              opacity: hoveredTopic === null || hoveredTopic === topic ? 1 : 0.4,
            }}
            onMouseEnter={() => setHoveredTopic(topic)}
            onMouseLeave={() => setHoveredTopic(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}
