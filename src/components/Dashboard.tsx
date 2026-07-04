"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  Sparkles,
  Copy,
  X as XIcon,
  AlertCircle,
  Clock,
  X,
  Inbox,
  Bookmark,
  Flame,
  Puzzle,
} from "lucide-react";
import { SourceSummary, ACTION_CONFIG, FeedItem, ProcessingStage } from "@/lib/types";
import { Logo, PDFIcon } from "@/components/Icons";
import { LinkifiedText } from "@/components/LinkifiedText";
import { getSourceIcon } from "@/lib/sourceIcon";
import { formatRelativeTime } from "@/lib/utils";
import { FeedSection } from "@/components/FeedSection";
import { STARTER_PACK } from "@/lib/config";
import { useExtensionDetected } from "@/hooks/useExtensionDetected";

interface FeedProps {
  items: FeedItem[];
  interests: string[];
  generatedAt: string | null;
  fromCache: boolean;
  message?: string;
  loading: boolean;
  error: string | null;
  onCapture: (url: string) => void;
  onDismiss: (id: string) => void;
  onRefresh: () => void;
}

export interface DashboardProps {
  sources: SourceSummary[];
  onSelect: (id: string) => void;
  captureInput: string;
  setCaptureInput: (value: string) => void;
  onCapture: () => void;
  onFileUpload: (file: File) => void;
  pendingCaptures: string[];
  error: string | null;
  palette: Record<number, string>;
  theme: Record<string, string>;
  getScoreColor: (score: number) => string;
  feed?: FeedProps;
  onStarterPack?: () => void;
  extensionPath?: string;
}

