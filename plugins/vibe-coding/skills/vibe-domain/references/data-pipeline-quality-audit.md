# Data Pipeline & Quality Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a batch/stream/ELT/notebook pipeline across lineage, contracts, quality, retries, late data, reproducibility, and operational ownership.

## Domain invariants

- Source-to-sink lineage, schema, identity, partition/window, watermark, units, nullability, and ownership are explicit.
- Retries, partial batches, late/out-of-order data, duplicates, schema evolution, and backfills converge deterministically.
- Quality checks detect completeness, validity, uniqueness, referential, distribution, and freshness failures at useful boundaries.
- Notebooks and ad-hoc logic are promoted to versioned, testable pipeline code before they own production behavior.

## Audit method

1. Trace one dataset from source extraction through transforms, storage, quality gates, consumers, and backfill path.
2. Check checkpoint/offset ownership, partition overwrite/append semantics, duplicate/late data, partial commit, and retry/resume.
3. Inspect schema contracts, lineage metadata, data tests, alerts, quarantine, reconciliation, and privacy/retention.
4. Identify hidden notebook/manual steps and environment/dependency drift.

## Priority model

- **P0:** cross-tenant access, incorrect billing/entitlement, corrupted canonical data, or decision-critical analytical error.
- **P1:** a material business-rule, data-quality, experiment, or analytics defect.
- **P2:** a lower-risk but concrete lineage, instrumentation, reproducibility, or maintainability issue.
