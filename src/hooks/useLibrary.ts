"use client";

import { useState, useEffect, useCallback } from "react";
import { SourceSummary, TreeNode } from "@/lib/types";

export function useLibrary() {
  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const loadSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  }, []);

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

  // Load on mount
  useEffect(() => {
    loadSources();
    loadFolders();
  }, [loadSources, loadFolders]);

  // Poll for updates - faster when sources are processing
  useEffect(() => {
    const hasProcessing = sources.some(s => s.meta.processingStatus === "processing");
    const pollInterval = hasProcessing ? 2000 : 5000;

    const interval = setInterval(() => {
      loadSources();
      loadFolders();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [sources, loadSources, loadFolders]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const buildTree = useCallback((): TreeNode[] => {
    const tree: TreeNode[] = [];
    const folderNodes = new Map<string, TreeNode>();

    // Create folder nodes
    for (const folderPath of folders) {
      const parts = folderPath.split("/");
      let currentPath = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!folderNodes.has(currentPath)) {
          const node: TreeNode = {
            type: "folder",
            name: part,
            path: currentPath,
            children: [],
          };
          folderNodes.set(currentPath, node);

          if (parentPath) {
            const parent = folderNodes.get(parentPath);
            parent?.children?.push(node);
          } else {
            tree.push(node);
          }
        }
      }
    }

    // Add sources to appropriate folders
    for (const source of sources) {
      const sourceNode: TreeNode = {
        type: "source",
        name: source.meta.title,
        path: source.meta.folder ? `${source.meta.folder}/${source.meta.id}` : source.meta.id,
        source,
      };

      if (source.meta.folder) {
        const folderNode = folderNodes.get(source.meta.folder);
        if (folderNode) {
          folderNode.children?.push(sourceNode);
        } else {
          tree.push(sourceNode);
        }
      } else {
        tree.push(sourceNode);
      }
    }

    // Sort: folders first (alphabetically), then sources by time (newest first)
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        if (a.type === "folder") return a.name.localeCompare(b.name);
        const timeA = new Date(a.source?.meta.createdAt || 0).getTime();
        const timeB = new Date(b.source?.meta.createdAt || 0).getTime();
        return timeB - timeA;
      });
      for (const node of nodes) {
        if (node.children) sortNodes(node.children);
      }
    };
    sortNodes(tree);

    return tree;
  }, [sources, folders]);

  return {
    sources,
    setSources,
    folders,
    loadSources,
    loadFolders,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,
    buildTree,
    isLibraryOpen,
    setIsLibraryOpen,
    isSidebarOpen,
    setIsSidebarOpen,
  };
}
