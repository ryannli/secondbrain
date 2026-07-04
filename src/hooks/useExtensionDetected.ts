"use client";

import { useEffect, useState } from "react";

/**
 * Detects the Second Brain Chrome extension: its content script stamps
 * data-secondbrain-extension on <html> for localhost pages. The stamp can
 * land after hydration, so poll briefly before concluding it's absent.
 * Returns null while undecided, then true/false.
 */
export function useExtensionDetected(): boolean | null {
  const [detected, setDetected] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => document.documentElement.hasAttribute("data-secondbrain-extension");
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (check()) {
        setDetected(true);
        clearInterval(timer);
      } else if (attempts >= 6) {
        setDetected(false);
        clearInterval(timer);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return detected;
}
