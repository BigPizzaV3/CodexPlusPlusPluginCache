---
name: flower-action-runtime-guide
description: Use when creating, building, modifying, reviewing, migrating, or testing Java code that uses flower-action-runtime, including new Maven or Gradle project setup, Maven Central dependency and backend-module selection, ActionProposal and ActionDefinition design, registry/validation/policy/approval/pre-execution controls, visibility-safe owner-aware in-memory or JDBC duplicate handling, explicit failure retry policy, synchronous/async/deferred executor selection, ActionRun and RunStore persistence, JDBC CAS concurrency, completion/cancellation/recovery, Flower workflow or event-loop backends, and 0.1/0.2-to-0.3 migration.
---

# Flower Action Runtime Guide

## Overview

Use this skill to keep business actions behind one explicit control boundary
while supporting approval, audit, asynchronous work, durable completion, and
safe concurrent state changes.

This skill owns action-runtime guidance. When the host also authors Flower
Flows, Steps, Guards, Workers, event waits, or checkpoints, also load the
sibling `flower-app-guide` skill and follow both sets of rules.

## Start Here

Always read:

- `references/00-guide-version.md`
- `references/01-runtime-quick-rules.md`
- `references/90-verification.md`

Then read the reference that matches the task.

## Reference Routing

- Creating a Maven or Gradle host, choosing Action Runtime modules, adding or
  upgrading dependencies, or resolving Flower compatibility: read
  `references/05-build-and-module-selection.md`.
- Designing actions, proposal identity, definitions, policy, approval,
  pre-execution checks, results, audit, or idempotency: read
  `references/10-action-model-and-controls.md`.
- Choosing synchronous, in-process async, or durable deferred execution and
  implementing completion/cancellation: read
  `references/20-execution-modes.md`.
- Working with `ActionRun`, custom `RunStore`, JDBC schema/migrations, CAS,
  recovery, or multiple server instances: read
  `references/30-persistence-and-concurrency.md`.
- Selecting `DefaultActionRuntime`, the workflow backend, or the event-loop
  backend: read `references/40-flower-backends.md`.
- Writing unit, parity, concurrency, persistence, or recovery tests: read
  `references/50-testing.md`.
- Integrating the runtime into REST, MCP, schedulers, AI planners, Spring, a
  domain application, or Flower's common observation pipeline: read
  `references/60-host-integration.md`.

## Workflow

1. Identify the business side effect and every entry point that can request it.
2. Before changing a host build, read
   `references/05-build-and-module-selection.md`, preserve compatible host
   dependency management, and select only requirement-backed modules. Pin the
   published Maven Central `0.3.3` artifacts and verify APIs against the
   `v0.3.3` source tag. Inspect a mutable checkout only when modifying the
   runtime itself; its main branch may be a later SNAPSHOT.
3. Define a stable action id and register exactly one controlled executor.
4. Map request channel, proposer type, execution principal, tenant, run id, and
   idempotency key without collapsing them into one actor field. In 0.3,
   `ActionOrigin` no longer exists.
5. Configure validation, policy, approval, duplicate handling, audit/trace, and
   the pre-execution guard before exposing the action.
6. Choose the executor mode by lifetime and durability, not by convenience.
7. Use a queryable `RunStore` for approval, async, deferred, callback, or
   cancellation work. `InMemoryRunStore` may be sufficient for same-JVM
   local/test use; use a shared durable store for restart-sensitive,
   multi-instance, or production deferred work.
8. If Flower drives the backend, keep Worker/EventWorker ticks non-blocking and
   keep governance semantics in the shared action pipeline.
9. Add focused failure, resume, race, and recovery tests. Before reporting the
   work complete, map every applicable control to a named test and apply the
   controlled-action completion gate below, then run the complete verification
   appropriate to the changed modules.

## Controlled-Action Completion Gate

