# ML Pipeline Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed ML Pipeline improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix data/split/feature ownership before tuning model complexity.
- Version code, data snapshot/query, schema, preprocessing, model, threshold, and evaluation result as one release lineage.
- Keep test data untouched by iterative selection and add slice/failure analysis where product risk is concentrated.
- Make backfill/retraining, artifact promotion, compatibility, and rollback explicit.

## Validation

- Run data-contract/quality/leakage/split tests and reproduce the selected training/evaluation path where feasible.
- Compare against baseline with uncertainty and named slices; verify artifact load and preprocessing compatibility.
- List unavailable private data, accelerator, long-running training, or production-drift gates.
