# Second Brain Data Agent

You are working inside a user's Second Brain data folder.

This file is the canonical instruction source for local agent CLIs. `CLAUDE.md`
is a compatibility symlink to this file.

## First Reads

- Read `USER.md` at the start of a task when it exists. Treat it as user-owned preferences.
- Read `DataSchema.md` before editing `analysis.json`, `meta.json`, highlights, or Notebook documents.
- `MEMORY.md` is your memory about the user, maintained by you across conversations (interests, preferences, ongoing projects). Read it when it exists; when a conversation reveals something durable about the user, update it — merge and revise rather than append, and keep it concise. The user may also edit it.

## Directory Map

- `library/` - captured sources. A source is any directory containing `meta.json`.
- `notebook/` - documents, briefs, reports, and other agent-created outputs.
- `workspace/` - scratch or work-in-progress documents, when present.
- `config.json` - app settings. Read only unless the user explicitly asks you to change settings.
- `.agent/`, `.cache/`, `.feed/`, `.tracking/`, `.debug/` - app/runtime state. Do not treat these as source material unless asked.

## Source Folder Contract

Each captured source usually contains:

- `meta.json` - immutable capture metadata. Do not edit.
- `original.*` - immutable raw source. Do not overwrite.
- `content.md` - derived readable content. Editable/regeneratable.
- `analysis.json` - derived triage, digest, critique, concepts, and connections.
- `README.md` - human-readable triage card.
- `highlights.json` - user highlights, when present.

Read `analysis.json` first for summaries and triage. Read `content.md` when you need evidence or detail. Use `original.*` only when the derived content looks incomplete.

## Finding Sources

Useful commands:

```bash
find library -name meta.json
find notebook -name meta.json
```

Read nearby `meta.json`, `README.md`, and `analysis.json` to understand each item before editing.

## Rules

1. Never modify `meta.json` or `original.*` for captured sources.
2. Do not invent citations. Cite source IDs or source paths you actually read.
3. Keep derived edits small and explain uncertainty when the library does not contain enough evidence.
4. Do not create background caches, debug logs, or conversation exports unless the user explicitly asks.
5. Prefer a simple direct edit over creating new abstractions or extra files.

## Editing Analysis

Before changing `analysis.json`, read `DataSchema.md`. Preserve unknown fields unless there is a clear reason to remove them.

Concept `status` is user-controlled through the UI. Do not set or overwrite it unless the user explicitly asks.

## Creating Notebook Documents

When the user asks for a document, report, synthesis, memo, or brief:

1. Generate an ID like `doc-{8 random lowercase chars}`.
2. Create `notebook/{doc-id}/`.
3. Write `meta.json`:

```json
{
  "id": "doc-example1",
  "title": "Document Title",
  "createdAt": "2026-01-15T12:00:00.000Z",
  "output": "content.md",
  "sources": ["demo001a"]
}
```

4. Write `content.md`.
5. Include source IDs in `sources` when the document is based on library items you read.

The app will display the document from `notebook/` automatically.
