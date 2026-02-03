"use client";

import React from "react";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  direction?: "horizontal" | "vertical";
}

export function ResizeHandle({
  onMouseDown,
  isResizing,
  direction = "horizontal",
}: ResizeHandleProps) {
  const isHorizontal = direction === "horizontal";

  return (
    <div
      className={`
        ${isHorizontal ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"}
        flex-shrink-0 relative group
      `}
      onMouseDown={onMouseDown}
    >
      {/* Invisible hit area - larger for easier grabbing */}
      <div
        className={`
          absolute
          ${isHorizontal ? "w-4 h-full -left-1.5" : "h-4 w-full -top-1.5"}
          z-10
        `}
      />
      {/* Subtle hover indicator - only visible on hover */}
      <div
        className={`
          ${isHorizontal ? "w-0.5 h-full" : "h-0.5 w-full"}
          transition-all duration-150
          ${isResizing
            ? "bg-black/20"
            : "bg-transparent group-hover:bg-black/10"
          }
        `}
      />
    </div>
  );
}
