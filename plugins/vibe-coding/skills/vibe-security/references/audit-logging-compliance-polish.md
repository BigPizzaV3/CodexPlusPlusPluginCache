# Audit Logging Compliance Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Fix one coherent audit-log boundary for a selected material action or policy decision across owner-layer emission, storage/sink, metadata safety, tests, and docs/maps when used.

## Scope selection

Use the selected action/event, audit finding, failing test, compliance requirement supplied by the user, or explicit logging bug. Do not create a broad logging platform unless the selected fix requires a refactor plan.

## Polish targets

- Owner-layer event emission and alternate paths such as worker, webhook, admin, bulk, retry, or rollback flows.
- Event schema/metadata, correlation IDs, actor/resource/tenant scope, outcome/reason, and safe redaction.
- Sink persistence, query/read surfaces, retention settings, and operational docs when directly affected.
- Tests proving event presence/absence and sensitive metadata handling.

## Implementation principles

- Emit audit events where the material decision or state change becomes authoritative.
- Avoid logging secrets, tokens, raw credentials, excessive PII, or provider payloads unless explicitly safe and necessary.
- Preserve event schema compatibility or provide migration/forward-fix notes.
- Do not conflate debug logs with durable audit records.

## Validation

Run targeted tests or safe scenarios proving the selected action creates the correct audit record, denied paths are handled as expected, metadata is redacted, and query/sink behavior works. Report unavailable sinks as gates.
