import React from "react";

/**
 * Renders plain text with markdown-style [label](https://url) links as
 * clickable anchors. Used for error/status messages stored as plain text.
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        if (match) {
          return (
            <a
              key={i}
              href={match[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              {match[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
