"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { generatePalette } from "@/lib/theme";
import type { ThemeMode, RssFeedSource } from "@/lib/storage";
import { DEFAULT_RSS_FEEDS, DEFAULT_SEARCH_SOURCES } from "@/lib/config";
import { DEFAULT_AGENT_PROVIDER, isAgentProvider, type AgentProvider, type AgentStatus } from "@/lib/agentTypes";

// Apply theme class to <html> element
function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useSettings() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#3b6044");
  const [fontFamily, setFontFamily] = useState("outfit");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [rootPath, setRootPath] = useState("");
  const [libraryPath, setLibraryPath] = useState("");
  const [debugLoadingMode, setDebugLoadingMode] = useState<"none" | "analysis" | "connections">("none");
  const [rssFeeds, setRssFeeds] = useState<RssFeedSource[]>(DEFAULT_RSS_FEEDS);
  const [searchSources, setSearchSources] = useState<string[]>(DEFAULT_SEARCH_SOURCES);
  const [feedInterests, setFeedInterests] = useState<string[]>([]);
  const [agentModeEnabled, setAgentModeEnabled] = useState(false);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>(DEFAULT_AGENT_PROVIDER);
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentProvider, AgentStatus> | null>(null);
  const [agentStatusLoading, setAgentStatusLoading] = useState(false);
  const [fontSize, setFontSize] = useState("sm");
  const [headingStyle, setHeadingStyle] = useState("clean");

  const palette = useMemo(() => generatePalette(accentColor), [accentColor]);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.success) {
        setLibraryPath(data.config.libraryPath);
        if (data.config.accentColor) {
          setAccentColor(data.config.accentColor);
        }
        if (data.config.fontFamily) {
          setFontFamily(data.config.fontFamily);
        }
        if (data.config.rootPath) {
          setRootPath(data.config.rootPath);
        }
        if (data.config.rssFeeds) {
          setRssFeeds(data.config.rssFeeds);
        }
        if (data.config.searchSources) {
          setSearchSources(data.config.searchSources);
        }
        if (data.config.feedInterests) {
          setFeedInterests(data.config.feedInterests);
        }
        setAgentModeEnabled(data.config.agentModeEnabled === true);
        if (isAgentProvider(data.config.agentProvider)) {
          setAgentProvider(data.config.agentProvider);
        }
        if (data.config.theme) {
          setThemeModeState(data.config.theme);
          applyTheme(data.config.theme);
        }
        if (data.config.fontSize) setFontSize(data.config.fontSize);
        if (data.config.headingStyle) setHeadingStyle(data.config.headingStyle);
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const saveFont = async (newFont: string) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontFamily: newFont }),
      });
      const data = await res.json();
      if (data.success) {
        setFontFamily(newFont);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const saveRssFeeds = async (feeds: RssFeedSource[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rssFeeds: feeds }),
      });
      const data = await res.json();
      if (data.success) {
        setRssFeeds(feeds);
      }
    } catch (err) {
      console.error("Failed to save RSS feeds:", err);
    }
  };

  const saveSearchSources = async (sources: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchSources: sources }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchSources(sources);
      }
    } catch (err) {
      console.error("Failed to save search sources:", err);
    }
  };

  const saveFeedInterests = async (interests: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedInterests: interests }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedInterests(interests);
      }
    } catch (err) {
      console.error("Failed to save feed interests:", err);
    }
  };

  const saveAgentProvider = async (provider: AgentProvider) => {
    setAgentProvider(provider);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentProvider: provider }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save agent provider");
      }
      await loadAgentStatus();
    } catch (err) {
      console.error("Failed to save agent provider:", err);
    }
  };

  const saveAgentModeEnabled = async (enabled: boolean) => {
    setAgentModeEnabled(enabled);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentModeEnabled: enabled }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save Agent Mode");
      }
    } catch (err) {
      console.error("Failed to save Agent Mode:", err);
    }
  };

  const loadAgentStatus = useCallback(async () => {
    setAgentStatusLoading(true);
    try {
      const res = await fetch("/api/agent/status");
      const data = await res.json();
      if (data.success) {
        setAgentStatuses(data.statuses);
        if (isAgentProvider(data.selectedProvider)) {
          setAgentProvider(data.selectedProvider);
        }
      }
    } catch (err) {
      console.error("Failed to load agent status:", err);
    } finally {
      setAgentStatusLoading(false);
    }
  }, []);

  const saveReadingSetting = async (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (err) {
      console.error(`Failed to save ${key}:`, err);
    }
  };

  const saveTheme = useCallback(async (mode: ThemeMode) => {
    // Save to localStorage for flash prevention script
    localStorage.setItem("theme-mode", mode);
    // Apply immediately
    setThemeModeState(mode);
    applyTheme(mode);

    // Persist to config.json
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: mode }),
      });
    } catch (err) {
      console.error("Failed to save theme:", err);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    loadConfig();
    loadAgentStatus();
  }, [loadAgentStatus]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (themeMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    fontFamily,
    saveFont,
    themeMode,
    saveTheme,
    rootPath,
    libraryPath,
    debugLoadingMode,
    setDebugLoadingMode,
    palette,
    rssFeeds,
    saveRssFeeds,
    searchSources,
    saveSearchSources,
    feedInterests,
    saveFeedInterests,
    agentModeEnabled,
    saveAgentModeEnabled,
    agentProvider,
    saveAgentProvider,
    agentStatuses,
    agentStatusLoading,
    loadAgentStatus,
    fontSize,
    saveFontSize: (v: string) => saveReadingSetting("fontSize", v, setFontSize),
    headingStyle,
    saveHeadingStyle: (v: string) => saveReadingSetting("headingStyle", v, setHeadingStyle),
  };
}
