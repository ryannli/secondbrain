"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, Eye, SkipForward, Target } from "lucide-react";
import { Source, ActionType, ACTION_CONFIG } from "@/lib/types";
import { theme } from "@/lib/theme";
import { SourceView } from "@/components/SourceView";
import { Dashboard } from "@/components/Dashboard";
import { FeedSection } from "@/components/FeedSection";
import { Header } from "@/components/Header";
import { SettingsModal } from "@/components/SettingsModal";
import { ContextMenu } from "@/components/ContextMenu";
import { LibrarySidebar } from "@/components/LibrarySidebar";
import { useSettings } from "@/hooks/useSettings";
import { useLibrary } from "@/hooks/useLibrary";
import { useFolderManagement } from "@/hooks/useFolderManagement";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useSourceActions } from "@/hooks/useSourceActions";
import { useFeed } from "@/hooks/useFeed";
import { CoLearningPanel } from "@/components/CoLearningPanel";
import { SelectionPopover } from "@/components/SelectionPopover";
import { ResizeHandle } from "@/components/ResizeHandle";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sourceId = searchParams.get("source");
  const viewParam = searchParams.get("view");

  // Core state
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"digest" | "critique">("digest");
  const [isCoLearningOpen, setIsCoLearningOpen] = useState(false);
  const [isCoLearningInitialized, setIsCoLearningInitialized] = useState(false);
  const mainContentRef = React.useRef<HTMLDivElement>(null);

  // Load agent panel state from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("agent-panel-open");
    if (saved === "true") setIsCoLearningOpen(true);
    setIsCoLearningInitialized(true);
  }, []);

  // Persist agent panel open state (only after initialized)
  useEffect(() => {
    if (isCoLearningInitialized) {
      localStorage.setItem("agent-panel-open", isCoLearningOpen.toString());
    }
  }, [isCoLearningOpen, isCoLearningInitialized]);

  // Resizable panels - use default values, load from localStorage in useEffect
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [askPanelWidth, setAskPanelWidth] = useState(384);
  const [resizing, setResizing] = useState<"sidebar" | "ask" | null>(null);

  // Load saved widths from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const savedSidebar = localStorage.getItem("sidebarWidth");
    const savedAsk = localStorage.getItem("askPanelWidth");
    if (savedSidebar) setSidebarWidth(parseInt(savedSidebar, 10));
    if (savedAsk) setAskPanelWidth(parseInt(savedAsk, 10));
  }, []);

  // Resize handlers
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (resizing === "sidebar") {
      const newWidth = Math.min(400, Math.max(200, e.clientX));
      setSidebarWidth(newWidth);
    } else if (resizing === "ask") {
      const newWidth = Math.min(600, Math.max(320, window.innerWidth - e.clientX));
      setAskPanelWidth(newWidth);
    }
  }, [resizing]);

  const handleMouseUp = useCallback(() => {
    if (resizing === "sidebar") {
      localStorage.setItem("sidebarWidth", sidebarWidth.toString());
    } else if (resizing === "ask") {
      localStorage.setItem("askPanelWidth", askPanelWidth.toString());
    }
    setResizing(null);
  }, [resizing, sidebarWidth, askPanelWidth]);

  useEffect(() => {
    if (resizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }
  }, [resizing, handleMouseMove, handleMouseUp]);

  // Derive currentView from URL
  const currentView: "dashboard" | "foryou" = viewParam === "foryou" ? "foryou" : "dashboard";

  // Navigation helpers
  const navigateToView = (view: "dashboard" | "foryou") => {
    if (view === "foryou") {
      router.push("/?view=foryou");
    } else {
      router.push("/");
    }
  };

  // Settings
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    fontFamily,
    saveFont,
    rootPath,
    libraryPath,
    debugLoadingMode,
    setDebugLoadingMode,
    palette,
    feedSources,
    saveFeedSources,
  } = useSettings();

  // Library (sources, folders, tree)
  const {
    sources,
    setSources,
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
  } = useLibrary();

  // Folder management
  const folderManagement = useFolderManagement({
    loadFolders,
    loadSources,
    expandedFolders,
    setExpandedFolders,
    setError,
  });

  // Drag and drop
  const dragDrop = useDragDrop({
    loadSources,
    setError,
  });

  // Context menu
  const {
    contextMenu,
    handleContextMenu,
    handleFolderContextMenu,
    handleCopyUrl,
    closeContextMenu,
  } = useContextMenu();

  // Source actions
  const {
    captureInput,
    setCaptureInput,
    pendingCaptures,
    handleCapture,
    handleFileUpload,
    handleSelectSource,
    handleDeleteSource,
    handleReanalyze,
    handleReaction,
    reanalyzingId,
    navigateToSource,
    navigateToDashboard,
  } = useSourceActions({
    setSources,
    selectedSource,
    setSelectedSource,
    setError,
  });

  // Feed
  const feed = useFeed();

  // Load feed when viewing For You
  useEffect(() => {
    if (!sourceId && currentView === "foryou") {
      feed.loadFeed();
    }
  }, [sourceId, currentView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture URL from feed
  const handleCaptureUrl = (url: string) => {
    setCaptureInput(url);
    // Trigger capture immediately
    const displayName = new URL(url).hostname;
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
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
      });
  };

  // Load source from URL param
  useEffect(() => {
    if (sourceId) {
      handleSelectSource(sourceId);
    } else {
      setSelectedSource(null);
    }
  }, [sourceId, handleSelectSource]);

  // Auto-expand folder when viewing a source (like VS Code "Reveal in Explorer")
  useEffect(() => {
    if (selectedSource?.meta.folder) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        // Expand all parent folders (e.g., "ai/agents" → expand "ai" and "ai/agents")
        const parts = selectedSource.meta.folder!.split("/");
        let path = "";
        for (const part of parts) {
          path = path ? `${path}/${part}` : part;
          next.add(path);
        }
        return next;
      });
    }
  }, [selectedSource?.meta.folder, setExpandedFolders]);

  // Score color helper
  const getScoreColor = (score: number) => {
    if (score >= 80) return palette[600];
    if (score >= 60) return palette[500];
    if (score >= 40) return "#eab308";
    if (score >= 20) return "#f97316";
    return "#ef4444";
  };

  // Action UI config
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

  // Context menu action handlers
  const onDeleteSource = async () => {
    if (contextMenu?.type === "source" && contextMenu.sourceId) {
      closeContextMenu();
      await handleDeleteSource(contextMenu.sourceId);
    }
  };

  const onDeleteFolder = async () => {
    if (contextMenu?.type === "folder" && contextMenu.folderPath) {
      const folderPath = contextMenu.folderPath;
      closeContextMenu();
      await folderManagement.handleDeleteFolder(folderPath);
    }
  };

  const onStartRenameFolder = () => {
    if (contextMenu?.type === "folder" && contextMenu.folderPath && contextMenu.folderName) {
      folderManagement.startRenameFolder(contextMenu.folderPath, contextMenu.folderName);
      closeContextMenu();
    }
  };

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: `var(--font-${fontFamily})` }}
    >
      <Header palette={palette} onOpenSettings={() => setIsSettingsOpen(true)} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontFamily={fontFamily}
        onFontChange={saveFont}
        rootPath={rootPath}
        debugLoadingMode={debugLoadingMode}
        onDebugModeChange={setDebugLoadingMode}
        palette={palette}
        feedSources={feedSources}
        onFeedSourcesChange={saveFeedSources}
      />

      <div className="flex-1 flex min-h-0">
        <LibrarySidebar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isLibraryOpen={isLibraryOpen}
          onToggleLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
          libraryPath={libraryPath}
          selectedSource={selectedSource}
          currentView={currentView}
          onNavigateToDashboard={() => { navigateToDashboard(); navigateToView("dashboard"); }}
          onNavigateToForYou={() => { navigateToDashboard(); navigateToView("foryou"); }}
          onNavigateToSource={navigateToSource}
          treeNodes={buildTree()}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onContextMenu={handleContextMenu}
          onFolderContextMenu={handleFolderContextMenu}
          dragOverFolder={dragDrop.dragOverFolder}
          onDragStart={dragDrop.handleDragStart}
          onDragOver={dragDrop.handleDragOver}
          onDragLeave={dragDrop.handleDragLeave}
          onDrop={dragDrop.handleDrop}
          onDragEnd={dragDrop.handleDragEnd}
          isCreatingFolder={folderManagement.isCreatingFolder}
          newFolderParent={folderManagement.newFolderParent}
          newFolderName={folderManagement.newFolderName}
          onStartCreateFolder={folderManagement.startCreateFolder}
          onFolderNameChange={folderManagement.setNewFolderName}
          onCreateFolder={folderManagement.handleCreateFolder}
          onCancelCreate={folderManagement.cancelCreateFolder}
          renamingFolder={folderManagement.renamingFolder}
          renameFolderValue={folderManagement.renameFolderValue}
          onRenameFolderChange={folderManagement.setRenameFolderValue}
          onRenameFolder={folderManagement.handleRenameFolder}
          onCancelRename={folderManagement.cancelRenameFolder}
          palette={palette}
          isEmpty={sources.length === 0}
          width={sidebarWidth}
        />

        {/* Resize handle between sidebar and content */}
        {isSidebarOpen && (
          <ResizeHandle
            onMouseDown={() => setResizing("sidebar")}
            isResizing={resizing === "sidebar"}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0" ref={mainContentRef}>
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
                  const res = await fetch(`/api/sources/${selectedSource.meta.id}`);
                  const data = await res.json();
                  if (data.success && data.source) {
                    setSelectedSource(data.source);
                    loadSources();
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
            ) : currentView === "foryou" ? (
              <div className="max-w-3xl mx-auto">
                <FeedSection
                  items={feed.items}
                  interests={feed.interests}
                  generatedAt={feed.generatedAt}
                  fromCache={feed.fromCache}
                  message={feed.message}
                  briefing={feed.briefing}
                  loading={feed.loading}
                  error={feed.error}
                  onCapture={handleCaptureUrl}
                  onDismiss={feed.dismissItem}
                  onRefresh={feed.refreshFeed}
                  palette={palette}
                  theme={theme}
                />
              </div>
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

        {/* Resize handle between content and Ask panel */}
        {isCoLearningOpen && (
          <ResizeHandle
            onMouseDown={() => setResizing("ask")}
            isResizing={resizing === "ask"}
          />
        )}

        {/* Ask Panel */}
        <CoLearningPanel
          isOpen={isCoLearningOpen}
          onToggle={() => setIsCoLearningOpen(!isCoLearningOpen)}
          palette={palette}
          width={askPanelWidth}
          currentPath={sourceId ? `/?source=${sourceId}` : viewParam ? `/?view=${viewParam}` : "/"}
          sourcePath={selectedSource ? `./library/${selectedSource.meta.folder ? selectedSource.meta.folder + "/" : ""}${selectedSource.meta.id}` : undefined}
          sourceId={selectedSource?.meta.id}
          sourceTitle={selectedSource?.meta.title}
          onAgentComplete={async () => {
            // Reload current source when agent finishes (in case it modified files)
            if (selectedSource) {
              try {
                const res = await fetch(`/api/sources/${selectedSource.meta.id}`);
                const data = await res.json();
                if (data.success && data.source) {
                  setSelectedSource(data.source);
                }
              } catch (e) {
                console.error("Failed to reload source after agent completion:", e);
              }
            }
            // Also refresh the library sidebar
            loadSources();
          }}
        />
      </div>

      {/* Selection Popover for adding context - only when viewing a source */}
      {selectedSource && (
        <SelectionPopover
          containerRef={mainContentRef as React.RefObject<HTMLElement>}
          sourceTitle={selectedSource.meta.title}
          palette={palette}
        />
      )}

      <ContextMenu
        menu={contextMenu}
        onCopyUrl={handleCopyUrl}
        onDeleteSource={onDeleteSource}
        onRenameFolder={onStartRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />
    </div>
  );
}
