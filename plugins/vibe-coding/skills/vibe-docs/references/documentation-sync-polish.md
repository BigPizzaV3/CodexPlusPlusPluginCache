# Documentation Sync Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Documentation Sync improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Update the nearest maintained document or generator source, not downstream generated output alone.
- Keep examples executable/minimal and avoid inventing commands, flags, fields, or environment guarantees.
- Record version/environment assumptions and distinguish repository-proven behavior from external requirements.
- Remove stale duplicate guidance when one canonical document now owns it.

## Validation

- Run doc generators, link/lint/example/command checks available in the repository.
- Compare generated diff and verify referenced paths/symbols/configs exist.
- List external service or deployment behavior not executable from the worktree.
