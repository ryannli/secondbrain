import path from "path";
import { accessSync, constants } from "fs";
import { AGENT_PROVIDER_DETAILS, AgentProvider, AgentStatus } from "./agentTypes";

export type AgentChatEventFormat = "claude-stream-json" | "codex-jsonl";
export type AgentChatTransport = "prompt-stdin" | "codex-app-server";

export interface AgentCommandContext {
  rootPath: string;
  cwd?: string;
  filePath?: string;
  outputPath?: string;
  model?: string; // Optional model override; empty means the CLI's own default
}

export interface AgentCommandSpec {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface AgentStatusResultInput {
  code?: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
  timedOut?: boolean;
  timeoutSeconds?: number;
}

export interface AgentCliProviderDefinition {
  id: AgentProvider;
  statusArgs: string[];
  listModelsArgs?: string[]; // Optional CLI command that enumerates available models
  chatEventFormat: AgentChatEventFormat;
  chatTransport: AgentChatTransport;
  buildTextArgs: (context: AgentCommandContext) => string[];
  buildFileArgs: (context: AgentCommandContext) => string[];
  buildChatArgs: (context: AgentCommandContext) => string[];
  resolveCommand: (env: NodeJS.ProcessEnv) => string;
  sanitizeEnv: (env: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
  classifyStatus: (input: AgentStatusResultInput, command: string) => AgentStatus;
}

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
const CODEX_COMMAND_FALLBACKS = ["/Applications/Codex.app/Contents/Resources/codex"];

function passthroughEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return env;
}

function claudeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const cleanEnv = { ...env };
  delete cleanEnv.CLAUDECODE;
  return cleanEnv;
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExistsOnPath(command: string, env: NodeJS.ProcessEnv): boolean {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return isExecutable(command);
  }

  const pathValue = env.PATH ?? "";
  return pathValue
    .split(path.delimiter)
    .filter(Boolean)
    .some((dir) => isExecutable(path.join(dir, command)));
}

export function resolveExecutableCommand(
  command: string,
  env: NodeJS.ProcessEnv,
  fallbacks: string[] = [],
): string {
  if (commandExistsOnPath(command, env)) {
    return command;
  }

  return fallbacks.find(isExecutable) ?? command;
}

function resolveAgentCommand(
  provider: AgentProvider,
  env: NodeJS.ProcessEnv,
): string {
  if (env.SECONDBRAIN_AGENT_COMMAND) return env.SECONDBRAIN_AGENT_COMMAND;
  if (provider === "claude" && env.SECONDBRAIN_CLAUDE_COMMAND) return env.SECONDBRAIN_CLAUDE_COMMAND;
  if (provider === "codex" && env.SECONDBRAIN_CODEX_COMMAND) return env.SECONDBRAIN_CODEX_COMMAND;
  const command = AGENT_PROVIDER_DETAILS[provider].command;
  if (provider === "codex") {
    return resolveExecutableCommand(command, env, CODEX_COMMAND_FALLBACKS);
  }
  return command;
}

function classifyStatus(
  provider: AgentProvider,
  input: AgentStatusResultInput,
  command: string,
): AgentStatus {
  const details = AGENT_PROVIDER_DETAILS[provider];

  if (input.timedOut) {
    return {
      provider,
      label: details.label,
      command,
      state: "error",
      message: `${details.label} did not respond to --version within ${input.timeoutSeconds ?? 8}s.`,
    };
  }

  if (input.error) {
    return {
      provider,
      label: details.label,
      command,
      state: input.error.code === "ENOENT" ? "missing" : "error",
      message: input.error.code === "ENOENT"
        ? `${details.label} command not found: ${command}. ${details.installHint}`
        : input.error.message,
    };
  }

  const version = input.stdout.trim().split("\n").at(-1)?.trim();
  if (input.code === 0) {
    return {
      provider,
      label: details.label,
      command,
      state: "ready",
      version,
      message: `${details.label} detected${version ? ` (${version})` : ""}.`,
    };
  }

  return {
    provider,
    label: details.label,
    command,
    state: "error",
    message: (input.stderr || input.stdout || `${details.label} exited with code ${input.code}`).trim(),
  };
}

export const AGENT_CLI_PROVIDERS: Record<AgentProvider, AgentCliProviderDefinition> = {
  claude: {
    id: "claude",
    statusArgs: ["--version"],
    chatEventFormat: "claude-stream-json",
    chatTransport: "prompt-stdin",
    buildTextArgs: ({ model }) => [
      "--print", "--tools", "", "--output-format", "text",
      ...(model ? ["--model", model] : []),
    ],
    buildFileArgs: ({ model }) => [
      "--print",
      "--tools", "Read",
      "--output-format", "text",
      "--permission-mode", "dontAsk",
      ...(model ? ["--model", model] : []),
    ],
    buildChatArgs: ({ model }) => [
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--permission-mode", "acceptEdits",
      "--allowedTools", "Read,Write,Edit,Bash,Glob,Grep,Task,WebSearch,WebFetch",
      "--max-turns", "30",
      ...(model ? ["--model", model] : []),
    ],
    resolveCommand: (env) => resolveAgentCommand("claude", env),
    sanitizeEnv: claudeEnv,
    classifyStatus: (input, command) => classifyStatus("claude", input, command),
  },
  codex: {
    id: "codex",
    statusArgs: ["--version"],
    listModelsArgs: ["debug", "models"],
    chatEventFormat: "codex-jsonl",
    chatTransport: "codex-app-server",
    buildTextArgs: ({ rootPath, outputPath, model }) => [
      "exec",
      "--cd", rootPath,
      "--sandbox", "read-only",
      "--skip-git-repo-check",
      "--ephemeral",
      "--color", "never",
      ...(model ? ["-m", model] : []),
      ...(outputPath ? ["--output-last-message", outputPath] : []),
      "-",
    ],
    buildFileArgs: ({ rootPath, filePath, outputPath, model }) => {
      const args = [
        "exec",
        "--cd", rootPath,
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--color", "never",
        ...(model ? ["-m", model] : []),
      ];

      if (outputPath) {
        args.push("--output-last-message", outputPath);
      }

      if (filePath && IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        args.push("-i", filePath);
      }

      args.push("-");
      return args;
    },
    buildChatArgs: ({ model }) => [
      ...(model ? ["-c", `model="${model}"`] : []),
      "app-server", "--stdio",
    ],
    resolveCommand: (env) => resolveAgentCommand("codex", env),
    sanitizeEnv: passthroughEnv,
    classifyStatus: (input, command) => classifyStatus("codex", input, command),
  },
};

export function buildAgentCommandSpec(
  provider: AgentProvider,
  mode: "text" | "file" | "chat" | "status",
  context: AgentCommandContext,
  env: NodeJS.ProcessEnv = process.env,
): AgentCommandSpec {
  const definition = AGENT_CLI_PROVIDERS[provider];
  const args = mode === "text"
    ? definition.buildTextArgs(context)
    : mode === "file"
      ? definition.buildFileArgs(context)
      : mode === "chat"
        ? definition.buildChatArgs(context)
        : definition.statusArgs;

  return {
    command: definition.resolveCommand(env),
    args,
    env: definition.sanitizeEnv(env),
  };
}
