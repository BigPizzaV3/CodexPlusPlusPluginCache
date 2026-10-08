---
name: vibe-vectors
description: "Audit, fix or verify vector embedding/schema compatibility, tenant filters, upserts/deletes, ANN recall, reindex migration and degraded retrieval."
---

# Vector databases

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Vector Databases Audit](references/vector-databases-audit.md) | audit |
| [Vector Databases Polish](references/vector-databases-polish.md) | implement |
| [Vector Recall & Degradation Check](references/vector-recall-degradation-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
