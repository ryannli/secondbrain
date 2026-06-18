# Onboarding Guide

This guide is intentionally more operational than the README. The README should sell the product; this file should help a user or their coding agent get to a working first run.

## Recommended Setup

Use the web app:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

On first launch, Second Brain automatically creates a small ready-made brain under `user_data/` if the data folder is empty, so the first screen is not blank. The starter data includes library examples, one Studio synthesis, `USER.md`, `AGENTS.md`, a `CLAUDE.md` compatibility symlink, and `DataSchema.md`.

## Choosing An Agent Provider

Second Brain does not require Claude Code specifically. It needs one local agent CLI for AI analysis and the Ask panel.

Currently supported:

| Provider | Command | Use it when |
| --- | --- | --- |
| Claude Code | `claude` | You already use Claude Code locally. |
| OpenAI Codex | `codex` | You already use Codex CLI or OpenAI login. |

On first launch, Second Brain opens an Agent Mode gate. Choose a provider and confirm the CLI is connected before entering the workspace. The status check only runs `--version`; it does not send source content.

If no provider is connected, the app should not open a reduced workspace. The product experience depends on agent-backed capture analysis, feed ranking, and Ask.

## Chrome Extension

The extension is optional.

It is useful for logged-in and JavaScript-rendered pages because the extension can read the page as your browser sees it. The web app alone can still handle pasted text, public URLs, PDFs, images, and RSS.

For development:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension/` folder.

Normal websites and local apps cannot silently install unpacked Chrome extensions. A future Chrome Web Store release can provide one-click installation, but users still have to approve it.

## Search API

Second Brain works without Brave Search. In that mode, the feed uses RSS-only defaults.

To enable broader web search:

```bash
cp .env.example .env.local
```

Then paste your Brave Search API key into `.env.local`:

```bash
BRAVE_SEARCH_API_KEY=your_key_here
```

Restart `npm run dev` after changing `.env.local`. Next.js loads environment variables at server startup, so running `export BRAVE_SEARCH_API_KEY=...` in a shell is only temporary and easy to lose.

If the key is missing, the app should keep working and show an RSS-only notice instead of presenting the feed as broken. Never commit `.env.local`; commit `.env.example` only.

## User Preferences

`USER.md` carries explicit user preferences. It is user-maintained, editable from the app, and included in agent prompts when present.

## Clean Public Repo Checklist

- Keep real `user_data/` out of git.
- Keep `.env.local` out of git.
- Keep agent prompt/response debug logs disabled unless you are actively developing with `SECONDBRAIN_AGENT_DEBUG_LOGS=1`.
- Keep `AGENTS.md` as the canonical contributor/agent instruction file.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md` in both the repo root and seeded data folders.
