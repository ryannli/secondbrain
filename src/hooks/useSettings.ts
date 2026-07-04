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
  const [rootPathSource, setRootPathSource] = useState<"env" | "local" | "default">("default");
  const [rootPathLocked, setRootPathLocked] = useState(false);
  const [libraryPath, setLibraryPath] = useState("");
  const [rssFeeds, setRssFeeds] = useState<RssFeedSource[]>(DEFAULT_RSS_FEEDS);
  const [searchConfigured, setSearchConfigured] = useState(false);
  const [extensionPath, setExtensionPath] = useState("");
  const [searchSources, setSearchSources] = useState<string[]>(DEFAULT_SEARCH_SOURCES);
  const [feedInterests, setFeedInterests] = useState<string[]>([]);
  const [agentModeEnabled, setAgentModeEnabled] = useState(false);
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
  const [agentProvider, setAgentProvider] = useState<AgentProvider>(DEFAULT_AGENT_PROVIDER);
  const [agentModels, setAgentModels] = useState<Partial<Record<AgentProvider, string>>>({});
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentProvider, AgentStatus> | null>(null);
  const [agentStatusLoading, setAgentStatusLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
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
        if (data.config.rootPathSource) {
          setRootPathSource(data.config.rootPathSource);
        }
        setRootPathLocked(data.config.rootPathLocked === true);
        if (data.config.rssFeeds) {
          setRssFeeds(data.config.rssFeeds);
        }
        setSearchConfigured(data.config.searchConfigured === true);
        if (data.config.extensionPath) setExtensionPath(data.config.extensionPath);
        if (data.config.searchSources) {
          setSearchSources(data.config.searchSources);
        }
        if (data.config.feedInterests) {
          setFeedInterests(data.config.feedInterests);
        }
        setAgentModeEnabled(data.config.agentModeEnabled === true);
        setOnboardedAt(data.config.onboardedAt ?? null);
        if (isAgentProvider(data.config.agentProvider)) {
          setAgentProvider(data.config.agentProvider);
        }
        if (data.config.agentModels && typeof data.config.agentModels === "object") {
          setAgentModels(data.config.agentModels);
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

  const saveRootPath = async (nextRootPath: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rootPath: nextRootPath }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save data location");
      }
      if (data.config.rootPath) setRootPath(data.config.rootPath);
      if (data.config.libraryPath) setLibraryPath(data.config.libraryPath);
      if (data.config.rootPathSource) setRootPathSource(data.config.rootPathSource);
      setRootPathLocked(data.config.rootPathLocked === true);
      await loadAgentStatus();
      return { success: true, message: "Data location saved." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save data location";
      console.error("Failed to save data location:", err);
      return { success: false, message };
    }
  };

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

  const saveAgentModel = async (provider: AgentProvider, model: string) => {
    const next = { ...agentModels, [provider]: model.trim() };
    if (!model.trim()) delete next[provider];
    setAgentModels(next);
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentModels: next }),
      });
    } catch (err) {
      console.error("Failed to save agent model:", err);
    }
  };

  const saveOnboarded = useCallback(async () => {
    const stamp = new Date().toISOString();
    setOnboardedAt(stamp);
    try {
      await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardedAt: stamp }),
      });
    } catch (err) {
      console.error("Failed to save onboarding state:", err);
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    let isMounted = true;

    async function initializeSettings() {
      setSettingsLoading(true);
      try {
        await Promise.all([loadConfig(), loadAgentStatus()]);
      } finally {
        if (isMounted) {
          setSettingsLoading(false);
        }
      }
    }

    initializeSettings();
    return () => {
      isMounted = false;
    };
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
    rootPathSource,
    rootPathLocked,
    saveRootPath,
    libraryPath,
    palette,
    rssFeeds,
    saveRssFeeds,
    searchConfigured,
    extensionPath,
    searchSources,
    saveSearchSources,
    feedInterests,
    saveFeedInterests,
    agentModeEnabled,
    saveAgentModeEnabled,
    onboardedAt,
    saveOnboarded,
    agentProvider,
    saveAgentProvider,
    agentModels,
    saveAgentModel,
    agentStatuses,
    agentStatusLoading,
    settingsLoading,
    loadAgentStatus,
    fontSize,
    saveFontSize: (v: string) => saveReadingSetting("fontSize", v, setFontSize),
    headingStyle,
    saveHeadingStyle: (v: string) => saveReadingSetting("headingStyle", v, setHeadingStyle),
  };
}
