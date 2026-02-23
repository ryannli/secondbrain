"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Source, SourceSummary, UserHighlight } from "@/lib/types";

interface UseSourceActionsProps {
  onUpsertSourceSummary: (summary: SourceSummary, options?: { prepend?: boolean }) => void;
  onRemoveSourceSummary: (id: string) => void;
  selectedSource: Source | null;
  setSelectedSource: (source: Source | null) => void;
  setError: (error: string | null) => void;
}

export function useSourceActions({
  onUpsertSourceSummary,
  onRemoveSourceSummary,
  selectedSource,
  setSelectedSource,
  setError,
}: UseSourceActionsProps) {
  const router = useRouter();
  const [captureInput, setCaptureInput] = useState("");
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]);
  const [reanalyzingIds, setReanalyzingIds] = useState<Set<string>>(new Set());

  // Track sources being polled for completion
  const pollingSourcesRef = useRef<Set<string>>(new Set());

  // Track current selected source ID to avoid stale closure
  const selectedSourceIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedSourceIdRef.current = selectedSource?.meta.id ?? null;
  }, [selectedSource?.meta.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingSourcesRef.current.clear();
    };
  }, []);

  // Poll a source until it's ready (has analysis)
  const pollSourceUntilReady = useCallback((sourceId: string) => {
    if (pollingSourcesRef.current.has(sourceId)) return;
    pollingSourcesRef.current.add(sourceId);

    const toSummary = (source: Source): SourceSummary => ({
      meta: source.meta,
      score: source.analysis?.triage.score,
      reason: source.analysis?.triage.reason,
      action: source.analysis?.triage.action,
    });

    const poll = async () => {
      try {
        const res = await fetch(`/api/sources/${sourceId}`);
        const data = await res.json();

        if (data.success && data.source) {
          const source = data.source;
          // Check if analysis is complete (has triage data)
          if (source.analysis?.triage) {
            // Update sources list with complete data
            onUpsertSourceSummary(toSummary(source));
            // If this source is currently selected, update it (use ref to avoid stale closure)
            if (selectedSourceIdRef.current === sourceId) {
              setSelectedSource(source);
            }
            pollingSourcesRef.current.delete(sourceId);
            return; // Done polling
          }
        }

        // Not ready yet, poll again in 2 seconds
        if (pollingSourcesRef.current.has(sourceId)) {
          setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error(`Polling failed for ${sourceId}:`, err);
        pollingSourcesRef.current.delete(sourceId);
      }
    };

    // Start polling after a short delay
    setTimeout(poll, 1000);
  }, [onUpsertSourceSummary, setSelectedSource]);

  const handleCapture = () => {
    if (!captureInput.trim()) return;

    const input = captureInput.trim();
    const isUrl = /^https?:\/\//i.test(input);
    const displayName = isUrl ? new URL(input).hostname : input.slice(0, 30) + "...";

    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isUrl ? { url: input } : { text: input }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          const sourceId = data.source.meta.id;
          onUpsertSourceSummary({
            meta: data.source.meta,
            score: data.source.analysis?.triage?.score,
            reason: data.source.analysis?.triage?.reason,
            action: data.source.analysis?.triage?.action,
          }, { prepend: true });
          // Start polling if analysis is not ready yet
          if (!data.source.analysis?.triage) {
            pollSourceUntilReady(sourceId);
          }
        } else {
          setError(data.error || "Failed to capture content");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to capture");
      })
      .finally(() => {
        setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
      });
  };

  const handleFileUpload = (file: File) => {
    const displayName = file.name;

    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/capture", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          const sourceId = data.source.meta.id;
          onUpsertSourceSummary({
            meta: data.source.meta,
            score: data.source.analysis?.triage?.score,
            reason: data.source.analysis?.triage?.reason,
            action: data.source.analysis?.triage?.action,
          }, { prepend: true });
          // Start polling if analysis is not ready yet
          if (!data.source.analysis?.triage) {
            pollSourceUntilReady(sourceId);
          }
        } else {
          setError(data.error || "Failed to upload file");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to upload file");
      })
      .finally(() => {
        setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
      });
  };

  const handleSelectSource = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
        // If source is still processing, start polling
        if (!data.source.analysis?.triage) {
          pollSourceUntilReady(id);
        }
      }
    } catch (err) {
      console.error("Failed to load source:", err);
    }
  }, [setSelectedSource, pollSourceUntilReady]);

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onRemoveSourceSummary(sourceId);
        if (selectedSource?.meta.id === sourceId) {
          router.push("/");
        }
      } else {
        setError(data.error || "Failed to delete source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleReanalyze = async (id: string) => {
    setReanalyzingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/sources/${id}/reanalyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // Only update selected source if user is still viewing this one
        if (selectedSourceIdRef.current === id) {
          setSelectedSource(data.source);
        }
        onUpsertSourceSummary({
          meta: data.source.meta,
          score: data.source.analysis?.triage?.score,
          reason: data.source.analysis?.triage?.reason,
          action: data.source.analysis?.triage?.action,
        });
      } else {
        setError(data.error || "Failed to re-analyze");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      setReanalyzingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleReaction = async (
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
  };

  const handleRating = async (sourceId: string, rating: number | undefined) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}/reaction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "rating", reaction: rating !== undefined ? String(rating) : "" }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to update rating:", err);
    }
  };

  const handleAddHighlight = async (entryId: string, text: string, onUpdate?: (highlights: UserHighlight[]) => void) => {
    try {
      const res = await fetch(`/api/entries/${entryId}/highlight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) onUpdate?.(data.highlights);
    } catch (err) {
      console.error("Failed to add highlight:", err);
    }
  };

  const handleRemoveHighlight = async (entryId: string, highlightId: string, onUpdate?: (highlights: UserHighlight[]) => void) => {
    try {
      const res = await fetch(`/api/entries/${entryId}/highlight`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlightId }),
      });
      const data = await res.json();
      if (data.success) onUpdate?.(data.highlights);
    } catch (err) {
      console.error("Failed to remove highlight:", err);
    }
  };

  const navigateToSource = (id: string) => {
    router.push(`/?source=${id}`);
  };

  const navigateToDashboard = () => {
    router.push("/dashboard");
  };

  return {
    captureInput,
    setCaptureInput,
    pendingCaptures,
    handleCapture,
    handleFileUpload,
    handleSelectSource,
    handleDeleteSource,
    handleReanalyze,
    handleReaction,
    handleRating,
    handleAddHighlight,
    handleRemoveHighlight,
    reanalyzingIds,
    navigateToSource,
    navigateToDashboard,
  };
}
