---
name: auditing-persistent-state
description: Use when inspecting a persistent project or Library to determine canonical locations, file roles, memory ownership, references, duplicates, stale state, evidence completeness, or the safe target state before mutation.
---

# Auditing Persistent State

## Purpose

Establish observed truth before consequential mutation. An audit is read-only unless repair/organization was also requested.

## Scope and roles

Inventory the exact authoritative surface and requested scope, then classify items as `CANONICAL`, `SUPPORT`, `REFERENCE`, `ARCHIVE`, `TEMPORARY`, `UNCLASSIFIED`, or `TRASH`. Never classify from filename/age alone when content or references matter.

Check roots, memory chain, competing canons, broken routes, incoming references, successors, and competing copies across surfaces.

## Evidence completeness

An inventory is complete only when the tool proves the requested scope was exhausted. If a response is **truncated**, says it may be a **partial listing**, exposes **pagination** or a **next cursor**, follow it until exhausted when the conclusion depends on absence/completeness.

If complete coverage cannot be established, label the conclusion **INCOMPLETE EVIDENCE**. A zero-result search or stale index does not prove absence when direct list/read is available. Do not perform destructive cleanup based on incomplete evidence.

## Output contract

Separate observed facts, inferred roles, and unresolved assumptions. `UNCLASSIFIED` stays non-destructive. If memory is inconsistent, use `repairing-memory-state`; if target state is proven and structural mutation is requested, use `organizing-persistent-files`.
