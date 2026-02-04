"use client";

import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { theme } from "@/lib/theme";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontFamily: string;
  onFontChange: (font: string) => void;
  rootPath: string;
  debugLoadingMode: "none" | "analysis" | "connections";
  onDebugModeChange: (mode: "none" | "analysis" | "connections") => void;
  palette: Record<number, string>;
  feedSources?: string[];
  onFeedSourcesChange?: (sources: string[]) => void;
  feedInterests?: string[];
  onFeedInterestsChange?: (interests: string[]) => void;
}

const FONT_OPTIONS = [
  { id: "outfit", name: "Outfit" },
  { id: "inter", name: "Inter" },
  { id: "dm-sans", name: "DM Sans" },
  { id: "space-grotesk", name: "Space Grotesk" },
  { id: "sora", name: "Sora" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans" },
];

const DEBUG_OPTIONS = [
  { id: "none", label: "Off" },
  { id: "analysis", label: "Analysis" },
  { id: "connections", label: "Connections" },
] as const;

// Common news sources for quick add
const SUGGESTED_SOURCES = [
  { domain: "news.ycombinator.com", label: "Hacker News" },
  { domain: "reddit.com", label: "Reddit" },
  { domain: "arstechnica.com", label: "Ars Technica" },
  { domain: "theverge.com", label: "The Verge" },
  { domain: "wired.com", label: "Wired" },
  { domain: "techcrunch.com", label: "TechCrunch" },
  { domain: "nytimes.com", label: "New York Times" },
  { domain: "bloomberg.com", label: "Bloomberg" },
];

export function SettingsModal({
  isOpen,
  onClose,
  fontFamily,
  onFontChange,
  rootPath,
  debugLoadingMode,
  onDebugModeChange,
  palette,
  feedSources = [],
  onFeedSourcesChange,
  feedInterests = [],
  onFeedInterestsChange,
}: SettingsModalProps) {
  const [newSource, setNewSource] = useState("");
  const [newInterest, setNewInterest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateFromLibrary = async () => {
    if (!onFeedInterestsChange) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/feed/interests", { method: "POST" });
      const data = await res.json();
      if (data.success && data.interests) {
        onFeedInterestsChange(data.interests);
      }
    } catch (err) {
      console.error("Failed to generate interests:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const addSource = (domain: string) => {
    const cleaned = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
    if (cleaned && !feedSources.includes(cleaned) && onFeedSourcesChange) {
      onFeedSourcesChange([...feedSources, cleaned]);
    }
    setNewSource("");
  };

  const removeSource = (domain: string) => {
    if (onFeedSourcesChange) {
      onFeedSourcesChange(feedSources.filter(s => s !== domain));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-xl shadow-xl w-96 max-w-[90vw] max-h-[85vh] flex flex-col"
        style={{ borderColor: theme.border }}
      >
        <h2 className="text-lg font-semibold p-6 pb-4 border-b" style={{ borderColor: theme.border }}>Settings</h2>
        <div className="flex-1 overflow-y-auto p-6 pt-4">

        {/* Font Family */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Font</label>
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onFontChange(option.id)}
                className="px-3 py-2 rounded-lg border text-center transition-all hover:border-gray-300"
                style={{
                  fontFamily: `var(--font-${option.id})`,
                  borderColor: fontFamily === option.id ? palette[500] : theme.border,
                  backgroundColor: fontFamily === option.id ? `${palette[500]}10` : "transparent",
                }}
              >
                <div className="font-medium text-sm">Second Brain</div>
                <div className="text-xs text-gray-400">{option.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data Path */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Data Location</label>
          <p className="text-sm text-gray-500 break-all">{rootPath || "Loading..."}</p>
        </div>

        {/* Feed Interests */}
        {onFeedInterestsChange && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Your Radar</label>
              <button
                onClick={generateFromLibrary}
                disabled={isGenerating}
                className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={{ borderColor: theme.border, color: palette[600] }}
              >
                {isGenerating ? "Generating..." : "Generate from library"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">We'll keep you updated on these topics</p>

            {/* Interest tags */}
            <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
              {feedInterests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm"
                  style={{ backgroundColor: `${palette[500]}15`, color: palette[700] }}
                >
                  {interest}
                  <button
                    onClick={() => onFeedInterestsChange(feedInterests.filter(i => i !== interest))}
                    className="hover:opacity-70 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {feedInterests.length === 0 && (
                <span className="text-sm text-gray-400 italic">Add topics to your radar</span>
              )}
            </div>

            {/* Add interest input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newInterest.trim()) {
                    const trimmed = newInterest.trim();
                    if (!feedInterests.includes(trimmed)) {
                      onFeedInterestsChange([...feedInterests, trimmed]);
                    }
                    setNewInterest("");
                  }
                }}
                placeholder="e.g. AI agents, startups, web dev"
                className="flex-1 px-3 py-2 text-sm border rounded-lg"
                style={{ borderColor: theme.border }}
              />
              <button
                onClick={() => {
                  const trimmed = newInterest.trim();
                  if (trimmed && !feedInterests.includes(trimmed)) {
                    onFeedInterestsChange([...feedInterests, trimmed]);
                  }
                  setNewInterest("");
                }}
                disabled={!newInterest.trim()}
                className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
                style={{ backgroundColor: palette[500] }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Feed Sources */}
        {onFeedSourcesChange && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Preferred Sources</label>
            <p className="text-xs text-gray-400 mb-3">News from these sites will be prioritized</p>

            {/* Suggested sources with checkboxes */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {SUGGESTED_SOURCES.map((source) => {
                const isChecked = feedSources.includes(source.domain);
                return (
                  <label
                    key={source.domain}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{
                      borderColor: isChecked ? palette[500] : theme.border,
                      backgroundColor: isChecked ? `${palette[500]}08` : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          addSource(source.domain);
                        } else {
                          removeSource(source.domain);
                        }
                      }}
                      className="w-4 h-4 rounded"
                      style={{ accentColor: palette[500] }}
                    />
                    <span className="text-sm">{source.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Custom source input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSource(newSource)}
                placeholder="Add custom domain (e.g. example.com)"
                className="flex-1 px-3 py-2 text-sm border rounded-lg"
                style={{ borderColor: theme.border }}
              />
              <button
                onClick={() => addSource(newSource)}
                disabled={!newSource}
                className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
                style={{ backgroundColor: palette[500] }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Show custom sources (not in suggested list) */}
            {feedSources.filter(s => !SUGGESTED_SOURCES.some(ss => ss.domain === s)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {feedSources.filter(s => !SUGGESTED_SOURCES.some(ss => ss.domain === s)).map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                  >
                    {source}
                    <button
                      onClick={() => removeSource(source)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Debug Loading Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Debug: Preview Loading UI</label>
          <div className="flex gap-2">
            {DEBUG_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onDebugModeChange(option.id)}
                className="px-3 py-1.5 rounded-lg border text-sm transition-all"
                style={{
                  borderColor: debugLoadingMode === option.id ? palette[500] : theme.border,
                  backgroundColor: debugLoadingMode === option.id ? `${palette[500]}10` : "transparent",
                  color: debugLoadingMode === option.id ? palette[600] : theme.textMuted,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Preview loading states (select a source to see effect)</p>
        </div>

        </div>
        {/* Close Button */}
        <div className="p-6 pt-4 border-t" style={{ borderColor: theme.border }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: palette[600] }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
