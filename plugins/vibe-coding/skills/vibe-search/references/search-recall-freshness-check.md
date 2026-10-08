# Search Recall & Freshness Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one search/index invariant through bounded indexing, freshness, deletion, permission, and query scenarios.

## Required input

Provide selected index/query/resource, expected result behavior, implementation summary or patch boundary, safe environment, fixtures, and repository-native commands.

## Scenarios

- Index/create a resource and verify it is searchable through the expected query path.
- Update/delete the resource and verify freshness or documented delay semantics.
- Verify tenant/role/privacy filters prevent unauthorized results.
- Exercise filters/facets/sorting/pagination and empty/error states relevant to the selected boundary.
- Run reindex/backfill or provider-mock checks when the patch changes document schema.
