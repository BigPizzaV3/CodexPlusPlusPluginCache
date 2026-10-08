---
name: vibe-kafka
description: "Audit, fix or verify Kafka/Redpanda ordering, producer guarantees, consumer offsets, rebalances, schema compatibility, retry and replay boundaries."
---

# Kafka & Redpanda

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Kafka Redpanda Audit](references/kafka-redpanda-audit.md) | audit |
| [Kafka Redpanda Polish](references/kafka-redpanda-polish.md) | implement |
| [Kafka Redpanda Rebalance & Failure Check](references/kafka-redpanda-rebalance-failure-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
