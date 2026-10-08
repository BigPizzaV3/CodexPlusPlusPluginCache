# RBAC ABAC Policy Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/rbac_abac_policy_map.md` as the detailed policy-decision map for RBAC, ABAC, relationship-based access, tenant/resource scope, delegation, and policy enforcement points.

## Inspect

Policy helpers/engines, role enums, permission tables, membership/resource ownership models, attribute sources, feature/plan gates, admin/staff/impersonation, API handlers, server actions, frontend guards, workers, migrations, tests, seeds, docs, audit logs, and existing auth maps.

## Map rules

- Write or update `docs/rbac_abac_policy_map.md` when possible; otherwise print the complete markdown.
- Preserve stable IDs: policy `POL-*`, decision `DEC-*`, role `ROLE-*`, attribute `ATTR-*`, relationship `REL-*`, enforcement point `EFP-*`, test `TEST-*`.
- Separate RBAC roles, ABAC attributes, relationship/ownership checks, and entitlement gates even when they are implemented in the same helper.
- For each decision, capture subject, action, resource, scope, attributes, allow/deny semantics, owner source, UI/API/job enforcement points, denial behavior, and tests.
- Do not invent policy semantics from names alone; mark missing deny/default behavior explicitly.

## Coverage

Cover permission matrix, policy composition, deny-by-default behavior, attribute freshness, tenant isolation, delegated access, service/admin contexts, impersonation, public links/sharing, UI affordance consistency, cache/search/index leakage, audit logging, tests, and known drift.

## Markdown structure

Use summary, conventions, policy inventory, decision matrix, subject/action/resource/attribute sections, enforcement points, denial states, audit/test coverage, ambiguity/drift, and unknowns.