A generic duplicate test is not evidence for every duplicate-safety property.
First classify completed-result visibility as tenant-global/shareable,
principal-restricted, resource-bound, or a combination. Do not invent a
principal or resource boundary merely to satisfy this checklist. Keep each
applicable scenario as a distinct named test:

1. When policy has a denied-principal boundary, complete an authorized request,
   then retry the same tenant, action id, idempotency key, and resource when one
   applies, as a denied execution principal. Assert policy denial before
   `RETURN_EXISTING`, no cached output/result or protected run/resource
   disclosure, and no additional domain side effect.
2. When the action or result is resource-bound, complete a request for resource
   A, then reuse the same tenant, action id, and idempotency key for resource B
   with a request that is otherwise valid and authorized for B. Assert that A's
   result and protected data are not returned for B.

Record a short N/A reason for a genuinely absent visibility dimension or an
intentionally shareable result.

When a stateful duplicate policy claims concurrent duplicate suppression
and caches or finalizes reservations, also run a deterministic full-pipeline
race. Both contenders must call the Action Runtime; any accepted request must
pass through the registered executor. Place barriers or latches immediately
before the atomic reserve/complete transitions and never wait while holding the
per-scope lock. Assert exactly one `DuplicateActionDecisionType.ACCEPT`
reservation, exactly one executor invocation/domain side effect, and no
terminal overwrite. During the race the duplicate may observe the in-progress
rejection or the original result; every later duplicate must return the
unchanged original cached terminal result. A policy-only race is still useful
for ownership and ABA assertions, but it does not prove the runtime side-effect
count and cannot replace this full-pipeline test.

## Unsafe Control-Bypass Response Contract

When a request asks an admin, callback, retry, recovery, or other entry point
to call the side effect directly or return an existing result before
authorization, the agent-authored user-facing response must:

1. Explicitly refuse both the direct side-effect path and the
   pre-authorization duplicate/result lookup.
2. State that trusted execution principal and tenant come from host context
   and remain separate from request channel and proposer metadata.
3. Preserve definition resolution, validation, authorization/policy,
   visibility-safe duplicate handling, approval, audit, `PreExecutionGuard`,
   and the registered executor boundary.
4. State that approval/resume re-resolves the definition, re-validates current
   input, re-evaluates current policy, and runs `PreExecutionGuard` immediately
   before dispatch.
5. Explain that an early or insufficiently scoped cached-result lookup can
   disclose another tenant's, principal's, or resource's result.

Do not leave these consequences and controls implicit or only in referenced
guidance, and do not suggest a feature flag, alternate service, raw SQL, or
callback path that recreates the bypass.

## Non-Negotiable Rules

- Treat UI, REST, batch, MCP, scheduler, and AI output as proposals. Only a
  registered `ActionExecutor` may perform the controlled side effect.
- Never bypass registry, validation, policy, approval, duplicate handling, or
  audit in a resume, callback, retry, recovery, or admin path.
- Re-resolve, re-validate, re-evaluate policy, and run `PreExecutionGuard`
  after approval and immediately before dispatch.
- Do not block Flower Worker or EventWorker ticks with domain work, HTTP, LLM,
  tools, sleeps, or `Future.get()`.
- Use `ActionExecutionResult.code()` and `RetryDisposition` for machine
  decisions. Do not parse human messages or leave failure retry safety
  implicit.
- Give every action request a unique `runId`. Use the idempotency key to group
  transport retries; do not reuse a run id for a new request.
- Make every `RunStore` transition versioned CAS. Do not add an unconditional
  update/upsert path to the runtime SPI.
- Authenticate callback callers and verify tenant, run id, and attempt token.
- Make external cancellation hooks idempotent for the same run attempt and
  operation id.
- Scope duplicate reservations by at least tenant, action id, and idempotency
  key. Add principal or resource scope when an existing result is not safely
  shareable within the tenant.
