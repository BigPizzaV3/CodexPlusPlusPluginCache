---
name: vibe-reliability
description: "Audit or fix a concrete reliability, consistency, idempotency, concurrency, hot-path performance or resource-budget problem. Use current code and measurements to identify the limiting owner."
---

# Reliability & performance

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Transactional Delivery Check](references/transactional-delivery-check.md) | check |
| [Consistency Invariants Audit](references/consistency-invariants-audit.md) | audit |
| [Consistency Invariants Polish](references/consistency-invariants-polish.md) | implement |
| [Idempotency & Concurrency Audit](references/idempotency-concurrency-audit.md) | audit |
| [Idempotency & Concurrency Polish](references/idempotency-concurrency-polish.md) | implement |
| [Performance Audit](references/performance-audit.md) | audit |
| [Performance Budget Audit](references/performance-budget-audit.md) | audit |
| [Performance Budget Polish](references/performance-budget-polish.md) | implement |
| [Performance Polish](references/performance-polish.md) | implement |
| [Reliability Audit](references/reliability-audit.md) | audit |
| [Reliability Polish](references/reliability-polish.md) | implement |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

Use Transactional Delivery Check for the database → event → consumer effect boundary. For a requested repair, use Consistency Invariants Polish with the same crash-window checks.
