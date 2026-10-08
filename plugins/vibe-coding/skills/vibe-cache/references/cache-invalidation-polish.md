# Cache Invalidation Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent cache freshness or invalidation boundary across authoritative writes, cache keys, invalidation triggers, readers, tests, and docs/maps when used.

## Scope selection

Use the selected data/resource, stale-read bug, cache key, audit finding, failing test, or explicit performance/correctness task. Do not replace the whole caching strategy unless the selected fix requires a refactor plan.

## Polish targets

- Cache key construction and tenant/identity/role/locale/plan dimensions.
- Write-side invalidation, event-based refresh, TTL/stale-while-revalidate, optimistic update reconciliation, and rollback behavior.
- Server/client/CDN/browser cache readers directly affected.
- Tests/fixtures proving fresh, stale, unauthorized, and concurrent states.

## Implementation principles

- Preserve the authoritative data source and avoid masking owner-layer bugs with local cache workarounds.
- Prefer targeted invalidation over broad flushes unless the repository already uses broad invalidation safely.
- Avoid serving protected data from shared caches.
- Keep performance and correctness validation explicit.

## Validation

Run repository-native tests and bounded scenarios for write → read freshness, stale cache, concurrent update, permission/tenant change, logout/session change, and rollback where relevant. Report CDN/managed-cache gates honestly.
