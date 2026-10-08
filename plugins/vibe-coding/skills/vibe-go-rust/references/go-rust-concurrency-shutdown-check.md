# Go Rust Concurrency & Shutdown Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Cancel callers at each await/I/O/commit boundary and verify child work, locks, connections, and side effects terminate consistently.
- Saturate admission and downstream pools; verify bounded queue/task growth, fairness, timeout budget, and recovery.
- Inject connection resets and slow responses; verify pool reuse, retry eligibility, deadline propagation, and no retry storm.
- Send SIGTERM during idle, active request, streaming, and background work; verify readiness, drain/cancel, telemetry, and forced-deadline behavior.
- Run race/leak/deadlock instrumentation supported by the repository and inspect before/after task/goroutine counts.
