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
├── original.json    # Metadata at capture (immutable)
├── original.*       # Raw content file (immutable) - html, txt, pdf, png, etc.
├── content.md       # Processed content (regeneratable, editable)
├── analysis.json    # AI analysis (regeneratable)
└── README.md        # Human-readable triage card
```

### original.json Schema

```typescript
interface OriginalData {
  id: string;              // Unique 8-char ID
  created_at: string;      // ISO timestamp
  type: "html" | "text" | "document" | "image";  // File format type
  original_file: string;   // e.g. "original.html", "original.pdf", "original.png"
  original_title: string;  // Title at capture time
  source_url?: string;     // URL if captured from web (optional for uploads)
}
```

**Type System**: The `type` field represents the *file format*, not the content source:
- `html` - Web pages (YouTube, Twitter, articles, etc. - source inferred from `source_url`)
- `text` - Plain text notes
- `document` - PDF, DOC, DOCX, etc.
- `image` - PNG, JPG, WebP, etc. (OCR extracted to Markdown)

**Original vs Derived**: `original.json` and the original file are captured once and preserved forever. Everything else (processed content, analysis) can be regenerated from them. This means you can always re-analyze with improved AI without losing the source material.

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

## Content Capture: Technical Architecture

### Current Approach

| Content Type | Method | Notes |
|--------------|--------|-------|
| Public websites | `fetch` + Readability | Works for most sites (SSR/static HTML) |
| JS-rendered pages | Playwright (headless) | For SPAs that require JavaScript |
| Logged-in content | Chrome Extension | Twitter, paywalls, etc. |

### Why Chrome Extension for Logged-in Content?

**The problem**: Sites like Twitter require authentication. To capture content, we need the user's login session.

**Web App limitation**: Browser security (same-origin policy) prevents our web app from accessing cookies/sessions of other domains. Even with Playwright running on the backend, it cannot access the user's running Chrome profile (Chrome locks it while running).

**Workarounds we considered**:
- Close Chrome to unlock profile → Bad UX
- Launch Chrome with remote debugging → Too hacky for production
- Use third-party proxies (fxtwitter, nitter) → Unreliable/deprecated

**Current solution**: Chrome Extension runs *inside* the user's browser with their active session, so it can capture any page the user can see.

### Future: Native macOS App

A native app can solve the login problem properly:

| | Web App | macOS App |
|---|---|---|
| User logs in | In their Chrome | In app's built-in WebView |
| Session storage | Chrome profile (inaccessible) | App's own storage (we control) |
| Capture with auth | ❌ Cannot access | ✅ Uses app's session |

**The key insight**: It's not that "native apps have magic" — it's that **when users log in within our controlled environment, we can use that session for capture**.

This enables future features like:
- **Proactive debrief**: App monitors your feeds overnight, surfaces what's worth reading
- **One-click capture**: Paste URL → App uses its stored sessions → Content captured (no extension needed)

## License

MIT
