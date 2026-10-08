---
name: expense-claims
description: Group a claimant's receipts into an expense claim in Briefcase, add or remove receipts, check the claim's state and publish it with a preview first. Use when the user asks about employee or director expenses, reimbursing out-of-pocket costs, or what is still waiting to be claimed.
---

# Expense claims in Briefcase

An expense claim bundles unpublished receipts paid personally by one claimant, so the business owes that person rather than a supplier. Creating and editing claims needs the expense claim create permission; publishing needs expense claim publish. `FORBIDDEN` means the user lacks one of them or assistant changes are paused.

## Find what to claim

- `briefcase_list_expense_claims` and `briefcase_get_expense_claim` show existing claims, their receipts and whether they are published.
- `briefcase_list_transactions` with `awaiting_review: true` finds unpublished receipts. Confirm with the user which ones the claimant paid personally; do not guess from the supplier name.
- `briefcase_get_reference_data` with `kind: claimants` gives the claimant contacts.

## Build the claim

1. `briefcase_create_expense_claim` with the `transaction_ids`, the claimant as `supplier_id`, the `claim_date` and a fresh `idempotency_key`. All receipts must share one currency; a mismatch returns `VALIDATION_ERROR`, so split them into separate claims.
2. `briefcase_add_claim_transactions` adds more unpublished receipts to a claim that is not yet published.
3. `briefcase_remove_claim_transaction` takes one receipt back out of an unpublished claim.

Fix a receipt's own coding with `briefcase_update_transaction` before publishing (see the transaction review skill).

## Publish

1. `briefcase_publish_expense_claim` with `mode: preview`. Summarise the claimant, claim date, currency, total, the destination in the ledger and any blockers.
2. `claim_date`, `currency` and `claimant_contact_id` override the stored values only when the user asks. For Xero, `publish_destination` and `bills_to_pay_status` choose how the claim lands; for QuickBooks, `quickbooks_publish_destination`.
3. Execute only after the user agrees, with the `preview_id`, `mode: execute` and a fresh `idempotency_key`.

Publishing posts the claim to the ledger as money owed to the claimant. Say so before executing, and read the claim back with `briefcase_get_expense_claim` afterwards.
