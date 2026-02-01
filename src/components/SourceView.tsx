"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  RefreshCw,
  HelpCircle,
  Star,
  Pencil,
  Check,
  X,
  FileText,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
} from "lucide-react";
import { Source, ActionType, Highlight, Connection, ConnectionType } from "@/lib/types";

export interface SourceViewProps {
  source: Source;
  activeTab: "digest" | "critique";
  setActiveTab: (tab: "digest" | "critique") => void;
  onClose: () => void;
  onReanalyze: () => void;
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  onSourceUpdated: () => void;
  onNavigateToSource?: (sourceId: string) => void;
  isReanalyzing: boolean;
  palette: Record<number, string>;
  theme: Record<string, string>;
  getActionConfig: (action: ActionType) => { icon: React.ReactNode; label: string; description: string; color: string };
  getScoreColor: (score: number) => string;
}

export function SourceView({
  source,
  activeTab,
  setActiveTab,
  onReanalyze,
  onReaction,
  onSourceUpdated,
  onNavigateToSource,
  isReanalyzing,
  palette,
  theme,
  getActionConfig,
  getScoreColor,
}: SourceViewProps) {
  const { meta, content, analysis } = source;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [editedTitle, setEditedTitle] = useState(meta.title);
  const [isSaving, setIsSaving] = useState(false);
  const [viewOriginal, setViewOriginal] = useState(false);
  const [zoom, setZoom] = useState(100); // percentage

  // Reset state when source changes
  useEffect(() => {
    setEditedContent(content);
    setEditedTitle(meta.title);
    setIsEditing(false);
    setViewOriginal(false);
    setZoom(100);
  }, [source.meta.id, content, meta.title]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const handleZoomReset = () => setZoom(100);

  // Always use local file for inline viewing (we have the original saved locally)
  const originalFileUrl = `/api/sources/${meta.id}/original`;

  const handleSave = async () => {
    // Check if anything changed
    const titleChanged = editedTitle !== meta.title;
    const contentChanged = editedContent !== content;

    if (!titleChanged && !contentChanged) {
      // No changes, just close edit mode
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/sources/${meta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleChanged ? editedTitle : undefined,
          content: contentChanged ? editedContent : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        onSourceUpdated();
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setEditedTitle(meta.title);
    setIsEditing(false);
  };

  return (
    <div className="flex gap-6 items-start">
      {/* Content Area - fixed height container */}
      <div className="flex-1 min-w-0 max-w-2xl h-[calc(100vh-140px)] sticky top-0">
        <div className="bg-white border rounded-xl p-6 h-full flex flex-col" style={{ borderColor: theme.border }}>
          <div className="flex items-start justify-between mb-2">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-semibold leading-tight flex-1 min-w-0 border-b-2 outline-none bg-transparent"
                style={{ borderColor: palette[500] }}
              />
            ) : (
              <h1 className="text-2xl font-semibold leading-tight">{meta.title}</h1>
            )}
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: palette[600] }}
                    title="Save changes"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="relative group">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 rounded-lg border hover:bg-black/5 transition-colors"
                      style={{ borderColor: theme.border, color: theme.textMuted }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <p className="font-medium mb-1">Edit source</p>
                      <p className="text-gray-300">Edit the title and content directly.</p>
                    </div>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={onReanalyze}
                      disabled={isReanalyzing}
                      className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                      style={{ borderColor: theme.border, color: theme.textMuted }}
                    >
                      <RefreshCw className={`w-4 h-4 ${isReanalyzing ? "animate-spin" : ""}`} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <p className="font-medium mb-1">Re-process this source</p>
                      <p className="text-gray-300">Re-fetch content from the original input, then re-run AI analysis.</p>
                    </div>
                  </div>
                  <div className="relative group">
                    {meta.sourceUrl ? (
                      // External source: open in new tab
                      <a
                        href={meta.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border hover:bg-black/5 transition-colors inline-flex"
                        style={{ borderColor: theme.border, color: theme.textMuted }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      // Local file: toggle inline view
                      <button
                        onClick={() => setViewOriginal(!viewOriginal)}
                        className="p-2 rounded-lg border hover:bg-black/5 transition-colors"
                        style={{
                          borderColor: viewOriginal ? palette[500] : theme.border,
                          color: viewOriginal ? palette[600] : theme.textMuted,
                          backgroundColor: viewOriginal ? `${palette[500]}10` : undefined,
                        }}
                      >
                        {viewOriginal ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                    <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <p className="font-medium mb-1">
                        {meta.sourceUrl ? "Open original" : (viewOriginal ? "View extracted" : "View original")}
                      </p>
                      <p className="text-gray-300">
                        {meta.sourceUrl
                          ? "Open the source URL in a new tab."
                          : (viewOriginal ? "Switch to AI-extracted content." : "View the original file.")}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {meta.sourceUrl && (
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: theme.textLight }}
            >
              {new URL(meta.sourceUrl).hostname} ↗
            </a>
          )}

          {/* Content */}
          <div className="mt-6 flex-1 min-h-0 overflow-hidden">
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full p-4 border rounded-lg font-mono text-sm resize-none outline-none"
                style={{ borderColor: theme.border }}
                placeholder="Markdown content..."
              />
            ) : viewOriginal ? (
              <div className="h-full w-full flex flex-col rounded-lg overflow-hidden border" style={{ borderColor: theme.border }}>
                {/* Zoom controls */}
                <div
                  className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0"
                  style={{ borderColor: theme.border, backgroundColor: theme.borderLight }}
                >
                  <span className="text-xs font-medium" style={{ color: theme.textMuted }}>
                    {zoom}%
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleZoomOut}
                      disabled={zoom <= 50}
                      className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                    <button
                      onClick={handleZoomReset}
                      disabled={zoom === 100}
                      className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30"
                      title="Reset zoom"
                    >
                      <RotateCcw className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                    <button
                      onClick={handleZoomIn}
                      disabled={zoom >= 200}
                      className="p-1.5 rounded hover:bg-black/5 transition-colors disabled:opacity-30"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" style={{ color: theme.textMuted }} />
                    </button>
                  </div>
                </div>
                {/* Content with zoom */}
                <div className="flex-1 overflow-auto bg-gray-50">
                  {meta.type === "image" ? (
                    <img
                      src={originalFileUrl}
                      alt={meta.title}
                      className="transition-transform origin-top-left"
                      style={{
                        transform: `scale(${zoom / 100})`,
                        maxWidth: zoom <= 100 ? '100%' : 'none',
                      }}
                    />
                  ) : (
                    <iframe
                      key={originalFileUrl}
                      src={originalFileUrl}
                      className="bg-white origin-top-left"
                      title="Original source"
                      style={{
                        width: `${10000 / zoom}%`,
                        height: `${10000 / zoom}%`,
                        transform: `scale(${zoom / 100})`,
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="prose prose-sm prose-neutral max-w-none h-full overflow-y-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-2 hover:opacity-80"
                        style={{ color: palette[600] }}
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Panel */}
      {analysis && (
        <div className="w-[420px] flex-shrink-0">
            {/* Triage Card */}
            {(() => {
              const score = analysis.triage.score ?? 50;
              const scoreColor = getScoreColor(score);
              const actionConfig = getActionConfig(analysis.triage.action);
              return (
                <div
                  className="p-4 mb-4 rounded-xl border"
                  style={{ borderColor: theme.border }}
                >
                  {/* Score + Action Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold" style={{ color: scoreColor }}>
                      {score}
                    </span>
                    <span
                      className="px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5"
                      style={{ backgroundColor: `${actionConfig.color}15`, color: actionConfig.color }}
                    >
                      {actionConfig.icon}
                      {actionConfig.label}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 rounded-full mb-3" style={{ backgroundColor: theme.borderLight }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: scoreColor }}
                    />
                  </div>

                  {/* Reason */}
                  <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
                    {analysis.triage.reason}
                  </p>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="font-medium">{analysis.triage.readTimeMinutes}</div>
                      <div style={{ color: theme.textLight }}>min</div>
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
                </div>
              );
            })()}

            {/* Connections Section */}
            {analysis.connections && analysis.connections.length > 0 && (
              <ConnectionsSection
                connections={analysis.connections}
                onNavigate={onNavigateToSource}
                palette={palette}
                theme={theme}
              />
            )}

            {/* Tabs */}
            <div
              className="flex gap-0.5 mb-4 p-1 rounded-xl"
              style={{ backgroundColor: theme.borderLight }}
            >
              {(["digest", "critique"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all capitalize"
                  style={
                    activeTab === tab
                      ? { backgroundColor: "white", color: theme.text }
                      : { color: theme.textMuted }
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div
              className="p-4 rounded-xl border"
              style={{ borderColor: theme.border }}
            >
              {activeTab === "digest" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Summary</h4>
                    <p className="text-sm" style={{ color: theme.textMuted }}>
                      {analysis.digest.summary}
                    </p>
                  </div>
                  {(analysis.digest.highlights?.length ?? 0) > 0 && (
                    <HighlightsSection
                      highlights={analysis.digest.highlights!}
                      onReaction={onReaction}
                      palette={palette}
                      theme={theme}
                    />
                  )}
                  {(analysis.digest.concepts?.length ?? 0) > 0 && (
                    <ConceptsSection
                      concepts={analysis.digest.concepts}
                      onReaction={onReaction}
                      palette={palette}
                      theme={theme}
                    />
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
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.critique.potentialIssues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Potential Issues</h4>
                      <ul className="space-y-1.5">
                        {analysis.critique.potentialIssues.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.critique.needsVerification.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Needs Verification</h4>
                      <ul className="space-y-1.5">
                        {analysis.critique.needsVerification.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
        </div>
      )}
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
              style={{
                borderColor: typeColors[h.type],
                color: theme.textMuted,
                opacity: isDismissed ? 0.4 : 1,
              }}
            >
              <div className="flex-1">{h.text}</div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onReaction("highlight", h.id, isStarred ? "" : "star")}
                  onMouseEnter={() => setHoveredButton(`${h.id}-star`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="p-2 rounded-lg transition-colors"
                  title={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    className="w-5 h-5 transition-colors"
                    style={{
                      color: isStarred || isStarHovered ? "#eab308" : theme.textLight,
                      fill: isStarred ? "#eab308" : "none",
                    }}
                  />
                </button>
                <button
                  onClick={() => onReaction("highlight", h.id, isDismissed ? "" : "dismiss")}
                  onMouseEnter={() => setHoveredButton(`${h.id}-dismiss`)}
                  onMouseLeave={() => setHoveredButton(null)}
                  className="p-2 rounded-lg transition-colors"
                  title={isDismissed ? "Restore" : "Dismiss"}
                >
                  <X
                    className="w-5 h-5 transition-colors"
                    style={{ color: isDismissed || isDismissHovered ? "#6b7280" : theme.textLight }}
                  />
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
            <p className="mb-2 text-gray-300">
              <strong className="text-white">Knew</strong> — You already knew this concept.
            </p>
            <p className="mb-2 text-gray-300">
              <strong className="text-white">Learned</strong> — You just learned this from the article.
            </p>
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
              style={{
                backgroundColor: theme.borderLight,
                opacity: c.status ? 0.4 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.term}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => onReaction("concept", c.id, "knew")}
                    onMouseEnter={() => setHoveredButton(`${c.id}-knew`)}
                    onMouseLeave={() => setHoveredButton(null)}
                    className="px-2 py-0.5 text-xs rounded transition-colors"
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

function ConnectionsSection({
  connections,
  onNavigate,
  palette,
  theme,
}: {
  connections: Connection[];
  onNavigate?: (sourceId: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  const connectionConfig: Record<ConnectionType, { icon: string; label: string; color: string }> = {
    redundant: { icon: "🔄", label: "Overlaps", color: "#f59e0b" },
    contradicts: { icon: "⚡", label: "Contradicts", color: "#ef4444" },
    builds_on: { icon: "🌱", label: "Builds On", color: palette[500] },
  };

  const toggleConnection = (connId: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(connId)) {
        next.delete(connId);
      } else {
        next.add(connId);
      }
      return next;
    });
  };

  return (
    <div
      className="p-4 mb-4 rounded-xl border"
      style={{ borderColor: theme.border }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Connections</span>
          <span
            className="px-1.5 py-0.5 text-xs rounded-full"
            style={{ backgroundColor: `${palette[500]}20`, color: palette[600] }}
          >
            {connections.length}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} />
        ) : (
          <ChevronRight className="w-4 h-4" style={{ color: theme.textMuted }} />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {connections.map((conn) => {
            const config = connectionConfig[conn.type];
            const isOpen = expandedConnections.has(conn.id);

            return (
              <div
                key={conn.id}
                className="rounded-lg border overflow-hidden"
                style={{ borderColor: theme.border }}
              >
                <button
                  onClick={() => toggleConnection(conn.id)}
                  className="w-full p-3 flex items-start gap-2 text-left hover:bg-black/5 transition-colors"
                >
                  <span className="text-base flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                      >
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: theme.textMuted }}>
                      {conn.summary}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textLight }} />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textLight }} />
                  )}
                </button>

                {isOpen && (
                  <div
                    className="px-3 pb-3 pt-0"
                    style={{ borderTop: `1px solid ${theme.border}` }}
                  >
                    <p className="text-sm mt-3 mb-3" style={{ color: theme.text }}>
                      {conn.details}
                    </p>

                    {conn.conceptTerms && conn.conceptTerms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {conn.conceptTerms.map((term, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {conn.relatedSourceIds.map((sourceId, i) => (
                        <button
                          key={sourceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate?.(sourceId);
                          }}
                          className="text-xs px-2 py-1 rounded border hover:bg-black/5 transition-colors flex items-center gap-1"
                          style={{ borderColor: theme.border, color: palette[600] }}
                        >
                          <LinkIcon className="w-3 h-3" />
                          {conn.relatedSourceTitles[i] || sourceId}
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
