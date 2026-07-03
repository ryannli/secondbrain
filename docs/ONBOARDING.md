# Onboarding Guide

The README sells the product; this guide gets you from `git clone` to *feeling* it — a working app, your first capture, and your first "skip this one" verdict. Budget: about 10 minutes.

## 1. Prerequisites (one-time)

- **Node.js 20+**
- **One local agent CLI, signed in.** All AI analysis runs through it — no model API key needed:

| Provider | Install | Sign in |
| --- | --- | --- |
| Claude Code | `npm install -g @anthropic-ai/claude-code` | run `claude` once |
| OpenAI Codex | `npm install -g @openai/codex` | run `codex` once |

Either works. Pick the one you already use.

## 2. Run the app

```bash
git clone https://github.com/ryannli/secondbrain.git
cd secondbrain
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first launch, Second Brain seeds an empty `user_data/` with a small ready-made brain — two analyzed example sources, one Notebook synthesis, preference files — so the first screen is never blank. The seed never overwrites existing files.

## 3. Connect your agent

The Agent Mode gate appears first. Choose your provider and confirm it shows **Connected**, then enter the workspace.

- The status check only runs `--version`; no content is sent.
- If nothing connects, fix the CLI sign-in first — Second Brain deliberately doesn't open a reduced, agent-less workspace.

## 4. Your first ten minutes

This is the part that matters. Do these in order:

1. **Open a seeded example** from the Library sidebar. Read the triage card on the right: score, read-time, verdict, and why. This is the core loop — a verdict *before* you invest attention.
2. **Check the Digest and Critique tabs.** Digest helps you understand; Critique tells you what to be skeptical about — hidden assumptions, claims needing verification.
3. **Capture something real.** Paste any article URL into the dashboard input and hit Capture. Watch it process, then compare the verdict against your own read of it.
4. **Look at Connections.** If your new capture overlaps or conflicts with the examples, the analysis panel will say so.
5. **Ask the agent something.** Open the panel on the right (sparkle icon) and ask "what's in my library?" or select text in an article and add it as context. The agent reads the same files you do.
6. **Visit For You.** The feed starts in RSS-only mode with high-signal defaults. Add your own feeds in Settings → Feed.

## 5. Chrome extension (optional, recommended)

The web app handles pasted text, public URLs, PDFs, and images. Install the extension when you want one-click capture and pages the server can't see — logged-in, JS-rendered, Twitter/X.

1. Open `chrome://extensions`, enable Developer mode.
2. Click **Load unpacked**, select the `extension/` folder.
3. A **welcome page opens automatically**: it checks the connection to your local app, demos the floating capture button, and has preference toggles (floating button on every page; X/Twitter bookmark auto-capture). Reopen it anytime via right-click on the extension icon → **Options**.
4. Try it: open any article, click the floating Capture button (or the pinned toolbar icon), then click the "Captured!" toast to jump to the analysis.

Chrome can't silently install unpacked extensions — manual loading is expected during development. A Web Store release will make this one click.

## 6. Configuration (when you need it)

**Broader feed search** — optional. The feed works on RSS alone; add a [Brave Search API key](https://brave.com/search/api/) for wider coverage:

```bash
cp .env.example .env.local
# paste your key into BRAVE_SEARCH_API_KEY, then restart npm run dev
```

Environment variables load at server startup — a shell `export` works but is easy to lose; prefer `.env.local`. Never commit it.

**Data location** — defaults to `./user_data`. Point it elsewhere with `SECONDBRAIN_ROOT=~/SecondBrain npm run dev`, or change it in Settings (saved to `.secondbrain.local.json`, git-ignored).

**Personalization files** — at your data root:

- `USER.md` — your explicit preferences, editable in-app (sidebar → User). Included in agent prompts.
- `MEMORY.md` — the agent's own notes about your interests and patterns, updated as you chat (sidebar → Memory). Yours to edit or prune.

## Clean Public Repo Checklist

- Keep real `user_data/` out of git.
- Keep `.env.local` out of git.
- Keep agent prompt/response debug logs disabled unless actively developing (`SECONDBRAIN_AGENT_DEBUG_LOGS=1`).
- Keep `AGENTS.md` as the canonical contributor/agent instruction file.
- Keep `CLAUDE.md` as a symlink to `AGENTS.md` in both the repo root and seeded data folders.
