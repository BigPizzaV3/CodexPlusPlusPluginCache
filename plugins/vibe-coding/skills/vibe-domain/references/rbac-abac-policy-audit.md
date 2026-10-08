# RBAC ABAC Policy Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one RBAC/ABAC policy boundary, role matrix, resource-action contract, tenant scope, or entitlement decision path. Limit the audit to evidence-backed policy behavior and directly affected consumers.

## Domain invariants

- Policy decision points and policy enforcement points agree on actor, resource, action, scope, attributes, plan/quota state, and deny semantics.
- Backend enforcement is authoritative; UI visibility is a consumer, not the source of truth.
- ABAC attributes are trustworthy, current, scoped to the tenant/resource, and not user-forgeable.
- Forbidden, unauthenticated, wrong-tenant, no-plan, over-quota, and not-found semantics avoid data leakage.
- Tests cover allow and deny paths for meaningful roles/attributes/scopes.

## Audit method

1. Locate role definitions, attribute sources, policy helpers, route guards, API handlers, jobs, UI gates, feature flags, audit logs, and tests.
2. Trace selected actor/resource/action through decision owner and all direct enforcement points.
3. Compare matrix/docs/maps with implementation evidence and mark drift.
4. Identify duplicated policy logic and owner ambiguity.
