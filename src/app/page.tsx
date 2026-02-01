"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Eye, SkipForward, Target } from "lucide-react";
import { Source, ActionType, ACTION_CONFIG } from "@/lib/types";
import { theme } from "@/lib/theme";
import { SourceView } from "@/components/SourceView";
import { Dashboard } from "@/components/Dashboard";
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

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const sourceId = searchParams.get("source");

  // Core state
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"digest" | "critique">("digest");

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

  // Load source from URL param
  useEffect(() => {
    if (sourceId) {
      handleSelectSource(sourceId);
    } else {
      setSelectedSource(null);
    }
  }, [sourceId, handleSelectSource]);

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
      />

      <div className="flex-1 flex min-h-0">
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
        />

        <main className="flex-1 flex flex-col min-w-0">
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
