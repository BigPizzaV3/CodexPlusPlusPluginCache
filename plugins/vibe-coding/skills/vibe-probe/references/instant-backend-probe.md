# Instant Backend Probe

## Operation

Inspect one new primary area in the visible conversation. When a fix is requested, apply one complete evidence-backed correction. A clean area ends the probe; it does not certify the repository.

## Goal

In one turn, find and, when evidence permits, fix one concrete backend bug in an area that has not already been the primary target of this same prompt in the current visible thread.

This probe owns **server-side runtime behavior**: request handling, business rules, persistence, authorization, background work, and outbound integrations.

Out of scope for this probe (belongs to the sibling probes): dependency direction and module ownership questions, client-side state and rendering, layout/responsive/visual/a11y defects. A structural smell found here is fixed only if it is the direct cause of the proven runtime bug; otherwise record it as an observation and hand it to the architecture probe.

## Thread-local visited ledger

Before selecting the target, reconstruct a private ledger from visible conversation only:

- previous verdicts from **any** probe in this thread (architecture, `Instant Backend Probe`, frontend, UI/UX), their target areas, bug types, changed files, clean probes, blocked areas, and validations;
- previous patch-check reports, diffs, user-provided symptoms, logs, failing commands, traces, schemas, or implementation notes in this thread;
- current uncommitted changes and visible patch contour when repository commands expose them;
- unresolved gates or exclusions that must not be contradicted.

An area counts as visited when it was already the primary owner checked clean, fixed, or blocked in this thread: a route/endpoint group, service/use case, repository/query layer for an aggregate, migration, policy rule set, worker/job, scheduler, event consumer, outbound adapter, cache layer, or transport middleware.

Direct producers, consumers, tests, fixtures, generated clients, configs, and docs may be inspected to avoid conflicting with prior work. They do not become the new primary target unless the bug belongs to a different authoritative owner or a materially different runtime edge.

If previous changes touched the same behavior, preserve their intended contract unless current repository evidence proves it wrong. Do not create a parallel fix for the same invariant.

## Target selection

If the user provided a symptom, failing test, log line, stack trace, endpoint, or suspected area, use it to bias selection, but still avoid already visited owners unless the only safe fix completes an unfinished owner-layer slice.

If the user gave no target, choose the highest-confidence unvisited area from repository evidence, in this order:

1. failing backend tests, type errors, runtime logs, crash traces, or TODO/FIXME tied to reachable server behavior;
2. recently changed or currently dirty server contracts (handlers, schemas, migrations, policies) not yet primary targets in this thread;
3. high-traffic runtime edges discoverable from route tables, controllers, RPC/GraphQL resolvers, CLI commands, queue registrations, cron definitions, or webhook receivers;
4. persistence correctness: transaction boundaries, isolation, missing/incorrect constraints, nullable drift between schema and code, migration/rollback asymmetry, N+1 or unbounded queries on a reachable path, pagination/ordering instability;
5. an unvisited runtime seam adjacent to prior fixes that could conflict with or complete the previous contract without re-fixing the same owner;
6. a high-risk untouched seam: input validation and error semantics, status codes, auth/RBAC/ABAC checks, tenant scoping in queries, state machine transitions, idempotency and retry safety, concurrency and race windows, cache/search invalidation, external provider and webhook handling (signature, replay, timeout, partial failure), serialization/timezone/precision handling, or configuration and secret loading.

Two areas are different only when the authoritative owner, contract type, or runtime edge differs. Moving from a service to its tests is not a new area; moving from an HTTP handler to the worker that consumes the same event is, because the worker owns a distinct runtime contract.

## Bug threshold

Treat something as a bug only when current repository evidence shows a reachable violation of expected behavior, declared contract, type/schema invariant, state transition, authorization/policy rule, tenant boundary, persistence model, external protocol, generated client expectation, test harness contract, product acceptance, or runtime failure semantics.

Do not fix style preferences, speculative hardening, cosmetic cleanup, broad refactors, dependency upgrades, or unrelated weak findings. Performance counts only when a reachable path is unbounded or degrades correctness (timeouts, lock contention, memory growth) — not as general optimization. If evidence is insufficient, return a clean or blocked verdict.

Use one bug type in the final verdict:

```text
api_contract
input_validation
error_semantics
state_transition
data_persistence
transaction_boundary
migration_integrity
auth_policy
tenant_isolation
concurrency_idempotency
integration_webhook
cache_search_freshness
background_job
serialization_encoding
config_secrets
unbounded_query
test_harness
generated_client
other_reachable_bug
```

Use priority only from evidence:

```text
P0 = data loss or corruption, security/privacy break, tenant leak, auth bypass, unrecoverable migration, outage, or blocking build/release
P1 = user-visible functional failure, broken API contract, wrong persisted state, incorrect access decision, lost or duplicated job/event, or recurring operational failure
P2 = low-risk correctness, narrow edge case, test harness or generated-client issue with limited impact
```

## Execution rules

- Do not ask for a plan, print a plan, or create multiple workstreams. Select one target internally and execute.
- Stop after the first concrete bug is fixed, blocked, or the selected area is checked clean with bounded evidence.
- Apply the smallest complete fix at the authoritative owner — the layer that owns the invariant, not the nearest call site. Update only directly required consumers, tests, fixtures, generated clients, schemas, configs, and operator notes.
- Migrations are append-only unless the repository's own convention says otherwise: prefer a new forward migration over editing an applied one, and keep rollback defined.
- Preserve wire compatibility for existing clients unless the bug proves the current wire shape is wrong; when a response or event shape must change, update the generated client/contract artifact in the same patch.
- Keep rollout, rollback, forward-fix, mixed-version behavior, and previous thread patches intact unless the bug proves them wrong.
- Do not override user changes or unrelated uncommitted work.
- Do not broaden into a domain audit, release review, dependency migration, redesign, or multi-bug cleanup.
- If the fix requires a missing product decision, an external credential, a destructive environment, production-only evidence, or an unavailable managed service, do not invent it. Report `BACKEND_BUG_BLOCKED` with the exact gate.

## Validation

Run repository-native checks relevant to the selected area and changed files, discoverable from the active repository instructions (`AGENTS.md`, `CLAUDE.md` or applicable scoped rules), package scripts, Makefile, CI config, tests, or repo docs. Prefer the smallest command that proves the fixed owner behavior and at least one direct consumer or regression path:

- the narrowest unit/integration test target covering the owner, plus a regression case for the exact failing input when a test file already exists for that owner;
- type check / compile of the changed package;
- migration up/down or schema diff against a local/ephemeral database when the repo already provides that command;
- a local request/job invocation when the repo provides a runnable harness.

Do not invent commands, and do not claim a database, queue, or third-party sandbox was exercised if it was not reachable. Record exact commands and results. Unavailable, expensive, external, or credential-blocked checks are explicit gates, not passes.

If no files changed, validate by static evidence and any safe read-only checks available for the selected area.
