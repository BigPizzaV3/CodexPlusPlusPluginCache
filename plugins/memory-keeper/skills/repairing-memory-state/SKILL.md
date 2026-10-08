---
name: repairing-memory-state
description: Use when persistent project memory is inconsistent, duplicated, stale, broken, orphaned, contradictory, ambiguously rooted, or has invalid routes after moves, renames, replacements, or partial repairs.
---

# Repairing Memory State

## Goal

Restore one coherent canonical truth without inventing facts or destroying uncertain data.

## Repair order

1. Freshly observe state and record a **rollback point**: identities/locations and last known-good canonical content needed to recover.
2. Record **repair provenance**: what evidence selected each owner/successor and which prior source it supersedes.
3. Determine the nearest logical owner for each conflicting durable fact.
4. Resolve root ambiguity before destructive change.
5. Repair owner content/routing first, then reduce parent copies to routing/high-level status.
6. Repair moved/renamed pointers.
7. Keep a superseded source recoverable until the replacement and routes pass fresh verification; **superseded source remains recoverable** through archive/version history when possible.
8. Only then remove redundant active canons, re-read/re-list, and verify exactly one active owner remains.

## Never

Never choose by newest-looking filename/date, concatenate contradictory facts, create `_FINAL`/`_MAJ`/dated/copy/backup/`v2` active canons, or delete uncertainty merely to make the audit clean.

If evidence cannot select the canon, stop at **NOT COMPLETE** and request only the smallest missing decision. Operational timeout/failure belongs to `recovering-persistent-work`.
