"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  FolderPlus,
  Rss,
  FileText,
  FileImage,
} from "lucide-react";
import { Source, TreeNode, WorkspaceDocument } from "@/lib/types";
import { theme } from "@/lib/theme";
import { TreeItem } from "@/components/TreeItem";

export interface SidebarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isLibraryOpen: boolean;
  onToggleLibrary: () => void;
  libraryPath: string;
  selectedSource: Source | null;
  currentView: "dashboard" | "foryou";
  onNavigateToDashboard: () => void;
  onNavigateToForYou: () => void;
  onNavigateToSource: (sourceId: string) => void;
  // Tree data
  treeNodes: TreeNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  // Context menu
  onContextMenu: (e: React.MouseEvent, sourceId: string, sourceUrl?: string) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderPath: string, folderName: string) => void;
  // Drag and drop
  dragOverFolder: string | null;
  onDragStart: (e: React.DragEvent, sourceId: string) => void;
  onDragOver: (e: React.DragEvent, folderPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderPath: string) => void;
  onDragEnd: () => void;
  // Folder creation
  isCreatingFolder: boolean;
  newFolderParent: string;
  newFolderName: string;
  onStartCreateFolder: (parentPath: string) => void;
  onFolderNameChange: (name: string) => void;
  onCreateFolder: () => void;
  onCancelCreate: () => void;
  // Folder renaming
  renamingFolder: string | null;
  renameFolderValue: string;
  onRenameFolderChange: (value: string) => void;
  onRenameFolder: () => void;
  onCancelRename: () => void;
  // Styling
  palette: Record<number, string>;
  // Empty state
  isEmpty: boolean;
  // Width (for resizable)
  width?: number;
  // Workspace
  workspaceDocuments?: WorkspaceDocument[];
  isWorkspaceOpen?: boolean;
  onToggleWorkspace?: () => void;
  selectedDocumentId?: string | null;
  onNavigateToDocument?: (docId: string) => void;
}

export function Sidebar({
  isSidebarOpen,
  onToggleSidebar,
  isLibraryOpen,
  onToggleLibrary,
  libraryPath,
  selectedSource,
  currentView,
  onNavigateToDashboard,
  onNavigateToForYou,
  onNavigateToSource,
  treeNodes,
  expandedFolders,
  onToggleFolder,
  onContextMenu,
  onFolderContextMenu,
  dragOverFolder,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isCreatingFolder,
  newFolderParent,
  newFolderName,
  onStartCreateFolder,
  onFolderNameChange,
  onCreateFolder,
  onCancelCreate,
  renamingFolder,
  renameFolderValue,
  onRenameFolderChange,
  onRenameFolder,
  onCancelRename,
  palette,
  isEmpty,
  width = 256,
  workspaceDocuments = [],
  isWorkspaceOpen = true,
  onToggleWorkspace,
  selectedDocumentId,
  onNavigateToDocument,
}: SidebarProps) {
  return (
    <aside
      className="flex-shrink-0 border-r flex flex-col"
      style={{
        borderColor: theme.border,
        width: isSidebarOpen ? width : 48,
      }}
    >
      {/* Sidebar Toggle */}
      <div className="px-3 py-2 flex items-center justify-end">
        <button
          onClick={onToggleSidebar}
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
            onClick={onNavigateToDashboard}
            className="mx-2 px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors text-left rounded-lg"
            style={{
              backgroundColor: !selectedSource && currentView === "dashboard" ? `${palette[500]}15` : undefined,
            }}
          >
            <LayoutDashboard
              className="w-4 h-4"
              style={{ color: !selectedSource && currentView === "dashboard" ? palette[500] : theme.textMuted }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: !selectedSource && currentView === "dashboard" ? palette[600] : theme.text }}
            >
              Dashboard
            </span>
          </button>

          {/* For You Entry */}
          <button
            onClick={onNavigateToForYou}
            className="mx-2 px-3 py-2 flex items-center gap-2 hover:bg-black/5 transition-colors text-left rounded-lg"
            style={{
              backgroundColor: !selectedSource && currentView === "foryou" ? `${palette[500]}15` : undefined,
            }}
          >
            <Rss
              className="w-4 h-4"
              style={{ color: !selectedSource && currentView === "foryou" ? palette[500] : theme.textMuted }}
            />
            <span
              className="text-sm font-medium"
              style={{ color: !selectedSource && currentView === "foryou" ? palette[600] : theme.text }}
            >
              For You
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
              onDragOver={(e) => onDragOver(e, "")}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, "")}
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left cursor-pointer"
              style={{
                backgroundColor: dragOverFolder === "" ? `${palette[500]}20` : undefined,
              }}
            >
              <div
                onClick={onToggleLibrary}
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
                  onStartCreateFolder("");
                }}
                className="p-1 rounded hover:bg-black/10 transition-colors flex-shrink-0"
                title="New folder"
              >
                <FolderPlus className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
              </button>
            </div>

            {/* Folder Creation Input at root level */}
            {isCreatingFolder && newFolderParent === "" && isLibraryOpen && (
              <div className="ml-6 mr-3 mb-1">
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

            {/* Tree View */}
            {isLibraryOpen && (
              <div>
                {treeNodes.map((node) => (
                  <TreeItem
                    key={node.path}
                    node={node}
                    depth={1}
                    selectedSourceId={selectedSource?.meta.id}
                    expandedFolders={expandedFolders}
                    dragOverFolder={dragOverFolder}
                    onToggleFolder={onToggleFolder}
                    onSelectSource={onNavigateToSource}
                    onContextMenu={onContextMenu}
                    onFolderContextMenu={onFolderContextMenu}
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
                    renamingFolder={renamingFolder}
                    renameFolderValue={renameFolderValue}
                    onRenameFolderChange={onRenameFolderChange}
                    onRenameFolder={onRenameFolder}
                    onCancelRename={onCancelRename}
                    palette={palette}
                    theme={theme}
                  />
                ))}
                {isEmpty && (
                  <div className="px-3 py-2 text-sm" style={{ color: theme.textLight }}>
                    No sources yet
                  </div>
                )}
                {/* Drop zone for moving items back to root - fills remaining space */}
                <div
                  onDragOver={(e) => onDragOver(e, "")}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, "")}
                  className="min-h-[50px] transition-colors"
                  style={{
                    backgroundColor: dragOverFolder === "" ? `${palette[500]}10` : undefined,
                  }}
                />
              </div>
            )}

            {/* Workspace Section */}
            <div className="px-3 py-1 mt-2">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.textMuted }}>
                Workspace
              </span>
            </div>

            <div
              className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left cursor-pointer"
              onClick={onToggleWorkspace}
            >
              {isWorkspaceOpen ? (
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
              ) : (
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
              )}
              {isWorkspaceOpen ? (
                <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
              ) : (
                <Folder className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
              )}
              <span className="text-sm truncate">workspace</span>
            </div>

            {isWorkspaceOpen && (
              <div className="ml-4">
                {workspaceDocuments.length === 0 ? (
                  <div className="px-3 py-2 text-sm" style={{ color: theme.textLight }}>
                    No documents yet
                  </div>
                ) : (
                  workspaceDocuments.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => onNavigateToDocument?.(doc.id)}
                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left"
                      style={{
                        backgroundColor: selectedDocumentId === doc.id ? `${palette[500]}15` : undefined,
                      }}
                    >
                      {doc.output.endsWith(".pdf") ? (
                        <FileImage className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
                      ) : (
                        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
                      )}
                      <span
                        className="text-sm truncate"
                        style={{ color: selectedDocumentId === doc.id ? palette[600] : theme.text }}
                      >
                        {doc.title}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
