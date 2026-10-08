---
name: review-books
description: >
  Independently review AI-assisted or posted Vibooks bookkeeping against
  original receipts, invoices, bills, statements, attachments, and read-only
  ledger evidence. Use for bookkeeping quality control, discrepancy review,
  source-to-ledger validation, or a second-agent review without changing the
  book.
---

# Review Vibooks Books

Follow the bundled `vibooks` skill's independent evidence-review workflow and
professional bookkeeping criteria.

The plugin already provides the bundled Vibooks workflow. Do not install a
duplicate standalone skill with `npx skills`; use the agent client's plugin
manager for plugin updates.

1. Keep the review read-only. Do not pass `confirmMutation: true` and do not
   alter the Vibooks book during this skill.
2. Work from original source documents and read-only Vibooks state in a clean
   review workspace. Do not reuse the posting agent's extraction artifacts,
   intermediate files, conclusions, or reasoning as evidence.
3. Confirm the company, book, period, accounting basis, jurisdiction, tax
   setup, and evidence scope before drawing conclusions.
4. Use `vibooks_readiness`, `vibooks_verify`, and read-only operations through
   `vibooks_invoke` when available. Discover unfamiliar reads with
   `vibooks_ops`, `vibooks_describe`, and `vibooks_schema`.
5. Compare source facts with contacts, documents, postings, subledgers,
   reconciliations, tax summaries, and reports. Separate confirmed errors,
   missing evidence, policy questions, and acceptable treatments.

Deliver an evidence-based findings report with affected records, source facts,
ledger facts, materiality, and proposed correction workflows. Stop before any
correction until the user separately authorizes it.
