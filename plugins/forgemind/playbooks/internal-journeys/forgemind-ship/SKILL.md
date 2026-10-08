---
name: forgemind-ship
description: "Use when a selected product bet or MVP must be implemented, tested, and prepared for a bounded release."
---

# Ship

When invoked without user text, load `playbooks/zero-input-defaults.md` and execute **Ship** for the latest ForgeMind bet or the smallest high-leverage reversible MVP.

Create an executable delivery contract, user-experience test surface, and rollback-aware verification path:

`node <plugin-root>/bin/forgemind.mjs ship plan --goal "<outcome>" --artifacts workspace --json`

Then implement the smallest vertical slice, run relevant tests, and continue without routine questions. Pause only for secrets, production access, destructive changes, irreversible migrations, external spend, or high-stakes decisions.
