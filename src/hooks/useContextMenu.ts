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

  const handleContextMenu = (e: React.MouseEvent, sourceId: string, sourceUrl?: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "source",
      sourceId,
      sourceUrl,
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type: "folder",
      folderPath,
      folderName,
    });
  };

  const handleCopyUrl = async () => {
    if (contextMenu?.sourceUrl) {
      await navigator.clipboard.writeText(contextMenu.sourceUrl);
    }
    setContextMenu(null);
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    handleContextMenu,
    handleFolderContextMenu,
    handleCopyUrl,
    closeContextMenu,
  };
}
