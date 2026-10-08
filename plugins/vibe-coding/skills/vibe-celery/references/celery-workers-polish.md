# Celery Workers Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Celery Workers improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Keep acknowledgement and retry policy adjacent to task idempotency and transaction/outbox boundaries; do not change one in isolation.
- Use bounded exponential backoff/jitter and a terminal failure route; distinguish retryable dependency failure from permanent input failure.
- Set task and network/database timeouts coherently and use soft cancellation/cleanup before hard limits where the pool supports it.
- Tune concurrency/prefetch/routing from resource and downstream budgets; isolate long or scarce-resource tasks when necessary.
- Implement deployment shutdown that stops intake, allows bounded drain or deliberate redelivery, and exposes unfinished work.

## Validation

- Run Celery integration tests with the configured broker/backend and worker pool; eager mode alone is not delivery evidence.
- Exercise duplicate publication, crash/kill around ack and side effects, retry exhaustion, timeout, broker reconnect, scheduled overlap, and shutdown.
- Measure reserved/active/retried tasks, queue age, result retention, connection count, and downstream pressure.
