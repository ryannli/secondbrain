"use client";

import { useState, useEffect, useCallback } from "react";

export function useFolders() {
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("");

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }, []);

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim()) return false;

    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentPath: newFolderParent || undefined
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders();
        setExpandedFolders((prev) => new Set([...prev, data.path]));
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to create folder:", err);
      return false;
    } finally {
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNewFolderParent("");
    }
  }, [newFolderName, newFolderParent, loadFolders]);

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const startCreateFolder = useCallback((parentPath: string) => {
    setIsCreatingFolder(true);
    setNewFolderParent(parentPath);
  }, []);

  const cancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName("");
    setNewFolderParent("");
  }, []);

  // Load folders on mount
  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  return {
    folders,
    expandedFolders,
    isCreatingFolder,
    newFolderName,
    newFolderParent,
    setNewFolderName,
    loadFolders,
    createFolder,
    toggleFolder,
    startCreateFolder,
    cancelCreateFolder,
  };
}
