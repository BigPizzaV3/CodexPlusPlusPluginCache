# Documentation Sync Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit repository documentation against authoritative code, configuration, schemas, commands, runtime behavior, and generated references.

## Domain invariants

- Documentation identifies its authoritative source and does not become a second mutable source of truth.
- Commands, paths, config keys, API/schema examples, lifecycle, permissions, and failure behavior match the repository.
- Generated docs/maps are rebuilt by repository-native tooling and distinguish generated from hand-maintained content.
- Runbooks include observable trigger, safe action, rollback/recovery, ownership, and environment assumptions.

## Audit method

1. Trace each selected statement/example to code, tests, config, schema, script, or runtime evidence.
2. Check stale commands, dead paths, renamed symbols, incompatible examples, missing failure/rollback, and duplicated truth.
3. Inspect generation sources and whether manual edits would be overwritten.
4. Separate factual drift from broader editorial improvement.

## Priority model

- **P0:** a migration or documentation defect that can cause data loss, unsafe operation, broken public contract, or unrecoverable rollout.
- **P1:** a material ownership, compatibility, sequencing, or operator-guidance gap.
- **P2:** a lower-risk but concrete boundary, drift, or maintainability issue.
