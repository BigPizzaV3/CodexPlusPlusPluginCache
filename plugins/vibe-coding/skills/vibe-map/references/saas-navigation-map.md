# SaaS Navigation Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/saas_navigation_map.md` as a current map of SaaS routes, layouts, modals/drawers, forms, tables, navigation, roles, plans, tenants, and key UI states.

## Inspect

Routing, layouts, pages, guards, loaders/actions, API hooks, state stores, forms, tables, dialogs, navigation components, auth/RBAC, plan/billing/quota code, tenant/workspace/project context, i18n, analytics/observability, tests, docs, and generated route maps.

## Map content

### Evidence and IDs

- Write or update `docs/saas_navigation_map.md` when the environment allows it. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs when refreshing: route `R-*`, layout `L-*`, modal/drawer `M-*`, form `F-*`, table/list `T-*`, guard `G-*`.
- Anchor every entry to current repository evidence with `path:line[-line]` plus symbol when possible.
- Distinguish source-of-truth implementation from generated docs, generated clients, stale docs, and inferred behavior.
- Capture unknowns only when they affect future audit or implementation.

### Coverage

Capture product context when discoverable: app type, primary roles, tenant model, plan model, auth/onboarding model, main entity graph. Cover user, admin/staff, public/auth, no-access/no-plan/over-quota, empty/loading/error, destructive, and async states when present.

### Entry details

For each route/surface, capture path or trigger, owner symbol, layout, roles/guards, plan/tenant behavior, data dependencies, actions, states, forms/tables/modals involved, tests, and gaps.

## Markdown structure

Use a readable markdown hierarchy with summary first, then route tree, auth/onboarding entry points, layouts, routes, modals/drawers, forms, tables/lists, navigation surfaces, role/action/plan matrices, cross-cutting behavior, reachability, unknowns, and assumptions. Omit sections that do not exist in the repo. Do not invent surfaces, states, commands, endpoints, or contracts.
