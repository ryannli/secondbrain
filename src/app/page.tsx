"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, Eye, SkipForward, Target } from "lucide-react";
import { SourceSummary, ActionType, ACTION_CONFIG } from "@/lib/types";
import { theme } from "@/lib/theme";
import { EntryView } from "@/components/EntryView";
import { Dashboard } from "@/components/Dashboard";
import { FeedSection } from "@/components/FeedSection";
import { Header } from "@/components/Header";
import { SettingsModal } from "@/components/SettingsModal";
import { ContextMenu } from "@/components/ContextMenu";
import { Sidebar } from "@/components/Sidebar";
import { useSettings } from "@/hooks/useSettings";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useSourceActions } from "@/hooks/useSourceActions";
import { useFeed } from "@/hooks/useFeed";
import { useEntryCollection } from "@/hooks/useEntryCollection";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useResizable } from "@/hooks/useResizable";
import { useSelectedEntry } from "@/hooks/useSelectedEntry";
import { CoLearningPanel, useCoLearning } from "@/components/CoLearningPanel";
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
  const docId = searchParams.get("doc");
  const viewParam = searchParams.get("view");

  // Core state
  const entry = useSelectedEntry();
  const [error, setError] = useState<string | null>(null);
  const [isCoLearningOpen, setIsCoLearningOpen] = useLocalStorage("agent-panel-open", false);
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage("sidebar-open", true);
  const mainContentRef = React.useRef<HTMLDivElement>(null);
  const { addContext } = useCoLearning();

  const sidebarResize = useResizable({
    initialWidth: 256,
    minWidth: 200,
    maxWidth: 400,
    storageKey: "sidebarWidth",
    computeWidth: (e) => e.clientX,
  });

  const askPanelResize = useResizable({
    initialWidth: 384,
    minWidth: 320,
    maxWidth: 600,
    storageKey: "askPanelWidth",
    computeWidth: (e) => window.innerWidth - e.clientX,
  });

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
    themeMode,
    saveTheme,
    rootPath,
    libraryPath,
    debugLoadingMode,
    setDebugLoadingMode,
    palette,
    feedSources,
    saveFeedSources,
    feedInterests,
    saveFeedInterests,
  } = useSettings();

  // Entry collections (unified hooks for Library and Workspace)
  const library = useEntryCollection({ type: "library", setError });
  const workspace = useEntryCollection({ type: "workspace", setError });

  // Feed
  const feed = useFeed();

  // Context menu
  const {
    contextMenu,
    handleEntryContextMenu,
    handleFolderContextMenu,
    closeContextMenu,
  } = useContextMenu();

  const upsertLibrarySummary = useCallback((summary: SourceSummary, options?: { prepend?: boolean }) => {
    library.setEntries((prev) => {
      const existingIndex = prev.findIndex((entry) => entry.id === summary.meta.id);
      const updatedEntry = {
        id: summary.meta.id,
        name: summary.meta.title,
        folder: summary.meta.folder,
        createdAt: summary.meta.createdAt,
        data: summary,
      };
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = updatedEntry;
        return next;
      }
      return options?.prepend ? [updatedEntry, ...prev] : [...prev, updatedEntry];
    });
  }, [library.setEntries]);

  const removeLibrarySummary = useCallback((id: string) => {
    library.setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, [library.setEntries]);

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
    handleRating,
    reanalyzingId,
    navigateToSource,
    navigateToDashboard,
  } = useSourceActions({
    onUpsertSourceSummary: upsertLibrarySummary,
    onRemoveSourceSummary: removeLibrarySummary,
    selectedSource: entry.source,
    setSelectedSource: entry.setSource,
    setError,
  });

  // Navigate to document
  const navigateToDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/workspace/${docId}`);
      const data = await res.json();
      if (data.success && data.document) {
        entry.setDocument(data.document);
        router.push(`/?doc=${docId}`);
      }
    } catch (err) {
      console.error("Failed to load document:", err);
    }
  };

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
    fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.source) {
          upsertLibrarySummary({
            meta: data.source.meta,
            score: data.source.analysis?.triage.score,
            reason: data.source.analysis?.triage.reason,
            action: data.source.analysis?.triage.action,
          }, { prepend: true });
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
      entry.setSource(null);
    }
  }, [sourceId, handleSelectSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load document from URL param
  useEffect(() => {
    if (docId) {
      fetch(`/api/workspace/${docId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.document) {
            entry.setDocument(data.document);
          }
        })
        .catch((err) => console.error("Failed to load document:", err));
    } else {
      entry.setDocument(null);
    }
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand folder when viewing an entry (like VS Code "Reveal in Explorer")
  // Only run when the folder path changes, not on every render
  const expandFolderPath = useCallback((folderPath: string, setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      const parts = folderPath.split("/");
      let path = "";
      for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        next.add(path);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (entry.source?.meta.folder) {
      expandFolderPath(entry.source.meta.folder, library.setExpandedFolders);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.source?.meta.folder]);

  useEffect(() => {
    if (entry.document?.meta.folder) {
      expandFolderPath(entry.document.meta.folder, workspace.setExpandedFolders);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.document?.meta.folder]);

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
  const onDeleteEntry = async () => {
    if (contextMenu?.type !== "entry" || !contextMenu.entryId) return;

    const entryId = contextMenu.entryId;
    const entryType = contextMenu.entryType;
    closeContextMenu();

    if (entryType === "document") {
      // Delete workspace document
      try {
        const res = await fetch(`/api/workspace/${entryId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          if (entry.document?.meta.id === entryId) {
            entry.setDocument(null);
            router.push("/");
          }
          workspace.refresh();
        }
      } catch (err) {
        console.error("Failed to delete document:", err);
      }
    } else {
      // Delete library source
      await handleDeleteSource(entryId);
    }
  };

  const onDeleteFolder = async () => {
    if (contextMenu?.type === "folder" && contextMenu.folderPath) {
      const folderPath = contextMenu.folderPath;
      const isWorkspace = contextMenu.folderSection === "workspace";
      closeContextMenu();
      if (isWorkspace) {
        await workspace.deleteFolder(folderPath);
      } else {
        await library.deleteFolder(folderPath);
      }
    }
  };

  const onStartRenameFolder = () => {
    if (contextMenu?.type === "folder" && contextMenu.folderPath && contextMenu.folderName) {
      const isWorkspace = contextMenu.folderSection === "workspace";
      if (isWorkspace) {
        workspace.startRenameFolder(contextMenu.folderPath, contextMenu.folderName);
      } else {
        library.startRenameFolder(contextMenu.folderPath, contextMenu.folderName);
      }
      closeContextMenu();
    }
  };

  // Workspace folder context menu handler
  const handleWorkspaceFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    handleFolderContextMenu(e, folderPath, folderName, "workspace");
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
        themeMode={themeMode}
        onThemeChange={saveTheme}
        rootPath={rootPath}
        debugLoadingMode={debugLoadingMode}
        onDebugModeChange={setDebugLoadingMode}
        palette={palette}
        feedSources={feedSources}
        onFeedSourcesChange={saveFeedSources}
        feedInterests={feedInterests}
        onFeedInterestsChange={saveFeedInterests}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedSource={entry.source}
          currentView={currentView}
          onNavigateToDashboard={() => { navigateToDashboard(); navigateToView("dashboard"); }}
          onNavigateToForYou={() => { navigateToDashboard(); navigateToView("foryou"); }}
          onEntryContextMenu={handleEntryContextMenu}
          palette={palette}
          width={sidebarResize.width}
          sections={[
            {
              label: "Library",
              rootLabel: libraryPath.split("/").pop() || "library",
              isOpen: library.isOpen,
              onToggle: library.toggle,
              isEmpty: library.isEmpty,
              emptyMessage: "No sources yet",
              treeNodes: library.treeNodes,
              expandedFolders: library.expandedFolders,
              onToggleFolder: library.toggleFolder,
              selectedSourceId: entry.source?.meta.id,
              onSelectSource: (id) => { entry.setDocument(null); navigateToSource(id); },
              onFolderContextMenu: handleFolderContextMenu,
              dragDrop: library.dragDrop,
              folderManagement: library.folderManagement,
            },
            {
              label: "Workspace",
              rootLabel: "workspace",
              isOpen: workspace.isOpen,
              onToggle: workspace.toggle,
              isEmpty: workspace.isEmpty,
              emptyMessage: "No documents yet",
              treeNodes: workspace.treeNodes,
              expandedFolders: workspace.expandedFolders,
              onToggleFolder: workspace.toggleFolder,
              selectedDocumentId: entry.document?.meta.id,
              onSelectDocument: navigateToDocument,
              onFolderContextMenu: handleWorkspaceFolderContextMenu,
              dragDrop: workspace.dragDrop,
              folderManagement: workspace.folderManagement,
            },
          ]}
        />

        {/* Resize handle between sidebar and content */}
        {isSidebarOpen && (
          <ResizeHandle
            onMouseDown={sidebarResize.startResize}
            isResizing={sidebarResize.isResizing}
          />
        )}

        <main className="flex-1 flex flex-col min-w-0" ref={mainContentRef}>
          <div className="flex-1 p-6 overflow-y-auto">
            {entry.document ? (
              <EntryView
                entry={{
                  id: entry.document.meta.id,
                  title: entry.document.meta.title,
                  content: entry.document.content,
                  type: entry.document.meta.output.endsWith(".pdf") ? "document" : "text",
                }}
                onSave={async (title, content) => {
                  const res = await fetch(`/api/workspace/${entry.document!.meta.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content }),
                  });
                  const data = await res.json();
                  if (data.success && data.document) {
                    entry.setDocument(data.document);
                    workspace.refresh();
                  }
                }}
                onClose={() => { entry.setDocument(null); router.push("/"); }}
                palette={palette}
                theme={theme}
              />
            ) : entry.source ? (
              <EntryView
                entry={{
                  id: entry.source.meta.id,
                  title: entry.source.meta.title,
                  content: entry.source.content,
                  sourceUrl: entry.source.meta.sourceUrl,
                  createdAt: entry.source.meta.createdAt,
                  type: entry.source.meta.type,
                  processingStatus: entry.source.meta.processingStatus,
                  analysisError: entry.source.meta.analysisError,
                  analysis: entry.source.analysis,
                  saved: entry.source.meta.saved,
                }}
                onSave={async (title, content) => {
                  const res = await fetch(`/api/sources/${entry.source!.meta.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    const reloadRes = await fetch(`/api/sources/${entry.source!.meta.id}`);
                    const reloadData = await reloadRes.json();
                    if (reloadData.success && reloadData.source) {
                      entry.setSource(reloadData.source);
                      library.refresh();
                    }
                  }
                }}
                onToggleSaved={async (saved) => {
                  const res = await fetch(`/api/sources/${entry.source!.meta.id}/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ saved }),
                  });
                  const data = await res.json();
                  if (data.success && data.source) {
                    entry.setSource(data.source);
                    library.refresh();
                  }
                }}
                onClose={() => entry.setSource(null)}
                onReanalyze={() => handleReanalyze(entry.source!.meta.id)}
                onReaction={(type, itemId, reaction) => handleReaction(entry.source!.meta.id, type, itemId, reaction)}
                onRating={(rating) => handleRating(entry.source!.meta.id, rating)}
                onNavigateToSource={navigateToSource}
                isReanalyzing={reanalyzingId === entry.source.meta.id}
                originalFileUrl={`/api/sources/${entry.source.meta.id}/original`}
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
                  signals={feed.signals}
                  loading={feed.loading}
                  error={feed.error}
                  onCapture={handleCaptureUrl}
                  onDismiss={feed.dismissItem}
                  onRefresh={feed.refreshFeed}
                  onAddContext={(text, title) => {
                    addContext(text, title);
                    setIsCoLearningOpen(true);
                  }}
                  palette={palette}
                  theme={theme}
                />
              </div>
            ) : (
              <Dashboard
                sources={library.sourceSummaries}
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
            onMouseDown={askPanelResize.startResize}
            isResizing={askPanelResize.isResizing}
          />
        )}

        {/* Ask Panel */}
        <CoLearningPanel
          isOpen={isCoLearningOpen}
          onToggle={() => setIsCoLearningOpen(!isCoLearningOpen)}
          palette={palette}
          width={askPanelResize.width}
          currentPath={sourceId ? `/?source=${sourceId}` : docId ? `/?doc=${docId}` : viewParam ? `/?view=${viewParam}` : "/"}
          sourcePath={entry.source ? `./library/${entry.source.meta.folder ? entry.source.meta.folder + "/" : ""}${entry.source.meta.id}` : undefined}
          sourceId={entry.source?.meta.id}
          sourceTitle={entry.source?.meta.title}
          documentPath={entry.document ? `./workspace/${entry.document.meta.folder ? entry.document.meta.folder + "/" : ""}${entry.document.meta.id}` : undefined}
          documentId={entry.document?.meta.id}
          documentTitle={entry.document?.meta.title}
          onAgentComplete={async () => {
            // Reload whatever entry is currently selected
            await entry.refresh();
            library.refresh();
            workspace.refresh();
          }}
        />
      </div>

      {/* Selection Popover for adding context - only when viewing a source */}
      {entry.source && (
        <SelectionPopover
          containerRef={mainContentRef as React.RefObject<HTMLElement>}
          sourceTitle={entry.source.meta.title}
          palette={palette}
        />
      )}

      <ContextMenu
        menu={contextMenu}
        onDeleteEntry={onDeleteEntry}
        onRenameFolder={onStartRenameFolder}
        onDeleteFolder={onDeleteFolder}
      />
    </div>
  );
}
