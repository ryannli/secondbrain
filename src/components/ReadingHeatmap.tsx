"use client";

import React, { useMemo, useState } from "react";
import { HistoryEvent } from "@/lib/types";

interface ReadingHeatmapProps {
  events: HistoryEvent[];
  palette: Record<number, string>;
  theme: Record<string, string>;
}

/**
 * GitHub-style contribution heatmap showing daily reading/interaction density.
 * Purely client-side — no API call, uses existing history events.
 */
export function ReadingHeatmap({ events, palette, theme }: ReadingHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { grid, maxCount, monthLabels, numWeeks } = useMemo(() => {
    // Aggregate events by day
    const dayCounts = new Map<string, number>();
    for (const e of events) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }

    // Build grid: go back N weeks from today
    const now = new Date();
    const todayDow = now.getDay(); // 0=Sun
    const weeks = 20; // show ~5 months
    const totalDays = weeks * 7 + todayDow + 1;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    const cells: { date: string; count: number; week: number; dow: number }[] = [];
    let max = 0;

    const cursor = new Date(startDate);
    for (let i = 0; i < totalDays; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const count = dayCounts.get(key) ?? 0;
      if (count > max) max = count;

      const daysSinceStart = i;
      const week = Math.floor(daysSinceStart / 7);
      const dow = daysSinceStart % 7;

      cells.push({ date: key, count, week, dow });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Month labels
    const months: { label: string; week: number }[] = [];
    let lastMonth = -1;
    for (const cell of cells) {
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth && cell.dow === 0) {
        months.push({
          label: new Date(cell.date).toLocaleDateString(undefined, { month: "short" }),
          week: cell.week,
        });
        lastMonth = m;
      }
    }

    const actualWeeks = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

    return { grid: cells, maxCount: max, monthLabels: months, numWeeks: actualWeeks };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs" style={{ color: theme.textMuted }}>
          Start reading to see your activity pattern
        </p>
      </div>
    );
  }

  const cellSize = 11;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const labelH = 16;
  const dayLabelW = 24;
  const width = dayLabelW + numWeeks * step + 4;
  const height = labelH + 7 * step + 4;

  const accentColor = palette[500];

  function cellColor(count: number): string {
    if (count === 0) return theme.borderLight;
    const intensity = Math.min(1, count / Math.max(maxCount, 1));
    // 4 levels
    if (intensity <= 0.25) return `${accentColor}30`;
    if (intensity <= 0.5) return `${accentColor}60`;
    if (intensity <= 0.75) return `${accentColor}99`;
    return accentColor;
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: 140 }}
      >
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={dayLabelW + m.week * step}
            y={labelH - 4}
            className="text-[9px]"
            fill={theme.textLight}
          >
            {m.label}
          </text>
        ))}

        {/* Day labels */}
        {dayLabels.map((label, dow) =>
          label ? (
            <text
              key={dow}
              x={dayLabelW - 4}
              y={labelH + dow * step + cellSize - 1}
              textAnchor="end"
              className="text-[9px]"
              fill={theme.textLight}
            >
              {label}
            </text>
          ) : null
        )}

        {/* Cells */}
        {grid.map((cell, i) => (
          <rect
            key={i}
            x={dayLabelW + cell.week * step}
            y={labelH + cell.dow * step}
            width={cellSize}
            height={cellSize}
            rx={2}
            fill={cellColor(cell.count)}
            onMouseEnter={(e) => {
              const svgRect = (e.target as SVGRectElement).ownerSVGElement?.getBoundingClientRect();
              const rect = (e.target as SVGRectElement).getBoundingClientRect();
              setHoveredDay({
                date: cell.date,
                count: cell.count,
                x: rect.left - (svgRect?.left ?? 0) + cellSize / 2,
                y: rect.top - (svgRect?.top ?? 0) - 4,
              });
            }}
            onMouseLeave={() => setHoveredDay(null)}
            style={{ transition: "fill 0.15s" }}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded text-[10px] whitespace-nowrap -translate-x-1/2 -translate-y-full"
          style={{
            left: hoveredDay.x,
            top: hoveredDay.y,
            backgroundColor: theme.text,
            color: theme.bg,
          }}
        >
          {hoveredDay.count} {hoveredDay.count === 1 ? "interaction" : "interactions"} on{" "}
          {new Date(hoveredDay.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </div>
      )}
    </div>
  );
}
