"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  Eye,
  SkipForward,
  Folder,
  FolderOpen,
  Target,
  PanelLeftClose,
  PanelLeft,
  Settings,
  LayoutDashboard,
  Trash2,
  Copy,
  FolderPlus,
  Pencil,
} from "lucide-react";
import { Source, SourceSummary, ActionType, ACTION_CONFIG, TreeNode } from "@/lib/types";
import { theme, generatePalette } from "@/lib/theme";
import { Logo } from "@/components/Icons";
import { getSourceIcon } from "@/lib/sourceIcon";
import { TreeItem } from "@/components/TreeItem";
import { SourceView } from "@/components/SourceView";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get("source");

  const [sources, setSources] = useState<SourceSummary[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [captureInput, setCaptureInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"digest" | "critique">("digest");
  const [libraryPath, setLibraryPath] = useState<string>("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [pendingCaptures, setPendingCaptures] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Context menu state - supports both sources and folders
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    type: "source" | "folder";
    sourceId?: string;
    sourceUrl?: string;
    folderPath?: string;
    folderName?: string;
  } | null>(null);

  // Folder editing state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string>("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState("");

  // Drag and drop state
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [accentColor, setAccentColor] = useState("#3b6044");
  const [fontFamily, setFontFamily] = useState("outfit");
  const [rootPath, setRootPath] = useState("");

  // Generate palette based on accent color
  const palette = useMemo(() => generatePalette(accentColor), [accentColor]);

  // Get score color based on current palette
  const getScoreColor = (score: number) => {
    if (score >= 80) return palette[600];
    if (score >= 60) return palette[500];
    if (score >= 40) return "#eab308";
    if (score >= 20) return "#f97316";
    return "#ef4444";
  };

  // Load config and sources on mount
  useEffect(() => {
    loadConfig();
    loadSources();
    loadFolders();
  }, []);

  // Poll for updates - faster when sources are processing
  useEffect(() => {
    const hasProcessing = sources.some(s => s.meta.processingStatus === "processing");
    const pollInterval = hasProcessing ? 2000 : 5000;

    const interval = setInterval(() => {
      loadSources();
      loadFolders();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [sources]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Load source from URL param
  useEffect(() => {
    if (sourceId) {
      handleSelectSource(sourceId);
    } else {
      setSelectedSource(null);
    }
  }, [sourceId]);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.success) {
        setLibraryPath(data.config.libraryPath);
        if (data.config.accentColor) {
          setAccentColor(data.config.accentColor);
        }
        if (data.config.fontFamily) {
          setFontFamily(data.config.fontFamily);
        }
        if (data.config.rootPath) {
          setRootPath(data.config.rootPath);
        }
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  };

  const saveFont = async (newFont: string) => {
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fontFamily: newFont }),
      });
      const data = await res.json();
      if (data.success) {
        setFontFamily(newFont);
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const loadSources = async () => {
    try {
      const res = await fetch("/api/sources");
      const data = await res.json();
      if (data.success) {
        setSources(data.sources);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  };

  const loadFolders = async () => {
    try {
      const res = await fetch("/api/folders");
      const data = await res.json();
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  };

  const handleCapture = () => {
    if (!captureInput.trim()) return;

    const input = captureInput.trim();
    const isUrl = /^https?:\/\//i.test(input);
    const displayName = isUrl ? new URL(input).hostname : input.slice(0, 30) + "...";

    // Add to pending list and clear input immediately
    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    // Process in background
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isUrl ? { url: input } : { text: input }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          setSources((prev) => [{
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, ...prev]);
        } else {
          setError(data.error || "Failed to capture content");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to capture");
      })
      .finally(() => {
        setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
      });
  };

  const handleFileUpload = (file: File) => {
    const displayName = file.name;

    // Add to pending list and clear input
    setPendingCaptures((prev) => [...prev, displayName]);
    setCaptureInput("");
    setError(null);

    // Upload file
    const formData = new FormData();
    formData.append("file", file);

    fetch("/api/capture", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          setSources((prev) => [{
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, ...prev]);
        } else {
          setError(data.error || "Failed to upload file");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to upload file");
      })
      .finally(() => {
        setPendingCaptures((prev) => prev.filter((p) => p !== displayName));
      });
  };

  const handleSelectSource = async (id: string) => {
    try {
      const res = await fetch(`/api/sources/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to load source:", err);
    }
  };

  const navigateToSource = (id: string) => {
    router.push(`/?source=${id}`);
  };

  const navigateToDashboard = () => {
    router.push("/dashboard");
  };

  // Context menu handlers
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

  const handleDeleteSource = async () => {
    if (!contextMenu || contextMenu.type !== "source") return;
    const { sourceId } = contextMenu;
    setContextMenu(null);

    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSources((prev) => prev.filter((s) => s.meta.id !== sourceId));
        if (selectedSource?.meta.id === sourceId) {
          router.push("/");
        }
      } else {
        setError(data.error || "Failed to delete source");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleDeleteFolder = async () => {
    if (!contextMenu || contextMenu.type !== "folder") return;
    const { folderPath } = contextMenu;
    setContextMenu(null);

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

  const handleStartRenameFolder = () => {
    if (!contextMenu || contextMenu.type !== "folder") return;
    setRenamingFolder(contextMenu.folderPath!);
    setRenameFolderValue(contextMenu.folderName!);
    setContextMenu(null);
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
        // Update expanded folders if the renamed folder was expanded
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

  // Folder creation
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

  // Drag and drop handlers
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

  // Toggle folder expansion
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

  // Build tree structure from sources and folders
  const buildTree = (): TreeNode[] => {
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
          // Folder doesn't exist yet, add to root
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
        // Sources: sort by createdAt descending (newest first)
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
  };

  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);

  const handleReanalyze = async (id: string) => {
    setReanalyzingId(id);
    try {
      const res = await fetch(`/api/sources/${id}/reanalyze`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      } else {
        setError(data.error || "Failed to re-analyze");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to re-analyze");
    } finally {
      setReanalyzingId(null);
    }
  };

  const handleReaction = async (
    sourceId: string,
    type: "highlight" | "concept",
    itemId: string,
    reaction: string
  ) => {
    try {
      const res = await fetch(`/api/sources/${sourceId}/reaction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, itemId, reaction }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSource(data.source);
      }
    } catch (err) {
      console.error("Failed to update reaction:", err);
    }
  };

  // UI config for action types
  const actionUI: Record<ActionType, { icon: React.ReactNode; color: string }> = {
    must_read: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[600] },
    worth_reading: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[500] },
    skim: { icon: <Eye className="w-3.5 h-3.5" />, color: "#eab308" },
    summary_only: { icon: <Eye className="w-3.5 h-3.5" />, color: "#f97316" },
    skip: { icon: <SkipForward className="w-3.5 h-3.5" />, color: "#ef4444" },
  };

  const getActionConfig = (action: ActionType) => {
    const config = ACTION_CONFIG[action];
    const ui = actionUI[action];
    return {
      icon: ui?.icon ?? <Target className="w-3.5 h-3.5" />,
      label: config?.label ?? action,
      description: config?.description ?? "",
      color: ui?.color ?? theme.textMuted,
    };
  };

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: `var(--font-${fontFamily})` }}
    >
      {/* Top Header */}
      <header
        className="h-12 flex-shrink-0 border-b flex items-center justify-between px-4"
        style={{ borderColor: theme.border }}
      >
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <Logo className="w-5 h-5" color={palette[600]} />
          <span className="font-semibold">Second Brain</span>
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" style={{ color: theme.textMuted }} />
        </button>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setIsSettingsOpen(false)}
          />
          <div
            className="relative bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]"
            style={{ borderColor: theme.border }}
          >
            <h2 className="text-lg font-semibold mb-4">Settings</h2>

            {/* Font Family */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Font</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "outfit", name: "Outfit" },
                  { id: "inter", name: "Inter" },
                  { id: "dm-sans", name: "DM Sans" },
                  { id: "space-grotesk", name: "Space Grotesk" },
                  { id: "sora", name: "Sora" },
                  { id: "plus-jakarta-sans", name: "Plus Jakarta Sans" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => saveFont(option.id)}
                    className="px-3 py-2 rounded-lg border text-center transition-all hover:border-gray-300"
                    style={{
                      fontFamily: `var(--font-${option.id})`,
                      borderColor: fontFamily === option.id ? palette[500] : theme.border,
                      backgroundColor: fontFamily === option.id ? `${palette[500]}10` : "transparent",
                    }}
                  >
                    <div className="font-medium text-sm">Second Brain</div>
                    <div className="text-xs text-gray-400">{option.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Data Path */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Data Location</label>
              <p className="text-sm text-gray-500 break-all">{rootPath || "Loading..."}</p>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="w-full mt-4 px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: palette[600] }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Area: Sidebar + Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside
          className={`flex-shrink-0 border-r flex flex-col transition-all duration-200 ${
            isSidebarOpen ? "w-64" : "w-12"
          }`}
          style={{ borderColor: theme.border }}
        >
          {/* Sidebar Toggle */}
          <div className="px-3 py-2 flex items-center justify-end">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" style={{ color: theme.textMuted }} />
              ) : (
                <PanelLeft className="w-4 h-4" style={{ color: theme.textMuted }} />
              )}
            </button>
          </div>

          {/* Navigation */}
          {isSidebarOpen && (
            <>
              {/* Dashboard Entry */}
              <button
                onClick={navigateToDashboard}
                className="mx-2 px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors text-left rounded-lg"
                style={{
                  backgroundColor: !selectedSource ? `${palette[500]}15` : undefined,
                }}
              >
                <LayoutDashboard
                  className="w-4 h-4"
                  style={{ color: !selectedSource ? palette[500] : theme.textMuted }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: !selectedSource ? palette[600] : theme.text }}
                >
                  Dashboard
                </span>
              </button>

              <div className="flex-1 overflow-auto mt-2">
                {/* Library Section Label */}
                <div className="px-3 py-1">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                    Library
                  </span>
                </div>

                {/* Library Root - drop target for moving to root */}
                <div
                  onDragOver={(e) => handleDragOver(e, "")}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, "")}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left cursor-pointer"
                  style={{
                    backgroundColor: dragOverFolder === "" ? `${palette[500]}20` : undefined,
                  }}
                >
                  <div
                    onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    {isLibraryOpen ? (
                      <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
                    ) : (
                      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
                    )}
                    {isLibraryOpen ? (
                      <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
                    ) : (
                      <Folder className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
                    )}
                    <span className="text-sm truncate" title={libraryPath}>
                      {libraryPath.split("/").pop() || "library"}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCreatingFolder(true);
                      setNewFolderParent("");
                    }}
                    className="p-1 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                    title="New folder"
                  >
                    <FolderPlus className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
                  </button>
                </div>

                {/* Folder Creation Input */}
                {isCreatingFolder && newFolderParent === "" && isLibraryOpen && (
                  <div className="ml-6 mr-3 mb-1">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateFolder();
                        if (e.key === "Escape") {
                          setIsCreatingFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      onBlur={() => {
                        if (!newFolderName.trim()) {
                          setIsCreatingFolder(false);
                          setNewFolderName("");
                        }
                      }}
                      placeholder="Folder name..."
                      className="w-full px-2 py-1 text-sm border rounded"
                      style={{ borderColor: theme.border }}
                      autoFocus
                    />
                  </div>
                )}

                {/* Tree View */}
                {isLibraryOpen && (
                  <div>
                    {buildTree().map((node) => (
                      <TreeItem
                        key={node.path}
                        node={node}
                        depth={1}
                        selectedSourceId={selectedSource?.meta.id}
                        expandedFolders={expandedFolders}
                        dragOverFolder={dragOverFolder}
                        onToggleFolder={toggleFolder}
                        onSelectSource={navigateToSource}
                        onContextMenu={handleContextMenu}
                        onFolderContextMenu={handleFolderContextMenu}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                        onStartCreateFolder={(parentPath) => {
                          setIsCreatingFolder(true);
                          setNewFolderParent(parentPath);
                        }}
                        isCreatingFolder={isCreatingFolder}
                        newFolderParent={newFolderParent}
                        newFolderName={newFolderName}
                        onFolderNameChange={setNewFolderName}
                        onCreateFolder={handleCreateFolder}
                        onCancelCreate={() => {
                          setIsCreatingFolder(false);
                          setNewFolderName("");
                          setNewFolderParent("");
                        }}
                        renamingFolder={renamingFolder}
                        renameFolderValue={renameFolderValue}
                        onRenameFolderChange={setRenameFolderValue}
                        onRenameFolder={handleRenameFolder}
                        onCancelRename={() => {
                          setRenamingFolder(null);
                          setRenameFolderValue("");
                        }}
                        palette={palette}
                        theme={theme}
                      />
                    ))}
                    {sources.length === 0 && folders.length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: theme.textLight }}>
                        No sources yet
                      </div>
                    )}
                  </div>
                )}
              </div>

            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedSource ? (
              <SourceView
                source={selectedSource}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onClose={() => setSelectedSource(null)}
                onReanalyze={() => handleReanalyze(selectedSource.meta.id)}
                onReaction={(type, itemId, reaction) => handleReaction(selectedSource.meta.id, type, itemId, reaction)}
                onSourceUpdated={async () => {
                  // Reload the source after edit
                  const res = await fetch(`/api/sources/${selectedSource.meta.id}`);
                  const data = await res.json();
                  if (data.success && data.source) {
                    setSelectedSource(data.source);
                    loadSources(); // Also refresh sidebar
                  }
                }}
                isReanalyzing={reanalyzingId === selectedSource.meta.id}
                palette={palette}
                theme={theme}
                getActionConfig={getActionConfig}
                getScoreColor={getScoreColor}
              />
            ) : (
              <Dashboard
                sources={sources}
                onSelect={navigateToSource}
                captureInput={captureInput}
                setCaptureInput={setCaptureInput}
                onCapture={handleCapture}
                onFileUpload={handleFileUpload}
                pendingCaptures={pendingCaptures}
                error={error}
                palette={palette}
                theme={theme}
                getScoreColor={getScoreColor}
              />
            )}
          </div>
        </main>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border rounded-lg shadow-lg py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            borderColor: theme.border,
          }}
        >
          {contextMenu.type === "source" ? (
            <>
              {contextMenu.sourceUrl && (
                <button
                  onClick={handleCopyUrl}
                  className="w-full px-4 py-2 text-sm text-left hover:bg-black/5 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" style={{ color: theme.textMuted }} />
                  Copy Source URL
                </button>
              )}
              <button
                onClick={handleDeleteSource}
                className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleStartRenameFolder}
                className="w-full px-4 py-2 text-sm text-left hover:bg-black/5 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" style={{ color: theme.textMuted }} />
                Rename
              </button>
              <button
                onClick={handleDeleteFolder}
                className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

