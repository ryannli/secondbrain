"use client";

import { useState, useCallback } from "react";

/**
 * Simple toggle hook for boolean state
 * @param initialValue - Initial boolean value (default: false)
 * @returns [value, toggle, setValue]
 */
export function useToggle(initialValue = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, toggle, setValue];
}
