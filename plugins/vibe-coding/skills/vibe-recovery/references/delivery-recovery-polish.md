# Delivery Recovery Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Delivery Recovery improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Promote one immutable verified artifact and preserve digest/provenance through every environment and rollback reference.
- Keep release gates deterministic and least-privilege; invalidate or segregate caches/artifacts when trust or inputs change.
- Stage rollout with explicit health/abort criteria and compatibility order; use flags only as owned temporary controls.
- Coordinate schema/data changes with rollback reality and document forward-fix/restore when binary rollback cannot restore correctness.
- Automate and regularly exercise restore with integrity/application checks; protect backups from the same credentials/failure domain as production.

## Validation

- Run CI/build tests from clean inputs where supported and verify artifact digest/provenance/manifest linkage.
- Exercise staged rollout/abort/rollback or a faithful rehearsal, including config/flag and schema compatibility.
- Restore representative backups into an isolated environment and verify integrity, application behavior, observed RPO/RTO, and operator runbook.
