# Second Brain

A persistent cognitive workspace that manages information flow for knowledge workers.

**The Problem**: AI content grows exponentially, but human attention scales linearly.

**The Solution**: AI handles information triage and organization; humans focus on judgment and decisions.

## Core Principle: Everything is a Local File

Your library is just a folder on your computer. Every source, every analysis, every piece of metadata is a plain file you can read, edit, or move with any tool.

**The UI is just a view.** It renders what's in your filesystem and writes changes back to it. There's no database, no cloud sync, no lock-in. Edit a file directly, and the UI updates. Reorganize folders however you like.

This means:
- **You own your data** — it's just markdown and JSON files
- **AI outputs are editable** — don't like the summary? Edit the file
- **Use any tool** — grep, git, scripts, whatever works for you
- **Offline by default** — everything works without internet (except AI analysis)
- **AI agents work natively** — coding agents like Claude Code can read, edit, and organize your library directly through the filesystem

## Features

- **URL Capture**: Paste any URL to extract and analyze content
- **AI Triage**: Get a recommendation score (0-100) for how much attention content deserves
- **Dual Analysis**:
  - **Digest**: Summary, key highlights, concepts
  - **Critique**: Hidden assumptions, potential issues, verification needs
- **Library Organization**: Tree-based file organization with user-created folders

## How Data is Stored

Each source lives in its own folder:

```
library/{id}/
├── original.html    # Raw capture (immutable - never overwritten)
├── source.md        # Processed content (regeneratable)
├── analysis.json    # AI analysis (regeneratable)
└── README.md        # Human-readable triage card
```

**Original vs Derived**: The `original.html` is captured once and preserved forever. Everything else (processed content, analysis) can be regenerated from it. This means you can always re-analyze with improved AI without losing the source material.

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Content Extraction**: Mozilla Readability + JSDOM
- **AI Integration**: Claude Code CLI (subprocess, no API key needed)
- **Storage**: Local filesystem (markdown + JSON)

## Getting Started

### Prerequisites

- Node.js 20+
- [Claude Code CLI](https://claude.ai/claude-code) installed and authenticated

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

Set library path in `config.json` or via the app settings.

## Chrome Extension

A companion Chrome extension for one-click capture from any webpage.

### Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `/extension` folder from this repository

### Usage

- Click the extension icon on any webpage to capture it
- Or right-click and select "Save to Second Brain"
- The page will be sent to your local Second Brain for AI analysis

## License

MIT
