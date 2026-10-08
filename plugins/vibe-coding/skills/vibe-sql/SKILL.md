---
name: vibe-sql
description: "Audit, fix or verify SQL queries, indexes, locks, transactions, migration compatibility, connection pools, replica consistency and failover against the selected engine."
---

# SQL & connections

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [SQL Databases Audit](references/sql-databases-audit.md) | audit |
| [SQL Databases Polish](references/sql-databases-polish.md) | implement |
| [SQL Load Lock & Failover Check](references/sql-load-lock-failover-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
