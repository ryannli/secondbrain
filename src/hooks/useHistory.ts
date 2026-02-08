"use client";

import { useState, useCallback } from "react";
import { HistoryEvent } from "@/lib/types";

export function useHistory() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/history");
      const data = await res.json();

      if (data.success) {
        setEvents(data.events ?? []);
      } else {
        setError(data.error || "Failed to load history");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  return { events, loading, error, loadHistory };
}
