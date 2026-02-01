"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Eye, SkipForward, Target, Settings } from "lucide-react";
import { Source, SourceSummary, ActionType, ACTION_CONFIG, TreeNode } from "@/lib/types";
import { theme, generatePalette } from "@/lib/theme";
import { Logo } from "@/components/Icons";
import { SourceView } from "@/components/SourceView";
import { Dashboard } from "@/components/Dashboard";
import { SettingsModal } from "@/components/SettingsModal";
import { ContextMenu, ContextMenuState } from "@/components/ContextMenu";
import { LibrarySidebar } from "@/components/LibrarySidebar";

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
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

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

  // Debug state for previewing loading UI
  const [debugLoadingMode, setDebugLoadingMode] = useState<"none" | "analysis" | "connections">("none");

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
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontFamily={fontFamily}
        onFontChange={saveFont}
        rootPath={rootPath}
        debugLoadingMode={debugLoadingMode}
        onDebugModeChange={setDebugLoadingMode}
        palette={palette}
      />

      {/* Main Area: Sidebar + Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <LibrarySidebar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isLibraryOpen={isLibraryOpen}
          onToggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
          libraryPath={libraryPath}
          selectedSource={selectedSource}
          onNavigateToDashboard={navigateToDashboard}
          onNavigateToSource={navigateToSource}
          treeNodes={buildTree()}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onContextMenu={handleContextMenu}
          onFolderContextMenu={handleFolderContextMenu}
          dragOverFolder={dragOverFolder}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          isCreatingFolder={isCreatingFolder}
          newFolderParent={newFolderParent}
          newFolderName={newFolderName}
          onStartCreateFolder={(parentPath) => {
            setIsCreatingFolder(true);
            setNewFolderParent(parentPath);
          }}
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
          isEmpty={sources.length === 0 && folders.length === 0}
        />

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
                onNavigateToSource={navigateToSource}
                isReanalyzing={reanalyzingId === selectedSource.meta.id}
                palette={palette}
                theme={theme}
                getActionConfig={getActionConfig}
                getScoreColor={getScoreColor}
                debugLoadingMode={debugLoadingMode}
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
      <ContextMenu
        menu={contextMenu}
        onCopyUrl={handleCopyUrl}
        onDeleteSource={handleDeleteSource}
        onRenameFolder={handleStartRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />
    </div>
  );
}

