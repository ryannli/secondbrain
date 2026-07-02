"use client";

import React from "react";
import { AlertCircle, Bot, CheckCircle2, RefreshCw, Terminal } from "lucide-react";
import { AGENT_PROVIDER_DETAILS, type AgentProvider, type AgentStatus } from "@/lib/agentTypes";
import { theme } from "@/lib/theme";
import { Logo } from "@/components/Icons";

interface AgentModeGateProps {
  palette: Record<number, string>;
  agentProvider: AgentProvider;
  onAgentProviderChange: (provider: AgentProvider) => void;
  agentStatuses: Record<AgentProvider, AgentStatus> | null;
  agentStatusLoading: boolean;
  onRefreshAgentStatus: () => void;
  onEnableAgentMode: () => void;
}

const AGENT_OPTIONS: AgentProvider[] = ["claude", "codex"];

export function AgentModeGate({
  palette,
  agentProvider,
  onAgentProviderChange,
  agentStatuses,
  agentStatusLoading,
  onRefreshAgentStatus,
  onEnableAgentMode,
}: AgentModeGateProps) {
  const selectedStatus = agentStatuses?.[agentProvider];
  const selectedDetails = AGENT_PROVIDER_DETAILS[agentProvider];
  const selectedReady = selectedStatus?.state === "ready";

  const stateLabel = (status?: AgentStatus) => {
    if (!status) return "Checking";
    if (status.state === "ready") return "Connected";
    if (status.state === "missing") return "Not installed";
    return "Needs attention";
  };

  const stateColor = (status?: AgentStatus) => {
    if (!status) return theme.textLight;
    if (status.state === "ready") return palette[600];
    if (status.state === "missing") return "#b45309";
    return "#b91c1c";
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <header className="h-14 flex items-center px-5 border-b" style={{ borderColor: theme.border }}>
        <div className="flex items-center gap-2.5">
          <Logo className="w-5 h-5" color={palette[600]} />
          <span className="font-semibold">Second Brain</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="mb-7">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: `${palette[500]}14` }}
            >
              <Bot className="w-5 h-5" style={{ color: palette[600] }} />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Enable Agent Mode</h1>
            <p className="text-sm leading-relaxed max-w-xl" style={{ color: theme.textMuted }}>
              Second Brain needs a connected local agent CLI before the workspace opens. Choose Claude Code or Codex CLI, confirm it is connected, then enable Agent Mode.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {AGENT_OPTIONS.map((provider) => {
              const details = AGENT_PROVIDER_DETAILS[provider];
              const status = agentStatuses?.[provider];
              const isSelected = agentProvider === provider;
              const isReady = status?.state === "ready";

              return (
                <button
                  key={provider}
                  onClick={() => onAgentProviderChange(provider)}
                  className="text-left rounded-lg border px-4 py-4 transition-all min-w-0 overflow-hidden"
                  style={{
                    borderColor: isSelected ? palette[500] : theme.border,
                    backgroundColor: isSelected ? `${palette[500]}0F` : "transparent",
                  }}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 font-medium">
                        <Terminal className="w-4 h-4" />
                        {details.label}
                      </div>
                      <div className="text-xs mt-1 min-w-0 break-words" style={{ color: theme.textMuted }}>
                        Command: <code className="break-all whitespace-normal">{status?.command ?? details.command}</code>
                      </div>
                    </div>
                    {isReady ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: palette[600] }} />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: stateColor(status) }} />
                    )}
                  </div>
                  <div className="text-xs" style={{ color: stateColor(status) }}>
                    {status?.version || stateLabel(status)}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="rounded-lg border px-4 py-4 mb-5"
            style={{ borderColor: selectedReady ? palette[500] : theme.border }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium mb-1">{selectedDetails.label}</div>
                <p className="text-xs leading-relaxed" style={{ color: theme.textMuted }}>
                  {selectedStatus?.message ?? "Checking local CLI status..."}
                </p>
              </div>
              <span
                className="px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                style={{
                  color: stateColor(selectedStatus),
                  backgroundColor: selectedReady ? `${palette[500]}15` : "rgba(245, 158, 11, 0.12)",
                }}
              >
                {stateLabel(selectedStatus)}
              </span>
            </div>

            {selectedStatus && !selectedReady && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: theme.border }}>
                <p className="text-xs font-medium mb-2">Get connected:</p>
                <ol className="text-xs space-y-1.5 list-decimal list-inside" style={{ color: theme.textMuted }}>
                  <li>
                    Install:{" "}
                    <code className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${palette[500]}0F` }}>
                      {selectedDetails.installCommand}
                    </code>
                  </li>
                  <li>
                    Sign in: run{" "}
                    <code className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${palette[500]}0F` }}>
                      {selectedDetails.command}
                    </code>{" "}
                    once in your terminal and follow the login prompts
                  </li>
                  <li>Come back and hit Refresh status</li>
                </ol>
                <a
                  href={selectedDetails.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs hover:underline"
                  style={{ color: palette[600] }}
                >
                  {selectedDetails.label} setup guide →
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={onEnableAgentMode}
              disabled={!selectedReady}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: palette[600] }}
            >
              Enable Agent Mode
            </button>
            <button
              onClick={onRefreshAgentStatus}
              disabled={agentStatusLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium disabled:opacity-50"
              style={{ borderColor: theme.border, color: theme.textMuted }}
            >
              <RefreshCw className={`w-4 h-4 ${agentStatusLoading ? "animate-spin" : ""}`} />
              Refresh status
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
