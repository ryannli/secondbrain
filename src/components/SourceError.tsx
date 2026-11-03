"use client";

import React, { useRef, useState } from "react";
import { Check, ExternalLink, Trash2, Upload, X } from "lucide-react";
import { SourceMeta } from "@/lib/types";
import { theme } from "@/lib/theme";

interface SourceErrorProps {
  meta: SourceMeta;
  onDelete?: () => void;
  onReplace?: (file: File) => void;
  onClose?: () => void;
}

const iconColor = "#9ca3af";

function IconButton({
  onClick,
  title,
  label,
  color = iconColor,
  children,
}: {
  onClick: () => void;
  title: string;
  label: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      style={{ color }}
      title={title}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function SourceError({ meta, onDelete, onReplace, onClose }: SourceErrorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 max-w-2xl">
        <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6" style={{ borderColor: theme.border }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-2xl font-semibold leading-tight min-w-0">{meta.title}</h1>
            <div className="flex items-center gap-1 flex-shrink-0">
              {confirmingDelete ? (
                <>
                  <span className="text-sm mr-1" style={{ color: theme.textMuted }}>Delete this card?</span>
                  <IconButton onClick={() => onDelete?.()} title="Confirm delete" label="Confirm delete" color="#ef4444">
                    <Check className="w-4 h-4" />
                  </IconButton>
                  <IconButton onClick={() => setConfirmingDelete(false)} title="Cancel" label="Cancel delete">
                    <X className="w-4 h-4" />
                  </IconButton>
                </>
              ) : (
                <>
                  {onReplace && (
                    <IconButton onClick={() => inputRef.current?.click()} title="Upload again" label="Upload again">
                      <Upload className="w-4 h-4" />
                    </IconButton>
                  )}
                  {onDelete && (
                    <IconButton onClick={() => setConfirmingDelete(true)} title="Delete" label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  )}
                  {onClose && (
                    <IconButton onClick={onClose} title="Close" label="Close">
                      <X className="w-4 h-4" />
                    </IconButton>
                  )}
                </>
              )}
            </div>
          </div>
          {onReplace && (
            <input
              ref={inputRef}
              type="file"
              accept="image/*,.pdf,.epub,application/pdf,application/epub+zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onReplace(file);
                e.target.value = "";
              }}
            />
          )}
          {meta.sourceUrl && (
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline inline-flex items-center gap-1"
              style={{ color: theme.textMuted }}
            >
              {new URL(meta.sourceUrl).hostname}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="font-medium text-red-700 mb-2">Capture Failed</p>
            <p className="text-sm text-red-600">{meta.processingError || "Unknown error occurred"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
