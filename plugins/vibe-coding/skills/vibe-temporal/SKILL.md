---
name: vibe-temporal
description: "Audit, fix or verify Temporal workflow determinism, Activities, signal/update handling, history bounds, replay and worker version compatibility."
---

# Temporal

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Temporal Replay & Versioning Check](references/temporal-replay-versioning-check.md) | check |
| [Temporal Workflows Audit](references/temporal-workflows-audit.md) | audit |
| [Temporal Workflows Polish](references/temporal-workflows-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
