import { useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      }
    } catch {
      // Ignore JSON/localStorage errors
    } finally {
      hasLoadedRef.current = true;
    }
  }, [key]);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore localStorage errors
    }
  }, [key, value]);

  return [value, setValue] as const;
}
