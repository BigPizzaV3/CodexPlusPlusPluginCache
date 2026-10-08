# Instant Architecture Probe

## Operation

Inspect one new primary area in the visible conversation. When a fix is requested, apply one complete evidence-backed correction. A clean area ends the probe; it does not certify the repository.

## Goal

In one turn, inspect exactly one architectural seam that has not already been the primary target of this prompt in the current visible thread.

For that seam, either:

* fix one concrete architectural violation when evidence permits;
* report the seam clean when no issue meets the threshold;
* or report the issue blocked when a safe structural fix requires an external decision or unavailable mechanism.

Stop after that outcome. Do not continue to a second seam.

This probe owns **structure, ownership, and dependency direction**, not runtime behavior. It asks "who is allowed to know about whom, and who owns this decision", not "does this endpoint return the right JSON".

Out of scope for this probe (belongs to sibling probes): runtime request/response bugs, persistence and query defects, client state and data-fetching defects, layout, responsiveness, and visual/a11y defects. Such findings may be *recorded* as observations but must not be fixed here unless the fix is itself the structural correction.

## Thread-local visited ledger

Before selecting the target, reconstruct a private ledger from visible conversation only:

* previous verdicts from **any** probe in this thread (`Instant Architecture Probe`, backend, frontend, UI/UX), their primary target areas, changed files, clean probes, blocked areas, and validations;
* previous patch-check reports, diffs, user-provided symptoms, dependency graphs, module maps, ADRs, audit outputs, or implementation notes in this thread;
* current uncommitted changes and visible patch contour when repository commands expose them;
* unresolved gates or exclusions that must not be contradicted.

A seam counts as visited when it was already checked clean, fixed, blocked, or marked unavailable in this thread as a primary target: a module boundary, layer edge, dependency direction rule, ownership assignment for a domain concept, public API surface of a package, DI/composition root, cross-cutting concern placement, shared kernel, contract package, or codegen/source-of-truth boundary.

Files may be re-read to avoid conflicts. Re-reading is not re-visiting; only the same architectural relationship as primary target counts.

Two seams are different only when the authoritative owner, governing boundary rule, dependency direction, or public contract differs. Moving between files inside the same boundary is not a new seam.

If previous changes touched the same boundary, preserve their intended direction unless current repository evidence proves it wrong. Never introduce a second parallel abstraction for an invariant an earlier patch already centralized.

## Target selection

Follow explicit user targets even when previously visited. For an unspecified next area, select an unvisited owner from visible context.

If the user gave no target, choose the highest-confidence unvisited seam from repository evidence, in this order:

1. an explicitly declared rule that is currently violated: import boundaries in ESLint/`import-linter`/`dependency-cruiser`/`ArchUnit`/`tsconfig` path constraints, workspace `package.json` boundaries, module visibility settings, or documented layering in the active host’s repository instructions (`AGENTS.md` or `CLAUDE.md`) or ADRs;
2. a cycle or upward dependency proven by imports: domain importing infrastructure, shared/core importing feature code, package A ↔ package B, entity ↔ service loops;
3. duplicated authority: the same invariant, validation rule, enum, permission matrix, status machine, or mapping implemented by two independent owners that can demonstrably drift;
4. leaked boundary types: transport DTOs, ORM entities, framework request objects, or vendor SDK types crossing into layers whose contracts forbid them;
5. misplaced ownership: business rules living in controllers/components/migrations/config, or cross-cutting concerns (auth, logging, tenancy, i18n, error mapping) implemented ad hoc per call site instead of at the declared seam;
6. broken source-of-truth chain: hand-edited generated artifacts, schema/type/client generation whose inputs and outputs no longer agree, or contract packages consumers no longer import.

If the first selected seam is clean, stop with a clean verdict. Do not search for a second seam in the same turn.

## Issue threshold

Treat something as an architectural bug only when both are supported by repository evidence:

1. **Architectural expectation:** a declared/tool-enforced rule, package contract, ADR, or clearly authoritative owner establishes how the boundary should work.
2. **Concrete violation:** the repository actually contradicts that expectation through a forbidden dependency, real cycle, duplicate authority with demonstrated drift, forbidden type leak, ownership bypass, or non-convergent source-of-truth chain.

A structural condition with no explicit rule may still qualify only when it has a concrete demonstrated failure mode, such as a real cycle, two conflicting owners of one invariant, or a build/codegen chain that cannot converge.

Do not fix taste: naming, file placement preferences, folder aesthetics, "clean architecture" purity without a declared rule or concrete failure mode, speculative extensibility, premature abstraction, or dependency upgrades.

If the selected seam does not meet this threshold, return a clean verdict.

Use one issue type in the final verdict:

```text
layer_violation
dependency_cycle
boundary_type_leak
duplicate_authority
ownership_misplacement
public_api_surface
cross_cutting_placement
composition_wiring
contract_package_drift
source_of_truth_break
module_visibility
config_boundary
docs_adr_staleness
other_structural_violation
```

Use priority only from evidence:

```text
P0 = build/codegen cannot converge, cycle breaks compilation or bundling, boundary leak exposes secrets/tenant scope, or the violation blocks release

P1 = enforced rule violated, two owners of one invariant already drifted, forbidden type reaches a layer whose consumers depend on the contract, wiring produces wrong instance/scope at runtime

P2 = narrow structural violation with contained blast radius, stale ADR/module map, unenforced-but-documented rule broken in one place
```

Do not raise priority based only on hypothetical future impact.

## Execution rules

* Do not ask for a plan, print a plan, or create multiple workstreams. Select one seam internally and execute.
* Do not modify files until the issue threshold is met.
* Stop after the first selected seam is fixed, blocked, or checked clean with bounded evidence.
* Apply the smallest complete fix **at the boundary**, not at the call site: move the owner, invert the dependency, reuse or extract the shared contract into a layer both sides are allowed to depend on, or delete the duplicate and re-point consumers.
* Never fix a boundary by adding a suppression comment, widening a path alias, disabling a lint rule, or casting through `any`/`unknown` unless the user explicitly asked for a temporary unblock — and then say so explicitly.
* Keep public API compatibility, rollout, mixed-version behavior, and previous thread patches intact unless the violation proves them wrong.
* Do not override user changes or unrelated uncommitted work.
* Do not broaden into a repository restructure, framework migration, monorepo re-layout, or multi-boundary cleanup. If the correct fix is a large move, apply only the smallest complete slice that removes the proven violation and report the rest as an exclusion.
* If the fix requires a missing product/ownership decision, unavailable package release process, destructive migration, or other external gate, report `ARCH_ISSUE_BLOCKED` with the exact gate.

## Validation

Run repository-native checks relevant to the changed boundary, discoverable from the active repository instructions (`AGENTS.md`, `CLAUDE.md` or applicable scoped rules), package scripts, Makefile, CI config, or repo docs. Prefer the smallest command that proves the boundary now holds **and** that affected consumers still compile:

* boundary/graph linters already configured in the repo;
* type check / compile of the changed packages and their direct dependents;
* build or codegen step when a source-of-truth chain was touched;
* the existing test target closest to the moved owner.

Do not invent commands or claim a graph tool exists.

Record the exact command and actual result. A check that was not run is not a pass.

If checks are unavailable, too expensive, or blocked, report them as explicit gates.

If no files changed, validate with bounded static evidence: the governing rule/config plus the exact imports, package edges, or source anchors proving the selected seam is currently respected.
