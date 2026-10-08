# Memory hierarchy

A project memory is a routing tree, not a pile of summaries. Each durable fact has exactly one detailed owner.

## Default shape

```text
PROJECT/
├── MEMOIRE_GLOBALE.md
├── Domain-A/MEMOIRE.md
└── Domain-B/
    ├── MEMOIRE.md
    └── Complex-Subsystem/MEMOIRE.md
```

Respect an existing stable convention instead of renaming a project to this template.

## Ownership

Root memory owns project identity, cross-domain constraints, high-level status, routes, and cross-domain decisions. A specialized memory owns its domain invariants, validated behavior, active bugs/risks, decisions, test contract, dependencies, and next useful action.

**Independent ownership** means the subdomain changes on its own cadence and owns facts/tests/invariants that do not belong in sibling domains.

## Lifecycle rules

### Split trigger

Create a child only when **independent ownership** exists and at least one structural symptom is observed: multiple independently changing sections, repeated child detail in the parent, frequent edits that do not affect siblings, or falling **route density** because the parent carries implementation detail instead of routing/current cross-domain truth. A folder existing is not enough.

### Merge trigger

Merge a child when it no longer has independent ownership, contains only a small amount of current truth, and moving that truth to the parent creates neither duplication nor ambiguity. Repair routes and verify the child is no longer referenced before archive/removal.

### Compaction trigger

Compact a memory in place when current truth becomes hard to scan because stale narrative, superseded states, repetition, or oversized detail overwhelms useful routing/current facts. **Route density** means how much of the memory directly serves current truth, ownership, routing, constraints, or actionable state rather than session history. Compaction removes obsolete narrative but preserves historical facts that still constrain future choices.

Do not use arbitrary file size alone to force a split. Prefer semantic ownership first; use size only as a signal to inspect structure.

## Parent/child rule

Good: `Plugin -> active; details: Plugin/MEMOIRE.md`

Bad: parent repeats plugin architecture, bug list, implementation details, and next action.

When duplicate detailed truth exists, choose the nearest logical owner, retain detail there, reduce ancestors to routing/high-level status, and verify contradictory copies are gone.
