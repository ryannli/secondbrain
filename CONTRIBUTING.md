# Contributing to Second Brain

Thanks for your interest in contributing. This is a small, early-stage project — practical contributions of any size are welcome.

## Dev setup

Follow the [Quick Start](README.md#quick-start) in the README (Node 20+, plus a signed-in `claude` or `codex` CLI). Then:

```bash
npm install
npm run dev     # app at http://localhost:3000
```

## Before you open a PR

```bash
npm test        # vitest — must pass
npm run lint    # eslint — no errors
npm run build   # next build — must succeed
```

- Keep changes focused: one fix or feature per PR.
- Match the existing code style; don't reformat unrelated code.
- Add or update a test when you change behavior.
- Update README.md if setup, configuration, or features changed.

## Project principles

The short version (the full version lives in [AGENTS.md](AGENTS.md)):

1. **Local-first** — the filesystem is the source of truth; the web UI is a view.
2. **Originals are immutable** — never modify `meta.json` or `original.*`; everything else is derived and regenerable.
3. **Minimal code** — less code is better; deleting code is a contribution.
4. **No hardcoded cleverness** — prefer letting the agent interpret messy content over brittle parsing logic.

## Working with AI agents

This repo is agent-friendly by design. [AGENTS.md](AGENTS.md) is the canonical project context for coding agents (`CLAUDE.md` is a symlink to it). If you develop with Claude Code or Codex, they will pick it up automatically.

## Reporting issues

Open a GitHub issue with steps to reproduce. For anything security-sensitive (e.g. data leaving the local machine unexpectedly), please flag it clearly in the issue title.
