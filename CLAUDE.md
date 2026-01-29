# Second Brain - Design Guidelines

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
│   │       ├── README.md       # Human-readable Triage Card
│   │       ├── source.md       # Original content (frontmatter + markdown)
│   │       ├── analysis.json   # AI analysis (editable by user)
│   │       └── artifacts/      # Co-learning outputs
│   └── {id}/                   # Sources can also be at top level
├── .index/                     # Global indices (claims, graph)
└── .cache/
```

### Organization Rules
- **System default**: New content goes to `library/` top level
- **User freedom**: Users can create folders, move sources freely
- **Detection**: Any directory containing `source.md` = a source entry
- **UI options**: Tree view (show hierarchy) or Flat view (ignore hierarchy)

### source.md Format

```markdown
---
title: "..."
type: article | video | pdf | note
source_url: "..."
created_at: "..."
---

[Content body - markdown formatted]
[For videos: transcript with timestamps]
```

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
- **Claude integration**: Calls Claude Code CLI directly via subprocess
  - Uses `claude -p --output-format json` for non-interactive mode
  - Legitimately uses Claude Code subscription (no API key needed)
  - Note: OAuth tokens cannot be used directly (Anthropic blocked external use)

---

## Workflow Rules

### Before Committing
- **Check README.md**: Before making any git commit, review if README.md needs to be updated based on the changes made. Consider updating if:
  - New features were added
  - Setup/installation steps changed
  - API or configuration changed
  - Dependencies were added/removed
