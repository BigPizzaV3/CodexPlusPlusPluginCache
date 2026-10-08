# Billing Entitlements Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve one coherent billing, plan, quota, entitlement, or lifecycle surface so UI, API, jobs, tests, and user-facing states align with the repository's actual source of truth.

## Scope selection

- If the user named a plan gate, quota, webhook, provider mapping, billing flow, permission issue, or audit task brief, improve that owner and directly affected surfaces.
- If the request is broad, inspect high-risk billing/entitlement paths and choose the highest-confidence fix with correctness, revenue, trust, or support impact.
- Include related UI copy/states, server enforcement, tests, docs, jobs, and instrumentation when they belong to the same entitlement problem.
- Avoid new pricing policy, provider migration, broad billing redesign, or business-rule invention unless explicitly required and evidenced.

## Polish targets

- Plan/quota/feature source of truth, provider mapping, route/API guards, UI gates, disabled/no-access/upgrade/over-quota states.
- Subscription lifecycle: trial, upgrade, downgrade, cancel, reactivate, payment failure, grace period, webhook idempotency/order, and reconciliation.
- Tenant/workspace/project/role context and ownership of billing actions, invoices, seats, usage, and notifications.
- Dangerous actions: confirmation, audit-friendly diagnostics, retry behavior, and recovery from partial failures.
- Directly affected tests, fixtures, docs, env examples, and instrumentation where the repo uses them.

## Implementation principles

- Read and preserve the entitlement source of truth before editing consumers.
- Enforce sensitive gates server-side; UI gates are not sufficient for access control.
- Keep visible copy aligned with actual allowed behavior, provider state, and plan/quota contracts.
- Prefer typed matrices/helpers and owner-level tests over scattered string checks.

## Validation

Run relevant repository-native checks. When possible, trace at least one allowed and one restricted plan/role state plus one lifecycle edge. State any inability to verify external provider behavior.
