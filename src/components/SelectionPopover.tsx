"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Highlighter } from "lucide-react";
import { useCoLearning } from "./CoLearningPanel";

interface SelectionPopoverProps {
  containerRef: React.RefObject<HTMLElement>;
  sourceTitle?: string;
  palette: Record<number, string>;
  onHighlight?: (text: string) => void;
}

export function SelectionPopover({
  containerRef,
  sourceTitle,
  palette,
  onHighlight,
}: SelectionPopoverProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  // Highlights only anchor to the reading content (content.md text), so the
  // button is offered only for selections inside a [data-highlightable] area
  const [canHighlight, setCanHighlight] = useState(false);
  const { addContext } = useCoLearning();
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleSelection = useCallback((e?: Event) => {
    // Ignore events that originate from the popover itself —
    // otherwise mouseup on a button clears the selection state
    // before the button's click handler can read it.
    if (e?.target && popoverRef.current?.contains(e.target as Node)) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setPosition(null);
      setSelectedText("");
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 5) {
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

    const containerRect = container.getBoundingClientRect();

    // Use first client rect for precise positioning on multi-line selections
    // getClientRects() returns one rect per line fragment, so [0] is the exact
    // selected portion of the first line (not the full bounding box)
    const rects = range.getClientRects();
    const firstRect = rects.length > 0 ? rects[0] : range.getBoundingClientRect();

    // Position centered above the first line of selected text
    const popoverX = Math.max(containerRect.left + 60, Math.min(firstRect.left + firstRect.width / 2, containerRect.right - 60));
    const popoverY = firstRect.top - 6;

    const anchorEl = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    setCanHighlight(!!anchorEl?.closest("[data-highlightable]"));

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
      window.getSelection()?.removeAllRanges();
      setPosition(null);
      setSelectedText("");
    }
  };

  const handleHighlight = () => {
    if (selectedText && onHighlight) {
      onHighlight(selectedText);
      window.getSelection()?.removeAllRanges();
      setPosition(null);
      setSelectedText("");
    }
  };

  if (!position || !selectedText) return null;

  return (
    <div
      ref={popoverRef}
      className="fixed z-50"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%)" }}
      // Prevent mousedown from clearing the text selection —
      // without this, the browser clears the selection before click fires.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded shadow-md overflow-hidden">
        {onHighlight && canHighlight && (
          <button
            onClick={handleHighlight}
            className="flex items-center gap-1 px-2 py-1 text-white text-xs whitespace-nowrap hover:brightness-110 transition-all"
            style={{ backgroundColor: "#d97706" }}
            data-track="selection.highlight"
            title="Highlight"
          >
            <Highlighter className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={handleAddContext}
          className="flex items-center gap-1 px-2 py-1 text-white text-xs whitespace-nowrap hover:brightness-110 transition-all"
          style={{ backgroundColor: palette[600] }}
          data-track="selection.addcontext"
        >
          <Plus className="w-3 h-3" />
          Add to context
        </button>
      </div>
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
