import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { AGENT_CLI_PROVIDERS, buildAgentCommandSpec, resolveExecutableCommand } from "@/lib/agentProviders";
import { callAgent, getConfiguredAgentProvider } from "@/lib/agent";
import { DEFAULT_AGENT_PROVIDER, isAgentProvider } from "@/lib/agentTypes";

const ORIGINAL_ENV = { ...process.env };
let tmpRoot: string;

function env(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

async function writeExecutable(name: string, script: string): Promise<string> {
  const filePath = path.join(tmpRoot, name);
  await fs.writeFile(filePath, script, "utf-8");
  await fs.chmod(filePath, 0o755);
  return filePath;
}

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "secondbrain-agent-test-"));
  process.env.SECONDBRAIN_ROOT = tmpRoot;
});

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("agent provider registry", () => {
  it("validates supported provider ids", () => {
    expect(isAgentProvider("claude")).toBe(true);
    expect(isAgentProvider("codex")).toBe(true);
    expect(isAgentProvider("gemini")).toBe(false);
    expect(isAgentProvider(undefined)).toBe(false);
  });

  it("builds Claude text commands without inheriting CLAUDECODE", () => {
    const spec = buildAgentCommandSpec("claude", "text", { rootPath: "/brain" }, env({
      PATH: "/bin",
      CLAUDECODE: "local-token",
    }));

    expect(spec.command).toBe("claude");
    expect(spec.args).toEqual(["--print", "--tools", "", "--output-format", "text"]);
    expect(spec.env.CLAUDECODE).toBeUndefined();
    expect(spec.env.PATH).toBe("/bin");
  });

  it("builds Codex text commands with read-only non-interactive execution", () => {
    const spec = buildAgentCommandSpec("codex", "text", { rootPath: "/brain" }, env({ PATH: "/bin" }));

    expect(spec.command.endsWith("codex")).toBe(true);
    expect(spec.args).toEqual([
      "exec",
      "--cd", "/brain",
      "--sandbox", "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color", "never",
      "-",
    ]);
  });

  it("uses Codex output-last-message when an output path is provided", () => {
    const spec = buildAgentCommandSpec("codex", "text", {
      rootPath: "/brain",
      outputPath: "/tmp/last-message.txt",
    }, env());

    expect(spec.args).toContain("--output-last-message");
    expect(spec.args).toContain("/tmp/last-message.txt");
    expect(spec.args.at(-1)).toBe("-");
  });

  it("uses the Codex app-server for chat agent mode", () => {
    const spec = buildAgentCommandSpec("codex", "chat", { rootPath: "/brain", cwd: "/brain" }, env());

    expect(spec.args).toEqual(["app-server", "--stdio"]);
    expect(AGENT_CLI_PROVIDERS.codex.chatTransport).toBe("codex-app-server");
  });

  it("attaches image files to Codex file analysis but passes PDFs by prompt path", () => {
    const imageSpec = buildAgentCommandSpec("codex", "file", { rootPath: "/brain", filePath: "/brain/library/a/original.png" }, env());
    const pdfSpec = buildAgentCommandSpec("codex", "file", { rootPath: "/brain", filePath: "/brain/library/a/original.pdf" }, env());

    expect(imageSpec.args).toContain("-i");
    expect(imageSpec.args).toContain("/brain/library/a/original.png");
    expect(pdfSpec.args).not.toContain("-i");
    expect(pdfSpec.args.at(-1)).toBe("-");
  });

  it("honors global and provider-specific command overrides", () => {
    const globalSpec = buildAgentCommandSpec("codex", "status", { rootPath: "/brain" }, env({
      SECONDBRAIN_AGENT_COMMAND: "/custom/agent",
      SECONDBRAIN_CODEX_COMMAND: "/custom/codex",
    }));
    const providerSpec = buildAgentCommandSpec("codex", "status", { rootPath: "/brain" }, env({
      SECONDBRAIN_CODEX_COMMAND: "/custom/codex",
    }));

    expect(globalSpec.command).toBe("/custom/agent");
    expect(providerSpec.command).toBe("/custom/codex");
  });

  it("resolves a fallback executable when the command is not on PATH", async () => {
    const fallbackPath = path.join(tmpRoot, "Codex.app", "Contents", "Resources", "codex");
    await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
    await fs.writeFile(fallbackPath, "#!/bin/sh\nexit 0\n", "utf-8");
    await fs.chmod(fallbackPath, 0o755);

    expect(resolveExecutableCommand("codex", env({ PATH: "/bin" }), [fallbackPath])).toBe(fallbackPath);
  });

  it("prefers PATH over fallback executables", async () => {
    const binDir = path.join(tmpRoot, "bin");
    const pathCommand = path.join(binDir, "codex");
    const fallbackPath = path.join(tmpRoot, "Codex.app", "Contents", "Resources", "codex");
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
    await fs.writeFile(pathCommand, "#!/bin/sh\nexit 0\n", "utf-8");
    await fs.writeFile(fallbackPath, "#!/bin/sh\nexit 0\n", "utf-8");
    await fs.chmod(pathCommand, 0o755);
    await fs.chmod(fallbackPath, 0o755);

    expect(resolveExecutableCommand("codex", env({ PATH: binDir }), [fallbackPath])).toBe("codex");
  });

  it("classifies status results without spawning a CLI", () => {
    const codex = AGENT_CLI_PROVIDERS.codex;

    expect(codex.classifyStatus({ code: 0, stdout: "codex 1.2.3\n", stderr: "" }, "codex")).toMatchObject({
      provider: "codex",
      state: "ready",
      version: "codex 1.2.3",
    });

    expect(codex.classifyStatus({ stdout: "", stderr: "", error: Object.assign(new Error("missing"), { code: "ENOENT" }) }, "codex")).toMatchObject({
      provider: "codex",
      state: "missing",
    });

    expect(codex.classifyStatus({ stdout: "", stderr: "", timedOut: true, timeoutSeconds: 3 }, "codex")).toMatchObject({
      provider: "codex",
      state: "error",
    });
  });
});

