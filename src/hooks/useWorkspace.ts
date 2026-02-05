"use client";

import { useState, useEffect, useCallback } from "react";
import { WorkspaceDocument } from "@/lib/types";

export function useWorkspace() {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);

  const loadWorkspace = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace");
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
        setFolders(data.folders);
      }
    } catch (err) {
      console.error("Failed to load workspace:", err);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(loadWorkspace, 5000);
    return () => clearInterval(interval);
  }, [loadWorkspace]);

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

  const toggleWorkspace = () => {
    setIsWorkspaceOpen((prev) => !prev);
  };

  return {
    documents,
    folders,
    expandedFolders,
    isWorkspaceOpen,
    toggleFolder,
    toggleWorkspace,
    refreshWorkspace: loadWorkspace,
  };
}
