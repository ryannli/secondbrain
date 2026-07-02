import { describe, it, expect } from "vitest";
import { buildTree } from "@/lib/tree";

describe("buildTree", () => {
  it("builds folder hierarchy and sorts items by time", () => {
    const items = [
      { id: "a", name: "Alpha", folder: "x", createdAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", name: "Beta", folder: "x", createdAt: "2024-02-01T00:00:00.000Z" },
      { id: "c", name: "Gamma", createdAt: "2024-03-01T00:00:00.000Z" },
    ];
    const folders = ["x", "x/sub"];

    const tree = buildTree(items, folders, "source", (item) => ({ source: { meta: { id: item.id, title: item.name, type: "text" as const, createdAt: item.createdAt as string } } }));

    expect(tree[0].type).toBe("folder");
    expect(tree[0].name).toBe("x");
    expect(tree[1].type).toBe("source");
    expect(tree[1].name).toBe("Gamma");

    const folderChildren = tree[0].children || [];
    const itemNames = folderChildren.filter((n) => n.type === "source").map((n) => n.name);
    expect(itemNames).toEqual(["Beta", "Alpha"]);
  });
});