- In `0.3.3`, `InMemoryDuplicateActionPolicy` scopes by tenant, action id,
  idempotency key, and an optional trusted visibility scope. Do not use the
  tenant-wide default when a cached result contains
  principal- or resource-restricted data. Authorizing the current request
  before lookup is insufficient when that authorization may concern a
  different resource from the cached result. Bind reservation/result lookup to
  a stable trusted principal or canonical resource identity through
  `DuplicateVisibilityScopeResolver`, or reject the duplicate without returning
  the cached result. Never derive that scope from arbitrary request payload,
  AI output, or an unverified callback. Run the corresponding
  denied-principal or authorized cross-resource test when that visibility
  boundary exists; otherwise record the dimension as N/A without inventing it.
- The `0.3.3` `InMemoryDuplicateActionPolicy` uses one owner-aware atomic state
  per scope and can suppress concurrent duplicates inside one JVM. It remains
  non-durable and unbounded: reservations/results disappear on restart, do not
  coordinate multiple processes, and are never evicted. Use
  `JdbcDuplicateActionPolicy` or another shared durable policy when restart or
  multi-instance coordination matters.
- Keep duplicate reservation state separate from `ActionRun` lifecycle state.
  For the shipped JDBC policy, apply the matching host-owned
  `db/action_duplicate/<dialect>.sql` or additive migration. Do not add an
  automatic TTL/lease takeover: an old `RUNNING` reservation does not prove
  that an external side effect stopped. Reconcile `ActionRun` and domain state
  before any explicit repair.
- Treat duplicate reservation, completion, and release as one atomic
  owner-aware per-scope state machine. Retain the current reservation owner
  from trusted execution identity, normally the unique `runId`; apply
  `complete()` or `release()` only while that caller still owns the
  reservation. Do not coordinate `completed` and `running` through separate
  unguarded reads and writes. A reserve racing with completion must observe the
  existing reservation or completed result, never accept again or overwrite
  terminal truth. A stale or repeated completion/release must not alter a
  newer owner's reservation. Use one lock or atomic map transition in-process
  and durable uniqueness/CAS in production. Test reserve-versus-complete plus
  stale/double-complete and stale/double-release ABA sequences with barriers
  or latches; prove one accepted execution, one side effect, stable terminal
  truth, and preservation of the current owner.
- Resolve, validate, and authorize the current request before duplicate
  reservation or `RETURN_EXISTING` result lookup.
- Treat `CANCELLED` as the runtime's terminal acceptance decision, not proof
  that an external operation physically stopped.
- Treat deferred dispatch as at-least-once-capable integration, not an
  exactly-once guarantee. Require deterministic operation ids, idempotent
  dispatch, authenticated callbacks, reconciliation, and an orphan policy.
- Treat `ActionRun` as runtime lifecycle truth. Flower checkpoints, events,
  signals, futures, and callback payloads are orchestration or delivery data.

## Source Of Truth

For a consuming application, the published `0.3.3` artifacts and the matching
`v0.3.3` source tag are authoritative. Never make a distributable guide,
sample, or plugin depend on a mutable checkout, `mavenLocal()`, or a SNAPSHOT.
When modifying the runtime itself, its checked-out source and tests become the
working source of truth. Useful upstream documents include:

```text
flower-action-runtime/README.md
flower-action-runtime/flower-action-runtime-core/README.md
flower-action-runtime/docs/architecture/DEFERRED_ACTION_EXECUTION.md
flower-action-runtime/docs/architecture/ACTION_RUN_PERSISTENCE.md
flower-action-runtime/docs/architecture/DURABLE_DUPLICATE_HANDLING.md
flower-action-runtime/docs/architecture/EXECUTION_BACKEND_STRATEGY.md
flower-action-runtime/docs/architecture/V0_2_MIGRATION_AND_MODULE_IMPACT.md
flower-action-runtime/docs/architecture/V0_3_MIGRATION_AND_MODULE_IMPACT.md
```
