---
name: vibe-domain
description: "Audit, fix or verify repository business contracts: authentication and OAuth/OIDC sessions, RBAC/ABAC, tenant isolation, billing, data models, pipelines, notebook productionization, experiments and product analytics."
---

# Permissions, data & business rules

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

For OAuth/OIDC verification, select the session check. For a requested authentication fix, use Auth Permissions Polish and apply the relevant protocol checks during verification.

## Recipes

| Recipe | Operation |
|---|---|
| [Auth Permissions Audit](references/auth-permissions-audit.md) | audit |
| [Auth Permissions Polish](references/auth-permissions-polish.md) | implement |
| [Billing Entitlements Audit](references/billing-entitlements-audit.md) | audit |
| [Billing Entitlements Polish](references/billing-entitlements-polish.md) | implement |
| [Data Model Audit](references/data-model-audit.md) | audit |
| [Data Model Polish](references/data-model-polish.md) | implement |
| [Data Pipeline & Quality Audit](references/data-pipeline-quality-audit.md) | audit |
| [Data Pipeline & Quality Polish](references/data-pipeline-quality-polish.md) | implement |
| [Experiment Design Audit](references/experiment-design-audit.md) | audit |
| [Experiment Design Polish](references/experiment-design-polish.md) | implement |
| [Multi Tenant Isolation Audit](references/multi-tenant-isolation-audit.md) | audit |
| [Multi Tenant Isolation Polish](references/multi-tenant-isolation-polish.md) | implement |
| [OAuth OIDC Session Check](references/oauth-oidc-session-check.md) | check |
| [Notebook Productionization Audit](references/notebook-productionization-audit.md) | audit |
| [Notebook Productionization Polish](references/notebook-productionization-polish.md) | implement |
| [Product Analytics Audit](references/product-analytics-audit.md) | audit |
| [Product Analytics Polish](references/product-analytics-polish.md) | implement |
| [RBAC ABAC Matrix Check](references/rbac-abac-matrix-check.md) | check |
| [RBAC ABAC Policy Audit](references/rbac-abac-policy-audit.md) | audit |
| [RBAC ABAC Policy Polish](references/rbac-abac-policy-polish.md) | implement |
| [Tenant Isolation Check](references/tenant-isolation-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.

For provider requests, signed webhooks and external payment reconciliation, use [Payments](../vibe-payments/SKILL.md). Local plan/role/entitlement policy remains here.
