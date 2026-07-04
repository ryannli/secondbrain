"use client";

import { useState, useEffect } from "react";
import { ContextMenuState } from "@/components/ContextMenu";

export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Handle context menu for entries (sources and documents)
  const handleEntryContextMenu = (
    e: React.MouseEvent,
    entryId: string,
    _entryUrl?: string,  // Unused but kept for API compatibility
    entryType: "source" | "document" = "source"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "entry",
      entryId,
      entryType,
    });
  };

  const handleFolderContextMenu = (
    e: React.MouseEvent,
    folderPath: string,
    folderName: string,
    section: "library" | "notebook" = "library"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "folder",
      folderPath,
      folderName,
      folderSection: section,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    handleEntryContextMenu,
    handleFolderContextMenu,
    closeContextMenu,
  };
}
