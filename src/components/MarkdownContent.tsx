"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@/components/ui";

interface MarkdownContentProps {
  content: string;
  palette: Record<number, string>;
  className?: string;
}

export function MarkdownContent({ content, palette, className = "" }: MarkdownContentProps) {
  return (
    <div className={`prose prose-sm prose-neutral dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2 hover:opacity-80"
              style={{ color: palette[600] }}
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 rounded-lg p-4 overflow-x-auto my-4">
              {children}
            </pre>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const lang = match ? match[1] : "";
            const codeContent = String(children).replace(/\n$/, "");

            // Render Mermaid diagrams
            if (lang === "mermaid") {
              return <Mermaid chart={codeContent} className="my-4" />;
            }

            // Inline code
            if (!codeClassName) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            // Code block (inside pre)
            return (
              <code className="text-inherit bg-transparent" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
