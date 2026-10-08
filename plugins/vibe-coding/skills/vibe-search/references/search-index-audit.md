# Search Index Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one search, full-text, faceted, autocomplete, permissions-filtered, or indexing boundary for relevance, freshness, authorization, consistency, and failure behavior.

## Domain invariants

- Indexed documents reflect authoritative data with known freshness and deletion/update semantics.
- Search results enforce tenant, role, ownership, plan, privacy, and visibility rules at the right layer.
- Filters, facets, sorting, pagination, ranking, tokenization, language handling, and empty states match product expectations.
- Reindex/backfill, partial failures, stale documents, and provider/index downtime have defined recovery behavior.
- Tests or replay fixtures prove key recall/freshness/permission cases.

## Audit method

Trace selected resource from authoritative write/delete through indexing pipeline, document schema, query builder, filters, result hydration, UI/API state, analytics, and tests.