describe("configured agent provider", () => {
  it("defaults to Claude when no provider is configured", async () => {
    expect(await getConfiguredAgentProvider()).toBe(DEFAULT_AGENT_PROVIDER);
  });

  it("loads provider from config.json", async () => {
    await fs.writeFile(path.join(tmpRoot, "config.json"), JSON.stringify({ agentProvider: "codex" }), "utf-8");

    expect(await getConfiguredAgentProvider()).toBe("codex");
  });

  it("falls back when config.json contains an unknown provider", async () => {
    await fs.writeFile(path.join(tmpRoot, "config.json"), JSON.stringify({ agentProvider: "gemini" }), "utf-8");

    expect(await getConfiguredAgentProvider()).toBe(DEFAULT_AGENT_PROVIDER);
  });

  it("lets a valid environment provider override config.json", async () => {
    await fs.writeFile(path.join(tmpRoot, "config.json"), JSON.stringify({ agentProvider: "claude" }), "utf-8");
    process.env.SECONDBRAIN_AGENT_PROVIDER = "codex";

    expect(await getConfiguredAgentProvider()).toBe("codex");
  });
});

describe("agent invocation storage", () => {
  it("does not write prompt debug logs by default", async () => {
    const fakeAgent = await writeExecutable("fake-agent", "#!/bin/sh\ncat >/dev/null\nprintf 'agent output'\n");
    process.env.SECONDBRAIN_AGENT_COMMAND = fakeAgent;

    await expect(callAgent("secret prompt", "unit")).resolves.toBe("agent output");
    await expect(fs.access(path.join(tmpRoot, ".debug"))).rejects.toThrow();
  });

  it("writes prompt debug logs only when explicitly enabled", async () => {
    const fakeAgent = await writeExecutable("fake-agent", "#!/bin/sh\ncat >/dev/null\nprintf 'agent output'\n");
    process.env.SECONDBRAIN_AGENT_COMMAND = fakeAgent;
    process.env.SECONDBRAIN_AGENT_DEBUG_LOGS = "1";

    await expect(callAgent("secret prompt", "unit")).resolves.toBe("agent output");

    const debugDir = path.join(tmpRoot, ".debug");
    const files = await fs.readdir(debugDir);
    expect(files).toHaveLength(1);

    const log = await fs.readFile(path.join(debugDir, files[0]), "utf-8");
    expect(log).toContain("=== PROMPT ===");
    expect(log).toContain("secret prompt");
    expect(log).toContain("=== RESPONSE ===");
    expect(log).toContain("agent output");
  });

  it("keeps Codex last-message output temporary when debug logs are disabled", async () => {
    const fakeCodex = await writeExecutable("fake-codex", `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then
    shift
    output="$1"
  fi
  shift
done
cat >/dev/null
printf '%s' "$output" > "$SECONDBRAIN_ROOT/seen-output-path"
printf 'final from file' > "$output"
printf 'stdout noise'
`);
    process.env.SECONDBRAIN_AGENT_PROVIDER = "codex";
    process.env.SECONDBRAIN_AGENT_COMMAND = fakeCodex;

    await expect(callAgent("secret prompt", "unit")).resolves.toBe("final from file");

    const outputPath = await fs.readFile(path.join(tmpRoot, "seen-output-path"), "utf-8");
    expect(outputPath).not.toContain(path.join(tmpRoot, ".debug"));
    await expect(fs.access(outputPath)).rejects.toThrow();
    await expect(fs.access(path.join(tmpRoot, ".debug"))).rejects.toThrow();
  });
});
