---
title: "Second Brain is now open source"
readStatus: "read"
lastReadAt: "2026-07-03T21:01:32.589Z"
totalReadTimeSeconds: 21
---

# Second Brain is now open source

Second Brain, a local-first reading workspace that puts an AI triage layer between the internet and your attention, is now open source under the MIT license.

The project takes a contrarian position in the read-it-later category: saving was never the hard part. Every capture is scored and given a verdict before it asks for a minute of your time, analysis is split into a digest for understanding and a critique for evaluation, and new material is checked against everything you have already read.

Three design decisions stand out:

- **No new subscription.** Analysis runs through the coding agent you already use — Claude Code or Codex CLI — so there is no separate model API key to buy.
- **Plain files, no lock-in.** Every source is a folder of markdown and JSON on your own disk. The originals are immutable; everything derived can be regenerated.
- **The agent works in your workspace.** The same files the app renders are the agent's working surface: it can reorganize your library, maintain a memory of what you know, and draft briefs into your notebook.

The web app runs locally with Node 20+. A Chrome extension handles one-click capture, including logged-in pages. Contributions are welcome — the maintainers note that the roadmap is negotiable, but the philosophy isn't.
