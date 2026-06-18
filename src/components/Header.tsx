"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Bot, Settings } from "lucide-react";
import { theme } from "@/lib/theme";
import { Logo } from "@/components/Icons";
import { AGENT_PROVIDER_DETAILS, type AgentProvider, type AgentStatus } from "@/lib/agentTypes";

interface HeaderProps {
  palette: Record<number, string>;
  onOpenSettings: () => void;
  agentProvider: AgentProvider;
  agentStatus?: AgentStatus;
  agentStatusLoading?: boolean;
}

export function Header({ palette, onOpenSettings, agentProvider, agentStatus, agentStatusLoading }: HeaderProps) {
  const router = useRouter();
  const agentDetails = AGENT_PROVIDER_DETAILS[agentProvider];
  const isReady = agentStatus?.state === "ready";
  const isChecking = agentStatusLoading || !agentStatus;
  const statusText = isChecking
    ? "Checking"
    : isReady
      ? `${agentDetails.shortLabel} connected`
      : `${agentDetails.shortLabel} not connected`;

  return (
    <header
      className="h-12 flex-shrink-0 border-b flex items-center justify-between px-4"
      style={{ borderColor: theme.border }}
    >
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer"
      >
        <Logo className="w-5 h-5" color={palette[600]} />
        <span className="font-semibold">Second Brain</span>
      </button>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors hover:bg-black/5"
          style={{ borderColor: theme.border, color: isReady ? palette[700] : theme.textMuted }}
          title={agentStatus?.message ?? "Agent status"}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isReady ? palette[500] : isChecking ? theme.textLight : "#f59e0b" }}
          />
          <Bot className="w-3.5 h-3.5" />
          <span>{statusText}</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" style={{ color: theme.textMuted }} />
        </button>
      </div>
    </header>
  );
}
