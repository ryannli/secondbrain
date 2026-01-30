"use client";

import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
} from "lucide-react";
import { TreeNode } from "@/lib/types";
import { getSourceIcon } from "@/lib/sourceIcon";

export interface TreeItemProps {
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
}

export function TreeItem({
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
}: TreeItemProps) {
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
  const { Icon: SourceIcon, color: iconColor, isBrand } = getSourceIcon(source.meta.sourceUrl, source.meta.type, palette[500]);

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
