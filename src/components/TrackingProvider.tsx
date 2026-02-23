"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { createTracker, setupAutoCapture, type TrackingEvent } from "@/lib/tracking";

declare global {
  interface Window {
    __track?: (event: Partial<TrackingEvent> & { e: string }) => void;
  }
}

export function TrackingProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPath = useRef("");

  useEffect(() => {
    const tracker = createTracker();
    tracker.start();

    const cleanup = setupAutoCapture(tracker);

    // Expose global track function
    window.__track = (event) => {
      tracker.push({
        t: new Date().toISOString(),
        path: window.location.pathname + window.location.search,
        ...event,
      });
    };

    return () => {
      cleanup();
      tracker.stop();
      delete window.__track;
    };
  }, []);

  // Track route changes
  useEffect(() => {
    const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
    if (prevPath.current && prevPath.current !== currentPath) {
      window.__track?.({ e: "navigate", from: prevPath.current, to: currentPath });
    }
    prevPath.current = currentPath;
  }, [pathname, searchParams]);

  return null;
}
