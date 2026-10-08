# Verification

Three layers: readiness checks before pulling figures, tie-outs and analytical review on the figures, and final checks on the draft. Record every check in the verification appendix with the figures compared and the result.

## Readiness checks

Each failure becomes a caveat in the pack, worded as what is missing and what it could affect.

| Check | How | Fails when |
|---|---|---|
| Working paper for the period | `briefcase_get_working_paper`; find the one whose `target_date` is the period end and pass its `working_paper_id` if it is not the latest | There is none (say the period has not been worked in Briefcase), or it has `clearing_the_period.blockers`, unreconciled accounts or accounts with `changed_since_sign_off: true` |
| Bank cleared | Working paper `clearing_the_period` | Any blocker: missing statements (`STATEMENT_COVERAGE_GAP`), unmatched bank lines (`UNRECONCILED_TRANSACTIONS`), statements still processing, no opening balance, unhealthy feed |
| Documents awaiting review | `briefcase_list_transactions` with `awaiting_review: true`; page through and keep those with `date` on or before the period end | Any exist: they are not in the figures. Give the count and total |
| Unpublished items | Working paper `pending.unpublished_invoice_count` and `pending.draft_adjustment_count` | Either is above zero |
| Client requests | Working paper `open_client_requests` | Paperwork or statements still awaited |
| Close schedules posted | `briefcase_list_close_items` for `prepayment`, `deferred_income` and `fixed_asset`; read each active schedule's `period_summary.next_unposted_period` | Its `date` is on or before the period end: that period's release or depreciation is missing from the figures |
| Clearing and suspense accounts | Trial balance accounts with `reserved_type` `CREDIT_ALLOCATION_CLEARING` or `BANK_TRANSFER_CLEARING`, or named suspense | Balance is not nil |
| Lock date | `briefcase_get_client` `general_ledger_lock_date` | Before the period end: figures can still change, so the pack is provisional |
| Corporation tax (companies) | Trial balance and P&L: a corporation tax charge or liability for the year to date | None accrued. Offer an estimate on year-to-date profit, labelled as an estimate; never post it yourself |

## Tie-outs

These must agree to the penny. Compare decimal strings exactly. A failure is reported at the top of the pack.

| # | Check | Inputs |
|---|---|---|
| T1 | Balance sheet balances: `total_assets` − `total_liabilities` = `net_assets` = `total_equity` | Balance sheet at period end and at the comparison date |
| T2 | P&L adds up: revenue lines sum to `total_revenue`, expense lines to `total_expenses`, and `total_revenue` − `total_expenses` = `net_profit` | Each P&L response |
| T3 | Profit to date ties to the balance sheet: balance sheet `retained_earnings` at period end = trial balance `retained_earnings_brought_forward` (credit less debit) + year-to-date `net_profit` | Balance sheet, trial balance, year-to-date P&L |
| T4 | Trial balance balances: `totals.difference` = `0.00`, and every balance sheet account appears in the trial balance with the same amount | Trial balance, balance sheet |
| T5 | Aged debtors total = the `ACCOUNTS_RECEIVABLE` control account; aged creditors total = the `ACCOUNTS_PAYABLE` control account | Aged reports, trial balance. A difference usually means unallocated payments or credits, or a journal posted to the control account; list what you find |
| T6 | Bank: each bank account's balance sheet balance = the feed's `running_balance` on the last line dated on or before the period end | Balance sheet, `briefcase_list_bank_transactions` (newest first; page until you pass the period end). Skip with a note when `running_balance` is missing |
| T7 | Periods add up: monthly figures shown in a quarterly pack sum to the quarter | P&L responses |
| T8 | KPIs recalculate from the inputs shown in the pack | KPI table |

## Analytical review

Look at the figures as a reviewing accountant would, and list each finding for the reviewer:

- Movements over the materiality thresholds against the prior period and the same period last year, each with its cause or a question for the client.
- Gross margin moving by more than 3 percentage points.
- Regular costs missing this period that appeared in each of the previous months (payroll, rent, depreciation, software). This is usually a missed accrual.
- Balances on the wrong side: a credit balance on an asset, a debit balance on a liability, an overdrawn bank account that is not an overdraft, a director's loan account in debit.
- Accounts with a balance this period that had none before.
- Manual journals in the period above the materiality threshold (`briefcase_list_journals` for the period; manual journals have no source document).

## Final checks on the draft

1. **Books unchanged.** Fetch the period P&L, the balance sheet and the trial balance again, with the same arguments as the first pull, and compare their totals. If anything moved, say the books changed while the pack was being prepared and rebuild the affected sections.
2. **Text matches tables.** Every amount in the summary and commentary appears in a table, and every percentage recalculates from table figures.
3. **Causes are evidenced.** Every stated cause cites a journal or document; anything else is phrased as a question for the client.
4. **Caveats are complete.** Every failed readiness check and tie-out appears in the caveats.

## Verification appendix

End the pack with:

- **Status:** Draft, for accountant review.
- **Data:** when the figures were fetched, the period, the financial year start used, and the lock date.
- **Tie-outs:** the T1–T8 table with the figures compared and pass, fail or skipped (with the reason).
- **Readiness:** each readiness check and its result.
- **Source map:** for each pack table, the tool and the dates it came from.
- **Estimates and judgements:** cost-of-sales accounts chosen, any estimates (corporation tax, stock), KPI definitions where more than one exists.
- **Reviewer checklist:**
  - Do the figures make sense for this client?
  - Are the caveats acceptable for this audience, or should items be fixed first?
  - Are the estimates and the cost-of-sales classification right?
  - Are the client questions the right ones to ask?
  - Approve the basis of preparation wording before the pack leaves the practice.
