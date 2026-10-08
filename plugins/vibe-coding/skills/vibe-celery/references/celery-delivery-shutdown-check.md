# Celery Delivery & Shutdown Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Publish the same task twice and crash a worker before/after the side effect and acknowledgement; verify duplicate/loss contract.
- Force retryable and permanent failures; verify backoff/jitter, attempt context, terminal routing, and no retry storm.
- Exercise soft/hard timeout and worker termination; verify cleanup, acknowledgement/redelivery, and stale external work.
- Run warm/cold shutdown with active and reserved tasks; verify intake stop, drain/redelivery, and deployment readiness.
- Drive representative concurrency/prefetch and scheduled work; measure queue age, memory, connections, fairness, and downstream saturation.
