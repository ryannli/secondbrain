"use client";

import React from "react";
import { theme } from "@/lib/theme";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontFamily: string;
  onFontChange: (font: string) => void;
  rootPath: string;
  debugLoadingMode: "none" | "analysis" | "connections";
  onDebugModeChange: (mode: "none" | "analysis" | "connections") => void;
  palette: Record<number, string>;
}

const FONT_OPTIONS = [
  { id: "outfit", name: "Outfit" },
  { id: "inter", name: "Inter" },
  { id: "dm-sans", name: "DM Sans" },
  { id: "space-grotesk", name: "Space Grotesk" },
  { id: "sora", name: "Sora" },
  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans" },
];

const DEBUG_OPTIONS = [
  { id: "none", label: "Off" },
  { id: "analysis", label: "Analysis" },
  { id: "connections", label: "Connections" },
] as const;

export function SettingsModal({
  isOpen,
  onClose,
  fontFamily,
  onFontChange,
  rootPath,
  debugLoadingMode,
  onDebugModeChange,
  palette,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
        style={{ borderColor: theme.border }}
      >
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        {/* Font Family */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Font</label>
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onFontChange(option.id)}
                className="px-3 py-2 rounded-lg border text-center transition-all hover:border-gray-300"
                style={{
                  fontFamily: `var(--font-${option.id})`,
                  borderColor: fontFamily === option.id ? palette[500] : theme.border,
                  backgroundColor: fontFamily === option.id ? `${palette[500]}10` : "transparent",
                }}
              >
                <div className="font-medium text-sm">Second Brain</div>
                <div className="text-xs text-gray-400">{option.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Data Path */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Data Location</label>
          <p className="text-sm text-gray-500 break-all">{rootPath || "Loading..."}</p>
        </div>

        {/* Debug Loading Mode */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Debug: Preview Loading UI</label>
          <div className="flex gap-2">
            {DEBUG_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => onDebugModeChange(option.id)}
                className="px-3 py-1.5 rounded-lg border text-sm transition-all"
                style={{
                  borderColor: debugLoadingMode === option.id ? palette[500] : theme.border,
                  backgroundColor: debugLoadingMode === option.id ? `${palette[500]}10` : "transparent",
                  color: debugLoadingMode === option.id ? palette[600] : theme.textMuted,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Preview loading states (select a source to see effect)</p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: palette[600] }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
