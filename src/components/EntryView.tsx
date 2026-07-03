"use client";

import React, { useState, useEffect } from "react";
import {
  Loader2,
  RefreshCw,
  HelpCircle,
  Star,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
} from "lucide-react";
import { ActionType, Highlight, ResolvedConnection, ConnectionType, Connection, SourceType, UserHighlight } from "@/lib/types";
import { SourceError } from "./SourceError";
import { MarkdownContent } from "./MarkdownContent";
import { EntryActions } from "./EntryActions";
import { StarRating } from "./StarRating";
import { useResizable } from "@/hooks/useResizable";
import { useReadingProgress } from "@/hooks/useReadingProgress";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { formatRelativeTime } from "@/lib/utils";
/** Format seconds as M:SS or H:MM:SS */
function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

function toSourceType(type: string | undefined): SourceType {
  if (type === "text" || type === "document" || type === "image") return type;
  return "html";
}

// Unified entry interface - works for both Source and Document
export interface EntryData {
  id: string;
  title: string;
  content: string;
  sourceUrl?: string;
  createdAt?: string; // ISO timestamp
  type?: string; // "article", "image", etc.
  processingStatus?: "processing" | "ready" | "failed";
  analysisError?: string;
  saved?: boolean;
  totalReadTimeSeconds?: number; // Active reading time tracked by client
  // Analysis is optional - only for Sources
  analysis?: {
    triage: {
      score?: number;
      action: ActionType;
      reason: string;
      readTimeMinutes: number;
      density: number;
      originality: number;
    };
    digest: {
      summary: string;
      highlights?: Highlight[];
      concepts: { id: string; term: string; definition: string; status?: "knew" | "learned" }[];
    };
    critique: {
      hiddenAssumptions: string[];
      potentialIssues: string[];
      needsVerification: string[];
    };
    connections?: (Connection & { relatedSourceTitles?: string[] })[];
    connectionError?: string;
    userRating?: number;
    userRatingAt?: string;
  };
}

export interface EntryViewProps {
  entry: EntryData;
  // Save handler - called with updated title and content
  onSave: (title: string, content: string) => Promise<void>;
  onClose?: () => void;
  // Bookmark/save toggle
  onToggleSaved?: (saved: boolean) => void;
  // Source-specific handlers (optional)
  onMarkUnread?: () => void;
  onReanalyze?: () => void;
  onReaction?: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  onRating?: (rating: number | undefined) => void;
  highlights?: UserHighlight[];
  onRemoveHighlight?: (highlightId: string) => void;
  onNavigateToSource?: (sourceId: string) => void;
  isReanalyzing?: boolean;
  // Original file viewing (for Sources)
  originalFileUrl?: string;
  // Theming
  palette: Record<number, string>;
  theme: Record<string, string>;
  getActionConfig?: (action: ActionType) => { icon: React.ReactNode; label: string; description: string; color: string };
  getScoreColor?: (score: number) => string;
  // Reading customization
  fontSize?: string;
  headingStyle?: string;
}

