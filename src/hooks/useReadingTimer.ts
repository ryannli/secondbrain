"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 60_000; // 60s of no activity = idle
const SAVE_INTERVAL_MS = 30_000; // Save every 30s

/**
 * Tracks active reading time for a source.
 * Pauses when the tab is hidden or user is idle (no mouse/keyboard/scroll for 60s).
 * Periodically saves accumulated time to the server.
 */
export function useReadingTimer(sourceId: string | null) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // Refs for stable access in callbacks
  // Default to visible; synced with document.hidden in the main effect (document is unavailable during SSR)
  const isVisibleRef = useRef(true);
  const isIdleRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const unsavedSecondsRef = useRef(0);
  const sourceIdRef = useRef(sourceId);

  // Update ref when sourceId changes
  useEffect(() => {
    sourceIdRef.current = sourceId;
  }, [sourceId]);

  // Save accumulated time to server
  const saveTime = useCallback(async (id: string, seconds: number) => {
    if (seconds <= 0) return;
    try {
      await fetch(`/api/sources/${id}/reading-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });
    } catch {
      // Silently fail - will retry on next save
    }
  }, []);

  // Flush unsaved time for a specific source
  const flushTime = useCallback((id: string) => {
    const unsaved = unsavedSecondsRef.current;
    if (unsaved > 0) {
      unsavedSecondsRef.current = 0;
      saveTime(id, unsaved);
    }
  }, [saveTime]);

  // Reset when source changes
  useEffect(() => {
    // Flush time for previous source before switching
    return () => {
      const id = sourceIdRef.current;
      if (id) {
        const unsaved = unsavedSecondsRef.current;
        if (unsaved > 0) {
          unsavedSecondsRef.current = 0;
          // Use sendBeacon for reliability on unmount
          const url = `/api/sources/${id}/reading-time`;
          const data = JSON.stringify({ seconds: unsaved });
          if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([data], { type: "application/json" }));
          } else {
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: data, keepalive: true });
          }
        }
      }
    };
  }, [sourceId]);

  // Reset elapsed display when source changes (render-phase adjustment;
  // unsavedSecondsRef is flushed and zeroed by the cleanup effect above)
  const [prevSourceId, setPrevSourceId] = useState(sourceId);
  if (prevSourceId !== sourceId) {
    setPrevSourceId(sourceId);
    setElapsedSeconds(0);
  }

  // Main timer: tick every second when active
  useEffect(() => {
    if (!sourceId) return;

    // Sync visibility now that we're in the browser
    isVisibleRef.current = !document.hidden;

    const updateActive = () => {
      const active = isVisibleRef.current && !isIdleRef.current;
      setIsActive(active);
      return active;
    };

    // Visibility change handler
    const onVisibility = () => {
      isVisibleRef.current = !document.hidden;
      updateActive();
    };

    // Activity handler - reset idle timer (throttled to 200ms)
    let lastActivity = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 200) return;
      lastActivity = now;

      if (isIdleRef.current) {
        isIdleRef.current = false;
        updateActive();
      }
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        updateActive();
      }, IDLE_TIMEOUT_MS);
    };

    // Start idle timer immediately
    onActivity();

    // Listen for visibility + user activity
    document.addEventListener("visibilitychange", onVisibility);
    const activityEvents = ["mousemove", "keydown", "scroll", "click", "touchstart"] as const;
    activityEvents.forEach((evt) => document.addEventListener(evt, onActivity, { passive: true }));

    // Tick every second
    const tickInterval = setInterval(() => {
      if (isVisibleRef.current && !isIdleRef.current) {
        setElapsedSeconds((prev) => prev + 1);
        unsavedSecondsRef.current += 1;
      }
    }, 1000);

    // Periodic save
    const saveInterval = setInterval(() => {
      if (sourceIdRef.current) {
        flushTime(sourceIdRef.current);
      }
    }, SAVE_INTERVAL_MS);

    return () => {
      clearInterval(tickInterval);
      clearInterval(saveInterval);
      clearTimeout(idleTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
      activityEvents.forEach((evt) => document.removeEventListener(evt, onActivity));
    };
  }, [sourceId, flushTime]);

  // Also flush on page unload
  useEffect(() => {
    const onBeforeUnload = () => {
      const id = sourceIdRef.current;
      if (id && unsavedSecondsRef.current > 0) {
        const url = `/api/sources/${id}/reading-time`;
        const data = JSON.stringify({ seconds: unsavedSecondsRef.current });
        unsavedSecondsRef.current = 0;
        navigator.sendBeacon?.(url, new Blob([data], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return { elapsedSeconds, isActive };
}

/** Format seconds into human-readable string */
export function formatReadingTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}
