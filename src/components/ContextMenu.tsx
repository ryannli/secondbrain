"use client";

import React from "react";
import { Copy, Trash2, Pencil } from "lucide-react";
import { theme } from "@/lib/theme";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "source" | "folder";
  sourceId?: string;
  sourceUrl?: string;
  folderPath?: string;
  folderName?: string;
}

export interface ContextMenuProps {
  menu: ContextMenuState | null;
  onCopyUrl: () => void;
  onDeleteSource: () => void;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;
}

export function ContextMenu({
  menu,
  onCopyUrl,
  onDeleteSource,
  onRenameFolder,
  onDeleteFolder,
}: ContextMenuProps) {
  if (!menu) return null;

  return (
    <div
      className="fixed bg-white border rounded-lg shadow-lg py-1 z-50"
      style={{
        left: menu.x,
        top: menu.y,
        borderColor: theme.border,
      }}
    >
      {menu.type === "source" ? (
        <>
          {menu.sourceUrl && (
            <button
              onClick={onCopyUrl}
              className="w-full px-4 py-2 text-sm text-left hover:bg-black/5 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" style={{ color: theme.textMuted }} />
              Copy Source URL
            </button>
          )}
          <button
            onClick={onDeleteSource}
            className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onRenameFolder}
            className="w-full px-4 py-2 text-sm text-left hover:bg-black/5 flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" style={{ color: theme.textMuted }} />
            Rename
          </button>
          <button
            onClick={onDeleteFolder}
            className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </>
      )}
    </div>
  );
}
