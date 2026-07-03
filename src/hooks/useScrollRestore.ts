"use client";

import { RefObject, useLayoutEffect } from "react";

function getStorageKey(restoreKey: string): string {
  return `secondbrain.scroll-position.${restoreKey}`;
}

/**
 * Persists the container's scroll position so refreshing or returning to
 * an entry resumes at the last reading position.
 */
export function useScrollRestore(
  containerRef: RefObject<HTMLElement | null>,
  restoreKey: string,
  enabled = true,
) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return undefined;

    try {
      const stored = Number(sessionStorage.getItem(getStorageKey(restoreKey)));
      el.scrollTop = Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      // Scroll restore is best-effort; failures should not affect reading.
    }

    let frame = 0;
    const handleScroll = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(getStorageKey(restoreKey), String(el.scrollTop));
        } catch {
          // Ignore storage failures.
        }
      });
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef, enabled, restoreKey]);
}
