"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Pencil,
  RefreshCw,
  ExternalLink,
  FileText,
  Eye,
  X,
  Bookmark,
  MoreHorizontal,
  Inbox,
} from "lucide-react";
import { TooltipButton } from "./ui";

interface EntryActionsProps {
  // State
  saved?: boolean;
  sourceUrl?: string;
  viewOriginal: boolean;
  isReanalyzing: boolean;
  hasOriginalFile: boolean;
  // Handlers
  onToggleSaved?: (saved: boolean) => void;
  onEdit: () => void;
  onReanalyze?: () => void;
  onToggleViewOriginal: () => void;
  onMarkUnread?: () => void;
  onClose?: () => void;
  // Theming
  palette: Record<number, string>;
  theme: Record<string, string>;
}

export function EntryActions({
  saved,
  sourceUrl,
  viewOriginal,
  isReanalyzing,
  hasOriginalFile,
  onToggleSaved,
  onEdit,
  onReanalyze,
  onToggleViewOriginal,
  onMarkUnread,
  onClose,
  palette,
  theme,
}: EntryActionsProps) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure the parent content area width to decide layout
  useEffect(() => {
    const el = containerRef.current?.closest("[data-entry-header]");
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < 500);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [dropdownOpen]);

  const actions = isNarrow ? (
    <NarrowActions
      saved={saved}
      sourceUrl={sourceUrl}
      viewOriginal={viewOriginal}
      isReanalyzing={isReanalyzing}
      hasOriginalFile={hasOriginalFile}
      dropdownOpen={dropdownOpen}
      setDropdownOpen={setDropdownOpen}
      onToggleSaved={onToggleSaved}
      onEdit={onEdit}
      onReanalyze={onReanalyze}
      onToggleViewOriginal={onToggleViewOriginal}
      onMarkUnread={onMarkUnread}
      onClose={onClose}
      palette={palette}
      theme={theme}
    />
  ) : (
    <WideActions
      saved={saved}
      sourceUrl={sourceUrl}
      viewOriginal={viewOriginal}
      isReanalyzing={isReanalyzing}
      hasOriginalFile={hasOriginalFile}
      onToggleSaved={onToggleSaved}
      onEdit={onEdit}
      onReanalyze={onReanalyze}
      onToggleViewOriginal={onToggleViewOriginal}
      onMarkUnread={onMarkUnread}
      onClose={onClose}
      palette={palette}
      theme={theme}
    />
  );

  return <div ref={containerRef} className="flex items-center gap-1">{actions}</div>;
}

// Narrow screen: bookmark + dropdown + close
function NarrowActions({
  saved,
  sourceUrl,
  viewOriginal,
  isReanalyzing,
  hasOriginalFile,
  dropdownOpen,
  setDropdownOpen,
  onToggleSaved,
  onEdit,
  onReanalyze,
  onToggleViewOriginal,
  onMarkUnread,
  onClose,
  palette,
  theme,
}: EntryActionsProps & {
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
}) {
  const iconColor = "#9ca3af";

  return (
    <div className="relative">
      <GhostButton onClick={() => setDropdownOpen(!dropdownOpen)} color={iconColor}>
        <MoreHorizontal className="w-4 h-4" />
      </GhostButton>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
          <DropdownMenu
            saved={saved}
            sourceUrl={sourceUrl}
            viewOriginal={viewOriginal}
            isReanalyzing={isReanalyzing}
            hasOriginalFile={hasOriginalFile}
            onToggleSaved={onToggleSaved ? (s: boolean) => { onToggleSaved(s); setDropdownOpen(false); } : undefined}
            onEdit={() => { onEdit(); setDropdownOpen(false); }}
            onReanalyze={onReanalyze ? () => { onReanalyze(); setDropdownOpen(false); } : undefined}
            onToggleViewOriginal={() => { onToggleViewOriginal(); setDropdownOpen(false); }}
            onMarkUnread={onMarkUnread ? () => { onMarkUnread(); setDropdownOpen(false); } : undefined}
            onCloseEntry={onClose ? () => { onClose(); setDropdownOpen(false); } : undefined}
            onClose={() => setDropdownOpen(false)}
            palette={palette}
            theme={theme}
          />
        </>
      )}
    </div>
  );
}

