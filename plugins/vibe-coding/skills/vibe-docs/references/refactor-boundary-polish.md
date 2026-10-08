# Refactor Boundary Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Refactor Boundary improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Move behavior to one owner and update all directly affected consumers in the same coherent slice.
- Preserve contracts by default; when changing them, provide explicit migration and remove obsolete paths when safe.
- Avoid wrapper-only layers, duplicate adapters, temporary flags, and mass formatting/renames unrelated to the boundary.
- Synchronize tests, docs, generated outputs, config, registration, and build/deploy references.

## Validation

- Run affected unit/integration/type/build/import/dependency checks.
- Verify old/new compatibility or migration, dead-path removal, generated artifacts, and one representative runtime trace.
- Report untested plugin/reflection/deployment consumers explicitly.
