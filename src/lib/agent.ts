import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { AGENT_PROVIDER_DETAILS, DEFAULT_AGENT_PROVIDER, AgentProvider, AgentStatus, isAgentProvider } from "./agentTypes";
import { AGENT_CLI_PROVIDERS, buildAgentCommandSpec } from "./agentProviders";
import { getCurrentRootPath, loadProfileDoc, loadUserConfig } from "./storage";

const AGENT_TIMEOUT_MS = 10 * 60 * 1000;
const STATUS_TIMEOUT_MS = 8 * 1000;

let profileCache: { userProfile: string; memoryProfile: string } | null = null;

async function loadUserProfiles(): Promise<{ userProfile: string; memoryProfile: string }> {
  if (!profileCache) {
    const [userProfile, memoryProfile] = await Promise.all([
      loadProfileDoc("USER").catch(() => ""),
      loadProfileDoc("MEMORY").catch(() => ""),
    ]);
    profileCache = { userProfile, memoryProfile };
  }
  return profileCache;
}

export function invalidateAgentProfileCache(): void {
  profileCache = null;
}

export async function getConfiguredAgentProvider(): Promise<AgentProvider> {
  if (isAgentProvider(process.env.SECONDBRAIN_AGENT_PROVIDER)) {
    return process.env.SECONDBRAIN_AGENT_PROVIDER;
  }

  const config = await loadUserConfig();
  return isAgentProvider(config.agentProvider) ? config.agentProvider : DEFAULT_AGENT_PROVIDER;
}

async function buildPromptWithProfiles(prompt: string): Promise<string> {
  const { userProfile, memoryProfile } = await loadUserProfiles();
  const profileParts: string[] = [];
  if (userProfile) profileParts.push(`<user-preferences file="USER.md">\n${userProfile}\n</user-preferences>`);
  if (memoryProfile) profileParts.push(`<user-memory file="MEMORY.md">\n${memoryProfile}\n</user-memory>`);

  return profileParts.length > 0
    ? `You MUST follow the instructions in <user-preferences>.\n\n${profileParts.join("\n\n")}\n\n${prompt}`
    : prompt;
}

export async function callAgent(prompt: string, debugLabel?: string): Promise<string> {
  const provider = await getConfiguredAgentProvider();
  const fullPrompt = await buildPromptWithProfiles(prompt);
  const promptPreview = prompt.slice(0, 80).replace(/\n/g, " ");
  const startTime = Date.now();

  console.log(`[callAgent:${provider}] Starting: "${promptPreview}..."`);

  const debugDir = path.join(getCurrentRootPath(), ".debug");
  const randomId = Math.random().toString(36).slice(2, 8);
  const debugFile = path.join(debugDir, `${provider}-${debugLabel ?? "unknown"}-${randomId}.txt`);
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(debugFile, `=== PROMPT ===\n${fullPrompt}\n`, "utf-8");
  console.log(`[callAgent:${provider}] Debug log: ${debugFile}`);

  const outputPath = provider === "codex"
    ? path.join(debugDir, `${provider}-${debugLabel ?? "unknown"}-${randomId}-last-message.txt`)
    : undefined;
  const commandSpec = buildAgentCommandSpec(provider, "text", { rootPath: getCurrentRootPath(), outputPath });

  return spawnAgentForText(provider, commandSpec, fullPrompt, {
    cwd: getCurrentRootPath(),
    debugFile,
    outputPath,
    promptPreview,
    startTime,
  });
}

export async function callAgentWithFileAccess(prompt: string, filePath: string): Promise<string> {
  const provider = await getConfiguredAgentProvider();
  const rootPath = getCurrentRootPath();
  const randomId = Math.random().toString(36).slice(2, 8);
  const outputPath = provider === "codex"
    ? path.join(rootPath, ".debug", `${provider}-file-${randomId}-last-message.txt`)
    : undefined;
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
  }
  const commandSpec = buildAgentCommandSpec(provider, "file", { rootPath, filePath, outputPath });

  return spawnAgentForText(provider, commandSpec, prompt, {
    cwd: rootPath,
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
      reject(new Error(`${AGENT_PROVIDER_DETAILS[provider].label} timed out after ${elapsed}s: "${options.promptPreview}..."`));
    }, AGENT_TIMEOUT_MS);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      const elapsed = ((Date.now() - options.startTime) / 1000).toFixed(1);
      if (killed) return;

      if (code === 0) {
        console.log(`[callAgent:${provider}] Done in ${elapsed}s (${stdout.length} chars)`);
        const finalOutput = options.outputPath
          ? fs.readFile(options.outputPath, "utf-8").then((content) => content.trim()).catch(() => stdout.trim())
          : Promise.resolve(stdout.trim());
        if (options.debugFile) {
          fs.appendFile(options.debugFile, `\n=== RESPONSE ===\n${stdout}\n`).catch(() => {});
        }
        finalOutput.then(resolve, reject);
      } else {
        const message = stderr || `${AGENT_PROVIDER_DETAILS[provider].label} exited with code ${code}`;
        console.error(`[callAgent:${provider}] Failed (code ${code}) in ${elapsed}s: ${message.slice(0, 200)}`);
        reject(new Error(message));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export function getAgentChatCommand(provider: AgentProvider, cwd: string): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  return buildAgentCommandSpec(provider, "chat", { rootPath: getCurrentRootPath(), cwd });
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
