"use client";

import { useState, useCallback, useEffect } from "react";
import { FeedItem } from "@/lib/types";

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
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Load dismissed items from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("feed-dismissed");
      if (stored) {
        setDismissed(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Filter out dismissed items
  const visibleItems = feed.items.filter((item) => !dismissed.has(item.id));

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
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      // Persist to localStorage
      try {
        localStorage.setItem("feed-dismissed", JSON.stringify([...next]));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, []);

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
