# LLM Agent Tools Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed LLM Agent Tools improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Put capability and authorization checks in tool/runtime code; treat model intent as untrusted.
- Use typed schemas, stable operation IDs, explicit approval records, and idempotent side-effect boundaries.
- Bound steps, parallelism, context, cost, and retries; produce a terminal state for every cancellation or failure.
- Persist only necessary, provenance-bearing, tenant-isolated memory and redact sensitive tool payloads from traces.

## Validation

- Run tool-schema/policy tests plus injection, denied approval, duplicate, timeout, cancel, partial-success, and max-step cases.
- Verify side-effect count and persisted run state after interruption/replay.
- List live tool credentials, external approvals, and provider behavior not exercised.
