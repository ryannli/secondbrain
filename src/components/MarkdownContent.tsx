"use client";

import React, { useEffect, useMemo, useRef } from "react";
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
  fontSize?: string;      // "xs" | "sm" | "base" | "lg"
  headingStyle?: string;  // "clean" | "colored" | "accented"
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

interface HighlightRange {
  id: string;
  start: number;
  end: number;
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
            globalPos += t.value.length;
          }
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

    // 2. Find all highlight matches, then keep a non-overlapping range set.
    // Longer highlights win when selections overlap.
    const candidates: HighlightRange[] = [];
    for (const h of [...highlights].filter((h) => h.text.trim()).sort((a, b) => b.text.length - a.text.length)) {
      const re = buildFlexiblePattern(h.text);
      let m;
      while ((m = re.exec(fullText)) !== null) {
        candidates.push({ id: h.id, start: m.index, end: m.index + m[0].length });
      }
    }
    if (!candidates.length) return;

    const ranges: HighlightRange[] = [];
    for (const candidate of candidates.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)) {
      const overlaps = ranges.some((range) => candidate.start < range.end && candidate.end > range.start);
      if (!overlaps) ranges.push(candidate);
    }
    ranges.sort((a, b) => a.start - b.start);
    if (!ranges.length) return;

    // 3. Split each original text node once. Re-splitting the same node for
    // multiple highlights can duplicate text because parent indices go stale.
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const segEnd = seg.globalStart + seg.node.value.length;
      const rangesInSegment = ranges.filter((range) => range.end > seg.globalStart && range.start < segEnd);
      if (!rangesInSegment.length) continue;

      const replacements: HastContent[] = [];
      let cursor = 0;

      for (const range of rangesInSegment) {
        const ls = Math.max(cursor, Math.max(0, range.start - seg.globalStart));
        const le = Math.min(seg.node.value.length, range.end - seg.globalStart);
        if (le <= ls) continue;

        if (ls > cursor) replacements.push({ type: "text", value: seg.node.value.slice(cursor, ls) } as HastText);
        replacements.push({
          type: "element",
          tagName: "mark",
          properties: { "data-highlight-id": range.id },
          children: [{ type: "text", value: seg.node.value.slice(ls, le) } as HastText],
        } as HastElement);
        cursor = le;
      }

      if (cursor < seg.node.value.length) replacements.push({ type: "text", value: seg.node.value.slice(cursor) } as HastText);
      seg.parentChildren.splice(seg.indexInParent, 1, ...replacements);
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
  mark: ({ children, ...props }: { children?: React.ReactNode; node?: unknown } & React.HTMLAttributes<HTMLElement>) => {
    const markProps = { ...props };
    delete markProps.node;

    return (
      <mark
        {...markProps}
        className="bg-yellow-200 dark:bg-yellow-900/50 px-0.5 rounded-sm cursor-pointer hover:bg-yellow-300 dark:hover:bg-yellow-800/60 transition-colors"
        title="Click to remove highlight"
      >
        {children}
      </mark>
    );
  },
};

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS_NONE: never[] = [];

// ---------------------------------------------------------------------------
// Heading style presets
// ---------------------------------------------------------------------------

function buildHeadingComponents(style: string, palette: Record<number, string>) {
  if (style === "colored") {
    const colors = { h1: palette[700], h2: palette[600], h3: palette[500] };
    return {
      h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ color: colors.h1 }}>{children}</h1>,
      h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ color: colors.h2 }}>{children}</h2>,
      h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ color: colors.h3 }}>{children}</h3>,
    };
  }
  if (style === "accented") {
    return {
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="border-l-4 pl-4 py-1" style={{ borderColor: palette[500], backgroundColor: `${palette[500]}08` }}>{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="border-l-3 pl-3 py-0.5" style={{ borderColor: palette[400], backgroundColor: `${palette[400]}06` }}>{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="border-l-2 pl-3" style={{ borderColor: palette[300] }}>{children}</h3>
      ),
    };
  }
  return {}; // "clean" = prose defaults
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MarkdownContent = React.memo(function MarkdownContent({
  content, palette, className = "", highlights, onRemoveHighlight,
  fontSize = "sm", headingStyle = "clean",
}: MarkdownContentProps) {
  // Event delegation for highlight removal (ref avoids re-render on callback change)
  const onRemoveRef = useRef(onRemoveHighlight);

  useEffect(() => {
    onRemoveRef.current = onRemoveHighlight;
  }, [onRemoveHighlight]);

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

  // Build components with heading style overrides
  const components = useMemo(() => {
    const headingOverrides = buildHeadingComponents(headingStyle, palette);
    return Object.keys(headingOverrides).length > 0
      ? { ...mdComponents, ...headingOverrides }
      : mdComponents;
  }, [headingStyle, palette]);

  // Prose size class (prose-xs doesn't exist in @tailwindcss/typography, use prose-sm + override)
  const proseSizeMap: Record<string, string> = { xs: "prose-sm", sm: "prose-sm", base: "prose-base", lg: "prose-lg" };
  const proseSize = proseSizeMap[fontSize] || "prose-sm";

  return (
    <div
      className={`prose ${proseSize} prose-neutral dark:prose-invert max-w-none ${className}`}
      style={{
        "--md-link-color": palette[600],
        ...(fontSize === "xs" ? { fontSize: "0.8rem" } : {}),
      } as React.CSSProperties}
      onClick={handleClick}
    >
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={rehypePlugins as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}, (prev, next) =>
  prev.content === next.content
  && prev.className === next.className
  && prev.highlights === next.highlights
  && prev.palette[600] === next.palette[600]
  && prev.fontSize === next.fontSize
  && prev.headingStyle === next.headingStyle
);
