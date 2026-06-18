# Onboarding Guide

This guide is intentionally more operational than the README. The README should sell the product; this file should help a user or their coding agent get to a working first run.

## Recommended Setup

Use the web app:

```bash
npm install
npm run import:sample
npm run dev
```

Then open:

```text
http://localhost:3000
```

The sample data creates a small ready-made brain under `user_data/` so the first screen is not empty.

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
BRAVE_SEARCH_API_KEY=... npm run dev
```

If the key is missing, the app should keep working and show an RSS-only notice instead of presenting the feed as broken.

## Sample Data

Run:

```bash
npm run import:sample
```

The script copies missing files from `sample_data/` into `user_data/`. It does not overwrite existing files.

Sample data includes:

- `USER.md`
- a minimal user-data `CLAUDE.md`
- default feed config
- default agent provider setting
- two processed library entries
- ready `analysis.json`
- cross-source connections

## USER.md And MEMORY.md

`USER.md` should carry explicit user preferences and is useful in first-run onboarding.

`MEMORY.md` is currently optional and advanced. It can be used for accumulated user/library memory, but it is not important enough to show during first-run setup yet. If it remains underused, merge its useful role into `USER.md` or hide it from the default UI.

## Clean Public Repo Checklist

- Keep real `user_data/` out of git.
- Keep `.env.local` out of git.
- Do not commit prompt debug logs.
- Keep `AGENTS.md` as the canonical contributor/agent instruction file.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md`.
