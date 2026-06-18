"use client";

import React, { useState } from "react";
import { X, Plus, Copy, Check, Sun, Moon, Monitor, Bot, RefreshCw, Terminal, AlertCircle } from "lucide-react";
import { theme } from "@/lib/theme";
import type { ThemeMode, RssFeedSource } from "@/lib/storage";
import { DEFAULT_RSS_FEEDS, SUGGESTED_SEARCH_SOURCES } from "@/lib/config";
import { AGENT_PROVIDER_DETAILS, type AgentProvider, type AgentStatus } from "@/lib/agentTypes";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontFamily: string;
  onFontChange: (font: string) => void;
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  rootPath: string;
  debugLoadingMode: "none" | "analysis" | "connections";
  onDebugModeChange: (mode: "none" | "analysis" | "connections") => void;
  palette: Record<number, string>;
  rssFeeds?: RssFeedSource[];
  onRssFeedsChange?: (feeds: RssFeedSource[]) => void;
  searchSources?: string[];
  onSearchSourcesChange?: (sources: string[]) => void;
  feedInterests?: string[];
  onFeedInterestsChange?: (interests: string[]) => void;
  agentProvider?: AgentProvider;
  onAgentProviderChange?: (provider: AgentProvider) => void;
  agentStatuses?: Record<AgentProvider, AgentStatus> | null;
  agentStatusLoading?: boolean;
  onRefreshAgentStatus?: () => void;
  // Reading customization
  fontSize?: string;
  onFontSizeChange?: (size: string) => void;
  headingStyle?: string;
  onHeadingStyleChange?: (style: string) => void;
}

const THEME_OPTIONS = [
  { id: "light" as const, label: "Light", icon: Sun },
  { id: "dark" as const, label: "Dark", icon: Moon },
  { id: "system" as const, label: "System", icon: Monitor },
];

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

const RSS_PRESETS: RssFeedSource[] = DEFAULT_RSS_FEEDS;

type Tab = "appearance" | "feed" | "agent" | "advanced";

const AGENT_OPTIONS: AgentProvider[] = ["claude", "codex"];

