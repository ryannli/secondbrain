"use client";

import { useState } from "react";

interface UseFolderManagementProps {
  loadFolders: () => Promise<void>;
  loadSources: () => Promise<void>;
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  setError: (error: string | null) => void;
}

export function useFolderManagement({
  loadFolders,
  loadSources,
  expandedFolders,
  setExpandedFolders,
  setError,
}: UseFolderManagementProps) {
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string>("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parentPath: newFolderParent || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders();
        setExpandedFolders((prev) => new Set([...prev, data.path]));
      } else {
        setError(data.error || "Failed to create folder");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNewFolderParent("");
    }
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renameFolderValue.trim()) {
      setRenamingFolder(null);
      return;
    }

    try {
      const res = await fetch("/api/folders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: renamingFolder, newName: renameFolderValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (expandedFolders.has(renamingFolder)) {
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.delete(renamingFolder);
            next.add(data.newPath);
            return next;
          });
        }
        await loadFolders();
        await loadSources();
      } else {
        setError(data.error || "Failed to rename folder");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename folder");
    } finally {
      setRenamingFolder(null);
      setRenameFolderValue("");
    }
  };

  const handleDeleteFolder = async (folderPath: string) => {
    try {
      const res = await fetch("/api/folders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders();
        await loadSources();
      } else {
        setError(data.error || "Failed to delete folder");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  const startCreateFolder = (parentPath: string) => {
    setIsCreatingFolder(true);
    setNewFolderParent(parentPath);
  };

  const cancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
    setNewFolderParent("");
  };

  const startRenameFolder = (folderPath: string, folderName: string) => {
    setRenamingFolder(folderPath);
    setRenameFolderValue(folderName);
  };

  const cancelRenameFolder = () => {
    setRenamingFolder(null);
    setRenameFolderValue("");
  };

  return {
    isCreatingFolder,
    newFolderName,
    newFolderParent,
    setNewFolderName,
    handleCreateFolder,
    startCreateFolder,
    cancelCreateFolder,
    renamingFolder,
    renameFolderValue,
    setRenameFolderValue,
    handleRenameFolder,
    startRenameFolder,
    cancelRenameFolder,
    handleDeleteFolder,
  };
}
