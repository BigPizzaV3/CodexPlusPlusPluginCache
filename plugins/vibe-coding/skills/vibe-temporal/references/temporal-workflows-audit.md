# Temporal Workflows Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit Temporal workflow history compatibility, determinism, activities, retries, signals/updates, versioning, deployment, and long-run lifecycle.

## Domain invariants

- Workflow code is deterministic for a recorded history: nondeterministic I/O, time, randomness, threading, and side effects live behind Temporal APIs or Activities.
- Every Activity has appropriate schedule/start/close timeouts, cancellation behavior, retry classification, and heartbeat details for long-running or resumable work.
- Activity side effects are idempotent or deduplicated by stable workflow/run/activity/business identity; retry cannot silently repeat irreversible effects.
- Compensation/saga state is durable, ordered, retryable, and aware of partially completed forward and compensating actions.
- Signals and Updates validate input, serialize state transitions safely, handle handler concurrency/initialization, and expose accepted/completed semantics accurately; Queries do not mutate state.
- Long-lived workflows bound event history and state via Continue-As-New at a safe boundary while preserving pending intent and signal/update behavior.
- Workflow code changes use supported patching/versioning or worker-versioning strategy and are replay-tested against representative production histories before incompatible deployment.
- Task queues, worker build/deployment identity, polling capacity, sticky/cache behavior, and rollback path preserve compatibility during mixed-version rollout.

## Audit method

1. Map workflow types, task queues, histories, commands, Activities, child workflows, timers, signals/updates/queries, search attributes, and worker deployment/version ownership.
2. Replay representative old histories against the candidate code and classify nondeterminism, removed commands, changed ordering, and serialization incompatibility.
3. Trace Activity timeout/retry/heartbeat/cancel and crash windows, including ambiguous external success and compensation behavior.
4. Inspect handler concurrency, workflow initialization, Continue-As-New, history growth, and pending message semantics for long-running workflows.
5. Verify rollout/rollback compatibility across old/new workers and task routing rather than assuming source rollback can process histories created by new code.

## Priority model

- **P0:** nondeterministic replay that blocks histories, duplicate irreversible activity effects, lost signals, or unrecoverable workflow state.
- **P1:** a material versioning, retry, timeout, cancellation, activity, or worker-rollout defect.
- **P2:** a lower-risk but concrete history growth, observability, or maintainability issue.
