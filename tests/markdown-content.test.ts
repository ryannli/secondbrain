import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "@/components/MarkdownContent";
import { UserHighlight } from "@/lib/types";

vi.mock("@/components/ui", () => ({ Mermaid: () => null }));

describe("MarkdownContent", () => {
  it("does not duplicate text when multiple highlights target the same paragraph", () => {
    const content = "Importantly, human capital does not become less valuable as token capital grows. It only becomes more valuable! I believe human agency will be the driver of token capital growth. Humans will set ambitious goals, connect dots across domains, build relationships, and recognize patterns that matter most. Without human direction, you have compute running in circles.";
    const highlights: UserHighlight[] = [
      {
        id: "first",
        text: "human capital does not become less valuable as token capital grows",
        createdAt: "2026-06-18T03:40:37.971Z",
      },
      {
        id: "second",
        text: "Humans will set ambitious goals, connect dots across domains, build relationships, and recognize patterns that matter most.",
        createdAt: "2026-06-18T03:40:48.377Z",
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(MarkdownContent, {
        content,
        palette: { 600: "#000000" },
        highlights,
      }),
    );

    expect(html.match(/data-highlight-id=/g)).toHaveLength(2);
    expect(html.match(/Humans will set ambitious goals/g)).toHaveLength(1);
    expect(html.match(/Without human direction/g)).toHaveLength(1);
  });
});