export const EntryView = React.memo(function EntryView({
  entry,
  onSave,
  onClose,
  onToggleSaved,
  onMarkUnread,
  onReanalyze,
  onReaction,
  onRating,
  highlights,
  onRemoveHighlight,
  onNavigateToSource,
  isReanalyzing = false,
  originalFileUrl,
  palette,
  theme,
  getActionConfig,
  getScoreColor,
  fontSize,
  headingStyle,
}: EntryViewProps) {
  const hasAnalysis = !!entry.analysis;
  const analysis = entry.analysis;

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(entry.content);
  const [editedTitle, setEditedTitle] = useState(entry.title);
  const [isSaving, setIsSaving] = useState(false);
  const [viewOriginal, setViewOriginal] = useState(false);
  const [zoom, setZoom] = useState(100);
  const readingScrollRef = React.useRef<HTMLDivElement>(null);
  const isReadingMode = !isEditing && !viewOriginal && entry.content.trim().length > 0;
  const readingProgress = useReadingProgress(
    readingScrollRef,
    `${entry.id}:${entry.content.length}`,
    isReadingMode,
  );
  useScrollRestore(readingScrollRef, `${entry.id}:${entry.content.length}`, isReadingMode);
  const showReadingProgress = !isEditing
    && !viewOriginal
    && entry.content.trim().length > 0
    && readingProgress.hasScrollableContent;
  const [activeTab, setActiveTab] = useState<"digest" | "critique">("digest");

  // Resizable analysis panel
  const containerRef = React.useRef<HTMLDivElement>(null);
  const analysisResize = useResizable({
    initialWidth: 384,
    minWidth: 280,
    maxWidth: 600,
    storageKey: "analysisWidth",
    computeWidth: (e) => {
      if (!containerRef.current) return 384;
      const containerRect = containerRef.current.getBoundingClientRect();
      return containerRect.right - e.clientX;
    },
  });

  // Reset state when entry changes
  useEffect(() => {
    setEditedContent(entry.content);
    setEditedTitle(entry.title);
    setIsEditing(false);
    setViewOriginal(false);
    setZoom(100);
  }, [entry.id, entry.content, entry.title]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleZoomReset = () => setZoom(100);

  const handleSave = async () => {
    const titleChanged = editedTitle !== entry.title;
    const contentChanged = editedContent !== entry.content;

    if (!titleChanged && !contentChanged) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editedTitle, editedContent);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(entry.content);
    setEditedTitle(entry.title);
    setIsEditing(false);
  };

  // Handle failed processing state (Sources only)
  if (entry.processingStatus === "failed") {
    return (
      <SourceError
        meta={{
          id: entry.id,
          title: entry.title,
          type: toSourceType(entry.type),
          sourceUrl: entry.sourceUrl,
          createdAt: entry.createdAt ?? "",
          processingStatus: "failed",
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="flex items-stretch">
      {/* Content Area */}
      <div className="flex-1 min-w-0 h-[calc(100vh-100px)] sticky top-0 pr-2">
        <div className="bg-white dark:bg-zinc-900 border rounded-xl pt-6 pl-6 pb-6 h-full flex flex-col min-w-0 overflow-hidden" style={{ borderColor: theme.border }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-2 pr-6" data-entry-header>
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-semibold leading-tight flex-1 min-w-0 border-b-2 outline-none bg-transparent"
                style={{ borderColor: palette[500] }}
              />
            ) : (
              <h1 className="text-2xl font-semibold leading-tight flex-1 min-w-0">{entry.title}</h1>
            )}
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: palette[600] }}
                    title="Save changes"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <EntryActions
                  saved={entry.saved}
                  sourceUrl={entry.sourceUrl}
                  viewOriginal={viewOriginal}
                  isReanalyzing={isReanalyzing}
                  hasOriginalFile={!!originalFileUrl}
                  onToggleSaved={onToggleSaved}
                  onEdit={() => setIsEditing(true)}
                  onReanalyze={onReanalyze}
                  onToggleViewOriginal={() => setViewOriginal(!viewOriginal)}
                  onMarkUnread={onMarkUnread}
                  onClose={onClose}
                  palette={palette}
                  theme={theme}
                />
              )}
            </div>
          </div>

          {/* Source URL and timestamp */}
          {(entry.sourceUrl || entry.createdAt) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 max-w-full text-sm leading-snug pr-6" style={{ color: theme.textLight }}>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 max-w-full truncate hover:underline"
                >
                  {new URL(entry.sourceUrl).hostname} ↗
                </a>
              )}
              {entry.sourceUrl && entry.createdAt && <span>·</span>}
              {entry.createdAt && (
                <span>Added {formatRelativeTime(entry.createdAt)}</span>
              )}
              {entry.content && (() => {
                const text = entry.content.trim();
                // CJK characters each count as a word
                const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g);
                // Non-CJK: split by whitespace
                const nonCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+/g, " ");
                const words = nonCjk.trim().split(/\s+/).filter(Boolean);
                const count = (cjk?.length ?? 0) + words.length;
                return count > 0 ? <><span>·</span><span>{count.toLocaleString()} words</span></> : null;
              })()}
            </div>
          )}

          {showReadingProgress && (
            <ReadingProgressMeter
              seenPercent={readingProgress.seenPercent}
              herePercent={readingProgress.herePercent}
              isComplete={readingProgress.isComplete}
              palette={palette}
              theme={theme}
            />
          )}

          {/* Content */}
          <div className={`${showReadingProgress ? "mt-4" : "mt-6"} flex-1 min-h-0 overflow-hidden`}>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full p-4 border rounded-lg font-mono text-sm resize-none outline-none mr-6"
                style={{ borderColor: theme.border }}
                placeholder="Markdown content..."
              />
            ) : viewOriginal && originalFileUrl ? (
              <div className="h-full w-full flex flex-col rounded-lg overflow-hidden border mr-6" style={{ borderColor: theme.border }}>
                {/* Zoom controls */}
                <div
                  className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
                  style={{ borderColor: theme.border, backgroundColor: theme.borderLight }}
                >
                  <span className="text-xs font-medium" style={{ color: theme.textMuted }}>{zoom}%</span>
                  <div className="flex items-center gap-1">
                    <button onClick={handleZoomOut} disabled={zoom <= 50} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30" title="Zoom out">
                      <ZoomOut className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                    <button onClick={handleZoomReset} disabled={zoom === 100} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30" title="Reset zoom">
                      <RotateCcw className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                    <button onClick={handleZoomIn} disabled={zoom >= 200} className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30" title="Zoom in">
                      <ZoomIn className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                  </div>
                </div>
                {/* Content with zoom */}
                <div className="flex-1 overflow-auto bg-gray-50 dark:bg-zinc-800">
                  {entry.type === "image" ? (
                    <img
                      src={originalFileUrl}
                      alt={entry.title}
                      className="transition-transform origin-top-left"
                      style={{ transform: `scale(${zoom / 100})`, maxWidth: zoom <= 100 ? '100%' : 'none' }}
                    />
                  ) : (
                    <iframe
                      key={originalFileUrl}
                      src={originalFileUrl}
                      className="bg-white origin-top-left"
                      title="Original source"
                      style={{ width: `${10000 / zoom}%`, height: `${10000 / zoom}%`, transform: `scale(${zoom / 100})` }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div ref={readingScrollRef} className="h-full overflow-y-auto pr-6" data-highlightable>
                <MarkdownContent
                  content={entry.content}
                  palette={palette}
                  highlights={highlights}
                  onRemoveHighlight={onRemoveHighlight}
                  fontSize={fontSize}
                  headingStyle={headingStyle}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Panel - only for Sources with analysis */}
      {hasAnalysis && (
        <>
          {/* Resize Handle */}
          <div className="self-stretch flex items-center mx-2">
            <div
              className="w-1 h-full cursor-col-resize group relative"
              onMouseDown={analysisResize.startResize}
            >
              <div className={`w-0.5 h-full rounded transition-colors ${analysisResize.isResizing ? "bg-black/30 dark:bg-white/30" : "bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20"}`} />
            </div>
          </div>

          {analysis && getActionConfig && getScoreColor ? (
            <div className="flex-shrink-0 pl-2" style={{ width: analysisResize.width }}>
              {/* Triage Card */}
              {(() => {
                const score = analysis.triage.score ?? 50;
                const scoreColor = getScoreColor(score);
                const actionConfig = getActionConfig(analysis.triage.action);
                return (
                  <div className="p-4 mb-4 rounded-xl border" style={{ borderColor: theme.border }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl font-bold" style={{ color: scoreColor }}>{score}</span>
                      <span
                        className="px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5"
                        style={{ backgroundColor: `${actionConfig.color}15`, color: actionConfig.color }}
                      >
                        {actionConfig.icon}
                        {actionConfig.label}
                      </span>
                    </div>
                    <div className="h-2 rounded-full mb-3" style={{ backgroundColor: theme.borderLight }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: scoreColor }} />
                    </div>
                    <p className="text-sm mb-4 break-words" style={{ color: theme.textMuted }}>{analysis.triage.reason}</p>
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <div className="font-medium font-mono tabular-nums">
                          {entry.totalReadTimeSeconds != null && entry.totalReadTimeSeconds > 0
                            ? <>{formatTimer(entry.totalReadTimeSeconds)} <span className="font-normal opacity-50">/ {analysis.triage.readTimeMinutes}m</span></>
                            : analysis.triage.readTimeMinutes
                          }
                        </div>
                        <div style={{ color: theme.textLight }}>
                          {entry.totalReadTimeSeconds != null && entry.totalReadTimeSeconds > 0 ? "read time" : "min"}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{analysis.triage.density}%</div>
                        <div style={{ color: theme.textLight }}>density</div>
                      </div>
                      <div>
                        <div className="font-medium">{analysis.triage.originality}%</div>
                        <div style={{ color: theme.textLight }}>originality</div>
                      </div>
                    </div>
                    {onRating && (
                      <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${theme.border}` }}>
                        <span className="text-xs" style={{ color: theme.textLight }}>Your rating</span>
                        <StarRating value={analysis.userRating} onChange={onRating} theme={theme} />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Connections Section */}
              {analysis.connections === undefined && !analysis.connectionError ? (
                <div className="p-4 mb-4 rounded-xl border" style={{ borderColor: theme.border }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center animate-pulse-bubble" style={{ backgroundColor: `${palette[500]}15` }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: palette[500] }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: theme.text }}>Finding connections</p>
                      <p className="text-xs" style={{ color: theme.textMuted }}>Linking to existing sources...</p>
                    </div>
                  </div>
                </div>
              ) : analysis.connectionError ? (
                <div className="p-3 mb-4 rounded-xl border text-sm" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#b91c1c" }}>
                  <p className="font-medium mb-1">Connection analysis failed</p>
                  <p className="text-xs opacity-80">{analysis.connectionError}</p>
                </div>
              ) : analysis.connections && analysis.connections.length > 0 ? (
                <ConnectionsSection
                  connections={analysis.connections as ResolvedConnection[]}
                  onNavigate={onNavigateToSource}
                  palette={palette}
                  theme={theme}
                />
              ) : null}

              {/* Tabs */}
              <div className="flex gap-0.5 mb-4 p-1 rounded-xl" style={{ backgroundColor: theme.borderLight }}>
                {(["digest", "critique"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all capitalize ${activeTab === tab ? "bg-white dark:bg-zinc-800" : ""}`}
                    data-track={`tab.${tab}`}
                    style={activeTab === tab ? { color: theme.text } : { color: theme.textMuted }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4 rounded-xl border" style={{ borderColor: theme.border }}>
                {activeTab === "digest" && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Summary</h4>
                      <p className="text-sm" style={{ color: theme.textMuted }}>{analysis.digest.summary}</p>
                    </div>
                    {(analysis.digest.highlights?.length ?? 0) > 0 && onReaction && (
                      <HighlightsSection highlights={analysis.digest.highlights!} onReaction={onReaction} palette={palette} theme={theme} />
                    )}
                    {(analysis.digest.concepts?.length ?? 0) > 0 && onReaction && (
                      <ConceptsSection concepts={analysis.digest.concepts} onReaction={onReaction} palette={palette} theme={theme} />
                    )}
                  </div>
                )}

                {activeTab === "critique" && (
                  <div className="space-y-4">
                    {analysis.critique.hiddenAssumptions.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Hidden Assumptions</h4>
                        <ul className="space-y-1.5">
                          {analysis.critique.hiddenAssumptions.map((item, i) => (
                            <li key={i} className="text-sm" style={{ color: theme.textMuted }}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.critique.potentialIssues.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Potential Issues</h4>
                        <ul className="space-y-1.5">
                          {analysis.critique.potentialIssues.map((item, i) => (
                            <li key={i} className="text-sm" style={{ color: theme.textMuted }}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.critique.needsVerification.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Needs Verification</h4>
                        <ul className="space-y-1.5">
                          {analysis.critique.needsVerification.map((item, i) => (
                            <li key={i} className="text-sm" style={{ color: theme.textMuted }}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : entry.analysisError ? (
            <div className="flex-shrink-0 pl-2" style={{ width: analysisResize.width }}>
              <div className="p-4 rounded-xl border" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2" }}>
                <p className="font-medium text-sm mb-2" style={{ color: "#b91c1c" }}>Analysis data corrupted</p>
                <p className="text-xs mb-3" style={{ color: "#dc2626" }}>{entry.analysisError}</p>
                {onReanalyze && (
                  <button
                    onClick={onReanalyze}
                    disabled={isReanalyzing}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                    style={{ backgroundColor: "#fecaca", color: "#991b1b" }}
                  >
                    {isReanalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Reanalyze to fix
                  </button>
                )}
              </div>
            </div>
          ) : (
            <AnalysisLoader palette={palette} theme={theme} width={analysisResize.width} />
          )}
        </>
      )}
    </div>
  );
});

// Sub-components

function ReadingProgressMeter({
  seenPercent,
  herePercent,
  isComplete,
  palette,
  theme,
}: {
  seenPercent: number;
  herePercent: number;
  isComplete: boolean;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  return (
    <div
      className="mt-4 pr-6"
      title="Seen increases only after content stays in view. Here shows the current scroll position."
    >
      <div className="flex items-center justify-between gap-3 mb-1.5 text-xs tabular-nums">
        <span className="font-medium" style={{ color: isComplete ? palette[600] : theme.textMuted }}>
          {seenPercent}% seen
        </span>
        <span style={{ color: theme.textLight }}>{herePercent}% here</span>
      </div>
      <div className="relative h-1.5 rounded-full overflow-visible" style={{ backgroundColor: theme.borderLight }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${seenPercent}%`, backgroundColor: isComplete ? palette[600] : palette[500] }}
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full transition-all duration-150"
          style={{
            left: `calc(${herePercent}% - 1px)`,
            backgroundColor: theme.textMuted,
          }}
        />
      </div>
    </div>
  );
}

function HighlightsSection({
  highlights,
  onReaction,
  palette,
  theme,
}: {
  highlights: Highlight[];
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const typeColors = {
    insight: palette[500],
    fact: "#3b82f6",
    actionable: "#f97316",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h4 className="font-medium text-sm">Highlights</h4>
        <div className="flex gap-2 text-xs" style={{ color: theme.textLight }}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette[500] }} />
            insight
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
            fact
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f97316" }} />
            actionable
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {highlights.map((h) => {
          const isStarred = h.reaction === "star";
          const isDismissed = h.reaction === "dismiss";
          const isStarHovered = hoveredButton === `${h.id}-star`;
          const isDismissHovered = hoveredButton === `${h.id}-dismiss`;

          return (
            <li
              key={h.id}
              className="text-sm pl-3 py-2 border-l-2 transition-opacity flex items-start gap-2"
              style={{ borderColor: typeColors[h.type], color: theme.textMuted, opacity: isDismissed ? 0.4 : 1 }}
            >
              <div className="flex-1">{h.text}</div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onReaction("highlight", h.id, isStarred ? "" : "star")}
                  onMouseEnter={() => setHoveredButton(`${h.id}-star`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="p-2 rounded-lg transition-colors"
                  data-track="highlight.star"
                  title={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    className="w-5 h-5 transition-colors"
                    style={{ color: isStarred || isStarHovered ? "#eab308" : theme.textLight, fill: isStarred ? "#eab308" : "none" }}
                  />
                </button>
                <button
                  onClick={() => onReaction("highlight", h.id, isDismissed ? "" : "dismiss")}
                  onMouseEnter={() => setHoveredButton(`${h.id}-dismiss`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="p-2 rounded-lg transition-colors"
                  data-track="highlight.dismiss"
                  title={isDismissed ? "Restore" : "Dismiss"}
                >
                  <X className="w-5 h-5 transition-colors" style={{ color: isDismissed || isDismissHovered ? "#6b7280" : theme.textLight }} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConceptsSection({
  concepts,
  onReaction,
  palette,
  theme,
}: {
  concepts: { id: string; term: string; definition: string; status?: "knew" | "learned" }[];
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-sm">Key Concepts</h4>
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: theme.textLight }} />
          <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
            <p className="mb-2">Terms or ideas that may need explanation.</p>
            <p className="mb-2 text-gray-300"><strong className="text-white">Knew</strong> — You already knew this concept.</p>
            <p className="mb-2 text-gray-300"><strong className="text-white">Learned</strong> — You just learned this from the article.</p>
            <p className="text-gray-300">Tracking helps tailor future analysis to your expertise.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {concepts.map((c) => {
          const isKnewHovered = hoveredButton === `${c.id}-knew`;
          const isLearnedHovered = hoveredButton === `${c.id}-learned`;

          return (
            <div
              key={c.id}
              className="p-2 rounded-lg transition-opacity"
              style={{ backgroundColor: theme.borderLight, opacity: (c.status === "knew" || c.status === "learned") ? 0.5 : 1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.term}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onReaction("concept", c.id, "knew")}
                    onMouseEnter={() => setHoveredButton(`${c.id}-knew`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    className="px-2 py-0.5 text-xs rounded transition-colors"
                    data-track="concept.knew"
                    style={{
                      backgroundColor: c.status === "knew" ? `${palette[500]}20` : undefined,
                      color: c.status === "knew" || isKnewHovered ? palette[600] : theme.textLight,
                      border: `1px solid ${c.status === "knew" || isKnewHovered ? palette[500] : theme.border}`,
                    }}
                  >
                    {c.status === "knew" ? "✓ Knew" : "Knew"}
                  </button>
                  <button
                    onClick={() => onReaction("concept", c.id, "learned")}
                    onMouseEnter={() => setHoveredButton(`${c.id}-learned`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    className="px-2 py-0.5 text-xs rounded transition-colors"
                    data-track="concept.learned"
                    style={{
                      backgroundColor: c.status === "learned" ? `${palette[500]}20` : undefined,
                      color: c.status === "learned" || isLearnedHovered ? palette[600] : theme.textLight,
                      border: `1px solid ${c.status === "learned" || isLearnedHovered ? palette[500] : theme.border}`,
                    }}
                  >
                    {c.status === "learned" ? "✓ Learned" : "Learned"}
                  </button>
                </div>
              </div>
              <div className="text-sm" style={{ color: theme.textMuted }}>{c.definition}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalysisLoader({ palette, theme, width = 384 }: { palette: Record<number, string>; theme: Record<string, string>; width?: number }) {
  return (
    <div className="flex-shrink-0 pl-2" style={{ width }}>
      <div className="relative">
        <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full blur-2xl animate-corner-pulse pointer-events-none" style={{ background: `${palette[400]}50` }} />
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl animate-corner-pulse-2 pointer-events-none" style={{ background: "rgba(139, 92, 246, 0.35)" }} />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl animate-corner-pulse-3 pointer-events-none" style={{ background: "rgba(99, 102, 241, 0.35)" }} />
        <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full blur-2xl animate-corner-pulse-4 pointer-events-none" style={{ background: `${palette[500]}45` }} />

        <div className="rounded-xl border relative overflow-hidden h-[140px]" style={{ borderColor: theme.border, backgroundColor: "white" }}>
          <div className="absolute inset-x-0 top-0 h-16 pointer-events-none" style={{ background: `linear-gradient(to bottom, ${palette[500]}35, ${palette[500]}15, transparent)` }} />
          <div className="absolute inset-y-0 left-0 animate-water-fill" style={{ background: `linear-gradient(to right, ${palette[500]}08, ${palette[500]}20)` }}>
            <svg className="absolute right-0 top-1/2 -translate-y-1/2 h-[300%]" style={{ width: "20px", marginRight: "-10px" }} viewBox="0 0 20 100">
              <path className="animate-wave-1" d="M10,-60 Q18,-40 10,-20 Q2,0 10,20 Q18,40 10,60 Q2,80 10,100 Q18,120 10,140 Q2,160 10,180" fill="none" stroke={palette[500]} strokeWidth="2" strokeOpacity="0.7" />
            </svg>
          </div>
          <div className="relative h-full flex flex-col justify-center px-6 z-10">
            <p className="text-sm font-medium mb-1" style={{ color: theme.text }}>Analyzing</p>
            <p className="text-xs" style={{ color: theme.textMuted }}>Reading and understanding content...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionsSection({
  connections,
  onNavigate,
  palette,
  theme,
}: {
  connections: ResolvedConnection[];
  onNavigate?: (sourceId: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  const connectionConfig: Record<ConnectionType, { icon: string; label: string; color: string }> = {
    redundant: { icon: "🔄", label: "Overlaps", color: "#f59e0b" },
    contradicts: { icon: "⚡", label: "Contradicts", color: "#ef4444" },
    related: { icon: "🔗", label: "Related", color: palette[500] },
  };

  const typePriority: Record<ConnectionType, number> = { contradicts: 0, redundant: 1, related: 2 };
  // Agents write these files too — treat unknown connection types as "related"
  // instead of crashing the view.
  const configFor = (type: ConnectionType) => connectionConfig[type] ?? connectionConfig.related;
  const priorityFor = (type: ConnectionType) => typePriority[type] ?? typePriority.related;
  const sortedConnections = [...connections].sort((a, b) => priorityFor(a.type) - priorityFor(b.type)).slice(0, 5);

  const toggleConnection = (connId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(connId)) next.delete(connId);
      else next.add(connId);
      return next;
    });
  };

  return (
    <div className="p-4 mb-4 rounded-xl border" style={{ borderColor: theme.border }}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between text-left" data-track="connections.toggle">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Connections</span>
          <span className="px-1.5 py-0.5 text-xs rounded-full" style={{ backgroundColor: `${palette[500]}20`, color: palette[600] }}>{sortedConnections.length}</span>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} /> : <ChevronRight className="w-4 h-4" style={{ color: theme.textMuted }} />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {sortedConnections.map((conn) => {
            const config = configFor(conn.type);
            const isOpen = expandedConnections.has(conn.id);

            return (
              <div key={conn.id} className="rounded-lg border overflow-hidden" style={{ borderColor: theme.border }}>
                <button onClick={() => toggleConnection(conn.id)} className="w-full p-3 flex items-start gap-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <span className="text-base flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${config.color}20`, color: config.color }}>{config.label}</span>
                    </div>
                    <p className="text-sm" style={{ color: theme.textMuted }}>{conn.summary}</p>
                  </div>
                  {isOpen ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textLight }} /> : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textLight }} />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-0" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <p className="text-sm mt-3 mb-3" style={{ color: theme.text }}>{conn.details}</p>
                    <div className="flex flex-wrap gap-2">
                      {conn.relatedSourceIds.map((sourceId, i) => (
                        <button
                          key={sourceId}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onNavigate?.(sourceId); }}
                          className="text-xs px-2 py-1 rounded border hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                          style={{ borderColor: theme.border, color: palette[600] }}
                        >
                          <LinkIcon className="w-3 h-3" />
                          {conn.relatedSourceTitles?.[i] || sourceId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
