"use client";

import { useState } from "react";

interface UseDragDropProps {
  loadSources: () => Promise<void>;
  setError: (error: string | null) => void;
}

export function useDragDrop({ loadSources, setError }: UseDragDropProps) {
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, sourceId: string) => {
    setDraggedSourceId(sourceId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderPath);
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedSourceId) return;

    try {
      const res = await fetch(`/api/sources/${draggedSourceId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFolder }),
      });
      const data = await res.json();
      if (data.success) {
        await loadSources();
      } else {
        setError(data.error || "Failed to move source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move source");
    } finally {
      setDraggedSourceId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedSourceId(null);
    setDragOverFolder(null);
  };

  return {
    dragOverFolder,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
