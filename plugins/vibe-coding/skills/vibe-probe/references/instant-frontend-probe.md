# Instant Frontend Probe

## Operation

Inspect one new primary area in the visible conversation. When a fix is requested, apply one complete evidence-backed correction. A clean area ends the probe; it does not certify the repository.

## Goal

In one turn, find and, when evidence permits, fix one concrete frontend bug in an area that has not already been the primary target of this same prompt in the current visible thread.

This probe owns **client-side behavior**: state, data flow, effects, routing, forms, caching, rendering correctness, and browser-runtime semantics.

Out of scope for this probe (belongs to the sibling probes): module/dependency structure, server-side logic and persistence, and purely presentational defects — spacing, breakpoints, contrast, visual states, motion, and screen-reader semantics that do not stem from wrong data or wrong state. If the rendered output is wrong because the state is wrong, it is this probe. If the state is right and it only *looks* wrong, hand it to the UI/UX probe.

## Thread-local visited ledger

Before selecting the target, reconstruct a private ledger from visible conversation only:

- previous verdicts from **any** probe in this thread (architecture, backend, `Instant Frontend Probe`, UI/UX), their target areas, bug types, changed files, clean probes, blocked areas, and validations;
- previous patch-check reports, diffs, user-provided symptoms, console errors, network traces, reproduction steps, or implementation notes in this thread;
- current uncommitted changes and visible patch contour when repository commands expose them;
- unresolved gates or exclusions that must not be contradicted.

An area counts as visited when it was already the primary owner checked clean, fixed, or blocked in this thread: a screen/route, a feature's data-fetching layer, a store/slice/context, a form and its schema, a component's behavioral contract (props/events/callbacks), a client cache/invalidation policy, an SSR/hydration path, a client-side auth/guard flow, a real-time channel, or the client build/test configuration.

Direct producers, consumers, hooks, tests, mocks, generated API clients, and configs may be inspected to avoid conflicting with prior work. They do not become the new primary target unless the bug belongs to a different authoritative owner.

If previous changes touched the same behavior, preserve their intended contract unless current repository evidence proves it wrong. Do not add a second source of truth for state an earlier patch already placed.

## Target selection

If the user provided a symptom, failing test, console error, reproduction, screen, or suspected component, use it to bias selection, but still avoid already visited owners unless the only safe fix completes an unfinished owner-layer slice.

If the user gave no target, choose the highest-confidence unvisited area from repository evidence, in this order:

1. failing component/e2e tests, type errors, build warnings that indicate real breakage, console/runtime errors, or TODO/FIXME tied to reachable client behavior;
2. recently changed or currently dirty client contracts (component props, store shape, query keys, route params) not yet primary targets in this thread;
3. data-flow correctness on a reachable screen: request lifecycle, loading/empty/error branches that are missing or unreachable, stale-after-mutation reads, missing cache invalidation, key collisions, duplicate or missing refetch, pagination/infinite-scroll accumulation;
4. state correctness: derived state stored instead of computed, two owners of one value, reducers/transitions that allow impossible states, uncontrolled↔controlled input drift, state retained across route/param changes that should reset;
5. effect and lifecycle semantics: wrong or missing dependencies, effects that run on every render, missing cleanup (listeners, timers, subscriptions, aborts), race conditions between overlapping requests, updates after unmount, double-invocation assumptions;
6. an unvisited seam adjacent to prior fixes that could conflict with or complete the previous contract without re-fixing the same owner;
7. a high-risk untouched seam: routing and guards (redirect loops, unauthenticated flash, deep-link params), form validation vs server schema drift, optimistic updates without rollback, SSR/hydration mismatch, storage/session persistence, i18n key and interpolation handling, number/date/timezone formatting, file upload flows, real-time reconnection, error boundaries, or client build/test configuration.

Two areas are different only when the authoritative owner or the runtime contract differs. Moving from a component to its test file is not a new area; moving from a screen's fetching layer to the shared store slice it writes into is.

## Bug threshold

Treat something as a bug only when current repository evidence shows a reachable violation of expected behavior, declared contract, type/schema invariant, state transition, guard/permission rule, cache coherence expectation, external API contract, generated client expectation, test harness contract, product acceptance, or runtime failure semantics on the client.

Do not fix style preferences, speculative memoization, cosmetic cleanup, broad refactors, state-library migrations, or dependency upgrades. Performance counts only when a reachable path produces a real defect — unbounded re-render loops, leaks, freezes, or request storms — not as general optimization. If evidence is insufficient, return a clean or blocked verdict.

Use one bug type in the final verdict:

```text
data_fetching
cache_invalidation
state_ownership
state_transition
effect_lifecycle
race_condition
memory_leak
render_correctness
component_contract
form_validation
routing_navigation
auth_guard_flow
optimistic_update
ssr_hydration
storage_persistence
i18n_formatting
realtime_channel
error_boundary
build_config
test_harness
generated_client
other_reachable_bug
```

Use priority only from evidence:

```text
P0 = data loss in an unsaved flow, wrong data shown across users/tenants, exposed restricted screen or action, crash/freeze on a main path, or blocking build/release
P1 = user-visible functional failure, stale or wrong displayed state, broken navigation or form submission, request storm, leak on a common path
P2 = narrow edge case, non-blocking console error, test harness or generated-client issue with limited impact
```

## Execution rules

- Do not ask for a plan, print a plan, or create multiple workstreams. Select one target internally and execute.
- Stop after the first concrete bug is fixed, blocked, or the selected area is checked clean with bounded evidence.
- Apply the smallest complete fix at the authoritative owner — the hook, store, or module that owns the value, not the component that happens to render it. Update only directly required consumers, tests, mocks, and types.
- Never fix a data-flow bug by duplicating state, adding a manual refetch on top of a cache layer that already owns invalidation, or suppressing a dependency/lint warning; if the fix requires a suppression, prove why and say so explicitly.
- Preserve the component's public contract (props, events, exported types) unless the bug proves it wrong; when it must change, update every direct consumer in the same patch.
- Keep accessibility semantics and existing markup structure intact while fixing behavior; if the correct fix changes rendered structure, keep roles, labels, and focus behavior equivalent and note it.
- Do not override user changes or unrelated uncommitted work.
- Do not broaden into a UI audit, design-system rewrite, framework migration, or multi-bug cleanup.
- If the fix requires a missing product decision, a backend change, an unavailable API/credential, or a browser-only reproduction that cannot be run here, do not invent it. Report `FRONTEND_BUG_BLOCKED` with the exact gate.

## Validation

Run repository-native checks relevant to the selected area and changed files, discoverable from the active repository instructions (`AGENTS.md`, `CLAUDE.md` or applicable scoped rules), package scripts, Makefile, CI config, tests, or repo docs. Prefer the smallest command that proves the fixed owner behavior and at least one direct consumer or regression path:

- the narrowest unit/component test target for the owner, plus a regression case for the exact trigger when a test file already exists;
- type check of the changed package;
- lint rules that specifically encode the broken invariant (hook dependencies, import rules) when already configured;
- a targeted e2e/story run only when the repo already provides one and it does not require an external environment;
- production build when the bug is in build/config.

Do not invent commands and do not claim a browser, device, or live API was exercised if it was not reachable. Record exact commands and results. Unavailable, expensive, external, or credential-blocked checks are explicit gates, not passes.

If no files changed, validate by static evidence and any safe read-only checks available for the selected area.
