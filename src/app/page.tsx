"use client";

import React, { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BookOpen, Eye, SkipForward, Target } from "lucide-react";
import { SourceSummary, ActionType, ACTION_CONFIG, UserHighlight } from "@/lib/types";
import { theme } from "@/lib/theme";
import { EntryView } from "@/components/EntryView";
import { Dashboard } from "@/components/Dashboard";
import { FeedSection } from "@/components/FeedSection";
import { HistorySection } from "@/components/HistorySection";
import { Header } from "@/components/Header";
import { SettingsModal } from "@/components/SettingsModal";
import { AgentModeGate } from "@/components/AgentModeGate";
import { OnboardingCards } from "@/components/OnboardingCards";
import { ContextMenu } from "@/components/ContextMenu";
import { Sidebar } from "@/components/Sidebar";
import { useSettings } from "@/hooks/useSettings";
import { useContextMenu } from "@/hooks/useContextMenu";
import { useSourceActions } from "@/hooks/useSourceActions";
import { useFeed } from "@/hooks/useFeed";
import { useHistory } from "@/hooks/useHistory";
import { useEntryCollection } from "@/hooks/useEntryCollection";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useResizable } from "@/hooks/useResizable";
import { useSelectedEntry } from "@/hooks/useSelectedEntry";
import { CoLearningPanel, useCoLearning } from "@/components/CoLearningPanel";
import { SelectionPopover } from "@/components/SelectionPopover";
import { ResizeHandle } from "@/components/ResizeHandle";
import { useReadingTimer } from "@/hooks/useReadingTimer";
import { TrackingProvider } from "@/components/TrackingProvider";
import { STARTER_PACK, STARTER_PACK_STAGGER_SECONDS } from "@/lib/config";

