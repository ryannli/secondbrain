"use client";

import { useState, useCallback, useMemo } from "react";
import { FeedItem } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface FeedState {
  items: FeedItem[];
  interests: string[];
  generatedAt: string | null;
  fromCache: boolean;
  message?: string;
  briefing?: string;
}

export function useFeed() {
  const [feed, setFeed] = useState<FeedState>({
    items: [],
    interests: [],
    generatedAt: null,
    fromCache: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useLocalStorage<string[]>("feed-dismissed", []);
  const dismissedSet = useMemo(() => new Set(dismissedIds), [dismissedIds]);

  // Filter out dismissed items
  const visibleItems = feed.items.filter((item) => !dismissedSet.has(item.id));

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/feed");
      const data = await res.json();

      if (data.success && data.feed) {
        setFeed({
          items: data.feed.items ?? [],
          interests: data.feed.interests ?? [],
          generatedAt: data.feed.generatedAt ?? null,
          fromCache: data.feed.fromCache ?? false,
          message: data.feed.message,
          briefing: data.feed.briefing,
        });
      } else if (data.message) {
        // Feed disabled or no API key
        setFeed((prev) => ({ ...prev, message: data.message }));
      } else {
        setError(data.error || "Failed to load feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/feed", { method: "POST" });
      const data = await res.json();

      if (data.success && data.feed) {
        setFeed({
          items: data.feed.items ?? [],
          interests: data.feed.interests ?? [],
          generatedAt: data.feed.generatedAt ?? null,
          fromCache: false,
          message: data.feed.message,
          briefing: data.feed.briefing,
        });
      } else {
        setError(data.error || "Failed to refresh feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh feed");
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissItem = useCallback((id: string) => {
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, [setDismissedIds]);

  return {
    items: visibleItems,
    interests: feed.interests,
    generatedAt: feed.generatedAt,
    fromCache: feed.fromCache,
    message: feed.message,
    briefing: feed.briefing,
    loading,
    error,
    loadFeed,
    refreshFeed,
    dismissItem,
  };
}