// Wide screen: all buttons inline
function WideActions({
  saved,
  sourceUrl,
  viewOriginal,
  isReanalyzing,
  hasOriginalFile,
  onToggleSaved,
  onEdit,
  onReanalyze,
  onToggleViewOriginal,
  onMarkUnread,
  onClose,
  palette,
}: EntryActionsProps) {
  const iconColor = "#9ca3af";

  return (
    <>
      {onToggleSaved && (
        <TooltipButton
          onClick={() => onToggleSaved(!saved)}
          tooltip={{
            title: saved ? "Remove from saved" : "Save",
            description: saved ? "Remove from your saved items." : "Save this for later.",
          }}
          style={{ color: saved ? palette[500] : iconColor }}
          data-track="entry.bookmark"
        >
          <Bookmark className="w-4 h-4" style={{ fill: saved ? palette[500] : "none" }} />
        </TooltipButton>
      )}

      {onMarkUnread && (
        <TooltipButton
          onClick={onMarkUnread}
          tooltip={{ title: "Back to Inbox", description: "Mark as unread and return to Inbox." }}
          style={{ color: iconColor }}
          data-track="entry.back_to_inbox"
        >
          <Inbox className="w-4 h-4" />
        </TooltipButton>
      )}

      <TooltipButton
        onClick={onEdit}
        tooltip={{ title: "Edit", description: "Edit the title and content directly." }}
        style={{ color: iconColor }}
        data-track="entry.edit"
      >
        <Pencil className="w-4 h-4" />
      </TooltipButton>

      {onReanalyze && (
        <TooltipButton
          onClick={onReanalyze}
          disabled={isReanalyzing}
          tooltip={{ title: "Re-process", description: "Re-fetch content and re-run AI analysis." }}
          style={{ color: iconColor }}
          data-track="entry.reanalyze"
        >
          <RefreshCw className={`w-4 h-4 ${isReanalyzing ? "animate-spin" : ""}`} />
        </TooltipButton>
      )}

      {sourceUrl ? (
        <TooltipLink
          href={sourceUrl}
          tooltip={{ title: "Open original", description: "Open the source URL in a new tab." }}
          color={iconColor}
        >
          <ExternalLink className="w-4 h-4" />
        </TooltipLink>
      ) : hasOriginalFile ? (
        <TooltipButton
          onClick={onToggleViewOriginal}
          tooltip={{
            title: viewOriginal ? "View extracted" : "View original",
            description: viewOriginal ? "Switch to AI-extracted content." : "View the original file.",
          }}
          style={{ color: viewOriginal ? palette[500] : iconColor }}
        >
          {viewOriginal ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </TooltipButton>
      ) : null}

      {onClose && (
        <GhostButton onClick={onClose} title="Close" color={iconColor}>
          <X className="w-4 h-4" />
        </GhostButton>
      )}
    </>
  );
}

// Dropdown menu for narrow screens
function DropdownMenu({
  saved,
  sourceUrl,
  viewOriginal,
  isReanalyzing,
  hasOriginalFile,
  onToggleSaved,
  onEdit,
  onReanalyze,
  onToggleViewOriginal,
  onMarkUnread,
  onCloseEntry,
  onClose,
  palette,
  theme,
}: {
  saved?: boolean;
  sourceUrl?: string;
  viewOriginal: boolean;
  isReanalyzing: boolean;
  hasOriginalFile: boolean;
  onToggleSaved?: (saved: boolean) => void;
  onEdit: () => void;
  onReanalyze?: () => void;
  onToggleViewOriginal: () => void;
  onMarkUnread?: () => void;
  onCloseEntry?: () => void;
  onClose: () => void;
  palette?: Record<number, string>;
  theme: Record<string, string>;
}) {
  const iconColor = "#9ca3af";

  return (
    <div
      className="absolute right-0 top-full mt-1 w-44 py-1 bg-white dark:bg-zinc-800 border rounded-lg shadow-lg z-20"
      style={{ borderColor: theme.border }}
    >
      {onToggleSaved && (
        <DropdownItem
          onClick={() => onToggleSaved(!saved)}
          icon={<Bookmark className="w-4 h-4" style={{ fill: saved ? palette?.[500] : "none" }} />}
          iconColor={saved ? (palette?.[500] || iconColor) : iconColor}
        >
          {saved ? "Remove from saved" : "Save"}
        </DropdownItem>
      )}

      {onMarkUnread && (
        <DropdownItem onClick={onMarkUnread} icon={<Inbox className="w-4 h-4" />} iconColor={iconColor}>
          Back to Inbox
        </DropdownItem>
      )}

      <div className="my-1 border-t" style={{ borderColor: theme.border }} />

      <DropdownItem onClick={onEdit} icon={<Pencil className="w-4 h-4" />} iconColor={iconColor}>
        Edit
      </DropdownItem>

      {onReanalyze && (
        <DropdownItem
          onClick={onReanalyze}
          disabled={isReanalyzing}
          icon={<RefreshCw className={`w-4 h-4 ${isReanalyzing ? "animate-spin" : ""}`} />}
          iconColor={iconColor}
        >
          Re-process
        </DropdownItem>
      )}

      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-black/5"
        >
          <ExternalLink className="w-4 h-4" style={{ color: iconColor }} />
          Open original
        </a>
      )}

      {!sourceUrl && hasOriginalFile && (
        <DropdownItem
          onClick={onToggleViewOriginal}
          icon={viewOriginal ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          iconColor={iconColor}
        >
          {viewOriginal ? "View extracted" : "View original"}
        </DropdownItem>
      )}

      {onCloseEntry && (
        <>
          <div className="my-1 border-t" style={{ borderColor: theme.border }} />
          <DropdownItem onClick={onCloseEntry} icon={<X className="w-4 h-4" />} iconColor={iconColor}>
            Close
          </DropdownItem>
        </>
      )}
    </div>
  );
}

// Reusable components
function GhostButton({
  onClick,
  title,
  color,
  children,
}: {
  onClick: () => void;
  title?: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-black/5 transition-colors"
      style={{ color }}
      title={title}
    >
      {children}
    </button>
  );
}

function TooltipLink({
  href,
  tooltip,
  color,
  children,
}: {
  href: string;
  tooltip: { title: string; description: string };
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-black/5 transition-colors inline-flex"
        style={{ color }}
      >
        {children}
      </a>
      <div className="absolute right-0 top-full mt-2 w-48 p-3 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
        <p className="font-medium mb-1">{tooltip.title}</p>
        <p className="text-gray-300">{tooltip.description}</p>
      </div>
    </div>
  );
}

function DropdownItem({
  onClick,
  disabled,
  icon,
  iconColor,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-black/5 disabled:opacity-50"
    >
      <span style={{ color: iconColor }}>{icon}</span>
      {children}
    </button>
  );
}
