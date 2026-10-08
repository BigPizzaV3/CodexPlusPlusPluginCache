---
name: organizing-persistent-files
description: Use when moving, renaming, archiving, deleting, deduplicating, replacing, or reorganizing persistent project files, folders, release artifacts, or ChatGPT Library items.
---

# Organizing Persistent Files

## Iron rule

**Audit before structural/destructive mutation.** Use `auditing-persistent-state` unless exact roles, references, canon, successor, destination, and target state are already established from fresh complete evidence.

## Idempotent transaction

`pre-read/list -> classify -> precondition -> mutate -> capture returned final identity -> repair pointers/memory -> post-read/list -> verify`

For every structural mutation:

1. resolve exact source identity and authoritative surface;
2. resolve intended destination/successor and detect any **destination conflict**;
3. identify references and canonical role;
4. define a postcondition that makes the operation **idempotent**: re-observing the already-correct target must not trigger a duplicate mutation;
5. perform the real persistent mutation once;
6. capture the provider/tool **returned final identity** (id/path/name), including any **auto-rename** result;
7. update pointers/routes and durable memory if truth changed;
8. fresh re-list/re-read source and final destination;
9. use `verifying-persistent-work` last.

Never assume the requested destination name is the actual final name when the storage layer may dedupe or auto-rename. If status is ambiguous, use `recovering-persistent-work` before any repeat.

## Deletion

Delete only when the item is not active canon, required information survives, references are safe, required successor is readable, and post-state can be verified. Otherwise archive or stop.

## ChatGPT Library

Use native Library mutation on the exact Library item. `/mnt/data` is only a working surface. Read `references/storage-adapters.md` for provider-specific identity and conflict rules.
