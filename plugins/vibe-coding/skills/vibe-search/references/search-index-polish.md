# Search Index Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent search/index boundary across indexing pipeline, document schema, query/filter logic, authorization, UI/API state, tests, and docs/maps when used.

## Scope selection

Use the selected index/query/resource, stale/missing/unauthorized result bug, audit finding, failing test, or explicit search improvement task. Avoid broad ranking redesigns unless the selected product acceptance requires them.

## Polish targets

- Index document construction, update/delete events, backfill/reindex scripts, and freshness markers.
- Query builder, filters/facets/sorting/pagination, language/tokenization settings, and result hydration.
- Permission/tenant/privacy filters and no-results/error states.
- Tests/replay fixtures for recall, freshness, deletion, permissions, and important ranking/order expectations.

## Implementation principles

- Keep search index as a projection unless the repository explicitly makes it authoritative.
- Enforce access control before exposing results; do not rely on UI-only filtering.
- Preserve existing public query contracts or version them explicitly.
- Include reindex/rollback/forward-fix notes when document schema changes.

## Validation

Run repository-native tests and bounded indexing/query scenarios for create/update/delete, stale index, permission filter, empty/error state, and reindex/backfill where relevant. Report managed search gates honestly.
