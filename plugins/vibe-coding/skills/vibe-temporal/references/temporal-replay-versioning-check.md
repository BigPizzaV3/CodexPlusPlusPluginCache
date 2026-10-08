# Temporal Replay & Versioning Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Replay a curated corpus of old and edge-case histories against the patched worker and fail on nondeterminism or decode incompatibility.
- Interrupt long Activities before/after heartbeat and external side effects; verify retry, cancellation, idempotency, and progress resume.
- Send duplicate/concurrent signals or Updates around initialization and Continue-As-New; verify one legal state transition and response semantics.
- Run old and new worker versions against staged task routing; verify compatibility, poll capacity, rollback, and histories created by each version.
- Grow a representative long-lived history and verify Continue-As-New threshold, state transfer, pending intent, and observability.
