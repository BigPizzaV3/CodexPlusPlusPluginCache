---
name: vibe-clickhouse
description: "Audit, fix or verify ClickHouse table engines, partition/order keys, ingestion deduplication, query pruning, merges, replication and workload limits."
---

# ClickHouse

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [ClickHouse Audit](references/clickhouse-audit.md) | audit |
| [ClickHouse Ingestion & Query Load Check](references/clickhouse-ingestion-query-load-check.md) | check |
| [ClickHouse Polish](references/clickhouse-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
