# Terraform Delivery Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Terraform Delivery improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Preserve resource identity with moved/import declarations where supported and keep them long enough for all maintained state lineages.
- Make destructive or replacement behavior explicit and stage dependent/data migrations before infrastructure removal.
- Keep module contracts small, typed, documented, and provider-neutral where practical; avoid hidden environment lookups that defeat plan review.
- Pin provider/module constraints and update dependency locks intentionally; keep secrets in the established secret-delivery boundary.
- Never bypass backend locking or use routine `-target`/manual state edits to make an incomplete configuration appear converged.

## Validation

- Run format, validate, repository policy/tests, and a saved plan for each directly affected environment using documented non-secret inputs.
- Inspect machine-readable or textual plan for address identity, replacement/destruction, unknowns, sensitive output, and expected resource count/change set.
- For state/refactor work, prove no unintended recreate and document backup, lock, apply order, and recovery procedure.
