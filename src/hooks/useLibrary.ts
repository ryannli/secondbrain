"use client";

import { useState, useEffect, useCallback } from "react";
import { SourceSummary } from "@/lib/types";
import { buildTree } from "@/lib/tree";

export function useLibrary() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadSources();
    loadFolders();
  }, [loadSources, loadFolders]);

  // Poll for updates - faster when sources are processing
  useEffect(() => {
    const hasProcessing = sources.some(s => s.meta.processingStatus === "processing");
    const pollInterval = hasProcessing ? 2000 : 5000;

    const interval = setInterval(() => {
      loadSources();
      loadFolders();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [sources, loadSources, loadFolders]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const buildSourceTree = useCallback(() => {
    return buildTree(
      sources.map(s => ({
        id: s.meta.id,
        name: s.meta.title,
        folder: s.meta.folder,
        createdAt: s.meta.createdAt,
        source: s,
      })),
      folders,
      "source",
      (item) => ({ source: item.source })
    );
  }, [sources, folders]);

  return {
    sources,
    setSources,
    folders,
    loadSources,
    loadFolders,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,
    buildTree: buildSourceTree,
    isLibraryOpen,
    setIsLibraryOpen,
    isSidebarOpen,
    setIsSidebarOpen,
  };
}
