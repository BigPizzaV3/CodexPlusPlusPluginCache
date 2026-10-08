---
name: financial-close-review
description: Review a Briefcase client's period close. Check the working paper for what is left to clear and which balance sheet accounts are reconciled and signed off, then review and maintain prepayments, deferred income, accruals and fixed asset depreciation with the close trackers, drafting schedules and adjustments and publishing them with a preview first. Use when the user asks about month-end, year-end, whether a period is ready to close, reconciliation or sign-off status, prepayment or accrual schedules, depreciation, or what is left to post for a period.
---

# Financial close review in Briefcase

Schedules need the FINANCIAL_CLOSE permission in Briefcase. Working papers need the Ledger view permission and only work for Briefcase Ledger clients. If a call returns `FORBIDDEN`, tell the user which permission is missing rather than trying another tool.

## Start with the working paper

For "is this period ready to close" or "what is left for month-end", read the working paper before the schedules.

1. `briefcase_get_working_paper` for the client. It lists recent working papers newest first and details the latest; pass a `working_paper_id` from that list for another period. For a Xero or QuickBooks client it returns `UNSUPPORTED_CAPABILITY`, so send the user to Working papers in Briefcase.
2. Lead with the period (`start_date` to `target_date`), whether it is open or closed, and who closed it.
3. Then what is left to clear:
   - `clearing_the_period.blockers`: each has a `kind`, the bank account and a count. `STATEMENT_COVERAGE_GAP` means statements are missing for part of the period, so request or upload them (document submission skill). `UNRECONCILED_TRANSACTIONS` means bank lines still need matching in Briefcase. `PENDING_BANK_STATEMENTS` means uploaded statements are still being processed. `OPENING_BALANCE_NOT_SET` and `FEED_UNHEALTHY` need fixing in the Briefcase app (set the opening balance, reconnect the feed).
   - `open_client_requests`: paperwork and statements still awaited from the client.
   - `pending.unpublished_invoice_count`: bills and receipts dated in the period but not yet published (transaction review skill). `pending.draft_adjustment_count`: draft schedules and accruals (publish them below).
4. Then the balance sheet: give `balance_sheet.summary`, then name every unreconciled account and every account with `changed_since_sign_off: true`. The latter was signed off at `ledger_balance_at_sign_off` and now stands at `closing_balance`, so it needs reconciling again. For signed-off accounts, say who signed off (`reconciled_by`) and when, and quote any `difference` with its `difference_reason`. Dormant accounts are counted in `dormant_accounts_left_out`, not listed.

The assistant cannot reconcile accounts, sign them off or close a working paper. Those stay with the accountant in Briefcase, so point the user to Working papers in the app for them.

## Read schedules before you write

1. `briefcase_get_close_tracker` for the client and period. Explain the grid: opening balance, movement in the period, closing balance, and which periods are posted, due or paused.
2. `briefcase_list_close_items` for one `module` at a time (`prepayment`, `deferred_income`, `accrual`, `fixed_asset`). The list gives each schedule's period summary; `briefcase_get_close_item` gives its periods (set `period_start_date` and `period_end_date` for a long schedule) and the detail the user asks about, including the source transaction where there is one.
3. Cross-check with `briefcase_list_transactions` when the user suspects a prepayment was published as a straight expense.

Report amounts in the client's currency exactly as returned. Do not recompute schedules yourself; the tracker is authoritative.

## Draft changes

- `briefcase_create_close_item` creates drafts only. Accruals are created as a draft adjustment and are not posted. Always send a fresh `idempotency_key`.
- `briefcase_update_close_item` edits a draft or the future periods of a schedule. For an accrual it edits the adjustment amount, date and lines, not the recurring parent's estimate.
- Use `briefcase_get_reference_data` for balance sheet and expense accounts, and quote the account the schedule will post to.

## Publish, archive, restore

- Preview first: `mode: preview` on `briefcase_publish_close_item`, `briefcase_archive_close_item` or `briefcase_unarchive_close_item`. Summarise the journals that would post or reverse, the periods affected and any lock-date conflicts.
- Execute only after the user agrees, with the `preview_id`, `mode: execute` and a fresh `idempotency_key`.
- Publishing a schedule starts posting in Briefcase and the connected ledger; archiving reverses what was posted and stops future periods. Say this plainly before executing.
- Published fixed assets and committed accrual adjustments cannot be edited here; direct the user to the Briefcase app.

## Wrap up

Re-read the tracker after publishing so the user sees the updated position, and remind them the changes appear in the assistant activity under Settings → AI assistants. If the user is working towards closing the period, re-read the working paper so they see what is still outstanding.
