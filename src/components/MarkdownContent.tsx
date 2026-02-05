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
    <div className={`prose prose-sm prose-neutral max-w-none ${className}`}>
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
                <code className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            // Code block
            return (
              <code className={codeClassName} {...props}>
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
