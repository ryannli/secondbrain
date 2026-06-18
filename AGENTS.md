# Second Brain - Agent Guidelines

This is the canonical agent instruction file for this repository.
`CLAUDE.md` should be a symlink to this file so Claude Code and Codex share the same project context.

> A persistent cognitive workspace that manages information flow for knowledge workers.

## Core Philosophy

**The Problem**: AI content grows exponentially, but human attention scales linearly.

**Our Solution**: AI handles information triage and organization; humans focus on judgment and decisions.

**Key Principles**:
1. **Local-first**: Filesystem = single source of truth. Web UI is just a view.
2. **User ownership**: All AI outputs are editable. This is the user's second brain.
3. **Security boundary**: All operations stay within user-specified root directory.
4. **Structure is optional**: System doesn't force organization; respects user-created structure.
5. **First principles, no hardcoding**: Solve problems from first principles. Avoid hardcoded rules or brittle parsing logic. When dealing with messy/unstructured data (HTML, PDFs, etc.), prefer letting the AI model interpret the content rather than writing fragile extraction code. Ensure generalizability over edge-case handling.
6. **Minimal code**: Less code is always better. **Knowing when to delete code is more important than knowing how to write it.** Don't write unnecessary code. If something can be achieved with fewer lines, do it. Actively look for code to delete - dead code, redundant logic, over-abstractions. The best code is no code.
7. **Think globally, not incrementally**: Don't just patch the immediate problem. Step back and ask: Should this be refactored? Are there similar patterns to unify? Incremental fixes accumulate into debt.

---

## Information Processing Model

### Two Modes of Analysis

| Mode | Purpose | Outputs |
|------|---------|---------|
| **Digestion** | Help user understand content | Summary, key concepts, structure, background |
| **Critique** | Help user evaluate content | Hidden assumptions, issues, verification needs |

### Claim-Level Granularity

A "claim" = a statement that can be independently evaluated for truth/agreement.
- Extract claims from each source
- Compare across sources (find similar, contradicting)
- MVP: brute-force comparison; future: vector search

### Triage Card

