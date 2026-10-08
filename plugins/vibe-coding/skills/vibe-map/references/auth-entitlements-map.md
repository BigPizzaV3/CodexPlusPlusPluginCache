# Auth Entitlements Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/auth_entitlements_map.md` as the evidence map connecting authentication, RBAC, ABAC, tenancy, plan/feature gates, quotas, UI affordances, API enforcement, jobs, and audit logs.

## Inspect

Auth providers, session/membership models, role definitions, policy helpers, ABAC attribute sources, tenant/workspace/project scopes, entitlement/plan/quota code, route guards, API handlers, UI conditionals, feature flags, background jobs, generated clients, tests, audit logs, and docs.

## Map content

### Evidence and IDs

- Write or update `docs/auth_entitlements_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: role `ROLE-*`, permission/action `PERM-*`, ABAC rule `ABAC-*`, entitlement `ENTL-*`, gate `GATE-*`, scope `SCOPE-*`, quota `QUOTA-*`.
- Anchor every rule to owner evidence. Distinguish UI visibility from backend enforcement and policy source from duplicated consumer checks.

### Coverage

Cover identities, roles, attributes, tenant scopes, policy decision points, policy enforcement points, plan/feature gates, quota limits, admin/staff/impersonation, invitations, unauthenticated/forbidden/not-found semantics, no-access/upgrade states, background/job contexts, audit logs, and tests.

### Entry details

For each permission or entitlement, capture actor, resource, action, scope, attributes, plan/quota dependency, backend owner, UI consumers, API/jobs, error/no-access behavior, tests, audit log expectations, and known drift.

## Markdown structure

Use summary, identity/scope model, RBAC matrix, ABAC rules, entitlement/quota matrix, enforcement points, UI affordance map, jobs/integrations, audit logging, tests, gaps, assumptions.
