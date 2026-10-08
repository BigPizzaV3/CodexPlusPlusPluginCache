---
name: vibe-observability
description: "Audit, fix or verify Prometheus, Grafana or VictoriaLogs signal semantics, alert rules, dashboards, correlation, tenant scope and cardinality costs in a repository."
---

# Metrics, logs & alerts

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Observability Semantics & Cost Check](references/observability-semantics-cost-check.md) | check |
| [Observability Stack Audit](references/observability-stack-audit.md) | audit |
| [Observability Stack Polish](references/observability-stack-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
