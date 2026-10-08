---
name: maintaining-project-memory
description: Use when a project gains, changes, validates, abandons, or depends on durable truth that future work must remember, including architecture, behavior, bugs, baselines, constraints, versions, tests, canonical locations, or memory structure.
---

# Maintaining Project Memory

## Core law

**One durable fact = one canonical owner. One canonical memory = one living file.** Memory stores current truth, not a session transcript.

## Before changing durable truth

1. Identify the authoritative persistent surface and project root.
2. Load the smallest relevant memory chain from root to owner.
3. Identify the detailed owner; ambiguity routes to `repairing-memory-state`.
4. Read `references/memory-hierarchy.md` before creating, splitting, merging, or compacting memory.

## Synchronization

After every durable change:

1. update the nearest owning memory immediately;
2. replace obsolete truth instead of appending diary history;
3. update a parent only when parent-level routing/status/constraint changed;
4. keep child detail out of the parent;
5. verify memory reflects the new truth before completion.

Durable truth includes architecture, feature state, bugs, baselines, tests, workflows, paths, constraints, abandoned approaches that must not return, and next actions future work depends on. Throwaway edits require no memory rewrite.

## Memory lifecycle

Apply the lifecycle rules in the hierarchy reference. In short:

- **Split trigger:** a subdomain gains independent ownership and enough independently changing truth that keeping it inline lowers route density or causes parent duplication.
- **Merge trigger:** a child no longer has independent ownership and its remaining truth can live in the parent without duplication or routing ambiguity.
- **Compaction trigger:** current truth is obscured by stale history, repetition, oversized detail, or low route density; rewrite in place while preserving constraints that still affect future decisions.

Never create a sibling active canon with `_MAJ`, `_FINAL`, dates, `copy`, `backup`, `(1)`, `v2`, `new`, or `updated`. Update the active canon in place or perform controlled replacement with exactly one active owner remaining.

For local filesystems, `scripts/memory_keeper_check.py` provides conservative structural checks; project technical tests remain separate.
