"use client";

import React, { useState } from "react";
import { Rss, RefreshCw, ChevronDown, ChevronUp, X, ExternalLink, Plus, Filter } from "lucide-react";
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
  onCapture: (url: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
  onAddContext?: (text: string, title: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}

export function FeedSection({
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
  onCapture,
  onDismiss,
  onRefresh,
  onAddContext,
  palette,
  theme,
}: FeedSectionProps) {
  const [showFiltered, setShowFiltered] = useState(false);

  // Separate items into recommended and filtered
  const recommendedItems = items.filter(item => item.scoring.action === "recommend");
  const filteredItems = items.filter(item => item.scoring.action === "skip");

  // Format relative time (shared utility)

  // Don't render if no items and no message
  if (items.length === 0 && !message && !loading && !error && !briefing) {
    return null;
  }

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
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              style={{ color: theme.textMuted }}
            />
          </button>
        </div>
      </div>

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
      {items.length > 0 && !loading && (signals || interests.length > 0) && (
        <SignalsBar interests={interests} signals={signals} palette={palette} theme={theme} />
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
          <StructuredBriefing briefing={briefing} items={items} palette={palette} theme={theme} onAddContext={onAddContext} />
        </div>
      )}

      {/* Insights */}
      {insights && insights.length > 0 && !loading && (
        <InsightsSection insights={insights} palette={palette} theme={theme} onAddContext={onAddContext} />
      )}

      {/* Message (empty state or disabled) */}
      {message && items.length === 0 && !loading && (
        <div
          className="p-6 rounded-xl text-sm text-center border"
          style={{ borderColor: theme.border, color: theme.textMuted }}
        >
          {message}
        </div>
      )}

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: palette[500] }} />
            <span className="text-sm font-medium" style={{ color: theme.text }}>
              Searching news sources...
            </span>
          </div>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            This takes about 5 seconds (API rate limit)
          </p>
        </div>
      )}

      {/* Pinterest-style Grid */}
      {recommendedItems.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {recommendedItems.map((item, idx) => {
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
      {showFiltered && filteredItems.length > 0 && (
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
      {interests.length > 0 && (
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
}

/**
 * Signals bar: colored dots showing what the AI considered
 */
function SignalsBar({
  interests,
  signals,
  palette,
  theme,
}: {
  interests: string[];
  signals?: FeedSignals;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const dots: { label: string; color: string }[] = [];
  if (interests.length > 0) dots.push({ label: `${interests.length} configured radars`, color: palette[500] });
  if (signals?.libraryCount) dots.push({ label: `${signals.libraryCount} library articles`, color: palette[500] });
  if (signals?.interactionCount) dots.push({ label: `${signals.interactionCount} library interactions`, color: palette[500] });
  if (dots.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 mb-4 text-xs" style={{ color: theme.textMuted }}>
      <span>Based on</span>
      {dots.map((dot, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="mx-0.5">·</span>}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot.color }} />
            <span>{dot.label}</span>
          </span>
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl mb-6 border overflow-hidden"
      style={{ borderColor: theme.border, backgroundColor: `${palette[500]}05` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">💡</span>
          <span className="text-sm font-medium" style={{ color: theme.text }}>
            Insights from your reading
          </span>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
          >
            {insights.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onAddContext && expanded && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onAddContext(
                  insights.map(i => `${i.emoji} ${i.text}`).join("\n"),
                  "Reading Insights"
                );
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
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
        <div className="px-4 pb-4 space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: theme.bgMuted }}
            >
              <span className="text-base shrink-0 mt-0.5">{insight.emoji}</span>
              <p className="text-sm leading-relaxed" style={{ color: theme.text }}>
                {insight.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders structured briefing as interactive cards
 */
function StructuredBriefing({
  briefing,
  items,
  palette,
  theme,
  onAddContext,
}: {
  briefing: StructuredBriefingType;
  items: FeedItem[];
  palette: Record<number, string>;
  theme: Record<string, string>;
  onAddContext?: (text: string, title: string) => void;
}) {
  const scrollToRef = (num: number) => {
    const el = document.getElementById(`feed-item-${num}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("ring-2", "ring-offset-2");
    setTimeout(() => el?.classList.remove("ring-2", "ring-offset-2"), 1500);
  };

  const plainText = briefing.news.map(n => `${n.headline}: ${n.detail}`).join("\n");

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
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs opacity-0 group-hover/briefing:opacity-60 hover:!opacity-100 transition-opacity"
            style={{ color: palette[500] }}
            title="Add to Agent context"
          >
            <Plus className="w-3 h-3" />
            <span>Context</span>
          </button>
        )}
      </div>

      {/* News cards grid */}
      <div className="grid grid-cols-2 gap-3">
        {briefing.news.map((newsItem, i) => (
          <div
            key={i}
            className="p-3 rounded-lg border transition-colors hover:bg-slate-50/50 dark:hover:bg-zinc-800/50"
            style={{ borderColor: theme.border }}
          >
            {/* Ref badges */}
            <div className="flex items-center gap-1 mb-1.5">
              {newsItem.refs.map((ref) => (
                <button
                  key={ref}
                  onClick={() => scrollToRef(ref)}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full hover:underline"
                  style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                  title={items[ref - 1]?.title}
                >
                  #{ref}
                </button>
              ))}
            </div>

            {/* Headline */}
            <p className="text-sm font-semibold leading-snug mb-1" style={{ color: theme.text }}>
              {newsItem.headline}
            </p>

            {/* Detail */}
            <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
              {newsItem.detail}
            </p>

            {/* Connection badge */}
            {newsItem.connection && (
              <div
                className="mt-2 text-xs flex items-center gap-1 px-2 py-1 rounded-md"
                style={{ backgroundColor: `${palette[500]}10`, color: palette[600] }}
              >
                <span>🔗</span>
                <span>{newsItem.connection}</span>
              </div>
            )}
          </div>
        ))}
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
 * Pinterest-style feed card with thumbnail
 */
function FeedCard({
  item,
  index,
  onCapture,
  onDismiss,
  formatRelativeTime,
  theme,
  muted = false,
}: {
  item: FeedItem;
  index: number;
  onCapture: (url: string) => void;
  onDismiss: (id: string) => void;
  formatRelativeTime: (date: string) => string;
  theme: Record<string, string>;
  muted?: boolean;
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