Every source gets a quick assessment:
- Read time estimate
- Information density score
- Novelty score (vs user's existing knowledge)
- One-line recommendation (deep read / skim / skip)

---

## File System Architecture

```
{root}/
├── config.json                 # User preferences (theme, settings)
├── library/
│   ├── {folder}/               # User-created folders (optional)
│   │   └── {id}/
│   │       ├── meta.json       # IMMUTABLE: metadata captured at creation
│   │       ├── original.html   # IMMUTABLE: raw HTML from capture
│   │       ├── content.md      # DERIVED: processed content (editable)
│   │       ├── analysis.json   # DERIVED: AI analysis (editable)
│   │       ├── README.md       # DERIVED: human-readable Triage Card
│   │       └── error.txt       # Only present if processing failed
│   └── {id}/                   # Sources can also be at top level
├── .index/                     # Global indices (claims, graph)
└── .cache/
```

### Organization Rules
- **System default**: New content goes to `library/` top level
- **User freedom**: Users can create folders, move sources freely
- **Detection**: Any directory containing `meta.json` = a source entry
- **UI options**: Tree view (show hierarchy) or Flat view (ignore hierarchy)

### meta.json (Immutable)

Written once at capture time, **never modified**:
```json
{
  "id": "abc123",
  "source_url": "https://...",
  "created_at": "2024-01-28T...",
  "type": "html",
  "original_file": "original.html",
  "original_title": "Page title at capture time"
}
```

### content.md (Derived)

Processed content with editable title in frontmatter:
```markdown
---
title: "AI-improved or user-edited title"
---

[Processed content here - markdown formatted]
```

### Processing Status (File-based)

Status is **inferred from file existence**, not stored:

| State | Files Present |
|-------|---------------|
| Processing | `meta.json` only |
| Ready | `meta.json` + `content.md` + `analysis.json` |
| Failed | `meta.json` + `error.txt` |

### Data Model: Original vs Derived

**CRITICAL**: Understand which data is original (immutable after capture) vs derived (can be regenerated).

| File | Type | Description |
|------|------|-------------|
| `meta.json` | **ORIGINAL** | Metadata at capture time. **NEVER modify.** |
| `original.html` / `original.txt` | **ORIGINAL** | Raw content from first capture. **NEVER overwrite.** |
| `content.md` | **DERIVED** | Processed/extracted content. Can regenerate. |
| `analysis.json` | **DERIVED** | AI analysis. Can regenerate. |
| `README.md` (triage card) | **DERIVED** | Human-readable summary. Can regenerate. |

**Reanalyze operation**:
1. Read metadata from `meta.json`
2. Read raw content from `original.html` / `original.txt`
3. Re-extract content → update `content.md`
4. Re-run AI analysis → update `analysis.json`
5. **NEVER** modify `meta.json` or `original.html`

**Why this matters**: Browser extension captures rendered HTML that server-side fetch cannot reproduce (SPAs like Twitter). Overwriting original with server-fetched content destroys irreplaceable data.

---

## UI Structure

### Dashboard (Home)
- Quick capture input (paste link, drop file, type text)
- Recent sources as mini Triage Cards
- User quickly decides: dive in or leave it

### Source View
- Left: Library sidebar - tree/flat view toggle (collapsible)
- Center: Original content + Analysis tabs (Digestion | Critique | Claims)
- Right: Co-learning panel (collapsible)

### Key Interactions
- Select text in source → becomes context for Co-learning (like Cursor)
- Drag & drop to organize sources into folders
- All AI modifications write directly to local files

### Responsive Design
- Desktop: Three columns
- Tablet: Sidebar as hamburger, Co-learning as drawer
- Mobile: Single column with bottom tabs (secondary priority)

---

## MVP Scope

**In scope**:
- Text / URL / PDF input → analyze → store → display
- Triage Card + Digestion + Critique + Claims extraction
- Claim comparison across sources (brute-force)
- Dashboard + Source View
- User can edit all analysis results
- Basic folder organization

**Out of scope (architecture ready)**:
- Video/audio transcription
- Co-learning chat mode
- Vector search for claims
- Proactive insights ("3 sources mention same topic")

---

## Tech Notes

- Next.js + TypeScript + Tailwind CSS
- File operations server-side only
- **Agent integration**: Calls a configured local agent CLI via subprocess
  - Supported providers: Claude Code (`claude`) and OpenAI Codex (`codex`)
  - Provider selection lives in `config.json` as `agentProvider`
  - Agent Mode is mandatory before entering the workspace
  - Keep provider-specific spawn arguments inside the agent provider layer
  - Core app code should call the provider abstraction, not `claude` or `codex` directly
  - Codex UI chat should use `codex app-server --stdio`; `codex exec --json` is for non-interactive/batch work and only emits the assistant answer as a final item
  - Codex app-server emits `item/agentMessage/delta`; keep its initialize/thread/start/turn/start lifecycle in a tested protocol helper rather than special-casing it in UI code
  - If adopting ACP later, add it as a provider adapter; do not make app business logic ACP-dependent

---

## Workflow Rules

### Before Committing
- **Check README.md**: Before making any git commit, review if README.md needs to be updated based on the changes made. Consider updating if:
  - New features were added
  - Setup/installation steps changed
  - API or configuration changed
  - Dependencies were added/removed

### Continuous Learning
- **Update AGENTS.md**: When discovering patterns, fixing recurring issues, or learning something that would help future development, summarize and add it to this canonical file. Examples:
  - Common pitfalls and how to avoid them
  - Architecture decisions and their rationale
  - Patterns that work well in this codebase

### Track Compromises
- **Update todo.md**: When making a pragmatic/compromise decision (e.g. "good enough for now" solutions, shortcuts, known limitations), add it to `todo.md` so we know what to revisit before launch or when scaling to more users.

---

## Lessons Learned

### Frontend: Always Extract Components
Don't write long component files. Proactively split into separate components to keep files focused and manageable.

### Agent History Must Include Tool Traces (2026-02-02)
Multi-turn agent history should include tool calls and results, not just the text responses.

Without tool traces, the agent in Turn 2 only sees "I read 26 files" but not what was in them—leading to hallucinated details when acting on that data.

### Agent Debug Logs Are Opt-In (2026-06-18)
Do not write full agent prompts/responses to disk during normal use. Enable `SECONDBRAIN_AGENT_DEBUG_LOGS=1` only for local debugging, because those logs can contain captured source text and user preferences.

### Sample Data Seeds Automatically (2026-06-18)
First-run sample data is a product behavior, not an onboarding command. `sample_data/` should auto-copy only into an empty user data root and must never overwrite existing user files. Seeded agent instructions should use `AGENTS.md` as canonical, with `CLAUDE.md` as a symlink for compatibility.
