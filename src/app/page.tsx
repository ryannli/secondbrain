"use client";

import React, { useState, useEffect, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Brain,
  Loader2,
  AlertCircle,
  BookOpen,
  Eye,
  SkipForward,
  Folder,
  FolderOpen,
  Target,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Settings,
  LayoutDashboard,
  RefreshCw,
  HelpCircle,
  Youtube,
  Headphones,
  FileText,
  File,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Source, SourceMeta, SourceSummary, SourceType, ActionType, ACTION_CONFIG, Highlight, TriageCard } from "@/lib/types";

// X (Twitter) logo component
function XLogo({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Design tokens
const theme = {
  bg: "#feffff",
  text: "#252829",
  textMuted: "#71717a",
  textLight: "#a1a1aa",
  border: "#e4e4e7",
  borderLight: "#f4f4f5",
  accent: "#3b6044", // Forest green default
};

// Generate palette from accent color
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generatePalette(baseColor: string) {
  const { h, s } = hexToHsl(baseColor);
  return {
    50: hslToHex(h, Math.max(s - 30, 10), 97),
    100: hslToHex(h, Math.max(s - 20, 15), 94),
    500: hslToHex(h, s, 50),
    600: hslToHex(h, s, 42),
  };
}

const palette = generatePalette(theme.accent);

// Get icon component for source type
function getSourceTypeIcon(type: SourceType) {
  switch (type) {
    case "youtube":
      return Youtube;
    case "twitter":
      return XLogo;
    case "podcast":
      return Headphones;
    case "pdf":
      return File;
    case "note":
      return FileText;
    case "article":
    default:
      return ExternalLink;
  }
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get("source");

  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [captureInput, setCaptureInput] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"digest" | "critique">("digest");
  const [libraryPath, setLibraryPath] = useState<string>("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]); // Track URLs being processed

  // Load config and sources on mount, poll for updates
  useEffect(() => {
    loadConfig();
    loadSources();

    // Poll for new sources every 5 seconds (for extension captures)
    const interval = setInterval(loadSources, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load source from URL param
  useEffect(() => {
    if (sourceId) {
      handleSelectSource(sourceId);
    } else {
      setSelectedSource(null);
    }
  }, [sourceId]);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.success) {
        setLibraryPath(data.config.libraryPath);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const loadSources = async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  };

  const handleCapture = () => {
    if (!captureInput.trim()) return;

    const input = captureInput.trim();
    const isUrl = /^https?:\/\//i.test(input);
    const displayName = isUrl ? new URL(input).hostname : input.slice(0, 30) + "...";

    // Add to pending list and clear input immediately
    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    // Process in background
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isUrl ? { url: input } : { text: input }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          setSources((prev) => [{
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, ...prev]);
        } else {
          setError(data.error || "Failed to capture content");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to capture");
      })
      .finally(() => {
        setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
      });
  };

  const handleSelectSource = async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to load source:", err);
    }
  };

  const navigateToSource = (id: string) => {
    router.push(`/?source=${id}`);
  };

  const navigateToDashboard = () => {
    router.push("/dashboard");
  };

  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const handleReanalyze = async (id: string) => {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/sources/${id}/reanalyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      } else {
        setError(data.error || "Failed to re-analyze");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleReaction = async (
    sourceId: string,
    type: "highlight" | "concept",
    itemId: string,
    reaction: string
  ) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}/reaction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, itemId, reaction }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to update reaction:", err);
    }
  };

  // UI config for action types
  const actionUI: Record<ActionType, { icon: React.ReactNode; color: string }> = {
    must_read: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[600] },
    worth_reading: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[500] },
    skim: { icon: <Eye className="w-3.5 h-3.5" />, color: "#eab308" },
    summary_only: { icon: <Eye className="w-3.5 h-3.5" />, color: "#f97316" },
    skip: { icon: <SkipForward className="w-3.5 h-3.5" />, color: "#ef4444" },
  };

  const getActionConfig = (action: ActionType) => {
    const config = ACTION_CONFIG[action];
    const ui = actionUI[action];
    return {
      icon: ui?.icon ?? <Target className="w-3.5 h-3.5" />,
      label: config?.label ?? action,
      description: config?.description ?? "",
      color: ui?.color ?? theme.textMuted,
    };
  };

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return palette[600];
    if (score >= 60) return palette[500];
    if (score >= 40) return "#eab308";
    if (score >= 20) return "#f97316";
    return "#ef4444";
  };

  return (
    <div
      className="h-screen overflow-hidden font-[family-name:var(--font-outfit)] flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      {/* Top Header */}
      <header
        className="h-12 flex-shrink-0 border-b flex items-center justify-between px-4"
        style={{ borderColor: theme.border }}
      >
        <div className="flex items-center gap-2.5">
          <Brain className="w-5 h-5" style={{ color: palette[600] }} />
          <span className="font-semibold">Second Brain</span>
        </div>
        <button
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" style={{ color: theme.textMuted }} />
        </button>
      </header>

      {/* Main Area: Sidebar + Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 border-r flex flex-col transition-all duration-200 ${
            isSidebarOpen ? "w-64" : "w-12"
          }`}
          style={{ borderColor: theme.border }}
        >
          {/* Sidebar Toggle */}
          <div className="px-3 py-2 flex items-center justify-end">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" style={{ color: theme.textMuted }} />
              ) : (
                <PanelLeft className="w-4 h-4" style={{ color: theme.textMuted }} />
              )}
            </button>
          </div>

          {/* Navigation */}
          {isSidebarOpen && (
            <>
              {/* Dashboard Entry */}
              <button
                onClick={navigateToDashboard}
                className="mx-2 px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors text-left rounded-lg"
                style={{
                  backgroundColor: !selectedSource ? `${palette[500]}15` : undefined,
                }}
              >
                <LayoutDashboard
                  className="w-4 h-4"
                  style={{ color: !selectedSource ? palette[500] : theme.textMuted }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: !selectedSource ? palette[600] : theme.text }}
                >
                  Dashboard
                </span>
              </button>

              <div className="flex-1 overflow-auto mt-2">
                {/* Library Section Label */}
                <div className="px-3 py-1">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                    Library
                  </span>
                </div>

                {/* Library Folder */}
                <button
                  onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left"
                >
                  {isLibraryOpen ? (
                    <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} />
                  ) : (
                    <ChevronRight className="w-4 h-4" style={{ color: theme.textMuted }} />
                  )}
                  {isLibraryOpen ? (
                    <FolderOpen className="w-4 h-4" style={{ color: palette[500] }} />
                  ) : (
                    <Folder className="w-4 h-4" style={{ color: palette[500] }} />
                  )}
                  <span className="text-sm truncate flex-1" title={libraryPath}>
                    {libraryPath.split("/").pop() || "library"}
                  </span>
                </button>

                {/* Source Files */}
                {isLibraryOpen && (
                  <div className="ml-4">
                    {sources.map((source) => {
                      const TypeIcon = getSourceTypeIcon(source.meta.type);
                      return (
                        <button
                          key={source.meta.id}
                          onClick={() => navigateToSource(source.meta.id)}
                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left rounded"
                          style={{
                            backgroundColor: selectedSource?.meta.id === source.meta.id ? `${palette[500]}15` : undefined,
                          }}
                        >
                          <TypeIcon
                            className="w-4 h-4 flex-shrink-0"
                            style={{
                              color: selectedSource?.meta.id === source.meta.id ? palette[500] : theme.textLight,
                            }}
                          />
                          <span
                            className="text-sm truncate"
                            style={{
                              color: selectedSource?.meta.id === source.meta.id ? palette[600] : theme.text,
                            }}
                            title={source.meta.title}
                          >
                            {source.meta.title}
                          </span>
                        </button>
                      );
                    })}
                    {sources.length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: theme.textLight }}>
                        No sources yet
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Library Path */}
              <div
                className="px-3 py-2 border-t text-xs truncate"
                style={{ borderColor: theme.border, color: theme.textLight }}
                title={libraryPath}
              >
                {libraryPath}
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Quick Capture Bar */}
          <div
            className="px-6 py-3 border-b flex items-center gap-3"
            style={{ borderColor: theme.border }}
          >
            <Plus className="w-4 h-4 flex-shrink-0" style={{ color: theme.textLight }} />
            <input
              type="text"
              value={captureInput}
              onChange={(e) => setCaptureInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && captureInput.trim() && handleCapture()}
              placeholder="Paste a URL to analyze..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: theme.text }}
            />
            <button
              onClick={handleCapture}
              disabled={!captureInput.trim()}
              className="px-3 py-1.5 font-medium text-white text-sm rounded-lg disabled:opacity-50 transition-all"
              style={{ backgroundColor: palette[600] }}
            >
              Capture
            </button>
          </div>

          {/* Pending Captures */}
          {pendingCaptures.length > 0 && (
            <div className="px-6 py-2 border-b flex items-center gap-2 text-sm" style={{ borderColor: theme.border, backgroundColor: `${palette[500]}10` }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: palette[500] }} />
              <span style={{ color: theme.textMuted }}>
                Processing: {pendingCaptures.join(", ")}
              </span>
            </div>
          )}

          {error && (
            <div className="mx-6 mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedSource ? (
              <SourceView
                source={selectedSource}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onClose={() => setSelectedSource(null)}
                onReanalyze={() => handleReanalyze(selectedSource.meta.id)}
                onReaction={(type, itemId, reaction) => handleReaction(selectedSource.meta.id, type, itemId, reaction)}
                isReanalyzing={reanalyzingId === selectedSource.meta.id}
                palette={palette}
                theme={theme}
                getActionConfig={getActionConfig}
                getScoreColor={getScoreColor}
              />
            ) : (
              <Dashboard
                sources={sources}
                onSelect={navigateToSource}
                palette={palette}
                theme={theme}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Dashboard({
  sources,
  onSelect,
  palette,
  theme,
}: {
  sources: SourceSummary[];
  onSelect: (id: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return palette[600];
    if (score >= 60) return palette[500];
    if (score >= 40) return "#eab308";
    if (score >= 20) return "#f97316";
    return "#ef4444";
  };

  if (sources.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4" style={{ color: theme.textLight }} />
          <h2 className="text-lg font-medium mb-2">Welcome to Second Brain</h2>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            Paste a URL above to capture and analyze your first source.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5" style={{ color: theme.textMuted }} />
        <h2 className="font-medium">Recent Sources</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((source) => {
          const TypeIcon = getSourceTypeIcon(source.meta.type);
          const isRead = source.meta.readStatus === "read";
          const isReading = source.meta.readStatus === "reading";

          return (
            <button
              key={source.meta.id}
              onClick={() => onSelect(source.meta.id)}
              className="p-4 border rounded-xl hover:shadow-md transition-all text-left relative"
              style={{ borderColor: theme.border, backgroundColor: "white" }}
            >
              {/* Action badge - top right */}
              {source.action && (
                <span
                  className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-md"
                  style={{
                    backgroundColor: `${getScoreColor(source.score ?? 50)}15`,
                    color: getScoreColor(source.score ?? 50),
                  }}
                >
                  {ACTION_CONFIG[source.action]?.label ?? source.action}
                </span>
              )}

              {/* Header: Icon + Title */}
              <div className="flex items-start gap-3 mb-2 pr-10">
                <TypeIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: palette[500] }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium leading-snug line-clamp-2 text-sm" style={{ color: theme.text }}>
                    {source.meta.title}
                  </h3>
                  {source.meta.sourceUrl && (
                    <p className="text-xs mt-1 truncate" style={{ color: theme.textLight }}>
                      {new URL(source.meta.sourceUrl).hostname}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason */}
              {source.reason && (
                <p className="text-xs line-clamp-2 ml-8" style={{ color: theme.textMuted }}>
                  {source.reason}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SourceView({
  source,
  activeTab,
  setActiveTab,
  onReanalyze,
  onReaction,
  isReanalyzing,
  palette,
  theme,
  getActionConfig,
  getScoreColor,
}: {
  source: Source;
  activeTab: "digest" | "critique";
  setActiveTab: (tab: "digest" | "critique") => void;
  onClose: () => void;
  onReanalyze: () => void;
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  isReanalyzing: boolean;
  palette: Record<number, string>;
  theme: Record<string, string>;
  getActionConfig: (action: ActionType) => { icon: React.ReactNode; label: string; description: string; color: string };
  getScoreColor: (score: number) => string;
}) {
  const { meta, content, analysis } = source;

  return (
    <div className="flex gap-6 items-start">
      {/* Content Area - independent scroll */}
      <div className="flex-1 min-w-0 max-w-2xl max-h-[calc(100vh-140px)] overflow-y-auto sticky top-0">
        <div className="bg-white border rounded-xl p-6" style={{ borderColor: theme.border }}>
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-semibold leading-tight">{meta.title}</h1>
            <div className="relative group">
              <button
                onClick={onReanalyze}
                disabled={isReanalyzing}
                className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                style={{ borderColor: theme.border, color: theme.textMuted }}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isReanalyzing ? "animate-spin" : ""}`}
                />
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <p className="font-medium mb-1">Re-process this source</p>
                <p className="text-gray-300">Re-fetch content from the original input, then re-run AI analysis to generate new scores and highlights.</p>
              </div>
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
          <div className="mt-6 prose prose-sm prose-neutral max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
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
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: theme.textLight }} />
          <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
            <p className="mb-2">Key points extracted by AI. Your reactions train the system:</p>
            <ul className="space-y-1 mb-2 text-gray-300">
              <li><strong className="text-white">Agree</strong> — Valuable insight worth remembering</li>
              <li><strong className="text-white">Disagree</strong> — You hold a different view</li>
              <li><strong className="text-white">Dismiss</strong> — Not worth highlighting</li>
            </ul>
            <p className="text-gray-300">This helps surface content you find valuable and improves future recommendations.</p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {highlights.map((h) => {
          const isDismissed = h.reaction === "dismiss";
          return (
            <li
              key={h.id}
              className="text-sm pl-3 py-2 border-l-2 transition-opacity"
              style={{
                borderColor: typeColors[h.type],
                color: theme.textMuted,
                opacity: isDismissed ? 0.4 : 1,
              }}
            >
              <div className="mb-1.5">{h.text}</div>
              <div className="flex gap-1">
                {(["agree", "disagree", "dismiss"] as const).map((reaction) => (
                  <button
                    key={reaction}
                    onClick={() => onReaction("highlight", h.id, reaction)}
                    className="px-2 py-0.5 text-xs rounded transition-all capitalize hover:scale-105 hover:shadow-sm"
                    style={{
                      backgroundColor: h.reaction === reaction
                        ? reaction === "agree" ? `${palette[500]}20`
                        : reaction === "disagree" ? "#ef444420"
                        : `${theme.textLight}20`
                        : "transparent",
                      color: h.reaction === reaction
                        ? reaction === "agree" ? palette[600]
                        : reaction === "disagree" ? "#ef4444"
                        : theme.textMuted
                        : theme.textLight,
                      border: `1px solid ${h.reaction === reaction
                        ? reaction === "agree" ? palette[500]
                        : reaction === "disagree" ? "#ef4444"
                        : theme.border
                        : theme.border}`,
                    }}
                    onMouseEnter={(e) => {
                      if (h.reaction !== reaction) {
                        e.currentTarget.style.backgroundColor = reaction === "agree" ? `${palette[500]}10`
                          : reaction === "disagree" ? "#ef444410"
                          : `${theme.textLight}10`;
                        e.currentTarget.style.borderColor = reaction === "agree" ? palette[500]
                          : reaction === "disagree" ? "#ef4444"
                          : theme.textMuted;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (h.reaction !== reaction) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.borderColor = theme.border;
                      }
                    }}
                  >
                    {reaction}
                  </button>
                ))}
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
  concepts: { id: string; term: string; definition: string; understood?: boolean }[];
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-sm">Key Concepts</h4>
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: theme.textLight }} />
          <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
            <p className="mb-2">Terms or ideas that may need explanation.</p>
            <p className="mb-2 text-gray-300">
              <strong className="text-white">Got it</strong> — Click when you understand. The concept fades so you can focus on what you still need to learn.
            </p>
            <p className="text-gray-300">Tracking your knowledge helps tailor future analysis to your expertise level.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {concepts.map((c) => (
          <div
            key={c.id}
            className="p-2 rounded-lg transition-opacity"
            style={{
              backgroundColor: theme.borderLight,
              opacity: c.understood ? 0.4 : 1,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{c.term}</span>
              <button
                onClick={() => onReaction("concept", c.id, "toggle")}
                className="px-2 py-0.5 text-xs rounded transition-all hover:scale-105 hover:shadow-sm"
                style={{
                  backgroundColor: c.understood ? `${palette[500]}20` : "transparent",
                  color: c.understood ? palette[600] : theme.textLight,
                  border: `1px solid ${c.understood ? palette[500] : theme.border}`,
                }}
                onMouseEnter={(e) => {
                  if (!c.understood) {
                    e.currentTarget.style.backgroundColor = `${palette[500]}10`;
                    e.currentTarget.style.borderColor = palette[500];
                    e.currentTarget.style.color = palette[600];
                  }
                }}
                onMouseLeave={(e) => {
                  if (!c.understood) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.color = theme.textLight;
                  }
                }}
              >
                {c.understood ? "✓ Got it" : "Got it"}
              </button>
            </div>
            <div className="text-sm" style={{ color: theme.textMuted }}>{c.definition}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
