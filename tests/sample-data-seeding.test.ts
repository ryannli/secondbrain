import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import {
  clearUserDataInitializationCacheForTests,
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
    const userProfile = await fs.readFile(path.join(tmpRoot, "USER.md"), "utf-8");

    expect(config.rssFeeds?.map(feed => feed.label)).toContain("Hacker News");
    expect(userProfile).toContain("I use Second Brain");
    expect(summaries.map(summary => summary.meta.id).sort()).toEqual(["demo001a", "demo002b"]);
  });

  it("does not inject sample data into a non-empty user data root", async () => {
    await fs.writeFile(path.join(tmpRoot, "USER.md"), "# My Preferences\n", "utf-8");

    const config = await loadUserConfig();

    expect(config).toEqual({});
    await expect(fs.access(path.join(tmpRoot, "library", "demo001a"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("still seeds when the data root only contains operating-system metadata files", async () => {
    await fs.writeFile(path.join(tmpRoot, ".DS_Store"), "", "utf-8");

    const config = await loadUserConfig();

    expect(config.rssFeeds?.map(feed => feed.label)).toContain("Hacker News");
    await expect(fs.access(path.join(tmpRoot, "library", "demo001a", "meta.json"))).resolves.toBeUndefined();
  });

  it("keeps MEMORY.md out of the default profile API surface", async () => {
    const response = await getProfile(new Request("http://localhost/api/profile/Memory"), {
      params: Promise.resolve({ name: "Memory" }),
    });

    expect(response.status).toBe(404);
  });
});
