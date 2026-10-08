# Background Jobs Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit background work: queues, workers, cron/scheduled jobs, webhooks, retries, idempotency, locks, concurrency, long-running tasks, cleanup, and observability. Keep only repository-visible issues with correctness, data, cost, reliability, or operational impact.

## Inspect

Queue/job definitions, worker entry points, schedulers/cron, webhook handlers, retry/backoff logic, idempotency keys, locks/transactions, batch/pagination loops, migrations, config/env, deployment/CI, logs/metrics/traces, dead-letter handling, admin tooling, tests, docs, and related API/UI state.

## Issue classes

- Correctness and idempotency: duplicate processing, unsafe retries, missing dedupe, out-of-order webhooks, non-atomic state transitions, partial writes, and inconsistent cleanup.
- Concurrency and scale: missing locks, race-prone counters/quotas, unbounded fan-out, memory/time limits, N+1 batch work, starvation, and thundering herd patterns.
- Failure handling: swallowed errors, infinite retries, no dead-letter/poison handling where architecture expects it, poor recovery path, and user-visible state stuck pending.
- Operational readiness: missing health/metrics/log context, unsafe secrets/config, deploy ordering issues, migrations required before workers, and lack of runbook for critical jobs.
- Data/privacy safety: cross-tenant processing, PII leakage in logs/payloads, retention cleanup gaps, and destructive job without guardrails.
- Regression resistance: missing tests/fixtures for retries/idempotency/lifecycle edges, stale docs, or workers not exercised by CI.

## Priority model

Job can corrupt/delete data, leak cross-tenant/private data, charge/send/notify repeatedly, deadlock critical production work, or break billing/security lifecycle.

Important idempotency/retry/concurrency gap, stuck pending user state, missing observability for critical worker, or missing tests for high-risk background behavior.

Lower-risk but concrete job quality issue: stale runbook, weak logging, minor batch inefficiency, secondary retry gap, or maintainability issue in worker ownership.

## Finding quality

- Every finding must cite `path:line[-line]` evidence for producer, worker, state owner, and affected consumer when possible.
- Include expected lifecycle behavior, failure/retry/idempotency contract, acceptance criteria, and validation direction.
- Merge issues by job owner when one fix validates them together.
