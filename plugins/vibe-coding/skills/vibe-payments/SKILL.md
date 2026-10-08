---
name: vibe-payments
description: "Audit, fix or verify payment provider adapters, signed webhooks, idempotency, event ordering, reconciliation and entitlement consistency. Use sandbox fixtures for payment scenarios."
---

# Payments

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Payments Provider Audit](references/payments-provider-audit.md) | audit |
| [Payments Provider Polish](references/payments-provider-polish.md) | implement |
| [Payments Webhook & Reconciliation Check](references/payments-webhook-reconciliation-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

For a local plan/role/entitlement policy without a provider-runtime defect, use [Domain](../vibe-domain/SKILL.md). Follow the actual failing owner when both boundaries participate.
