"use client";

import React from "react";

interface TooltipButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  tooltip: {
    title: string;
    description?: string;
  };
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "data-track"?: string;
}

export function TooltipButton({
  onClick,
  children,
  tooltip,
  disabled = false,
  className = "",
  style,
  "data-track": dataTrack,
}: TooltipButtonProps) {
  return (
    <div className="relative group" data-track={dataTrack}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          p-2 rounded-lg hover:bg-black/5 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10
          ${className}
        `.trim().replace(/\s+/g, " ")}
        style={style}
      >
        {children}
      </button>
      <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
        <p className="font-medium mb-1">{tooltip.title}</p>
        {tooltip.description && (
          <p className="text-gray-300">{tooltip.description}</p>
        )}
      </div>
    </div>
  );
}
