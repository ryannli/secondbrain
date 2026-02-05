"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { SourceMeta } from "@/lib/types";
import { theme } from "@/lib/theme";

interface SourceErrorProps {
  meta: SourceMeta;
}

export function SourceError({ meta }: SourceErrorProps) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-1 min-w-0 max-w-2xl">
        <div className="bg-white dark:bg-zinc-900 border rounded-xl p-6" style={{ borderColor: theme.border }}>
          <h1 className="text-2xl font-semibold leading-tight mb-4">{meta.title}</h1>
          {meta.sourceUrl && (
            <a
              href={meta.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline mb-4 inline-flex items-center gap-1"
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
