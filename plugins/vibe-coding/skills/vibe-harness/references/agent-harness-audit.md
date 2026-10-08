# Agent Harness Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit the run state machine of an agent harness across loops, parallel branches, persistence, tools, recovery, and replay.

## Domain invariants

- Every run, step, attempt, child, tool call, checkpoint, and terminal outcome has a stable identity and an explicit monotonic state transition.
- Loop continuation is bounded by declared success, failure, cancellation, iteration/time/token/cost budgets, and no-progress detection.
- Parallel branches have an explicit fan-out owner, bounded admission, deterministic join policy, failure policy, cancellation propagation, and orphan cleanup.
- Checkpoint and resume boundaries distinguish committed side effects from replayable computation; stale workers cannot commit after lease or version loss.
- Tool execution validates arguments at the boundary, records approval before protected side effects, and uses idempotency/deduplication where retries can repeat effects.
- Context and memory record provenance, scope, freshness, retention, redaction, and size limits; untrusted retrieved content cannot silently become instruction authority.
- Backlog, rate limits, downstream saturation, and cancellation produce bounded backpressure rather than unbounded task creation or retry storms.
- A run can be reconstructed from durable events and correlated traces without treating logs as the source of truth.

## Audit method

1. Trace one representative run from admission through loop decisions, child creation/join, tool effects, checkpointing, resume, and terminal publication.
2. Build the actual transition table, including duplicate delivery, crash windows, cancellation races, stale lease/version, partial join, and operator retry.
3. Inspect where concurrency is bounded and who owns child/task cancellation, result ordering, error aggregation, and cleanup.
4. Compare persisted state with emitted events/traces and identify states that cannot be replayed or explained deterministically.
5. Check approval and trust boundaries for tools, retrieved context, memory writes, and external side effects.

## Priority model

- **P0:** duplicate or unauthorized tool effects, lost run state, cross-run data exposure, runaway fan-out, or unrecoverable orchestration.
- **P1:** a material ownership, checkpoint, replay, cancellation, concurrency, or persistence defect.
- **P2:** a lower-risk but concrete observability, fairness, recovery, or maintainability issue.
