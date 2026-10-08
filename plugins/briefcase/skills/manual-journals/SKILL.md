---
name: manual-journals
description: Post a manual journal to a Briefcase Ledger client, such as a correction, reclassification, capital introduction or one-off period-end adjustment, with the accounts checked, the lock date respected and a preview agreed before anything posts. Use when the user asks to post, book or record a journal, move a balance between accounts, or correct a posting.
---

# Manual journals in Briefcase

A posted journal changes the client's accounts immediately and can only be reversed in the Briefcase app. Treat every journal as irreversible from here. Manual journals only exist for Briefcase Ledger clients (Xero and QuickBooks clients return `UNSUPPORTED_CAPABILITY`) and need the Ledger post permission.

## Before drafting

- Check whether a journal is the right tool. Recurring prepayments, accruals, deferred income and depreciation belong in the close tools (see the financial close review skill), and a miscoded bill should be fixed on the transaction, not journalled over.
- `briefcase_get_client` gives `general_ledger_lock_date`. Entries must be dated after it.
- `briefcase_get_reference_data` with `kind: accounts` for account ids (narrow with `account_class`, for example `EXPENSE`, or `search_term`), and `kind: tax_rates` when a line carries VAT. Quote each account's name and code back to the user.
- To correct something already posted, read it first with `briefcase_list_journals` (filter by `account_id` and dates) and `briefcase_get_journal`.

## Draft and preview

Call `briefcase_create_manual_journal` with `mode: preview`:

- `entry_date`, `description` and a `reference` the user will recognise later.
- `lines`: each has an `account_id` and either a `debit` or a `credit` (never both), as gross amounts in major units. A `tax_rate_id` splits the VAT to the VAT account automatically; revenue and expense lines need one.
- `business_id` (and `property_id` with it) when the entry belongs to one business or property.

Show the user the lines as a small debit and credit table with the totals, then explain any blocker:

- `PERIOD_LOCKED`: the date is on or before the lock date. Move the date or ask the user to move the lock date in the app.
- `UNBALANCED`: debits and credits differ. Never add a balancing line the user did not ask for.
- `RESERVED_ACCOUNT`: control accounts such as accounts receivable and payable cannot take manual journals; the fix belongs on the invoice or bill.
- Deleted or unknown accounts, invalid lines, and accounts spanning businesses or properties.

## Post

Only after the user explicitly approves the preview, call again with `mode: execute`, the `preview_id` and a fresh `idempotency_key`. Return the `web_url`, then show the effect: `briefcase_get_balance_sheet` or `briefcase_get_profit_and_loss` for the affected period.

If a call fails with a network error, retry with the same `idempotency_key`; Briefcase will not post the journal twice. Never retry with a new key to get round an error.
