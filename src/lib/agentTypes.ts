export type AgentProvider = "claude" | "codex";

export type AgentConnectionState = "ready" | "missing" | "error";

export interface AgentProviderDetails {
  id: AgentProvider;
  label: string;
  shortLabel: string;
  command: string;
  installHint: string;
}

export interface AgentStatus {
  provider: AgentProvider;
  label: string;
  command: string;
  state: AgentConnectionState;
  version?: string;
  message: string;
}

export const DEFAULT_AGENT_PROVIDER: AgentProvider = "claude";

export const AGENT_PROVIDER_DETAILS: Record<AgentProvider, AgentProviderDetails> = {
  claude: {
    id: "claude",
    label: "Claude Code",
    shortLabel: "Claude",
    command: "claude",
    installHint: "Install Claude Code and sign in, or switch to Codex CLI.",
  },
  codex: {
    id: "codex",
    label: "Codex CLI",
    shortLabel: "Codex",
    command: "codex",
    installHint: "Install Codex CLI and sign in with your OpenAI account, or switch to Claude Code.",
  },
};

export function isAgentProvider(value: unknown): value is AgentProvider {
  return value === "claude" || value === "codex";
}
