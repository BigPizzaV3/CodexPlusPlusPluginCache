# Notebook Productionization Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Notebook Productionization improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Move production behavior into importable parameterized code while keeping the notebook as a thin reproducible analysis/report shell where useful.
- Pin environment and data/query identity, pass secrets through the established runtime boundary, and remove hidden state/manual edits.
- Make stages idempotent or atomically published with checkpoints and cleanup for partial output.
- Add tests for transformations, schema/data quality, boundary cases, and one end-to-end representative run.
- Bound resources and publish metadata linking output to code, inputs, parameters, and environment.

## Validation

- Run top-to-bottom from a clean environment and compare deterministic outputs or documented stochastic tolerance.
- Run extracted code tests plus representative-volume resource/restart/partial-failure scenarios.
- Verify published artifact lineage, freshness, privacy, and consumer compatibility; list unavailable data/scheduler gates.
