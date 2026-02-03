import { useState, useCallback, useEffect } from "react";

interface UseResizableOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey?: string;
}

export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UseResizableOptions) {
  const [width, setWidth] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    }
    return initialWidth;
  });

  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // This will be overridden by the component using this hook
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (storageKey) {
        localStorage.setItem(storageKey, width.toString());
      }
    };

    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, width, storageKey]);

  const updateWidth = useCallback((newWidth: number) => {
    const clampedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
    setWidth(clampedWidth);
  }, [minWidth, maxWidth]);

  const saveWidth = useCallback(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [storageKey, width]);

  return {
    width,
    isResizing,
    setIsResizing,
    startResize,
    updateWidth,
    saveWidth,
  };
}
