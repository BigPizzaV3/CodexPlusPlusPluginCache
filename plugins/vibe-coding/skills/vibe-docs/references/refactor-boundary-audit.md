# Refactor Boundary Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a proposed or partial refactor for ownership, contract preservation, migration completeness, and removal of duplicate paths.

## Domain invariants

- The target boundary has a clear owner and improves current cohesion/coupling without speculative framework layers.
- Public/internal contracts, imports, serialization, state, errors, config, and performance remain compatible or deliberately migrated.
- All direct callers, tests, docs, generated artifacts, deployment/runtime references, and dead paths are accounted for.
- Compatibility shims have explicit users and removal criteria; no parallel source of truth remains.

## Audit method

1. Map the current owner, dependency graph, call sites, data/control flow, tests, config, and runtime loading.
2. Define the proposed boundary and identify contract, rollout, migration, and validation deltas.
3. Check cyclic dependencies, hidden initialization, generated code, reflection/registration, serialization, and performance-sensitive paths.
4. Split independent refactors and reject broad cleanup without task value.

## Priority model

- **P0:** a migration or documentation defect that can cause data loss, unsafe operation, broken public contract, or unrecoverable rollout.
- **P1:** a material ownership, compatibility, sequencing, or operator-guidance gap.
- **P2:** a lower-risk but concrete boundary, drift, or maintainability issue.
