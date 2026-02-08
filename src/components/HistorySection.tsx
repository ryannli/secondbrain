"use client";

import React from "react";
import {
  Clock,
  Star,
  Sparkles,
  XCircle,
  CheckCircle,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { HistoryEvent } from "@/lib/types";

interface HistorySectionProps {
  events: HistoryEvent[];
  loading: boolean;
  error: string | null;
  onNavigateToSource: (sourceId: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}

function getEventConfig(
  event: HistoryEvent,
  palette: Record<number, string>
): { icon: React.ReactNode; color: string; text: string } {
  switch (event.type) {
    case "rating":
      return {
        icon: <Star className="w-3.5 h-3.5 fill-current" />,
        color: "#d97706",
        text: `Rated ${event.rating}/5`,
      };
    case "star":
      return {
        icon: <Sparkles className="w-3.5 h-3.5" />,
        color: palette[500],
        text: `Starred: "${truncate(event.highlightText ?? "", 60)}"`,
      };
    case "dismiss":
      return {
        icon: <XCircle className="w-3.5 h-3.5" />,
        color: "#9ca3af",
        text: `Dismissed: "${truncate(event.highlightText ?? "", 60)}"`,
      };
    case "knew":
      return {
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        color: palette[500],
        text: `Knew: ${event.conceptTerm}`,
      };
    case "learned":
      return {
        icon: <Lightbulb className="w-3.5 h-3.5" />,
        color: palette[600],
        text: `Learned: ${event.conceptTerm}`,
      };
    case "read":
      return {
        icon: <BookOpen className="w-3.5 h-3.5" />,
        color: palette[400] ?? palette[500],
        text: "Read",
      };
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - eventDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDay(events: HistoryEvent[]): Map<string, HistoryEvent[]> {
  const groups = new Map<string, HistoryEvent[]>();
  for (const event of events) {
    const date = new Date(event.timestamp);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const existing = groups.get(dayKey);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(dayKey, [event]);
    }
  }
  return groups;
}

export function HistorySection({
  events,
  loading,
  error,
  onNavigateToSource,
  palette,
  theme,
}: HistorySectionProps) {
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Clock className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: palette[500] }} />
        <p style={{ color: theme.textMuted }}>Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Clock className="w-8 h-8 mx-auto mb-3" style={{ color: theme.textMuted }} />
        <p className="text-sm" style={{ color: theme.textMuted }}>
          No interactions yet. Rate sources, react to highlights, and mark concepts to see your history here.
        </p>
      </div>
    );
  }

  const groups = groupByDay(events);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5" style={{ color: palette[500] }} />
        <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
          History
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}>
          {events.length}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative pl-6">
        {/* Vertical line */}
        <div
          className="absolute left-2.5 top-0 bottom-0 w-px"
          style={{ backgroundColor: theme.borderLight }}
        />

        {Array.from(groups.entries()).map(([dayKey, dayEvents]) => (
          <div key={dayKey} className="mb-6">
            {/* Day header */}
            <div className="relative flex items-center mb-3">
              <div
                className="absolute -left-3.5 w-2 h-2 rounded-full"
                style={{ backgroundColor: palette[500] }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.textMuted }}>
                {formatDayLabel(dayEvents[0].timestamp)}
              </span>
            </div>

            {/* Events */}
            <div className="space-y-1">
              {dayEvents.map((event) => {
                const config = getEventConfig(event, palette);
                return (
                  <div
                    key={event.id}
                    className="relative flex items-start gap-3 py-1.5 px-2 rounded-lg hover:bg-black/[0.03] transition-colors group"
                  >
                    {/* Dot on timeline */}
                    <div
                      className="absolute -left-[22px] top-3 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />

                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5" style={{ color: config.color }}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <button
                          onClick={() => onNavigateToSource(event.sourceId)}
                          className="text-sm font-medium hover:underline truncate max-w-[280px]"
                          style={{ color: palette[600] }}
                          title={event.sourceTitle}
                        >
                          {event.sourceTitle}
                        </button>
                        <span className="text-xs" style={{ color: theme.textMuted }}>
                          {config.text}
                        </span>
                      </div>
                    </div>

                    {/* Time */}
                    <span className="flex-shrink-0 text-xs tabular-nums" style={{ color: theme.textLight }}>
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
