# Boundary-board operations

This is a small router, not a reconciliation loop. An explicitly requested Coordinator is one normal, goal-scoped task that assigns bounded work and is available when the user invokes it again. It does not stay awake, poll, or run in the background.

- To list, create, update, or release task claims, read [execution.md](execution.md).
- To send or receive a collision or dependency notice, also read [messaging.md](messaging.md).
- To recover a stale or interrupted claim, read [recovery.md](recovery.md).

Do not read archived receipts during ordinary work. Do not scan native task history, providers, automations, pull requests, or schedules merely because the board is enabled.

The authoritative active state is the set of per-task JSON claims. Generated schema-2 `CURRENT.md` is a small active-only human view rebuilt from those claims. It is not an inbox, command surface, task ledger, memory store, or second authority.

Normal user replies come from the task doing the work. Mention another owner only when it explains an overlap, dependency, or handoff. Keep internal thread IDs out of ordinary user chat unless the user asks for diagnostics.