export const Dashboard = React.memo(function Dashboard({
  sources,
  onSelect,
  captureInput,
  setCaptureInput,
  onCapture,
  onFileUpload,
  pendingCaptures,
  error,
  palette,
  theme,
  getScoreColor,
  feed,
  onStarterPack,
  extensionPath,
}: DashboardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<{ file: File; preview: string | null; isImage: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | "saved" | "recommended">("all");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Accept images and PDFs
      const imageFile = files.find(f => f.type.startsWith("image/"));
      const pdfFile = files.find(f => f.type === "application/pdf");

      if (imageFile) {
        const preview = URL.createObjectURL(imageFile);
        setStagedFile({ file: imageFile, preview, isImage: true });
      } else if (pdfFile) {
        setStagedFile({ file: pdfFile, preview: null, isImage: false });
      }
    }
  };

  const handleClearStagedFile = () => {
    if (stagedFile) {
      if (stagedFile.preview) {
        URL.revokeObjectURL(stagedFile.preview);
      }
      setStagedFile(null);
    }
  };

  const handleCaptureWithFile = () => {
    if (stagedFile) {
      onFileUpload(stagedFile.file);
      if (stagedFile.preview) {
        URL.revokeObjectURL(stagedFile.preview);
      }
      setStagedFile(null);
    } else if (captureInput.trim()) {
      onCapture();
    }
  };

  const canCapture = stagedFile || captureInput.trim();

  // Capture input JSX (not a component to avoid re-mounting on state change)
  const captureInputElement = (
    <div className="w-full max-w-2xl mx-auto mt-8 mb-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border bg-white dark:bg-zinc-900 shadow-sm transition-all ${
          isDragging ? "border-dashed border-2" : ""
        }`}
        style={{
          borderColor: isDragging ? palette[500] : theme.border,
          backgroundColor: isDragging ? `${palette[500]}05` : undefined,
        }}
      >
        {/* Staged file preview */}
        {stagedFile && (
          <div className="px-3 pt-3">
            <div
              className="relative inline-flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: `${palette[500]}10` }}
            >
              {stagedFile.isImage && stagedFile.preview ? (
                <img
                  src={stagedFile.preview}
                  alt="Preview"
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <PDFIcon className="w-8 h-8" />
              )}
              <span className="text-xs font-medium truncate max-w-32" style={{ color: palette[600] }}>
                {stagedFile.file.name}
              </span>
              <button
                onClick={handleClearStagedFile}
                className="p-0.5 rounded hover:bg-black/10 transition-colors"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
              </button>
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Plus className="w-5 h-5 flex-shrink-0" style={{ color: theme.textLight }} />
          <input
            type="text"
            value={captureInput}
            onChange={(e) => setCaptureInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCapture && handleCaptureWithFile()}
            placeholder={isDragging ? "Drop file here..." : stagedFile ? "Add a note (optional)..." : "Paste a link, text, or drop a file..."}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: theme.text }}
          />
          <button
            onClick={handleCaptureWithFile}
            disabled={!canCapture}
            className="px-4 py-2 font-medium text-white text-sm rounded-lg disabled:opacity-50 transition-all hover:opacity-90"
            data-track="capture.submit"
            style={{ backgroundColor: palette[600] }}
          >
            Capture
          </button>
        </div>
      </div>

      {/* Extension hint */}
      <div className="mt-2 flex items-center justify-center gap-1.5 text-xs" style={{ color: theme.textLight }}>
        <Puzzle className="w-3.5 h-3.5" />
        <span>Fastest way to capture: the</span>
        <a
          href="https://github.com/ryannli/secondbrain#chrome-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: palette[600] }}
        >
          browser extension ↗
        </a>
      </div>

      {/* Pending Captures */}
      {pendingCaptures.length > 0 && (
        <div
          className="mt-3 px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          style={{ backgroundColor: `${palette[500]}10` }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: palette[500] }} />
          <span style={{ color: theme.textMuted }}>
            Processing: {pendingCaptures.join(", ")}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );

  // First-run guidance: everything the user sees is still seeded examples.
  // Explain what they are and offer a one-click starter pack; disappears on
  // its own once the first real capture lands.
  const onlyExamples = sources.every((s) => (s.meta.folder ?? "").split("/")[0] === "examples");
  const [starterDismissed, setStarterDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("starter-banner-dismissed") === "1"
  );
  const [starterStarted, setStarterStarted] = useState(false);
  const showStarterBanner = Boolean(onStarterPack) && onlyExamples && !starterDismissed;

  const starterBanner = showStarterBanner ? (
    <div
      className="w-full max-w-2xl mx-auto mb-6 px-4 py-3 rounded-xl border flex items-start gap-3"
      style={{ borderColor: theme.border, backgroundColor: `${palette[500]}08` }}
    >
      <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: palette[600] }} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium" style={{ color: theme.text }}>
          You&apos;re looking at examples
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: theme.textMuted }}>
          They show what an analyzed source looks like — safe to delete anytime. Start your real
          library by capturing anything above{onStarterPack ? ", or let your agent fetch and analyze a small starter pack of public example reads" : ""}.
        </p>
        {starterStarted ? (
          <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: palette[600] }}>
            <Loader2 className="w-3 h-3 animate-spin" />
            Capturing {STARTER_PACK.length} articles — they&apos;ll appear here as each one finishes.
          </p>
        ) : (
          <button
            onClick={() => {
              setStarterStarted(true);
              onStarterPack?.();
            }}
            className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            data-track="starter_pack.capture"
            style={{ backgroundColor: palette[600] }}
          >
            Get the starter pack ({STARTER_PACK.length} reads)
          </button>
        )}
      </div>
      <button
        onClick={() => {
          setStarterDismissed(true);
          localStorage.setItem("starter-banner-dismissed", "1");
        }}
        className="p-1 rounded hover:bg-black/5 flex-shrink-0"
        title="Dismiss"
      >
        <XIcon className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
      </button>
    </div>
  ) : null;

  // Nudge one-click capture until the extension announces itself
  const extensionDetected = useExtensionDetected();
  const [extensionDismissed, setExtensionDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("extension-banner-dismissed") === "1"
  );
  const [extensionInstallStarted, setExtensionInstallStarted] = useState(false);
  const showExtensionBanner = extensionDetected === false && !extensionDismissed;

  // Only ever open a window when the user explicitly asks for it (step 1's
  // button) — surprise windows feel like a hijack.
  const revealExtensionFolder = () => {
    fetch("/api/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "extension" }),
    });
  };

  const extensionBanner = showExtensionBanner ? (
    <div
      className="w-full max-w-2xl mx-auto mb-6 px-4 py-3 rounded-xl border flex items-start gap-3"
      style={{ borderColor: theme.border, backgroundColor: `${palette[500]}08` }}
    >
      <Puzzle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: palette[600] }} />
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium" style={{ color: theme.text }}>
          Capture in one click — install the browser extension
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: theme.textMuted }}>
          It captures pages exactly as you see them, including logged-in pages and tweets. Takes
          about fifteen seconds — this banner disappears by itself once it&apos;s connected.
        </p>
        {extensionInstallStarted ? (
          <div className="mt-2">
            <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: theme.textMuted }}>
              <li>
                <button
                  onClick={revealExtensionFolder}
                  className="underline hover:opacity-80"
                  data-track="extension_banner.reveal"
                  style={{ color: palette[600] }}
                >
                  Show the extension folder
                </button>{" "}
                — it opens selected, ready to drag
              </li>
              <li>
                Open <code>chrome://extensions</code> and turn on Developer mode (top right)
              </li>
              <li>
                <strong>Drag the selected folder anywhere onto that page</strong> — installed
              </li>
            </ol>
            {extensionPath && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: theme.textLight }}>
                <span>Prefer &quot;Load unpacked&quot;? It&apos;s this folder:</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(extensionPath)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border hover:bg-black/5"
                  title="Copy path"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  <code className="truncate max-w-64">{extensionPath}</code>
                  <Copy className="w-3 h-3 flex-shrink-0" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setExtensionInstallStarted(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              data-track="extension_banner.install"
              style={{ backgroundColor: palette[600] }}
            >
              Install now
            </button>
            <a
              href="https://github.com/ryannli/secondbrain#chrome-extension"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs hover:underline"
              data-track="extension_banner.setup"
              style={{ color: theme.textMuted }}
            >
              or read the guide
            </a>
          </div>
        )}
      </div>
      <button
        onClick={() => {
          setExtensionDismissed(true);
          localStorage.setItem("extension-banner-dismissed", "1");
        }}
        className="p-1 rounded hover:bg-black/5 flex-shrink-0"
        title="Dismiss"
      >
        <XIcon className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
      </button>
    </div>
  ) : null;

  // Rotating taglines
  const taglines = [
    "You can't read everything. You don't have to.",
    "The art of knowing what to ignore.",
    "Not storage. Sense-making.",
    "From noise to signal.",
    "Information overwhelms. Your second brain evolves.",
    "Free your judgment from information triage.",
  ];
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % taglines.length);
    }, 15000); // 15 seconds to match animation duration
    return () => clearInterval(interval);
  }, [taglines.length]);

  if (sources.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Logo className="w-12 h-12 mb-4" color={theme.textLight} />
        <h2 className="text-lg font-medium mb-2">Welcome to Second Brain</h2>
        <div className="mb-6 h-6">
          <p
            key={`tagline-${taglineIndex}`}
            className="text-base text-center font-medium animate-gentle-fade"
            style={{ color: theme.text }}
          >
            {taglines[taglineIndex]}
          </p>
        </div>
        {captureInputElement}
        {(starterBanner || extensionBanner) && (
          <div className="w-full mt-6">
            {starterBanner}
            {extensionBanner}
          </div>
        )}
      </div>
    );
  }

  // Apply filter first
  const filteredSources = sources.filter((s) => {
    if (filter === "saved") return s.meta.saved === true;
    if (filter === "recommended") return s.action === "must_read" || s.action === "worth_reading";
    return true; // "all"
  });

  // Split sources into inbox (unread) and recent (read)
  const inboxSources = filteredSources.filter(
    (s) => s.meta.readStatus !== "read"
  );
  const recentSources = filteredSources
    .filter((s) => s.meta.readStatus === "read")
    .sort((a, b) => {
      // Sort by lastReadAt descending
      const timeA = a.meta.lastReadAt ? new Date(a.meta.lastReadAt).getTime() : 0;
      const timeB = b.meta.lastReadAt ? new Date(b.meta.lastReadAt).getTime() : 0;
      return timeB - timeA;
    });

  // Count for filter badges
  const savedCount = sources.filter((s) => s.meta.saved === true).length;
  const recommendedCount = sources.filter((s) => s.action === "must_read" || s.action === "worth_reading").length;

  // Render a source card
  const renderSourceCard = (source: SourceSummary) => {
    const { Icon: SourceIcon, color: iconColor } = getSourceIcon(source.meta.sourceUrl, source.meta.type, palette[500]);
    const isExtracting = source.meta.processingStatus === "processing";
    const isFailed = source.meta.processingStatus === "failed";
    const isInProgress = source.meta.processingStage != null && source.meta.processingStage !== "complete";
    const badge = isInProgress ? (
      <span
        className="max-w-full truncate px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
        style={{ backgroundColor: `${palette[500]}15`, color: palette[500] }}
      >
        <ProcessingTimer createdAt={source.meta.createdAt} />
      </span>
    ) : isFailed ? (
      <span
        className="max-w-full truncate px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
        style={{ backgroundColor: "#ef444415", color: "#ef4444" }}
      >
        Failed
      </span>
    ) : source.action ? (
      <span
        className="max-w-full truncate px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
        style={
          source.action === "must_read"
            ? {
                backgroundColor: `${palette[600]}30`,
                color: palette[700],
                border: `1.5px solid ${palette[600]}`,
              }
            : source.action === "worth_reading"
            ? {
                backgroundColor: `${palette[500]}20`,
                color: palette[600],
                border: `1px solid ${palette[500]}`,
              }
            : {
                backgroundColor: `${getScoreColor(source.score ?? 50)}15`,
                color: getScoreColor(source.score ?? 50),
              }
        }
      >
        {ACTION_CONFIG[source.action]?.label ?? source.action}
      </span>
    ) : null;

    return (
      <button
        key={source.meta.id}
        onClick={() => !isExtracting && onSelect(source.meta.id)}
        className={`p-4 min-h-[160px] border rounded-xl transition-all text-left overflow-hidden bg-white dark:bg-zinc-900 flex flex-col ${isExtracting ? "opacity-70" : "hover:shadow-md"}`}
        data-track="source.card_select"
        style={{ borderColor: theme.border }}
        disabled={isExtracting}
      >
        {/* Source marker + status */}
        <div className="flex items-center justify-between gap-3 mb-3 min-w-0">
          {isExtracting ? (
            <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" style={{ color: palette[500] }} />
          ) : (
            <SourceIcon className="w-5 h-5 flex-shrink-0" style={{ color: iconColor }} />
          )}
          <span className="min-w-0 flex-shrink">{badge}</span>
        </div>

        {/* Title */}
        <div className="min-w-0 mb-3">
          <h3 className="font-medium leading-snug line-clamp-2 break-words text-sm" style={{ color: theme.text }}>
            {source.meta.title}
          </h3>
          <p className="text-xs mt-1 truncate" style={{ color: theme.textLight }}>
            {source.meta.sourceUrl && <>{new URL(source.meta.sourceUrl).hostname}</>}
            {source.meta.sourceUrl && source.meta.createdAt && " · "}
            {source.meta.createdAt && formatRelativeTime(source.meta.createdAt)}
          </p>
        </div>

        {/* Progress bar or status text */}
        {isInProgress ? (
          <ProcessingProgressBar stage={source.meta.processingStage!} color={palette[500]} mutedColor={theme.textMuted} />
        ) : isFailed ? (
          <p className="text-xs" style={{ color: "#ef4444" }}>
            <LinkifiedText text={source.meta.processingError || "Processing failed"} />
          </p>
        ) : source.reason && (
          <p className="text-xs line-clamp-2 break-words" style={{ color: theme.textMuted }}>
            {source.reason}
          </p>
        )}
      </button>
    );
  };

  return (
    <div>
      {/* Tagline + Capture Input */}
      <div className="mt-4 mb-2 h-6">
        <p
          key={`tagline-${taglineIndex}`}
          className="text-base text-center font-medium animate-gentle-fade"
          style={{ color: theme.text }}
        >
          {taglines[taglineIndex]}
        </p>
      </div>
      {captureInputElement}
      {starterBanner}
      {extensionBanner}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mt-6 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${filter === "all" ? "text-white" : "hover:bg-black/5"}`}
          data-track="filter.all"
          style={{
            backgroundColor: filter === "all" ? palette[500] : undefined,
            color: filter === "all" ? "white" : theme.textMuted,
          }}
        >
          All
          {sources.length > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: filter === "all" ? "rgba(255,255,255,0.2)" : `${palette[500]}15`,
                color: filter === "all" ? "white" : palette[500],
              }}
            >
              {sources.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("saved")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${filter === "saved" ? "text-white" : "hover:bg-black/5"}`}
          data-track="filter.saved"
          style={{
            backgroundColor: filter === "saved" ? palette[500] : undefined,
            color: filter === "saved" ? "white" : theme.textMuted,
          }}
        >
          <Bookmark className="w-4 h-4" />
          Saved
          {savedCount > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: filter === "saved" ? "rgba(255,255,255,0.2)" : `${palette[500]}15`,
                color: filter === "saved" ? "white" : palette[500],
              }}
            >
              {savedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setFilter("recommended")}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 ${filter === "recommended" ? "text-white" : "hover:bg-black/5"}`}
          data-track="filter.recommended"
          style={{
            backgroundColor: filter === "recommended" ? palette[500] : undefined,
            color: filter === "recommended" ? "white" : theme.textMuted,
          }}
        >
          <Flame className="w-4 h-4" />
          Recommended
          {recommendedCount > 0 && (
            <span
              className="px-1.5 py-0.5 text-xs rounded-full"
              style={{
                backgroundColor: filter === "recommended" ? "rgba(255,255,255,0.2)" : `${palette[500]}15`,
                color: filter === "recommended" ? "white" : palette[500],
              }}
            >
              {recommendedCount}
            </span>
          )}
        </button>
      </div>

      {/* Feed Section */}
      {feed && (
        <FeedSection
          items={feed.items}
          interests={feed.interests}
          generatedAt={feed.generatedAt}
          fromCache={feed.fromCache}
          message={feed.message}
          loading={feed.loading}
          error={feed.error}
          onCapture={feed.onCapture}
          onDismiss={feed.onDismiss}
          onRefresh={feed.onRefresh}
          palette={palette}
          theme={theme}
        />
      )}

      {/* Inbox Section - only show if there are unread items */}
      {inboxSources.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Inbox className="w-5 h-5" style={{ color: palette[500] }} />
            <h2 className="font-medium">Inbox</h2>
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full"
              style={{ backgroundColor: `${palette[500]}15`, color: palette[500] }}
            >
              {inboxSources.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {inboxSources.map(renderSourceCard)}
          </div>
        </>
      )}

      {/* Recent Sources Section */}
      {recentSources.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" style={{ color: theme.textMuted }} />
            <h2 className="font-medium">Recent</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recentSources.map(renderSourceCard)}
          </div>
        </>
      )}
    </div>
  );
});

