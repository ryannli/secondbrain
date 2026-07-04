# Data Schema Reference

Use this file when editing Second Brain data by hand or through an agent.

## Source Directory

```text
library/{id}/
├── meta.json
├── original.*
├── content.md
├── analysis.json
├── README.md
└── highlights.json
```

`meta.json` and `original.*` are original capture records. Treat them as immutable.

`content.md`, `analysis.json`, and `README.md` are derived files. They can be edited or regenerated.

## meta.json

```json
{
  "id": "demo001a",
  "source_url": "https://example.com/source",
  "created_at": "2026-01-15T09:00:00.000Z",
  "type": "text",
  "original_file": "original.txt",
  "original_title": "Title captured at import time"
}
```

## analysis.json

```json
{
  "triage": {
    "score": 86,
    "reason": "Why this item deserves attention.",
    "action": "must_read",
    "readTimeMinutes": 3,
    "density": 78,
    "originality": 72
  },
  "digest": {
    "summary": "Short synthesis of the source.",
    "highlights": [
      { "id": "h1", "text": "Important claim or insight.", "type": "insight" }
    ],
    "concepts": [
      { "id": "c1", "term": "Concept", "definition": "Definition." }
    ],
    "structure": ["Section or argument step"]
  },
  "critique": {
    "hiddenAssumptions": [],
    "potentialIssues": [],
    "needsVerification": [],
    "biasIndicators": []
  },
  "connections": [
    {
      "id": "conn-demo001a-demo002b",
      "type": "related",
      "summary": "How the sources connect.",
      "details": "Evidence for the relationship.",
      "relatedSourceIds": ["demo002b"]
    }
  ],
  "analyzedAt": "2026-01-15T09:02:00.000Z"
}
```

Allowed `triage.action` values:

- `must_read`
- `worth_reading`
- `skim`
- `summary_only`
- `skip`

Allowed highlight types:

- `insight`
- `fact`
- `actionable`

Allowed connection types:

- `related`
- `contradicts`
- `redundant`

Concept `status` is user-controlled by the UI. Agents should not set it by default.

## highlights.json

```json
[
  {
    "id": "highlight-1",
    "text": "Selected passage.",
    "createdAt": "2026-01-15T09:20:00.000Z"
  }
]
```

## Notebook Document

```text
notebook/{doc-id}/
├── meta.json
└── content.md
```

```json
{
  "id": "doc-demo-brief",
  "title": "Connection Brief",
  "createdAt": "2026-01-15T09:30:00.000Z",
  "output": "content.md",
  "sources": ["demo001a", "demo002b"]
}
```

`sources` should list library source IDs that materially informed the document.
