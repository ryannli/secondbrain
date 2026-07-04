"use client";

import React from "react";
import { Trash2, Pencil } from "lucide-react";
import { theme } from "@/lib/theme";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: "entry" | "folder";
  entryId?: string;
  entryType?: "source" | "document";  // Which collection the entry belongs to
  folderPath?: string;
  folderName?: string;
  folderSection?: "library" | "notebook";  // Which section the folder belongs to
}

export interface ContextMenuProps {
  menu: ContextMenuState | null;
  onDeleteEntry: () => void;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;
}

export function ContextMenu({
  menu,
  onDeleteEntry,
  onRenameFolder,
  onDeleteFolder,
}: ContextMenuProps) {
  if (!menu) return null;

  return (
    <div
      className="fixed bg-white dark:bg-zinc-800 border rounded-lg shadow-lg py-1 z-50"
      style={{
        left: menu.x,
        top: menu.y,
        borderColor: theme.border,
      }}
    >
      {menu.type === "entry" && (
        <button
          onClick={onDeleteEntry}
          className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
      )}
      {menu.type === "folder" && (
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
