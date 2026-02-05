import { describe, it, expect } from "vitest";
import { OriginalDataSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("defaults schemaVersion for meta.json", () => {
    const parsed = OriginalDataSchema.parse({
      id: "abcd1234",
      created_at: "2024-01-01T00:00:00.000Z",
      type: "text",
      original_file: "original.txt",
      original_title: "Test",
    });

    expect(parsed.schemaVersion).toBe(1);
  });
});
