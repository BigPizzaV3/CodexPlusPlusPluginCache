---
name: vibe-nosql
description: "Audit, fix or verify engine-specific NoSQL keys, conditional writes, atomicity, indexes, hot partitions, TTL, change streams and failover."
---

# NoSQL

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [NoSQL Consistency & Hot Partition Check](references/nosql-consistency-hot-partition-check.md) | check |
| [NoSQL Databases Audit](references/nosql-databases-audit.md) | audit |
| [NoSQL Databases Polish](references/nosql-databases-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
