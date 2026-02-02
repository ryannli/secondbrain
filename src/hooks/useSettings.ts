"use client";

import { useState, useEffect, useMemo } from "react";
import { generatePalette } from "@/lib/theme";

// Default feed sources users commonly use
const DEFAULT_FEED_SOURCES = ["reddit.com", "news.ycombinator.com"];

export function useSettings() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#3b6044");
  const [fontFamily, setFontFamily] = useState("outfit");
  const [rootPath, setRootPath] = useState("");
  const [libraryPath, setLibraryPath] = useState("");
  const [debugLoadingMode, setDebugLoadingMode] = useState<"none" | "analysis" | "connections">("none");
  const [feedSources, setFeedSources] = useState<string[]>(DEFAULT_FEED_SOURCES);

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

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    isSettingsOpen,
    setIsSettingsOpen,
    fontFamily,
    saveFont,
    rootPath,
    libraryPath,
    debugLoadingMode,
    setDebugLoadingMode,
    palette,
    feedSources,
    saveFeedSources,
  };
}
