"use client";

import React, { useMemo, useState } from "react";
import { HistoryEvent } from "@/lib/types";

interface ReadingHeatmapProps {
  events: HistoryEvent[];
  palette: Record<number, string>;
  theme: Record<string, string>;
}

/**
 * Dot-matrix activity map showing daily reading/interaction density.
 * Purely client-side — no API call, uses existing history events.
 */
export function ReadingHeatmap({ events, palette, theme }: ReadingHeatmapProps) {
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  const { grid, maxCount, monthLabels, numWeeks, stats } = useMemo(() => {
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
    const weeks = 20;
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

    // Month labels — skip if too close to previous (< 3 weeks apart)
    const months: { label: string; week: number }[] = [];
    let lastMonth = -1;
    let lastWeek = -10;
    for (const cell of cells) {
      const m = new Date(cell.date).getMonth();
      if (m !== lastMonth && cell.dow === 0 && cell.week - lastWeek >= 3) {
        months.push({
          label: new Date(cell.date).toLocaleDateString(undefined, { month: "short" }),
          week: cell.week,
        });
        lastMonth = m;
        lastWeek = cell.week;
      }
    }

    const actualWeeks = cells.length > 0 ? cells[cells.length - 1].week + 1 : 0;

    // Compute stats
    const totalInteractions = events.length;
    const activeDays = dayCounts.size;

    // Current streak: consecutive days with activity ending today (or yesterday)
    let streak = 0;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const checkDate = new Date(now);
    // Start from today; if today has no activity, start from yesterday
    if (!dayCounts.has(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
      if (dayCounts.has(key)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Most active day of week
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const [dateStr, count] of dayCounts) {
      const d = new Date(dateStr);
      dowCounts[d.getDay()] += count;
    }
    const dowNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const maxDow = dowCounts.indexOf(Math.max(...dowCounts));

    return {
      grid: cells,
      maxCount: max,
      monthLabels: months,
      numWeeks: actualWeeks,
      stats: { totalInteractions, activeDays, streak, mostActiveDay: dowNames[maxDow] },
    };
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

  const r = 5; // circle radius
  const cellGap = 3;
  const step = r * 2 + cellGap;
  const labelH = 16;
  const dayLabelW = 24;
  const width = dayLabelW + numWeeks * step + 4;
  const height = labelH + 7 * step + 4;

  const accentColor = palette[500];

  function circleProps(count: number): { fill: string; opacity: number; strokeWidth: number; stroke: string } {
    if (count === 0) {
      return { fill: "none", opacity: 1, strokeWidth: 0.5, stroke: theme.borderLight };
    }
    const intensity = Math.min(1, count / Math.max(maxCount, 1));
    if (intensity <= 0.25) return { fill: accentColor, opacity: 0.25, strokeWidth: 0, stroke: "none" };
    if (intensity <= 0.5) return { fill: accentColor, opacity: 0.45, strokeWidth: 0, stroke: "none" };
    if (intensity <= 0.75) return { fill: accentColor, opacity: 0.7, strokeWidth: 0, stroke: "none" };
    return { fill: accentColor, opacity: 1, strokeWidth: 0, stroke: "none" };
  }

  const dayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div>
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
              x={dayLabelW + m.week * step + r}
              y={labelH - 4}
              textAnchor="middle"
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
                y={labelH + dow * step + r + 3}
                textAnchor="end"
                className="text-[9px]"
                fill={theme.textLight}
              >
                {label}
              </text>
            ) : null
          )}

          {/* Dot matrix */}
          {grid.map((cell, i) => {
            const props = circleProps(cell.count);
            return (
              <circle
                key={i}
                cx={dayLabelW + cell.week * step + r}
                cy={labelH + cell.dow * step + r}
                r={r}
                fill={props.fill}
                fillOpacity={props.opacity}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
                onMouseEnter={(e) => {
                  const svgRect = (e.target as SVGCircleElement).ownerSVGElement?.getBoundingClientRect();
                  const rect = (e.target as SVGCircleElement).getBoundingClientRect();
                  setHoveredDay({
                    date: cell.date,
                    count: cell.count,
                    x: rect.left - (svgRect?.left ?? 0) + rect.width / 2,
                    y: rect.top - (svgRect?.top ?? 0) - 4,
                  });
                }}
                onMouseLeave={() => setHoveredDay(null)}
                style={{ cursor: cell.count > 0 ? "default" : undefined, transition: "fill-opacity 0.15s" }}
              />
            );
          })}
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

      {/* Stats bar + Legend */}
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-4 text-[10px]" style={{ color: theme.textMuted }}>
          <span>
            <strong style={{ color: theme.text }}>{stats.totalInteractions}</strong> interactions
          </span>
          <span>
            <strong style={{ color: theme.text }}>{stats.activeDays}</strong> active days
          </span>
          {stats.streak > 0 && (
            <span>
              <strong style={{ color: theme.text }}>{stats.streak}</strong> day streak
            </span>
          )}
          <span>
            Most active: <strong style={{ color: theme.text }}>{stats.mostActiveDay}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px]" style={{ color: theme.textLight }}>
          <span>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((level, i) => {
            const props = circleProps(level === 0 ? 0 : Math.ceil(level * maxCount));
            return (
              <svg key={i} width={10} height={10}>
                <circle
                  cx={5} cy={5} r={4}
                  fill={props.fill}
                  fillOpacity={props.opacity}
                  stroke={props.stroke}
                  strokeWidth={props.strokeWidth}
                />
              </svg>
            );
          })}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
