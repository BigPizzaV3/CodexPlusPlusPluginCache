# Kubernetes Rollout & Failure Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Render and validate the exact overlay; reject selector, port, reference, schema, or policy mismatches.
- Hold a dependency unavailable during startup and verify startup/readiness behavior without liveness restart amplification.
- Send traffic during rollout and SIGTERM; verify drain, availability budget, progress deadline, and rollback signal.
- Simulate pod/node loss within a safe test cluster and verify PDB, rescheduling, volume attach, and state recovery.
- Drive representative saturation and verify requests, limits, HPA signal, stabilization, backlog, and overload response.
