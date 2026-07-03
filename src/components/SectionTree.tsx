"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Plus,
  SquareArrowOutUpRight,
} from "lucide-react";
import { TreeNode } from "@/lib/types";
import { TreeItem } from "@/components/TreeItem";
import { TooltipButton } from "@/components/ui";

// Folder management interface
interface FolderManagementProps {
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

// Drag & drop handlers
interface DragDropProps {
  dragOverFolder: string | null;
  onDragStart: (e: React.DragEvent, entryId: string) => void;
  onDragOver: (e: React.DragEvent, folderPath: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderPath: string) => void;
  onDragEnd: () => void;
}

export interface SectionTreeProps {
  // Section info
  label: string;
  hint?: string; // One-line role description shown next to the label
  rootLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  onAdd?: () => void; // Optional "+" action in the section header
  addTitle?: string;
  onReveal?: () => void; // Open the section's real folder in the OS file manager
  // Tree data
  treeNodes: TreeNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  // Selection
  selectedSourceId?: string;
  selectedDocumentId?: string;
  onSelectSource?: (sourceId: string) => void;
  onSelectDocument?: (docId: string) => void;
  // Context menu
  onEntryContextMenu: (e: React.MouseEvent, entryId: string, entryUrl?: string, entryType?: "source" | "document") => void;
  onFolderContextMenu: (e: React.MouseEvent, folderPath: string, folderName: string) => void;
  // Drag & drop
  dragDrop: DragDropProps;
  // Folder management
  folderManagement: FolderManagementProps;
  // Styling
  palette: Record<number, string>;
  theme: {
    textMuted: string;
    textLight?: string;
    border: string;
  };
}

export function SectionTree({
  label,
  hint,
  rootLabel,
  isOpen,
  onToggle,
  isEmpty,
  emptyMessage,
  onAdd,
  addTitle,
  onReveal,
  treeNodes,
  expandedFolders,
  onToggleFolder,
  selectedSourceId,
  selectedDocumentId,
  onSelectSource,
  onSelectDocument,
  onEntryContextMenu,
  onFolderContextMenu,
  dragDrop,
  folderManagement,
  palette,
  theme,
}: SectionTreeProps) {
  return (
    <>
      {/* Section Label */}
      <div className="px-3 py-1 flex items-baseline gap-1.5 min-w-0">
        <span className="text-xs font-medium uppercase tracking-wide flex-shrink-0" style={{ color: theme.textMuted }}>
          {label}
        </span>
        {hint && (
          <span className="text-[10px] truncate" style={{ color: theme.textLight || theme.textMuted }}>
            · {hint}
          </span>
        )}
      </div>

      {/* Section Root - drop target for moving to root */}
      <div
        onDragOver={(e) => dragDrop.onDragOver(e, "")}
        onDragLeave={dragDrop.onDragLeave}
        onDrop={(e) => dragDrop.onDrop(e, "")}
        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-black/5 transition-colors text-left cursor-pointer"
        style={{
          backgroundColor: dragDrop.dragOverFolder === "" ? `${palette[500]}20` : undefined,
        }}
      >
        <div
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0"
          data-track="section.toggle"
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
          ) : (
            <Folder className="w-4 h-4 flex-shrink-0" style={{ color: palette[500] }} />
          )}
          <span className="text-sm truncate" title={rootLabel}>
            {rootLabel}
          </span>
        </div>
        {onAdd && (
          <TooltipButton
            onClick={onAdd}
            tooltip={{ title: addTitle || "New" }}
            className="!p-1 flex-shrink-0"
            data-track="section.add"
          >
            <Plus className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
          </TooltipButton>
        )}
        <TooltipButton
          onClick={() => folderManagement.onStartCreateFolder("")}
          tooltip={{ title: "New folder" }}
          className="!p-1 flex-shrink-0"
          data-track="folder.create"
        >
          <FolderPlus className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
        </TooltipButton>
        {onReveal && (
          <TooltipButton
            onClick={onReveal}
            tooltip={{
              title: "Open on your computer",
              description: "This is a real folder of markdown and JSON — yours to grep, sync, or edit.",
            }}
            className="!p-1 flex-shrink-0"
            data-track="section.reveal"
          >
            <SquareArrowOutUpRight className="w-3.5 h-3.5" style={{ color: theme.textMuted }} />
          </TooltipButton>
        )}
      </div>

      {/* Folder Creation Input at root level */}
      {folderManagement.isCreatingFolder && folderManagement.newFolderParent === "" && isOpen && (
        <div className="ml-6 mr-3 mb-1">
          <input
            type="text"
            value={folderManagement.newFolderName}
            onChange={(e) => folderManagement.onFolderNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") folderManagement.onCreateFolder();
              if (e.key === "Escape") folderManagement.onCancelCreate();
            }}
            onBlur={() => {
              if (!folderManagement.newFolderName.trim()) folderManagement.onCancelCreate();
            }}
            placeholder="Folder name..."
            className="w-full px-2 py-1 text-sm border rounded"
            style={{ borderColor: theme.border }}
            autoFocus
          />
        </div>
      )}

      {/* Tree View */}
      {isOpen && (
        <div>
          {treeNodes.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={1}
              selectedSourceId={selectedSourceId}
              selectedDocumentId={selectedDocumentId}
              expandedFolders={expandedFolders}
              dragOverFolder={dragDrop.dragOverFolder}
              onToggleFolder={onToggleFolder}
              onSelectSource={onSelectSource || (() => {})}
              onSelectDocument={onSelectDocument}
              onEntryContextMenu={onEntryContextMenu}
              onFolderContextMenu={onFolderContextMenu}
              onDragStart={dragDrop.onDragStart}
              onDragOver={dragDrop.onDragOver}
              onDragLeave={dragDrop.onDragLeave}
              onDrop={dragDrop.onDrop}
              onDragEnd={dragDrop.onDragEnd}
              onStartCreateFolder={folderManagement.onStartCreateFolder}
              isCreatingFolder={folderManagement.isCreatingFolder}
              newFolderParent={folderManagement.newFolderParent}
              newFolderName={folderManagement.newFolderName}
              onFolderNameChange={folderManagement.onFolderNameChange}
              onCreateFolder={folderManagement.onCreateFolder}
              onCancelCreate={folderManagement.onCancelCreate}
              renamingFolder={folderManagement.renamingFolder}
              renameFolderValue={folderManagement.renameFolderValue}
              onRenameFolderChange={folderManagement.onRenameFolderChange}
              onRenameFolder={folderManagement.onRenameFolder}
              onCancelRename={folderManagement.onCancelRename}
              palette={palette}
              theme={theme}
            />
          ))}
          {isEmpty && (
            <div className="px-3 py-2 text-sm ml-4" style={{ color: theme.textLight || theme.textMuted }}>
              {emptyMessage}
            </div>
          )}
          {/* Drop zone for moving items back to root - fills remaining space */}
          <div
            onDragOver={(e) => dragDrop.onDragOver(e, "")}
            onDragLeave={dragDrop.onDragLeave}
            onDrop={(e) => dragDrop.onDrop(e, "")}
            className="min-h-[30px] transition-colors"
            style={{
              backgroundColor: dragDrop.dragOverFolder === "" ? `${palette[500]}10` : undefined,
            }}
          />
        </div>
      )}
    </>
  );
}
