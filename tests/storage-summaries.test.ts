import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { listSourceSummaries } from "@/lib/storage";

const ORIGINAL_ENV = { ...process.env };
let tmpRoot: string;

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "secondbrain-summary-test-"));
  process.env.SECONDBRAIN_ROOT = tmpRoot;
});

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("listSourceSummaries", () => {
  it("loads dashboard cards from triage without validating the full analysis payload", async () => {
    const sourceDir = path.join(tmpRoot, "library", "research", "src1");
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "meta.json"), JSON.stringify({
      id: "src1",
      schemaVersion: 1,
      source_url: "https://example.com/article",
      created_at: "2026-01-01T00:00:00.000Z",
      type: "html",
      original_file: "original.html",
      original_title: "Original title",
    }), "utf-8");
    await fs.writeFile(path.join(sourceDir, "content.md"), "---\ntitle: \"Readable title\"\nreadStatus: \"read\"\n---\n\nBody", "utf-8");
    await fs.writeFile(path.join(sourceDir, "analysis.json"), JSON.stringify({
      triage: {
        score: 82,
        reason: "Strong signal",
        action: "must_read",
      },
      digest: "legacy malformed payload",
    }), "utf-8");

    const summaries = await listSourceSummaries();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      score: 82,
      reason: "Strong signal",
      action: "must_read",
      meta: {
        id: "src1",
        title: "Readable title",
        folder: "research",
        readStatus: "read",
        processingStatus: "ready",
      },
    });
  });
});
