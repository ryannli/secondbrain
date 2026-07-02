"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";

const SEGMENT_HEIGHT_PX = 320;
const DWELL_MS = 800;
const COMPLETE_THRESHOLD = 0.95;

interface ReadingProgress {
  seenPercent: number;
  herePercent: number;
  isComplete: boolean;
  hasScrollableContent: boolean;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getStorageKey(resetKey: string): string {
  return `secondbrain.reading-progress.${resetKey}`;
}

function readSeenSegments(resetKey: string): number[] {
  try {
    const stored = sessionStorage.getItem(getStorageKey(resetKey));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n) && n >= 0) : [];
  } catch {
    return [];
  }
}

function writeSeenSegments(resetKey: string, segments: Set<number>) {
  try {
    sessionStorage.setItem(getStorageKey(resetKey), JSON.stringify([...segments]));
  } catch {
    // Reading progress is a UI hint; storage failures should not affect reading.
  }
}

/**
 * Tracks content coverage separately from scroll position.
 *
 * `herePercent` follows the current scroll position immediately.
 * `seenPercent` only increases after the visible area has remained in view.
 */
export function useReadingProgress(
  containerRef: RefObject<HTMLElement | null>,
  resetKey: string,
  enabled = true,
): ReadingProgress {
  const [progress, setProgress] = useState<ReadingProgress>({
    seenPercent: 0,
    herePercent: 0,
    isComplete: false,
    hasScrollableContent: false,
  });

  const seenSegmentsRef = useRef<Set<number>>(new Set());
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetKeyRef = useRef(resetKey);

  const updateProgress = useCallback((el: HTMLElement, persist = false) => {
    const scrollableHeight = Math.max(0, el.scrollHeight - el.clientHeight);
    const totalSegments = Math.max(1, Math.ceil(el.scrollHeight / SEGMENT_HEIGHT_PX));
    const rawSeen = Math.min(seenSegmentsRef.current.size, totalSegments) / totalSegments;
    const isComplete = rawSeen >= COMPLETE_THRESHOLD;

    if (persist) {
      writeSeenSegments(resetKeyRef.current, seenSegmentsRef.current);
    }

    setProgress({
      seenPercent: isComplete ? 100 : clampPercent(rawSeen * 100),
      herePercent: scrollableHeight <= 8 ? 100 : clampPercent((el.scrollTop / scrollableHeight) * 100),
      isComplete,
      hasScrollableContent: scrollableHeight > 8,
    });
  }, []);

  const markVisibleSegments = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const totalSegments = Math.max(1, Math.ceil(el.scrollHeight / SEGMENT_HEIGHT_PX));
    const inset = Math.min(80, el.clientHeight * 0.08);
    const start = Math.max(0, el.scrollTop + inset);
    const end = Math.min(el.scrollHeight, Math.max(start + 1, el.scrollTop + el.clientHeight - inset));
    const startSegment = Math.max(0, Math.floor(start / SEGMENT_HEIGHT_PX));
    const endSegment = Math.min(totalSegments - 1, Math.floor((end - 1) / SEGMENT_HEIGHT_PX));

    for (let segment = startSegment; segment <= endSegment; segment += 1) {
      seenSegmentsRef.current.add(segment);
    }

    updateProgress(el, true);
  }, [containerRef, updateProgress]);

  const scheduleMarkVisible = useCallback(() => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = setTimeout(markVisibleSegments, DWELL_MS);
  }, [markVisibleSegments]);

  useEffect(() => {
    resetKeyRef.current = resetKey;
    seenSegmentsRef.current = new Set(readSeenSegments(resetKey));

    const el = containerRef.current;
    if (!enabled || !el) {
      return undefined;
    }

    updateProgress(el);
    scheduleMarkVisible();

    let frame = 0;
    const handleScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        updateProgress(el);
        scheduleMarkVisible();
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (frame) cancelAnimationFrame(frame);
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [containerRef, enabled, resetKey, scheduleMarkVisible, updateProgress]);

  return progress;
}
