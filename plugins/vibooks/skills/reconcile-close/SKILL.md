---
name: reconcile-close
description: >
  Reconcile bank and credit-card statements, investigate differences, verify
  balances and subledgers, and prepare a Vibooks book for month end or period
  close. Use for reconciliation, close readiness, trial balance, aging,
  financial-report, or unresolved-difference work.
---

# Reconcile And Close

Follow the bundled `vibooks` skill for reconciliation, period controls,
corrections, source evidence, and professional bookkeeping rules.

The plugin already provides the bundled Vibooks workflow. Do not install a
duplicate standalone skill with `npx skills`; use the agent client's plugin
manager for plugin updates.

1. Confirm the company, book, statement account, statement dates, ending
   balance, and period under review. Never invent missing statement facts.
2. Run `vibooks_readiness` and use `vibooks_verify` for the initial read-only
   reconciliation and close-readiness view when those tools are available.
3. Tie statement balances to the account register and ledger. Investigate
   missing, duplicate, uncleared, misdated, misclassified, or unapplied items
   through their first-class source workflows.
4. Present proposed corrections and unresolved differences before mutation.
   Use `vibooks_invoke` with `confirmMutation: true` only after the user
   authorizes the specific correction.
5. Re-run reconciliation, trial-balance, subledger, aging, and relevant report
   checks after corrections. Do not close a period while material exceptions
   remain unresolved.

Finish with reconciled statement balances, unresolved differences, report and
subledger checks, proposed follow-ups, and a clear close-ready or not-ready
result.
