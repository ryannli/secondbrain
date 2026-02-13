"use client";

import React, { useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/ui";
import { UserHighlight } from "@/lib/types";

interface MarkdownContentProps {
  content: string;
  palette: Record<number, string>;
  className?: string;
  highlights?: UserHighlight[];
  onRemoveHighlight?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Rehype plugin: highlight user text at the AST level
// ---------------------------------------------------------------------------
// Unlike injecting <mark> into raw markdown (which breaks on links, bold,
// blockquotes, line breaks, etc.), this operates on the already-parsed HTML
// AST where all markdown syntax has been resolved. Text nodes in the AST
// contain the actual rendered text, so matching against user-selected DOM
// text works correctly.
// ---------------------------------------------------------------------------

// Minimal HAST types (avoids depending on @types/hast)
interface HastText { type: "text"; value: string }
interface HastElement { type: "element"; tagName: string; properties: Record<string, unknown>; children: HastContent[] }
interface HastRoot { type: "root"; children: HastContent[] }
type HastContent = HastElement | HastText | { type: string };

interface TextSegment {
  node: HastText;
  parentChildren: HastContent[];
  indexInParent: number;
  globalStart: number;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex from user-selected text that tolerates whitespace differences
 * between the DOM selection and the AST text nodes (soft line breaks show as
 * spaces in the DOM but are \n in the AST).
 */
function buildFlexiblePattern(text: string): RegExp {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return new RegExp(escapeRegex(text), "g");
  return new RegExp(parts.map(escapeRegex).join("[\\s]+"), "g");
}

function rehypeHighlight(options: { highlights: UserHighlight[] }) {
  return (tree: HastRoot) => {
    const { highlights } = options;
    if (!highlights?.length) return;

    // 1. Collect every text segment in document order (skip code blocks)
    const segments: TextSegment[] = [];
    let globalPos = 0;

    function collect(children: HastContent[], inCode: boolean) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type === "text") {
          const t = child as HastText;
          if (!inCode) {
            segments.push({ node: t, parentChildren: children, indexInParent: i, globalStart: globalPos });
          }
          globalPos += t.value.length;
        } else if (child.type === "element") {
          const el = child as HastElement;
          collect(el.children, inCode || el.tagName === "code" || el.tagName === "pre");
        }
      }
    }
    collect(tree.children, false);
    if (!segments.length) return;

    // Concatenated text of the entire document (mirrors what the browser displays)
    const fullText = segments.map((s) => s.node.value).join("");

    // 2. Find all highlight matches (longest first to avoid partial overlaps)
    const matches: { id: string; start: number; end: number }[] = [];
    for (const h of [...highlights].sort((a, b) => b.text.length - a.text.length)) {
      const re = buildFlexiblePattern(h.text);
      let m;
      while ((m = re.exec(fullText)) !== null) {
        matches.push({ id: h.id, start: m.index, end: m.index + m[0].length });
      }
    }
    if (!matches.length) return;

    // Process from end→start so earlier segment indices stay valid
    matches.sort((a, b) => b.start - a.start);

    // 3. For each match, split text nodes and wrap in <mark>
    for (const { id, start, end } of matches) {
      const affected = segments.filter((s) => {
        const se = s.globalStart + s.node.value.length;
        return se > start && s.globalStart < end;
      });

      for (let i = affected.length - 1; i >= 0; i--) {
        const seg = affected[i];
        const ls = Math.max(0, start - seg.globalStart);
        const le = Math.min(seg.node.value.length, end - seg.globalStart);

        const before = seg.node.value.slice(0, ls);
        const matched = seg.node.value.slice(ls, le);
        const after = seg.node.value.slice(le);

        const replacements: HastContent[] = [];
        if (before) replacements.push({ type: "text", value: before } as HastText);
        if (matched) {
          replacements.push({
            type: "element",
            tagName: "mark",
            properties: { "data-highlight-id": id },
            children: [{ type: "text", value: matched } as HastText],
          } as HastElement);
        }
        if (after) replacements.push({ type: "text", value: after } as HastText);

        seg.parentChildren.splice(seg.indexInParent, 1, ...replacements);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level component definitions (stable references — see earlier fix)
// ---------------------------------------------------------------------------

const mdComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2 hover:opacity-80" style={{ color: "var(--md-link-color)" }}>
      {children}
    </a>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 rounded-lg p-4 overflow-x-auto my-4">
      {children}
    </pre>
  ),
  code: ({ className: codeClassName, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(codeClassName || "");
    const lang = match ? match[1] : "";
    const codeContent = String(children).replace(/\n$/, "");
    if (lang === "mermaid") return <Mermaid chart={codeContent} className="my-4" />;
    if (!codeClassName) {
      return <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 text-sm font-mono" {...props}>{children}</code>;
    }
    return <code className="text-inherit bg-transparent" {...props}>{children}</code>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mark: ({ children, node, ...props }: any) => (
    <mark
      {...props}
      className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded-sm cursor-pointer hover:bg-yellow-300 dark:hover:bg-yellow-800/60 transition-colors"
      title="Click to remove highlight"
    >
      {children}
    </mark>
  ),
};

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS_NONE: never[] = [];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarkdownContent({ content, palette, className = "", highlights, onRemoveHighlight }: MarkdownContentProps) {
  // Event delegation for highlight removal
  const onRemoveRef = useRef(onRemoveHighlight);
  onRemoveRef.current = onRemoveHighlight;

  const handleClick = useMemo(() => (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("mark[data-highlight-id]");
    if (mark) {
      const id = mark.getAttribute("data-highlight-id");
      if (id) onRemoveRef.current?.(id);
    }
  }, []);

  // Build rehype plugins — only include the highlight plugin when there are highlights
  const rehypePlugins = useMemo(
    () => (highlights?.length ? [[rehypeHighlight, { highlights }]] : REHYPE_PLUGINS_NONE),
    [highlights],
  );

  return (
    <div
      className={`prose prose-sm prose-neutral dark:prose-invert max-w-none ${className}`}
      style={{ "--md-link-color": palette[600] } as React.CSSProperties}
      onClick={handleClick}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={rehypePlugins as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]}
        components={mdComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
