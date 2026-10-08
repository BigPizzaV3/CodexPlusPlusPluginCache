---
name: vibe-realtime
description: "Audit, fix or verify client query caches, optimistic mutations, event sequence gaps, WebSocket/SSE reconnect, persisted state and rendering cost in realtime UIs."
---

# Realtime interfaces

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Realtime Frontend Audit](references/realtime-frontend-audit.md) | audit |
| [Realtime Frontend Polish](references/realtime-frontend-polish.md) | implement |
| [Realtime Interface Profiling & Recovery Check](references/realtime-interface-profiling-recovery-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Shared cache invalidation belongs to [Cache](../vibe-cache/SKILL.md); initial server rendering and hydration belong to [Web](../vibe-web/SKILL.md). This skill owns client state reconciliation and reconnect.
