---
name: vibe-kubernetes
description: "Audit, fix or verify Kubernetes workload rendering, rollout, probes, scheduling, storage, network policy and graceful shutdown for the actual target environment."
---

# Kubernetes

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Kubernetes Platform Audit](references/kubernetes-platform-audit.md) | audit |
| [Kubernetes Platform Polish](references/kubernetes-platform-polish.md) | implement |
| [Kubernetes Rollout & Failure Check](references/kubernetes-rollout-failure-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
