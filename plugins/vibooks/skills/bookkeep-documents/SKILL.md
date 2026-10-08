---
name: bookkeep-documents
description: >
  Record receipts, bills, invoices, expenses, sales, payments, refunds, and
  statement-backed activity from source documents into Vibooks. Use when a
  user provides a folder or set of bookkeeping documents and wants reviewable,
  source-aware entries created through proper subledger workflows.
---

# Bookkeep Documents

Follow the bundled `vibooks` skill for professional bookkeeping treatment,
source evidence, jurisdiction, tax, correction, and verification rules.

The plugin already provides the bundled Vibooks workflow. Do not install a
duplicate standalone skill with `npx skills`; use the agent client's plugin
manager for plugin updates.

1. Run `vibooks_readiness` when available and confirm the intended company,
   book, accounting period, and source-document scope.
2. Read the original receipts, bills, invoices, statements, and attachments.
   Stop for material ambiguity in dates, counterparties, amounts, tax
   treatment, payment state, or intended accounting treatment.
3. Use first-class Vibooks workflows for invoices, bills, receipts, payments,
   refunds, applications, transfers, payroll, and adjustments. Do not replace
   them with generic journals when a supported workflow exists.
4. Discover unfamiliar operations with `vibooks_ops`, then inspect contracts
   with `vibooks_describe` and `vibooks_schema`.
5. Before any write, summarize the intended records and confirm that the user
   authorized that bookkeeping action. Pass `confirmMutation: true` to
   `vibooks_invoke` only for that reviewed, authorized write.
6. Attach or link source evidence where supported, read the result back, and
   run workflow-specific verification before calling the batch complete.

Report records created or corrected, evidence linked, exceptions requiring a
decision, and verification results. Do not claim tax filing, audit, or
assurance work.
