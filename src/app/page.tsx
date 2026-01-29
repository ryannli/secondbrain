"use client";

import React, { useState, useEffect, Suspense } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
  BookOpen,
  Eye,
  SkipForward,
  Folder,
  FolderOpen,
  Target,
  PanelLeftClose,
  PanelLeft,
  Clock,
  Settings,
  LayoutDashboard,
  RefreshCw,
  HelpCircle,
  Star,
  Trash2,
  Copy,
  FolderPlus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Source, SourceSummary, SourceType, ActionType, ACTION_CONFIG, Highlight, TreeNode } from "@/lib/types";
import { getBrandFromUrl } from "@/lib/brandLogos";
import { theme, palette, getScoreColor } from "@/lib/theme";
import { Logo, getFallbackIcon } from "@/components/Icons";

// Get icon component and color for a source (brand logo > fallback icon)
function getSourceIcon(sourceUrl?: string, type: SourceType = "article"): {
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  isBrand: boolean;
} {
  const brand = getBrandFromUrl(sourceUrl);
  if (brand) {
    return { Icon: brand.Logo, color: brand.color, isBrand: true };
  }
  return { Icon: getFallbackIcon(type), color: palette[500], isBrand: false };
}

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

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceId: string;
    sourceUrl?: string;
  } | null>(null);

  // Folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState<string>("");

  // Drag and drop state
  const [draggedSourceId, setDraggedSourceId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

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
      }
    } catch (err) {
      console.error("Failed to load config:", err);
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
      sourceId,
      sourceUrl,
    });
  };

  const handleCopyUrl = async () => {
    if (contextMenu?.sourceUrl) {
      await navigator.clipboard.writeText(contextMenu.sourceUrl);
    }
    setContextMenu(null);
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
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
      className="h-screen overflow-hidden font-[family-name:var(--font-outfit)] flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text }}
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
          className="p-2 rounded-lg hover:bg-black/5 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" style={{ color: theme.textMuted }} />
        </button>
      </header>

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

              {/* Library Path */}
              <div
                className="px-3 py-2 border-t text-xs truncate"
                style={{ borderColor: theme.border, color: theme.textLight }}
                title={libraryPath}
              >
                {libraryPath}
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
                pendingCaptures={pendingCaptures}
                error={error}
                palette={palette}
                theme={theme}
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
            onClick={handleDelete}
            className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Dashboard({
  sources,
  onSelect,
  captureInput,
  setCaptureInput,
  onCapture,
  pendingCaptures,
  error,
  palette,
  theme,
}: {
  sources: SourceSummary[];
  onSelect: (id: string) => void;
  captureInput: string;
  setCaptureInput: (value: string) => void;
  onCapture: () => void;
  pendingCaptures: string[];
  error: string | null;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  // Capture input component
  const CaptureInput = () => (
    <div className="max-w-xl mx-auto mt-8 mb-8">
      <div
        className="flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm"
        style={{ borderColor: theme.border }}
      >
        <Plus className="w-5 h-5 flex-shrink-0" style={{ color: theme.textLight }} />
        <input
          type="text"
          value={captureInput}
          onChange={(e) => setCaptureInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && captureInput.trim() && onCapture()}
          placeholder="Paste a link, text, or drop a file..."
          className="flex-1 bg-transparent outline-none text-sm"
          style={{ color: theme.text }}
        />
        <button
          onClick={onCapture}
          disabled={!captureInput.trim()}
          className="px-4 py-2 font-medium text-white text-sm rounded-lg disabled:opacity-50 transition-all hover:opacity-90"
          style={{ backgroundColor: palette[600] }}
        >
          Capture
        </button>
      </div>

      {/* Pending Captures */}
      {pendingCaptures.length > 0 && (
        <div
          className="mt-3 px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
          style={{ backgroundColor: `${palette[500]}10` }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: palette[500] }} />
          <span style={{ color: theme.textMuted }}>
            Processing: {pendingCaptures.join(", ")}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );

  if (sources.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Logo className="w-12 h-12 mb-4" color={theme.textLight} />
        <h2 className="text-lg font-medium mb-2">Welcome to Second Brain</h2>
        <p className="text-sm mb-6" style={{ color: theme.textMuted }}>
          Capture and analyze content from anywhere.
        </p>
        <CaptureInput />
      </div>
    );
  }

  return (
    <div>
      {/* Capture Input */}
      <CaptureInput />

      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5" style={{ color: theme.textMuted }} />
        <h2 className="font-medium">Recent Sources</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.map((source) => {
          const { Icon: SourceIcon, color: iconColor } = getSourceIcon(source.meta.sourceUrl, source.meta.type);
          const isProcessing = source.meta.processingStatus === "processing";
          const isFailed = source.meta.processingStatus === "failed";

          return (
            <button
              key={source.meta.id}
              onClick={() => !isProcessing && onSelect(source.meta.id)}
              className={`p-4 border rounded-xl transition-all text-left ${isProcessing ? "opacity-70" : "hover:shadow-md"}`}
              style={{ borderColor: theme.border, backgroundColor: "white" }}
              disabled={isProcessing}
            >
              {/* Header: Icon + Title + Badge */}
              <div className="flex items-start gap-3 mb-2">
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 mt-0.5 flex-shrink-0 animate-spin" style={{ color: palette[500] }} />
                ) : (
                  <SourceIcon className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: iconColor }} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="font-medium leading-snug line-clamp-2 text-sm flex-1 min-w-0" style={{ color: theme.text }}>
                      {source.meta.title}
                    </h3>
                    {isProcessing ? (
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-md flex-shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: `${palette[500]}15`, color: palette[500] }}
                      >
                        Processing...
                      </span>
                    ) : isFailed ? (
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-md flex-shrink-0 whitespace-nowrap"
                        style={{ backgroundColor: "#ef444415", color: "#ef4444" }}
                      >
                        Failed
                      </span>
                    ) : source.action && (
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-md flex-shrink-0 whitespace-nowrap"
                        style={{
                          backgroundColor: `${getScoreColor(source.score ?? 50)}15`,
                          color: getScoreColor(source.score ?? 50),
                        }}
                      >
                        {ACTION_CONFIG[source.action]?.label ?? source.action}
                      </span>
                    )}
                  </div>
                  {source.meta.sourceUrl && (
                    <p className="text-xs mt-1 truncate" style={{ color: theme.textLight }}>
                      {new URL(source.meta.sourceUrl).hostname}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason or Processing Status */}
              {isProcessing ? (
                <p className="text-xs ml-8" style={{ color: theme.textMuted }}>
                  Extracting content and analyzing...
                </p>
              ) : isFailed ? (
                <p className="text-xs ml-8" style={{ color: "#ef4444" }}>
                  {source.meta.processingError || "Processing failed"}
                </p>
              ) : source.reason && (
                <p className="text-xs line-clamp-2 ml-8" style={{ color: theme.textMuted }}>
                  {source.reason}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SourceView({
  source,
  activeTab,
  setActiveTab,
  onReanalyze,
  onReaction,
  onSourceUpdated,
  isReanalyzing,
  palette,
  theme,
  getActionConfig,
  getScoreColor,
}: {
  source: Source;
  activeTab: "digest" | "critique";
  setActiveTab: (tab: "digest" | "critique") => void;
  onClose: () => void;
  onReanalyze: () => void;
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  onSourceUpdated: () => void;
  isReanalyzing: boolean;
  palette: Record<number, string>;
  theme: Record<string, string>;
  getActionConfig: (action: ActionType) => { icon: React.ReactNode; label: string; description: string; color: string };
  getScoreColor: (score: number) => string;
}) {
  const { meta, content, analysis } = source;
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [editedTitle, setEditedTitle] = useState(meta.title);
  const [isSaving, setIsSaving] = useState(false);

  // Reset edit state when source changes
  useEffect(() => {
    setEditedContent(content);
    setEditedTitle(meta.title);
    setIsEditing(false);
  }, [source.meta.id, content, meta.title]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sources/${meta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editedTitle !== meta.title ? editedTitle : undefined,
          content: editedContent !== content ? editedContent : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEditing(false);
        onSourceUpdated();
      }
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setEditedTitle(meta.title);
    setIsEditing(false);
  };

  return (
    <div className="flex gap-6 items-start">
      {/* Content Area - independent scroll */}
      <div className="flex-1 min-w-0 max-w-2xl max-h-[calc(100vh-140px)] overflow-y-auto sticky top-0">
        <div className="bg-white border rounded-xl p-6" style={{ borderColor: theme.border }}>
          <div className="flex items-start justify-between mb-2">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-semibold leading-tight w-full border-b-2 outline-none bg-transparent"
                style={{ borderColor: palette[500] }}
              />
            ) : (
              <h1 className="text-2xl font-semibold leading-tight">{meta.title}</h1>
            )}
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: palette[600] }}
                    title="Save changes"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                    style={{ borderColor: theme.border, color: theme.textMuted }}
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="relative group">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 rounded-lg border hover:bg-black/5 transition-colors"
                      style={{ borderColor: theme.border, color: theme.textMuted }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <p className="font-medium mb-1">Edit source</p>
                      <p className="text-gray-300">Edit the title and content directly.</p>
                    </div>
                  </div>
                  <div className="relative group">
                    <button
                      onClick={onReanalyze}
                      disabled={isReanalyzing}
                      className="p-2 rounded-lg border hover:bg-black/5 transition-colors disabled:opacity-50"
                      style={{ borderColor: theme.border, color: theme.textMuted }}
                    >
                      <RefreshCw className={`w-4 h-4 ${isReanalyzing ? "animate-spin" : ""}`} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <p className="font-medium mb-1">Re-process this source</p>
                      <p className="text-gray-300">Re-fetch content from the original input, then re-run AI analysis.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {meta.sourceUrl && (
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: theme.textLight }}
            >
              {new URL(meta.sourceUrl).hostname} ↗
            </a>
          )}

          {/* Content */}
          <div className="mt-6">
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full min-h-[500px] p-4 border rounded-lg font-mono text-sm resize-y outline-none"
                style={{ borderColor: theme.border }}
                placeholder="Markdown content..."
              />
            ) : (
              <div className="prose prose-sm prose-neutral max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Panel */}
      {analysis && (
        <div className="w-[420px] flex-shrink-0">
            {/* Triage Card */}
            {(() => {
              const score = analysis.triage.score ?? 50;
              const scoreColor = getScoreColor(score);
              const actionConfig = getActionConfig(analysis.triage.action);
              return (
                <div
                  className="p-4 mb-4 rounded-xl border"
                  style={{ borderColor: theme.border }}
                >
                  {/* Score + Action Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl font-bold" style={{ color: scoreColor }}>
                      {score}
                    </span>
                    <span
                      className="px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5"
                      style={{ backgroundColor: `${actionConfig.color}15`, color: actionConfig.color }}
                    >
                      {actionConfig.icon}
                      {actionConfig.label}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 rounded-full mb-3" style={{ backgroundColor: theme.borderLight }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: scoreColor }}
                    />
                  </div>

                  {/* Reason */}
                  <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
                    {analysis.triage.reason}
                  </p>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="font-medium">{analysis.triage.readTimeMinutes}</div>
                      <div style={{ color: theme.textLight }}>min</div>
                    </div>
                    <div>
                      <div className="font-medium">{analysis.triage.density}%</div>
                      <div style={{ color: theme.textLight }}>density</div>
                    </div>
                    <div>
                      <div className="font-medium">{analysis.triage.originality}%</div>
                      <div style={{ color: theme.textLight }}>originality</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tabs */}
            <div
              className="flex gap-0.5 mb-4 p-1 rounded-xl"
              style={{ backgroundColor: theme.borderLight }}
            >
              {(["digest", "critique"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all capitalize"
                  style={
                    activeTab === tab
                      ? { backgroundColor: "white", color: theme.text }
                      : { color: theme.textMuted }
                  }
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div
              className="p-4 rounded-xl border"
              style={{ borderColor: theme.border }}
            >
              {activeTab === "digest" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-2">Summary</h4>
                    <p className="text-sm" style={{ color: theme.textMuted }}>
                      {analysis.digest.summary}
                    </p>
                  </div>
                  {(analysis.digest.highlights?.length ?? 0) > 0 && (
                    <HighlightsSection
                      highlights={analysis.digest.highlights!}
                      onReaction={onReaction}
                      palette={palette}
                      theme={theme}
                    />
                  )}
                  {(analysis.digest.concepts?.length ?? 0) > 0 && (
                    <ConceptsSection
                      concepts={analysis.digest.concepts}
                      onReaction={onReaction}
                      palette={palette}
                      theme={theme}
                    />
                  )}
                </div>
              )}

              {activeTab === "critique" && (
                <div className="space-y-4">
                  {analysis.critique.hiddenAssumptions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Hidden Assumptions</h4>
                      <ul className="space-y-1.5">
                        {analysis.critique.hiddenAssumptions.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.critique.potentialIssues.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Potential Issues</h4>
                      <ul className="space-y-1.5">
                        {analysis.critique.potentialIssues.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysis.critique.needsVerification.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Needs Verification</h4>
                      <ul className="space-y-1.5">
                        {analysis.critique.needsVerification.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: theme.textMuted }}
                          >
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            </div>
        </div>
      )}
    </div>
  );
}

function HighlightsSection({
  highlights,
  onReaction,
  palette,
  theme,
}: {
  highlights: Highlight[];
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const typeColors = {
    insight: palette[500],
    fact: "#3b82f6",
    actionable: "#f97316",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h4 className="font-medium text-sm">Highlights</h4>
        <div className="flex gap-2 text-xs" style={{ color: theme.textLight }}>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: palette[500] }} />
            insight
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
            fact
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f97316" }} />
            actionable
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {highlights.map((h) => {
          const isStarred = h.reaction === "star";
          const isDismissed = h.reaction === "dismiss";
          return (
            <li
              key={h.id}
              className="text-sm pl-3 py-2 border-l-2 transition-opacity flex items-start gap-2"
              style={{
                borderColor: typeColors[h.type],
                color: theme.textMuted,
                opacity: isDismissed ? 0.4 : 1,
              }}
            >
              <div className="flex-1">{h.text}</div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => onReaction("highlight", h.id, isStarred ? "" : "star")}
                  className="p-1 rounded transition-all hover:scale-110"
                  title={isStarred ? "Unstar" : "Star"}
                >
                  <Star
                    className="w-4 h-4"
                    style={{
                      color: isStarred ? "#eab308" : theme.textLight,
                      fill: isStarred ? "#eab308" : "none",
                    }}
                  />
                </button>
                <button
                  onClick={() => onReaction("highlight", h.id, isDismissed ? "" : "dismiss")}
                  className="p-1 rounded transition-all hover:scale-110"
                  title={isDismissed ? "Restore" : "Dismiss"}
                  style={{ color: isDismissed ? theme.textMuted : theme.textLight }}
                >
                  <span className="text-xs">✕</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConceptsSection({
  concepts,
  onReaction,
  palette,
  theme,
}: {
  concepts: { id: string; term: string; definition: string; understood?: boolean }[];
  onReaction: (type: "highlight" | "concept", itemId: string, reaction: string) => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-sm">Key Concepts</h4>
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: theme.textLight }} />
          <div className="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-lg">
            <p className="mb-2">Terms or ideas that may need explanation.</p>
            <p className="mb-2 text-gray-300">
              <strong className="text-white">Got it</strong> — Click when you understand. The concept fades so you can focus on what you still need to learn.
            </p>
            <p className="text-gray-300">Tracking your knowledge helps tailor future analysis to your expertise level.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {concepts.map((c) => (
          <div
            key={c.id}
            className="p-2 rounded-lg transition-opacity"
            style={{
              backgroundColor: theme.borderLight,
              opacity: c.understood ? 0.4 : 1,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{c.term}</span>
              <button
                onClick={() => onReaction("concept", c.id, "toggle")}
                className="px-2 py-0.5 text-xs rounded transition-all hover:scale-105 hover:shadow-sm"
                style={{
                  backgroundColor: c.understood ? `${palette[500]}20` : "transparent",
                  color: c.understood ? palette[600] : theme.textLight,
                  border: `1px solid ${c.understood ? palette[500] : theme.border}`,
                }}
                onMouseEnter={(e) => {
                  if (!c.understood) {
                    e.currentTarget.style.backgroundColor = `${palette[500]}10`;
                    e.currentTarget.style.borderColor = palette[500];
                    e.currentTarget.style.color = palette[600];
                  }
                }}
                onMouseLeave={(e) => {
                  if (!c.understood) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = theme.border;
                    e.currentTarget.style.color = theme.textLight;
                  }
                }}
              >
                {c.understood ? "✓ Got it" : "Got it"}
              </button>
            </div>
            <div className="text-sm" style={{ color: theme.textMuted }}>{c.definition}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tree item component for folder/source rendering
function TreeItem({
  node,
  depth,
  selectedSourceId,
  expandedFolders,
  dragOverFolder,
  onToggleFolder,
  onSelectSource,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onStartCreateFolder,
  isCreatingFolder,
  newFolderParent,
  newFolderName,
  onFolderNameChange,
  onCreateFolder,
  onCancelCreate,
  palette,
  theme,
}: {
  node: TreeNode;
  depth: number;
  selectedSourceId?: string;
  expandedFolders: Set<string>;
  dragOverFolder: string | null;
  onToggleFolder: (path: string) => void;
  onSelectSource: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, sourceId: string, sourceUrl?: string) => void;
  onDragStart: (e: React.DragEvent, sourceId: string) => void;
  onDragOver: (e: React.DragEvent, folderPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetFolder: string) => void;
  onDragEnd: () => void;
  onStartCreateFolder: (parentPath: string) => void;
  isCreatingFolder: boolean;
  newFolderParent: string;
  newFolderName: string;
  onFolderNameChange: (name: string) => void;
  onCreateFolder: () => void;
  onCancelCreate: () => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}) {
  const paddingLeft = depth * 12 + 12;

  if (node.type === "folder") {
    const isExpanded = expandedFolders.has(node.path);
    const isDragOver = dragOverFolder === node.path;
    const showInput = isCreatingFolder && newFolderParent === node.path;

    return (
      <div>
        <div
          onDragOver={(e) => onDragOver(e, node.path)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, node.path)}
          className="w-full py-1.5 pr-3 flex items-center hover:bg-black/5 transition-colors text-left cursor-pointer rounded group"
          style={{
            backgroundColor: isDragOver ? `${palette[500]}20` : undefined,
          }}
        >
          <div
            onClick={() => onToggleFolder(node.path)}
            className="flex items-center gap-2 flex-1 min-w-0"
            style={{ paddingLeft }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
            ) : (
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
            ) : (
              <Folder className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
            )}
            <span className="text-sm truncate">{node.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartCreateFolder(node.path);
              if (!isExpanded) onToggleFolder(node.path);
            }}
            className="p-1 rounded hover:bg-black/10 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
            title="New subfolder"
          >
            <FolderPlus className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
          </button>
        </div>
        {isExpanded && (
          <div>
            {showInput && (
              <div style={{ paddingLeft: paddingLeft + 12 }} className="py-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => onFolderNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onCreateFolder();
                    if (e.key === "Escape") onCancelCreate();
                  }}
                  onBlur={() => {
                    if (!newFolderName.trim()) onCancelCreate();
                  }}
                  placeholder="Folder name..."
                  className="w-full px-2 py-1 text-sm border rounded"
                  style={{ borderColor: theme.border }}
                  autoFocus
                />
              </div>
            )}
            {node.children?.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedSourceId={selectedSourceId}
                expandedFolders={expandedFolders}
                dragOverFolder={dragOverFolder}
                onToggleFolder={onToggleFolder}
                onSelectSource={onSelectSource}
                onContextMenu={onContextMenu}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onStartCreateFolder={onStartCreateFolder}
                isCreatingFolder={isCreatingFolder}
                newFolderParent={newFolderParent}
                newFolderName={newFolderName}
                onFolderNameChange={onFolderNameChange}
                onCreateFolder={onCreateFolder}
                onCancelCreate={onCancelCreate}
                palette={palette}
                theme={theme}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Source item
  const source = node.source!;
  const isSelected = selectedSourceId === source.meta.id;
  const isProcessing = source.meta.processingStatus === "processing";
  const { Icon: SourceIcon, color: iconColor, isBrand } = getSourceIcon(source.meta.sourceUrl, source.meta.type);

  return (
    <div
      draggable={!isProcessing}
      onClick={() => !isProcessing && onSelectSource(source.meta.id)}
      onContextMenu={(e) => !isProcessing && onContextMenu(e, source.meta.id, source.meta.sourceUrl)}
      onDragStart={(e) => !isProcessing && onDragStart(e, source.meta.id)}
      onDragEnd={onDragEnd}
      className={`w-full py-1.5 flex items-center gap-2 transition-colors text-left rounded ${isProcessing ? "opacity-60" : "hover:bg-black/5 cursor-pointer"}`}
      style={{
        paddingLeft,
        backgroundColor: isSelected ? `${palette[500]}15` : undefined,
      }}
    >
      {isProcessing ? (
        <Loader2
          className="w-4 h-4 flex-shrink-0 animate-spin"
          style={{ color: palette[500] }}
        />
      ) : (
        <SourceIcon
          className="w-4 h-4 flex-shrink-0"
          style={{
            // Brand logos use their own colors, fallback icons use theme colors
            color: isBrand ? iconColor : (isSelected ? palette[500] : theme.textLight),
          }}
        />
      )}
      <span
        className="text-sm truncate"
        style={{
          color: isProcessing ? theme.textMuted : isSelected ? palette[600] : theme.text,
        }}
        title={source.meta.title}
      >
        {source.meta.title}
      </span>
    </div>
  );
}
