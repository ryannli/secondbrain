"use client";

import { useState, useCallback } from "react";
import { SourceSummary } from "@/lib/types";

export function useCapture(onSourceAdded: (source: SourceSummary) => void) {
  const [captureInput, setCaptureInput] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    if (!captureInput.trim()) return;

    const input = captureInput.trim();
    const isUrl = /^https?:\/\//i.test(input);
    const displayName = isUrl ? new URL(input).hostname : input.slice(0, 30) + "...";

    // Add to pending list and clear input immediately
    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isUrl ? { url: input } : { text: input }),
      });
      const data = await res.json();

      if (data.success && data.source) {
        onSourceAdded({
          meta: data.source.meta,
          score: data.source.analysis?.triage.score,
          reason: data.source.analysis?.triage.reason,
          action: data.source.analysis?.triage.action,
        });
      } else {
        setError(data.error || "Failed to capture content");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to capture");
    } finally {
      setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
    }
  }, [captureInput, onSourceAdded]);

  return {
    captureInput,
    setCaptureInput,
    isCapturing,
    pendingCaptures,
    error,
    setError,
    capture,
  };
}
