# Reverse Engineering Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Reverse Engineering improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Implement the smallest compatibility layer at the actual boundary and preserve raw evidence/fixtures separately from inferred domain models.
- Parse defensively with explicit bounds and unknown-field/version policy; never execute captured untrusted content.
- Use semantic normalization only for documented nondeterminism and keep stable order/timing/error quirks when consumers depend on them.
- Add differential/golden tests before refactoring internals; isolate intentional deviations behind versioning or migration.
- Document confidence and unresolved branches so future evidence can update the model without rewriting the entire adapter.

## Validation

- Run deterministic fixture/golden tests and differential tests against an authorized reference where available.
- Exercise version skew, malformed/truncated/unknown fields, duplicate/retry, concurrent operations, restart, and representative data scale.
- Verify fixture redaction, provenance, deterministic normalization, and absence of unsupported claims.
