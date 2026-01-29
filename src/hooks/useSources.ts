"use client";

import { useState, useEffect, useCallback } from "react";
import { Source, SourceSummary } from "@/lib/types";

export function useSources() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

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

  const loadSource = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to load source:", err);
    }
  }, []);

  const reanalyze = useCallback(async (id: string) => {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/sources/${id}/reanalyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
        // Also refresh the sources list to get updated title/etc
        await loadSources();
      } else {
        setError(data.error || "Failed to re-analyze");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      setReanalyzingId(null);
    }
  }, [loadSources]);

  const updateReaction = useCallback(async (
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
  }, []);

  const deleteSource = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSources((prev) => prev.filter((s) => s.meta.id !== id));
        if (selectedSource?.meta.id === id) {
          setSelectedSource(null);
        }
        return true;
      } else {
        setError(data.error || "Failed to delete source");
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      return false;
    }
  }, [selectedSource]);

  // Poll for updates - faster when sources are processing
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  useEffect(() => {
    const hasProcessing = sources.some(s => s.meta.processingStatus === "processing");
    const pollInterval = hasProcessing ? 2000 : 5000;

    const interval = setInterval(loadSources, pollInterval);
    return () => clearInterval(interval);
  }, [sources, loadSources]);

  return {
    sources,
    setSources,
    selectedSource,
    setSelectedSource,
    error,
    setError,
    reanalyzingId,
    loadSources,
    loadSource,
    reanalyze,
    updateReaction,
    deleteSource,
  };
}
