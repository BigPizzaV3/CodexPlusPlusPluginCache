# Audit Trail Integrity Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one audit-trail invariant for a selected action, policy decision, or patch through bounded scenarios. Prove emitted events are complete, safe, durable enough for the repo-stated use case, and queryable when required.

## Required input

Provide the selected action/event, expected audit schema, implementation summary or patch boundary, safe environment, fixtures/accounts, and repository-native commands or manual scenarios.

## Scenarios

- Execute success and denied/failure paths and verify expected audit event presence or absence.
- Check actor, resource, tenant/scope, action, outcome, reason, timestamp, correlation ID, and safe metadata.
- Verify alternate paths such as worker/webhook/admin/bulk/retry when directly relevant.
- Confirm sensitive fields are redacted and the sink/query path works in the selected environment.
