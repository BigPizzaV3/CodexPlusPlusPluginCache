---
name: sales-invoicing
description: Raise sales invoices for a Briefcase Ledger client from its sales items, create customers without duplicating existing contacts, list outstanding invoices, fetch invoice PDFs and build a debtor chase list. Use when the user asks to invoice a customer, add a customer, see what is unpaid or overdue, or get a copy of an invoice.
---

# Sales invoicing in Briefcase

Sales invoices only exist for Briefcase Ledger clients; Xero and QuickBooks clients return `UNSUPPORTED_CAPABILITY`. Reading invoices needs the Ledger view permission, raising invoices and adding customers need Ledger post. `FORBIDDEN` means the user lacks one of them or an administrator has paused assistant changes; report it and stop.

## See what is outstanding

- `briefcase_list_sales_invoices` with `statuses` (`AWAITING_PAYMENT`, `PAID`, `WRITTEN_OFF`, `PROCESSING`) and `search_term` for a customer or reference. Page with the cursor.
- `briefcase_get_sales_invoice` for lines, VAT, outstanding balance, payments and emails sent. For the PDF, call `briefcase_get_attachment_download` with `pdf.attachment_id`; the link is short-lived, so hand it straight to the user and do not repeat it later.
- For a chase list, use `briefcase_get_aged_report` with `subledger: ACCOUNTS_RECEIVABLE`: group by customer, oldest bucket first, with each invoice's reference, due date and outstanding amount.

## Raise an invoice

1. Find the customer with `briefcase_list_contacts`. If they do not exist, see "Add a customer" below.
2. Find the items with `briefcase_get_reference_data` and `kind: items`. Each item has a fixed price and VAT rate; the invoice uses the item's current price. If nothing fits, the user must add the item in the Briefcase app.
3. Call `briefcase_raise_sales_invoice` with `mode: preview`: `customer_id`, `issue_date`, optional `supply_date` (defaults to the issue date), `due_date`, `bank_account_id` for the bank details to print, and `lines` of `item_id` and `quantity`.
4. Show the preview: customer, dates, each line's net and VAT, and the totals. Explain any blocker in plain language. `PERIOD_LOCKED` means the issue date is on or before the lock date; missing issuer address, VAT number or customer address must be fixed in the app first.
5. Only after the user agrees, call again with `mode: execute`, the `preview_id` and a fresh `idempotency_key`. Return the invoice reference and `web_url`.

Say before executing that the invoice posts to the ledger straight away, is not emailed to the customer, and can only be reversed in the Briefcase app.

## Add a customer

1. `briefcase_create_customer` with `mode: preview`, the `name`, and optionally `email` and `address` (`region_code` is the two-letter country code, for example `GB`).
2. If the preview lists `candidates`, show them and ask whether the user meant one of those. Use the existing contact if so.
3. `resulting_action: REUSE_EXISTING` means a contact with exactly that name already exists and will be made a customer rather than duplicated.
4. Execute with a fresh `idempotency_key`. Pass `confirm_new_despite_candidates: true` only when the user has confirmed the new customer is different from every candidate.

## Retries

Retry a failed call with the same `idempotency_key`; Briefcase returns the original result instead of raising a second invoice. For how-to questions, use `briefcase_search_help`.
