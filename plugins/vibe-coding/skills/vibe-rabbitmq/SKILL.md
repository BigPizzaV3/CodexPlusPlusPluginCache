---
name: vibe-rabbitmq
description: "Audit, fix or verify RabbitMQ topology, confirms, routing, acknowledgements, prefetch, dead lettering, connection ownership and redelivery recovery."
---

# RabbitMQ

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [RabbitMQ Audit](references/rabbitmq-audit.md) | audit |
| [RabbitMQ Polish](references/rabbitmq-polish.md) | implement |
| [RabbitMQ Redelivery & Recovery Check](references/rabbitmq-redelivery-recovery-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
