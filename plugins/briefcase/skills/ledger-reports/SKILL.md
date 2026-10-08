---
name: ledger-reports
description: Read and explain a Briefcase Ledger client's profit and loss, balance sheet, trial balance, aged creditors and aged debtors, compare periods, and drill from a report line into the journals and source documents behind it. Use when the user asks how a client is doing, what makes up a balance, why a figure moved, who owes or is owed money, or for a trial balance or nominal balances.
---

# Ledger reports in Briefcase

These tools only work for Briefcase Ledger clients. Check `ledger_type` from `briefcase_list_clients` or `briefcase_get_client`; for a Xero or QuickBooks client they return `UNSUPPORTED_CAPABILITY`, so tell the user to read the reports in that ledger instead. Everything here needs the Ledger view permission; `FORBIDDEN` means the user lacks it.

## Pick the report

- **Profit and loss:** `briefcase_get_profit_and_loss` with `start_date` and `end_date`. Add `comparison_start_date` and `comparison_end_date` for "this month against last month" or "this year against last year". Filter with `business_id` or `property_id` only when the user asks about one business or property (`briefcase_get_reference_data` with `kind: businesses` or `properties`).
- **Balance sheet:** `briefcase_get_balance_sheet` with `as_at` (defaults to today) and optionally `comparison_as_at`. Retained earnings is the profit to date shown within equity, so `total_equity` equals `net_assets`.
- **Trial balance:** `briefcase_get_trial_balance` with `as_at` (defaults to today). Every account with a balance sits in a debit or credit column. Balance sheet accounts show the balance at `as_at`; revenue and expense accounts show the financial year to date, and earlier years' profit or loss is one `retained_earnings_brought_forward` line. `totals.difference` is `0.00` when the ledger balances. The financial year comes from the client's year end; if the tool says none is set, ask the user for the first day of the financial year and pass it as `financial_year_start`. Use it when the user asks for a trial balance or nominal balances, or to read control accounts such as VAT, debtors, creditors and clearing accounts in one call (`reserved_type` marks them).
- **Aged creditors or debtors:** `briefcase_get_aged_report` with `subledger: ACCOUNTS_PAYABLE` (creditors) or `ACCOUNTS_RECEIVABLE` (debtors) and `as_at`. Totals cover every contact; contacts come largest balance first, 25 per page with up to 10 invoices each. Page with `after` for more contacts, and set `contact_id` to see one contact's invoices in full.

Resolve relative periods ("last quarter", "year to date") to explicit dates, and say which dates you used. Ask for the financial year end when the user says "this year" and it matters.

## Report the numbers faithfully

- Amounts are decimal strings in the report's `currency`. Quote them as returned and follow the `sign_convention` in each result; do not recompute totals or re-sign figures.
- Accounts with no movement or a zero balance are left out, so an account missing from the list means it is nil for that range.
- Lead with the few lines that explain the answer (largest movements, biggest balances, oldest debts) rather than reading out every account.

## Drill down

1. Take the account `id` from a report line.
2. `briefcase_list_journals` with `account_id` and the same date range shows that account's activity; its `debit`, `credit` and `totals` cover that account only.
3. `briefcase_get_journal` for one entry shows every line and `source_links`, such as `sales_invoice_id` or `transaction_id`. Follow them with `briefcase_get_sales_invoice` or `briefcase_get_transaction`.

For an aged report line, the invoice `source` tells you which tool opens it (`SALES_INVOICE` → `briefcase_get_sales_invoice`, `TRANSACTION` → `briefcase_get_transaction`).

## Limits

These reports read Briefcase's own ledger. There is no VAT return tool; point the user to the Briefcase app for that. For bank reconciliation progress and which balance sheet accounts are signed off for a period, use `briefcase_get_working_paper` as described in the financial close review skill. For how-to questions about the reports, use `briefcase_search_help` rather than guessing.
