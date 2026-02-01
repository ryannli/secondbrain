"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { theme } from "@/lib/theme";
import { Logo } from "@/components/Icons";

interface HeaderProps {
  palette: Record<number, string>;
  onOpenSettings: () => void;
}

export function Header({ palette, onOpenSettings }: HeaderProps) {
  const router = useRouter();

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
      <button
        onClick={onOpenSettings}
        className="p-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
        title="Settings"
      >
        <Settings className="w-4 h-4" style={{ color: theme.textMuted }} />
      </button>
    </header>
  );
}
