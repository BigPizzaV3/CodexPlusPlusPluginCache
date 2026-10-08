# Notebook Productionization Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a notebook or exploratory analysis before it becomes a repeatable pipeline, service, report, or decision artifact.

## Domain invariants

- Inputs, queries/snapshots, schema, credentials, privacy constraints, outputs, and consumers have explicit ownership and lineage.
- Execution does not depend on cell order, hidden kernel state, manual edits, local absolute paths, mutable remote data, or untracked packages.
- Parameters, randomness, time boundaries, timezone, sampling, and environment are explicit and reproducible.
- Exploratory visualization/commentary is separated from production transformations and decision-critical calculations.
- Production-owning logic has unit/data-contract/integration tests, bounded memory/compute, restart/idempotency, and observable failure behavior.
- Published artifacts preserve code/data/environment identity and do not expose secrets, personal data, or misleading stale outputs.

## Audit method

1. Execute from a clean kernel/environment in declared order and record every input, dependency, side effect, output, and manual intervention.
2. Trace data lineage and inspect mutable queries/files, schema assumptions, leakage, missingness, timezone, and sampling boundaries.
3. Identify reusable transformations versus exploratory cells and locate the correct package/pipeline/service owner.
4. Profile representative data volume, memory, runtime, retries, partial outputs, and restart behavior.
5. Review tests, dependency lock, parameter contract, scheduler/publication path, privacy, retention, and documentation.

## Priority model

- **P0:** cross-tenant access, incorrect billing/entitlement, corrupted canonical data, or decision-critical analytical error.
- **P1:** a material business-rule, data-quality, experiment, or analytics defect.
- **P2:** a lower-risk but concrete lineage, instrumentation, reproducibility, or maintainability issue.
