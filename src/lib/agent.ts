import { debugLog } from "./log";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { AGENT_PROVIDER_DETAILS, DEFAULT_AGENT_PROVIDER, AgentProvider, AgentStatus, isAgentProvider } from "./agentTypes";
import { AGENT_CLI_PROVIDERS, buildAgentCommandSpec } from "./agentProviders";
import { getCurrentRootPath, loadProfileDoc, loadUserConfig } from "./storage";

const AGENT_TIMEOUT_MS = 10 * 60 * 1000;
const STATUS_TIMEOUT_MS = 8 * 1000;
const AGENT_DEBUG_ENV = "SECONDBRAIN_AGENT_DEBUG_LOGS";

let profileCache: { userProfile: string } | null = null;

async function loadUserProfiles(): Promise<{ userProfile: string }> {
  if (!profileCache) {
    const userProfile = await loadProfileDoc("USER").catch(() => "");
    profileCache = { userProfile };
  }
  return profileCache;
}

export function invalidateAgentProfileCache(): void {
  profileCache = null;
}

export async function getConfiguredAgentModel(provider: AgentProvider): Promise<string | undefined> {
  const config = await loadUserConfig();
  const model = config.agentModels?.[provider]?.trim();
  return model || undefined;
}

export async function getConfiguredAgentProvider(): Promise<AgentProvider> {
  if (isAgentProvider(process.env.SECONDBRAIN_AGENT_PROVIDER)) {
    return process.env.SECONDBRAIN_AGENT_PROVIDER;
  }

  const config = await loadUserConfig();
  return isAgentProvider(config.agentProvider) ? config.agentProvider : DEFAULT_AGENT_PROVIDER;
}

async function buildPromptWithProfiles(prompt: string): Promise<string> {
  const { userProfile } = await loadUserProfiles();
  // Memory is agent-written during chats, so read it fresh instead of caching
  const memory = (await loadProfileDoc("MEMORY").catch(() => "")).trim();

  const preamble: string[] = [];
  const profileParts: string[] = [];
  if (userProfile) {
    preamble.push("You MUST follow the instructions in <user-preferences>.");
    profileParts.push(`<user-preferences file="USER.md">\n${userProfile}\n</user-preferences>`);
  }
  if (memory) {
    preamble.push("<agent-memory> is accumulated background context about the user.");
    profileParts.push(`<agent-memory file="MEMORY.md">\n${memory}\n</agent-memory>`);
  }

  return profileParts.length > 0
    ? `${preamble.join(" ")}\n\n${profileParts.join("\n\n")}\n\n${prompt}`
    : prompt;
}

function shouldWriteAgentDebugLogs(): boolean {
  const value = process.env[AGENT_DEBUG_ENV];
  return value === "1" || value === "true";
}

async function prepareCodexOutputPath(
  provider: AgentProvider,
  label: string,
  runId: string,
  debugDir: string | undefined,
): Promise<{ outputPath?: string; cleanupPath?: string }> {
  if (provider !== "codex") return {};

  if (debugDir) {
    return { outputPath: path.join(debugDir, `${provider}-${label}-${runId}-last-message.txt`) };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "secondbrain-agent-"));
  return { outputPath: path.join(tempDir, "last-message.txt"), cleanupPath: tempDir };
}

async function cleanupAgentTempPath(cleanupPath: string | undefined): Promise<void> {
  if (!cleanupPath) return;
  await fs.rm(cleanupPath, { recursive: true, force: true }).catch(() => {});
}

export async function callAgent(prompt: string, debugLabel?: string): Promise<string> {
  const provider = await getConfiguredAgentProvider();
  const rootPath = getCurrentRootPath();
  const fullPrompt = await buildPromptWithProfiles(prompt);
  const promptPreview = prompt.slice(0, 80).replace(/\n/g, " ");
  const startTime = Date.now();
  const label = debugLabel ?? "unknown";
  const runId = Math.random().toString(36).slice(2, 8);
  const debugDir = shouldWriteAgentDebugLogs() ? path.join(rootPath, ".debug") : undefined;
  const debugFile = debugDir ? path.join(debugDir, `${provider}-${label}-${runId}.txt`) : undefined;

  debugLog(`[callAgent:${provider}] Starting: "${promptPreview}..."`);

  if (debugFile && debugDir) {
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(debugFile, `=== PROMPT ===\n${fullPrompt}\n`, "utf-8");
    console.log(`[callAgent:${provider}] Debug log: ${debugFile}`);
  }

  const { outputPath, cleanupPath } = await prepareCodexOutputPath(provider, label, runId, debugDir);
  const model = await getConfiguredAgentModel(provider);
  const commandSpec = buildAgentCommandSpec(provider, "text", { rootPath, outputPath, model });

  return spawnAgentForText(provider, commandSpec, fullPrompt, {
    cwd: rootPath,
    cleanupPath,
    debugFile,
    outputPath,
    promptPreview,
    startTime,
  });
}

