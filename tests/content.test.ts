import { describe, it, expect } from "vitest";
import { getTypeFromExtension, getSourceType } from "@/lib/content";

describe("content helpers", () => {
  it("detects source type from extension", () => {
    expect(getTypeFromExtension("report.pdf")).toBe("document");
    expect(getTypeFromExtension("image.png")).toBe("image");
    expect(getTypeFromExtension("index.html")).toBe("html");
    expect(getTypeFromExtension("notes.txt")).toBe("text");
  });

  it("detects source type from URL", () => {
    expect(getSourceType("https://example.com/article")).toBe("html");
    expect(getSourceType("https://example.com/file.pdf")).toBe("document");
    expect(getSourceType(undefined)).toBe("text");
  });
});
