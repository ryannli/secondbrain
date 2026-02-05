"use client";

import React from "react";
import {
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Rss,
} from "lucide-react";
import { Source, TreeNode } from "@/lib/types";
import { theme } from "@/lib/theme";
import { SectionTree } from "@/components/SectionTree";

// Folder management interface - exported for reuse
export interface FolderManagementProps {
  isCreatingFolder: boolean;
  newFolderParent: string;
  newFolderName: string;
  onStartCreateFolder: (parentPath: string) => void;
  onFolderNameChange: (name: string) => void;
  onCreateFolder: () => void;
  onCancelCreate: () => void;
  renamingFolder: string | null;
  renameFolderValue: string;
  onRenameFolderChange: (value: string) => void;
  onRenameFolder: () => void;
  onCancelRename: () => void;
}

// Drag & drop handlers - exported for reuse
export interface DragDropProps {
  dragOverFolder: string | null;
  onDragStart: (e: React.DragEvent, entryId: string) => void;
  onDragOver: (e: React.DragEvent, folderPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderPath: string) => void;
  onDragEnd: () => void;
}

// Section configuration
export interface SectionConfig {
  label: string;
  rootLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  treeNodes: TreeNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  selectedSourceId?: string;
  selectedDocumentId?: string;
  onSelectSource?: (sourceId: string) => void;
  onSelectDocument?: (docId: string) => void;
  onFolderContextMenu: (e: React.MouseEvent, folderPath: string, folderName: string) => void;
  dragDrop: DragDropProps;
  folderManagement: FolderManagementProps;
}

export interface SidebarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedSource: Source | null;
  currentView: "dashboard" | "foryou";
  onNavigateToDashboard: () => void;
  onNavigateToForYou: () => void;
  // Sections (Library, Workspace, etc.)
  sections: SectionConfig[];
  // Context menu for entries (shared)
  onEntryContextMenu: (e: React.MouseEvent, entryId: string, entryUrl?: string, entryType?: "source" | "document") => void;
  // Styling
  palette: Record<number, string>;
  // Width (for resizable)
  width?: number;
}

export function Sidebar({
  isSidebarOpen,
  onToggleSidebar,
  selectedSource,
  currentView,
  onNavigateToDashboard,
  onNavigateToForYou,
  sections,
  onEntryContextMenu,
  palette,
  width = 256,
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
            {sections.map((section, index) => (
              <div key={section.label} className={index > 0 ? "mt-2" : ""}>
                <SectionTree
                  label={section.label}
                  rootLabel={section.rootLabel}
                  isOpen={section.isOpen}
                  onToggle={section.onToggle}
                  isEmpty={section.isEmpty}
                  emptyMessage={section.emptyMessage}
                  treeNodes={section.treeNodes}
                  expandedFolders={section.expandedFolders}
                  onToggleFolder={section.onToggleFolder}
                  selectedSourceId={section.selectedSourceId}
                  selectedDocumentId={section.selectedDocumentId}
                  onSelectSource={section.onSelectSource}
                  onSelectDocument={section.onSelectDocument}
                  onEntryContextMenu={onEntryContextMenu}
                  onFolderContextMenu={section.onFolderContextMenu}
                  dragDrop={section.dragDrop}
                  folderManagement={section.folderManagement}
                  palette={palette}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
