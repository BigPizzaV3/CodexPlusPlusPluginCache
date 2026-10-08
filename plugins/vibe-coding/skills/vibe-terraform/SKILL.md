---
name: vibe-terraform
description: "Audit, fix or verify Terraform module contracts, exact plans, state identity, drift, moved/import refactors and recovery. Preparing changes does not itself authorize applying them."
---

# Terraform

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Terraform Delivery Audit](references/terraform-delivery-audit.md) | audit |
| [Terraform Delivery Polish](references/terraform-delivery-polish.md) | implement |
| [Terraform Plan & State Check](references/terraform-plan-state-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