// Shown when an agent-maintained profile page has no content yet, so a
// first visit explains itself instead of rendering a blank document.
const PROFILE_EMPTY_TEMPLATES: Record<string, string> = {
  Memory: `*This page is maintained by your agent. As you read, rate sources, and chat, durable facts about your interests and knowledge get recorded here — so future analysis and feeds know what you already know.*

*Nothing has been recorded yet. You can also edit this file directly; it lives in your data folder as \`MEMORY.md\`.*`,
  User: `*Your reading preferences, in your own words. The agent reads this before analyzing content for you — edit it any time; it lives in your data folder as \`USER.md\`.*`,
};

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
  const profileParam = searchParams.get("profile");

  // Core state
  const entry = useSelectedEntry();
  const [error, setError] = useState<string | null>(null);
  const [isCoLearningOpen, setIsCoLearningOpen] = useLocalStorage("agent-panel-open", false);
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage("sidebar-open", true);
  const mainContentRef = React.useRef<HTMLDivElement>(null);
  const { addContext, prefillInput } = useCoLearning();
  const [profileDoc, setProfileDoc] = useState<{ name: string; content: string } | null>(null);
  const [highlights, setHighlights] = useState<UserHighlight[]>([]);
  const readingTimer = useReadingTimer(entry.source?.meta.id ?? null);

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
  const currentView: "dashboard" | "foryou" | "history" =
    viewParam === "foryou" ? "foryou" : viewParam === "history" ? "history" : "dashboard";

  // Navigation helpers
  const navigateToView = (view: "dashboard" | "foryou" | "history") => {
    if (view === "dashboard") {
      router.push("/");
    } else {
      router.push(`/?view=${view}`);
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
    rootPathSource,
    rootPathLocked,
    saveRootPath,
    libraryPath,
    palette,
    rssFeeds,
    saveRssFeeds,
    searchConfigured,
    extensionPath,
    searchSources,
    saveSearchSources,
    feedInterests,
    saveFeedInterests,
    agentModeEnabled,
    saveAgentModeEnabled,
    onboardedAt,
    saveOnboarded,
    agentProvider,
    saveAgentProvider,
    agentModels,
    saveAgentModel,
    agentStatuses,
    agentStatusLoading,
    settingsLoading,
    loadAgentStatus,
    fontSize,
    saveFontSize,
    headingStyle,
    saveHeadingStyle,
  } = useSettings();

  // Entry collections (unified hooks for Library and Notebook)
  const library = useEntryCollection({ type: "library", setError });
  const notebook = useEntryCollection({ type: "notebook", setError });

  // Feed
  const feed = useFeed();

  // History
  const history = useHistory();

  const selectedAgentStatus = agentStatuses?.[agentProvider];
  const canEnterWorkspace = agentModeEnabled && selectedAgentStatus?.state === "ready";
  const isOpeningWorkspace = settingsLoading || (agentModeEnabled && agentStatusLoading && !selectedAgentStatus);

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
    handleAddHighlight,
    handleRemoveHighlight,
    reanalyzingIds,
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
      const res = await fetch(`/api/notebook/${docId}`);
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

  // Load history when viewing History
  useEffect(() => {
    if (!sourceId && currentView === "history") {
      history.loadHistory();
    }
  }, [sourceId, currentView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capture URL from feed
  const captureUrl = useCallback((url: string) => {
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
  }, [upsertLibrarySummary, setError]);

  const handleCaptureUrl = (url: string) => {
    setCaptureInput(url);
    captureUrl(url);
  };

  // Capture the starter pack, staggered so the machine isn't asked to run
  // several analysis pipelines at once. Lives here (not in Dashboard) so
  // navigating away doesn't cancel the remaining captures.
  const captureStarterPack = useCallback(() => {
    STARTER_PACK.forEach((item, i) => {
      setTimeout(() => captureUrl(item.url), i * STARTER_PACK_STAGGER_SECONDS * 1000);
    });
  }, [captureUrl]);

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
      fetch(`/api/notebook/${docId}`)
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

  // Load highlights for the current entry (source or document)
  const currentEntryId = entry.source?.meta.id ?? entry.document?.meta.id ?? null;
  useEffect(() => {
    if (currentEntryId) {
      fetch(`/api/entries/${currentEntryId}/highlight`)
        .then((res) => res.ok ? res.json() : null)
        .catch(() => null)
        .then((data) => setHighlights(data?.highlights ?? []));
    } else {
      setHighlights([]);
    }
  }, [currentEntryId]);

  // Load profile doc from URL param
  useEffect(() => {
    if (profileParam && (profileParam === "User" || profileParam === "Memory")) {
      fetch(`/api/profile/${profileParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setProfileDoc({ name: data.name === "USER" ? "User" : "Memory", content: data.content });
          }
        })
        .catch((err) => console.error("Failed to load profile:", err));
    } else {
      setProfileDoc(null);
    }
  }, [profileParam]);

  // Navigate to profile doc
  const navigateToProfile = (name: string | null) => {
    if (name) {
      entry.setSource(null);
      entry.setDocument(null);
      router.push(`/?profile=${name}`);
    } else {
      router.push("/");
    }
  };

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
      expandFolderPath(entry.document.meta.folder, notebook.setExpandedFolders);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.document?.meta.folder]);

  // Score color helper
  const getScoreColor = useMemo(() => (score: number) => {
    if (score >= 80) return palette[600];
    if (score >= 60) return palette[500];
    if (score >= 40) return "#eab308";
    if (score >= 20) return "#f97316";
    return "#ef4444";
  }, [palette]);

  // Action UI config
  const actionUI = useMemo<Record<ActionType, { icon: React.ReactNode; color: string }>>(() => ({
    must_read: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[600] },
    worth_reading: { icon: <BookOpen className="w-3.5 h-3.5" />, color: palette[500] },
    skim: { icon: <Eye className="w-3.5 h-3.5" />, color: "#eab308" },
    summary_only: { icon: <Eye className="w-3.5 h-3.5" />, color: "#f97316" },
    skip: { icon: <SkipForward className="w-3.5 h-3.5" />, color: "#ef4444" },
  }), [palette]);

  const getActionConfig = useMemo(() => (action: ActionType) => {
    const config = ACTION_CONFIG[action];
    const ui = actionUI[action];
    return {
      icon: ui?.icon ?? <Target className="w-3.5 h-3.5" />,
      label: config?.label ?? action,
      description: config?.description ?? "",
      color: ui?.color ?? theme.textMuted,
    };
  }, [actionUI]);

  // Context menu action handlers
  const onDeleteEntry = async () => {
    if (contextMenu?.type !== "entry" || !contextMenu.entryId) return;

    const entryId = contextMenu.entryId;
    const entryType = contextMenu.entryType;
    closeContextMenu();

    if (entryType === "document") {
      // Delete notebook document
      try {
        const res = await fetch(`/api/notebook/${entryId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          if (entry.document?.meta.id === entryId) {
            entry.setDocument(null);
            router.push("/");
          }
          notebook.refresh();
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
      const isNotebook = contextMenu.folderSection === "notebook";
      closeContextMenu();
      if (isNotebook) {
        await notebook.deleteFolder(folderPath);
      } else {
        await library.deleteFolder(folderPath);
      }
    }
  };

  const onStartRenameFolder = () => {
    if (contextMenu?.type === "folder" && contextMenu.folderPath && contextMenu.folderName) {
      const isNotebook = contextMenu.folderSection === "notebook";
      if (isNotebook) {
        notebook.startRenameFolder(contextMenu.folderPath, contextMenu.folderName);
      } else {
        library.startRenameFolder(contextMenu.folderPath, contextMenu.folderName);
      }
      closeContextMenu();
    }
  };

  // Notebook folder context menu handler
  const handleNotebookFolderContextMenu = (e: React.MouseEvent, folderPath: string, folderName: string) => {
    handleFolderContextMenu(e, folderPath, folderName, "notebook");
  };

  if (isOpeningWorkspace) {
    return <OpeningWorkspace palette={palette} fontFamily={fontFamily} />;
  }

  if (!canEnterWorkspace) {
    return (
      <AgentModeGate
        palette={palette}
        agentProvider={agentProvider}
        onAgentProviderChange={saveAgentProvider}
        agentStatuses={agentStatuses}
        agentStatusLoading={agentStatusLoading}
        onRefreshAgentStatus={loadAgentStatus}
        onEnableAgentMode={() => saveAgentModeEnabled(true)}
      />
    );
  }

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: `var(--font-${fontFamily})` }}
    >
      <TrackingProvider />
      <Header
        palette={palette}
        onOpenSettings={() => setIsSettingsOpen(true)}
        agentProvider={agentProvider}
        agentStatus={agentStatuses?.[agentProvider]}
        agentStatusLoading={agentStatusLoading}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontFamily={fontFamily}
        onFontChange={saveFont}
        themeMode={themeMode}
        onThemeChange={saveTheme}
        rootPath={rootPath}
        rootPathSource={rootPathSource}
        rootPathLocked={rootPathLocked}
        onRootPathChange={saveRootPath}
        palette={palette}
        rssFeeds={rssFeeds}
        onRssFeedsChange={saveRssFeeds}
        searchSources={searchSources}
        onSearchSourcesChange={saveSearchSources}
        searchConfigured={searchConfigured}
        feedInterests={feedInterests}
        onFeedInterestsChange={saveFeedInterests}
        agentProvider={agentProvider}
        onAgentProviderChange={saveAgentProvider}
        agentModels={agentModels}
        onAgentModelChange={saveAgentModel}
        agentStatuses={agentStatuses}
        agentStatusLoading={agentStatusLoading}
        onRefreshAgentStatus={loadAgentStatus}
        fontSize={fontSize}
        onFontSizeChange={saveFontSize}
        headingStyle={headingStyle}
        onHeadingStyleChange={saveHeadingStyle}
      />

      {/* One-time expectation-setting cards after the gate, before the dashboard */}
      {!settingsLoading && !onboardedAt && (
        <OnboardingCards rootPath={rootPath} palette={palette} onComplete={saveOnboarded} />
      )}

      <div className="flex-1 flex min-h-0">
        <Sidebar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          selectedSource={entry.source}
          currentView={currentView}
          onNavigateToDashboard={() => { setProfileDoc(null); navigateToDashboard(); navigateToView("dashboard"); }}
          onNavigateToForYou={() => { setProfileDoc(null); navigateToDashboard(); navigateToView("foryou"); }}
          onNavigateToHistory={() => { setProfileDoc(null); navigateToDashboard(); navigateToView("history"); }}
          selectedProfile={profileParam}
          onSelectProfile={navigateToProfile}
          onEntryContextMenu={handleEntryContextMenu}
          palette={palette}
          width={sidebarResize.width}
          sections={[
            {
              label: "Library",
              hint: "what you capture",
              rootLabel: libraryPath.split("/").pop() || "library",
              isOpen: library.isOpen,
              onToggle: library.toggle,
              isEmpty: library.isEmpty,
              emptyMessage: "No sources yet — paste a link above to start",
              onReveal: () => fetch("/api/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "library" }) }),
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
              label: "Notebook",
              hint: "what you write with your agent",
              rootLabel: "notebook",
              isOpen: notebook.isOpen,
              onToggle: notebook.toggle,
              isEmpty: notebook.isEmpty,
              emptyMessage: "Nothing here yet — ask the Agent to draft a brief from your sources",
              onAdd: () => prefillInput("Draft a brief connecting my recent sources"),
              addTitle: "New note — ask the Agent to draft one",
              onReveal: () => fetch("/api/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "notebook" }) }),
              treeNodes: notebook.treeNodes,
              expandedFolders: notebook.expandedFolders,
              onToggleFolder: notebook.toggleFolder,
              selectedDocumentId: entry.document?.meta.id,
              onSelectDocument: navigateToDocument,
              onFolderContextMenu: handleNotebookFolderContextMenu,
              dragDrop: notebook.dragDrop,
              folderManagement: notebook.folderManagement,
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
            {profileDoc ? (
              <EntryView
                entry={{
                  id: `profile-${profileDoc.name}`,
                  title: profileDoc.name,
                  content: profileDoc.content || PROFILE_EMPTY_TEMPLATES[profileDoc.name] || "",
                  type: "text",
                }}
                onSave={async (_title, content) => {
                  const res = await fetch(`/api/profile/${profileDoc.name}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setProfileDoc({ name: profileDoc.name, content: data.content });
                  }
                }}
                onClose={() => { setProfileDoc(null); router.push("/"); }}
                palette={palette}
                theme={theme}
                fontSize={fontSize}
                headingStyle={headingStyle}

              />
            ) : entry.document ? (
              <EntryView
                entry={{
                  id: entry.document.meta.id,
                  title: entry.document.meta.title,
                  content: entry.document.content,
                  type: entry.document.meta.output.endsWith(".pdf") ? "document" : "text",
                }}
                onSave={async (title, content) => {
                  const res = await fetch(`/api/notebook/${entry.document!.meta.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title, content }),
                  });
                  const data = await res.json();
                  if (data.success && data.document) {
                    entry.setDocument(data.document);
                    notebook.refresh();
                  }
                }}
                onClose={() => { entry.setDocument(null); router.push("/"); }}
                highlights={highlights}
                onRemoveHighlight={(highlightId) => handleRemoveHighlight(entry.document!.meta.id, highlightId, setHighlights)}
                palette={palette}
                theme={theme}
                fontSize={fontSize}
                headingStyle={headingStyle}

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
                  totalReadTimeSeconds: (entry.source.meta.totalReadTimeSeconds ?? 0) + readingTimer.elapsedSeconds,
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
                onMarkUnread={async () => {
                  const res = await fetch(`/api/sources/${entry.source!.meta.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ readStatus: "unread" }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    entry.setSource(null);
                    library.refresh();
                  }
                }}
                onClose={() => entry.setSource(null)}
                onReanalyze={() => handleReanalyze(entry.source!.meta.id)}
                onReaction={(type, itemId, reaction) => handleReaction(entry.source!.meta.id, type, itemId, reaction)}
                onRating={(rating) => handleRating(entry.source!.meta.id, rating)}
                highlights={highlights}
                onRemoveHighlight={(highlightId) => handleRemoveHighlight(entry.source!.meta.id, highlightId, setHighlights)}
                onNavigateToSource={navigateToSource}
                isReanalyzing={reanalyzingIds.has(entry.source.meta.id)}
                originalFileUrl={`/api/sources/${entry.source.meta.id}/original`}
                palette={palette}
                theme={theme}
                getActionConfig={getActionConfig}
                getScoreColor={getScoreColor}
                fontSize={fontSize}
                headingStyle={headingStyle}

              />
            ) : currentView === "history" ? (
              <div className="max-w-2xl mx-auto">
                <HistorySection
                  events={history.events}
                  loading={history.loading}
                  error={history.error}
                  onNavigateToSource={navigateToSource}
                  palette={palette}
                  theme={theme}
                />
              </div>
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
                  insights={feed.insights}
                  loading={feed.loading}
                  error={feed.error}
                  availableDates={feed.availableDates}
                  selectedDate={feed.selectedDate}
                  onSelectDate={feed.loadFeedForDate}
                  onCapture={handleCaptureUrl}
                  onDismiss={feed.dismissItem}
                  onRefresh={feed.refreshFeed}
                  onAddContext={(text, title) => {
                    addContext(text, title);
                    setIsCoLearningOpen(true);
                  }}
                  onMarkBriefingRead={feed.markBriefingRead}
                  onMarkBriefingUnread={feed.markBriefingUnread}
                  onStarBriefing={feed.starBriefingItem}
                  onUnstarBriefing={feed.unstarBriefingItem}
                  starredBriefingTexts={feed.starredBriefingTexts}
                  readBriefingTexts={feed.readBriefingTexts}
                  searchConfigured={searchConfigured}
                  onOpenSettings={() => setIsSettingsOpen(true)}
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
                onStarterPack={captureStarterPack}
                extensionPath={extensionPath}
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
          documentPath={entry.document ? `./notebook/${entry.document.meta.folder ? entry.document.meta.folder + "/" : ""}${entry.document.meta.id}` : undefined}
          documentId={entry.document?.meta.id}
          documentTitle={entry.document?.meta.title}
          onAgentComplete={async () => {
            // Reload whatever entry is currently selected
            await entry.refresh();
            library.refresh();
            notebook.refresh();
          }}
        />
      </div>

      {/* Selection Popover for adding context and highlighting */}
      {(entry.source || entry.document) && (
        <SelectionPopover
          containerRef={mainContentRef as React.RefObject<HTMLElement>}
          sourceTitle={entry.source?.meta.title ?? entry.document?.meta.title}
          palette={palette}
          onHighlight={currentEntryId ? (text) => handleAddHighlight(currentEntryId, text, setHighlights) : undefined}
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

function OpeningWorkspace({
  palette,
  fontFamily,
}: {
  palette: Record<number, string>;
  fontFamily: string;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: theme.bg, color: theme.text, fontFamily: `var(--font-${fontFamily})` }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${palette[500]}14` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: palette[500] }}
          />
        </div>
        <p className="text-sm font-medium">Opening workspace</p>
      </div>
    </div>
  );
}
