"use client";

import React, { useState } from "react";
import { Rss, RefreshCw, ChevronDown, ChevronUp, X, ExternalLink, Plus, Filter, Image as ImageIcon } from "lucide-react";
import { FeedItem } from "@/lib/types";

interface FeedSectionProps {
  items: FeedItem[];
  interests: string[];
  generatedAt: string | null;
  fromCache: boolean;
  message?: string;
  briefing?: string;
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

  // Format relative time
  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

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
          <span style={{ color: theme.text }}>
            {recommendedItems.length} worth reading
          </span>
          {filteredItems.length > 0 && (
            <>
              <span style={{ color: theme.textMuted }}>•</span>
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
      {briefing && !loading && (
        <div
          className="p-4 rounded-xl mb-6 bg-gradient-to-r from-slate-50 to-slate-100 border"
          style={{ borderColor: theme.border }}
        >
          <StructuredBriefing text={briefing} items={items} palette={palette} theme={theme} onAddContext={onAddContext} />
        </div>
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
 * Renders structured briefing with section headers and clickable references
 */
function StructuredBriefing({
  text,
  items,
  palette,
  theme,
  onAddContext,
}: {
  text: string;
  items: FeedItem[];
  palette: Record<number, string>;
  theme: Record<string, string>;
  onAddContext?: (text: string, title: string) => void;
}) {
  // Parse sections from text
  const sections: { title: string; content: string[] }[] = [];
  let currentSection: { title: string; content: string[] } | null = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a section header (starts with **)
    const headerMatch = trimmed.match(/^\*\*(.+?)\*\*$/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: headerMatch[1], content: [] };
    } else if (currentSection) {
      currentSection.content.push(trimmed);
    }
  }
  if (currentSection) sections.push(currentSection);

  // Find specific sections
  const whatsNew = sections.find(s => s.title.toLowerCase().includes("what"));
  const connects = sections.find(s => s.title.toLowerCase().includes("connect") || s.title.toLowerCase().includes("matter"));
  const goDeeper = sections.find(s => s.title.toLowerCase().includes("deeper") || s.title.toLowerCase().includes("start"));

  // Helper to strip markdown formatting for plain text context
  const stripMarkdown = (lines: string[]) =>
    lines.map(l => l.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/#\d+/g, "")).join("\n");

  // Section header with optional "Add Context" button
  const SectionHeader = ({ title, content, color }: { title: string; content: string[]; color: string }) => (
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-sm font-semibold" style={{ color }}>
        {title}
      </h4>
      {onAddContext && (
        <button
          onClick={() => onAddContext(stripMarkdown(content), title)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs opacity-0 group-hover/section:opacity-60 hover:!opacity-100 transition-opacity"
          style={{ color: palette[500] }}
          title="Add to Agent context"
        >
          <Plus className="w-3 h-3" />
          <span>Context</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4 group/briefing">
      {/* Top row: What's new + Connects side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* What's new */}
        {whatsNew && (
          <div
            className="group/section p-4 rounded-lg"
            style={{ backgroundColor: `${palette[500]}08` }}
          >
            <SectionHeader title={whatsNew.title} content={whatsNew.content} color={palette[600]} />
            <div className="space-y-1.5">
              {whatsNew.content.map((line, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                  <TextWithRefs text={line} items={items} palette={palette} theme={theme} />
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Connects to your knowledge */}
        {connects && (
          <div
            className="group/section p-4 rounded-lg"
            style={{ backgroundColor: theme.bgMuted }}
          >
            <SectionHeader title="Connects to your knowledge" content={connects.content} color={theme.text} />
            <div className="space-y-1.5">
              {connects.content.map((line, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>
                  <TextWithRefs text={line} items={items} palette={palette} theme={theme} />
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Go deeper */}
      {goDeeper && (
        <div className="group/section pt-3 border-t" style={{ borderColor: theme.border }}>
          <SectionHeader title={goDeeper.title} content={goDeeper.content} color={theme.text} />
          <div className="space-y-1">
            {goDeeper.content.map((line, i) => (
              <p key={i} className="text-sm" style={{ color: theme.textMuted }}>
                <TextWithRefs text={line} items={items} palette={palette} theme={theme} />
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders text with clickable #N references and bold formatting
 */
function TextWithRefs({
  text,
  items,
  palette,
  theme,
}: {
  text: string;
  items: FeedItem[];
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  // Parse bold markers and #N references
  const parts = text.split(/(\*\*[^*]+\*\*|#\d+)/g);

  return (
    <>
      {parts.map((part, i) => {
        // Handle bold text - make it stand out more
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <span key={i} className="font-semibold" style={{ color: palette[700] }}>
              {boldMatch[1]}
            </span>
          );
        }

        // Handle #N references
        const refMatch = part.match(/^#(\d+)$/);
        if (refMatch) {
          const num = parseInt(refMatch[1], 10);
          const item = items[num - 1];
          if (item) {
            return (
              <button
                key={i}
                onClick={() => {
                  const el = document.getElementById(`feed-item-${num}`);
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  el?.classList.add("ring-2", "ring-offset-2");
                  setTimeout(() => el?.classList.remove("ring-2", "ring-offset-2"), 1500);
                }}
                className="font-medium hover:underline px-1 py-0.5 rounded bg-slate-200/50"
                style={{ color: palette[600] }}
                title={item.title}
              >
                #{num}
              </button>
            );
          }
        }

        return <span key={i} style={{ color: theme.textMuted }}>{part}</span>;
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
      className="rounded-xl border bg-white overflow-hidden transition-all hover:shadow-md group"
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
            className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Save
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-medium shadow-sm hover:bg-white transition-colors flex items-center gap-1"
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
          className={`absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white transition-all ${
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
