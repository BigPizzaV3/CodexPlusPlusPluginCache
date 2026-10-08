---
name: vibe-redis
description: "Audit, fix or verify Redis Streams, BullMQ or ARQ job identity, locks, acknowledgements, retention, backpressure and recovery. Respect the selected framework delivery semantics."
---

# Redis & queues

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Redis Job Queues Audit](references/redis-job-queues-audit.md) | audit |
| [Redis Job Queues Polish](references/redis-job-queues-polish.md) | implement |
| [Redis Queue Load & Recovery Check](references/redis-queue-load-recovery-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
