---
name: vibe-search
description: "Audit, fix or verify document indexing, search ACLs, freshness, ranking/filter behavior, reindexing and failure recovery against product expectations."
---

# Search indexes

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Search Index Audit](references/search-index-audit.md) | audit |
| [Search Index Polish](references/search-index-polish.md) | implement |
| [Search Recall & Freshness Check](references/search-recall-freshness-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