export function SettingsModal({
  isOpen,
  onClose,
  fontFamily,
  onFontChange,
  themeMode,
  onThemeChange,
  rootPath,
  debugLoadingMode,
  onDebugModeChange,
  palette,
  rssFeeds = [],
  onRssFeedsChange,
  searchSources = [],
  onSearchSourcesChange,
  feedInterests = [],
  onFeedInterestsChange,
  agentProvider = "claude",
  onAgentProviderChange,
  agentStatuses,
  agentStatusLoading = false,
  onRefreshAgentStatus,
  fontSize = "sm",
  onFontSizeChange,
  headingStyle = "clean",
  onHeadingStyleChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("appearance");
  const [newRssUrl, setNewRssUrl] = useState("");
  const [newRssLabel, setNewRssLabel] = useState("");
  const [newSearchSource, setNewSearchSource] = useState("");
  const [newInterest, setNewInterest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPath = () => {
    if (rootPath) {
      navigator.clipboard.writeText(rootPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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

  const selectedAgentStatus = agentStatuses?.[agentProvider];
  const selectedAgentDetails = AGENT_PROVIDER_DETAILS[agentProvider];
  const selectedAgentReady = selectedAgentStatus?.state === "ready";

  const agentStateStyle = (status?: AgentStatus) => {
    if (!status) return { label: "Checking", color: theme.textMuted, background: "rgba(148, 163, 184, 0.12)" };
    if (status.state === "ready") return { label: "Connected", color: palette[700], background: `${palette[500]}15` };
    if (status.state === "missing") return { label: "Not installed", color: "#b45309", background: "rgba(245, 158, 11, 0.12)" };
    return { label: "Needs attention", color: "#b91c1c", background: "rgba(239, 68, 68, 0.12)" };
  };

  // RSS feed helpers
  const isRssPresetEnabled = (preset: RssFeedSource) =>
    rssFeeds.some(f => f.url === preset.url);

  const toggleRssPreset = (preset: RssFeedSource) => {
    if (!onRssFeedsChange) return;
    if (isRssPresetEnabled(preset)) {
      onRssFeedsChange(rssFeeds.filter(f => f.url !== preset.url));
    } else {
      onRssFeedsChange([...rssFeeds, preset]);
    }
  };

  const addCustomRss = () => {
    if (!onRssFeedsChange || !newRssUrl.trim()) return;
    const url = newRssUrl.trim();
    if (rssFeeds.some(f => f.url === url)) return;
    const label = newRssLabel.trim() || url;
    onRssFeedsChange([...rssFeeds, { url, label }]);
    setNewRssUrl("");
    setNewRssLabel("");
  };

  const removeRssFeed = (url: string) => {
    if (onRssFeedsChange) {
      onRssFeedsChange(rssFeeds.filter(f => f.url !== url));
    }
  };

  // Search source helpers
  const addSearchSource = (domain: string) => {
    const cleaned = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/$/, "");
    if (cleaned && !searchSources.includes(cleaned) && onSearchSourcesChange) {
      onSearchSourcesChange([...searchSources, cleaned]);
    }
    setNewSearchSource("");
  };

  const removeSearchSource = (domain: string) => {
    if (onSearchSourcesChange) {
      onSearchSourcesChange(searchSources.filter(s => s !== domain));
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
        className="relative rounded-xl shadow-xl w-[640px] max-w-[90vw] max-h-[85vh] flex flex-col"
        style={{ backgroundColor: theme.bg, borderColor: theme.border }}
      >
        {/* Header with tabs */}
        <div className="px-6 pt-6 pb-0 border-b" style={{ borderColor: theme.border }}>
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          <div className="flex gap-6">
            {([
              { id: "appearance" as Tab, label: "Appearance" },
              { id: "feed" as Tab, label: "Feed" },
              { id: "agent" as Tab, label: "Agent" },
              { id: "advanced" as Tab, label: "Advanced" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="pb-3 text-sm font-medium transition-colors relative"
                style={{
                  color: activeTab === tab.id ? palette[600] : theme.textMuted,
                }}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ backgroundColor: palette[500] }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

        {activeTab === "appearance" && (
          <>
            {/* Theme */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Theme</label>
              <div className="flex gap-2">
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => onThemeChange(option.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all"
                      data-track="settings.theme"
                      style={{
                        borderColor: themeMode === option.id ? palette[500] : theme.border,
                        backgroundColor: themeMode === option.id ? `${palette[500]}10` : "transparent",
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font Family */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Font</label>
              <div className="grid grid-cols-3 gap-2">
                {FONT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onFontChange(option.id)}
                    className="px-3 py-2 rounded-lg border text-center transition-all hover:border-gray-300"
                    data-track="settings.font"
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

            {/* Font Size */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Font Size</label>
              <div className="flex gap-2">
                {([
                  { id: "xs", label: "XS" },
                  { id: "sm", label: "S" },
                  { id: "base", label: "M" },
                  { id: "lg", label: "L" },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onFontSizeChange?.(option.id)}
                    className="flex-1 px-3 py-2 rounded-lg border text-sm transition-all"
                    data-track="settings.fontsize"
                    style={{
                      borderColor: fontSize === option.id ? palette[500] : theme.border,
                      backgroundColor: fontSize === option.id ? `${palette[500]}10` : "transparent",
                      color: fontSize === option.id ? palette[600] : undefined,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Heading Style */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2">Heading Style</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "clean", label: "Clean", desc: "Prose defaults" },
                  { id: "colored", label: "Colored", desc: "Palette tinted" },
                  { id: "accented", label: "Accented", desc: "Border strip" },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => onHeadingStyleChange?.(option.id)}
                    className="px-3 py-2 rounded-lg border text-left transition-all"
                    data-track="settings.headingstyle"
                    style={{
                      borderColor: headingStyle === option.id ? palette[500] : theme.border,
                      backgroundColor: headingStyle === option.id ? `${palette[500]}10` : "transparent",
                    }}
                  >
                    <div className="font-medium text-sm" style={{ color: headingStyle === option.id ? palette[600] : undefined }}>{option.label}</div>
                    <div className="text-xs text-gray-400">{option.desc}</div>
                  </button>
                ))}
              </div>
            </div>

          </>
        )}

        {activeTab === "feed" && (
          <>
            {/* Your Radar */}
            {onFeedInterestsChange && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Your Radar</label>
                  <button
                    onClick={generateFromLibrary}
                    disabled={isGenerating}
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors disabled:opacity-50"
                    data-track="settings.generateinterests"
                    style={{ borderColor: theme.border, color: palette[600] }}
                  >
                    {isGenerating ? "Generating..." : "Generate from library"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mb-3">We&apos;ll keep you updated on these topics</p>

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

            {/* Search Sources */}
            {onSearchSourcesChange && (
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Search Sources</label>
                <p className="text-xs text-gray-400 mb-3">Combined with your Radar topics above</p>

                {/* Suggested search sources with checkboxes */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {SUGGESTED_SEARCH_SOURCES.map((source) => {
                    const isChecked = searchSources.includes(source.domain);
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
                              addSearchSource(source.domain);
                            } else {
                              removeSearchSource(source.domain);
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

                {/* Custom search source input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSearchSource}
                    onChange={(e) => setNewSearchSource(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSearchSource(newSearchSource)}
                    placeholder="Add custom domain (e.g. example.com)"
                    className="flex-1 px-3 py-2 text-sm border rounded-lg"
                    style={{ borderColor: theme.border }}
                  />
                  <button
                    onClick={() => addSearchSource(newSearchSource)}
                    disabled={!newSearchSource}
                    className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: palette[500] }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Show custom search sources (not in suggested list) */}
                {searchSources.filter(s => !SUGGESTED_SEARCH_SOURCES.some(ss => ss.domain === s)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {searchSources.filter(s => !SUGGESTED_SEARCH_SOURCES.some(ss => ss.domain === s)).map((source) => (
                      <span
                        key={source}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                      >
                        {source}
                        <button
                          onClick={() => removeSearchSource(source)}
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

            {/* RSS Feeds */}
            {onRssFeedsChange && (
              <div>
                <label className="block text-sm font-medium mb-2">RSS Feeds</label>
                <p className="text-xs text-gray-400 mb-3">Subscribe to blogs, newsletters, and feeds you follow</p>

                {/* Preset RSS feeds */}
                <div className="space-y-2 mb-3">
                  {RSS_PRESETS.map((preset) => (
                    <label
                      key={preset.url}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{
                        borderColor: isRssPresetEnabled(preset) ? palette[500] : theme.border,
                        backgroundColor: isRssPresetEnabled(preset) ? `${palette[500]}08` : "transparent",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isRssPresetEnabled(preset)}
                        onChange={() => toggleRssPreset(preset)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: palette[500] }}
                      />
                      <span className="text-sm">{preset.label}</span>
                    </label>
                  ))}
                </div>

                {/* Custom RSS feeds (non-preset) */}
                {rssFeeds.filter(f => !RSS_PRESETS.some(p => p.url === f.url)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {rssFeeds.filter(f => !RSS_PRESETS.some(p => p.url === f.url)).map((feed) => (
                      <span
                        key={feed.url}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: `${palette[500]}15`, color: palette[600] }}
                      >
                        {feed.label}
                        <button
                          onClick={() => removeRssFeed(feed.url)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add custom RSS */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRssLabel}
                    onChange={(e) => setNewRssLabel(e.target.value)}
                    placeholder="Label"
                    className="w-24 px-3 py-2 text-sm border rounded-lg"
                    style={{ borderColor: theme.border }}
                  />
                  <input
                    type="text"
                    value={newRssUrl}
                    onChange={(e) => setNewRssUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomRss()}
                    placeholder="https://example.com/feed.rss"
                    className="flex-1 px-3 py-2 text-sm border rounded-lg"
                    style={{ borderColor: theme.border }}
                  />
                  <button
                    onClick={addCustomRss}
                    disabled={!newRssUrl.trim()}
                    className="px-3 py-2 rounded-lg text-white text-sm disabled:opacity-50"
                    style={{ backgroundColor: palette[500] }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">Subreddit feeds: <code className="text-xs">reddit.com/r/SUBREDDIT/.rss</code></p>
              </div>
            )}
          </>
        )}

        {activeTab === "agent" && (
          <>
            <div className="mb-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Agent Provider</label>
                  <p className="text-xs text-gray-400">Used for capture analysis, feed ranking, and the Ask panel.</p>
                </div>
                <button
                  onClick={onRefreshAgentStatus}
                  disabled={agentStatusLoading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-50"
                  style={{ borderColor: theme.border, color: theme.textMuted }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${agentStatusLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              <div
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3 mb-3"
                style={{ borderColor: selectedAgentReady ? palette[500] : theme.border, backgroundColor: selectedAgentReady ? `${palette[500]}08` : "transparent" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: agentStateStyle(selectedAgentStatus).background }}
                  >
                    {selectedAgentReady ? (
                      <Bot className="w-4 h-4" style={{ color: agentStateStyle(selectedAgentStatus).color }} />
                    ) : (
                      <AlertCircle className="w-4 h-4" style={{ color: agentStateStyle(selectedAgentStatus).color }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{selectedAgentDetails.label}</div>
                    <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                      {selectedAgentStatus?.message ?? "Checking local CLI status..."}
                    </div>
                  </div>
                </div>
                <span
                  className="px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                  style={{
                    color: agentStateStyle(selectedAgentStatus).color,
                    backgroundColor: agentStateStyle(selectedAgentStatus).background,
                  }}
                >
                  {agentStateStyle(selectedAgentStatus).label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {AGENT_OPTIONS.map((provider) => {
                  const details = AGENT_PROVIDER_DETAILS[provider];
                  const status = agentStatuses?.[provider];
                  const state = agentStateStyle(status);
                  const isSelected = agentProvider === provider;
                  return (
                    <button
                      key={provider}
                      onClick={() => onAgentProviderChange?.(provider)}
                      className="text-left rounded-lg border px-3 py-3 transition-all"
                      style={{
                        borderColor: isSelected ? palette[500] : theme.border,
                        backgroundColor: isSelected ? `${palette[500]}10` : "transparent",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          <Terminal className="w-3.5 h-3.5" />
                          {details.label}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: status?.state === "ready" ? palette[500] : state.color }}
                        />
                      </div>
                      <div className="text-xs mb-1" style={{ color: theme.textMuted }}>
                        Command: <code>{status?.command ?? details.command}</code>
                      </div>
                      <div className="text-xs" style={{ color: state.color }}>
                        {status?.version || state.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!selectedAgentReady && (
              <div
                className="rounded-lg border px-3 py-3 text-sm"
                style={{ borderColor: "rgba(245, 158, 11, 0.35)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: theme.text }}
              >
                <div className="font-medium mb-1">Agent is not ready</div>
                <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                  Install and sign in to {selectedAgentDetails.label}, or choose another connected provider above.
                  RSS reading and manual browsing still work, but AI analysis and Ask need a local CLI provider.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "advanced" && (
          <>
            {/* Data Path */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1">Data Location</label>
              <div className="flex items-start gap-2">
                <p className="text-sm break-all flex-1" style={{ color: theme.textMuted }}>{rootPath || "Loading..."}</p>
                {rootPath && (
                  <button
                    onClick={copyPath}
                    className="p-1 rounded transition-colors flex-shrink-0 hover:opacity-70"
                    title="Copy path"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" style={{ color: theme.textLight }} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Debug Loading Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">Debug: Loading UI Preview</label>
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
          </>
        )}

        </div>
        {/* Close Button */}
        <div className="p-6 pt-4 border-t" style={{ borderColor: theme.border }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
            data-track="settings.close"
            style={{ backgroundColor: palette[600] }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