/**
 * Timer component showing elapsed time since processing started
 */
function ProcessingTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = new Date(createdAt).getTime();

    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return <span>{formatTime(elapsed)}</span>;
}

const STAGE_CONFIG: Record<ProcessingStage, { base: number; max: number; label: string }> = {
  extracting: { base: 8, max: 28, label: "Extracting content..." },
  analyzing: { base: 33, max: 60, label: "Analyzing..." },
  connecting: { base: 66, max: 92, label: "Finding connections..." },
  complete: { base: 100, max: 100, label: "" },
};

function ProcessingProgressBar({ stage, color, mutedColor }: { stage: ProcessingStage; color: string; mutedColor: string }) {
  const [progress, setProgress] = useState(STAGE_CONFIG[stage].base);

  // Reset to the new stage's base progress (render-phase adjustment)
  const [prevStage, setPrevStage] = useState(stage);
  if (prevStage !== stage) {
    setPrevStage(stage);
    setProgress(STAGE_CONFIG[stage].base);
  }

  useEffect(() => {
    const config = STAGE_CONFIG[stage];

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= config.max) return prev;
        const remaining = config.max - prev;
        return prev + remaining * 0.06;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage]);

  return (
    <div className="ml-8 mt-1">
      <p className="text-xs mb-1.5" style={{ color: mutedColor }}>
        {STAGE_CONFIG[stage].label}
      </p>
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${color}15` }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: color,
            transition: "width 0.8s ease-out",
          }}
        />
      </div>
    </div>
  );
}
