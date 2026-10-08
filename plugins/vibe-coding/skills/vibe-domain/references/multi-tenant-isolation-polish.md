# Multi Tenant Isolation Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent tenant/workspace/project isolation defect across authoritative query/policy/storage owners and directly affected consumers.

## Scope selection

Use the selected resource, endpoint, job, search path, object key, cache key, audit finding, failing test, or explicit isolation bug. Do not redesign tenancy globally unless the selected fix requires a migration/refactor plan.

## Polish targets

- Owner-layer tenant scoping in queries, mutations, services, policies, storage keys, indexes, cache keys, and jobs.
- API/UI behavior for wrong-tenant/no-access/not-found states.
- Admin/staff/impersonation boundaries and audit logs when directly affected.
- Tests/fixtures for same-tenant, wrong-tenant, missing-tenant, and elevated-context cases.
- Maps/docs when the repository uses them for auth/data/traceability.

## Implementation principles

- Enforce tenant isolation server-side and at data access boundaries.
- Avoid filtering after fetching broader data when owner-layer scoping is available.
- Preserve compatibility for existing tenant data; add safe migrations only when required.
- Do not touch unrelated resources, roles, or plans.

## Validation

Run repository-native tests and targeted scenarios proving no cross-tenant read, write, list, search, job, export, or object access for the selected boundary. Report missing fixtures or external services as gates.
