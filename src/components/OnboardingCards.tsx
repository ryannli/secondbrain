"use client";

import React, { useState } from "react";
import { FolderOpen, BookOpenCheck, Sparkles, SquareArrowOutUpRight } from "lucide-react";
import { theme } from "@/lib/theme";

interface OnboardingCardsProps {
  rootPath: string;
  palette: Record<number, string>;
  onComplete: () => void;
}

/**
 * Shown once, right after Agent Mode is enabled for a fresh workspace.
 * Three cards that set expectations before the dashboard appears.
 */
export function OnboardingCards({ rootPath, palette, onComplete }: OnboardingCardsProps) {
  const [step, setStep] = useState(0);

  const cards = [
    {
      icon: FolderOpen,
      title: "It all lives here",
      body: (
        <>
          <code
            className="inline-block px-2.5 py-1.5 rounded-lg text-xs mb-3"
            style={{ backgroundColor: `${palette[500]}0F`, color: palette[700] }}
          >
            {rootPath}
          </code>
          <p>
            Every capture, every analysis — plain markdown and JSON in a folder you own. Nothing
            leaves your machine except what your own agent reads.
          </p>
          <button
            onClick={() =>
              fetch("/api/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ target: "root" }),
              })
            }
            className="mt-3 inline-flex items-center gap-1.5 text-xs hover:underline"
            data-track="onboarding.reveal_root"
            style={{ color: palette[600] }}
          >
            <SquareArrowOutUpRight className="w-3.5 h-3.5" />
            Show me the folder
          </button>
        </>
      ),
    },
    {
      icon: BookOpenCheck,
      title: "The AI reads first",
      body: (
        <>
          <p>
            Every capture gets a verdict — <strong>Must Read</strong>, <strong>Skim</strong>, or{" "}
            <strong>Skip</strong> — plus a digest to understand it and a critique to challenge it.
          </p>
          <p className="mt-2">
            Analysis takes about a minute per capture. That&apos;s your agent actually reading.
          </p>
        </>
      ),
    },
    {
      icon: Sparkles,
      title: "You're not working alone",
      body: (
        <>
          <p>
            The panel on the right knows your whole library. Ask it anything, and it drafts briefs
            into your Notebook.
          </p>
          <p className="mt-2">
            The examples inside show what to expect — delete them anytime.
          </p>
        </>
      ),
    },
  ];

  const card = cards[step];
  const isLast = step === cards.length - 1;
  const Icon = card.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(250, 250, 249, 0.96)" }}
    >
      <button
        onClick={onComplete}
        className="absolute top-5 right-6 text-xs hover:underline"
        data-track="onboarding.skip"
        style={{ color: theme.textMuted }}
      >
        Skip
      </button>

      <div key={step} className="w-full max-w-md px-8 text-center animate-gentle-fade">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: `${palette[500]}14` }}
        >
          <Icon className="w-6 h-6" style={{ color: palette[600] }} />
        </div>

        <h2 className="text-2xl font-semibold mb-3" style={{ color: theme.text }}>
          {card.title}
        </h2>
        <div className="text-sm leading-relaxed" style={{ color: theme.textMuted }}>
          {card.body}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-8 mb-6">
          {cards.map((_, i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors"
              style={{ backgroundColor: i === step ? palette[500] : theme.border }}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? onComplete() : setStep(step + 1))}
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
