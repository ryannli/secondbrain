"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  FileText,
  FileImage,
} from "lucide-react";
import { TreeNode } from "@/lib/types";
import { getSourceIcon } from "@/lib/sourceIcon";

export interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedSourceId?: string;
  selectedDocumentId?: string;
  expandedFolders: Set<string>;
  dragOverFolder: string | null;
  onToggleFolder: (path: string) => void;
  onSelectSource: (id: string) => void;
  onSelectDocument?: (id: string) => void;
  onEntryContextMenu: (e: React.MouseEvent, entryId: string, entryUrl?: string, entryType?: "source" | "document") => void;
  onFolderContextMenu: (e: React.MouseEvent, folderPath: string, folderName: string) => void;
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
  // Folder renaming
  renamingFolder: string | null;
  renameFolderValue: string;
  onRenameFolderChange: (value: string) => void;
  onRenameFolder: () => void;
  onCancelRename: () => void;
  palette: Record<number, string>;
  theme: Record<string, string>;
}

export function TreeItem({
  node,
  depth,
  selectedSourceId,
  selectedDocumentId,
  expandedFolders,
  dragOverFolder,
  onToggleFolder,
  onSelectSource,
  onSelectDocument,
  onEntryContextMenu,
  onFolderContextMenu,
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
  renamingFolder,
  renameFolderValue,
  onRenameFolderChange,
  onRenameFolder,
  onCancelRename,
  palette,
  theme,
}: TreeItemProps) {
  const paddingLeft = depth * 12 + 12;

  if (node.type === "folder") {
    const isExpanded = expandedFolders.has(node.path);
    const isDragOver = dragOverFolder === node.path;
    const showInput = isCreatingFolder && newFolderParent === node.path;
    const isRenaming = renamingFolder === node.path;

    return (
      <div>
        <div
          onDragOver={(e) => onDragOver(e, node.path)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, node.path)}
          onContextMenu={(e) => onFolderContextMenu(e, node.path, node.name)}
          className="w-full py-1.5 pr-3 flex items-center hover:bg-black/5 transition-colors text-left cursor-pointer rounded group"
          style={{
            backgroundColor: isDragOver ? `${palette[500]}20` : undefined,
          }}
        >
          <div
            onClick={() => !isRenaming && onToggleFolder(node.path)}
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
            {isRenaming ? (
              <input
                type="text"
                value={renameFolderValue}
                onChange={(e) => onRenameFolderChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRenameFolder();
                  if (e.key === "Escape") onCancelRename();
                }}
                onBlur={() => onRenameFolder()}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-1 py-0.5 text-sm border rounded min-w-0"
                style={{ borderColor: palette[500] }}
                autoFocus
              />
            ) : (
              <span className="text-sm truncate">{node.name}</span>
            )}
          </div>
          {!isRenaming && (
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
          )}
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
                selectedDocumentId={selectedDocumentId}
                expandedFolders={expandedFolders}
                dragOverFolder={dragOverFolder}
                onToggleFolder={onToggleFolder}
                onSelectSource={onSelectSource}
                onSelectDocument={onSelectDocument}
                onEntryContextMenu={onEntryContextMenu}
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
          </div>
        )}
      </div>
    );
  }

  // Entry item (source or document - unified rendering)
  const isDocument = node.type === "document";
  const doc = node.document;
  const source = node.source;
  const entryId = isDocument ? doc!.id : source!.meta.id;
  const entryTitle = isDocument ? doc!.title : source!.meta.title;
  const isSelected = isDocument
    ? selectedDocumentId === entryId
    : selectedSourceId === entryId;
  const isProcessing = !isDocument && source?.meta.processingStatus === "processing";

  // Get icon based on entry type
  const getEntryIcon = () => {
    if (isProcessing) {
      return <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" style={{ color: palette[500] }} />;
    }
    if (isDocument && doc) {
      const isPdf = doc.output.endsWith(".pdf");
      const Icon = isPdf ? FileImage : FileText;
      return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />;
    }
    if (source) {
      const { Icon, color, isBrand } = getSourceIcon(source.meta.sourceUrl, source.meta.type, palette[500]);
      return <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isBrand ? color : palette[500] }} />;
    }
    return <FileText className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />;
  };

  const handleClick = () => {
    if (isProcessing) return;
    if (isDocument) {
      onSelectDocument?.(entryId);
    } else {
      onSelectSource(entryId);
    }
  };

  return (
    <div
      draggable={!isProcessing}
      onClick={handleClick}
      onContextMenu={(e) => !isProcessing && onEntryContextMenu(e, entryId, source?.meta.sourceUrl, isDocument ? "document" : "source")}
      onDragStart={(e) => !isProcessing && onDragStart(e, entryId)}
      onDragEnd={onDragEnd}
      className={`w-full py-1.5 flex items-center gap-2 transition-colors text-left rounded ${isProcessing ? "opacity-60" : "hover:bg-black/5 cursor-pointer"}`}
      style={{
        paddingLeft,
        backgroundColor: isSelected ? `${palette[500]}15` : undefined,
      }}
    >
      {getEntryIcon()}
      <span
        className="text-sm truncate"
        style={{ color: isProcessing ? theme.textMuted : isSelected ? palette[600] : theme.text }}
        title={entryTitle}
      >
        {entryTitle}
      </span>
    </div>
  );
}
