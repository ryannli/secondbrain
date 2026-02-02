"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  Clock,
  X,
  Inbox,
} from "lucide-react";
import { SourceSummary, ACTION_CONFIG, FeedItem } from "@/lib/types";
import { Logo, PDFIcon } from "@/components/Icons";
import { getSourceIcon } from "@/lib/sourceIcon";
import { FeedSection } from "@/components/FeedSection";

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
}

export function Dashboard({
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
}: DashboardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<{ file: File; preview: string | null; isImage: boolean } | null>(null);

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
    <div className="max-w-xl mx-auto mt-8 mb-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-xl border bg-white shadow-sm transition-all ${
          isDragging ? "border-dashed border-2" : ""
        }`}
        style={{
          borderColor: isDragging ? palette[500] : theme.border,
          backgroundColor: isDragging ? `${palette[500]}05` : "white",
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
        <div className="flex items-center gap-3 p-3">
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
            style={{ backgroundColor: palette[600] }}
          >
            Capture
          </button>
        </div>
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

  // Rotating taglines
  const taglines = [
    "You can't read everything. You don't have to.",
    "The art of knowing what to ignore.",
    "Your cognitive throughput, amplified.",
    "Not storage. Sense-making.",
    "Metabolize. Don't accumulate.",
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
      </div>
    );
  }

  // Split sources into inbox (unread) and recent (read)
  const inboxSources = sources.filter(
    (s) => s.meta.readStatus !== "read"
  );
  const recentSources = sources
    .filter((s) => s.meta.readStatus === "read")
    .sort((a, b) => {
      // Sort by lastReadAt descending
      const timeA = a.meta.lastReadAt ? new Date(a.meta.lastReadAt).getTime() : 0;
      const timeB = b.meta.lastReadAt ? new Date(b.meta.lastReadAt).getTime() : 0;
      return timeB - timeA;
    });

  // Render a source card
  const renderSourceCard = (source: SourceSummary) => {
    const { Icon: SourceIcon, color: iconColor } = getSourceIcon(source.meta.sourceUrl, source.meta.type, palette[500]);
    const isProcessing = source.meta.processingStatus === "processing";
    const isFailed = source.meta.processingStatus === "failed";

    return (
      <button
        key={source.meta.id}
        onClick={() => !isProcessing && onSelect(source.meta.id)}
        className={`p-4 border rounded-xl transition-all text-left relative ${isProcessing ? "opacity-70" : "hover:shadow-md"}`}
        style={{ borderColor: theme.border, backgroundColor: "white" }}
        disabled={isProcessing}
      >
        {/* Badge - absolute positioned */}
        {isProcessing ? (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
            style={{ backgroundColor: `${palette[500]}15`, color: palette[500] }}
          >
            <ProcessingTimer createdAt={source.meta.createdAt} />
          </span>
        ) : isFailed ? (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
            style={{ backgroundColor: "#ef444415", color: "#ef4444" }}
          >
            Failed
          </span>
        ) : source.action && (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
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
        )}

        {/* Header: Icon + Title */}
        <div className="flex items-start gap-3 mb-2 pr-24">
          {isProcessing ? (
            <Loader2 className="w-5 h-5 mt-0.5 flex-shrink-0 animate-spin" style={{ color: palette[500] }} />
          ) : (
            <SourceIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: iconColor }} />
          )}
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

        {/* Reason or Processing Status */}
        {isProcessing ? (
          <p className="text-xs ml-8" style={{ color: theme.textMuted }}>
            Extracting content and analyzing...
          </p>
        ) : isFailed ? (
          <p className="text-xs ml-8" style={{ color: "#ef4444" }}>
            {source.meta.processingError || "Processing failed"}
          </p>
        ) : source.reason && (
          <p className="text-xs line-clamp-2 ml-8" style={{ color: theme.textMuted }}>
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
}

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
