---
name: vibe-backend
description: "Audit or fix API contracts and conversational bot flows in an existing repository, including validation, state transitions, callbacks, permissions, and direct consumers."
---

# APIs & bots

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [API Contract Evolution Audit](references/api-contract-evolution-audit.md) | audit |
| [API Contract Evolution Polish](references/api-contract-evolution-polish.md) | implement |
| [API Contract Compatibility Check](references/api-contract-compatibility-check.md) | check |
| [API Audit](references/api-audit.md) | audit |
| [API Polish](references/api-polish.md) | implement |
| [Bot Audit](references/bot-audit.md) | audit |
| [Bot Polish](references/bot-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

For an old/new schema or generated-client compatibility boundary, select the API Contract Evolution recipes. A general endpoint behavior audit still uses API Audit.
