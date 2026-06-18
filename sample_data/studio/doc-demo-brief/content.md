# Connection Brief: Capture First, Search Later

This example Studio document shows the kind of synthesis an agent can create from captured sources.

## Core Connection

`demo001a` argues that Second Brain should preserve original source records while keeping AI analysis editable and regeneratable. `demo002b` applies the same philosophy to feed onboarding: RSS defaults create value before a user configures search APIs.

Together, they suggest a product rule:

> First-run value should come from durable local defaults, not fragile external setup.

## Practical Implications

- Keep `original.*` and `meta.json` immutable so analysis can be repaired without losing evidence.
- Let RSS provide the baseline For You feed before requiring search credentials.
- Treat agent output as a draft layer the user owns, not as hidden product state.

## Next Action

When reviewing a new onboarding feature, ask whether it demonstrates the complete product without requiring users to configure an external service first.