export async function callAgentWithFileAccess(prompt: string, filePath: string): Promise<string> {
  const provider = await getConfiguredAgentProvider();
  const rootPath = getCurrentRootPath();
  const runId = Math.random().toString(36).slice(2, 8);
  const debugDir = shouldWriteAgentDebugLogs() ? path.join(rootPath, ".debug") : undefined;
  const debugFile = debugDir ? path.join(debugDir, `${provider}-file-${runId}.txt`) : undefined;
  if (debugDir && debugFile) {
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(debugFile, `=== PROMPT ===\n${prompt}\n`, "utf-8");
    console.log(`[callAgent:${provider}] Debug log: ${debugFile}`);
  }
  const { outputPath, cleanupPath } = await prepareCodexOutputPath(provider, "file", runId, debugDir);
  const model = await getConfiguredAgentModel(provider);
  const commandSpec = buildAgentCommandSpec(provider, "file", { rootPath, filePath, outputPath, model });

  return spawnAgentForText(provider, commandSpec, prompt, {
    cwd: rootPath,
    cleanupPath,
    debugFile,
    outputPath,
    promptPreview: prompt.slice(0, 80).replace(/\n/g, " "),
    startTime: Date.now(),
  });
}

function spawnAgentForText(
  provider: AgentProvider,
  commandSpec: ReturnType<typeof buildAgentCommandSpec>,
  prompt: string,
  options: {
    cwd: string;
    cleanupPath?: string;
    promptPreview: string;
    startTime: number;
    debugFile?: string;
    outputPath?: string;
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(commandSpec.command, commandSpec.args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: options.cwd,
      env: commandSpec.env,
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      proc.kill();
      const elapsed = ((Date.now() - options.startTime) / 1000).toFixed(1);
      void cleanupAgentTempPath(options.cleanupPath);
      reject(new Error(`${AGENT_PROVIDER_DETAILS[provider].label} timed out after ${elapsed}s: "${options.promptPreview}..."`));
    }, AGENT_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", async (code) => {
      clearTimeout(timeout);
      const elapsed = ((Date.now() - options.startTime) / 1000).toFixed(1);
      if (killed) return;

      if (code === 0) {
        try {
          debugLog(`[callAgent:${provider}] Done in ${elapsed}s (${stdout.length} chars)`);
          const finalOutput = options.outputPath
            ? await fs.readFile(options.outputPath, "utf-8").then((content) => content.trim()).catch(() => stdout.trim())
            : stdout.trim();
          if (options.debugFile) {
            await fs.appendFile(options.debugFile, `\n=== RESPONSE ===\n${stdout}\n`);
          }
          await cleanupAgentTempPath(options.cleanupPath);
          resolve(finalOutput);
        } catch (error) {
          await cleanupAgentTempPath(options.cleanupPath);
          reject(error);
        }
      } else {
        const message = stderr || `${AGENT_PROVIDER_DETAILS[provider].label} exited with code ${code}`;
        console.error(`[callAgent:${provider}] Failed (code ${code}) in ${elapsed}s: ${message.slice(0, 200)}`);
        await cleanupAgentTempPath(options.cleanupPath);
        reject(new Error(message));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      void cleanupAgentTempPath(options.cleanupPath);
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export function getAgentChatCommand(provider: AgentProvider, cwd: string, model?: string): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  return buildAgentCommandSpec(provider, "chat", { rootPath: getCurrentRootPath(), cwd, model });
}

export async function getAgentStatus(provider: AgentProvider): Promise<AgentStatus> {
  const commandSpec = buildAgentCommandSpec(provider, "status", { rootPath: getCurrentRootPath() });
  const definition = AGENT_CLI_PROVIDERS[provider];

  return new Promise((resolve) => {
    const proc = spawn(commandSpec.command, commandSpec.args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: commandSpec.env,
    });

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      proc.kill();
      resolve(definition.classifyStatus({
        stdout,
        stderr,
        timedOut: true,
        timeoutSeconds: STATUS_TIMEOUT_MS / 1000,
      }, commandSpec.command));
    }, STATUS_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve(definition.classifyStatus({ code, stdout, stderr }, commandSpec.command));
    });

    proc.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      resolve(definition.classifyStatus({ stdout, stderr, error }, commandSpec.command));
    });
  });
}

export async function getAgentStatuses(): Promise<Record<AgentProvider, AgentStatus>> {
  const [claude, codex] = await Promise.all([
    getAgentStatus("claude"),
    getAgentStatus("codex"),
  ]);

  return { claude, codex };
}
