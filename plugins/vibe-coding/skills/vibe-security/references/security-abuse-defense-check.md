# Security Abuse Defense Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Use synthetic accounts to exercise bounded failed-login/recovery/MFA/session flows across replicas; verify atomic counters, progressive response, generic errors, recovery, and alerts.
- Attempt horizontal/vertical/tenant access with controlled fixtures across API, jobs, exports, and admin paths; verify authoritative denial and audit events.
- Test URL normalization, redirects, DNS changes, private/metadata destinations, oversized/nested/compressed payloads, and parser time/memory limits in isolation.
- Run container/host policy checks for identity, capabilities, filesystem, secret mounts, network egress, and metadata access without weakening production controls.
- Rotate/revoke a test secret/key through old/new overlap and verify clients, caches, logs, artifacts, detection, and rollback/incident procedure.
