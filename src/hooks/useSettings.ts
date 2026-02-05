"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { generatePalette } from "@/lib/theme";
import type { ThemeMode } from "@/lib/storage";

// Default feed sources users commonly use
const DEFAULT_FEED_SOURCES = ["reddit.com", "news.ycombinator.com"];

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
  const [feedSources, setFeedSources] = useState<string[]>(DEFAULT_FEED_SOURCES);
  const [feedInterests, setFeedInterests] = useState<string[]>([]);

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
        if (data.config.feedSources) {
          setFeedSources(data.config.feedSources);
        }
        if (data.config.feedInterests) {
          setFeedInterests(data.config.feedInterests);
        }
        if (data.config.theme) {
          setThemeModeState(data.config.theme);
          applyTheme(data.config.theme);
        }
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

  const saveFeedSources = async (sources: string[]) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedSources: sources }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedSources(sources);
      }
    } catch (err) {
      console.error("Failed to save feed sources:", err);
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
  }, []);

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
    feedSources,
    saveFeedSources,
    feedInterests,
    saveFeedInterests,
  };
}
