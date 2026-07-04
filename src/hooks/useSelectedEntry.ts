"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Source, NotebookDocument } from "@/lib/types";

export type DocumentEntry = { meta: NotebookDocument; content: string };

/**
 * Unified state management for the currently selected entry (source or document).
 * Enforces mutual exclusion: selecting one automatically clears the other.
 * Provides refresh() to reload whichever entry is currently selected.
 */
export function useSelectedEntry() {
  const [source, setSourceState] = useState<Source | null>(null);
  const [document, setDocumentState] = useState<DocumentEntry | null>(null);

  // Refs for stable access in refresh() without stale closures
  const sourceRef = useRef(source);
  const documentRef = useRef(document);
  useEffect(() => { sourceRef.current = source; }, [source]);
  useEffect(() => { documentRef.current = document; }, [document]);

  // Set source, auto-clear document
  const setSource = useCallback((s: Source | null) => {
    setSourceState(s);
    if (s) setDocumentState(null);
  }, []);

  // Set document, auto-clear source
  const setDocument = useCallback((d: DocumentEntry | null) => {
    setDocumentState(d);
    if (d) setSourceState(null);
  }, []);

  // Clear both
  const clear = useCallback(() => {
    setSourceState(null);
    setDocumentState(null);
  }, []);

  // Re-fetch whichever entry is currently selected
  const refresh = useCallback(async () => {
    const currentSource = sourceRef.current;
    const currentDoc = documentRef.current;

    if (currentSource) {
      try {
        const res = await fetch(`/api/sources/${currentSource.meta.id}`);
        const data = await res.json();
        if (data.success && data.source) {
          setSourceState(data.source);
        }
      } catch (e) {
        console.error("Failed to refresh source:", e);
      }
    } else if (currentDoc) {
      try {
        const res = await fetch(`/api/notebook/${currentDoc.meta.id}`);
        const data = await res.json();
        if (data.success && data.document) {
          setDocumentState(data.document);
        }
      } catch (e) {
        console.error("Failed to refresh document:", e);
      }
    }
  }, []);

  return {
    source,
    document,
    setSource,
    setDocument,
    clear,
    refresh,
  };
}
