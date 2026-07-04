"use client";

import React, { useState } from "react";
import { FolderOpen, ScanSearch, Sparkles, SquareArrowOutUpRight, FileText } from "lucide-react";
import { theme } from "@/lib/theme";

interface OnboardingCardsProps {
  rootPath: string;
  palette: Record<number, string>;
  onComplete: () => void;
}

/** High-level workspace structure — card 1's visual. */
function FolderVisual({ palette }: { palette: Record<number, string> }) {
  const row = "flex items-center gap-2 text-xs";
  return (
    <div
      className="mx-auto w-72 rounded-xl border p-4 text-left space-y-2"
      style={{ borderColor: theme.border, backgroundColor: "white" }}
    >
      <div className={row} style={{ color: theme.text }}>
        <FolderOpen className="w-3.5 h-3.5" style={{ color: palette[500] }} />
        <span className="font-medium">library/</span>
        <span className="ml-auto text-[10px]" style={{ color: theme.textLight }}>what you capture</span>
      </div>
      <div className={`${row} pl-5`} style={{ color: theme.textMuted }}>
        <FileText className="w-3.5 h-3.5" />
        <span>That great article you saved</span>
      </div>
      <div className={`${row} pl-5`} style={{ color: theme.textMuted }}>
        <FileText className="w-3.5 h-3.5" />
        <span>The paper from last week</span>
      </div>
      <div className={row} style={{ color: theme.text }}>
        <FolderOpen className="w-3.5 h-3.5" style={{ color: palette[500] }} />
        <span className="font-medium">notebook/</span>
        <span className="ml-auto text-[10px]" style={{ color: theme.textLight }}>what you write with your agent</span>
      </div>
      <div className={`${row} pl-5`} style={{ color: theme.textMuted }}>
        <FileText className="w-3.5 h-3.5" />
        <span>A brief connecting the two</span>
      </div>
    </div>
  );
}

/** Verdict chips — card 2's visual: most things get filtered, the signal surfaces. */
function TriageVisual({ palette }: { palette: Record<number, string> }) {
  const items = [
    { title: "The one that connects to what you read last week", badge: "Must Read", strong: true },
    { title: "Useful, but you know most of it already", badge: "Skim", strong: false },
    { title: "Forty more just like it", badge: "Skip", strong: false },
  ];
  return (
    <div className="mx-auto w-72 space-y-1.5 text-left">
      {items.map((item) => (
        <div
          key={item.badge}
          className="flex items-center gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: item.strong ? palette[500] : theme.border,
            backgroundColor: item.strong ? "white" : "transparent",
            opacity: item.strong ? 1 : 0.55,
          }}
        >
          <span className="flex-1 text-xs truncate" style={{ color: theme.text }}>
            {item.title}
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] font-medium rounded-md whitespace-nowrap"
            style={
              item.strong
                ? { backgroundColor: `${palette[600]}30`, color: palette[700], border: `1px solid ${palette[600]}` }
                : { backgroundColor: theme.borderLight, color: theme.textMuted }
            }
          >
            {item.badge}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Chat exchange — card 3's visual: the agent alongside, library as context. */
function AgentVisual({ palette }: { palette: Record<number, string> }) {
  return (
    <div className="mx-auto w-72 space-y-2 text-left text-xs">
      <div
        className="ml-10 rounded-xl rounded-br-sm px-3 py-2 text-white"
        style={{ backgroundColor: palette[600] }}
      >
        What should I read next?
      </div>
      <div
        className="mr-10 rounded-xl rounded-bl-sm border px-3 py-2"
        style={{ borderColor: theme.border, backgroundColor: "white", color: theme.text }}
      >
        The agents piece — it contradicts what you read about autonomy last week.
      </div>
    </div>
  );
}

/**
 * Shown once, right after Agent Mode is enabled for a fresh workspace.
 * Three cards that set expectations before the dashboard appears.
 */
export function OnboardingCards({ rootPath, palette, onComplete }: OnboardingCardsProps) {
  const [step, setStep] = useState(0);
  // Local dismissal: exiting must never depend on the parent's state or a
  // network round-trip — a stalled save should not strand the user here.
  const [done, setDone] = useState(false);

  if (done) return null;

  const finish = () => {
    setDone(true);
    onComplete();
  };

  const cards = [
    {
      icon: FolderOpen,
      title: "It all lives on your disk",
      visual: <FolderVisual palette={palette} />,
      body: (
        <>
          <p>
            Everything you capture becomes plain files in a folder you own — nothing leaves your
            machine except what your own agent reads.
          </p>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs">
            <code
              className="px-2 py-1 rounded-md"
              style={{ backgroundColor: `${palette[500]}0F`, color: palette[700] }}
            >
              {rootPath}
            </code>
            <button
              onClick={() =>
                fetch("/api/reveal", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ target: "root" }),
                })
              }
              className="inline-flex items-center gap-1 hover:underline"
              data-track="onboarding.reveal_root"
              style={{ color: palette[600] }}
            >
              <SquareArrowOutUpRight className="w-3.5 h-3.5" />
              Open it
            </button>
          </div>
        </>
      ),
    },
    {
      icon: ScanSearch,
      title: "Know what to ignore",
      visual: <TriageVisual palette={palette} />,
      body: (
        <p>
          Every capture is scored and connected to what you already know, so the high-value reads
          surface — and the noise stops competing for your attention. The verdict is a
          recommendation; the judgment stays yours.
        </p>
      ),
    },
    {
      icon: Sparkles,
      title: "An agent rides along",
      visual: <AgentVisual palette={palette} />,
      body: (
        <p>
          From your first capture to your daily feed, the same agent is beside you — filtering,
          connecting new reads to old ones, remembering what you know. Ask it anything; your whole
          library is its context.
        </p>
      ),
    },
  ];

  const card = cards[Math.min(step, cards.length - 1)];
  const isLast = step >= cards.length - 1;
  const Icon = card.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(250, 250, 249, 0.97)" }}
    >
      <button
        onClick={finish}
        className="absolute top-5 right-6 text-xs hover:underline"
        data-track="onboarding.skip"
        style={{ color: theme.textMuted }}
      >
        Skip
      </button>

      <div key={step} className="w-full max-w-lg px-8 text-center animate-[fadeSlideUp_0.35s_ease-out_both]">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: `${palette[500]}14` }}
        >
          <Icon className="w-6 h-6" style={{ color: palette[600] }} />
        </div>

        <h2 className="text-2xl font-semibold mb-4" style={{ color: theme.text }}>
          {card.title}
        </h2>

        <div className="mb-5">{card.visual}</div>

        <div className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: theme.textMuted }}>
          {card.body}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-7 mb-6">
          {cards.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i === step ? palette[500] : theme.border }}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? finish() : setStep(step + 1))}
          className="px-5 py-2.5 rounded-lg text-sm font-medium text-white"
          data-track={isLast ? "onboarding.enter" : "onboarding.next"}
          style={{ backgroundColor: palette[600] }}
        >
          {isLast ? "Enter your Second Brain" : "Next"}
        </button>
      </div>
    </div>
  );
}
