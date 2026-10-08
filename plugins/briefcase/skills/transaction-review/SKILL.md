---
name: transaction-review
description: Review bills and receipts awaiting review in Briefcase for a client, explain Autopilot decisions and review warnings, fix extracted values, and publish or archive with a preview first. Use when the user asks what needs review, why a transaction was coded a certain way, or wants to approve or clear a client's queue.
---

# Transaction review in Briefcase

Work as the signed-in Briefcase user on the clients they connected. Never guess a client: resolve the name with `briefcase_list_clients` first and confirm when two names are close.

## Find what needs attention

1. `briefcase_get_connection` once per session to confirm which clients are visible and whether changes are allowed.
2. `briefcase_list_transactions` with `awaiting_review: true` for the client. Page with the returned cursor; do not ask for everything at once.
3. For each item the user cares about, `briefcase_get_transaction`. Explain the extracted values, the Autopilot reasoning and every review warning in plain language before proposing an action.

## Fix values

- Use `briefcase_get_reference_data` for accounts (narrow with `account_class` or `search_term`), tax rates, tracking categories, businesses and properties before changing a coding. Quote the exact account name and code back to the user.
- `briefcase_update_transaction` saves edits as metadata; it is last-write-wins, so read the transaction again before editing when the user has been working in the app.
- Never change amounts, dates or suppliers without the user's confirmation. Say what you will change and wait.

## Publish or archive

- Always call `briefcase_publish_transaction` or `briefcase_archive_transaction` with `mode: preview` first. Summarise the preview: ledger, account, tax treatment, period, and anything that blocks it (missing supplier, locked period, permission).
- Only after the user agrees, call again with `mode: execute`, the `preview_id` from the preview and a fresh `idempotency_key` (a random string you generate once per action).
- If the call fails with a network error, retry with the same `idempotency_key`; Briefcase replays the original result rather than posting twice.
- `FORBIDDEN` means the user lacks that permission in Briefcase or an administrator has paused assistant changes. Report it; do not look for another route.

## Follow up

Use `briefcase_get_operation` to check an action that returned `dispatched`. Point the user to Settings → AI assistants → Activity for the record of everything you changed.
