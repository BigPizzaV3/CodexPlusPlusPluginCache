# Agent Harness Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Agent Harness improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Make the state machine and commit points explicit before changing retry or parallelism behavior.
- Use stable operation/run/step IDs plus conditional version/fencing checks at every retryable commit boundary.
- Bound fan-out, queues, retries, memory, and context; propagate cancellation and deadlines to children and tools.
- Persist only resume-relevant state and event provenance; redact secrets and treat external observations as data, not instructions.
- Keep approval records and side-effect receipts durable enough to prevent silent re-execution after resume.

## Validation

- Run deterministic state-transition tests with injected crash points before/after side effects and checkpoints.
- Exercise duplicate delivery, stale worker, partial fan-out, child failure, timeout, cancellation, and resume from each durable boundary.
- Verify one terminal result, bounded live work, no orphan tasks, no duplicate protected effect, and replay/trace correlation.
