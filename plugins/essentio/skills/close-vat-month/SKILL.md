---
name: close-vat-month
description: Close a month's VAT with Essentio — read the month's Reported VAT and Income from Essentio's own reports, find the Drafts left and the documents still awaiting payment, and say plainly what is and is not done. Use this whenever the person asks what VAT they owe for a month or quarter, wants to prepare or check a VAT return, asks how much they earned in a month, or says they are closing or wrapping up a month's books — even when they do not name Essentio.
---

# Close a month's VAT

The Essentio connector (`essentio_*` tools) reads one Business's reports as Essentio's dashboard
computes them. The figures that matter here are Essentio's, not yours: a VAT figure you add up yourself
from documents can differ by rounding, by currency or by which documents count, and the person may file
it. So every figure you state comes from a tool's answer, quoted as it is, with its currency.

Nothing in Essentio "closes" a month: no tool locks it, files a VAT return or sends anything to a tax
authority. What this workflow does is gather what Essentio knows about the month and tell the person
what is finished and what is still open.

## 1. Settle the period

Take the month the person means as its first and last day, `YYYY-MM-DD` (for a quarter, its first and
last day). Essentio dates documents by the day in UTC. If the person did not say which month, ask.

## 2. Read the month's figures

Call `essentio_get_report` twice, with the same `from` and `to`:

- `report: "vat"` — the Reported VAT: the VAT of the Invoices and Credit Notes issued in the period,
  in full, paid or not, a Credit Note subtracting. It answers `net`, `vat` and `bands` (the same split
  by VAT category and rate).
- `report: "income"` — Income: the net amounts of the documents issued in the period, paid or not, a
  Credit Note subtracting and a Proforma Invoice never converted adding only what was paid on it;
  its `vat` beside it.

Both are in the Business's reporting currency (`currency`). Each answers
`other_currency_documents`: how many documents issued in the period are in another currency and are
left out of every figure. Essentio never converts them. When that count is above zero, say so, and list
them (step 3) so the person can account for them.

A Proforma Invoice carries no VAT, so it is in no VAT figure, paid or not.

## 3. Find what is still open

Use `essentio_search_documents`. Each answer is one page: when it carries a `next_cursor`, call again
with it until there is none, or your list is incomplete.

- **Drafts left**: `status: "draft"`. A Draft has no issue date, so a period cannot narrow it; list
  them all, with their Client, Total, `due_date` and `created_at`, so the person can see which belong
  to the month. A Draft counts in no report. Issuing one now gives it today's issue date, so it counts
  in the month it is issued, not in the month being closed — say so before the person decides to
  issue it.
- **Awaiting payment**: `status: "awaiting_payment"` — every issued Invoice and Proforma Invoice that
  still takes a Payment, Overdue ones included. This does not change the Reported VAT, which counts
  documents on issue, paid or not; it tells the person what is still owed to them. For what is
  Overdue today, by Client, `essentio_get_report` with `report: "overdue"` gives Essentio's own totals.
- **Documents in another currency** (when `other_currency_documents` is above zero): list the ones
  the count counts. The VAT report counts the Invoices and Credit Notes issued in the period, not
  cancelled: search the period (`issued_from`, `issued_to`) with `document_type: "invoice"` and again
  with `document_type: "credit_note"`, leave out any whose `status` is `cancelled`, and keep those whose
  `currency` differs from the report's. The Income report's count also takes the Proforma Invoices
  issued in the period and never converted into an Invoice: search the period again with
  `document_type: "proforma"` and keep the ones not cancelled in another currency. A document's answer
  does not say whether a Proforma Invoice was converted, so this list may include converted ones and
  be longer than the count. Say so; do not present it as the count's documents exactly.

## 4. Say what is and is not done

Answer in three short parts:

1. **The month's figures** — Reported VAT (`net`, `vat`, and each band's category, rate, net and VAT)
   and Income, as the reports answered them, with their currency and period.
2. **Still open** — the Drafts left, the documents awaiting payment, and any documents in another
   currency left out of the figures, each with its number (or "Draft"), Client and amount as the tool
   answered it.
3. **Not done by Essentio** — the VAT return itself: Essentio reports the figure; filing and paying it
   are the person's (or their accountant's).

Some rules keep this honest:

- Quote each amount as the tool answered it. If you add anything up yourself, say that it is your sum,
  and never add amounts in different currencies.
- If a report is refused (a tool error whose text is JSON with `error.message`), quote the message and
  stop: do not estimate the missing figure from documents.
- This workflow only reads. If the person then asks to issue a Draft or record a Payment, that is a
  change to the Business: confirm it with them first, and use the tools for it one document at a time.
