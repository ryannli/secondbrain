"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { TreeNode, SourceSummary, NotebookDocument } from "@/lib/types";
import { buildTree } from "@/lib/tree";

type CollectionType = "library" | "notebook";

export interface EntrySummary {
  id: string;
  name: string;
  folder?: string;
  createdAt: string;
  data?: SourceSummary | NotebookDocument;
}

interface UseEntryCollectionProps {
  type: CollectionType;
  setError: (error: string | null) => void;
}

// API endpoints and markers based on collection type
const COLLECTION_CONFIG = {
  library: {
    entriesEndpoint: "/api/sources",
    foldersEndpoint: "/api/folders",
    moveEndpoint: "/api/entries",
    entryType: "source" as const,
  },
  notebook: {
    entriesEndpoint: "/api/notebook",
    foldersEndpoint: "/api/notebook/folders",
    moveEndpoint: "/api/entries",
    entryType: "document" as const,
  },
};

export function useEntryCollection({ type, setError }: UseEntryCollectionProps) {
  const config = COLLECTION_CONFIG[type];

  // Core state
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(true);

  // Folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("");

  // Folder rename state
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  // Drag & drop state
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Load entries
  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch(config.entriesEndpoint);
      const data = await res.json();
      if (data.success) {
        // Normalize the response based on type type
        if (type === "library") {
          setEntries(data.sources?.map((s: { meta: { id: string; title: string; folder?: string; createdAt: string }; score?: number; reason?: string; action?: string }) => ({
            id: s.meta.id,
            name: s.meta.title,
            folder: s.meta.folder,
            createdAt: s.meta.createdAt,
            data: s,
          })) || []);
        } else {
          setEntries(data.documents?.map((d: { id: string; title: string; folder?: string; createdAt: string }) => ({
            id: d.id,
            name: d.title,
            folder: d.folder,
            createdAt: d.createdAt,
            data: d,
          })) || []);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${type} entries:`, err);
    }
  }, [config.entriesEndpoint, type]);

  // Load folders
  const loadFolders = useCallback(async () => {
    try {
      const res = await fetch(config.foldersEndpoint);
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders || []);
      }
    } catch (err) {
      console.error(`Failed to load ${type} folders:`, err);
    }
  }, [config.foldersEndpoint, type]);

  // Load both on mount
  useEffect(() => {
    loadEntries();
    loadFolders();
  }, [loadEntries, loadFolders]);

  // Track processing state in a ref to avoid polling dependency on entries
  const hasProcessingRef = useRef(false);
  useEffect(() => {
    hasProcessingRef.current = type === "library" && entries.some((e) =>
      (e.data as SourceSummary | undefined)?.meta?.processingStatus === "processing"
    );
  }, [entries, type]);

  // Poll for updates (faster when processing)
  useEffect(() => {
    const interval = setInterval(() => {
      loadEntries();
      loadFolders();
    }, hasProcessingRef.current ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [loadEntries, loadFolders]);

  // Toggle type open/close
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Toggle folder expand/collapse
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

  // Build tree
  const getTreeNodes = useCallback((): TreeNode[] => {
    const items = entries.map((e) => ({
      id: e.id,
      name: e.name,
      folder: e.folder,
      createdAt: e.createdAt,
      source: type === "library" ? (e.data as SourceSummary | undefined) : undefined,
      document: type === "notebook" ? (e.data as NotebookDocument | undefined) : undefined,
    }));

    return buildTree(
      items,
      folders,
      config.entryType,
      (item) => (type === "library" ? { source: item.source } : { document: item.document })
    );
  }, [entries, folders, type, config.entryType]);

  // --- Folder Management ---

  const startCreateFolder = useCallback((parentPath: string) => {
    setIsCreatingFolder(true);
    setNewFolderParent(parentPath);
  }, []);

  const cancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName("");
    setNewFolderParent("");
  }, []);

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;

    try {
      const res = await fetch(config.foldersEndpoint, {
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
  }, [newFolderName, newFolderParent, config.foldersEndpoint, loadFolders, setError]);

  const startRenameFolder = useCallback((folderPath: string, folderName: string) => {
    setRenamingFolder(folderPath);
    setRenameFolderValue(folderName);
  }, []);

  const cancelRenameFolder = useCallback(() => {
    setRenamingFolder(null);
    setRenameFolderValue("");
  }, []);

  const renameFolder = useCallback(async () => {
    if (!renamingFolder || !renameFolderValue.trim()) {
      setRenamingFolder(null);
      return;
    }

    try {
      const res = await fetch(config.foldersEndpoint, {
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
        await loadEntries();
      } else {
        setError(data.error || "Failed to rename folder");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename folder");
    } finally {
      setRenamingFolder(null);
      setRenameFolderValue("");
    }
  }, [renamingFolder, renameFolderValue, config.foldersEndpoint, expandedFolders, loadFolders, loadEntries, setError]);

  const deleteFolder = useCallback(async (folderPath: string) => {
    try {
      const res = await fetch(config.foldersEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      });
      const data = await res.json();
      if (data.success) {
        await loadFolders();
        await loadEntries();
      } else {
        setError(data.error || "Failed to delete folder");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete folder");
    }
  }, [config.foldersEndpoint, loadFolders, loadEntries, setError]);

  // --- Drag & Drop ---

  const handleDragStart = useCallback((e: React.DragEvent, entryId: string) => {
    setDraggedEntryId(entryId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderPath);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFolder(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetFolder: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedEntryId) return;

    try {
      const res = await fetch(`${config.moveEndpoint}/${draggedEntryId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetFolder, section: type }),
      });
      const data = await res.json();
      if (data.success) {
        await loadEntries();
      } else {
        setError(data.error || "Failed to move entry");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move entry");
    } finally {
      setDraggedEntryId(null);
    }
  }, [draggedEntryId, config.moveEndpoint, type, loadEntries, setError]);

  const handleDragEnd = useCallback(() => {
    setDraggedEntryId(null);
    setDragOverFolder(null);
  }, []);

  // Memoize tree nodes
  const treeNodes = useMemo(() => getTreeNodes(), [getTreeNodes]);

  // Memoize drag & drop object
  const dragDrop = useMemo(() => ({
    dragOverFolder,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    onDragEnd: handleDragEnd,
  }), [dragOverFolder, handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]);

  // Memoize folder management object
  const folderManagement = useMemo(() => ({
    isCreatingFolder,
    newFolderParent,
    newFolderName,
    onStartCreateFolder: startCreateFolder,
    onFolderNameChange: setNewFolderName,
    onCreateFolder: createFolder,
    onCancelCreate: cancelCreateFolder,
    renamingFolder,
    renameFolderValue,
    onRenameFolderChange: setRenameFolderValue,
    onRenameFolder: renameFolder,
    onCancelRename: cancelRenameFolder,
  }), [isCreatingFolder, newFolderParent, newFolderName, startCreateFolder, createFolder, cancelCreateFolder, renamingFolder, renameFolderValue, renameFolder, cancelRenameFolder]);

  // Memoize typed convenience accessors
  const sourceSummaries = useMemo(() =>
    type === "library" ? entries.map((e) => e.data).filter(Boolean) as SourceSummary[] : [],
    [entries, type]
  );
  const documents = useMemo(() =>
    type === "notebook" ? entries.map((e) => e.data).filter(Boolean) as NotebookDocument[] : [],
    [entries, type]
  );

  // Return type config ready for Sidebar
  return {
    // Section state
    type,
    entries,
    setEntries,
    isOpen,
    toggle,
    isEmpty: entries.length === 0,

    // Tree
    treeNodes,
    expandedFolders,
    toggleFolder,
    setExpandedFolders,

    // Drag & drop (grouped for SectionConfig)
    dragDrop,

    // Folder management (grouped for SectionConfig)
    folderManagement,

    // Direct folder actions (for context menu)
    startRenameFolder,

    // Actions
    deleteFolder,
    refresh: useCallback(async () => {
      await Promise.all([loadEntries(), loadFolders()]);
    }, [loadEntries, loadFolders]),
    // Typed convenience accessors
    sourceSummaries,
    documents,
  };
}
