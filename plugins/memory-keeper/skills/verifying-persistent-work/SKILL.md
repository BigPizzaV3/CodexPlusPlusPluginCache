---
name: verifying-persistent-work
description: Use when about to claim persistent project work is complete, done, fixed, organized, saved, synchronized, updated, cleaned, migrated, or successfully written.
---

# Verifying Persistent Work

## Iron law

**No persistent success claim without fresh authoritative evidence from the actual persistent surface after the last mutation.**

A successful write call, old test run, remembered state, temporary `/mnt/data` artifact, or search hit alone is insufficient.

## Gate

1. identify evidence for every applicable requirement;
2. run relevant technical verification freshly;
3. obtain **authoritative evidence** from a direct filesystem read/stat/hash or **provider-native read/list** of the exact persistent item **after the last mutation**;
4. verify owning canonical memory and parent routing where applicable;
5. verify references/pointers and absence of competing active canons;
6. compare observed final state with requested target.

A **search/index result alone is insufficient** to prove destructive absence, exact final identity, or completion when direct read/list is available; indexes can lag. Use search for discovery, then verify directly.

If any gate is unchecked or fails, state **NOT COMPLETE**. Operational repair may use `recovering-persistent-work` only within its fingerprint and transaction budgets. Verification itself must not create an unbounded reverify/recover loop.

Use `references/verification-gates.md` for the checklist. Do not use “done”, “fixed”, “saved”, “organized”, “clean”, or “synced” until it passes.
