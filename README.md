# Second Brain

A persistent cognitive workspace that manages information flow for knowledge workers.

**The Problem**: AI content grows exponentially, but human attention scales linearly.

**The Solution**: AI handles information triage and organization; humans focus on judgment and decisions.

## Core Principles

1. **Local-first**: Filesystem is the single source of truth. Web UI is just a view.
2. **User ownership**: All AI outputs are editable. This is the user's second brain.
3. **Security boundary**: All operations stay within user-specified root directory.
4. **Structure is optional**: System doesn't force organization; respects user-created structure.

## Features

- **URL Capture**: Paste any URL to extract and analyze content
- **AI Triage**: Get a recommendation score (0-100) for how much attention content deserves
- **Dual Analysis**:
  - **Digest**: Summary, key highlights, concepts
  - **Critique**: Hidden assumptions, potential issues, verification needs
- **Library Organization**: Tree-based file organization with user-created folders

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4
- **Content Extraction**: Mozilla Readability + JSDOM
- **AI Integration**: Claude Code CLI (subprocess, no API key needed)
- **Storage**: Local filesystem (markdown + JSON)

## Architecture

### File System Structure

```
{library}/
├── {id}/
│   ├── source.md       # Frontmatter + processed content
│   ├── original.html   # Original HTML (for re-processing)
│   ├── analysis.json   # AI analysis results
│   └── README.md       # Human-readable triage card
```

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/capture` | POST | Capture URL/HTML/text and analyze |
| `/api/sources` | GET | List all sources |
| `/api/sources/[id]` | GET/DELETE | Get or delete a source |
| `/api/sources/[id]/reanalyze` | POST | Re-process and re-analyze |

### Key Modules

- `src/lib/content.ts` - Content extraction (Readability, HTML parsing)
- `src/lib/claude.ts` - AI integration (Claude CLI subprocess)
- `src/lib/storage.ts` - File system operations
- `src/lib/types.ts` - TypeScript type definitions

## Design Decisions

### Layout & Scrolling

The SourceView uses a split-scroll pattern:
- **Content panel** (left): Independent scroll with `max-h-[calc(100vh-140px)]` and `sticky top-0`. Long articles scroll within this container.
- **Analysis panel** (right): Natural height, scrolls with the page. When analysis is long, scrolling on this panel scrolls the entire page.
- **Sidebar**: Fixed position, does not scroll with content.

This design ensures the analysis panel feels spacious (not boxed in) while keeping long content manageable.

### Title Handling

- **Metadata title**: Extracted from HTML (`og:title` or `<title>` tag), displayed in the header
- **Processed content**: Claude extracts article body WITHOUT the H1 title (to avoid duplication)

### Content Processing Pipeline

1. **Extract**: URL → fetch HTML → Readability extracts article
2. **Process**: Claude converts to clean Markdown (no title, preserves structure)
3. **Analyze**: Claude generates triage score, digest, and critique
4. **Store**: Save to filesystem as `source.md` + `analysis.json`

### Claude Integration

Uses Claude Code CLI directly via subprocess:
```typescript
spawn("claude", ["--print", "--tools", "", "--output-format", "text"])
```
- Leverages existing Claude Code subscription (no API key needed)
- Non-blocking async execution

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

## Browser Extension

A companion Chrome extension is available in `/extension` for one-click capture from any webpage.

## License

MIT
