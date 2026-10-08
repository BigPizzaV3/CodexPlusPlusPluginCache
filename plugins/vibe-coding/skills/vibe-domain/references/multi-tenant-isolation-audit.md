# Multi Tenant Isolation Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one tenant, workspace, organization, project, or account isolation boundary across API, data, cache, search, jobs, analytics, storage, and UI behavior. Limit scope to the selected boundary and direct producers/consumers.

## Domain invariants

- Every read, write, list, search, export, import, job, webhook, and object key is scoped to the correct tenant/resource owner.
- Cache keys, generated clients, analytics events, logs, and background contexts cannot cross tenant boundaries.
- Admin/staff/impersonation paths are explicit, audited, and do not contaminate user context.
- Forbidden/not-found behavior avoids existence leaks where the product contract requires it.
- Tests cover same-tenant, wrong-tenant, missing-tenant, and elevated-context states.

## Audit method

Trace the selected resource from route/API entry through auth context, query filters, service owner, storage/index/cache keys, async jobs, exports, object storage, analytics/logging, and UI state. Mark every unscoped or ambiguously scoped edge.
