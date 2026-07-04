import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  clearUserDataInitializationCacheForTests,
  listNotebookDocuments,
  listSourceSummaries,
  loadUserConfig,
} from "@/lib/storage";
import { GET as getProfile } from "@/app/api/profile/[name]/route";

const ORIGINAL_ENV = { ...process.env };
let tmpRoot: string;

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "secondbrain-seed-test-"));
  process.env.SECONDBRAIN_ROOT = tmpRoot;
  clearUserDataInitializationCacheForTests();
});

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  clearUserDataInitializationCacheForTests();
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("sample data seeding", () => {
  it("automatically seeds an empty user data root on first config load", async () => {
    const config = await loadUserConfig();
    const summaries = await listSourceSummaries();
    const notebookDocuments = await listNotebookDocuments();
    const userProfile = await fs.readFile(path.join(tmpRoot, "USER.md"), "utf-8");
    const agentInstructions = await fs.readFile(path.join(tmpRoot, "AGENTS.md"), "utf-8");
    const claudeStat = await fs.lstat(path.join(tmpRoot, "CLAUDE.md"));
    const claudeTarget = await fs.readlink(path.join(tmpRoot, "CLAUDE.md"));

    expect(config.rssFeeds?.map(feed => feed.label)).toEqual(["Hacker News", "R/singularity", "R/ClaudeAI"]);
    expect(userProfile).toContain("I use Second Brain");
    // The agent gate is an explicit consent step — the seed must never skip it
    expect(config.agentModeEnabled).toBeUndefined();
    expect(agentInstructions).toContain("Second Brain data folder");
    expect(await fs.readFile(path.join(tmpRoot, "DataSchema.md"), "utf-8")).toContain("analysis.json");
    expect(claudeStat.isSymbolicLink()).toBe(true);
    expect(claudeTarget).toBe("AGENTS.md");
    expect(summaries.map(summary => summary.meta.id).sort()).toEqual(["demo001a", "demo002b"]);
    expect(notebookDocuments.map(document => document.id)).toEqual(["doc-demo-brief"]);

    // Seeded copies are re-stamped to recent dates so they don't read as months old
    for (const summary of summaries) {
      const ageDays = (Date.now() - new Date(summary.meta.createdAt).getTime()) / 86_400_000;
      expect(ageDays).toBeGreaterThanOrEqual(0);
      expect(ageDays).toBeLessThan(7);
    }
  });

  it("still seeds when API routes created empty directories before the seeding check", async () => {
    // Regression: routes can mkdir library/, notebook/, .tracking/ before the
    // first loadUserConfig runs; empty dirs must not count as user data.
    await fs.mkdir(path.join(tmpRoot, "library"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, "notebook"), { recursive: true });
    await fs.mkdir(path.join(tmpRoot, ".tracking", "events"), { recursive: true });

    const config = await loadUserConfig();
    const summaries = await listSourceSummaries();

    expect(config.rssFeeds?.map(feed => feed.label)).toEqual(["Hacker News", "R/singularity", "R/ClaudeAI"]);
    expect(summaries.map(summary => summary.meta.id).sort()).toEqual(["demo001a", "demo002b"]);
  });

  it("migrates the legacy notebook directory name without overwriting data", async () => {
    const legacyDocPath = path.join(tmpRoot, "studio", "doc-legacy");
    await fs.mkdir(legacyDocPath, { recursive: true });
    await fs.writeFile(path.join(legacyDocPath, "meta.json"), JSON.stringify({
      id: "doc-legacy",
      title: "Legacy Draft",
      createdAt: "2026-01-15T09:30:00.000Z",
      output: "content.md",
    }), "utf-8");
    await fs.writeFile(path.join(legacyDocPath, "content.md"), "# Legacy Draft\n", "utf-8");

    await loadUserConfig();

    const notebookDocuments = await listNotebookDocuments();
    expect(notebookDocuments.map(document => document.id)).toEqual(["doc-legacy"]);
    await expect(fs.access(path.join(tmpRoot, "notebook", "doc-legacy", "meta.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(tmpRoot, "studio"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not inject sample data into a non-empty user data root", async () => {
    await fs.writeFile(path.join(tmpRoot, "USER.md"), "# My Preferences\n", "utf-8");

    const config = await loadUserConfig();

    expect(config).toEqual({});
    await expect(fs.access(path.join(tmpRoot, "library", "examples", "demo001a"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("still seeds when the data root only contains operating-system metadata files", async () => {
    await fs.writeFile(path.join(tmpRoot, ".DS_Store"), "", "utf-8");

    const config = await loadUserConfig();

    expect(config.rssFeeds?.map(feed => feed.label)).toEqual(["Hacker News", "R/singularity", "R/ClaudeAI"]);
    await expect(fs.access(path.join(tmpRoot, "library", "examples", "demo001a", "meta.json"))).resolves.toBeUndefined();
  });

  it("migrates legacy Hacker News feed sources to the current default RSS feeds", async () => {
    await fs.writeFile(
      path.join(tmpRoot, "config.json"),
      JSON.stringify({ feedSources: ["news.ycombinator.com", "example.com"] }),
      "utf-8",
    );

    const config = await loadUserConfig();
    const savedConfig = JSON.parse(await fs.readFile(path.join(tmpRoot, "config.json"), "utf-8"));

    expect(config.rssFeeds?.map(feed => feed.label)).toEqual(["Hacker News", "R/singularity", "R/ClaudeAI"]);
    expect(config.searchSources).toEqual(["example.com"]);
    expect(savedConfig.feedSources).toBeUndefined();
  });

  it("serves agent-maintained profile pages and rejects unknown ones", async () => {
    const memory = await getProfile(new Request("http://localhost/api/profile/Memory"), {
      params: Promise.resolve({ name: "Memory" }),
    });
    expect(memory.status).toBe(200);

    const unknown = await getProfile(new Request("http://localhost/api/profile/Random"), {
      params: Promise.resolve({ name: "Random" }),
    });
    expect(unknown.status).toBe(404);
  });
});
