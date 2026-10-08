---
name: vibe-notifications
description: "Audit, fix or verify notification eligibility, consent, templates, queues, provider status, retry deduplication and delivery recovery. Code work is not authorization to contact real recipients."
---

# Notification delivery

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Notification Delivery Audit](references/notification-delivery-audit.md) | audit |
| [Notification Delivery Polish](references/notification-delivery-polish.md) | implement |
| [Notification Failure & Idempotency Check](references/notification-failure-idempotency-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
