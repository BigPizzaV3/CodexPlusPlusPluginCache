# Instant Bug Fix Polish

## Operation

Inspect one new primary area in the visible conversation. When a fix is requested, apply one complete evidence-backed correction. A clean area ends the probe; it does not certify the repository.

## Goal

In one turn, find and, when evidence permits, fix one concrete bug in a repository area that has not already been the primary target of this same prompt in the current visible thread. Each repeated use in the same thread must move to a different unvisited area while treating prior findings, clean probes, changed files, changed contracts, validation results, and remaining gates as constraints.

This is not a repository-wide audit and not task planning. It is a bounded execution probe that either applies one smallest complete owner-layer fix, returns a clean verdict for the selected new area, or reports a blocker.

## Thread-local visited ledger

Before selecting the target, reconstruct a private ledger from visible conversation only:

- previous `Instant Bug Fix Polish` verdicts, target areas, bug types, changed files, checked-clean areas, blocked areas, and validations;
- previous patch-check reports, diffs, user-provided symptoms, logs, failing commands, maps, audit outputs, or implementation notes in this thread;
- current uncommitted changes and visible patch contour when repository commands expose them;
- unresolved gates or exclusions that must not be contradicted.

An area counts as visited when it was the primary owner, surface, contract, symbol family, route, state machine, policy rule, worker/job, integration adapter, UI flow, test harness, config boundary, or map/docs artifact already checked clean, fixed, or blocked in this thread.

Direct producers, consumers, tests, generated artifacts, configs, docs, and maps may be inspected to avoid conflicting with prior work. They do not become the new primary target unless the selected bug belongs to a different authoritative owner or a materially different contract edge.

If previous changes touched the same behavior, preserve their intended contract unless current repository evidence proves they are wrong. Do not create an alternative parallel fix for the same invariant.

## Target selection

If the user provided a symptom, failing test, log, affected feature, or suspected area, use it to bias selection, but still avoid already visited primary areas unless the only safe fix requires completing an unfinished owner-layer slice.

If the user did not provide a target, choose the highest-confidence unvisited area from repository evidence, in this order:

1. failing tests, type errors, lint errors, runtime logs, crash traces, or explicit TODO/FIXME tied to reachable behavior;
2. recently changed or currently dirty contracts that have not been primary targets in this thread;
3. high-traffic boundaries discoverable from routes, commands, package scripts, app entrypoints, tests, schemas, migrations, workers, jobs, policies, or integrations;
4. an unvisited direct edge adjacent to prior fixes when it could conflict with or complete the previous contract without re-fixing the same owner;
5. a high-risk untouched seam: validation/error semantics, auth/RBAC/ABAC, tenant isolation, state transitions, persistence, migrations, background jobs, concurrency/idempotency, cache/search freshness, external provider/webhook handling, UI data flow, build/test configuration, or generated artifacts.

Two areas are different only when the authoritative owner, contract type, or primary runtime edge is different. Moving from implementation code to tests for the same owner is not a new area; moving from an API owner to a worker consumer can be new if the worker owns a distinct runtime contract.

## Bug threshold

Treat something as a bug only when current repository evidence shows a reachable violation of expected behavior, declared contract, type/schema invariant, state transition, authorization/policy rule, tenant boundary, persistence model, external protocol, generated artifact expectation, test harness contract, product acceptance, or runtime failure semantics.

Do not fix style preferences, speculative best practices, cosmetic cleanup, broad refactors, dependency upgrades, stale map-only claims, or unrelated weak findings. If evidence is insufficient, return a clean or blocked verdict for the selected area instead of inventing a bug.

Use one bug type in the final verdict:

```text
contract
validation_error
state_transition
data_persistence
auth_policy
tenant_isolation
concurrency_idempotency
integration_webhook
cache_search_freshness
ui_data_flow
build_config
test_harness
generated_artifact
docs_map_staleness
other_reachable_bug
```

Use priority only from evidence:

```text
P0 = data loss, security/privacy break, tenant leak, production outage, unrecoverable migration, or blocking build/release
P1 = user-visible functional/runtime failure, broken contract, wrong state, incorrect access, or recurring operational failure
P2 = low-risk correctness, test harness, generated artifact, docs/map stale issue, or narrow edge-case with limited impact
```

## Execution rules

- Do not ask for a plan, print a plan, or create multiple workstreams. Select one target internally and execute.
- Stop after the first concrete bug is fixed, blocked, or the selected new area is checked clean with bounded evidence.
- Apply the smallest complete fix at the authoritative owner. Update only directly required producers, consumers, tests, generated artifacts, configs, docs, maps, and operator notes.
- Keep compatibility, rollout, rollback, forward-fix, mixed-version behavior, and previous thread patches intact unless the bug proves they are wrong.
- Do not override user changes or unrelated uncommitted work. When dirty files are unrelated, avoid them; when they are the current contour, inspect them before editing.
- Do not broaden into a domain audit, release review, dependency migration, redesign, or multi-bug cleanup.
- If the bug requires a missing product decision, external credential, destructive environment, production-only evidence, or unavailable managed service, do not invent the decision or claim validation. Report `BUG_FOUND_BLOCKED` with the exact gate.

## Validation

Run repository-native checks relevant to the selected area and changed files, discoverable from the active repository instructions (`AGENTS.md`, `CLAUDE.md` or applicable scoped rules), package scripts, Makefile, CI config, tests, or repo docs. Prefer the smallest command that proves the fixed owner behavior and at least one direct consumer or regression path.

Do not invent commands. Record exact commands and results. If checks are unavailable, too expensive, external, destructive, or blocked by credentials/services, report them as explicit gates, not passes.

If no files changed, validate by static evidence and any safe read-only checks available for the selected area.
