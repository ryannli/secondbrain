"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { FeedItem, FeedSignals, InsightItem, StructuredBriefing } from "@/lib/types";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface FeedState {
  items: FeedItem[];
  interests: string[];
  generatedAt: string | null;
  fromCache: boolean;
  message?: string;
  briefing?: StructuredBriefing;
  signals?: FeedSignals;
  insights?: InsightItem[];
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
  const [starredTexts, setStarredTexts] = useState<Set<string>>(new Set());
  const [readBriefingTexts, setReadBriefingTexts] = useState<Set<string>>(new Set());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Mirrors selectedDate so an in-flight refresh can tell whether the user
  // navigated to a past snapshot while it was generating.
  const selectedDateRef = useRef<string | null>(null);
  const selectDate = useCallback((date: string | null) => {
    selectedDateRef.current = date;
    setSelectedDate(date);
  }, []);

  // Filter out dismissed items
  const visibleItems = feed.items.filter((item) => !dismissedSet.has(item.id));

  // Mark specific URLs as seen/unseen (called when user toggles briefing items)
  const markBriefingRead = useCallback((text: string, urls: string[]) => {
    setReadBriefingTexts(prev => new Set(prev).add(text));
    fetch("/api/feed/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, text }),
    }).catch(() => {});
  }, []);

  const markBriefingUnread = useCallback((text: string, urls: string[]) => {
    setReadBriefingTexts(prev => {
      const next = new Set(prev);
      next.delete(text);
      return next;
    });
    fetch("/api/feed/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, unseen: true, text }),
    }).catch(() => {});
  }, []);

  const starBriefingItem = useCallback((text: string, meta?: { feedDate?: string; refs?: { url: string; title: string }[] }) => {
    setStarredTexts(prev => new Set(prev).add(text));
    fetch("/api/feed/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...meta }),
    }).catch(() => {});
  }, []);

  const unstarBriefingItem = useCallback((text: string) => {
    setStarredTexts(prev => {
      const next = new Set(prev);
      next.delete(text);
      return next;
    });
    fetch("/api/feed/star", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, unstar: true }),
    }).catch(() => {});
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/feed");
      const data = await res.json();

      if (data.success && data.feed) {
        const feedItems = data.feed.items ?? [];
        setFeed({
          items: feedItems,
          interests: data.feed.interests ?? [],
          generatedAt: data.feed.generatedAt ?? null,
          fromCache: data.feed.fromCache ?? false,
          message: data.feed.message,
          briefing: data.feed.briefing,
          signals: data.feed.signals,
          insights: data.feed.insights,
        });
        if (data.feed.starredBriefingTexts) {
          setStarredTexts(new Set(data.feed.starredBriefingTexts));
        }
        if (data.feed.readBriefingTexts) {
          setReadBriefingTexts(new Set(data.feed.readBriefingTexts));
        }
        if (data.availableDates) {
          setAvailableDates(data.availableDates);
        }
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
    selectDate(null);

    try {
      const res = await fetch("/api/feed", { method: "POST" });
      const data = await res.json();

      if (data.success && data.feed) {
        if (data.availableDates) {
          setAvailableDates(data.availableDates);
        }
        // The user switched to a past snapshot while this refresh was
        // generating — don't yank their view; the new feed is cached and
        // shows when they return to the latest view.
        if (selectedDateRef.current !== null) {
          return;
        }
        const feedItems = data.feed.items ?? [];
        setFeed({
          items: feedItems,
          interests: data.feed.interests ?? [],
          generatedAt: data.feed.generatedAt ?? null,
          fromCache: false,
          message: data.feed.message,
          briefing: data.feed.briefing,
          signals: data.feed.signals,
          insights: data.feed.insights,
        });
        if (data.feed.starredBriefingTexts) {
          setStarredTexts(new Set(data.feed.starredBriefingTexts));
        }
        if (data.feed.readBriefingTexts) {
          setReadBriefingTexts(new Set(data.feed.readBriefingTexts));
        }
      } else {
        setError(data.error || "Failed to refresh feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh feed");
    } finally {
      setLoading(false);
    }
  }, [selectDate]);

  const loadFeedForDate = useCallback(async (date: string | null) => {
    if (!date) {
      // Go back to current/latest feed
      selectDate(null);
      await loadFeed();
      return;
    }

    setLoading(true);
    setError(null);
    selectDate(date);

    try {
      const res = await fetch(`/api/feed?date=${date}`);
      const data = await res.json();

      if (data.success && data.feed) {
        setFeed({
          items: data.feed.items ?? [],
          interests: data.feed.interests ?? [],
          generatedAt: data.feed.generatedAt ?? null,
          fromCache: true,
          message: data.feed.message,
          briefing: data.feed.briefing,
          signals: data.feed.signals,
          insights: data.feed.insights,
        });
        if (data.feed.starredBriefingTexts) {
          setStarredTexts(new Set(data.feed.starredBriefingTexts));
        }
        if (data.feed.readBriefingTexts) {
          setReadBriefingTexts(new Set(data.feed.readBriefingTexts));
        }
        if (data.availableDates) {
          setAvailableDates(data.availableDates);
        }
      } else {
        setError(data.error || "Failed to load feed for date");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed for date");
    } finally {
      setLoading(false);
    }
  }, [loadFeed, selectDate]);

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
    signals: feed.signals,
    insights: feed.insights,
    starredBriefingTexts: starredTexts,
    readBriefingTexts,
    availableDates,
    selectedDate,
    loading,
    error,
    loadFeed,
    refreshFeed,
    loadFeedForDate,
    dismissItem,
    markBriefingRead,
    markBriefingUnread,
    starBriefingItem,
    unstarBriefingItem,
  };
}
