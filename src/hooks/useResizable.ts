import { useState, useCallback, useEffect, useRef } from "react";

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
  computeWidth: (event: MouseEvent) => number;
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
  computeWidth,
}: UseResizableOptions) {
  const [width, setWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!storageKey) {
      hasLoadedRef.current = true;
      return;
    }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setWidth(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    } finally {
      hasLoadedRef.current = true;
    }
  }, [storageKey, minWidth, maxWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const next = computeWidth(e);
      const clamped = Math.min(maxWidth, Math.max(minWidth, next));
      setWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (storageKey && hasLoadedRef.current) {
        try {
          localStorage.setItem(storageKey, widthRef.current.toString());
        } catch {
          // Ignore localStorage errors
        }
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, computeWidth, minWidth, maxWidth, storageKey]);

  return {
    width,
    isResizing,
    startResize,
  };
}
