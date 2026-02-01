"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Source, SourceSummary } from "@/lib/types";

interface UseSourceActionsProps {
  setSources: React.Dispatch<React.SetStateAction<SourceSummary[]>>;
  selectedSource: Source | null;
  setSelectedSource: (source: Source | null) => void;
  setError: (error: string | null) => void;
}

export function useSourceActions({
  setSources,
  selectedSource,
  setSelectedSource,
  setError,
}: UseSourceActionsProps) {
  const router = useRouter();
  const [captureInput, setCaptureInput] = useState("");
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

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
          setSources((prev) => [{
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, ...prev]);
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
          setSources((prev) => [{
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, ...prev]);
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
      }
    } catch (err) {
      console.error("Failed to load source:", err);
    }
  }, [setSelectedSource]);

  const handleDeleteSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSources((prev) => prev.filter((s) => s.meta.id !== sourceId));
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
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/sources/${id}/reanalyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      } else {
        setError(data.error || "Failed to re-analyze");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      setReanalyzingId(null);
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
    reanalyzingId,
    navigateToSource,
    navigateToDashboard,
  };
}
