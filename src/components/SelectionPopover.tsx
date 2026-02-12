"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useCoLearning } from "./CoLearningPanel";

interface SelectionPopoverProps {
  containerRef: React.RefObject<HTMLElement>;
  sourceTitle?: string;
  palette: Record<number, string>;
}

export function SelectionPopover({
  containerRef,
  sourceTitle,
  palette,
}: SelectionPopoverProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const { addContext } = useCoLearning();

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPosition(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) {
      // Ignore very short selections
      setPosition(null);
      setSelectedText("");
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;

    const range = selection.getRangeAt(0);

    // Check if selection's common ancestor is within our container (DOM hierarchy check)
    if (!container.contains(range.commonAncestorContainer)) {
      setPosition(null);
      setSelectedText("");
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Position the popover - clamp to container bounds
    const popoverX = Math.max(containerRect.left + 50, Math.min(rect.left + rect.width / 2, containerRect.right - 50));
    const popoverY = Math.max(containerRect.top + 30, rect.top - 10);

    setSelectedText(text);
    setPosition({
      x: popoverX,
      y: popoverY,
    });
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);

    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [handleSelection]);

  const handleAddContext = () => {
    if (selectedText) {
      addContext(selectedText, sourceTitle);
      // Clear selection
      window.getSelection()?.removeAllRanges();
      setPosition(null);
      setSelectedText("");
    }
  };

  if (!position || !selectedText) return null;

  return (
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
    >
      <button
        onClick={handleAddContext}
        className="flex items-center gap-1 px-2 py-1 rounded shadow-md text-white text-xs whitespace-nowrap"
        style={{ backgroundColor: palette[600] }}
      >
        <Plus className="w-3 h-3" />
        Add to context
      </button>
      {/* Arrow */}
      <div
        className="absolute top-full w-0 h-0"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${palette[600]}`,
        }}
      />
    </div>
  );
}
