"use client";

import React, { useState, useEffect } from "react";
import { Rss, RefreshCw, ChevronDown, ChevronUp, X, ExternalLink, Plus, Filter, Check, Star } from "lucide-react";
import { FeedItem, FeedSignals, InsightItem, StructuredBriefing as StructuredBriefingType } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface FeedSectionProps {
  items: FeedItem[];
  interests: string[];
  generatedAt: string | null;
  fromCache: boolean;
  message?: string;
  briefing?: StructuredBriefingType;
  signals?: FeedSignals;
  insights?: InsightItem[];
  loading: boolean;
  error: string | null;
  availableDates?: string[];
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
  onCapture: (url: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  onAddContext?: (text: string, title: string) => void;
  onMarkBriefingRead?: (text: string, urls: string[]) => void;
  onMarkBriefingUnread?: (text: string, urls: string[]) => void;
  onStarBriefing?: (text: string, meta?: { feedDate?: string; refs?: { url: string; title: string }[] }) => void;
  onUnstarBriefing?: (text: string) => void;
  starredBriefingTexts?: Set<string>;
  readBriefingTexts?: Set<string>;
  searchConfigured?: boolean;
  onOpenSettings?: () => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}

export const FeedSection = React.memo(function FeedSection({
  items,
  interests,
  generatedAt,
  fromCache,
  message,
  briefing,
  signals,
  insights,
  loading,
  error,
  availableDates,
  selectedDate,
  onSelectDate,
  onCapture,
  onDismiss,
  onRefresh,
  onAddContext,
  onMarkBriefingRead,
  onMarkBriefingUnread,
  onStarBriefing,
  onUnstarBriefing,
  starredBriefingTexts,
  readBriefingTexts,
  searchConfigured,
  onOpenSettings,
  palette,
  theme,
}: FeedSectionProps) {
  const [showFiltered, setShowFiltered] = useState(false);

  // Separate items into recommended and filtered
  const recommendedItems = items.filter(item => item.scoring.action === "recommend");
  const filteredItems = items.filter(item => item.scoring.action === "skip");

  const isEmpty = items.length === 0 && !message && !loading && !error && !briefing;

  return (
    <div>
      {/* Header with filter count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Rss className="w-5 h-5" style={{ color: palette[500] }} />
          <h2 className="text-lg font-semibold">For You</h2>
        </div>

        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-xs" style={{ color: theme.textMuted }}>
              {fromCache ? "Cached" : "Updated"} {formatRelativeTime(generatedAt)}
            </span>
          )}
          {!selectedDate && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-black/5 transition-colors disabled:opacity-50"
              data-track="feed.refresh"
              title="Refresh feed"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                style={{ color: theme.textMuted }}
              />
            </button>
          )}
        </div>
      </div>

      {/* Date selector pills */}
      {availableDates && availableDates.length > 1 && (
        <DateSelector
          dates={availableDates}
          selectedDate={selectedDate ?? null}
          onSelectDate={onSelectDate}
          palette={palette}
          theme={theme}
        />
      )}

      {/* Filter status bar */}
      {items.length > 0 && !loading && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm"
          style={{ backgroundColor: theme.bgMuted }}
        >
          {signals?.searchCalls != null && (
            <>
              <span style={{ color: theme.textMuted }}>
                {signals.searchCalls} searches
              </span>
              <span style={{ color: theme.textMuted }}>·</span>
            </>
          )}
          <span style={{ color: theme.text }}>
            {recommendedItems.length} worth reading
          </span>
          {filteredItems.length > 0 && (
            <>
              <span style={{ color: theme.textMuted }}>·</span>
              <button
                onClick={() => setShowFiltered(!showFiltered)}
                className="flex items-center gap-1 hover:underline"
                data-track="feed.togglefiltered"
                style={{ color: theme.textMuted }}
              >
                {filteredItems.length} filtered
                {showFiltered ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Personalization signals */}
      {items.length > 0 && !loading && signals && (
        <SignalsBar signals={signals} palette={palette} theme={theme} />
      )}

      {/* Error state */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm mb-4"
          style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}
        >
          {error}
        </div>
      )}

      {/* Briefing */}
      {briefing && briefing.news && briefing.news.length > 0 && !loading && (
        <div
          className="p-4 rounded-xl mb-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-800 border"
          style={{ borderColor: theme.border }}
        >
          <StructuredBriefing briefing={briefing} items={items} generatedAt={generatedAt} palette={palette} theme={theme} onAddContext={onAddContext} onMarkBriefingRead={onMarkBriefingRead} onMarkBriefingUnread={onMarkBriefingUnread} onStarBriefing={onStarBriefing} onUnstarBriefing={onUnstarBriefing} starredBriefingTexts={starredBriefingTexts} readBriefingTexts={readBriefingTexts} />
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && !loading && (
        <InsightsSection insights={insights} palette={palette} theme={theme} onAddContext={onAddContext} />
      )}

      {/* Message (empty state or degraded mode) */}
      {message && !loading && (
        <div
          className={`rounded-xl text-sm border ${items.length === 0 ? "p-6 text-center" : "px-3 py-2 mb-4"}`}
          style={{ borderColor: theme.border, color: theme.textMuted }}
        >
          {message}
        </div>
      )}

      {/* Loading state — replaces stale content entirely; the date pills
          above stay available for jumping back to a previous snapshot */}
      {loading && (
        <FeedLoadingState
          searchConfigured={searchConfigured}
          onOpenSettings={onOpenSettings}
          palette={palette}
          theme={theme}
        />
      )}

      {/* Empty state */}
      {isEmpty && (
        <div
          className="p-6 rounded-xl border text-center text-sm"
          style={{ borderColor: theme.border }}
        >
          <p className="font-medium mb-1" style={{ color: theme.text }}>
            Nothing here yet
          </p>
          <p className="text-xs max-w-md mx-auto" style={{ color: theme.textMuted }}>
            Your RSS feeds may be temporarily unavailable or rate-limited. Try refreshing in a
            minute{onOpenSettings ? ", or add more feeds in Settings → Feed" : ""}.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              data-track="feed.empty_refresh"
              style={{ backgroundColor: palette[500] }}
            >
              Refresh
            </button>
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                data-track="feed.empty_open_settings"
                style={{ borderColor: theme.border, color: theme.text }}
              >
                Open Settings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pinterest-style Grid */}
      {!loading && recommendedItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {recommendedItems.map((item) => {
            const originalIndex = items.findIndex(i => i.id === item.id);
            return (
              <FeedCard
                key={item.id}
                item={item}
                index={originalIndex + 1}
                onCapture={onCapture}
                onDismiss={onDismiss}
                formatRelativeTime={formatRelativeTime}
                theme={theme}
              />
            );
          })}
        </div>
      )}

      {/* Filtered items (shown when toggled) */}
      {!loading && showFiltered && filteredItems.length > 0 && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4" style={{ color: theme.textMuted }} />
            <span className="text-sm" style={{ color: theme.textMuted }}>
              Filtered items (you likely already know this)
            </span>
          </div>
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{ backgroundColor: theme.bgMuted }}
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline line-clamp-1"
                    style={{ color: theme.textMuted }}
                  >
                    {item.title}
                  </a>
                  {item.scoring.whySkip && (
                    <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                      {item.scoring.whySkip}
                    </p>
                  )}
                </div>
                <span className="text-xs shrink-0" style={{ color: theme.textMuted }}>
                  {item.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interests (debugging/transparency) */}
      {!loading && interests.length > 0 && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: theme.border }}>
          <p className="text-xs mb-2" style={{ color: theme.textMuted }}>
            Searching for:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((interest, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded-full bg-slate-100"
                style={{ color: theme.textMuted }}
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

/**
 * Loading state: a step checklist that visualizes the agent pipeline, so a
 * ~1 minute curation reads as deliberate work instead of a hang.
 */
function FeedLoadingState({
  searchConfigured,
  onOpenSettings,
  palette,
  theme,
}: {
  searchConfigured?: boolean;
  onOpenSettings?: () => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { label: searchConfigured ? "Fetch RSS feeds and search the news" : "Fetch your RSS feeds", doneAt: 10 },
    { label: "Agent reads every story, picks what's worth your time", doneAt: 40 },
    { label: "Write your briefing", doneAt: Infinity },
  ];
  const activeIndex = steps.findIndex((step) => elapsed < step.doneAt);

  return (
    <div className="max-w-md mx-auto mt-10 rounded-xl border p-5" style={{ borderColor: theme.border }}>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-sm font-semibold" style={{ color: theme.text }}>
          Curating your feed
        </span>
        <span className="text-xs tabular-nums" style={{ color: theme.textMuted }}>
          {elapsed}s
        </span>
      </div>

      <div className="space-y-3 mb-4">
        {steps.map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
          return (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <span className="w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center">
                {state === "done" ? (
                  <Check className="w-4 h-4" style={{ color: palette[600] }} />
                ) : state === "active" ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: palette[500] }} />
                ) : (
                  <span className="w-3 h-3 rounded-full border-2" style={{ borderColor: theme.border }} />
                )}
              </span>
              <span
                style={{
                  color: state === "active" ? theme.text : theme.textMuted,
                  fontWeight: state === "active" ? 500 : 400,
                }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs" style={{ color: theme.textMuted }}>
        First load takes about a minute. Instant from cache after that.
      </p>

      {(!searchConfigured || onOpenSettings) && (
        <div className="mt-4 pt-3 border-t space-y-1 text-xs" style={{ borderColor: theme.border }}>
          {!searchConfigured && (
            <p style={{ color: theme.textMuted }}>
              Web search off — using RSS feeds only. A free{" "}
              <a
                href="https://brave.com/search/api/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80"
                style={{ color: palette[600] }}
              >
                Brave Search key
              </a>{" "}
              in <code className="px-1 rounded" style={{ backgroundColor: theme.bgMuted }}>.env.local</code> enables it.
            </p>
          )}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="hover:underline"
              data-track="feed.loading_open_settings"
              style={{ color: palette[600] }}
            >
              Add your feeds in Settings → Feed
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Signals bar: one-line summary of what sources the feed is curated from
 */
function SignalsBar({
  signals,
  palette,
  theme,
}: {
  signals?: FeedSignals;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const parts: string[] = [];
  if (signals?.rssFeedCount) parts.push(`${signals.rssFeedCount} RSS feed${signals.rssFeedCount > 1 ? "s" : ""}`);
  if (signals?.radarCount) parts.push(`${signals.radarCount} configured radar${signals.radarCount > 1 ? "s" : ""}`);
  if (parts.length === 0) return null;

  return (
    <div className="px-3 mb-4 text-xs" style={{ color: theme.textMuted }}>
      <span>Curated from </span>
      <span style={{ color: palette[600] }}>{parts.join(" and ")}</span>
    </div>
  );
}

/**
 * Parse snapshot key "2026-02-10T14-30" into a Date (local time)
 */
function parseSnapshotKey(key: string): Date {
  // "2026-02-10T14-30" → "2026-02-10T14:30"
  const iso = key.replace(/T(\d{2})-(\d{2})/, "T$1:$2");
  return new Date(iso);
}

/**
 * Horizontal date pills for browsing past feeds, grouped by day
 */
function DateSelector({
  dates,
  selectedDate,
  onSelectDate,
  palette,
  theme,
}: {
  dates: string[];
  selectedDate: string | null;
  onSelectDate?: (date: string | null) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    const previousDay = new Date(now);
    previousDay.setDate(now.getDate() - 1);
    return {
      today: now.toISOString().slice(0, 10),
      yesterday: previousDay.toISOString().slice(0, 10),
    };
  });

  // Group keys by day
  const grouped: { day: string; keys: string[] }[] = [];
  for (const key of dates) {
    const day = key.slice(0, 10);
    const last = grouped[grouped.length - 1];
    if (last && last.day === day) {
      last.keys.push(key);
    } else {
      grouped.push({ day, keys: [key] });
    }
  }

  const formatDayLabel = (day: string) => {
    if (day === today) return "Today";
    if (day === yesterday) return "Yesterday";
    const d = new Date(day + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTimeLabel = (key: string) => {
    const d = parseSnapshotKey(key);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const isActive = (key: string) => {
    if (!selectedDate && key === dates[0]) return true;
    return key === selectedDate;
  };

  const pillStyle = (active: boolean) =>
    active
      ? { backgroundColor: palette[500], color: "white" }
      : { backgroundColor: "transparent", color: theme.textMuted, border: `1px solid ${theme.border}` };

  return (
    <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
      {grouped.map((group) => (
        <React.Fragment key={group.day}>
          {group.keys.length === 1 ? (
            // Single snapshot for this day — show day label
            <button
              onClick={() => {
                if (group.keys[0] === dates[0]) {
                  onSelectDate?.(null);
                } else {
                  onSelectDate?.(group.keys[0]);
                }
              }}
              className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
              data-track="feed.date_select"
              style={pillStyle(isActive(group.keys[0]))}
            >
              {formatDayLabel(group.day)}
            </button>
          ) : (
            // Multiple snapshots for this day — show day label + time pills
            <>
              <span className="text-[10px] font-medium pl-1" style={{ color: theme.textMuted }}>
                {formatDayLabel(group.day)}
              </span>
              {group.keys.map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === dates[0]) {
                      onSelectDate?.(null);
                    } else {
                      onSelectDate?.(key);
                    }
                  }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
                  data-track="feed.date_select"
                  style={pillStyle(isActive(key))}
                >
                  {formatTimeLabel(key)}
                </button>
              ))}
            </>
          )}
          {/* Separator between day groups */}
          {group !== grouped[grouped.length - 1] && (
            <div className="w-px h-4 mx-0.5" style={{ backgroundColor: theme.border }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Collapsible section showing AI-generated insights from reading behavior
 */
function InsightsSection({
  insights,
  palette,
  theme,
  onAddContext,
}: {
  insights: InsightItem[];
  palette: Record<number, string>;
  theme: Record<string, string>;
  onAddContext?: (text: string, title: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const plainText = insights.map(i => i.text.replace(/\*\*([^*]+)\*\*/g, "$1")).join("\n");

  return (
    <div
      className="rounded-xl mb-6 border overflow-hidden"
      style={{ borderColor: theme.border }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors"
        data-track="insights.toggle"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: palette[600] }}>
            Insights about you
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
          >
            {insights.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onAddContext && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onAddContext(plainText, "Reading Insights");
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: palette[500] }}
            >
              <Plus className="w-3 h-3" />
              Context
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: theme.textMuted }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="animate-[fadeSlideUp_0.3s_ease-out_both]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {i > 0 && (
                <div className="h-px mx-2 my-1" style={{ backgroundColor: theme.border }} />
              )}
              <p className="text-sm leading-relaxed py-2.5 px-2" style={{ color: theme.text }}>
                <TextWithBold text={insight.text} palette={palette} highlight />
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders structured briefing as single-column cards with check toggle
 */
function StructuredBriefing({
  briefing,
  items,
  generatedAt,
  palette,
  theme,
  onAddContext,
  onMarkBriefingRead,
  onMarkBriefingUnread,
  onStarBriefing,
  onUnstarBriefing,
  starredBriefingTexts,
  readBriefingTexts,
}: {
  briefing: StructuredBriefingType;
  items: FeedItem[];
  generatedAt: string | null;
  palette: Record<number, string>;
  theme: Record<string, string>;
  onAddContext?: (text: string, title: string) => void;
  onMarkBriefingRead?: (text: string, urls: string[]) => void;
  onMarkBriefingUnread?: (text: string, urls: string[]) => void;
  onStarBriefing?: (text: string, meta?: { feedDate?: string; refs?: { url: string; title: string }[] }) => void;
  onUnstarBriefing?: (text: string) => void;
  starredBriefingTexts?: Set<string>;
  readBriefingTexts?: Set<string>;
}) {
  const scrollToRef = (num: number) => {
    const el = document.getElementById(`feed-item-${num}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-offset-2");
    setTimeout(() => el?.classList.remove("ring-2", "ring-offset-2"), 1500);
  };

  const toggleRead = (index: number) => {
    const newsItem = briefing.news[index];
    const text = newsItem.text || "";
    const urls = newsItem.refs
      .map(ref => items[ref - 1]?.url)
      .filter(Boolean) as string[];
    if (readBriefingTexts?.has(text)) {
      onMarkBriefingUnread?.(text, urls);
    } else {
      onMarkBriefingRead?.(text, urls);
    }
  };

  const toggleStar = (index: number) => {
    const newsItem = briefing.news[index];
    const text = newsItem.text || "";
    const isStarred = starredBriefingTexts?.has(text);
    if (isStarred) {
      onUnstarBriefing?.(text);
    } else {
      const refs = newsItem.refs
        .map(ref => items[ref - 1])
        .filter(Boolean)
        .map(item => ({ url: item.url, title: item.title }));
      onStarBriefing?.(text, { feedDate: generatedAt ?? undefined, refs });
    }
  };

  const plainText = briefing.news.map(n => n.text.replace(/\*\*([^*]+)\*\*/g, "$1")).join("\n");

  return (
    <div className="space-y-4 group/briefing">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: palette[600] }}>
          What&apos;s new
        </h4>
        {onAddContext && (
          <button
            onClick={() => onAddContext(plainText, "What's New Briefing")}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: palette[500] }}
            title="Add to Agent context"
          >
            <Plus className="w-3 h-3" />
            <span>Context</span>
          </button>
        )}
      </div>

      {/* News items — single column */}
      <div className="space-y-2">
        {briefing.news.map((newsItem, i) => {
          const text = newsItem.text || "";
          const isRead = readBriefingTexts?.has(text) ?? false;
          const isStarred = starredBriefingTexts?.has(text) ?? false;
          return (
            <div
              key={i}
              className="group/card flex items-start gap-2.5 p-3 rounded-lg cursor-pointer transition-all hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
              style={{ opacity: isRead ? 0.35 : 1 }}
              data-track={isRead ? "briefing.mark_unread" : "briefing.mark_read"}
              onClick={(e) => {
                // Don't toggle if clicking a ref badge
                if ((e.target as HTMLElement).closest("[data-ref-badge]")) return;
                // Don't toggle if user is selecting text
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                toggleRead(i);
              }}
            >
              {/* Star — left side */}
              <button
                data-ref-badge
                onClick={(e) => { e.stopPropagation(); toggleStar(i); }}
                className="shrink-0 mt-1 transition-colors"
                data-track="briefing.star"
                title={isStarred ? "Unstar" : "Star"}
              >
                <Star
                  className="w-4 h-4"
                  style={{
                    color: isStarred ? "#f59e0b" : theme.border,
                    fill: isStarred ? "#f59e0b" : "none",
                  }}
                />
              </button>

              {/* Text content */}
              <p className="flex-1 text-sm leading-relaxed" style={{ color: theme.text }}>
                {newsItem.refs.map((ref) => (
                  <button
                    key={ref}
                    data-ref-badge
                    onClick={(e) => { e.stopPropagation(); scrollToRef(ref); }}
                    className="inline-flex font-bold mr-1.5 px-1.5 py-0.5 rounded-full text-[10px] hover:underline align-middle"
                    style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                    title={items[ref - 1]?.title}
                  >
                    #{ref}
                  </button>
                ))}
                <TextWithBold text={newsItem.text || ""} palette={palette} />
              </p>

              {/* Check — right side */}
              <div
                className="shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                style={{
                  borderColor: isRead ? palette[500] : theme.border,
                  backgroundColor: isRead ? palette[500] : "transparent",
                  color: isRead ? "white" : theme.textMuted,
                }}
              >
                {isRead && <Check className="w-3 h-3" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Go deeper */}
      {briefing.goDeeper.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: theme.border }}>
          <h4 className="text-sm font-semibold mb-2" style={{ color: theme.text }}>
            Go deeper
          </h4>
          <div className="space-y-1">
            {briefing.goDeeper.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <button
                  onClick={() => scrollToRef(item.ref)}
                  className="font-bold shrink-0 px-1.5 py-0.5 rounded-full text-xs hover:underline"
                  style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                  title={items[item.ref - 1]?.title}
                >
                  #{item.ref}
                </button>
                <span style={{ color: theme.textMuted }}>{item.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders text with **bold** markers highlighted
 */
function TextWithBold({
  text,
  palette,
  highlight = false,
}: {
  text: string;
  palette: Record<number, string>;
  highlight?: boolean;
}) {
  if (!text) return null;
  // Split on **bold** and *italic* markers (bold first to avoid conflicts)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return highlight ? (
            <mark key={i} className="font-medium bg-amber-100/70 dark:bg-amber-400/15 text-inherit rounded-sm px-0.5 py-[1px]" style={{ textDecorationColor: "transparent" }}>
              {boldMatch[1]}
            </mark>
          ) : (
            <span key={i} className="font-semibold" style={{ color: palette[700] }}>
              {boldMatch[1]}
            </span>
          );
        }
        const italicMatch = part.match(/^\*([^*]+)\*$/);
        if (italicMatch) {
          return <span key={i} className="underline decoration-1 underline-offset-2">{italicMatch[1]}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Pinterest-style feed card with thumbnail
 */
function FeedCard({
  item,
  index,
  onCapture,
  onDismiss,
  formatRelativeTime,
  theme,
}: {
  item: FeedItem;
  index: number;
  onCapture: (url: string) => void;
  onDismiss: (id: string) => void;
  formatRelativeTime: (date: string) => string;
  theme: Record<string, string>;
}) {
  const [imgError, setImgError] = useState(false);
  const [hovering, setHovering] = useState(false);

  // Accent color based on action
  const accentColor = item.scoring.action === "recommend" ? "#059669" : "#6b7280";

  // Use favicon as fallback if no thumbnail
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${item.source}&sz=64`;

  return (
    <div
      id={`feed-item-${index}`}
      className="rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden transition-all hover:shadow-md group"
      style={{
        borderColor: theme.border,
        ["--tw-ring-color" as string]: accentColor,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Thumbnail / Image area */}
      <div className="relative h-32 bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden">
        {item.thumbnail && !imgError ? (
          <img
            src={item.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={faviconUrl}
              alt=""
              className="w-12 h-12 opacity-30"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Index badge */}
        <div
          className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: accentColor }}
        >
          {index}
        </div>

        {/* Action buttons on hover */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity ${
            hovering ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCapture(item.url);
            }}
            className="px-3 py-1.5 bg-white dark:bg-zinc-700 rounded-lg text-xs font-medium shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors flex items-center gap-1"
            data-track="feed.card_save"
          >
            <Plus className="w-3.5 h-3.5" />
            Save
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/90 dark:bg-zinc-700/90 rounded-lg text-xs font-medium shadow-sm hover:bg-white dark:hover:bg-zinc-600 transition-colors flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </a>
        </div>

        {/* Dismiss button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(item.id);
          }}
          className={`absolute top-2 right-2 p-1 rounded-full bg-white/80 dark:bg-zinc-700/80 hover:bg-white dark:hover:bg-zinc-600 transition-all ${
            hovering ? "opacity-100" : "opacity-0"
          }`}
          data-track="feed.card_dismiss"
        >
          <X className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
        </button>
      </div>

      {/* Content */}
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3"
      >
        {/* Title */}
        <h3
          className="text-sm font-medium leading-snug line-clamp-2 mb-1 group-hover:underline"
          style={{ color: theme.text }}
        >
          {item.title}
        </h3>

        {/* Source + Time */}
        <div className="flex items-center gap-1.5 text-xs" style={{ color: theme.textMuted }}>
          <span>{item.source}</span>
          <span>·</span>
          <span>{formatRelativeTime(item.publishedAt)}</span>
        </div>

        {/* Why read */}
        {item.scoring.whyRead && (
          <p
            className="mt-2 text-xs leading-relaxed"
            style={{ color: theme.textMuted }}
          >
            {item.scoring.whyRead}
          </p>
        )}
        {/* Connects to existing library item */}
        {item.scoring.connectsTo && (
          <div
            className="mt-2 text-xs flex items-start gap-1.5 px-2 py-1.5 rounded-md"
            style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
          >
            <span className="opacity-70 flex-shrink-0">Related:</span>
            <span className="font-medium">{item.scoring.connectsTo}</span>
          </div>
        )}
      </a>
    </div>
  );
}
